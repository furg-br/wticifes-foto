import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rateLimitIdentity } from "./rate-limit";

beforeEach(() => vi.stubEnv("RATE_LIMIT_SECRET", "r".repeat(32)));
afterEach(() => vi.unstubAllEnvs());

describe("identidade de rede para rate limit", () => {
  it("usa HMAC e nunca devolve o IP em texto puro", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.10, 10.0.0.1" });
    const identity = rateLimitIdentity(headers);
    expect(identity).toMatch(/^[a-f0-9]{64}$/);
    expect(identity).not.toContain("203.0.113.10");
    expect(identity).toBe(rateLimitIdentity(headers));
  });
});
