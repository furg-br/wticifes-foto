export const INPUT_LIMITS = {
  requestBytes: 16 * 1024,
  downloadBytes: 12 * 1024 * 1024,
  inputPixels: 40_000_000,
  minimumDimension: 96,
  outputWidth: 2400,
  outputHeight: 4000,
  redirects: 2,
  downloadTimeoutMs: 15_000,
} as const;

export const OUTPUT = {
  jpegQuality: 90,
  functionSafeBytes: 4 * 1024 * 1024,
  blobPrefix: "personalizadas/",
  defaultTtlHours: 24,
  minimumTtlHours: 1,
  maximumTtlHours: 168,
} as const;

export const CONSENT_VERSION = "2026-08-01" as const;

export const TOKEN_TTL = {
  consentHours: 24,
  publicMinutes: 5,
  moderationMinutes: 5,
} as const;

export const IMAGE_STATUSES = [
  "private",
  "pending_review",
  "approved",
  "rejected",
  "removed",
  "expired",
] as const;

export type ImageStatus = (typeof IMAGE_STATUSES)[number];

export const SUPPORTED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
] as const;
