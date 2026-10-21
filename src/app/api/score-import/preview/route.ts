import { configuredWriteLease } from "@/server/maintenance-gate";
import { z } from "zod";
import { prisma } from "@/prisma";
import { requireActor } from "@/server/auth";
import { processImportRequest } from "@/server/import-worker";
import { signPreview } from "@/server/import-preview-token";
import {
  importHttpError,
  readImportBody,
  requireImportOrigin,
} from "@/server/import-http";
import { midiConversionOptionsSchema } from "@/s-core/models/import/quantize-midi";
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
    const result = await processImportRequest(
      prisma,
      actor.id,
      async (convert) => {
        const contentType = request.headers.get("content-type") ?? "";
        if (!contentType.toLowerCase().startsWith("multipart/form-data;"))
          throw new Error("INVALID_REQUEST");
        const bytes = await readImportBody(request, 6 * 1024 * 1024);
        let form: FormData;
        try {
          form = await new Response(bytes, {
            headers: { "Content-Type": contentType },
          }).formData();
        } catch {
          throw new Error("INVALID_REQUEST");
        }
        if (
          [...form.keys()].some((key) => key !== "file" && key !== "options") ||
          form.getAll("file").length !== 1 ||
          form.getAll("options").length > 1
        )
          throw new Error("INVALID_REQUEST");
        const file = form.get("file"),
          rawOptions = form.get("options");
        if (!(file instanceof File) || typeof rawOptions !== "string")
          throw new Error("INVALID_REQUEST");
        z.string().min(1).max(255).parse(file.name);
        z.string().max(200).parse(file.type);
        if (file.size > 5 * 1024 * 1024) throw new Error("INPUT_LIMIT");
        let parsedOptions: unknown;
        try {
          parsedOptions = JSON.parse(rawOptions);
        } catch {
          throw new Error("INVALID_REQUEST");
        }
        const options = midiConversionOptionsSchema.parse(parsedOptions);
        return await convert({
          bytes: new Uint8Array(await file.arrayBuffer()),
          sourceName: file.name,
          mime: file.type,
          options,
        });
      },
      request.signal,
    );
    return Response.json(
      { ...result, previewToken: signPreview(actor.id, result) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return importHttpError(error);
  }
}
