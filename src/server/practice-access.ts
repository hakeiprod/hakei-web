import "server-only";
import { readScore, type ReaderDatabase } from "./score-reader";
import { GitStore } from "./git-store";
/** Start and save paths must both authorize the indexed revision and use its server validation. */
export async function requirePlayableRevision(
  database: ReaderDatabase,
  git: GitStore,
  scoreId: number,
  actorId: string,
  revisionId: string,
  mode: "PRACTICE" | "GAME",
) {
  const score = await readScore(database, git, scoreId, actorId, revisionId);
  if (
    !score.artifacts ||
    !(mode === "GAME"
      ? score.artifacts.validation.canGame
      : score.artifacts.validation.canPractice)
  )
    throw new Error("PLAYBACK_BLOCKED");
  return score;
}
