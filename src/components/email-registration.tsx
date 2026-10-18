"use client";
import { Button, Input, Link } from "@heroui/react";
import { AuthPanel } from "./auth-panel";
import { AuthFeedback } from "./auth-feedback";
import NextLink from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import {
  credentialsSchema,
  emailSchema,
  passwordSchema,
} from "@/server/authentication/input";
import { authOperation } from "./auth-operation";

export function EmailRegistration({
  githubAvailable = false,
}: {
  githubAvailable?: boolean;
}) {
  const [emailAttempted, setEmailAttempted] = useState(false);
  const [passwordAttempted, setPasswordAttempted] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function submit(resend: boolean) {
    if (controller.current) return;
    setEmailAttempted(true);
    setPasswordAttempted(!resend);
    const parsed = resend
      ? emailSchema.safeParse(email)
      : credentialsSchema.safeParse({ email, password });
    if (!parsed.success) {
      setMessage("メールアドレスと15〜128文字のパスワードを確認してください。");
      return;
    }
    const active = new AbortController();
    controller.current = active;
    setPending(true);
    try {
      const result = await authOperation(
        resend ? "resendConfirmation" : "requestRegistration",
        resend ? { email } : { email, password },
        active.signal,
      );
      if (active.signal.aborted) return;
      setMessage(result.ok ? result.data.message : result.error.message);
      if (result.ok) {
        setSent(true);
        setEmailAttempted(false);
        setPasswordAttempted(false);
        setPassword("");
      }
    } catch {
      if (!active.signal.aborted)
        setMessage("送信できませんでした。時間をおいて再試行してください。");
    } finally {
      controller.current = null;
      if (!active.signal.aborted) setPending(false);
    }
  }
  function request(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit(false);
  }
  return (
    <AuthPanel title="メールアドレスで登録">
      <form className="flex min-w-0 flex-col gap-6" onSubmit={request}>
        <Input
          label="メールアドレス"
          aria-label="メールアドレス"
          labelPlacement="outside"
          isInvalid={emailAttempted && !emailSchema.safeParse(email).success}
          errorMessage="メールアドレスを確認してください。"
          type="email"
          autoComplete="email"
          isRequired
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Input
          label="パスワード"
          aria-label="パスワード"
          labelPlacement="outside"
          isInvalid={
            passwordAttempted && !passwordSchema.safeParse(password).success
          }
          errorMessage="パスワードは15〜128文字で入力してください。"
          description="15〜128文字で入力してください。"
          type="password"
          autoComplete="new-password"
          isRequired
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <p>
          15〜128文字で入力してください。確認メールを開いた後に、登録するパスワードを最終確定します。
        </p>
        <Button
          isDisabled={pending}
          isLoading={pending}
          type="submit"
          color="primary"
        >
          {pending ? "送信中…" : "確認メールを送信"}
        </Button>
      </form>
      <AuthFeedback message={message} />
      {sent && (
        <Button
          type="button"
          variant="flat"
          isDisabled={pending}
          isLoading={pending}
          onClick={() => submit(true)}
        >
          確認メールを再送
        </Button>
      )}
      <div className="flex flex-col items-start gap-3">
        <Link as={NextLink} href="/auth/reset">
          パスワードを忘れた場合
        </Link>
        <Link as={NextLink} href="/api/auth/signin">
          登録済みの方はログイン
        </Link>
      </div>
      {githubAvailable && (
        <Button
          type="button"
          variant="flat"
          isDisabled={pending}
          onClick={() => signIn("github")}
        >
          GitHubでログイン
        </Button>
      )}
    </AuthPanel>
  );
}
