"use client";
import { Button, Input, Link } from "@heroui/react";
import { AuthPanel } from "./auth-panel";
import { AuthFeedback } from "./auth-feedback";
import NextLink from "next/link";
import { getSession } from "next-auth/react";
import { useState, type FormEvent } from "react";
import { passwordSchema } from "@/server/authentication/input";
import { useAuthSubmission } from "./use-auth-submission";
export function PasswordChange() {
  const [attempted, setAttempted] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [complete, setComplete] = useState(false);
  const { submit, pending, message, setMessage } = useAuthSubmission();
  async function change(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAttempted(true);
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
    <AuthPanel title="パスワードを変更">
      {complete ? (
        <Link as={NextLink} href="/api/auth/signin">
          ログインする
        </Link>
      ) : (
        <form className="flex min-w-0 flex-col gap-6" onSubmit={change}>
          <Input
            label="現在のパスワード"
            aria-label="現在のパスワード"
            labelPlacement="outside"
            isInvalid={
              attempted && !passwordSchema.safeParse(currentPassword).success
            }
            errorMessage="パスワードは15〜128文字で入力してください。"
            description="15〜128文字で入力してください。"
            type="password"
            autoComplete="current-password"
            isRequired
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
          <Input
            label="新しいパスワード"
            aria-label="新しいパスワード"
            labelPlacement="outside"
            isInvalid={
              attempted && !passwordSchema.safeParse(newPassword).success
            }
            errorMessage="パスワードは15〜128文字で入力してください。"
            description="15〜128文字で入力してください。"
            type="password"
            autoComplete="new-password"
            isRequired
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
          <p>変更すると、すべての端末で再ログインが必要になります。</p>
          <Button
            type="submit"
            color="primary"
            isDisabled={pending}
            isLoading={pending}
          >
            {pending ? "変更中…" : "パスワードを変更"}
          </Button>
        </form>
      )}
      <AuthFeedback message={message} />
    </AuthPanel>
  );
}
