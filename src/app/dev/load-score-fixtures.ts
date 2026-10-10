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
