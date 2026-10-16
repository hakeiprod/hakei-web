import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, rm, access } from "node:fs/promises";
import path from "node:path";
const leases = new AsyncLocalStorage<string>();
export function maintenanceLocations(root: string) {
  if (!path.isAbsolute(root))
    throw new Error("SCORE_GIT_ROOT must be absolute");
  return {
    root,
    active: path.join(root, ".write-leases"),
    gate: path.join(root, ".maintenance"),
  };
}
async function isFrozen(gate: string) {
  try {
    await access(gate);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}
/** Atomic admission, then a second gate check closes the admission/freeze race. */
export async function withWriteLease<T>(
  root: string,
  operation: () => Promise<T>,
): Promise<T> {
  const location = maintenanceLocations(root);
  if (leases.getStore() === root) return operation();
  await mkdir(location.active, { recursive: true, mode: 0o700 });
  if (await isFrozen(location.gate)) throw new Error("MAINTENANCE");
  const lease = path.join(location.active, randomUUID());
  await writeFile(
    lease,
    JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }),
    { flag: "wx", mode: 0o600 },
  );
  try {
    if (await isFrozen(location.gate)) throw new Error("MAINTENANCE");
    return await leases.run(root, operation);
  } finally {
    await rm(lease);
  }
}
export function configuredWriteLease<T>(operation: () => Promise<T>) {
  const root = process.env.SCORE_GIT_ROOT;
  if (!root) throw new Error("SCORE_GIT_ROOT is required");
  return withWriteLease(root, operation);
}
