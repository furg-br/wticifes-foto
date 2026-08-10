import { redirect } from "next/navigation";
import { DEFAULT_EVENT_SLUG } from "@/db/schema";

export default function ShowcaseRedirect() {
  redirect(`/${DEFAULT_EVENT_SLUG}/vitrine`);
}
