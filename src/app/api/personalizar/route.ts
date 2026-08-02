import { randomUUID } from "node:crypto";
import { AppError, errorResponse } from "@/lib/app-error";
import { personalizePhoto } from "@/lib/composer";
import {
  createImageGrant,
  deriveBoundToken,
  participantKeyHash,
  requestKeyHash,
  sha256,
} from "@/lib/crypto-tokens";
import { isGenerationEnabled } from "@/lib/env";
import {
  countParticipantImages,
  createPrivateImage,
  findActiveByContentHash,
  findByRequestKey,
  findImageById,
  isParticipantBlocked,
} from "@/lib/image-repository";
import { DistributedAbuseProtection, rateLimitIdentity } from "@/lib/rate-limit";
import { readJsonRequest } from "@/lib/request";
import { standalonePersonalizeRequestSchema } from "@/lib/schema";
import { deletePersonalizedImage, readTransientUpload, storePersonalizedImage } from "@/lib/storage";
import type { ImageRecord } from "@/db/schema";
import { getContentSafetyProvider } from "@/lib/content-safety";
import { assertPublicSameOrigin } from "@/lib/request-security";
import { safeRequestId } from "@/lib/request-id";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function canReuse(image: ImageRecord, participantHash: string | undefined, requestHash: string): boolean {
  if (image.deletedAt || image.status === "removed" || image.status === "expired") return false;
  if (image.requestKeyHash === requestHash) return true;
  return Boolean(participantHash && image.participantKeyHash === participantHash);
}

function successResponse(image: ImageRecord, request: Request, requestId: string, remaining: number) {
  const consentToken = deriveBoundToken(image.id, "consent");
  const revocationToken = deriveBoundToken(image.id, "revocation");
  const grant = createImageGrant({
    imageId: image.id,
    tokenVersion: image.tokenVersion,
    audience: "result",
    expiresAt: image.expiresAt,
  });
  return Response.json(
    {
      success: true,
      image_id: image.id,
      result_url: new URL(`/api/imagem/${grant}`, request.url).toString(),
      consent_token: consentToken,
      revocation_token: revocationToken,
      expires_at: image.expiresAt.toISOString(),
      request_id: requestId,
    },
    {
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Request-Id": requestId,
        "X-RateLimit-Remaining": String(Math.max(0, remaining)),
      },
    },
  );
}

