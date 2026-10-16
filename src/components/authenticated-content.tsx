"use client";
import { useAuthenticationVisibility } from "./authentication-visibility";
import { useSession } from "next-auth/react";
import type { ReactNode } from "react";
export function AuthenticatedContent(properties: {
  actorId: string;
  children: ReactNode;
}) {
  const { data, status } = useSession();
  const visible = useAuthenticationVisibility();
  if (status === "loading" || visible === false)
    return <p role="status">認証状態を確認しています。</p>;
  if (status !== "authenticated" || data?.user?.id !== properties.actorId)
    return (
      <p>
        ログイン状態が変わりました。ログインしてページを開き直してください。
      </p>
    );
  return properties.children;
}
