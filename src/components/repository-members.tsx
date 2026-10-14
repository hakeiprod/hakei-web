"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { setMember, updateRepository } from "@/app/actions/repositories";
export function RepositoryMembers(properties: {
  repositoryId: string;
  accessVersion: number;
  visibility: string;
  editScope: string;
  members: { userId: string; role: string; canMerge: boolean }[];
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
    <section>
      <h3>共有とメンバー</h3>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          await sharing(new FormData(event.currentTarget));
        }}
      >
        <label>
          閲覧範囲
          <select name="visibility" defaultValue={properties.visibility}>
            <option value="PRIVATE">管理者のみ</option>
            <option value="INVITED">招待メンバー</option>
            <option value="PUBLIC">公開</option>
          </select>
        </label>
        <label>
          編集範囲
          <select name="editScope" defaultValue={properties.editScope}>
            <option value="INVITED">管理者と編集メンバー</option>
            <option value="ALL_USERS">ログインした全員（公開が必要）</option>
          </select>
        </label>
        <button disabled={pending}>共有範囲を保存</button>
      </form>
      <ul>
        {properties.members.map((member) => (
          <li key={member.userId}>
            {member.userId} ·{" "}
            {(
              { ADMIN: "管理者", EDITOR: "編集者", VIEWER: "閲覧者" } as Record<
                string,
                string
              >
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
      >
        <label>
          利用者ID
          <input name="userId" required />
        </label>
        <label>
          役割
          <select name="role">
            <option value="VIEWER">閲覧者</option>
            <option value="EDITOR">編集者</option>
            <option value="ADMIN">管理者</option>
            <option value="REMOVE">招待を取り消す</option>
          </select>
        </label>
        <label>
          <input type="checkbox" name="canMerge" />
          編集者にマージを許可
        </label>
        <button disabled={pending}>メンバーを更新</button>
      </form>
      <p role="status">{message}</p>
    </section>
  );
}
