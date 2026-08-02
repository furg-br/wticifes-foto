import { getShowcaseSettings } from "@/lib/env";
import { Slideshow } from "./slideshow";

export const dynamic = "force-dynamic";

export default function ShowcasePage() {
  return <Slideshow intervalSeconds={getShowcaseSettings().intervalSeconds} />;
}
