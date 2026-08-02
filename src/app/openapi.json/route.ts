import { createOpenApiDocument } from "@/lib/openapi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request): Response {
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL;
  let origin = new URL(request.url).origin;
  if (configuredOrigin) {
    try {
      const url = new URL(configuredOrigin);
      if (url.protocol === "https:") origin = url.origin;
    } catch {
      // Uma variável inválida não deve quebrar a publicação do schema.
    }
  }

  return Response.json(createOpenApiDocument(origin), {
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "Access-Control-Allow-Origin": "*",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
