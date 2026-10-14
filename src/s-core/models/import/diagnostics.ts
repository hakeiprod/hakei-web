import {
  conversionIssueSchema,
  importCandidateSchema,
  type ConversionIssue,
} from "./contracts";

export const validatorVersion = "score-import-validation-v1";
/** Recompute field diagnostics; acknowledgements never influence musical validity. */
export function validateCandidate(
  input: unknown,
  suppliedIssues: readonly ConversionIssue[],
) {
  const candidate = importCandidateSchema.parse(input);
  const issues = suppliedIssues
    .filter(
      (issue) =>
        !issue.id.startsWith("tie:") && issue.id !== "validation:no-attacks",
    )
    .map((issue) => conversionIssueSchema.parse(issue));
  if (new Set(issues.map((issue) => issue.id)).size !== issues.length)
    throw new Error("DUPLICATE_DIAGNOSTIC");
  const missing = new Set<string>();
  if ("format" in candidate && candidate.format === "converted-partial-v1") {
    for (const [index, note] of candidate.notes.entries()) {
      for (const field of ["pitch", "onset", "duration"] as const) {
        if (note[field] !== null || (field === "pitch" && note.rest)) continue;
        const id = `missing:${note.trackId}:${note.id}:${field}`;
        missing.add(id);
        const diagnostic: ConversionIssue = {
          id,
          code: `MISSING_${field.toUpperCase()}`,
          severity: "BLOCKING",
          status: "UNRESOLVED",
          fieldPath: `notes.${index}.${field}`,
          track: note.trackId,
          message: `${field}の値が不明です。確認して修正してください。`,
        };
        const existing = issues.findIndex((issue) => issue.id === id);
        if (existing === -1) {
          issues.push(diagnostic);
        } else {
          issues[existing] = diagnostic;
        }
      }
    }
  }
  for (const issue of issues) {
    if (
      issue.id.startsWith("missing:") &&
      ["MISSING_PITCH", "MISSING_ONSET", "MISSING_DURATION"].includes(
        issue.code,
      ) &&
      !missing.has(issue.id)
    )
      issue.status = "RESOLVED";
  }
  for (const issue of issues) {
    if (
      ![
        "MISSING_DURATION",
        "MISSING_PITCH",
        "MISSING_ONSET",
        "MIDI_UNCLOSED_NOTE",
      ].includes(issue.code) ||
      !issue.fieldPath
    )
      continue;
    const match = /^notes\.(\d+)\.(pitch|onset|start|duration)$/.exec(
      issue.fieldPath,
    );
    if (!match) continue;
    const note = candidate.notes[Number(match[1])];
    if (!note) continue;
    const field = match[2];
    const value =
      field === "pitch"
        ? note.pitch
        : field === "duration"
          ? note.duration
          : "onset" in note
            ? note.onset
            : note.start;
    issue.status = typeof value === "number" ? "RESOLVED" : "UNRESOLVED";
  }
  const pendingTies = new Map<
    string,
    { end: number; id: string; index: number }
  >();
  const ordered = candidate.notes
    .map((note, index) => ({
      note,
      index,
      start:
        "start" in note && typeof note.start === "number"
          ? note.start
          : typeof note.onset === "number"
            ? note.onset
            : null,
    }))
    .toSorted((a, b) => (a.start ?? 0) - (b.start ?? 0) || a.index - b.index);
  function tieIssue(kind: string, id: string, index: number) {
    issues.push({
      id: `tie:${kind}:${id}`,
      code: kind,
      severity: "BLOCKING",
      status: "UNRESOLVED",
      fieldPath: `notes.${index}.ties`,
      message:
        "タイの開始・継続・終了が一致しません。音高と時刻を確認してください。",
    });
  }
  for (const { note, index, start } of ordered) {
    if (
      note.rest ||
      note.pitch === null ||
      start === null ||
      note.duration === null
    )
      continue;
    const key = `${note.trackId}:${note.voice ?? 1}:${note.staveId ?? 0}:${note.pitch}`;
    const id = `${note.trackId}:${note.id}`;
    if (note.ties?.includes("stop")) {
      const previous = pendingTies.get(key);
      if (!previous || Math.abs(previous.end - start) > 1e-9)
        tieIssue("UNMATCHED_TIE", id, index);
      pendingTies.delete(key);
    }
    if (note.ties?.includes("start"))
      pendingTies.set(key, { end: start + note.duration, id, index });
  }
  for (const pending of pendingTies.values())
    tieIssue("UNCLOSED_TIE", pending.id, pending.index);
  if (
    !candidate.notes.some((note) => !note.rest && !note.ties?.includes("stop"))
  )
    issues.push({
      id: "validation:no-attacks",
      code: "NO_EXPECTED_ATTACKS",
      severity: "BLOCKING",
      status: "UNRESOLVED",
      message: "練習・ゲームで評価する打鍵がありません。",
    });
  const unresolvedIssueIds = issues
    .filter(
      (issue) => issue.severity === "BLOCKING" && issue.status === "UNRESOLVED",
    )
    .map((issue) => issue.id);
  // A partial candidate must first be promoted to a fully checked Sheet before playback.
  const complete = !(
    "format" in candidate && candidate.format === "converted-partial-v1"
  );
  const canPlay = complete && unresolvedIssueIds.length === 0;
  return {
    candidate,
    issues,
    validation: {
      validatorVersion,
      canPractice: canPlay,
      canGame: canPlay,
      unresolvedIssueIds,
    },
  };
}
