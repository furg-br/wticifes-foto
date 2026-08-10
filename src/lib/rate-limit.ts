import { createHmac } from "node:crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { AppError } from "./app-error";
import { getRateLimits, getRateLimitSecret } from "./env";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

let redisClient: Redis | undefined;

export function resolveRedisCredentials(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): { url: string; token: string } | undefined {
  const url =
    environment.UPSTASH_REDIS_REST_URL?.trim() ||
    environment.KV_REST_API_URL?.trim() ||
    environment.UPSTASH_REDIS_REST_KV_REST_API_URL?.trim();
  const token =
    environment.UPSTASH_REDIS_REST_TOKEN?.trim() ||
    environment.KV_REST_API_TOKEN?.trim() ||
    environment.UPSTASH_REDIS_REST_KV_REST_API_TOKEN?.trim();

  return url && token ? { url, token } : undefined;
}

export function getRedis(): Redis {
  if (redisClient) return redisClient;
  const credentials = resolveRedisCredentials();
  if (!credentials) {
    throw new AppError("REDIS_NOT_CONFIGURED", 503, "A proteção distribuída não está configurada.");
  }
  redisClient = new Redis(credentials);
  return redisClient;
}

export function resetRedisForTests(): void {
  if (process.env.NODE_ENV === "test") redisClient = undefined;
}

export function rateLimitIdentity(headers: Headers): string {
  const forwarded = headers.get("x-vercel-forwarded-for") ?? headers.get("x-forwarded-for") ?? "unknown";
  const address = forwarded.split(",", 1)[0]?.trim() || "unknown";
  return createHmac("sha256", getRateLimitSecret()).update(`network:${address}`).digest("hex");
}

type WindowResult = Awaited<ReturnType<Ratelimit["limit"]>>;

function retryAfter(result: WindowResult): number {
  return Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
}

function limiter(redis: Redis, count: number, duration: "1 m" | "1 h" | "1 d", prefix: string) {
  return new Ratelimit({
    redis,
    limiter: Ratelimit.fixedWindow(count, duration),
    prefix: `wticifes:${prefix}`,
    analytics: true,
  });
}

export interface GenerationPermit {
  release(): Promise<void>;
  remaining: number;
}

export class DistributedAbuseProtection {
  constructor(
    private readonly redis: Redis = getRedis(),
    private readonly scope = "global",
  ) {}

  private key(kind: string, value?: string): string {
    return `wticifes:${kind}:${this.scope}${value ? `:${value}` : ""}`;
  }

  async assertNotBlocked(identityHash: string): Promise<void> {
    if (await this.redis.exists(`wticifes:blocked:${identityHash}`)) {
      const ttl = await this.redis.ttl(`wticifes:blocked:${identityHash}`);
      throw new AppError("TEMPORARILY_BLOCKED", 429, "Muitas tentativas inválidas.", {
        headers: { "Retry-After": String(Math.max(1, ttl)) },
      });
    }
  }

  async reserveUpload(identityHash: string, requestHash: string, pathname: string): Promise<void> {
    await this.assertNotBlocked(identityHash);
    const result = await limiter(
      this.redis,
      Math.max(5, getRateLimits().globalPerMinute),
      "1 m",
      "upload:minute",
    ).limit(identityHash);
    if (!result.success) {
      throw new AppError("UPLOAD_RATE_LIMITED", 429, "Muitos uploads iniciados.", {
        headers: { "Retry-After": String(retryAfter(result)) },
      });
    }
    const reserved = await this.redis.set(this.key("upload", requestHash), pathname, {
      nx: true,
      ex: 15 * 60,
    });
    if (reserved !== "OK") {
      throw new AppError("DUPLICATE_IN_PROGRESS", 409, "Este envio já foi iniciado.");
    }
  }

  async assertFeedAllowed(identityHash: string): Promise<void> {
    const result = await limiter(this.redis, 120, "1 m", `showcase:feed:${this.scope}`).limit(identityHash);
    if (!result.success) {
      throw new AppError("FEED_RATE_LIMITED", 429, "Muitas atualizações da vitrine.", {
        headers: { "Retry-After": String(retryAfter(result)) },
      });
    }
  }

  async assertUploadReservation(requestHash: string, pathname: string): Promise<void> {
    const reserved = await this.redis.get<string>(this.key("upload", requestHash));
    if (reserved !== pathname) {
      throw new AppError("UPLOAD_NOT_AUTHORIZED", 403, "O upload não está autorizado ou expirou.");
    }
  }

  async clearUploadReservation(requestHash: string): Promise<void> {
    await this.redis.del(this.key("upload", requestHash));
  }

