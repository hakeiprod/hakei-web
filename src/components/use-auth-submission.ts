"use client";
import { useEffect, useRef, useState } from "react";
import { authOperation } from "./auth-operation";
export function useAuthSubmission() {
  const controller = useRef<AbortController | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => () => controller.current?.abort(), []);
  async function submit(
    operation: Parameters<typeof authOperation>[0],
    input: unknown,
  ) {
    if (controller.current) return false;
    const active = new AbortController();
    controller.current = active;
    setPending(true);
    try {
      const result = await authOperation(operation, input, active.signal);
      if (active.signal.aborted) return false;
      setMessage(result.ok ? result.data.message : result.error.message);
      return result.ok;
    } catch {
      if (!active.signal.aborted)
        setMessage("処理できませんでした。時間をおいて再試行してください。");
      return false;
    } finally {
      controller.current = null;
      if (!active.signal.aborted) setPending(false);
    }
  }
  return { submit, pending, message, setMessage };
}
