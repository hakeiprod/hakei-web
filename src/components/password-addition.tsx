"use client";
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
    return <p>メールアドレスがないため、パスワードを追加できません。</p>;
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
    <section>
      <h1>メールのパスワードを追加</h1>
      <p>
        GitHubで本人確認した後、確認メールを送信してください。15分以内に同じブラウザーでメールのリンクを開き、パスワードを確定します。
      </p>
      <button type="button" disabled={pending} onClick={reauthenticate}>
        GitHubで本人確認
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => submit("requestPasswordAddition", {})}
      >
        確認メールを送信
      </button>
      <p role="status">{message}</p>
    </section>
  );
}
