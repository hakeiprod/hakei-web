/** Functional UI workflow. Performance is judged by the separate trace collector. */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
const sha = (value) => createHash("sha256").update(value).digest("hex");
const canonical = (value) =>
  JSON.stringify(value, (_key, item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(
          Object.entries(item).toSorted(([left], [right]) =>
            left.localeCompare(right),
          ),
        )
      : item,
  );
export async function verifyImportWorkflow({ values, manifest }) {
  const fixture = manifest.fixtures.find(
    (fixture) => fixture.id === (values.fixture ?? "naitoobunaitsu-bitomario"),
  );
  if (!fixture) throw new Error("UNKNOWN_FIXTURE");
  const bytes = await readFile(fixture.path);
  if (sha(bytes) !== fixture.sha256) throw new Error("FIXTURE_CHANGED");
  const directory = path.dirname(path.resolve(values.output));
  await mkdir(directory, { recursive: true });
  const { chromium } = await import(
    pathToFileURL(path.resolve(values["playwright-module"])).href
  );
  const browser = await chromium.launch({
    args: ["--no-sandbox"],
    executablePath: values["browser-path"],
  });
  const result = {
    kind: "functional-import-save-reload",
    performancePass: null,
    fixture: fixture.id,
    sha256: fixture.sha256,
    steps: [],
    status: "running",
  };
  const record = async (stage, details = {}) => {
    result.steps.push({ stage, ...details });
    await writeFile(values.output, JSON.stringify(result, null, 2) + "\n");
    console.log(stage);
  };
  try {
    const context = await browser.newContext({
      storageState: values["storage-state"],
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();
    page.setDefaultTimeout(30_000);
    const base = new URL(values["base-url"]);
    await page.goto(base.origin, { waitUntil: "domcontentloaded" });
    if (values["font-url"])
      await page.evaluate(async (url) => {
        const face = await new FontFace(
          "MeasurementBravura",
          `url(${url})`,
        ).load();
        document.fonts.add(face);
        await fetch("/A320U.sf2").then((response) => response.arrayBuffer());
      }, new URL(values["font-url"], base).href);
    await page.goto(new URL("/repositories", base).href, {
      waitUntil: "domcontentloaded",
    });
    const name = `Rendering verification ${Date.now()}`;
    await page.getByLabel("名前", { exact: true }).fill(name);
    await page.getByRole("button", { name: "作成", exact: true }).click();
    const section = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name, exact: true }) });
    await section
      .getByRole("link", { name: "楽譜を取り込む", exact: true })
      .click();
    result.repositoryId = new URL(page.url()).searchParams.get("repositoryId");
    await record("new-private-repository-created");
    const convertedResponse = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/score-import/preview" &&
        response.request().method() === "POST",
    );
    await page
      .getByLabel("楽譜ファイル（5MiB以内）")
      .setInputFiles(path.resolve(fixture.path));
    const response = await convertedResponse;
    if (!response.ok()) throw new Error(`PREVIEW_HTTP_${response.status()}`);
    const preview = await response.json();
    result.preview = {
      candidateSha256: sha(canonical(preview.candidate)),
      metadataSha256: sha(canonical(preview.metadata)),
      issuesSha256: sha(canonical(preview.issues)),
      validationSha256: sha(canonical(preview.validation)),
      notes: preview.candidate.notes.length,
      issues: preview.issues.length,
      version: preview.metadata.formatVersion,
      canPractice: preview.validation.canPractice,
      canGame: preview.validation.canGame,
    };
    if (
      fixture.id === "naitoobunaitsu-bitomario" &&
      (result.preview.notes !== 5540 ||
        result.preview.issues !== 312 ||
        result.preview.version !== "3.1")
    )
      throw new Error("ORIGINAL_SEMANTICS_CHANGED");
    await page
      .getByRole("heading", {
        name: path.basename(fixture.path) + "のプレビュー",
        exact: true,
      })
      .waitFor();
    const firstLabel = `トラック${preview.candidate.notes[0].trackId + 1}・音符1`;
    const startInput = page.getByLabel(`${firstLabel}の開始位置`, {
      exact: true,
    });
    await startInput.click();
    await startInput.press("Tab");
    if (
      !(await page
        .getByLabel(`${firstLabel}の長さ`, { exact: true })
        .evaluate((element) => element === document.activeElement))
    )
      throw new Error("PREVIEW_INPUT_UNRESPONSIVE");
    await page
      .locator('[data-layout][data-render-state="ready"] svg')
      .waitFor({ state: "visible" });
    await page.evaluate(() => document.fonts.ready);
    const ids = await page
      .locator('[data-layout] svg g[type="note"]')
      .evaluateAll((nodes) =>
        [
          ...new Set(
            nodes.map(
              (node) => `${node.dataset.trackId}/${node.dataset.noteId}`,
            ),
          ),
        ].toSorted(),
      );
    result.preview.renderedSourceIds = ids.length;
    result.preview.renderedSourceIdsSha256 = sha(JSON.stringify(ids));
    await page.locator("[data-layout]").scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(directory, "preview.png") });
    await record("preview-rendered-and-input-usable");
    const confirmations = page.getByRole("checkbox", {
        name: "この内容を確認しました",
        exact: true,
      }),
      count = await confirmations.count();
    const required = preview.issues.filter(
      (issue) => issue.severity !== "INFO" && issue.status === "UNRESOLVED",
    );
    if (count !== required.length)
      throw new Error("WARNING_CONFIRMATIONS_MISSING");
    const save = page.getByRole("button", {
      name: "確認した楽譜を保存",
      exact: true,
    });
    if (count > 0 && !(await save.isDisabled()))
      throw new Error("ACKNOWLEDGEMENT_GATE_MISSING");
    for (let index = 0; index < count; index++) {
      await confirmations.nth(index).check();
      if ((index + 1) % 50 === 0)
        console.log(`confirmed ${index + 1}/${count}`);
    }
    if (!(await save.isEnabled())) throw new Error("SAVE_REMAINS_DISABLED");
    await page.screenshot({
      path: path.join(directory, "warnings-confirmed.png"),
    });
    await record("warnings-confirmed", { confirmed: count });
    await save.click();
    await page.waitForURL(/\/score\/\d+$/, { timeout: 30_000 });
    result.scoreId = Number(new URL(page.url()).pathname.split("/").at(-1));
    await page
      .locator('[data-layout][data-render-state="ready"] svg')
      .waitFor({ state: "visible" });
    await page.screenshot({ path: path.join(directory, "saved-detail.png") });
    await record("saved-detail-rendered");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page
      .locator('[data-layout][data-render-state="ready"] svg')
      .waitFor({ state: "visible" });
    await page.screenshot({
      path: path.join(directory, "reloaded-detail.png"),
    });
    await record("saved-detail-reloaded");
    result.status = "complete";
  } catch (error) {
    result.status = "failed";
    result.failure = error instanceof Error ? error.message : "WORKFLOW_FAILED";
    throw error;
  } finally {
    await writeFile(values.output, JSON.stringify(result, null, 2) + "\n");
    await browser.close();
  }
  return result;
}
