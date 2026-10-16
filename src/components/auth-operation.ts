import { z } from "zod";
const resultSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    requestId: z.string(),
    data: z.object({ code: z.string(), message: z.string() }),
  }),
  z.object({
    ok: z.literal(false),
    requestId: z.string(),
    error: z.object({
      code: z.string(),
      message: z.string(),
      retryable: z.boolean(),
    }),
  }),
]);
export async function authOperation(
  operation:
    | "requestRegistration"
    | "resendConfirmation"
    | "confirmRegistration"
    | "requestPasswordReset"
    | "resetPassword"
    | "changePassword"
    | "beginGithubReauth"
    | "requestPasswordAddition"
    | "confirmPasswordAddition",
  input: unknown,
  signal: AbortSignal,
) {
  const response = await fetch(`/api/account-auth/${operation}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    cache: "no-store",
    body: JSON.stringify(input),
    signal,
  });
  return resultSchema.parse(await response.json());
}
