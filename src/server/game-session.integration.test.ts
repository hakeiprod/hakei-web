import { expect, it } from "vitest";
import { withCollaboration } from "./testing/collaboration";
import { initializeEvaluationRule } from "./evaluation-rule";
import { savePractice } from "./practice";
import { listPractice } from "./practice-history";
it("recalculates full/zero game scores, keeps retries identical and excludes interrupted results", async () =>
  withCollaboration(async (fixture) => {
    await initializeEvaluationRule(fixture.database);
    const conditions = {
      trackId: 0,
      rangeStartBar: 1,
      rangeEndBar: 1,
      tempoScale: 1,
      calibrationUs: 0,
      mode: "GAME",
      ruleVersion: 1,
    };
    const input = {
      clientSessionId: "game-full",
      scoreId: fixture.scoreId,
      scoreRevisionId: fixture.revisionId,
      conditions,
      status: "COMPLETED",
      endedUs: 2_060_000,
      eventBatches: [
        {
          batchIndex: 0,
          events: [
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
          ],
        },
      ],
    };
    const full = await savePractice(
      fixture.database,
      fixture.git,
      fixture.ownerId,
      input,
    );
    expect(full.evaluation.score).toBe(100);
    const persisted = await fixture.database.evaluationResult.findUniqueOrThrow(
      { where: { sessionId: full.sessionId } },
    );
    expect(persisted.summary).toEqual(full.evaluation.summary);
    expect(persisted.perNote).toEqual(full.evaluation.perNote);
    expect(persisted.perBar).toEqual(full.evaluation.perBar);
    for (let index = 0; index < 3; index++)
      expect(
        await savePractice(
          fixture.database,
          fixture.git,
          fixture.ownerId,
          input,
        ),
      ).toEqual(full);
    const zero = await savePractice(
      fixture.database,
      fixture.git,
      fixture.ownerId,
      { ...input, clientSessionId: "game-zero", eventBatches: [] },
    );
    expect(zero.evaluation.score).toBe(0);
    const interrupted = await savePractice(
      fixture.database,
      fixture.git,
      fixture.ownerId,
      {
        ...input,
        clientSessionId: "game-interrupted",
        status: "INTERRUPTED",
        endedUs: 500_000,
      },
    );
    expect(interrupted.evaluation.score).toBeNull();
    const history = await listPractice(fixture.database, fixture.ownerId, {});
    expect(history.completedCount).toBe(2);
    expect(history.items.find((row) => row.id === full.sessionId)?.isBest).toBe(
      true,
    );
    expect(
      history.items.find((row) => row.id === interrupted.sessionId)?.isBest,
    ).toBe(false);
  }));
