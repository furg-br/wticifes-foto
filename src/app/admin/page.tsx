import Link from "next/link";
import { redirect } from "next/navigation";
import { AppError } from "@/lib/app-error";
import { createAdminCsrfToken, requireAdmin } from "@/lib/admin-auth";
import { createImageGrant, shortGrantExpiry } from "@/lib/crypto-tokens";
import { listModeration, queueStats } from "@/lib/image-repository";
import { TOKEN_TTL, type ImageStatus } from "@/lib/constants";
import { ModerationControls } from "./moderation-controls";

export const dynamic = "force-dynamic";

const tabs: Array<{ status: ImageStatus; label: string }> = [
  { status: "pending_review", label: "Aguardando análise" },
  { status: "approved", label: "Aprovadas" },
  { status: "rejected", label: "Rejeitadas" },
  { status: "removed", label: "Removidas" },
];

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  let admin: { email: string };
  try {
    admin = await requireAdmin();
  } catch (error) {
    if (error instanceof AppError && error.code === "ADMIN_AUTH_NOT_CONFIGURED") {
      return <main><section className="admin-shell"><h1>Painel indisponível</h1><p>A autenticação administrativa não está configurada. O acesso permanece bloqueado.</p></section></main>;
    }
    redirect("/api/auth/signin?callbackUrl=/admin");
  }
  const requested = (await searchParams).status;
  const status = tabs.some((tab) => tab.status === requested) ? (requested as ImageStatus) : "pending_review";
  const [records, stats] = await Promise.all([listModeration(status), queueStats()]);
  console.info(JSON.stringify({ level: "info", event: "moderation_queue_metrics", ...stats }));
  const csrfToken = createAdminCsrfToken(admin.email);
  const expiresAt = shortGrantExpiry(TOKEN_TTL.moderationMinutes);

  return (
    <main className="admin-main">
      <section className="admin-shell" aria-labelledby="admin-title">
        <header className="admin-header">
          <div><p className="eyebrow">WTICIFES 2026</p><h1 id="admin-title">Moderação</h1></div>
          <Link href="/api/auth/signout">Sair</Link>
        </header>
        <p className="queue-summary">{stats.pending} aguardando análise; {stats.nearExpiry} perto de expirar.</p>
        <nav className="admin-tabs" aria-label="Estados de moderação">
          {tabs.map((tab) => <Link key={tab.status} aria-current={status === tab.status ? "page" : undefined} href={`/admin?status=${tab.status}`}>{tab.label}</Link>)}
        </nav>
        {records.length === 0 ? <p className="admin-empty">Nenhuma imagem nesta fila.</p> : (
          <div className="moderation-grid">
            {records.map((image) => {
              const token = createImageGrant({ imageId: image.id, tokenVersion: image.tokenVersion, audience: "moderation", expiresAt });
              return (
                <article className="moderation-card" key={image.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/imagem/${token}`} alt="Imagem aguardando decisão de moderação" />
                  <dl><div><dt>Envio</dt><dd>{(image.submittedAt ?? image.createdAt).toLocaleString("pt-BR")}</dd></div><div><dt>Expiração</dt><dd>{(image.publicationExpiresAt ?? image.expiresAt).toLocaleString("pt-BR")}</dd></div></dl>
                  <ModerationControls imageId={image.id} csrfToken={csrfToken} status={image.status} canBlock={Boolean(image.participantKeyHash)} />
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
