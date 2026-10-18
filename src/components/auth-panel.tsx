"use client";
import { Card, CardBody, CardHeader } from "@heroui/react";
import type { ReactNode } from "react";

export function AuthPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mx-auto w-full min-w-0 max-w-lg px-4 py-8">
      <Card className="w-full min-w-0">
        <CardHeader className="px-6 pt-6">
          <h1 className="text-xl font-semibold">{title}</h1>
        </CardHeader>
        <CardBody className="flex min-w-0 flex-col gap-4 overflow-visible break-words px-6 pb-6">
          {children}
        </CardBody>
      </Card>
    </section>
  );
}
