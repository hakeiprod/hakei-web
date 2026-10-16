import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { maintenanceLocations } from "./maintenance-gate";
/** Failure intentionally leaves the freeze in place. Stale leases are never silently discarded. */
export async function withMaintenanceGate<T>(
  root: string,
  operation: (checkpointId: string) => Promise<T>,
  timeoutMs = 60_000,
): Promise<T> {
  const location = maintenanceLocations(root);
  await mkdir(location.active, { recursive: true, mode: 0o700 });
  try {
    await mkdir(location.gate, { mode: 0o700 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST")
      throw new Error("MAINTENANCE");
    throw error;
  }
  const checkpointId = randomUUID();
  await writeFile(
    path.join(location.gate, "checkpoint.json"),
    JSON.stringify({ checkpointId, createdAt: new Date().toISOString() }),
    { flag: "wx", mode: 0o600 },
  );
  const deadline = Date.now() + timeoutMs;
  let active = await readdir(location.active);
  while (active.length > 0) {
    if (Date.now() >= deadline) throw new Error("ACTIVE_WRITES_TIMEOUT");
    await new Promise((done) => setTimeout(done, 50));
    active = await readdir(location.active);
  }
  const result = await operation(checkpointId);
  await rm(location.gate, { recursive: true });
  return result;
}
