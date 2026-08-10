import { randomUUID } from "node:crypto";
import { handleEventPersonalize } from "@/app/api/personalizar/route";
import { AppError, errorResponse } from "@/lib/app-error";
import { resolvePublicEvent } from "@/lib/event-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const event = await resolvePublicEvent(slug);
  if (!event) return errorResponse(new AppError("EVENT_NOT_FOUND", 404, "Espaço não encontrado."), randomUUID());
  return handleEventPersonalize(request, event);
}
