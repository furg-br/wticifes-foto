import Link from "next/link";
import { redirect } from "next/navigation";
import { requireEventAdmin } from "@/lib/admin-auth";
import { queueStats } from "@/lib/image-repository";
import { AdminEventNav } from "./admin-event-nav";

export default async function EventAdminPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let access;
  try { access = await requireEventAdmin(slug); } catch { redirect("/admin"); }
  const stats = await queueStats(access.event.id);
  return (
    <main className="admin-main">
      <section className="admin-shell">
        <header className="admin-header">
          <div><p className="eyebrow">/{access.event.slug}</p><h1>{access.event.name}</h1></div>
          <Link href="/admin">Todos os espaços</Link>
        </header>
        <AdminEventNav slug={slug} isSuperAdmin={access.admin.isSuperAdmin} />
        <div className="admin-summary-grid">
          <article><strong>{stats.pending}</strong><span>Aguardando análise</span></article>
          <article><strong>{stats.nearExpiry}</strong><span>Perto de expirar</span></article>
          <article><strong>{access.event.configVersion}</strong><span>Versão da configuração</span></article>
          <article><strong>{access.event.status}</strong><span>Status</span></article>
        </div>
        <div className="admin-callout">
          <h2>Endereço público</h2>
          <p><Link href={`/${slug}`}>/{slug}</Link></p>
          <a className="button-link" href={`/api/${slug}/qrcode`} download={`${slug}-qrcode.png`}>Baixar QR Code</a>
        </div>
      </section>
    </main>
  );
}
