import { notFound } from "next/navigation";
import { ScoreFixtureGallery } from "@/components/score-fixture-gallery";
import { loadScoreFixtures } from "../../load-score-fixtures";

export default async function MusicXMLFixturesPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const fixtures = await loadScoreFixtures("mxl");
  return (
    <main className="min-h-screen p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">MusicXML score fixtures</h1>
        <p className="mt-1 text-sm text-gray-600">
          {fixtures.length} fixtures · import and rendering errors are shown on
          each card
        </p>
      </header>
      <nav className="mb-4">
        <a href="/dev/core/fixtures">Core fixtures</a>
      </nav>
      <ScoreFixtureGallery fixtures={fixtures} />
    </main>
  );
}
