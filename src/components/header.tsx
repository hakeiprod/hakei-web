"use client";
import { Suspense } from "react";
import { Button, Navbar, NavbarBrand, NavbarContent } from "@heroui/react";
import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { InputSearch } from "./input-serch";
import { ScoreNavigationStatus } from "./score-navigation-status";
export function Header() {
  const { status } = useSession();
  return (
    <>
      <Navbar
        isBlurred={false}
        height="auto"
        className="border-b border-divider bg-background"
        classNames={{ wrapper: "min-h-16 flex-wrap gap-3 py-3" }}
      >
        <NavbarBrand>
          <Link
            className="rounded-small text-sm text-foreground outline-offset-4 hover:text-primary focus-visible:outline-2 focus-visible:outline-focus"
            href="/"
            prefetch={true}
          >
            <p className="font-bold text-inherit">hakei</p>
            <ScoreNavigationStatus />
          </Link>
        </NavbarBrand>
        <NavbarContent
          justify="center"
          className="order-3 h-auto min-w-0 basis-full flex-wrap gap-3 sm:order-none sm:basis-auto"
        >
          <Suspense fallback={<span>検索を読み込んでいます。</span>}>
            <InputSearch />
          </Suspense>
          <Link
            className="rounded-small text-sm text-foreground outline-offset-4 hover:text-primary focus-visible:outline-2 focus-visible:outline-focus"
            href="/repositories"
          >
            リポジトリ
            <ScoreNavigationStatus />
          </Link>
          <Link
            className="rounded-small text-sm text-foreground outline-offset-4 hover:text-primary focus-visible:outline-2 focus-visible:outline-focus"
            href="/trust"
          >
            信頼度
            <ScoreNavigationStatus />
          </Link>
          {status === "authenticated" && (
            <>
              <Link
                className="rounded-small text-sm text-foreground outline-offset-4 hover:text-primary focus-visible:outline-2 focus-visible:outline-focus"
                href="/practice/history"
              >
                演奏履歴
                <ScoreNavigationStatus />
              </Link>
            </>
          )}
        </NavbarContent>
        <NavbarContent justify="end" className="grow-0">
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
