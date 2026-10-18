"use client";
import { Button } from "@heroui/react";
import { AuthPanel } from "./auth-panel";
import { AuthFeedback } from "./auth-feedback";
import { signIn } from "next-auth/react";
import { useAuthSubmission } from "./use-auth-submission";
export function PasswordAddition({
  githubAvailable,
  hasEmail = true,
}: {
  githubAvailable: boolean;
  hasEmail?: boolean;
}) {
  const { submit, pending, message, setMessage } = useAuthSubmission();
  if (!githubAvailable) return null;
  if (!hasEmail)
    return (
      <AuthPanel title="メールのパスワードを追加">
        <p>メールアドレスがないため、パスワードを追加できません。</p>
      </AuthPanel>
    );
  async function reauthenticate() {
    if (!(await submit("beginGithubReauth", {}))) return;
    try {
      await signIn("github", { redirectTo: "/account/security" });
    } catch {
      setMessage(
        "GitHubで本人確認を開始できませんでした。時間をおいて再試行してください。",
      );
    }
  }
  return (
    <AuthPanel title="メールのパスワードを追加">
      <p>
        GitHubで本人確認した後、確認メールを送信してください。15分以内に同じブラウザーでメールのリンクを開き、パスワードを確定します。
      </p>
      <Button
        variant="flat"
        type="button"
        isDisabled={pending}
        isLoading={pending}
        onClick={reauthenticate}
      >
        GitHubで本人確認
      </Button>
      <Button
        color="primary"
        type="button"
        isDisabled={pending}
        isLoading={pending}
        onClick={() => submit("requestPasswordAddition", {})}
      >
        確認メールを送信
      </Button>
      <AuthFeedback message={message} />
    </AuthPanel>
  );
}
