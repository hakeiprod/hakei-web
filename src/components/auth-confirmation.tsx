"use client";
import { Button, Input, Link } from "@heroui/react";
import { AuthPanel } from "./auth-panel";
import { AuthFeedback } from "./auth-feedback";
import NextLink from "next/link";
import { getSession } from "next-auth/react";
import { ConfirmationLink } from "./confirmation-link";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import { passwordSchema } from "@/server/authentication/input";
import { authOperation } from "./auth-operation";

export function AuthConfirmation() {
  const [source] = useState(() => new ConfirmationLink());
  const link = useSyncExternalStore(
    source.subscribe,
    source.snapshot,
    source.serverSnapshot,
  );
  const token = link?.token ?? null;
  const [attempted, setAttempted] = useState(false);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [complete, setComplete] = useState(false);
  const [pending, setPending] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || controller.current) return;
    setAttempted(true);
    if (!passwordSchema.safeParse(password).success) {
      setMessage("パスワードは15〜128文字で入力してください。");
      return;
    }
    const active = new AbortController();
    controller.current = active;
    setPending(true);
    try {
      const result = await authOperation(
        link?.purpose === "ADD_PASSWORD"
          ? "confirmPasswordAddition"
          : link?.purpose === "RESET"
            ? "resetPassword"
            : "confirmRegistration",
        { token, newPassword: password },
        active.signal,
      );
      if (active.signal.aborted) return;
      setMessage(result.ok ? result.data.message : result.error.message);
      if (result.ok) {
        setComplete(true);
        source.clear();
        setPassword("");
        if (link?.purpose === "ADD_PASSWORD") getSession().catch(() => {});
      }
    } catch {
      if (!active.signal.aborted)
        setMessage("確認できませんでした。時間をおいて再試行してください。");
    } finally {
      controller.current = null;
      if (!active.signal.aborted) setPending(false);
    }
  }
  return (
    <AuthPanel title="メールの本人確認">
      {token && !complete && (
        <form className="flex min-w-0 flex-col gap-6" onSubmit={submit}>
          <Input
            label={
              link?.purpose === "VERIFY"
                ? "登録するパスワード"
                : "新しいパスワード"
            }
            aria-label={
              link?.purpose === "VERIFY"
                ? "登録するパスワード"
                : "新しいパスワード"
            }
            labelPlacement="outside"
            type="password"
            autoComplete="new-password"
            isRequired
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            description="15〜128文字で入力してください。"
            isInvalid={attempted && !passwordSchema.safeParse(password).success}
            errorMessage="パスワードは15〜128文字で入力してください。"
          />

          <Button
            isDisabled={pending}
            isLoading={pending}
            type="submit"
            color="primary"
          >
            {pending
              ? "確認中…"
              : link?.purpose === "RESET"
                ? "再設定を確定"
                : link?.purpose === "ADD_PASSWORD"
                  ? "追加を確定"
                  : "登録を確定"}
          </Button>
        </form>
      )}
      <AuthFeedback
        message={
          message ||
          (link && !token && !complete
            ? "確認リンクを利用できません。メールを開き直すか、確認メールを再要求してください。"
            : "")
        }
      />
      {complete ? (
        <Link as={NextLink} href="/api/auth/signin">
          ログインする
        </Link>
      ) : (
        <Link
          as={NextLink}
          href={
            link?.purpose === "ADD_PASSWORD"
              ? "/account/security"
              : link?.purpose === "RESET"
                ? "/auth/reset"
                : "/auth/register"
          }
        >
          確認メールを再要求する
        </Link>
      )}
    </AuthPanel>
  );
}
