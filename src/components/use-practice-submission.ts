"use client";
import {
  useCallback,
  useRef,
  useState,
  type RefObject,
  type Dispatch,
  type SetStateAction,
} from "react";
import { savePractice } from "@/app/actions/practice";
import { analysisSchema } from "@/s-core/models/practice/analysis-contracts";
import { gameSummarySchema } from "@/s-core/models/practice/game-contracts";
import type {
  PracticeConditions,
  GameEvaluation,
} from "@/s-core/models/practice";
import type { RecordingSnapshot } from "@/s-core/models/browser/practice-session";
import type { AnalysisData } from "./practice-analysis";
import type { PracticeControlsProperties } from "./practice-controls";
interface SubmissionIdentity {
  clientSessionId: string;
  conditions: PracticeConditions;
  deviceLabel: string;
}
interface SubmissionOptions {
  score: PracticeControlsProperties["score"];
  mode: "PRACTICE" | "GAME";
  mounted: RefObject<boolean>;
  setAnalysis: Dispatch<SetStateAction<AnalysisData | undefined>>;
  setGame: Dispatch<SetStateAction<GameEvaluation | undefined>>;
}
export function usePracticeSubmission({
  score,
  mode,
  mounted,
  setAnalysis,
  setGame,
}: SubmissionOptions) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [savedId, setSavedId] = useState<string>();
  const [hasRetry, setHasRetry] = useState(false);
  const [bestNotice, setBestNotice] = useState(false);
  const retry = useRef<(() => Promise<void>) | null>(null);
  async function save(
    snapshot: RecordingSnapshot,
    identity: SubmissionIdentity,
  ) {
    const snapshotCopy = structuredClone(snapshot);
    const identityCopy = structuredClone(identity);
    return submit();
    async function submit() {
      const snapshot = snapshotCopy;
      const { clientSessionId, conditions, deviceLabel } = identityCopy;
      if (!mounted.current) return;
      setPending(true);
      setMessage("記録を保存しています…");
      const eventBatches = Array.from(
        { length: Math.ceil(snapshot.events.length / 1000) },
        (_, batchIndex) => ({
          batchIndex,
          events: snapshot.events.slice(
            batchIndex * 1000,
            (batchIndex + 1) * 1000,
          ),
        }),
      );
      try {
        const result = await savePractice({
          clientSessionId,
          scoreId: score.id,
          scoreRevisionId: score.revisionId,
          conditions,
          status: snapshot.status,
          endedUs: snapshot.endedUs,
          eventBatches,
          deviceLabel,
        });
        if (!mounted.current) return;
        if (!result.ok) {
          setMessage(`${result.error.message} 入力を保持しています。`);
          retry.current = submit;
          setHasRetry(true);
          return;
        }
        setAnalysis(analysisSchema.parse(result.data.evaluation));
        if (mode === "GAME")
          setGame(gameSummarySchema.parse(result.data.evaluation.summary).game);
        setSavedId(result.data.sessionId);
        setBestNotice(
          result.data.achievements?.includes("PERSONAL_BEST") ?? false,
        );
        setMessage(
          snapshot.status === "INTERRUPTED"
            ? "中断した記録を保存しました。完了回数・自己ベストには含めません。"
            : "演奏と確定した分析を保存しました。",
        );
        retry.current = null;
        setHasRetry(false);
      } catch {
        if (mounted.current) {
          setMessage(
            "保存できませんでした。入力を保持しています。再試行してください。",
          );
          retry.current = submit;
          setHasRetry(true);
        }
      } finally {
        if (mounted.current) setPending(false);
      }
    }
  }
  const clearRetry = useCallback(() => {
    retry.current = null;
  }, []);
  const retrySave = useCallback(() => retry.current?.(), []);
  return {
    pending,
    setPending,
    message,
    setMessage,
    savedId,
    setSavedId,
    hasRetry,
    setHasRetry,
    bestNotice,
    setBestNotice,
    clearRetry,
    retrySave,
    save,
  };
}
