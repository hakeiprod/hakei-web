"use client";
import {
  CardBody,
  Card,
  SelectItem,
  Select,
  Button,
  Input,
  Checkbox,
} from "@heroui/react";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setMember, updateRepository } from "@/app/actions/repositories";
export function RepositoryMembers(properties: {
  repositoryId: string;
  accessVersion: number;
  visibility: string;
  editScope: string;
  members: {
    userId: string;
    role: string;
    canMerge: boolean;
  }[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  async function membership(formData: FormData) {
    setPending(true);
    try {
      const result = await setMember({
        repositoryId: properties.repositoryId,
        userId: formData.get("userId"),
        role: formData.get("role"),
        canMerge: formData.get("canMerge") === "on",
        expectedAccessVersion: properties.accessVersion,
      });
      setMessage(result.ok ? "権限を更新しました。" : result.error.message);
      if (result.ok) router.refresh();
    } catch {
      setMessage(
        "更新できませんでした。最新の権限を確認して再試行してください。",
      );
    } finally {
      setPending(false);
    }
  }
  async function sharing(formData: FormData) {
    setPending(true);
    try {
      const result = await updateRepository({
        repositoryId: properties.repositoryId,
        visibility: formData.get("visibility"),
        editScope: formData.get("editScope"),
        expectedAccessVersion: properties.accessVersion,
      });
      setMessage(result.ok ? "共有範囲を更新しました。" : result.error.message);
      if (result.ok) router.refresh();
    } catch {
      setMessage(
        "更新できませんでした。最新の権限を確認して再試行してください。",
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
        <h3 className="text-lg font-semibold">共有とメンバー</h3>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            await sharing(new FormData(event.currentTarget));
          }}
          className="grid min-w-0 gap-4"
        >
          <div className="min-w-0">
            <Select
              name="visibility"
              label="閲覧範囲"
              variant="bordered"
              labelPlacement="outside"
              defaultSelectedKeys={
                String(properties.visibility) === ""
                  ? []
                  : [String(properties.visibility)]
              }
              disallowEmptySelection
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
              defaultSelectedKeys={
                String(properties.editScope) === ""
                  ? []
                  : [String(properties.editScope)]
              }
              disallowEmptySelection
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
            共有範囲を保存
          </Button>
        </form>
        <ul>
          {properties.members.map((member) => (
            <li key={member.userId}>
              {member.userId} ·{" "}
              {(
                {
                  ADMIN: "管理者",
                  EDITOR: "編集者",
                  VIEWER: "閲覧者",
                } as Record<string, string>
              )[member.role] ?? member.role}{" "}
              · {member.canMerge ? "マージ可" : "マージ不可"}
            </li>
          ))}
        </ul>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            await membership(new FormData(event.currentTarget));
          }}
          className="grid min-w-0 gap-4"
        >
          <div className="min-w-0">
            <Input
              name="userId"
              label="利用者ID"
              variant="bordered"
              labelPlacement="outside"
              className="min-w-0"
              isRequired
              validationBehavior="native"
            />
          </div>
          <div className="min-w-0">
            <Select
              name="role"
              label="役割"
              variant="bordered"
              labelPlacement="outside"
              disallowEmptySelection
              defaultSelectedKeys={["VIEWER"]}
              className="min-w-0"
            >
              <SelectItem key={"VIEWER"}>閲覧者</SelectItem>
              <SelectItem key={"EDITOR"}>編集者</SelectItem>
              <SelectItem key={"ADMIN"}>管理者</SelectItem>
              <SelectItem key={"REMOVE"}>招待を取り消す</SelectItem>
            </Select>
          </div>
          <div className="min-w-0">
            <Checkbox name="canMerge" value="on">
              {"編集者にマージを許可"}
            </Checkbox>
          </div>
          <Button
            isDisabled={pending}
            type="submit"
            color="primary"
            variant="solid"
            className="max-w-full whitespace-normal"
            isLoading={pending}
          >
            メンバーを更新
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
