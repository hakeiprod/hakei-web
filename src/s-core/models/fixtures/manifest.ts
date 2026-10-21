import { z } from "zod";

export const stageSchema = z.enum([
  "import",
  "roundtrip",
  "persisted",
  "document",
  "svg",
  "visual",
]);
export const statusSchema = z.enum([
  "pending",
  "pass",
  "fail",
  "error",
  "skipped",
]);
const stableId = z.string().min(1).max(200);
const sourceIdentity = z
  .object({
    trackId: z.int().nonnegative().optional(),
    noteId: z.int().nonnegative().optional(),
    staveId: z.int().nonnegative().optional(),
    barId: z.int().nonnegative().optional(),
  })
  .strict();
export const selectorSchema = z
  .object({
    direction: z.enum(["up", "down"]).optional(),
    tabValue: z.string().max(2).optional(),
    string: z.int().min(1).max(6).optional(),
    fret: z.int().min(0).max(36).optional(),
    anchorRole: stableId.optional(),
    role: stableId.optional(),
    glyphName: stableId.optional(),
    source: sourceIdentity.optional(),
    relationId: stableId.optional(),
    part: z.enum(["complete", "outgoing", "incoming"]).optional(),
    startNote: sourceIdentity.optional(),
    endNote: sourceIdentity.optional(),
    path: z
      .string()
      .min(1)
      .max(500)
      .refine(
        (value) =>
          !value
            .split(".")
            .some((part) =>
              ["__proto__", "prototype", "constructor"].includes(part),
            ),
      )
      .optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Empty selector");
export const layoutSchema = z
  .object({
    type: z.enum(["Horizontal", "Vertical", "Page"]),
    scale: z.number().positive().finite(),
    viewportWidth: z.number().positive().finite().optional(),
    viewportHeight: z.number().positive().finite().optional(),
    pageLayout: z
      .object({
        width: z.number().positive().finite(),
        height: z.number().positive().finite(),
        margin: z.number().nonnegative().finite(),
      })
      .strict()
      .refine(
        (p) => p.margin * 2 < Math.min(p.width, p.height),
        "Margins exceed page",
      )
      .optional(),
  })
  .strict();
export const assertionSchema = z
  .object({
    id: stableId,
    stage: stageSchema,
    kind: z.enum([
      "count",
      "absent",
      "value",
      "relativePosition",
      "tieEndpoints",
      "bounds",
      "staffGap",
    ]),
    selector: selectorSchema,
    expected: z.json(),
  })
  .strict();
export const fixtureSchema = z
  .object({
    id: stableId,
    title: stableId,
    target: z.string().min(1).max(2000),
    requirementRefs: z.array(stableId).min(1),
    source: z
      .object({
        path: z
          .string()
          .min(1)
          .max(500)
          .refine(
            (path) =>
              !path.startsWith("/") &&
              !path.includes("\\") &&
              !path.split("/").some((part) => part === ".." || part === ""),
            "Path must stay within fixtures",
          ),
        format: z.enum(["CORE_JSON", "SHEET_JSON", "MUSICXML", "MXL"]),
        provenance: z.string().min(1).max(2000),
      })
      .strict(),
    expectedOutcome: z.enum(["render", "reject", "partial"]),
    rejectionStage: z.enum(["import", "persisted"]).optional(),
    requiredStages: z
      .array(stageSchema)
      .min(1)
      .refine(
        (items) => new Set(items).size === items.length,
        "Duplicate stage",
      ),
    layout: layoutSchema.optional(),
    sizeReason: z.string().min(1).max(2000).optional(),
    assertions: z.array(assertionSchema).min(1).max(500),
    visualChecklist: z
      .array(
        z
          .object({ id: stableId, expected: z.string().min(1).max(2000) })
          .strict(),
      )
      .max(100),
  })
  .strict()
  .superRefine((fixture, context) => {
    const problem = (message: string) =>
      context.addIssue({ code: "custom", message });
    const ids = [...fixture.assertions, ...fixture.visualChecklist].map(
      (a) => a.id,
    );
    if (new Set(ids).size !== ids.length) problem("Duplicate assertion id");
    if (fixture.expectedOutcome === "render") {
      if (!fixture.layout) problem("Render fixture needs layout");
      if (fixture.rejectionStage)
        problem("Render fixture cannot declare rejection stage");
      if (
        !["document", "svg"].every((stage) =>
          fixture.requiredStages.includes(stage as Stage),
        )
      )
        problem("Render fixture needs document and svg stages");
    } else if (fixture.expectedOutcome === "partial") {
      if (
        fixture.rejectionStage ||
        fixture.requiredStages.some((s) =>
          ["document", "svg", "visual"].includes(s),
        ) ||
        !["import", "roundtrip", "persisted"].every((s) =>
          fixture.requiredStages.includes(s as Stage),
        )
      )
        problem("Partial fixture needs import, roundtrip and persisted only");
    } else {
      if (
        !fixture.rejectionStage ||
        !fixture.requiredStages.includes(fixture.rejectionStage)
      )
        problem("Reject fixture needs its rejection stage");
      if (
        fixture.requiredStages.some((stage) =>
          ["document", "svg", "visual"].includes(stage),
        )
      )
        problem("Reject fixture cannot require rendering");
    }
    for (const stage of fixture.requiredStages) {
      if (
        stage === "visual"
          ? fixture.visualChecklist.length === 0
          : !fixture.assertions.some((a) => a.stage === stage)
      )
        problem(`Missing assertions for ${stage}`);
    }
    if (
      fixture.assertions.some((a) => !fixture.requiredStages.includes(a.stage))
    )
      problem("Assertion outside required stages");
  });
export const fixtureManifestSchema = z
  .object({ version: z.literal(1), fixtures: z.array(fixtureSchema).max(2000) })
  .strict()
  .superRefine((manifest, context) => {
    const ids = manifest.fixtures.map((fixture) => fixture.id);
    if (new Set(ids).size !== ids.length)
      context.addIssue({ code: "custom", message: "Duplicate fixture id" });
  });
export const resultSchema = z
  .object({
    fixtureId: stableId,
    assertionId: stableId,
    stage: stageSchema,
    status: statusSchema,
    expected: z.json(),
    actual: z.json(),
    message: z.string().max(4000),
  })
  .strict();
const digest = z.string().regex(/^[a-f\d]{64}$/);
export const runSchema = z
  .object({
    runId: stableId,
    fixtureId: stableId,
    sourceHash: digest,
    expectationHash: digest,
    layout: layoutSchema.nullable(),
    rendererRevision: digest,
    executedAt: z.iso.datetime(),
    browser: stableId.optional(),
    reviewer: stableId.optional(),
    results: z.array(resultSchema).max(1000),
  })
  .strict()
  .superRefine((run, context) => {
    if (run.results.some((result) => result.fixtureId !== run.fixtureId))
      context.addIssue({ code: "custom", message: "Result fixture mismatch" });
    if (
      new Set(run.results.map((r) => `${r.stage}:${r.assertionId}`)).size !==
      run.results.length
    )
      context.addIssue({ code: "custom", message: "Duplicate result" });
    if (
      run.results.some(
        (result) =>
          result.stage === "visual" &&
          !["pending", "skipped"].includes(result.status),
      ) &&
      (!run.browser || !run.reviewer)
    )
      context.addIssue({
        code: "custom",
        message: "Visual result needs browser and reviewer",
      });
  });
export const reportSchema = z
  .object({ version: z.literal(1), runs: z.array(runSchema) })
  .strict();
export type Stage = z.infer<typeof stageSchema>;
export type Status = z.infer<typeof statusSchema>;
export type FixtureDefinition = z.infer<typeof fixtureSchema>;
export type Assertion = z.infer<typeof assertionSchema>;
export type Selector = z.infer<typeof selectorSchema>;
export type Result = z.infer<typeof resultSchema>;
export type VerificationRun = z.infer<typeof runSchema>;
