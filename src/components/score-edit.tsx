"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { archiveScore } from "@/app/actions/proposals";
import { useMutationKey } from "./use-mutation-key";
export default function ScoreEdit(properties: {
  scoreId: number;
  revisionId: string;
  canEdit: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
  const keyFor = useMutationKey();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <section>
      {properties.canEdit && (
        <Link href={`/score/${properties.scoreId}/edit`}>編集案を作成</Link>
      )}
      {properties.canManage && (
        <button
          disabled={pending}
          onClick={async () => {
            if (
              !globalThis.confirm(
                "楽譜をアーカイブしますか？ 履歴は保持されます。",
              )
            )
              return;
            setPending(true);
            try {
              const payload = {
                scoreId: properties.scoreId,
                expectedRevisionId: properties.revisionId,
              };
              const result = await archiveScore({
                ...payload,
                key: keyFor(payload),
              });
              if (result.ok) {
                router.push("/");
                router.refresh();
              } else setMessage(result.error.message);
            } catch {
              setMessage("アーカイブできませんでした。再試行してください。");
            } finally {
              setPending(false);
            }
          }}
        >
          アーカイブ
        </button>
      )}
      <p role="status">{message}</p>
    </section>
  );
}
