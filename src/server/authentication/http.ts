import "server-only";
import { providerAvailability } from "./providers";

const maximumBodyBytes = 16 * 1024;
const operations = new Set([
  "requestRegistration",
  "resendConfirmation",
  "confirmRegistration",
  "requestPasswordReset",
  "resetPassword",
  "changePassword",
  "beginGithubReauth",
  "requestPasswordAddition",
  "confirmPasswordAddition",
]);

export async function boundedBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array(0);
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.byteLength;
      if (length > maximumBodyBytes) {
        reader.cancel().catch(() => {});
        throw new Error("LIMIT_EXCEEDED");
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function domainBody(
  request: Request,
  publicOrigin: string,
  operation: string,
  environment: Readonly<Record<string, string | undefined>> = process.env,
): Promise<unknown> {
  if (!operations.has(operation)) throw new Error("NOT_FOUND");
  if (
    request.method !== "POST" ||
    request.headers.get("origin") !== publicOrigin
  )
    throw new Error("FORBIDDEN");
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  )
    throw new Error("VALIDATION_FAILED");
  if (
    [
      "beginGithubReauth",
      "requestPasswordAddition",
      "confirmPasswordAddition",
    ].includes(operation) &&
    !providerAvailability(environment).github
  )
    throw new Error("AUTH_METHOD_UNAVAILABLE");
  const bytes = await boundedBody(request);
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new Error("VALIDATION_FAILED");
  }
}

export async function guardAuthRequest(
  request: Request,
  handler: (request: Request) => Promise<Response>,
  github: boolean,
) {
  let segments: string[];
  try {
    segments = new URL(request.url).pathname
      .split("/")
      .filter(Boolean)
      .map((part) => decodeURIComponent(part));
  } catch {
    return new Response("利用できません", { status: 404 });
  }
  const [operation, provider] = segments.slice(2);
  if (
    !github &&
    provider === "github" &&
    ["signin", "callback"].includes(operation)
  )
    return new Response("利用できません", { status: 404 });
  if (request.method === "POST" && provider === "credentials") {
    let bytes: Uint8Array<ArrayBuffer>;
    try {
      bytes = await boundedBody(request);
    } catch {
      return new Response("入力を処理できません", { status: 413 });
    }
    const headers = new Headers(request.headers);
    headers.delete("content-length");
    return handler(
      new Request(request.url, {
        method: request.method,
        headers,
        body: bytes.buffer,
        signal: request.signal,
      }),
    );
  }
  return handler(request);
}
