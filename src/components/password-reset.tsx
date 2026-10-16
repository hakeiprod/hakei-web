"use client";
import { useState, type FormEvent } from "react";
import { emailSchema } from "@/server/authentication/input";
import { useAuthSubmission } from "./use-auth-submission";
export function PasswordReset() {
  const [email, setEmail] = useState("");
  const { submit, pending, message, setMessage } = useAuthSubmission();
  async function request(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!emailSchema.safeParse(email).success) {
      setMessage("メールアドレスを確認してください。");
      return;
    }
    await submit("requestPasswordReset", { email });
  }
  return (
    <section>
      <h1>パスワードを再設定</h1>
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
        <button type="submit" disabled={pending}>
          {pending ? "送信中…" : "再設定メールを送信"}
        </button>
      </form>
      <p role="status">{message}</p>
    </section>
  );
}
