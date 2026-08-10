import { randomUUID } from "node:crypto";
import { handleEventFeed } from "@/app/api/vitrine/feed/route";
import { AppError, errorResponse } from "@/lib/app-error";
import { resolvePublicEvent } from "@/lib/event-repository";

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const event = await resolvePublicEvent(slug);
  if (!event) return errorResponse(new AppError("EVENT_NOT_FOUND", 404, "Espaço não encontrado."), randomUUID());
  return handleEventFeed(request, event);
}
