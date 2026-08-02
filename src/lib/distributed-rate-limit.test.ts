import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const controls = vi.hoisted(() => ({ results: [] as Array<Record<string, unknown>>, calls: 0 }));
vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class {
    static fixedWindow(limit: number) { return { limit }; }
    async limit() {
      controls.calls += 1;
      return controls.results.shift() ?? { success: true, limit: 20, remaining: 19, reset: Date.now() + 60_000 };
    }
  },
}));

import { DistributedAbuseProtection } from "./rate-limit";

function fakeRedis() {
  return {
    exists: vi.fn().mockResolvedValue(0),
    ttl: vi.fn().mockResolvedValue(60),
    eval: vi.fn().mockResolvedValue(1),
    set: vi.fn().mockResolvedValue("OK"),
    get: vi.fn().mockResolvedValue(null),
    del: vi.fn().mockResolvedValue(1),
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
  };
}

beforeEach(() => {
  vi.stubEnv("RATE_LIMIT_SECRET", "r".repeat(32));
  controls.results.length = 0;
  controls.calls = 0;
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("proteção distribuída", () => {
  it("aplica limites globais e Retry-After", async () => {
    controls.results.push({ success: false, limit: 20, remaining: 0, reset: Date.now() + 30_000 });
    const redis = fakeRedis();
    await expect(new DistributedAbuseProtection(redis as never).enter("network")).rejects.toMatchObject({
      code: "RATE_LIMITED",
      status: 429,
    });
    expect(redis.eval).not.toHaveBeenCalled();
  });

  it("nega acima da concorrência e libera permit uma única vez", async () => {
    const redis = fakeRedis();
    redis.eval.mockResolvedValueOnce(0);
    await expect(new DistributedAbuseProtection(redis as never).enter("network")).rejects.toMatchObject({
      code: "PROCESSING_BUSY",
      status: 429,
    });

    const redisAllowed = fakeRedis();
    const callsBeforeParticipant = controls.calls;
    const permit = await new DistributedAbuseProtection(redisAllowed as never).enter("network", "participant");
    expect(controls.calls - callsBeforeParticipant).toBe(6);
    await permit.release();
    await permit.release();
    expect(redisAllowed.eval).toHaveBeenCalledTimes(2);
  });

  it("ativa cooldown após arquivos inválidos repetidos", async () => {
    const redis = fakeRedis();
    redis.incr.mockResolvedValue(5);
    await new DistributedAbuseProtection(redis as never).registerInvalid("network");
    expect(redis.set).toHaveBeenCalledWith(
      "wticifes:blocked:network",
      "1",
      expect.objectContaining({ ex: 1800 }),
    );
  });
});
