"use client";
import * as Browser from "@/s-core/models/browser";
import * as Sheet from "@/s-core/models/sheet";
import * as SMUFL from "@/s-core/models/smufl";
import { Button, Form, FormProps, Input } from "@heroui/react";
import { useState } from "react";
import { ScoreViewer } from "./score-viewer";

export function FormCreateScore(properties: FormProps) {
  const [score, setScore] = useState<SMUFL.Score>();
  return (
    <Form {...properties}>
      <Input
        name="data"
        type="file"
        onChange={async (event) => {
          const input = event.target;
          if (input.files && input.files.length > 0) {
            const file = input.files[0];
            if (!file) return;
            const sheet = (await new Browser.Importer().import(
              file,
            )) as Sheet.Score;
            setScore(SMUFL.Score.import(sheet.export()));
          }
        }}
      />
      {score && (
        <div style={{ overflowX: "auto" }}>
          <ScoreViewer score={score} />
        </div>
      )}
      <Button type="submit">submit</Button>
    </Form>
  );
}
