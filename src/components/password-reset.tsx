"use client";
import { Button, Input } from "@heroui/react";
import { AuthPanel } from "./auth-panel";
import { AuthFeedback } from "./auth-feedback";
import { useState, type FormEvent } from "react";
import { emailSchema } from "@/server/authentication/input";
import { useAuthSubmission } from "./use-auth-submission";
export function PasswordReset() {
  const [attempted, setAttempted] = useState(false);
  const [email, setEmail] = useState("");
  const { submit, pending, message, setMessage } = useAuthSubmission();
  async function request(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAttempted(true);
    if (!emailSchema.safeParse(email).success) {
      setMessage("メールアドレスを確認してください。");
      return;
    }
    await submit("requestPasswordReset", { email });
  }
  return (
    <AuthPanel title="パスワードを再設定">
      <form className="flex min-w-0 flex-col gap-6" onSubmit={request}>
        <Input
          label="メールアドレス"
          aria-label="メールアドレス"
          labelPlacement="outside"
          isInvalid={attempted && !emailSchema.safeParse(email).success}
          errorMessage="メールアドレスを確認してください。"
          type="email"
          autoComplete="email"
          isRequired
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Button
          type="submit"
          color="primary"
          isDisabled={pending}
          isLoading={pending}
        >
          {pending ? "送信中…" : "再設定メールを送信"}
        </Button>
      </form>
      <AuthFeedback message={message} />
    </AuthPanel>
  );
}
