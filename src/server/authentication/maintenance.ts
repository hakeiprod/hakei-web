import "server-only";
import { configuredWriteLease } from "../maintenance-gate";
import {
  authenticationContext,
  withAuthenticationContext,
} from "./request-context";

export function authenticationRequest(
  request: Request,
  handler: () => Promise<Response>,
) {
  return withAuthenticationContext(async () => {
    const operation = new URL(request.url).pathname
      .split("/")
      .filter(Boolean)[2];
    const writes =
      request.method === "POST" || ["signin", "callback"].includes(operation);
    try {
      const response = await (writes
        ? configuredWriteLease(handler)
        : handler());
      if (authenticationContext()?.databaseUnavailable)
        return Response.json({ error: "TEMPORARY_FAILURE" }, { status: 503 });
      return response;
    } catch (error) {
      const code =
        error instanceof Error && error.message === "MAINTENANCE"
          ? "MAINTENANCE"
          : "TEMPORARY_FAILURE";
      return Response.json({ error: code }, { status: 503 });
    }
  });
}
