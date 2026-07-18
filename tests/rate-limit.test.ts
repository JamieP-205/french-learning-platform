import { describe, expect, it } from "vitest";
import { MockLearningRepository } from "../lib/data/mock-repository";

describe("API quotas", () => {
  it("allows work up to the limit and then rejects the same action", async () => {
    const repository = new MockLearningRepository();
    const userId = `quota-${Date.now()}`;

    expect(await repository.consumeRateLimit(userId, "test-action", { limit: 2, windowSeconds: 60 })).toBe(true);
    expect(await repository.consumeRateLimit(userId, "test-action", { limit: 2, windowSeconds: 60 })).toBe(true);
    expect(await repository.consumeRateLimit(userId, "test-action", { limit: 2, windowSeconds: 60 })).toBe(false);
    expect(await repository.consumeRateLimit(userId, "different-action", { limit: 2, windowSeconds: 60 })).toBe(true);
  });

  it("does not charge an idempotent retry twice", async () => {
    const repository = new MockLearningRepository();
    const userId = `quota-retry-${Date.now()}`;
    const requestId = crypto.randomUUID();

    expect(
      await repository.consumeRateLimit(
        userId,
        "idempotent-action",
        { limit: 1, windowSeconds: 60 },
        requestId,
      ),
    ).toBe(true);
    expect(
      await repository.consumeRateLimit(
        userId,
        "idempotent-action",
        { limit: 1, windowSeconds: 60 },
        requestId,
      ),
    ).toBe(true);
    expect(
      await repository.consumeRateLimit(
        userId,
        "idempotent-action",
        { limit: 1, windowSeconds: 60 },
        crypto.randomUUID(),
      ),
    ).toBe(false);
  });
});
