import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { withTestConnections } from "../testing/database";
import { reserveLogin, finishLogin, reserveSend } from "./rate-limit";

it("counts pending reservations across pools and releases successful attempts only once", () =>
  withTestConnections(async (first, second) => {
    const input = {
      mailbox: `${randomUUID()}@example.invalid`,
      source: randomUUID(),
      secret: "test-only-rate-secret-not-for-deployment",
      mailboxLimit: 1,
      sourceLimit: 1,
    };
    const results = await Promise.allSettled([
      reserveLogin(first, input),
      reserveLogin(second, input),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    const accepted = results.find((r) => r.status === "fulfilled");
    if (!accepted || accepted.status !== "fulfilled")
      throw new Error("missing accepted reservation");
    await finishLogin(first, accepted.value.id, true);
    await finishLogin(second, accepted.value.id, true);
    const next = await reserveLogin(second, input);
    await finishLogin(second, next.id, false);
    await expect(reserveLogin(first, input)).rejects.toThrow();
  }));
it("keeps crashed attempts counted and combines all sending purposes in one quota", () =>
  withTestConnections(async (first, second) => {
    const input = {
      mailbox: `${randomUUID()}@example.invalid`,
      source: randomUUID(),
      secret: "test-only-rate-secret-not-for-deployment",
      mailboxLimit: 1,
      sourceLimit: 1,
    };
    const attempt = await reserveLogin(first, input);
    await first.authAttempt.update({
      where: { id: attempt.id },
      data: { deadline: new Date(0) },
    });
    await expect(reserveLogin(second, input)).rejects.toThrow();
    await finishLogin(first, attempt.id, true);
    await expect(reserveLogin(second, input)).rejects.toThrow();
    await reserveSend(first, input);
    await expect(reserveSend(second, input)).rejects.toThrow();
  }));
