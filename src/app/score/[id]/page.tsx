"use client";
import { ScoreViewer } from "@/components/score-viewer";
import { Input } from "@heroui/input";
import { ChangeEvent, useState } from "react";
import * as SMUFL from "@/s-core/models/smufl";
import * as Browser from "@/s-core/models/browser";
export default function Score() {
  const [score, setScore] = useState<SMUFL.Score>();
  const handleChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      if (!file) return;
      setScore((await new Browser.Importer().import(file))?.toSMUFL());
    }
  };
  return (
    <>
      <Input type="file" onChange={handleChange} />
      <ScoreViewer score={score} />
    </>
  );
}
