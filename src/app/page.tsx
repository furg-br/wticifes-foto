import { redirect } from "next/navigation";
import { DEFAULT_EVENT_SLUG } from "@/db/schema";

export default function Home() {
  redirect(`/${DEFAULT_EVENT_SLUG}`);
}
