import { randomUUID } from "node:crypto";
import { handleEventSubmit } from "@/app/api/vitrine/submeter/route";
import { AppError, errorResponse } from "@/lib/app-error";
import { resolvePublicEvent } from "@/lib/event-repository";

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const event = await resolvePublicEvent(slug);
  if (!event) return errorResponse(new AppError("EVENT_NOT_FOUND", 404, "Espaço não encontrado."), randomUUID());
  return handleEventSubmit(request, event);
}
