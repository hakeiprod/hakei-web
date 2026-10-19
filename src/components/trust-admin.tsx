"use client";
import { CardBody, Card, Button, Input, Textarea } from "@heroui/react";

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
    <Card
      as="section"
      className="min-w-0 overflow-visible border border-divider bg-content1"
    >
      <CardBody className="min-w-0 space-y-4 p-4 sm:p-6">
        <h2 className="text-xl font-semibold">信頼度ルール</h2>
        {!properties.rule && (
          <p>未設定です。設定を確認してから有効化してください。</p>
        )}
        {confirmation ? (
          <>
            <h3 className="text-lg font-semibold">適用内容の確認</h3>
            <dl>
              {Object.entries(confirmation.rule).map(([key, value]) => (
                <div key={key}>
                  <dt>{labels[key as keyof TrustRule]}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <p>理由: {confirmation.reason}</p>
            <Button
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
              isDisabled={pending}
              type="button"
              color="primary"
              variant="solid"
              className="max-w-full whitespace-normal"
              isLoading={pending}
            >
              このルールを有効化
            </Button>
            <Button
              onClick={() => setConfirmation(null)}
              isDisabled={pending}
              type="button"
              color="default"
              variant="light"
              className="max-w-full whitespace-normal"
              isLoading={pending}
            >
              入力に戻る
            </Button>
          </>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              setConfirmation({
                rule: Object.fromEntries(
                  Object.keys(labels).map((key) => [
                    key,
                    Number(data.get(key)),
                  ]),
                ),
                reason: String(data.get("reason")),
              });
            }}
            className="grid min-w-0 gap-4"
          >
            {Object.entries(labels).map(([key, label]) => (
              <div key={key} className="min-w-0">
                <Input
                  name={key}
                  type="number"
                  step="any"
                  defaultValue={
                    properties.rule?.[key as keyof TrustRule] == null
                      ? ""
                      : String(properties.rule?.[key as keyof TrustRule])
                  }
                  label={label}
                  variant="bordered"
                  labelPlacement="outside"
                  className="min-w-0"
                  isRequired
                  validationBehavior="native"
                />
              </div>
            ))}
            <div className="min-w-0">
              <Textarea
                name="reason"
                maxLength={2000}
                isRequired
                validationBehavior="native"
                label="変更理由"
                variant="bordered"
                labelPlacement="outside"
              />
            </div>
            <Button
              type="submit"
              color="primary"
              variant="solid"
              className="max-w-full whitespace-normal"
            >
              適用内容を確認
            </Button>
          </form>
        )}
        <h2 className="text-xl font-semibold">利用者のスコアを調整</h2>
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
          className="grid min-w-0 gap-4"
        >
          <div className="min-w-0">
            <Input
              name="targetId"
              label="利用者ID"
              variant="bordered"
              labelPlacement="outside"
              className="min-w-0"
              isRequired
              validationBehavior="native"
            />
          </div>
          <div className="min-w-0">
            <Input
              name="desiredScore"
              type="number"
              step="any"
              min={properties.rule?.minScore}
              max={properties.rule?.maxScore}
              label="目標スコア"
              variant="bordered"
              labelPlacement="outside"
              className="min-w-0"
              isRequired
              validationBehavior="native"
            />
          </div>
          <div className="min-w-0">
            <Textarea
              name="adjustmentReason"
              maxLength={2000}
              isRequired
              validationBehavior="native"
              label="調整理由"
              variant="bordered"
              labelPlacement="outside"
            />
          </div>
          <Button
            isDisabled={pending || !properties.ruleId}
            type="submit"
            color="primary"
            variant="solid"
            className="max-w-full whitespace-normal"
            isLoading={pending}
          >
            内容を確認して調整
          </Button>
        </form>
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
