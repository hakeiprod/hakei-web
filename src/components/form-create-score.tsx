"use client";
import { Button, Form, Input } from "@heroui/react";
import { FormProps } from "@heroui/react";

export function FormCreateScore(properties: FormProps) {
  return (
    <Form {...properties}>
      <Input name="data" type="file" />
      <Button type="submit">submit</Button>
    </Form>
  );
}
