"use client";
import { useSession } from "next-auth/react";
import type { ReactNode } from "react";
export function AuthenticatedContent(properties: {
  actorId: string;
  children: ReactNode;
}) {
  const { data, status } = useSession();
  if (status === "loading")
    return (
      <p
        className="rounded-large border border-divider bg-content1 p-4 text-default-600"
        role="status"
      >
        認証状態を確認しています。
      </p>
    );
  if (status !== "authenticated" || data?.user?.id !== properties.actorId)
    return (
      <p className="rounded-large border border-warning-200 bg-warning-50 p-4 text-foreground">
        ログイン状態が変わりました。ログインしてページを開き直してください。
      </p>
    );
  return properties.children;
}
