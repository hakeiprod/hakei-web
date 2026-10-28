"use client";
import { useLayoutEffect } from "react";
import { useLinkStatus } from "next/link";
import { beginScoreNavigation } from "@/s-core/models/browser/score-navigation";

/** Must be inside Link: Next owns pending state, including rollback and cancellation. */
export function ScoreNavigationStatus() {
  const { pending } = useLinkStatus();
  useLayoutEffect(() => {
    if (pending) return beginScoreNavigation();
  }, [pending]);
  return null;
}
