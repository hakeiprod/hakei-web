/** SVG/geometry verification with raw raster diagnostics; visual review is separate. */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { parseArgs } from "node:util";
import path from "node:path";
import { pathToFileURL } from "node:url";
const { values } = parseArgs({
  options: {
    "base-url": { type: "string" },
    "storage-state": { type: "string" },
    "playwright-module": { type: "string" },
    "score-routes": { type: "string" },
    manifest: { type: "string" },
    output: { type: "string" },
    fixture: { type: "string" },
  },
});
for (const key of [
  "base-url",
  "storage-state",
  "playwright-module",
  "score-routes",
  "manifest",
  "output",
])
  if (!values[key]) throw new Error(`Missing --${key}`);
const base = new URL(values["base-url"]);
if (!["localhost", "127.0.0.1"].includes(base.hostname))
  throw new Error("LOCAL_ONLY");
const manifest = JSON.parse(await readFile(values.manifest, "utf8"));
const routes = JSON.parse(await readFile(values["score-routes"], "utf8"));
const { chromium } = await import(
  pathToFileURL(path.resolve(values["playwright-module"])).href
);
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const directory = path.dirname(path.resolve(values.output));
await mkdir(directory, { recursive: true });
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const result = {
  purpose: "same SVG in owned surface versus the original in-flow container",
  performancePass: null,
  comparisons: [],
};
try {
  for (const fixture of manifest.fixtures.filter(
    (f) => !values.fixture || f.id === values.fixture,
  )) {
    const route = routes.scores.find((r) => r.fixture === fixture.id);
    if (!route) throw new Error("ROUTE_MISSING");
    for (const layout of manifest.layouts)
      for (const viewport of manifest.viewports)
        for (const scale of manifest.scales) {
          const context = await browser.newContext({
            storageState: values["storage-state"],
            viewport,
          });
          try {
            const page = await context.newPage();
            const client = await context.newCDPSession(page);
            const captureViewport = async () => {
              await page.evaluate(
                () => new Promise((resolve) =>
                  requestAnimationFrame(() => requestAnimationFrame(resolve)),
                ),
              );
              // The score is idle. Avoid walking every SVG node merely to
              // prepare a screenshot; capture the visible surface directly.
              const { data } = await client.send("Page.captureScreenshot", {
                format: "png",
                fromSurface: true,
              });
              return Buffer.from(data, "base64");
            };
            await page.addInitScript(
              ({ layout, scale }) => {
                localStorage.setItem(
                  "layoutType",
                  JSON.stringify(
                    ["Horizontal", "Vertical", "Page"].indexOf(layout),
                  ),
                );
                localStorage.setItem("scale", JSON.stringify(scale));
                localStorage.setItem("debug", "false");
              },
              { layout, scale },
            );
            await page.goto(new URL(route.path, base).href, {
              waitUntil: "domcontentloaded",
            });
            await page
              .locator('[data-layout][data-render-state="ready"] svg')
              .waitFor({ timeout: 30_000 });
            await page.evaluate(() => document.fonts.ready);
            await page.waitForTimeout(1000);
            const key = `${fixture.id}-${layout}-${viewport.width}x${viewport.height}-${scale}`;
            const actual = await captureViewport();
            const geometry = await page.evaluate(() => {
              const host = document.querySelector("[data-layout]");
              const owner = host.parentElement;
              const placeholder = document.querySelector(
                `[aria-owns="${owner.id}"]`,
              );
              const svg = host.querySelector("svg");
              // This function must travel with its serialized page.evaluate callback.
              // eslint-disable-next-line unicorn/consistent-function-scoping
              const describe = (node) => {
                const box = node.getBoundingClientRect(),
                  matrix = node.getScreenCTM();
                return {
                  box: [box.x, box.y, box.width, box.height],
                  matrix: [
                    matrix.a,
                    matrix.b,
                    matrix.c,
                    matrix.d,
                    matrix.e,
                    matrix.f,
                  ],
                  font: getComputedStyle(node.querySelector("text") ?? node)
                    .fontFamily,
                };
              };
              // Serialized into the browser evaluation context.
              // eslint-disable-next-line unicorn/consistent-function-scoping
              const paintStyles = (node) =>
                JSON.stringify(
                  [...node.querySelectorAll("text,line,rect,path")].map(
                    (element) => {
                      const style = getComputedStyle(element);
                      return [
                        "fill",
                        "stroke",
                        "stroke-width",
                        "fill-opacity",
                        "stroke-opacity",
                        "opacity",
                        "visibility",
                        "display",
                        "font-family",
                        "font-size",
                        "font-weight",
                        "font-style",
                        "letter-spacing",
                        "text-anchor",
                      ].map((key) => style.getPropertyValue(key));
                    },
                  ),
                );
              const beforeStyles = paintStyles(svg);
              const before = describe(svg);
              const originalContainer = host.cloneNode(false);
              for (const key of [
                "position",
                "left",
                "top",
                "width",
                "clipPath",
                "contain",
                "willChange",
                "opacity",
                "backgroundColor",
              ])
                originalContainer.style[key] = "";
              if (host.dataset.layout !== "page")
                originalContainer.style.height = "";
              originalContainer.style.maxHeight =
                host.dataset.layout === "vertical" ? "70vh" : "";
              const clone = svg.cloneNode(true);
              originalContainer.append(clone);
              placeholder.append(originalContainer);
              host.style.opacity = "0";
              const viewport = host.getBoundingClientRect();
              return {
                viewportBox: {
                  x: viewport.x,
                  y: viewport.y,
                  width: viewport.width,
                  height: viewport.height,
                },
                before,
                original: describe(clone),
                svgIdentical: svg.outerHTML === clone.outerHTML,
                beforeStyles,
                originalStyles: paintStyles(clone),
                notes: svg.querySelectorAll('g[type="note"]').length,
              };
            });
            const original = await captureViewport();
            const pixels = actual.equals(original)
              ? {
                  equal: true,
                  differingPixels: 0,
                  drawingEqual: true,
                  drawingDifferingPixels: 0,
                  drawingMaxChannelDelta: 0,
                }
              : await page.evaluate(
                  async ({ actual, original, box }) => {
                    const images = await Promise.all(
                      [actual, original].map(async (source) => {
                        const image = new Image();
                        image.src = source;
                        await image.decode();
                        return image;
                      }),
                    );
                    const canvas = document.createElement("canvas");
                    canvas.width = images[0].width;
                    canvas.height = images[0].height;
                    const context = canvas.getContext("2d");
                    const rgba = images.map((image) => {
                      context.clearRect(0, 0, canvas.width, canvas.height);
                      context.drawImage(image, 0, 0);
                      return context.getImageData(
                        0,
                        0,
                        canvas.width,
                        canvas.height,
                      ).data;
                    });
                    let differingPixels = 0,
                      drawingDifferingPixels = 0,
                      drawingMaxChannelDelta = 0;
                    for (let index = 0; index < rgba[0].length; index += 4) {
                      if (
                        ![0, 1, 2, 3].some(
                          (c) => rgba[0][index + c] !== rgba[1][index + c],
                        )
                      )
                        continue;
                      differingPixels++;
                      const x = (index / 4) % canvas.width,
                        y = Math.floor(index / 4 / canvas.width);
                      // Cover the visible score viewport, including partial boundary pixels.
                      // Controls above the score are recorded in the full-screen diagnostic.
                      if (
                        x >= Math.floor(box.x) &&
                        x < Math.ceil(box.x + box.width) &&
                        y >= Math.floor(box.y) &&
                        y < Math.ceil(box.y + box.height)
                      ) {
                        drawingDifferingPixels++;
                        for (let channel = 0; channel < 4; channel++)
                          drawingMaxChannelDelta = Math.max(
                            drawingMaxChannelDelta,
                            Math.abs(
                              rgba[0][index + channel] -
                                rgba[1][index + channel],
                            ),
                          );
                      }
                    }
                    return {
                      equal: differingPixels === 0,
                      differingPixels,
                      drawingEqual: drawingDifferingPixels === 0,
                      drawingDifferingPixels,
                      drawingMaxChannelDelta,
                    };
                  },
                  {
                    actual: `data:image/png;base64,${actual.toString("base64")}`,
                    original: `data:image/png;base64,${original.toString("base64")}`,
                    box: geometry.viewportBox,
                  },
                );
            await writeFile(path.join(directory, `${key}.owned.png`), actual);
            await writeFile(
              path.join(directory, `${key}.original-flow.png`),
              original,
            );
            const computedStylesIdentical =
              geometry.beforeStyles === geometry.originalStyles;
            const beforeStylesSha256 = sha(geometry.beforeStyles),
              originalStylesSha256 = sha(geometry.originalStyles);
            delete geometry.beforeStyles;
            delete geometry.originalStyles;
            const entry = {
              fixture: fixture.id,
              layout,
              viewport,
              scale,
              ...geometry,
              ...pixels,
              actualSha256: sha(actual),
              originalSha256: sha(original),
              computedStylesIdentical,
              beforeStylesSha256,
              originalStylesSha256,
              sourceAndGeometryMatch:
                computedStylesIdentical &&
                geometry.svgIdentical &&
                JSON.stringify(geometry.before) ===
                  JSON.stringify(geometry.original),
            };
            result.comparisons.push(entry);
            await writeFile(
              values.output,
              JSON.stringify(result, null, 2) + "\n",
            );
            process.stdout.write(
              `${key}: source=${entry.sourceAndGeometryMatch} rasterExact=${entry.drawingEqual}\n`,
            );
          } finally {
            await context.close();
          }
        }
  }
  result.sourceAndGeometryMatch =
    result.comparisons.length > 0 &&
    result.comparisons.every((r) => r.sourceAndGeometryMatch);
  result.exactRasterMatch = result.comparisons.every((r) => r.drawingEqual);
  result.visualReviewRequired = true;
  await writeFile(values.output, JSON.stringify(result, null, 2) + "\n");
  if (!result.sourceAndGeometryMatch) process.exitCode = 1;
} finally {
  await browser.close();
}
