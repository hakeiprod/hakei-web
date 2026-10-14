"use client";
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
    <section>
      <p>{properties.mergeReason}</p>
      {(properties.canWithdraw ||
        (properties.status === "SUBMITTED" && properties.canMerge)) && (
        <label>
          却下・取り下げの理由
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
      )}
      {properties.status === "SUBMITTED" && (
        <>
          <button
            disabled={pending || !properties.canMerge}
            onClick={() => act("MERGE")}
          >
            マージ
          </button>
          <button
            disabled={pending || !properties.canMerge || !reason.trim()}
            onClick={() => act("REJECTED")}
          >
            却下
          </button>
        </>
      )}
      {properties.canWithdraw && (
        <button
          disabled={pending || !reason.trim()}
          onClick={() => act("WITHDRAWN")}
        >
          取り下げ
        </button>
      )}
      <p role="status">{message}</p>
    </section>
  );
}
