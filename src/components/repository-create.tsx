"use client";
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
    <section>
      <h2>リポジトリを作成</h2>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          await submit(new FormData(event.currentTarget));
        }}
      >
        <label>
          名前
          <input name="name" required maxLength={200} />
        </label>
        <label>
          閲覧範囲
          <select name="visibility">
            <option value="PRIVATE">管理者のみ</option>
            <option value="INVITED">招待メンバー</option>
            <option value="PUBLIC">公開</option>
          </select>
        </label>
        <label>
          編集範囲
          <select name="editScope">
            <option value="INVITED">管理者と編集メンバー</option>
            <option value="ALL_USERS">ログインした全員（公開が必要）</option>
          </select>
        </label>
        <button disabled={pending}>作成</button>
      </form>
      <p role="status">{message}</p>
    </section>
  );
}
