import { AppError, errorResponse } from "@/lib/app-error";
import { CONSENT_VERSION } from "@/lib/constants";
import { sha256 } from "@/lib/crypto-tokens";
import { findImageById, submitConsent } from "@/lib/image-repository";
import { readJsonRequest } from "@/lib/request";
import { submitToShowcaseSchema } from "@/lib/schema";
import { assertPublicSameOrigin } from "@/lib/request-security";
import { safeRequestId } from "@/lib/request-id";
import { DistributedAbuseProtection, rateLimitIdentity } from "@/lib/rate-limit";
import type { EventRecord } from "@/db/schema";
import { DEFAULT_EVENT_RECORD } from "@/lib/default-event";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function handleEventSubmit(request: Request, event: EventRecord): Promise<Response> {
  const requestId = safeRequestId(request.headers);
  let identityHash: string | undefined;
  try {
    assertPublicSameOrigin(request);
    identityHash = rateLimitIdentity(request.headers);
    await new DistributedAbuseProtection(undefined, event.id).assertNotBlocked(identityHash);
    const parsed = submitToShowcaseSchema.safeParse(await readJsonRequest(request));
    if (!parsed.success) throw new AppError("INVALID_REQUEST", 400, "Dados de consentimento inválidos.");
    const tokenHash = sha256(parsed.data.consent_token);
    const result = await submitConsent(event.id, parsed.data.image_id, tokenHash, CONSENT_VERSION);
    if (!result) {
      const image = await findImageById(parsed.data.image_id, event.id);
      if (image?.consentTokenExpiresAt && image.consentTokenExpiresAt <= new Date()) {
        throw new AppError("CONSENT_TOKEN_EXPIRED", 410, "O token de consentimento expirou.");
      }
      throw new AppError("CONSENT_TOKEN_INVALID", 403, "O token de consentimento é inválido.");
    }
    return Response.json(
      {
        success: true,
        image_id: result.image.id,
        status: result.image.status,
        already_submitted: !result.changed,
        message: "Consentimento registrado. A publicação depende de revisão humana.",
        request_id: requestId,
      },
      { headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } },
    );
  } catch (error) {
    if (identityHash && error instanceof AppError && [400, 403, 410].includes(error.status)) {
      await new DistributedAbuseProtection(undefined, event.id).registerInvalid(identityHash).catch(() => undefined);
    }
    return errorResponse(error, requestId);
  }
}

export async function POST(request: Request): Promise<Response> {
  return handleEventSubmit(request, DEFAULT_EVENT_RECORD);
}
