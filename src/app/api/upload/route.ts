import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import type { EventRecord } from "@/db/schema";
import { AppError, errorResponse } from "@/lib/app-error";
import { INPUT_LIMITS, SUPPORTED_IMAGE_MIME_TYPES } from "@/lib/constants";
import { isGenerationEnabled } from "@/lib/env";
import { requestKeyHash } from "@/lib/crypto-tokens";
import { DistributedAbuseProtection, rateLimitIdentity } from "@/lib/rate-limit";
import { uploadClientPayloadSchema } from "@/lib/schema";
import { randomUUID } from "node:crypto";
import { assertPublicSameOrigin } from "@/lib/request-security";
import { DEFAULT_EVENT_RECORD } from "@/lib/default-event";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function handleEventUpload(request: Request, event: EventRecord): Promise<Response> {
  const requestId = randomUUID();
  try {
    if (!isGenerationEnabled()) throw new AppError("GENERATION_DISABLED", 503, "Novas personalizações estão temporariamente desativadas.");
    const body = (await request.json()) as HandleUploadBody;
    const identityHash = rateLimitIdentity(request.headers);
    const abuse = new DistributedAbuseProtection(undefined, event.id);
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        assertPublicSameOrigin(request);
        const expected = new RegExp(`^incoming/${event.slug}/[0-9a-f-]{36}\\.(?:jpg|jpeg|png|webp)$`, "i");
        if (!expected.test(pathname)) {
          throw new AppError("INVALID_UPLOAD_PATH", 400, "Caminho de upload inválido.");
        }
        let payload: unknown;
        try { payload = JSON.parse(clientPayload ?? "null") as unknown; } catch { payload = null; }
        const parsed = uploadClientPayloadSchema.safeParse(payload);
        if (!parsed.success) throw new AppError("INVALID_REQUEST", 400, "Identificador de upload inválido.");
        await abuse.reserveUpload(
          identityHash,
          requestKeyHash(parsed.data.request_id, event.id),
          pathname,
        );
        return {
          allowedContentTypes: [...SUPPORTED_IMAGE_MIME_TYPES],
          maximumSizeInBytes: INPUT_LIMITS.downloadBytes,
          addRandomSuffix: false,
          allowOverwrite: false,
          validUntil: Date.now() + 10 * 60 * 1000,
          tokenPayload: JSON.stringify({ request_id: parsed.data.request_id, event_id: event.id }),
        };
      },
      onUploadCompleted: async () => {
        console.info(JSON.stringify({ level: "info", event: "transient_upload_completed", requestId, eventId: event.id }));
      },
    });
    return Response.json(result, { headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

export async function POST(request: Request): Promise<Response> {
  return handleEventUpload(request, DEFAULT_EVENT_RECORD);
}
