import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { AppError } from "./app-error";
import { getAdminAuditSecret, getDownloadSigningSecret, getRateLimitSecret } from "./env";

export function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export function generateOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

export function deriveBoundToken(
  imageId: string,
  purpose: "consent" | "revocation",
  eventId?: string,
): string {
  return createHmac("sha256", getRateLimitSecret())
    .update(`wticifes:${purpose}:${eventId ? "v2" : "v1"}:${eventId ? `${eventId}:` : ""}${imageId}`, "utf8")
    .digest("base64url");
}

export function participantKeyHash(token: string, eventId?: string): string {
  return createHmac("sha256", getRateLimitSecret())
    .update(`${eventId ? `event:${eventId}:` : ""}${token}`, "utf8")
    .digest("hex");
}

export function requestKeyHash(value: string, eventId?: string): string {
  return createHmac("sha256", getRateLimitSecret())
    .update(`request:${eventId ? `${eventId}:` : ""}${value}`, "utf8")
    .digest("hex");
}

export function moderatorIdentifier(email: string): string {
  return createHmac("sha256", getAdminAuditSecret())
    .update(email.trim().toLowerCase(), "utf8")
    .digest("hex");
}

function downloadSecret(): string {
  const secret = getDownloadSigningSecret();
  if (!secret || secret.length < 32) {
    throw new AppError("SERVICE_NOT_CONFIGURED", 503, "O serviço de download não está configurado.");
  }
  return secret;
}

export type DownloadAudience = "result" | "public" | "moderation";

export interface DownloadGrant {
  imageId: string;
  eventId?: string;
  tokenVersion: number;
  audience: DownloadAudience;
  expiresAtEpoch: number;
}

export function shortGrantExpiry(minutes: number): Date {
  return new Date(Date.now() + minutes * 60_000);
}

function grantSignature(encoded: string): string {
  return createHmac("sha256", downloadSecret()).update(encoded).digest("base64url");
}

export function createImageGrant(grant: Omit<DownloadGrant, "expiresAtEpoch"> & { expiresAt: Date }): string {
  const payload = {
    i: grant.imageId,
    ...(grant.eventId ? { t: grant.eventId } : {}),
    v: grant.tokenVersion,
    a: grant.audience,
    e: Math.floor(grant.expiresAt.getTime() / 1000),
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${grantSignature(encoded)}`;
}

export function verifyImageGrant(token: string, now = new Date()): DownloadGrant {
  const parts = token.split(".");
  if (parts.length !== 2 || parts.some((part) => !/^[A-Za-z0-9_-]+$/.test(part))) {
    throw new AppError("INVALID_DOWNLOAD", 404, "Este link de download é inválido.");
  }
  const [encoded = "", received = ""] = parts;
  const expected = grantSignature(encoded);
  const receivedBytes = Buffer.from(received);
  const expectedBytes = Buffer.from(expected);
  if (receivedBytes.length !== expectedBytes.length || !timingSafeEqual(receivedBytes, expectedBytes)) {
    throw new AppError("INVALID_DOWNLOAD", 404, "Este link de download é inválido.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as unknown;
  } catch {
    throw new AppError("INVALID_DOWNLOAD", 404, "Este link de download é inválido.");
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("i" in parsed) ||
    !("v" in parsed) ||
    !("a" in parsed) ||
    !("e" in parsed) ||
    typeof parsed.i !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(parsed.i) ||
    ("t" in parsed && (typeof parsed.t !== "string" || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(parsed.t))) ||
    typeof parsed.v !== "number" ||
    !Number.isSafeInteger(parsed.v) ||
    parsed.v < 1 ||
    !["result", "public", "moderation"].includes(String(parsed.a)) ||
    typeof parsed.e !== "number" ||
    !Number.isSafeInteger(parsed.e)
  ) {
    throw new AppError("INVALID_DOWNLOAD", 404, "Este link de download é inválido.");
  }
  if (parsed.e <= Math.floor(now.getTime() / 1000)) {
    throw new AppError("DOWNLOAD_EXPIRED", 410, "Este link de download expirou.");
  }
  const eventId = "t" in parsed && typeof parsed.t === "string" ? parsed.t : undefined;
  return {
    imageId: parsed.i,
    ...(eventId ? { eventId } : {}),
    tokenVersion: parsed.v,
    audience: parsed.a as DownloadAudience,
    expiresAtEpoch: parsed.e,
  };
}
