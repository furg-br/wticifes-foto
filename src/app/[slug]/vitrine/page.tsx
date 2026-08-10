import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicAppUrl } from "@/lib/env";
import { resolvePublicEvent } from "@/lib/event-repository";
import { MasonryShowcase } from "@/app/vitrine/masonry-showcase";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const event = await resolvePublicEvent(slug);
  const favicon = event ? `/api/${event.slug}/asset/favicon?v=${event.configVersion}` : undefined;
  return {
    title: event ? `Vitrine — ${event.name}` : "Vitrine",
    icons: favicon ? { icon: [{ url: favicon, type: "image/png" }], shortcut: [favicon] } : undefined,
  };
}

export default async function ShowcasePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await resolvePublicEvent(slug);
  if (!event) notFound();
  const origin = getPublicAppUrl() ?? "";
  return (
    <MasonryShowcase
      appUrl={`${origin}/${event.slug}`}
      slug={event.slug}
      name={event.showcaseTitle}
      emptyText={event.showcaseEmptyText}
    />
  );
}
