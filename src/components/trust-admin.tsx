"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { adjustTrust, publishTrustRule } from "@/app/actions/trust";
import type { TrustRule } from "@/server/trust-calculation";
import { useMutationKey } from "./use-mutation-key";
const labels: Record<keyof TrustRule, string> = {
  initialScore: "初期スコア",
  wAdmin: "運営調整の重み",
  wOutcome: "実績の重み",
  wReview: "他者評価の重み",
  acceptedDelta: "採用加点",
  rejectedDelta: "却下加減点",
  reviewFactor: "評価係数",
  minReview: "評価下限",
  maxReview: "評価上限",
  minScore: "スコア下限",
  maxScore: "スコア上限",
  mergeThreshold: "マージ基準",
};
export function TrustAdmin(properties: {
  rule: TrustRule | null;
  ruleId: string | null;
  policyVersion: number;
}) {
  const router = useRouter();
  const keyFor = useMutationKey();
  const [confirmation, setConfirmation] = useState<{
    rule: Record<string, number>;
    reason: string;
  } | null>(null);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <section>
      <h2>信頼度ルール</h2>
      {!properties.rule && (
        <p>未設定です。設定を確認してから有効化してください。</p>
      )}
      {confirmation ? (
        <>
          <h3>適用内容の確認</h3>
          <dl>
            {Object.entries(confirmation.rule).map(([key, value]) => (
              <div key={key}>
                <dt>{labels[key as keyof TrustRule]}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <p>理由: {confirmation.reason}</p>
          <button
            disabled={pending}
            onClick={async () => {
              setPending(true);
              try {
                const payload = {
                  ...confirmation,
                  expectedPolicyVersion: properties.policyVersion,
                };
                const result = await publishTrustRule({
                  ...payload,
                  key: keyFor(payload),
                });
                setMessage(
                  result.ok
                    ? "新しいルールを有効化しました。"
                    : result.error.message,
                );
                if (result.ok) {
                  setConfirmation(null);
                  router.refresh();
                }
              } catch {
                setMessage(
                  "有効化できませんでした。確認内容を保持しています。",
                );
              } finally {
                setPending(false);
              }
            }}
          >
            このルールを有効化
          </button>
          <button disabled={pending} onClick={() => setConfirmation(null)}>
            入力に戻る
          </button>
        </>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            setConfirmation({
              rule: Object.fromEntries(
                Object.keys(labels).map((key) => [key, Number(data.get(key))]),
              ),
              reason: String(data.get("reason")),
            });
          }}
        >
          {Object.entries(labels).map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                name={key}
                type="number"
                step="any"
                required
                defaultValue={properties.rule?.[key as keyof TrustRule]}
              />
            </label>
          ))}
          <label>
            変更理由
            <textarea name="reason" required maxLength={2000} />
          </label>
          <button>適用内容を確認</button>
        </form>
      )}
      <h2>利用者のスコアを調整</h2>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (!properties.ruleId) return;
          const data = new FormData(event.currentTarget);
          const payload = {
            targetId: String(data.get("targetId")),
            desiredScore: Number(data.get("desiredScore")),
            expectedRuleId: properties.ruleId,
            reason: String(data.get("adjustmentReason")),
          };
          if (
            !globalThis.confirm(
              `${payload.targetId} の信頼度を ${payload.desiredScore} に調整します。理由: ${payload.reason}`,
            )
          )
            return;
          setPending(true);
          try {
            const result = await adjustTrust({
              ...payload,
              key: keyFor(payload),
            });
            setMessage(
              result.ok
                ? "指定したスコアに調整しました。"
                : result.error.message,
            );
            if (result.ok) router.refresh();
          } catch {
            setMessage("調整できませんでした。同じ内容を再試行できます。");
          } finally {
            setPending(false);
          }
        }}
      >
        <label>
          利用者ID
          <input name="targetId" required />
        </label>
        <label>
          目標スコア
          <input
            name="desiredScore"
            type="number"
            step="any"
            min={properties.rule?.minScore}
            max={properties.rule?.maxScore}
            required
          />
        </label>
        <label>
          調整理由
          <textarea name="adjustmentReason" required maxLength={2000} />
        </label>
        <button disabled={pending || !properties.ruleId}>
          内容を確認して調整
        </button>
      </form>
      <p role="status">{message}</p>
    </section>
  );
}
