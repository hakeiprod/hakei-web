import { importCandidateSchema } from "../../import/contracts";
import type { ConversionIssue } from "../../import/contracts";
export function capabilities(
  input: unknown,
  issues: readonly ConversionIssue[] = [],
  validationOptions?: { jitless?: boolean },
) {
  // Slots and rows are derived layout state; validate the musical snapshot.
  const candidate =
    input && typeof input === "object" && !("format" in input)
      ? { ...input, slots: [], rows: [] }
      : input;
  const parsed = importCandidateSchema.safeParse(candidate, validationOptions);
  const data = parsed.success ? parsed.data : undefined;
  const staves = data && !("format" in data) ? data.staves : [];
  const reasons: { code: string; message: string; track?: number }[] = [];
  const complete = Boolean(data && !data.format && Array.isArray(data.notes));
  if (!complete)
    reasons.push({
      code: "INCOMPLETE_NOTATION",
      message: "表示に必要な表記・時刻が未確定です。既知情報を保持しています。",
    });
  const percussion =
    data?.notes?.some((n) => n.percussion) ||
    staves.some((s) => s.staffSettings?.kind === "percussion");
  if (percussion)
    reasons.push({
      code: "PERCUSSION_PLAYBACK_UNSUPPORTED",
      message: "打楽器譜は表示できます。再生・練習・ゲームは未対応です。",
    });
  if (data?.notes?.some((n) => !n.rest && n.pitch == null))
    reasons.push({
      code: "MISSING_PERFORMANCE_PITCH",
      message: "演奏音高が不明です。表記から架空の音高は生成しません。",
    });
  if (data?.notes?.some((n) => n.sourceNotation))
    reasons.push({
      code: "UNSUPPORTED_TECHNIQUE",
      message: "省略した奏法の演奏には対応していません。",
    });
  const kinds = new Map<number, Set<string>>();
  for (const s of staves) {
    const list = kinds.get(s.trackId) ?? new Set<string>();
    list.add(s.staffSettings?.kind ?? "standard");
    kinds.set(s.trackId, list);
  }
  for (const [track, list] of kinds)
    if (
      list.has("standard") &&
      list.has("tablature") &&
      data?.notes?.some(
        (n) => n.trackId === track && !n.rest && !n.performanceEventId,
      )
    )
      reasons.push({
        code: "AMBIGUOUS_TAB_DOUBLING",
        track,
        message:
          "通常譜とTABの演奏対応が未確定です。重複演奏を防ぐため演奏を無効にしています。",
      });
  for (const issue of issues)
    if (issue.severity === "BLOCKING" && issue.status !== "RESOLVED")
      reasons.push({ code: issue.code, message: issue.message });
  const canPlay = complete && reasons.length === 0;
  return {
    canRender: complete,
    canPlayback: canPlay,
    canPractice: canPlay,
    canGame: canPlay,
    reasons,
  };
}
