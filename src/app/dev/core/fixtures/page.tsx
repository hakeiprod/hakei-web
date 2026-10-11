import { loadScoreFixtures } from "../../load-score-fixtures";
import { notFound } from "next/navigation";
import { ScoreFixtureGallery } from "@/components/score-fixture-gallery";

export default async function ScoreFixturesPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const fixtures = await loadScoreFixtures("core");

  return (
    <main className="min-h-screen p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Core score fixtures</h1>
        <p className="mt-1 text-sm text-gray-600">
          {fixtures.length} fixtures · rendering errors are shown on each card
        </p>
      </header>
      <nav className="mb-4">
        <a href="/dev/mxl/fixtures">MusicXML fixtures</a>
      </nav>
      <ScoreFixtureGallery fixtures={fixtures} />
    </main>
  );
}
