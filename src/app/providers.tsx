"use client";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { HeroUIProvider } from "@heroui/react";
import { Provider } from "jotai";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <HeroUIProvider>
      <NuqsAdapter>
        <Provider>{children}</Provider>
      </NuqsAdapter>
    </HeroUIProvider>
  );
}
