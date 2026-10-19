"use client";
import { CardBody, Card, Input, Button } from "@heroui/react";

import { useEffect, useState } from "react";
import { readTrust, reviewUser } from "@/app/actions/trust";
type Trust = {
  score: number;
  threshold: number;
  ruleVersion: number;
  inputs: {
    adjustment: number;
    accepted: number;
    rejected: number;
    reviews: number;
  };
};
export function UserTrust(properties: { userId: string }) {
  const [trust, setTrust] = useState<Trust>();
  const [message, setMessage] = useState("信頼度を確認しています。");
  const [pending, setPending] = useState(false);
  useEffect(() => {
    let active = true;
    readTrust({ userId: properties.userId })
      .then((result) => {
        if (!active) return;
        if (result.ok) {
          setTrust(result.data);
          setMessage("");
        } else setMessage(result.error.message);
      })
      .catch(() => {
        if (active) setMessage("信頼度を確認できませんでした。");
      });
    return () => {
      active = false;
    };
  }, [properties.userId]);
  return (
    <Card
      as="section"
      className="min-w-0 overflow-visible border border-divider bg-content1"
    >
      <CardBody className="min-w-0 space-y-4 p-4 sm:p-6">
        <h2 className="text-xl font-semibold">あなたの信頼度</h2>
        <p>招待に使う利用者ID: {properties.userId}</p>
        {trust && (
          <>
            <p>
              スコア {trust.score} / マージ基準 {trust.threshold}（ルール{" "}
              {trust.ruleVersion}）
            </p>
            <dl>
              <dt>運営調整</dt>
              <dd>{trust.inputs.adjustment}</dd>
              <dt>他者による採用</dt>
              <dd>{trust.inputs.accepted}</dd>
              <dt>他者による却下</dt>
              <dd>{trust.inputs.rejected}</dd>
              <dt>他者評価の合計</dt>
              <dd>{trust.inputs.reviews}</dd>
            </dl>
          </>
        )}
        <p
          role="status"
          className="empty:hidden rounded-lg bg-default-100 p-3 text-sm text-foreground"
        >
          {message}
        </p>
        <h3 className="text-lg font-semibold">ほかの利用者を評価</h3>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            setPending(true);
            try {
              const result = await reviewUser({
                targetId: data.get("targetId"),
                value: Number(data.get("value")),
              });
              setMessage(
                result.ok ? "評価を更新しました。" : result.error.message,
              );
            } catch {
              setMessage("評価を更新できませんでした。再試行できます。");
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
              name="value"
              type="number"
              step="any"
              label="評価値"
              variant="bordered"
              labelPlacement="outside"
              className="min-w-0"
              isRequired
              validationBehavior="native"
            />
          </div>
          <Button
            isDisabled={pending}
            type="submit"
            color="primary"
            variant="solid"
            className="max-w-full whitespace-normal"
            isLoading={pending}
          >
            評価を保存
          </Button>
        </form>
        <p>
          自己評価はできません。同じ利用者への評価は最新の1件に更新されます。
        </p>
      </CardBody>
    </Card>
  );
}
