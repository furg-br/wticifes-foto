import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PhotoPersonalizer } from "@/app/photo-personalizer";
import { UsageStatistics } from "@/app/usage-statistics";
import { resolvePublicEvent } from "@/lib/event-repository";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const event = await resolvePublicEvent(slug);
  const favicon = event ? `/api/${event.slug}/asset/favicon?v=${event.configVersion}` : undefined;
  return event
    ? {
        title: `${event.pageTitle} — ${event.name}`,
        description: event.pageSubtitle,
        icons: favicon ? { icon: [{ url: favicon, type: "image/png" }], shortcut: [favicon] } : undefined,
      }
    : { title: "Página não encontrada" };
}

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await resolvePublicEvent(slug);
  if (!event) notFound();
  return (
    <main>
      <section className="hero" aria-labelledby="titulo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="logo" src={`/api/${event.slug}/asset/logo`} alt={event.name} />
        <h1 id="titulo" className="event-title">{event.pageTitle}</h1>
        <p className="event-subtitle">{event.pageSubtitle}</p>
        <PhotoPersonalizer
          slug={event.slug}
          name={event.name}
          uploadTitle={event.uploadTitle}
          uploadLabel={event.uploadLabel}
          submitLabel={event.submitLabel}
          consentText={event.consentText}
          successMessage={event.successMessage}
        />
        <UsageStatistics slug={event.slug} name={event.name} />
        <nav aria-label="Navegação">
          <Link href={`/${event.slug}/vitrine`}>Vitrine pública</Link>
          <Link href="/privacidade">Privacidade</Link>
          <Link href="/termos">Termos de uso</Link>
        </nav>
      </section>
    </main>
  );
}
