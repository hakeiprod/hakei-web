"use client";
import Link from "next/link";
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
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [complete, setComplete] = useState(false);
  const [pending, setPending] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || controller.current) return;
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
    <section>
      <h1>メールの本人確認</h1>
      {token && !complete && (
        <form onSubmit={submit}>
          <label>
            {link?.purpose === "VERIFY"
              ? "登録するパスワード"
              : "新しいパスワード"}
            <input
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <p>15〜128文字で入力してください。</p>
          <button disabled={pending} type="submit">
            {pending
              ? "確認中…"
              : link?.purpose === "RESET"
                ? "再設定を確定"
                : link?.purpose === "ADD_PASSWORD"
                  ? "追加を確定"
                  : "登録を確定"}
          </button>
        </form>
      )}
      {(message || (link && !token && !complete)) && (
        <p role="status">
          {message ||
            "確認リンクを利用できません。メールを開き直すか、確認メールを再要求してください。"}
        </p>
      )}
      {complete ? (
        <Link href="/api/auth/signin">ログインする</Link>
      ) : (
        <Link
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
    </section>
  );
}
