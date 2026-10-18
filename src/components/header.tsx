"use client";
import { Suspense } from "react";
import { Button, Navbar, NavbarBrand, NavbarContent } from "@heroui/react";
import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { InputSearch } from "./input-serch";
export function Header() {
  const { status } = useSession();
  return (
    <>
      <Navbar>
        <NavbarBrand>
          <Link href="/">
            <p className="font-bold text-inherit">hakei</p>
          </Link>
        </NavbarBrand>
        <NavbarContent justify="center">
          <Suspense fallback={<span>検索を読み込んでいます。</span>}>
            <InputSearch />
          </Suspense>
          <Link href="/repositories">リポジトリ</Link>
          <Link href="/trust">信頼度</Link>
          {status === "authenticated" && (
            <>
              <Link href="/practice/history">演奏履歴</Link>
            </>
          )}
        </NavbarContent>
        <NavbarContent justify="end">
          {status === "authenticated" ? (
            <Button
              onPress={() => {
                signOut({ redirectTo: "/" });
              }}
            >
              ログアウト
            </Button>
          ) : (
            <>
              <Button
                isDisabled={status === "loading"}
                onPress={() => {
                  signIn();
                }}
              >
                ログイン
              </Button>
            </>
          )}
        </NavbarContent>
      </Navbar>
    </>
  );
}
