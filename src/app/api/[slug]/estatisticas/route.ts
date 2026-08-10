import { randomUUID } from "node:crypto";
import { handleEventStatistics } from "@/app/api/estatisticas/route";
import { AppError, errorResponse } from "@/lib/app-error";
import { resolvePublicEvent } from "@/lib/event-repository";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const event = await resolvePublicEvent(slug);
  if (!event) return errorResponse(new AppError("EVENT_NOT_FOUND", 404, "Espaço não encontrado."), randomUUID());
  return handleEventStatistics(event);
}
