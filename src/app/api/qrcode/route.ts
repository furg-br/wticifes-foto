import QRCode from "qrcode";
import { getPublicAppUrl } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const appUrl = getPublicAppUrl() ?? new URL(request.url).origin;
  const png = await QRCode.toBuffer(appUrl, {
    type: "png",
    errorCorrectionLevel: "H",
    margin: 2,
    width: 512,
    color: {
      dark: "#0B0D0D",
      light: "#FFFFFFFF",
    },
  });

  return new Response(new Uint8Array(png), {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
      "Content-Type": "image/png",
      "Content-Disposition": 'inline; filename="wticifes-foto-qrcode.png"',
      "X-Content-Type-Options": "nosniff",
      Vary: "Host",
    },
  });
}