  async enter(identityHash: string, participantHash?: string): Promise<GenerationPermit> {
    await this.assertNotBlocked(identityHash);
    const limits = getRateLimits();
    const checks = [
      limiter(this.redis, limits.globalPerMinute, "1 m", "global:minute").limit("all"),
      limiter(this.redis, limits.globalPerHour, "1 h", "global:hour").limit("all"),
      limiter(this.redis, limits.globalPerDay, "1 d", "global:day").limit("all"),
      limiter(this.redis, limits.hardDaily, "1 d", "global:hard-day").limit("all"),
    ];
    if (participantHash) {
      checks.push(
        limiter(this.redis, limits.participantPerHour, "1 h", `participant:hour:${this.scope}`).limit(participantHash),
        limiter(this.redis, limits.participantPerDay, "1 d", `participant:day:${this.scope}`).limit(participantHash),
      );
    }
    const results = await Promise.all(checks);
    const hardDailyResult = results[3];
    if (hardDailyResult) {
      const usedRatio = (hardDailyResult.limit - hardDailyResult.remaining) / hardDailyResult.limit;
      const threshold = usedRatio >= 1 ? 100 : usedRatio >= 0.9 ? 90 : usedRatio >= 0.7 ? 70 : 0;
      if (threshold) {
        console.warn(JSON.stringify({
          level: "warn",
          event: "daily_usage_threshold",
          threshold,
          remaining: hardDailyResult.remaining,
          limit: hardDailyResult.limit,
        }));
      }
    }
    const denied = results.find((result) => !result.success);
    if (denied) {
      throw new AppError("RATE_LIMITED", 429, "Limite de personalizações atingido.", {
        headers: { "Retry-After": String(retryAfter(denied)) },
      });
    }

    const concurrencyKey = "wticifes:processing:concurrent";
    const acquiredResult = await this.redis.eval(
      "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],120) end; if n>tonumber(ARGV[1]) then redis.call('DECR',KEYS[1]); return 0 end; return n",
      [concurrencyKey],
      [limits.concurrent],
    );
    const acquired = Number(acquiredResult);
    if (!acquired) {
      throw new AppError("PROCESSING_BUSY", 429, "O serviço está processando o limite simultâneo.", {
        headers: { "Retry-After": "10" },
      });
    }
    let released = false;
    return {
      remaining: Math.min(...results.map((result) => result.remaining)),
      release: async () => {
        if (released) return;
        released = true;
        await this.redis.eval(
          "local n=tonumber(redis.call('GET',KEYS[1]) or '0'); if n<=1 then redis.call('DEL',KEYS[1]); return 0 end; return redis.call('DECR',KEYS[1])",
          [concurrencyKey],
          [],
        );
      },
    };
  }

  async assertParticipantTotal(participantHash: string, persistedCount: number): Promise<void> {
    if (persistedCount >= getRateLimits().participantTotal) {
      throw new AppError("PARTICIPANT_TOTAL_LIMIT", 429, "Limite total do participante atingido.", {
        headers: { "Retry-After": "86400" },
      });
    }
  }

  async acquireLock(kind: "request" | "content" | "file" | "participant", hash: string): Promise<() => Promise<void>> {
    const key = this.key(`lock:${kind}`, hash);
    const acquired = await this.redis.set(key, "1", { nx: true, ex: 120 });
    if (acquired !== "OK") {
      throw new AppError("DUPLICATE_IN_PROGRESS", 409, "Esta fotografia já está sendo processada.", {
        headers: { "Retry-After": "10" },
      });
    }
    return async () => {
      await this.redis.del(key);
    };
  }

  async rememberDuplicate(contentHash: string, imageId: string): Promise<void> {
    await this.redis.set(this.key("content", contentHash), imageId, {
      ex: getRateLimits().duplicateWindowSeconds,
    });
  }

  async rememberIdempotency(requestHash: string, imageId: string): Promise<void> {
    await this.redis.set(this.key("idempotency", requestHash), imageId, {
      ex: getRateLimits().duplicateWindowSeconds,
    });
  }

  async idempotentImageId(requestHash: string): Promise<string | null> {
    return this.redis.get<string>(this.key("idempotency", requestHash));
  }

  async duplicateImageId(contentHash: string): Promise<string | null> {
    return this.redis.get<string>(this.key("content", contentHash));
  }

  async registerInvalid(identityHash: string): Promise<void> {
    const limits = getRateLimits();
    const key = `wticifes:invalid:${identityHash}`;
    const attempts = await this.redis.incr(key);
    if (attempts === 1) await this.redis.expire(key, limits.invalidAttemptBlockSeconds);
    if (attempts >= limits.invalidAttemptThreshold) {
      await this.redis.set(`wticifes:blocked:${identityHash}`, "1", {
        ex: limits.invalidAttemptBlockSeconds,
      });
    }
  }
}
