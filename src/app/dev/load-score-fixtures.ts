import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Fixture } from "@/components/score-fixture-gallery";
import { Importer } from "@/s-core/models/browser/importer";

export async function loadScoreFixtures(
  kind: "core" | "mxl",
): Promise<Fixture[]> {
  const directory = path.join(
    process.cwd(),
    "src/s-core/fixtures",
    kind === "core" ? "core" : "files/musicxml",
  );
  const extension = kind === "core" ? ".json" : ".mxl";
  const entries = await readdir(directory);
  const names = entries.filter((name) => name.endsWith(extension)).toSorted();
  return Promise.all(
    names.map(async (name): Promise<Fixture> => {
      try {
        const contents = await readFile(path.join(directory, name));
        if (kind === "core")
          return { name, data: JSON.parse(contents.toString("utf8")) };
        const sheet = await new Importer().import(
          new File([new Uint8Array(contents)], name),
        );
        // Exported slots contain Beat instances; the server/client boundary needs plain data.
        return { name, sheet: structuredClone(sheet.export()) };
      } catch (error) {
        return {
          name,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );
}

/** Development-only, explicit manifest: metadata files are never treated as scores. */
export async function loadNotationFixtures(
  suiteName = "notation",
): Promise<Fixture[]> {
  if (process.env.NODE_ENV === "production") return [];
  const [
    { fixtureManifestSchema, reportSchema },
    { convertScore },
    { selectResults },
    report,
  ] = await Promise.all([
    import("@/s-core/models/fixtures/manifest"),
    import("@/s-core/models/import/convert"),
    import("@/s-core/models/fixtures/results"),
    import("../../../scripts/lib/notation-report"),
  ]);
  const suite = report.fixtureSuite(suiteName);
  const manifest = fixtureManifestSchema.parse(
    JSON.parse(
      await readFile(path.join(report.fixtureRoot, suite.manifest), "utf8"),
    ),
  );
  const revision = await report.rendererRevision();
  const runs: import("@/s-core/models/fixtures/manifest").VerificationRun[] =
    [];
  let reportError: string | undefined;
  for (const name of ["verification-results.json", "visual-results.json"]) {
    try {
      runs.push(
        ...reportSchema.parse(
          JSON.parse(
            await readFile(path.join(suite.reportDirectory, name), "utf8"),
          ),
        ).runs,
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT")
        reportError = `${name}: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
  return Promise.all(
    manifest.fixtures.map(async (definition): Promise<Fixture> => {
      const base = { name: definition.id, definition };
      try {
        const bytes = await report.readFixture(definition.source.path);
        const identity = {
          ...report.fixtureIdentity(bytes, definition, revision),
          layout: definition.layout ?? null,
        };
        const results = selectResults(definition, runs, identity);
        const metadata = {
          ...base,
          results,
          ...(reportError ? { reportError } : {}),
        };
        if (definition.expectedOutcome === "reject")
          return { ...metadata, rejected: true };
        if (definition.expectedOutcome === "partial")
          return { ...metadata, partial: true };
        const result = await convertScore({
          bytes,
          sourceName: definition.source.path,
          options: { mode: "PRESERVE" },
        });
        if ("format" in result.candidate)
          throw new Error("MUSICAL_INFORMATION_INCOMPLETE");
        return {
          ...metadata,
          sheet: structuredClone(result.candidate) as unknown as ReturnType<
            import("@/s-core/models/sheet").Score["export"]
          >,
        };
      } catch (error) {
        return {
          ...base,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );
}