export async function POST(request: Request): Promise<Response> {
  let requestId = safeRequestId(request.headers);
  const startedAt = Date.now();
  let identityHash: string | undefined;
  let permit: Awaited<ReturnType<DistributedAbuseProtection["enter"]>> | undefined;
  const releases: Array<() => Promise<void>> = [];
  let transientUpload: { pathname: string; requestHash: string; abuse: DistributedAbuseProtection } | undefined;

  try {
    assertPublicSameOrigin(request);
    if (!isGenerationEnabled()) {
      throw new AppError("GENERATION_DISABLED", 503, "Novas personalizações estão temporariamente desativadas.", {
        headers: { "Retry-After": "300" },
      });
    }

    const body = await readJsonRequest(request);
    const standalone = standalonePersonalizeRequestSchema.safeParse(body);
    if (!standalone.success) {
      throw new AppError("INVALID_REQUEST", 400, "Envie exatamente uma fotografia JPG, PNG ou WebP.");
    }
    const suppliedRequestId = standalone.data.request_id;
    requestId = suppliedRequestId;

    identityHash = rateLimitIdentity(request.headers);
    const suppliedParticipantToken = standalone.data.participant_token;
    const participantHash = suppliedParticipantToken
      ? participantKeyHash(suppliedParticipantToken)
      : undefined;
    const idempotencyHash = requestKeyHash(suppliedRequestId);
    const abuse = new DistributedAbuseProtection();
    permit = await abuse.enter(identityHash, participantHash);

    const cachedRequestImageId = await abuse.idempotentImageId(idempotencyHash);
    if (cachedRequestImageId) {
      const cached = await findImageById(cachedRequestImageId);
      if (cached && canReuse(cached, participantHash, idempotencyHash)) {
        return successResponse(cached, request, requestId, permit.remaining);
      }
    }
    const existingRequest = await findByRequestKey(idempotencyHash);
    if (existingRequest && canReuse(existingRequest, participantHash, idempotencyHash)) {
      return successResponse(existingRequest, request, requestId, permit.remaining);
    }

    await abuse.assertUploadReservation(idempotencyHash, standalone.data.upload_path);
    transientUpload = { pathname: standalone.data.upload_path, requestHash: idempotencyHash, abuse };
    if (participantHash) {
      releases.push(await abuse.acquireLock("participant", participantHash));
      if (await isParticipantBlocked(participantHash)) {
        throw new AppError("PARTICIPANT_BLOCKED", 403, "Este participante não pode enviar novas imagens.");
      }
      await abuse.assertParticipantTotal(participantHash, await countParticipantImages(participantHash));
    }

    releases.push(await abuse.acquireLock("request", idempotencyHash));
    const source = await readTransientUpload(standalone.data.upload_path);
    const mimeType = standalone.data.mime_type;
    if (transientUpload) {
      await deletePersonalizedImage(transientUpload.pathname);
      await transientUpload.abuse.clearUploadReservation(transientUpload.requestHash);
      transientUpload = undefined;
    }
    const contentHash = sha256(source);
    let duplicate = await findActiveByContentHash(contentHash);
    if (duplicate) {
      if (!canReuse(duplicate, participantHash, idempotencyHash)) {
        throw new AppError("DUPLICATE_NOT_REUSABLE", 409, "Esta fotografia já foi processada.");
      }
      return successResponse(duplicate, request, requestId, permit.remaining);
    }
    const recentDuplicateId = await abuse.duplicateImageId(contentHash);
    if (recentDuplicateId) {
      const recent = await findImageById(recentDuplicateId);
      if (recent && canReuse(recent, participantHash, idempotencyHash)) {
        return successResponse(recent, request, requestId, permit.remaining);
      }
      throw new AppError("DUPLICATE_WINDOW_ACTIVE", 409, "Esta fotografia foi processada recentemente.");
    }

    releases.push(await abuse.acquireLock("content", contentHash));
    duplicate = await findActiveByContentHash(contentHash);
    if (duplicate) {
      if (!canReuse(duplicate, participantHash, idempotencyHash)) {
        throw new AppError("DUPLICATE_NOT_REUSABLE", 409, "Esta fotografia já foi processada.");
      }
      return successResponse(duplicate, request, requestId, permit.remaining);
    }

    const personalized = await personalizePhoto(source, mimeType);
    const safety = await getContentSafetyProvider().assess(personalized.data);
    const stored = await storePersonalizedImage(personalized.data);
    const imageId = randomUUID();
    const consentToken = deriveBoundToken(imageId, "consent");
    const revocationToken = deriveBoundToken(imageId, "revocation");
    let image: ImageRecord;
    try {
      image = await createPrivateImage({
        id: imageId,
        blobPath: stored.pathname,
        contentHash,
        ...(participantHash ? { participantKeyHash: participantHash } : {}),
        requestKeyHash: idempotencyHash,
        expiresAt: stored.expiresAt,
        consentTokenHash: sha256(consentToken),
        consentTokenExpiresAt: new Date(Math.min(stored.expiresAt.getTime(), Date.now() + 24 * 60 * 60 * 1000)),
        revocationTokenHash: sha256(revocationToken),
        safetyPriority: safety.priority,
        safetyFlags: safety.flags,
      });
    } catch (error) {
      await deletePersonalizedImage(stored.pathname).catch(() => undefined);
      throw new AppError("DATABASE_WRITE_FAILED", 502, "Não foi possível registrar a imagem.", { cause: error });
    }
    await abuse.rememberDuplicate(contentHash, image.id);
    await abuse.rememberIdempotency(idempotencyHash, image.id);

    console.info(JSON.stringify({
      level: "info",
      event: "personalization_completed",
      requestId,
      imageId: image.id,
      durationMs: Date.now() - startedAt,
      inputKilobytes: Math.ceil(source.byteLength / 1024),
      outputKilobytes: Math.ceil(personalized.data.byteLength / 1024),
      content: contentHash.slice(0, 12),
      status: image.status,
    }));
    return successResponse(image, request, requestId, permit.remaining);
  } catch (error) {
    if (
      identityHash &&
      error instanceof AppError &&
      [400, 413, 415, 422].includes(error.status)
    ) {
      await new DistributedAbuseProtection().registerInvalid(identityHash).catch(() => undefined);
    }
    return errorResponse(error, requestId);
  } finally {
    if (transientUpload) {
      await deletePersonalizedImage(transientUpload.pathname).catch(() => undefined);
      await transientUpload.abuse.clearUploadReservation(transientUpload.requestHash).catch(() => undefined);
    }
    for (const release of releases.reverse()) await release().catch(() => undefined);
    await permit?.release().catch(() => undefined);
  }
}
