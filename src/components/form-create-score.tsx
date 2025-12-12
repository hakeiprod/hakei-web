"use client";
import * as Browser from "@/s-core/models/browser";
import { Button, Form, FormProps, Input } from "@heroui/react";

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
            await new Browser.Importer().import(file);
          }
        }}
      />
      <Button type="submit">submit</Button>
    </Form>
  );
}
