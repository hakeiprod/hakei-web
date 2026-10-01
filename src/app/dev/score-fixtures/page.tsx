import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";
import { ScoreFixtureGallery } from "@/components/score-fixture-gallery";

export default async function ScoreFixturesPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const fixtureDirectory = path.join(
    process.cwd(),
    "src/s-core/fixtures/core",
  );
  const directoryEntries = await readdir(fixtureDirectory);
  const names = directoryEntries
    .filter((name) => name.endsWith(".json"))
    .toSorted();
  const fixtures = await Promise.all(
    names.map(async (name) => {
      const contents = await readFile(path.join(fixtureDirectory, name), "utf8");
      return {
        name,
        data: JSON.parse(contents) as Record<string, unknown>,
      };
    }),
  );

  return (
    <main className="min-h-screen p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Core score fixtures</h1>
        <p className="mt-1 text-sm text-gray-600">
          {fixtures.length} fixtures · rendering errors are shown on each card
        </p>
      </header>
      <ScoreFixtureGallery fixtures={fixtures} />
    </main>
  );
}
