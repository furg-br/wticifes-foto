import { randomUUID } from "node:crypto";
import { AppError, errorResponse } from "@/lib/app-error";
import { eventAssetPath, loadAsset, type EventAssetKind } from "@/lib/event-assets";
import { resolvePublicEvent } from "@/lib/event-repository";

export const runtime = "nodejs";

function isEventAssetKind(value: string): value is EventAssetKind {
  return value === "logo" || value === "side" || value === "favicon";
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string; kind: string }> },
) {
  const { slug, kind } = await context.params;
  try {
    const event = await resolvePublicEvent(slug);
    if (!event || !isEventAssetKind(kind)) throw new AppError("ASSET_NOT_FOUND", 404, "Ativo visual não encontrado.");
    const data = await loadAsset(eventAssetPath(event, kind));
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse(error, randomUUID());
  }
}
