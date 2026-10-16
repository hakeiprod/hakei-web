import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { PrismaClient } from "../../generated/prisma/client";
import type { ActionResult } from "../action-result";
import { configuredWriteLease } from "../maintenance-gate";
import { authenticationConfig } from "./config";
import { requestPasswordReset, resetPassword } from "./password-recovery";
import { beginGithubReauth } from "./github-reauth";
import {
  requestPasswordAddition,
  confirmPasswordAddition,
} from "./password-addition";
import { changePassword } from "./password-change";
import { domainBody } from "./http";
import { requestSource } from "./rate-limit";
import {
  requestRegistration,
  resendConfirmation,
  confirmRegistration,
} from "./registration";

const messages: Record<string, string> = {
  REAUTHENTICATION_REQUIRED: "GitHubで本人確認をやり直してください。",
  EMAIL_REQUIRED: "確認できるメールアドレスがありません。",
  PASSWORD_ALREADY_SET: "パスワードは既に登録されています。",
  UNAUTHENTICATED: "再ログインしてください。",
  INVALID_CREDENTIALS: "現在のパスワードを確認してください。",
  VALIDATION_FAILED: "入力内容を確認してください。",
  INVALID_CHALLENGE:
    "確認リンクを利用できません。メールを開き直すか、確認メールを再要求してください。",
  RETRY_LATER: "利用制限中です。時間をおいて再試行してください。",
  MAINTENANCE: "現在メンテナンス中です。時間をおいて再試行してください。",
  AUTH_METHOD_UNAVAILABLE: "現在この認証方式を利用できません。",
  FORBIDDEN: "この要求を受け付けられません。",
  NOT_FOUND: "対象の操作が見つかりません。",
  LIMIT_EXCEEDED: "入力が利用できる上限を超えています。",
  TEMPORARY_FAILURE: "処理できませんでした。時間をおいて再試行してください。",
};
export async function authenticationOperation(
  database: PrismaClient,
  environment: Readonly<Record<string, string | undefined>>,
  operation: string,
  request: Request,
): Promise<ActionResult<{ code: string; message: string }>> {
  const requestId = randomUUID();
  try {
    if (
      ![
        "requestRegistration",
        "resendConfirmation",
        "confirmRegistration",
        "requestPasswordReset",
        "resetPassword",
        "changePassword",
        "beginGithubReauth",
        "requestPasswordAddition",
        "confirmPasswordAddition",
      ].includes(operation)
    )
      throw new Error("NOT_FOUND");
    const config = authenticationConfig(environment);
    if (!config.enabled) throw new Error("AUTH_METHOD_UNAVAILABLE");
    const input = await domainBody(
      request,
      config.publicOrigin,
      operation,
      environment,
    );
    const data = await configuredWriteLease<{ code: string; message: string }>(
      async () => {
        const source = requestSource(request.headers, config.trustedProxy);
        if (operation === "requestRegistration")
          return requestRegistration(database, config, input, source);
        if (operation === "resendConfirmation")
          return resendConfirmation(database, config, input, source);
        if (operation === "requestPasswordReset")
          return requestPasswordReset(database, config, input, source);
        if (operation === "resetPassword")
          return resetPassword(database, input, requestId);
        if (
          [
            "changePassword",
            "beginGithubReauth",
            "requestPasswordAddition",
            "confirmPasswordAddition",
          ].includes(operation)
        ) {
          const { currentActor } = await import("../auth");
          const actor = await currentActor();
          if (!actor) throw new Error("UNAUTHENTICATED");
          const verified = {
            sub: actor.id,
            sid: actor.sid,
            authVersion: actor.authVersion,
          };
          if (
            operation === "beginGithubReauth" ||
            operation === "requestPasswordAddition"
          )
            z.strictObject({}).parse(input);
          if (operation === "beginGithubReauth")
            return beginGithubReauth(database, verified, environment);
          if (operation === "requestPasswordAddition")
            return requestPasswordAddition(
              database,
              config,
              verified,
              environment,
              source,
            );
          if (operation === "confirmPasswordAddition")
            return confirmPasswordAddition(
              database,
              verified,
              input,
              environment,
              requestId,
            );
          return changePassword(
            database,
            { sub: actor.id, sid: actor.sid, authVersion: actor.authVersion },
            input,
            requestId,
            config,
            source,
          );
        }
        return confirmRegistration(database, input);
      },
    );
    return { ok: true, data, requestId };
  } catch (error) {
    const code =
      error instanceof z.ZodError
        ? "VALIDATION_FAILED"
        : error instanceof Error && messages[error.message]
          ? error.message
          : "TEMPORARY_FAILURE";
    if (code === "TEMPORARY_FAILURE")
      console.error({ event: "authentication-operation-failed", requestId });
    return {
      ok: false,
      error: {
        code,
        message: messages[code],
        retryable: ["TEMPORARY_FAILURE", "RETRY_LATER", "MAINTENANCE"].includes(
          code,
        ),
      },
      requestId,
    };
  }
}
