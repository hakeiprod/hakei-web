import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { configuredWriteLease } from "./maintenance-gate";
import { withActorAuthorization } from "./authentication/authorize";
import { requireActor } from "./auth";
export type ActionResult<T> =
  | { ok: true; data: T; requestId: string }
  | {
      ok: false;
      error: { code: string; message: string; retryable: boolean };
      requestId: string;
    };
const messages: Record<string, string> = {
  MAINTENANCE:
    "現在メンテナンス中です。入力を保持して、しばらくしてから再試行してください。",
  PREVIEW_EXPIRED:
    "プレビューの期限が切れました。元ファイルから再変換してください。",
  INVALID_PREVIEW_TOKEN:
    "プレビューを検証できません。元ファイルから再変換してください。",
  WARNING_ACKNOWLEDGEMENT_REQUIRED: "変換の確認事項をすべて確認してください。",
  PLAYBACK_BLOCKED:
    "この版には未解決の問題があり、練習・ゲームに利用できません。",
  EMPTY_RANGE: "選択した範囲には評価する打鍵がありません。",
  UNAUTHENTICATED: "ログインしてください。",
  FORBIDDEN: "この操作を行う権限がありません。",
  NOT_FOUND: "対象が見つかりません。",
  VALIDATION_FAILED: "入力内容を確認してください。",
  CONFLICT:
    "内容または権限が更新されました。最新の内容を確認して再試行してください。",
  TRUST_UNCONFIGURED: "信頼度の基準がまだ設定されていません。",
  LIMIT_EXCEEDED: "入力が利用できる上限を超えています。",
  TEMPORARY_FAILURE:
    "処理できませんでした。しばらくしてから再試行してください。",
};
export async function runAction<T>(
  operation: (actor: Awaited<ReturnType<typeof requireActor>>) => Promise<T>,
): Promise<ActionResult<T>> {
  const requestId = randomUUID();
  try {
    return {
      ok: true,
      data: await configuredWriteLease(async () => {
        const actor = await requireActor();
        return withActorAuthorization(actor, () => operation(actor));
      }),
      requestId,
    };
  } catch (error) {
    let code = "TEMPORARY_FAILURE";
    if (error instanceof z.ZodError) code = "VALIDATION_FAILED";
    else if (error instanceof Error && messages[error.message])
      code = error.message;
    else if (
      error instanceof Error &&
      [
        "SELF_REVIEW_FORBIDDEN",
        "INVALID_TARGET_SCORE",
        "REASON_REQUIRED",
      ].includes(error.message)
    )
      code = "VALIDATION_FAILED";
    else if (
      error instanceof Error &&
      ["INSUFFICIENT_TRUST", "OWNER_ADMIN_REQUIRED"].includes(error.message)
    )
      code = "FORBIDDEN";
    else if (error instanceof Error && error.message === "IN_PROGRESS")
      code = "CONFLICT";
    else if (typeof error === "object" && error !== null && "code" in error) {
      if (error.code === "P2002" || error.code === "P2034") code = "CONFLICT";
      else if (error.code === "P2025") code = "NOT_FOUND";
    }
    if (code === "TEMPORARY_FAILURE")
      console.error({ requestId, event: "action-failed" });
    const message =
      error instanceof Error && error.message === "INSUFFICIENT_TRUST"
        ? "マージに必要な信頼度を満たしていません。"
        : messages[code];
    return {
      ok: false,
      error: {
        code,
        message,
        retryable:
          code === "MAINTENANCE" ||
          code === "TEMPORARY_FAILURE" ||
          code === "CONFLICT",
      },
      requestId,
    };
  }
}
