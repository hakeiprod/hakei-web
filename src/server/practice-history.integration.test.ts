import { expect, it } from "vitest";
import { initializeEvaluationRule } from "./evaluation-rule";
import { savePractice } from "./practice";
import { deletePractice, listPractice, readPractice } from "./practice-history";
import { withCollaboration } from "./testing/collaboration";
const conditions = {
  trackId: 0,
  rangeStartBar: 1,
  rangeEndBar: 1,
  tempoScale: 1,
  calibrationUs: 0,
  mode: "PRACTICE",
  ruleVersion: 1,
};
const eventBatch = (delta: number) => [
  {
    batchIndex: 0,
    events: [
      {
        sequence: 0,
        type: "NOTE_ON",
        channel: 0,
        pitch: 60,
        velocity: 90,
        relativeUs: delta,
      },
      {
        sequence: 1,
        type: "NOTE_OFF",
        channel: 0,
        pitch: 60,
        velocity: 0,
        relativeUs: 500_000,
      },
    ],
  },
];
it("keeps personal history private, compares identical conditions and recomputes achievements after deletion", async () =>
  withCollaboration(async (fixture) => {
    await initializeEvaluationRule(fixture.database);
    const input = {
      clientSessionId: "first",
      scoreId: fixture.scoreId,
      scoreRevisionId: fixture.revisionId,
      conditions,
      status: "COMPLETED",
      endedUs: 2_150_000,
      eventBatches: [],
    };
    const first = await savePractice(
      fixture.database,
      fixture.git,
      fixture.editorId,
      input,
    );
    const events = [
      {
        sequence: 0,
        type: "NOTE_ON",
        channel: 0,
        pitch: 60,
        velocity: 90,
        relativeUs: 0,
      },
      {
        sequence: 1,
        type: "NOTE_OFF",
        channel: 0,
        pitch: 60,
        velocity: 0,
        relativeUs: 500_000,
      },
    ];
    const second = await savePractice(
      fixture.database,
      fixture.git,
      fixture.editorId,
      {
        ...input,
        clientSessionId: "second",
        eventBatches: [{ batchIndex: 0, events }],
      },
    );
    const interrupted = await savePractice(
      fixture.database,
      fixture.git,
      fixture.editorId,
      {
        ...input,
        clientSessionId: "interrupted",
        status: "INTERRUPTED",
        endedUs: 0,
      },
    );
    await savePractice(fixture.database, fixture.git, fixture.editorId, input);
    let history = await listPractice(fixture.database, fixture.editorId, {});
    expect(history.completedCount).toBe(2);
    expect(
      history.items.find((item) => item.id === second.sessionId)?.isBest,
    ).toBe(true);
    expect(
      history.items.find((item) => item.id === interrupted.sessionId)?.isBest,
    ).toBe(false);
    const ownerHistory = await listPractice(
      fixture.database,
      fixture.ownerId,
      {},
    );
    expect(ownerHistory.items).toEqual([]);
    await expect(
      readPractice(
        fixture.database,
        fixture.git,
        fixture.ownerId,
        second.sessionId,
      ),
    ).rejects.toThrow("NOT_FOUND");
    await fixture.database.scoreRepository.update({
      where: { id: fixture.repositoryId },
      data: { visibility: "PRIVATE" },
    });
    const interruptedDetail = await readPractice(
      fixture.database,
      fixture.git,
      fixture.editorId,
      interrupted.sessionId,
    );
    expect(interruptedDetail.status).toBe("INTERRUPTED");
    expect(interruptedDetail.evaluation.score).toBeNull();
    expect(interruptedDetail.evaluation.summary).toMatchObject({
      expectedCount: 0,
      pitchAccuracy: null,
      meanAbsTimingUs: null,
    });
    const detail = await readPractice(
      fixture.database,
      fixture.git,
      fixture.editorId,
      second.sessionId,
    );
    expect(detail.score).toBeNull();
    expect(detail.evaluation.summary).toMatchObject({ pitchAccuracy: 1 });
    const revokedHistory = await listPractice(
      fixture.database,
      fixture.editorId,
      {},
    );
    expect(
      revokedHistory.items.find((item) => item.id === second.sessionId)
        ?.canReadScore,
    ).toBe(false);
    await deletePractice(fixture.database, fixture.editorId, {
      sessionId: second.sessionId,
      key: "delete-once",
    });
    await deletePractice(fixture.database, fixture.editorId, {
      sessionId: second.sessionId,
      key: "delete-once",
    });
    history = await listPractice(fixture.database, fixture.editorId, {});
    expect(history.completedCount).toBe(1);
    expect(
      history.items.find((item) => item.id === first.sessionId)?.isBest,
    ).toBe(true);
    expect(
      await fixture.database.performanceEventBatch.count({
        where: { sessionId: second.sessionId },
      }),
    ).toBe(0);
    expect(
      await fixture.database.achievement.count({
        where: { userId: fixture.editorId, type: "FIRST_COMPLETION" },
      }),
    ).toBe(1);
    await expect(
      deletePractice(fixture.database, fixture.ownerId, {
        sessionId: first.sessionId,
        key: "foreign",
      }),
    ).rejects.toThrow("NOT_FOUND");
  }));
