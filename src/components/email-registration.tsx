"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { credentialsSchema, emailSchema } from "@/server/authentication/input";
import { authOperation } from "./auth-operation";

export function EmailRegistration({
  githubAvailable = false,
}: {
  githubAvailable?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function submit(resend: boolean) {
    if (controller.current) return;
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
    <section>
      <h1>メールアドレスで登録</h1>
      <form onSubmit={request}>
        <label>
          メールアドレス
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          パスワード
          <input
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <p>
          15〜128文字で入力してください。確認メールを開いた後に、登録するパスワードを最終確定します。
        </p>
        <button disabled={pending} type="submit">
          {pending ? "送信中…" : "確認メールを送信"}
        </button>
      </form>
      {message && <p role="status">{message}</p>}
      {sent && (
        <button disabled={pending} onClick={() => submit(true)}>
          確認メールを再送
        </button>
      )}
      <p>
        <Link href="/auth/reset">パスワードを忘れた場合</Link>
        <Link href="/api/auth/signin">登録済みの方はログイン</Link>
      </p>
      {githubAvailable && (
        <button onClick={() => signIn("github")}>GitHubでログイン</button>
      )}
    </section>
  );
}
