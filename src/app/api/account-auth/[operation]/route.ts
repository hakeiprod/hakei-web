import { prisma } from "@/prisma";
import { authenticationOperation } from "@/server/authentication/operations";

export async function POST(
  request: Request,
  context: { params: Promise<{ operation: string }> },
) {
  const { operation } = await context.params;
  const result = await authenticationOperation(
    prisma,
    process.env,
    operation,
    request,
  );
  const statuses: Record<string, number> = {
    NOT_FOUND: 404,
    UNAUTHENTICATED: 401,
    REAUTHENTICATION_REQUIRED: 403,
    EMAIL_REQUIRED: 400,
    PASSWORD_ALREADY_SET: 409,
    INVALID_CREDENTIALS: 400,
    FORBIDDEN: 403,
    VALIDATION_FAILED: 400,
    INVALID_CHALLENGE: 400,
    LIMIT_EXCEEDED: 413,
    RETRY_LATER: 429,
  };
  return Response.json(result, {
    status: result.ok ? 200 : (statuses[result.error.code] ?? 503),
    headers: { "cache-control": "no-store", "referrer-policy": "no-referrer" },
  });
}
