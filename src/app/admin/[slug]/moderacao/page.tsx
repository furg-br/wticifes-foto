import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminCsrfToken, requireEventAdmin } from "@/lib/admin-auth";
import { createImageGrant, shortGrantExpiry } from "@/lib/crypto-tokens";
import { listModeration, queueStats } from "@/lib/image-repository";
import { TOKEN_TTL, type ImageStatus } from "@/lib/constants";
import { ModerationControls } from "@/app/admin/moderation-controls";
import { AdminEventNav } from "../admin-event-nav";

export const dynamic = "force-dynamic";

const tabs: Array<{ status: ImageStatus; label: string }> = [
  { status: "pending_review", label: "Aguardando análise" },
  { status: "approved", label: "Aprovadas" },
  { status: "rejected", label: "Rejeitadas" },
  { status: "removed", label: "Removidas" },
];

export default async function ModerationPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { slug } = await params;
  let access;
  try { access = await requireEventAdmin(slug); } catch { redirect("/admin"); }
  const requested = (await searchParams).status;
  const status = tabs.some((tab) => tab.status === requested) ? requested as ImageStatus : "pending_review";
  const [records, stats] = await Promise.all([
    listModeration(access.event.id, status),
    queueStats(access.event.id),
  ]);
  const csrfToken = createAdminCsrfToken(access.admin.email);
  const expiresAt = shortGrantExpiry(TOKEN_TTL.moderationMinutes);
  return (
    <main className="admin-main">
      <section className="admin-shell">
        <header className="admin-header">
          <div><p className="eyebrow">{access.event.name}</p><h1>Moderação</h1></div>
          <Link href="/admin">Todos os espaços</Link>
        </header>
        <AdminEventNav slug={slug} isSuperAdmin={access.admin.isSuperAdmin} />
        <p className="queue-summary">{stats.pending} aguardando análise; {stats.nearExpiry} perto de expirar.</p>
        <nav className="admin-tabs" aria-label="Estados de moderação">
          {tabs.map((tab) => <Link key={tab.status} aria-current={status === tab.status ? "page" : undefined} href={`/admin/${slug}/moderacao?status=${tab.status}`}>{tab.label}</Link>)}
        </nav>
        {records.length === 0 ? <p className="admin-empty">Nenhuma imagem nesta fila.</p> : (
          <div className="moderation-grid">
            {records.map((image) => {
              const token = createImageGrant({ imageId: image.id, eventId: access.event.id, tokenVersion: image.tokenVersion, audience: "moderation", expiresAt });
              return (
                <article className="moderation-card" key={image.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/imagem/${token}`} alt="Imagem aguardando decisão de moderação" />
                  <dl><div><dt>Envio</dt><dd>{(image.submittedAt ?? image.createdAt).toLocaleString("pt-BR")}</dd></div><div><dt>Versão visual</dt><dd>{image.eventConfigVersion}</dd></div></dl>
                  <ModerationControls slug={slug} imageId={image.id} csrfToken={csrfToken} status={image.status} canBlock={Boolean(image.participantKeyHash)} />
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
