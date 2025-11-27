"use client";
import { Button, Form, Input } from "@heroui/react";
import { FormProps } from "@heroui/react";

export function FormCreateScore(props: FormProps) {
  return (
    <Form {...props}>
      <Input name="data" type="file" />
      <Button type="submit">submit</Button>
    </Form>
  );
}
