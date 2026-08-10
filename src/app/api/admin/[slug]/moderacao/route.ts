import { handleEventModeration } from "@/app/api/admin/moderacao/route";

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  return handleEventModeration(request, slug);
}
