import { sheetScoreSchema } from "../import/score-schema";
import type { ValidationReply } from "./validate-sheet-score";
globalThis.addEventListener("message", (event: MessageEvent<unknown>) => {
  const result = sheetScoreSchema.safeParse(event.data);
  const reply: ValidationReply = result.success
    ? { ok: true, data: result.data }
    : { ok: false };
  globalThis.postMessage(reply);
});
