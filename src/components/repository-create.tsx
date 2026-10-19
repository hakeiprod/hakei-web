"use client";
import {
  CardBody,
  Card,
  Input,
  SelectItem,
  Select,
  Button,
} from "@heroui/react";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutationKey } from "./use-mutation-key";
import { createRepository } from "@/app/actions/repositories";
export function RepositoryCreate() {
  const router = useRouter();
  const keyFor = useMutationKey();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(form: FormData) {
    setPending(true);
    try {
      const payload = {
        name: form.get("name"),
        visibility: form.get("visibility"),
        editScope: form.get("editScope"),
      };
      const result = await createRepository({
        ...payload,
        key: keyFor(payload),
      });
      setMessage(
        result.ok ? "リポジトリを作成しました。" : result.error.message,
      );
      if (result.ok) router.refresh();
    } catch {
      setMessage(
        "作成できませんでした。入力を保持しているので再試行できます。",
      );
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
        <h2 className="text-xl font-semibold">リポジトリを作成</h2>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            await submit(new FormData(event.currentTarget));
          }}
          className="grid min-w-0 gap-4"
        >
          <div className="min-w-0">
            <Input
              name="name"
              maxLength={200}
              label="名前"
              variant="bordered"
              labelPlacement="outside"
              className="min-w-0"
              isRequired
              validationBehavior="native"
            />
          </div>
          <div className="min-w-0">
            <Select
              name="visibility"
              label="閲覧範囲"
              variant="bordered"
              labelPlacement="outside"
              disallowEmptySelection
              defaultSelectedKeys={["PRIVATE"]}
              className="min-w-0"
            >
              <SelectItem key={"PRIVATE"}>管理者のみ</SelectItem>
              <SelectItem key={"INVITED"}>招待メンバー</SelectItem>
              <SelectItem key={"PUBLIC"}>公開</SelectItem>
            </Select>
          </div>
          <div className="min-w-0">
            <Select
              name="editScope"
              label="編集範囲"
              variant="bordered"
              labelPlacement="outside"
              disallowEmptySelection
              defaultSelectedKeys={["INVITED"]}
              className="min-w-0"
            >
              <SelectItem key={"INVITED"}>管理者と編集メンバー</SelectItem>
              <SelectItem key={"ALL_USERS"}>
                ログインした全員（公開が必要）
              </SelectItem>
            </Select>
          </div>
          <Button
            isDisabled={pending}
            type="submit"
            color="primary"
            variant="solid"
            className="max-w-full whitespace-normal"
            isLoading={pending}
          >
            作成
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
