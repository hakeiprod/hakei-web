"use client";
import { CardBody, Card, Button } from "@heroui/react";

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
    <Card
      as="section"
      className="min-w-0 overflow-visible border border-divider bg-content1 [contain-intrinsic-block-size:auto_160px] [content-visibility:auto]"
    >
      <CardBody className="min-w-0 space-y-4 p-4 sm:p-6">
        {properties.canEdit && (
          <Link
            href={`/score/${properties.scoreId}/edit`}
            className="rounded-small text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-focus"
          >
            編集案を作成
          </Link>
        )}
        {properties.canManage && (
          <Button
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
            isDisabled={pending}
            type="button"
            color="danger"
            variant="flat"
            className="max-w-full whitespace-normal"
            isLoading={pending}
          >
            アーカイブ
          </Button>
        )}
        <p
          role="status"
          className="empty:hidden rounded-lg bg-default-100 p-3 text-sm text-foreground"
        >
          {message}
        </p>
      </CardBody>
    </Card>
  );
}
