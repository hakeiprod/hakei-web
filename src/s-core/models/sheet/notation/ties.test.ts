import { expect, test } from "vitest";
import { resolveTies } from "./ties";
const lead = {
  id: 0,
  trackId: 0,
  staveId: 0,
  voice: 1,
  pitch: 60,
  start: 0,
  duration: 1,
  rest: false,
  ties: ["start"] as ("start" | "stop")[],
};
const end = {
  ...lead,
  id: 1,
  start: 1,
  ties: ["stop"] as ("start" | "stop")[],
};
test("resolves chains with stable endpoints but never other voices, staves or parts", () => {
  expect(resolveTies([lead, end]).relations).toHaveLength(1);
  for (const isolation of [{ voice: 2 }, { staveId: 1 }, { trackId: 1 }])
    expect(
      resolveTies([lead, { ...end, ...isolation }]).relations,
    ).toHaveLength(0);
  expect(
    resolveTies([
      lead,
      { ...end, ties: ["stop", "start"] },
      { ...end, id: 2, start: 2 },
    ]).relations,
  ).toHaveLength(2);
});
test("keeps visual-only meaning distinct and detects ambiguity", () => {
  expect(
    resolveTies([
      { ...lead, ties: [], visualTies: [{ type: "start" }] },
      { ...end, ties: [], visualTies: [{ type: "stop" }] },
    ]).relations[0].origin,
  ).toBe("visual");
  expect(
    resolveTies([
      { ...lead, visualTies: [] },
      { ...end, visualTies: [] },
    ]).relations,
  ).toHaveLength(0);
  const ambiguous = resolveTies([lead, { ...lead, id: 3 }, end]);
  expect(ambiguous.relations).toHaveLength(0);
  expect(ambiguous.problems.length).toBeGreaterThan(0);
});
