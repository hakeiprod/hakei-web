import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
export function requireImportOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin)
    throw new Error("FORBIDDEN");
}
export async function readImportBody(
  request: Request,
  maximum: number,
  timeoutMs = 10_000,
) {
  const declared = request.headers.get("content-length");
  if (declared && Number(declared) > maximum) throw new Error("INPUT_LIMIT");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("INVALID_REQUEST");
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort: (() => void) | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error("IMPORT_TIMEOUT")), timeoutMs);
    abort = () => reject(new Error("IMPORT_ABORTED"));
    request.signal.addEventListener("abort", abort, { once: true });
  });
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      if (request.signal.aborted) throw new Error("IMPORT_ABORTED");
      const next = await Promise.race([reader.read(), deadline]);
      if (next.done) break;
      length += next.value.byteLength;
      if (length > maximum) throw new Error("INPUT_LIMIT");
      chunks.push(next.value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes;
  } finally {
    if (timer) clearTimeout(timer);
    if (abort) request.signal.removeEventListener("abort", abort);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
export function importHttpError(error: unknown) {
  let code = error instanceof Error ? error.message : "TEMPORARY_FAILURE";
  let status = 503;
  let message = "処理できませんでした。しばらくしてから再試行してください。";
  if (code === "UNAUTHENTICATED") {
    status = 401;
    message = "ログインしてください。";
  } else if (code === "FORBIDDEN") {
    status = 403;
    message = "この操作を行う権限がありません。";
  } else if (
    [
      "INPUT_LIMIT",
      "EXPANSION_LIMIT",
      "ENTRY_LIMIT",
      "NOTE_LIMIT",
      "SCORE_SPAN_LIMIT",
    ].includes(code)
  ) {
    status = 413;
    message =
      "楽譜が取り込み上限を超えています。楽譜を分割するか、ファイルを小さくして再試行してください。";
  } else
    switch (code) {
      case "MAINTENANCE": {
        status = 503;
        message =
          "現在メンテナンス中です。しばらくしてから再試行してください。";
        break;
      }
      case "UNSUPPORTED_MUSICXML_VERSION": {
        status = 415;
        message =
          "MusicXMLのバージョンを確認してください。対応版は2.0・3.0・3.1・4.0です。対応版で書き出してください。";
        break;
      }
      case "UNSUPPORTED_MUSICXML_STRUCTURE": {
        status = 415;
        message =
          "MusicXMLの文書構造に対応していません。score-partwise形式で書き出してください。";
        break;
      }
      case "UNSUPPORTED_FORMAT": {
        status = 415;
        message = "この楽譜形式には対応していません。";

        break;
      }
      case "IMPORT_BUSY": {
        status = 429;
        message = "変換処理中です。完了してから再試行してください。";

        break;
      }
      case "IMPORT_TIMEOUT": {
        status = 504;
        message =
          "変換が制限時間を超えました。楽譜のサイズや内容を見直して再試行してください。";

        break;
      }
      case "PREVIEW_EXPIRED": {
        status = 422;
        message =
          "プレビューの期限が切れました。元ファイルを再アップロードしてください。";

        break;
      }
      default: {
        if (
          error instanceof z.ZodError ||
          code.startsWith("INVALID_") ||
          ["FORMAT_MISMATCH", "XML_ENTITY_FORBIDDEN", "EMPTY_SCORE"].includes(
            code,
          )
        ) {
          status = 422;
          message = "楽譜または修正内容の形式を確認してください。";
          code = "VALIDATION_FAILED";
        } else if (code === "IMPORT_ABORTED") {
          status = 499;
          message = "取り込みを中止しました。";
        } else code = "TEMPORARY_FAILURE";
      }
    }
  return Response.json(
    { error: { code, message }, requestId: randomUUID() },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
