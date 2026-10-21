import { notFound } from "next/navigation";
import { loadNotationFixtures } from "../../load-score-fixtures";
import { ScoreFixtureGallery } from "@/components/score-fixture-gallery";
export default async function NotationFixturesPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const fixtures = [
    ...(await loadNotationFixtures()),
    ...(await loadNotationFixtures("tab-drum")),
  ];
  return (
    <main className="min-h-screen p-6">
      <h1 className="mb-4 text-2xl font-semibold">Notation fixtures</h1>
      <p className="mb-4">
        記号ごとの期待条件と検証結果。Rendered は検証合格を意味しません。
      </p>
      <nav className="mb-4">
        <a href="/dev/core/fixtures">Core</a> ·{" "}
        <a href="/dev/mxl/fixtures">MusicXML</a>
      </nav>
      <ScoreFixtureGallery fixtures={fixtures} />
    </main>
  );
}
