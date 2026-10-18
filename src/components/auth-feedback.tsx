"use client";
import { Alert } from "@heroui/react";

export function AuthFeedback({ message }: { message: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="min-w-0 break-words"
    >
      {message && (
        <Alert
          role="presentation"
          description={message}
          classNames={{
            base: "min-w-0",
            mainWrapper: "min-w-0",
            description: "break-words",
          }}
        />
      )}
    </div>
  );
}
