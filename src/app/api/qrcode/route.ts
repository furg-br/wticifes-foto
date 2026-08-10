import QRCode from "qrcode";
import type { EventRecord } from "@/db/schema";
import { getPublicAppUrl } from "@/lib/env";
import { DEFAULT_EVENT_RECORD } from "@/lib/default-event";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function handleEventQrCode(request: Request, event: EventRecord): Promise<Response> {
  const origin = getPublicAppUrl() ?? new URL(request.url).origin;
  const eventUrl = new URL(`/${event.slug}`, origin).toString();
  const png = await QRCode.toBuffer(eventUrl, {
    type: "png",
    errorCorrectionLevel: "H",
    margin: 2,
    width: 512,
    color: { dark: "#0B0D0D", light: "#FFFFFFFF" },
  });
  return new Response(new Uint8Array(png), {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
      "Content-Type": "image/png",
      "Content-Disposition": `inline; filename="${event.slug}-qrcode.png"`,
      "X-Content-Type-Options": "nosniff",
      Vary: "Host",
    },
  });
}

export async function GET(request: Request): Promise<Response> {
  return handleEventQrCode(request, DEFAULT_EVENT_RECORD);
}
