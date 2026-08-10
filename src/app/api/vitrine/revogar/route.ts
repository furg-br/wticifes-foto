import { AppError, errorResponse } from "@/lib/app-error";
import { sha256 } from "@/lib/crypto-tokens";
import { markDeleted, revokeImage } from "@/lib/image-repository";
import { readJsonRequest } from "@/lib/request";
import { revokeFromShowcaseSchema } from "@/lib/schema";
import { deletePersonalizedImage } from "@/lib/storage";
import { assertPublicSameOrigin } from "@/lib/request-security";
import { safeRequestId } from "@/lib/request-id";
import { DistributedAbuseProtection, rateLimitIdentity } from "@/lib/rate-limit";
import type { EventRecord } from "@/db/schema";
import { DEFAULT_EVENT_RECORD } from "@/lib/default-event";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function handleEventRevoke(request: Request, event: EventRecord): Promise<Response> {
  const requestId = safeRequestId(request.headers);
  let identityHash: string | undefined;
  try {
    assertPublicSameOrigin(request);
    identityHash = rateLimitIdentity(request.headers);
    await new DistributedAbuseProtection(undefined, event.id).assertNotBlocked(identityHash);
    const parsed = revokeFromShowcaseSchema.safeParse(await readJsonRequest(request));
    if (!parsed.success) throw new AppError("INVALID_REQUEST", 400, "Dados de revogação inválidos.");
    const result = await revokeImage(
      event.id,
      parsed.data.image_id,
      sha256(parsed.data.revocation_token),
      requestId,
    );
    if (!result) throw new AppError("REVOCATION_TOKEN_INVALID", 403, "O token de revogação é inválido.");

    let deletionScheduled = Boolean(result.image.deletedAt);
    if (!result.image.deletedAt) {
      try {
        await deletePersonalizedImage(result.image.blobPath);
        await markDeleted(result.image.id);
        deletionScheduled = true;
      } catch {
        deletionScheduled = true;
        console.error(JSON.stringify({ level: "error", event: "blob_delete_deferred", requestId, imageId: result.image.id }));
      }
    }
    return Response.json(
      {
        success: true,
        image_id: result.image.id,
        status: "removed",
        already_removed: !result.changed,
        deletion_scheduled: deletionScheduled,
        request_id: requestId,
      },
      { headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } },
    );
  } catch (error) {
    if (identityHash && error instanceof AppError && [400, 403].includes(error.status)) {
      await new DistributedAbuseProtection(undefined, event.id).registerInvalid(identityHash).catch(() => undefined);
    }
    return errorResponse(error, requestId);
  }
}

export async function POST(request: Request): Promise<Response> {
  return handleEventRevoke(request, DEFAULT_EVENT_RECORD);
}
