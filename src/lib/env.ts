import { z } from "zod";
import { OUTPUT } from "./constants";

const ttlSchema = z.coerce
  .number()
  .int()
  .min(OUTPUT.minimumTtlHours)
  .max(OUTPUT.maximumTtlHours)
  .default(OUTPUT.defaultTtlHours);

export function getCronSecret(): string | undefined {
  const value = process.env.CRON_SECRET?.trim();
  return value === "" ? undefined : value;
}

export function getDownloadSigningSecret(): string | undefined {
  const value = process.env.DOWNLOAD_SIGNING_SECRET?.trim();
  return value === "" ? undefined : value;
}

export function getBlobTtlHours(): number {
  const result = ttlSchema.safeParse(process.env.BLOB_TTL_HOURS);
  return result.success ? result.data : OUTPUT.defaultTtlHours;
}

function integerEnv(name: string, fallback: number, minimum = 1, maximum = 1_000_000): number {
  const value = z.coerce.number().int().min(minimum).max(maximum).safeParse(process.env[name]);
  return value.success ? value.data : fallback;
}

function requiredSecret(name: string, minimumLength = 32): string {
  const value = process.env[name]?.trim();
  if (!value || value.length < minimumLength) {
    throw new Error(`${name} deve ter pelo menos ${minimumLength} caracteres.`);
  }
  return value;
}

export function getRateLimitSecret(): string {
  return requiredSecret("RATE_LIMIT_SECRET");
}

export function getAdminAuditSecret(): string {
  return process.env.ADMIN_AUDIT_SECRET?.trim() || getRateLimitSecret();
}

export function isGenerationEnabled(): boolean {
  return (process.env.GENERATION_ENABLED ?? "true").trim().toLowerCase() === "true";
}

export function getPublicAppUrl(): string | undefined {
  const parsed = z.url().safeParse(process.env.NEXT_PUBLIC_APP_URL?.trim());
  if (!parsed.success) return undefined;
  const url = new URL(parsed.data);
  return url.protocol === "https:" ? url.origin : undefined;
}

export function getAdminAllowlist(): ReadonlySet<string> {
  return new Set(
    (process.env.ADMIN_EMAIL_ALLOWLIST ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter((email) => z.email().safeParse(email).success),
  );
}

export function isAdminAuthConfigured(): boolean {
  return Boolean(
    (process.env.AUTH_SECRET?.trim().length ?? 0) >= 32 &&
      process.env.AUTH_GITHUB_ID?.trim() &&
      process.env.AUTH_GITHUB_SECRET?.trim() &&
      getAdminAllowlist().size > 0,
  );
}

export function getRateLimits() {
  return {
    globalPerMinute: integerEnv("GLOBAL_MAX_PER_MINUTE", 20),
    globalPerHour: integerEnv("GLOBAL_MAX_PER_HOUR", 200),
    globalPerDay: integerEnv("GLOBAL_MAX_PER_DAY", 1000),
    hardDaily: integerEnv("HARD_DAILY_LIMIT", 1000),
    participantPerHour: integerEnv("PARTICIPANT_MAX_PER_HOUR", 2),
    participantPerDay: integerEnv("PARTICIPANT_MAX_PER_DAY", 3),
    participantTotal: integerEnv("PARTICIPANT_MAX_TOTAL", 10),
    concurrent: integerEnv("MAX_CONCURRENT_PROCESSING", 5, 1, 100),
    duplicateWindowSeconds: integerEnv("DUPLICATE_WINDOW_SECONDS", 86_400),
    invalidAttemptBlockSeconds: integerEnv("INVALID_ATTEMPT_BLOCK_SECONDS", 1_800),
    invalidAttemptThreshold: integerEnv("INVALID_ATTEMPT_THRESHOLD", 5, 1, 100),
  } as const;
}

export function getRetention() {
  return {
    privateHours: integerEnv("PRIVATE_RETENTION_HOURS", 24, 1, 168),
    pendingHours: integerEnv("PENDING_REVIEW_RETENTION_HOURS", 72, 1, 720),
    rejectedHours: integerEnv("REJECTED_RETENTION_HOURS", 1, 0, 168),
    approvedDays: integerEnv("APPROVED_RETENTION_DAYS", 30, 1, 365),
  } as const;
}

export function getShowcaseSettings() {
  return {
    intervalSeconds: integerEnv("SHOWCASE_INTERVAL_SECONDS", 10, 3, 300),
    feedLimit: integerEnv("SHOWCASE_FEED_LIMIT", 20, 1, 100),
  } as const;
}
