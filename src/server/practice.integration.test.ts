import { payloadHash } from "./contracts";
import { expect, it } from "vitest";
import { withCollaboration } from "./testing/collaboration";
import { initializeEvaluationRule } from "./evaluation-rule";
import { beginPractice, markPracticeRecording, savePractice } from "./practice";
const conditions = {
  trackId: 0,
  rangeStartBar: 1,
  rangeEndBar: 1,
  tempoScale: 1,
  calibrationUs: 0,
  mode: "PRACTICE" as const,
  ruleVersion: 1,
};
const events = [
  {
    sequence: 0,
    type: "NOTE_ON" as const,
    channel: 0,
    pitch: 60,
    velocity: 90,
    relativeUs: 0,
  },
  {
    sequence: 1,
    type: "NOTE_OFF" as const,
    channel: 0,
    pitch: 60,
    velocity: 0,
    relativeUs: 500_000,
  },
];
it("reevaluates events, freezes revision/conditions and returns identical retries", async () =>
  withCollaboration(async (fixture) => {
    await initializeEvaluationRule(fixture.database);
    const input = {
      clientSessionId: "practice-once",
      scoreId: fixture.scoreId,
      scoreRevisionId: fixture.revisionId,
      conditions,
      status: "COMPLETED",
      endedUs: 2_150_000,
      eventBatches: [{ batchIndex: 0, events }],
    };
    const first = await savePractice(
      fixture.database,
      fixture.git,
      fixture.ownerId,
      input,
    );
    const stored = await fixture.database.practiceSession.findUniqueOrThrow({
      where: { id: first.sessionId },
      include: { eventBatches: true, evaluation: true },
    });
    expect(stored.eventBatches[0].events).toEqual(events);
    expect(stored.eventBatches[0].checksum).toBe(payloadHash(events));
    expect(stored.submissionHash).toBe(
      payloadHash({ ...input, deviceLabel: null }),
    );
    expect(stored.comparisonKey).toBe(
      payloadHash({
        scoreRevisionId: fixture.revisionId,
        ruleId: stored.ruleId,
        ...conditions,
      }),
    );
    expect(stored.scoreRevisionId).toBe(fixture.revisionId);
    expect(stored.evaluation?.perNote).toEqual(first.evaluation.perNote);
    expect(first.evaluation.summary).toMatchObject({
      correctCount: 1,
      pitchAccuracy: 1,
      meanAbsTimingUs: 0,
    });
    for (let index = 0; index < 2; index++)
      expect(
        await savePractice(
          fixture.database,
          fixture.git,
          fixture.ownerId,
          input,
        ),
      ).toEqual(first);
    expect(
      await fixture.database.practiceSession.count({
        where: { userId: fixture.ownerId },
      }),
    ).toBe(1);
    await expect(
      savePractice(fixture.database, fixture.git, fixture.ownerId, {
        ...input,
        conditions: { ...conditions, tempoScale: 2 },
      }),
    ).rejects.toThrow("CONFLICT");
    await expect(
      savePractice(fixture.database, fixture.git, fixture.ownerId, {
        ...input,
        eventBatches: [
          { batchIndex: 0, events: [{ ...events[0], pitch: 61 }, events[1]] },
        ],
      }),
    ).rejects.toThrow("CONFLICT");
  }));
it("cannot accept a claimed client score or mark an unclosed recording complete", async () =>
  withCollaboration(async (fixture) => {
    await initializeEvaluationRule(fixture.database);
    const input = {
      clientSessionId: "practice-open",
      scoreId: fixture.scoreId,
      scoreRevisionId: fixture.revisionId,
      conditions,
      status: "COMPLETED",
      endedUs: 2_150_000,
      eventBatches: [{ batchIndex: 0, events: [events[0]] }],
    };
    await expect(
      savePractice(fixture.database, fixture.git, fixture.ownerId, {
        ...input,
        score: 100,
      }),
    ).rejects.toThrow();
    await expect(
      savePractice(fixture.database, fixture.git, fixture.ownerId, input),
    ).rejects.toThrow("OPEN_NOTES");
    const interrupted = await savePractice(
      fixture.database,
      fixture.git,
      fixture.ownerId,
      { ...input, status: "INTERRUPTED", endedUs: 100_000 },
    );
    expect(interrupted.status).toBe("INTERRUPTED");
    expect(interrupted.evaluation.score).toBeNull();
  }));

