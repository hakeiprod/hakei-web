import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

type AuthenticationContext = {
  databaseUnavailable: boolean;
  sessionRejected?: boolean;
  github?: { providerAccountId: string };
  incoming?: {
    id: string;
    sid: string;
    authVersion: number;
    serviceRole: string;
  };
};
const contexts = new AsyncLocalStorage<AuthenticationContext>();
export const authenticationContext = () => contexts.getStore();
export const withAuthenticationContext = <T>(operation: () => Promise<T>) =>
  contexts.run({ databaseUnavailable: false }, operation);
