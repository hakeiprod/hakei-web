import { configuredWriteLease } from "@/server/maintenance-gate";
import { requireActor } from "@/server/auth";
import { revalidateImport } from "@/server/import-revalidate";
import {
  importHttpError,
  readImportBody,
  requireImportOrigin,
} from "@/server/import-http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    return await configuredWriteLease(() => handlePost(request));
  } catch (error) {
    return importHttpError(error);
  }
}
async function handlePost(request: Request) {
  try {
    const actor = await requireActor();
    requireImportOrigin(request);
    const bytes = await readImportBody(request, 25 * 1024 * 1024);
    let input: unknown;
    try {
      input = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      );
    } catch {
      throw new Error("INVALID_REQUEST");
    }
    return Response.json(revalidateImport(actor.id, input), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return importHttpError(error);
  }
}