it("rejects unavailable revisions and rechecks access before recording and saving", async () =>
  withCollaboration(async (fixture) => {
    await initializeEvaluationRule(fixture.database);
    const input = {
      clientSessionId: "revoked-practice",
      scoreId: fixture.scoreId,
      scoreRevisionId: fixture.revisionId,
      conditions,
      status: "COMPLETED",
      endedUs: 2_150_000,
      eventBatches: [{ batchIndex: 0, events }],
    };
    await expect(
      beginPractice(fixture.database, fixture.git, fixture.editorId, {
        clientSessionId: "wrong-revision",
        scoreId: fixture.scoreId,
        scoreRevisionId: "unknown",
        conditions,
      }),
    ).rejects.toThrow("NOT_FOUND");
    const started = await beginPractice(
      fixture.database,
      fixture.git,
      fixture.editorId,
      {
        clientSessionId: input.clientSessionId,
        scoreId: input.scoreId,
        scoreRevisionId: input.scoreRevisionId,
        conditions,
      },
    );
    await fixture.database.scoreRepository.update({
      where: { id: fixture.repositoryId },
      data: { visibility: "PRIVATE" },
    });
    await expect(
      markPracticeRecording(
        fixture.database,
        fixture.editorId,
        started.sessionId,
      ),
    ).rejects.toThrow("NOT_FOUND");
    await expect(
      savePractice(fixture.database, fixture.git, fixture.editorId, input),
    ).rejects.toThrow("NOT_FOUND");
    expect(
      await fixture.database.evaluationResult.count({
        where: { sessionId: started.sessionId },
      }),
    ).toBe(0);
  }));
it("recalculates identical input in three distinct sessions without trusting client analysis", async () =>
  withCollaboration(async (fixture) => {
    await initializeEvaluationRule(fixture.database);
    const results = [];
    for (let index = 0; index < 3; index++) {
      const result = await savePractice(
        fixture.database,
        fixture.git,
        fixture.ownerId,
        {
          clientSessionId: `independent-${index}`,
          scoreId: fixture.scoreId,
          scoreRevisionId: fixture.revisionId,
          conditions,
          status: "COMPLETED",
          endedUs: 2_150_000,
          eventBatches: [{ batchIndex: 0, events }],
        },
      );
      results.push(result.evaluation);
    }
    expect(results[1]).toEqual(results[0]);
    expect(results[2]).toEqual(results[0]);
  }));
it("requires the positive calibration tail and evaluates delayed input on the original timeline", async () =>
  withCollaboration(async (fixture) => {
    await initializeEvaluationRule(fixture.database);
    const input = {
      clientSessionId: "calibrated",
      scoreId: fixture.scoreId,
      scoreRevisionId: fixture.revisionId,
      conditions: { ...conditions, calibrationUs: 300_000 },
      status: "COMPLETED",
      endedUs: 2_150_000,
      eventBatches: [
        {
          batchIndex: 0,
          events: events.map((event) => ({
            ...event,
            relativeUs: event.relativeUs + 300_000,
          })),
        },
      ],
    };
    await expect(
      savePractice(fixture.database, fixture.git, fixture.ownerId, input),
    ).rejects.toThrow("SESSION_INCOMPLETE");
    const saved = await savePractice(
      fixture.database,
      fixture.git,
      fixture.ownerId,
      { ...input, endedUs: 2_450_000 },
    );
    expect(saved.evaluation.summary).toMatchObject({
      correctCount: 1,
      meanAbsTimingUs: 0,
    });
  }));
