import { randomUUID } from "node:crypto";
import { AppError, errorResponse } from "@/lib/app-error";
import { getPublicUsageStatistics } from "@/lib/image-repository";
import type { EventRecord } from "@/db/schema";
import { DEFAULT_EVENT_RECORD } from "@/lib/default-event";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10;

export async function handleEventStatistics(event: EventRecord): Promise<Response> {
  const requestId = randomUUID();

  try {
    const statistics = await getPublicUsageStatistics(event.id);
    return Response.json(
      {
        total_personalizations: statistics.totalPersonalizations,
        unique_participants: statistics.uniqueParticipants,
        today_personalizations: statistics.todayPersonalizations,
        showcase_photos: statistics.showcasePhotos,
        updated_at: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300",
          "X-Content-Type-Options": "nosniff",
          "X-Request-Id": requestId,
        },
      },
    );
  } catch (error) {
    return errorResponse(
      new AppError("STATISTICS_UNAVAILABLE", 503, "As estatísticas estão temporariamente indisponíveis.", {
        cause: error,
      }),
      requestId,
    );
  }
}

export async function GET(): Promise<Response> {
  return handleEventStatistics(DEFAULT_EVENT_RECORD);
}
