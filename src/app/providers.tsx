"use client";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { HeroUIProvider } from "@heroui/react";
import { Provider } from "jotai";
import { AuthenticationVisibility } from "@/components/authentication-visibility";
import { SessionProvider } from "next-auth/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <HeroUIProvider>
      <NuqsAdapter>
        <SessionProvider refetchOnWindowFocus={false}>
          <AuthenticationVisibility>
            <Provider>{children}</Provider>
          </AuthenticationVisibility>
        </SessionProvider>
      </NuqsAdapter>
    </HeroUIProvider>
  );
}
