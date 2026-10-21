import { performance } from "node:perf_hooks";
import { cpus, totalmem, availableParallelism } from "node:os";
import { readFile } from "node:fs/promises";
import * as Practice from "../src/s-core/models/practice";
import { Microseconds } from "../src/s-core/models/core/units/microseconds";
import { defaultEvaluationRule } from "../src/s-core/models/practice/default-rule";
import { convertScore } from "../src/s-core/models/import/convert";
import type {
  ExpectedNote,
  PerformanceEvent,
} from "../src/s-core/models/practice/contracts";
import { withCollaboration } from "../src/server/testing/collaboration";
import { initializeEvaluationRule } from "../src/server/evaluation-rule";
import {
  listPractice,
  recomputeAchievements,
} from "../src/server/practice-history";
async function measure(operation: () => unknown | Promise<unknown>) {
  await operation();
  const durations: number[] = [];
  for (let index = 0; index < 30; index++) {
    const start = performance.now();
    await operation();
    durations.push(performance.now() - start);
  }
  durations.sort((a, b) => a - b);
  return { runs: 30, p95Ms: durations[28], maxMs: durations[29] };
}
const notes: ExpectedNote[] = Array.from({ length: 10_000 }, (_, index) => ({
  noteId: String(index),
  trackId: 0,
  barNumber: Math.floor(index / 100) + 1,
  pitch: 60 + (index % 12),
  onsetUs: index * 10_000,
  durationUs: 5000,
}));
const events: PerformanceEvent[] = notes.flatMap((note, index) =>
  Array.from({ length: 5 }, (_, offset) => ({
    sequence: index * 5 + offset,
    type: offset % 2 === 0 ? ("NOTE_ON" as const) : ("NOTE_OFF" as const),
    channel: 0,
    pitch: offset < 2 ? note.pitch : note.pitch + 12,
    velocity: offset % 2 === 0 ? 90 : 0,
    relativeUs: note.onsetUs + offset * 1000,
  })),
);
const timeline = Practice.Timeline.import({
  notes,
  bars: [],
  continuations: [],
  durationUs: 100_000_000,
  rangeStartBeat: 0,
  rangeEndBeat: 200,
});
const conditions = Practice.Conditions.import({
  trackId: 0,
  rangeStartBar: 1,
  rangeEndBar: 100,
  tempoScale: 1,
  calibrationUs: 0,
  mode: "PRACTICE",
  ruleVersion: 1,
});
const evaluator = new Practice.Evaluator(
  timeline,
  conditions,
  defaultEvaluationRule,
);
const recording = Practice.Performance.import(events);
const analysis = await measure(() =>
  evaluator.evaluate(recording, {
    phase: "COMPLETED",
    endedUs: new Microseconds(100_000_000),
  }),
);
const bytes = await readFile("src/s-core/fixtures/import/quarter.musicxml");
const conversion = await measure(() =>
  convertScore({
    bytes,
    sourceName: "quarter.musicxml",
    options: { mode: "PRESERVE" },
  }),
);
let inputLimitRejected = false;
try {
  await convertScore({
    bytes: new Uint8Array(5 * 1024 * 1024 + 1),
    options: { mode: "PRESERVE" },
  });
} catch (error) {
  inputLimitRejected =
    error instanceof Error && error.message === "INPUT_LIMIT";
}
let history: Awaited<ReturnType<typeof measure>> | undefined;
await withCollaboration(async (fixture) => {
  const rule = await initializeEvaluationRule(fixture.database);
  await fixture.database.practiceSession.createMany({
    data: Array.from({ length: 50 }, (_, index) => ({
      userId: fixture.ownerId,
      clientSessionId: `benchmark-${index}`,
      scoreRevisionId: fixture.revisionId,
      trackId: 0,
      rangeStartBar: 1,
      rangeEndBar: 1,
      tempoScale: 1,
      calibrationUs: 0,
      mode: "PRACTICE",
      status: "COMPLETED",
      ruleId: rule.id,
      comparisonKey: "benchmark",
    })),
  });
  const sessions = await fixture.database.practiceSession.findMany({
    where: { userId: fixture.ownerId },
  });
  await fixture.database.evaluationResult.createMany({
    data: sessions.map((session) => ({
      sessionId: session.id,
      algorithmVersion: "benchmark",
      summary: { pitchAccuracy: 1, meanAbsTimingUs: 0 },
      perNote: [],
      perBar: [],
    })),
  });
  await fixture.database.$transaction((transaction) =>
    recomputeAchievements(transaction, fixture.ownerId),
  );
  history = await measure(async () => {
    const result = await listPractice(fixture.database, fixture.ownerId, {});
    if (result.items.length !== 50) throw new Error("BENCHMARK_LIST_SIZE");
  });
});
console.log(
  JSON.stringify(
    {
      node: process.version,
      logicalCPUs: cpus().length,
      availableParallelism: availableParallelism(),
      totalMemoryMiB: Math.round(totalmem() / 1024 / 1024),
      peakProcessRssMiB: process.resourceUsage().maxRSS / 1024,
      analysis: {
        expectedNotes: notes.length,
        inputEvents: events.length,
        ...analysis,
      },
      conversion: {
        format: "MusicXML 4 partwise",
        inputBytes: bytes.length,
        notes: 1,
        ...conversion,
      },
      history: { savedSessions: 50, pageSize: 50, ...history },
      inputLimitRejected,
    },
    null,
    2,
  ),
);
if (
  analysis.p95Ms > 2000 ||
  !history ||
  history.p95Ms > 500 ||
  !inputLimitRejected
)
  process.exitCode = 1;
