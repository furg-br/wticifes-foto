import { getPublicAppUrl } from "@/lib/env";
import { MasonryShowcase } from "./masonry-showcase";

export const dynamic = "force-dynamic";

export default function ShowcasePage() {
  return <MasonryShowcase appUrl={getPublicAppUrl() ?? "/"} />;
}
