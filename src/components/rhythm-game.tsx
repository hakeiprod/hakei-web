"use client";
import type { EvaluationRule } from "@/s-core/models/practice/contracts";
import { PracticeControls } from "./practice-controls";
export function RhythmGame(properties: {
  score: {
    id: number;
    repositoryId: string;
    revisionId: string;
    data: unknown;
  };
  rule: EvaluationRule;
}) {
  return <PracticeControls {...properties} mode="GAME" />;
}
