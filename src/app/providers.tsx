"use client";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { HeroUIProvider } from "@heroui/react";
import { Provider } from "jotai";
import { SessionProvider } from "next-auth/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <HeroUIProvider>
      <NuqsAdapter>
        <SessionProvider>
          <Provider>{children}</Provider>
        </SessionProvider>
      </NuqsAdapter>
    </HeroUIProvider>
  );
}
