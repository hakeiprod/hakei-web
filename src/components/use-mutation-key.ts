"use client";
import { useRef } from "react";
/** Retain a key for an identical retry, and generate a new key for a changed operation. */
export function useMutationKey() {
  const latest = useRef<{ fingerprint: string; key: string } | null>(null);
  return (payload: unknown) => {
    const fingerprint = JSON.stringify(payload);
    if (!latest.current || latest.current.fingerprint !== fingerprint)
      latest.current = { fingerprint, key: crypto.randomUUID() };
    return latest.current.key;
  };
}
