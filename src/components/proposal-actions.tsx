"use client";
import { CardBody, Card, Textarea, Button } from "@heroui/react";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { closeProposal, mergeProposal } from "@/app/actions/proposals";
import { useMutationKey } from "./use-mutation-key";
export function ProposalActions(properties: {
  proposalId: string;
  version: number;
  baseRevisionId: string;
  baseRepositoryCommitOid: string;
  status: string;
  canMerge: boolean;
  mergeReason: string;
  canWithdraw: boolean;
}) {
  const router = useRouter();
  const keyFor = useMutationKey();
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  async function act(decision: "MERGE" | "REJECTED" | "WITHDRAWN") {
    setPending(true);
    try {
      const payload =
        decision === "MERGE"
          ? {
              proposalId: properties.proposalId,
              expectedProposalVersion: properties.version,
              expectedRevisionId: properties.baseRevisionId,
              expectedRepositoryCommitOid: properties.baseRepositoryCommitOid,
            }
          : {
              proposalId: properties.proposalId,
              expectedVersion: properties.version,
              decision,
              reason,
            };
      const result =
        decision === "MERGE"
          ? await mergeProposal({ ...payload, key: keyFor(payload) })
          : await closeProposal({ ...payload, key: keyFor(payload) });
      setMessage(result.ok ? "操作を完了しました。" : result.error.message);
      if (result.ok) router.refresh();
    } catch {
      setMessage("処理できませんでした。同じ操作を再試行できます。");
    } finally {
      setPending(false);
    }
  }
  return (
    <Card
      as="section"
      className="min-w-0 overflow-visible border border-divider bg-content1"
    >
      <CardBody className="min-w-0 space-y-4 p-4 sm:p-6">
        <p>{properties.mergeReason}</p>
        {(properties.canWithdraw ||
          (properties.status === "SUBMITTED" && properties.canMerge)) && (
          <div className="min-w-0">
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              label="却下・取り下げの理由"
              variant="bordered"
              labelPlacement="outside"
            />
          </div>
        )}
        {properties.status === "SUBMITTED" && (
          <>
            <Button
              onClick={() => act("MERGE")}
              isDisabled={pending || !properties.canMerge}
              type="button"
              color="primary"
              variant="solid"
              className="max-w-full whitespace-normal"
              isLoading={pending}
            >
              マージ
            </Button>
            <Button
              onClick={() => act("REJECTED")}
              isDisabled={pending || !properties.canMerge || !reason.trim()}
              type="button"
              color="danger"
              variant="flat"
              className="max-w-full whitespace-normal"
              isLoading={pending}
            >
              却下
            </Button>
          </>
        )}
        {properties.canWithdraw && (
          <Button
            onClick={() => act("WITHDRAWN")}
            isDisabled={pending || !reason.trim()}
            type="button"
            color="danger"
            variant="flat"
            className="max-w-full whitespace-normal"
            isLoading={pending}
          >
            取り下げ
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
