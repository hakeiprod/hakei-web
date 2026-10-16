"use client";
import Link from "next/link";
import { getSession } from "next-auth/react";
import { useState, type FormEvent } from "react";
import { passwordSchema } from "@/server/authentication/input";
import { useAuthSubmission } from "./use-auth-submission";
export function PasswordChange() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [complete, setComplete] = useState(false);
  const { submit, pending, message, setMessage } = useAuthSubmission();
  async function change(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !passwordSchema.safeParse(currentPassword).success ||
      !passwordSchema.safeParse(newPassword).success
    ) {
      setMessage("パスワードは15〜128文字で入力してください。");
      return;
    }
    if (await submit("changePassword", { currentPassword, newPassword })) {
      setCurrentPassword("");
      setNewPassword("");
      setComplete(true);
      getSession().catch(() => {});
    }
  }
  return (
    <section>
      <h1>パスワードを変更</h1>
      {complete ? (
        <Link href="/api/auth/signin">ログインする</Link>
      ) : (
        <form onSubmit={change}>
          <label>
            現在のパスワード
            <input
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </label>
          <label>
            新しいパスワード
            <input
              type="password"
              autoComplete="new-password"
              required
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </label>
          <p>変更すると、すべての端末で再ログインが必要になります。</p>
          <button type="submit" disabled={pending}>
            {pending ? "変更中…" : "パスワードを変更"}
          </button>
        </form>
      )}
      <p role="status">{message}</p>
    </section>
  );
}
