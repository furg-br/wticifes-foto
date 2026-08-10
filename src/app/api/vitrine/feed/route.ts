import { randomUUID } from "node:crypto";
import { errorResponse } from "@/lib/app-error";
import { createImageGrant } from "@/lib/crypto-tokens";
import { getShowcaseSettings } from "@/lib/env";
import { listShowcaseCandidates, markShowcaseDisplayed } from "@/lib/image-repository";
import { TOKEN_TTL } from "@/lib/constants";
import { DistributedAbuseProtection, rateLimitIdentity } from "@/lib/rate-limit";
import type { EventRecord } from "@/db/schema";
import { DEFAULT_EVENT_RECORD } from "@/lib/default-event";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function handleEventFeed(request: Request, event: EventRecord): Promise<Response> {
  const requestId = randomUUID();
  try {
    await new DistributedAbuseProtection(undefined, event.id).assertFeedAllowed(rateLimitIdentity(request.headers));
    const now = new Date();
    const records = await listShowcaseCandidates(event.id, now, getShowcaseSettings().feedLimit);
    const images = records.map((image) => {
      const expiresAt = new Date(
        Math.min(
          now.getTime() + TOKEN_TTL.publicMinutes * 60_000,
          image.publicationExpiresAt?.getTime() ?? now.getTime(),
        ),
      );
      const grant = createImageGrant({
        imageId: image.id,
        eventId: event.id,
        tokenVersion: image.tokenVersion,
        audience: "public",
        expiresAt,
      });
      return { url: new URL(`/api/imagem/${grant}`, request.url).toString(), expires_at: expiresAt.toISOString() };
    });
    await markShowcaseDisplayed(event.id, records.map((image) => image.id));
    return Response.json(
      { images },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
          "X-Content-Type-Options": "nosniff",
          "X-Request-Id": requestId,
        },
      },
    );
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

export async function GET(request: Request): Promise<Response> {
  return handleEventFeed(request, DEFAULT_EVENT_RECORD);
}
