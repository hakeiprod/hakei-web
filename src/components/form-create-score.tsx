"use client";
import * as Browser from "@/s-core/models/browser";
import { Button, Form, Input } from "@heroui/react";
import { FormProps } from "@heroui/react";

export function FormCreateScore(properties: FormProps) {
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
            const importer = new Browser.Importer();
            await importer.import(file);
          }
        }}
      />
      <Button type="submit">submit</Button>
    </Form>
  );
}
