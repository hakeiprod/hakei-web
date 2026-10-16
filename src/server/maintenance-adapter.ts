import "server-only";
import type { Adapter } from "next-auth/adapters";
import { configuredWriteLease } from "./maintenance-gate";
const writes = new Set([
  "createUser",
  "updateUser",
  "deleteUser",
  "linkAccount",
  "unlinkAccount",
  "createSession",
  "updateSession",
  "deleteSession",
  "createVerificationToken",
  "useVerificationToken",
  "createAuthenticator",
  "updateAuthenticatorCounter",
]);
export function maintenanceAdapter(adapter: Adapter): Adapter {
  return new Proxy(adapter, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (
        typeof property !== "string" ||
        !writes.has(property) ||
        typeof value !== "function"
      )
        return value;
      return (...arguments_: unknown[]) =>
        configuredWriteLease(() =>
          Promise.resolve(Reflect.apply(value, target, arguments_)),
        );
    },
  });
}
