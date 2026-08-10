export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(): Response {
  return Response.json(
    { status: "ok", service: "wticifes-foto", version: "3.0.0" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
