"use client";
import { Link } from "@heroui/react";
import NextLink from "next/link";

export function AuthHomeLink() {
  return (
    <Link as={NextLink} href="/" className="mx-4 mb-8">
      ホームへ戻る
    </Link>
  );
}
