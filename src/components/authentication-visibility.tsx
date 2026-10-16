"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getSession, useSession } from "next-auth/react";

const visibility = createContext<boolean | undefined>(undefined);
export const useAuthenticationVisibility = () => useContext(visibility);

export function AuthenticationVisibility({
  children,
}: {
  children: ReactNode;
}) {
  const session = useSession();
  const [verified, setVerified] = useState<{
    id: string;
    sid: string;
    authVersion: number;
  } | null>(null);
  const initialCheck = useRef(false);
  const recheck = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    let active = true;
    let generation = 0;
    const hide = () => {
      generation++;
      setVerified(null);
    };
    let pending = false;
    const check = async (hideFirst = false) => {
      if (hideFirst) hide();
      if (
        document.visibilityState !== "visible" ||
        !navigator.onLine ||
        pending
      )
        return;
      pending = true;
      const version = generation;
      try {
        const current = await getSession();
        if (active && version === generation)
          setVerified(
            current?.user?.id && current.sid
              ? {
                  id: current.user.id,
                  sid: current.sid,
                  authVersion: current.authVersion,
                }
              : null,
          );
      } catch {
        if (active && version === generation) setVerified(null);
      } finally {
        pending = false;
        if (
          active &&
          version !== generation &&
          document.visibilityState === "visible" &&
          navigator.onLine
        )
          check();
      }
    };
    recheck.current = check;
    const changed = () => {
      if (document.visibilityState === "visible") check(true);
      else hide();
    };
    const resumed = () => {
      check(true);
    };
    const focused = () => {
      check();
    };
    const interval = setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine) check();
    }, 15_000);
    document.addEventListener("visibilitychange", changed);
    window.addEventListener("pageshow", resumed);
    window.addEventListener("focus", focused);
    globalThis.addEventListener("online", resumed);
    globalThis.addEventListener("offline", hide);
    return () => {
      active = false;
      generation++;
      initialCheck.current = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", changed);
      window.removeEventListener("pageshow", resumed);
      window.removeEventListener("focus", focused);
      globalThis.removeEventListener("online", resumed);
      globalThis.removeEventListener("offline", hide);
    };
  }, []);
  useEffect(() => {
    if (session.status === "authenticated" && !initialCheck.current) {
      initialCheck.current = true;
      recheck.current();
    }
  }, [session.status]);
  return (
    <visibility.Provider
      value={
        verified !== null &&
        session.status === "authenticated" &&
        verified.id === session.data?.user?.id &&
        verified.sid === session.data?.sid &&
        verified.authVersion === session.data?.authVersion
      }
    >
      {children}
    </visibility.Provider>
  );
}