it("keeps comparison groups separate and favors accuracy, then numeric timing, then the earlier tie", async () =>
  withCollaboration(async (fixture) => {
    await initializeEvaluationRule(fixture.database);
    const input = {
      scoreId: fixture.scoreId,
      scoreRevisionId: fixture.revisionId,
      conditions,
      status: "COMPLETED",
      endedUs: 2_150_000,
      eventBatches: [],
    };
    const empty = await savePractice(
      fixture.database,
      fixture.git,
      fixture.ownerId,
      { ...input, clientSessionId: "empty" },
    );
    const late = await savePractice(
      fixture.database,
      fixture.git,
      fixture.ownerId,
      { ...input, clientSessionId: "late", eventBatches: eventBatch(50_000) },
    );
    const perfect = await savePractice(
      fixture.database,
      fixture.git,
      fixture.ownerId,
      { ...input, clientSessionId: "perfect", eventBatches: eventBatch(0) },
    );
    const tied = await savePractice(
      fixture.database,
      fixture.git,
      fixture.ownerId,
      { ...input, clientSessionId: "tied", eventBatches: eventBatch(0) },
    );
    const changed = await savePractice(
      fixture.database,
      fixture.git,
      fixture.ownerId,
      {
        ...input,
        clientSessionId: "scaled",
        conditions: { ...conditions, tempoScale: 2 },
        eventBatches: eventBatch(0),
      },
    );
    const history = await listPractice(fixture.database, fixture.ownerId, {});
    expect(
      history.items.find((item) => item.id === empty.sessionId)?.summary
        .meanAbsTimingUs,
    ).toBeNull();
    for (const id of [empty.sessionId, late.sessionId, tied.sessionId])
      expect(history.items.find((item) => item.id === id)?.isBest).toBe(false);
    expect(
      history.items.find((item) => item.id === perfect.sessionId)?.isBest,
    ).toBe(true);
    expect(
      history.items.find((item) => item.id === changed.sessionId)?.isBest,
    ).toBe(true);
    expect(
      history.items.find((item) => item.id === changed.sessionId)
        ?.comparisonKey,
    ).not.toBe(
      history.items.find((item) => item.id === perfect.sessionId)
        ?.comparisonKey,
    );
    await deletePractice(fixture.database, fixture.ownerId, {
      sessionId: perfect.sessionId,
      key: "remove-best",
    });
    const remainingHistory = await listPractice(
      fixture.database,
      fixture.ownerId,
      {},
    );
    expect(
      remainingHistory.items.find((item) => item.id === tied.sessionId)?.isBest,
    ).toBe(true);
    await expect(
      deletePractice(fixture.database, fixture.ownerId, {
        sessionId: tied.sessionId,
        key: "remove-best",
      }),
    ).rejects.toThrow("CONFLICT");
  }));
