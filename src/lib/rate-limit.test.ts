import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rateLimitIdentity, resolveRedisCredentials } from "./rate-limit";

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

describe("credenciais do Redis", () => {
  it("aceita os nomes gerados pela integração nativa da Vercel", () => {
    expect(resolveRedisCredentials({
      UPSTASH_REDIS_REST_KV_REST_API_URL: "https://redis.example",
      UPSTASH_REDIS_REST_KV_REST_API_TOKEN: "token-de-teste",
    })).toEqual({ url: "https://redis.example", token: "token-de-teste" });
  });

  it("prioriza os nomes oficiais da SDK", () => {
    expect(resolveRedisCredentials({
      UPSTASH_REDIS_REST_URL: "https://oficial.example",
      UPSTASH_REDIS_REST_TOKEN: "token-oficial",
      UPSTASH_REDIS_REST_KV_REST_API_URL: "https://integracao.example",
      UPSTASH_REDIS_REST_KV_REST_API_TOKEN: "token-integracao",
    })).toEqual({ url: "https://oficial.example", token: "token-oficial" });
  });
});
