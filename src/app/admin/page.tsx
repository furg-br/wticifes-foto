import Link from "next/link";
import { redirect } from "next/navigation";
import { AppError } from "@/lib/app-error";
import { requireAdmin } from "@/lib/admin-auth";
import { listEventsForAdmin } from "@/lib/event-repository";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (error) {
    if (error instanceof AppError && error.code === "ADMIN_AUTH_NOT_CONFIGURED") {
      return <main><section className="admin-shell"><h1>Painel indisponível</h1><p>A autenticação administrativa não está configurada.</p></section></main>;
    }
    redirect("/admin/entrar");
  }
  const records = await listEventsForAdmin(admin);
  return (
    <main className="admin-main">
      <section className="admin-shell">
        <header className="admin-header">
          <div><p className="eyebrow">Administração</p><h1>Seus espaços</h1></div>
          <div className="admin-header-actions">
            {admin.isSuperAdmin && <Link className="button-link" href="/admin/novo">Novo cadastro</Link>}
            <Link href="/api/auth/signout">Sair</Link>
          </div>
        </header>
        <p className="queue-summary">Conectado como {admin.email}</p>
        {records.length === 0 ? <p className="admin-empty">Você ainda não administra nenhum espaço.</p> : (
          <div className="admin-event-grid">
            {records.map((event) => (
              <article className="admin-event-card" key={event.id}>
                <span className={`status-badge status-${event.status}`}>{event.status}</span>
                <h2>{event.name}</h2>
                <p>/{event.slug}</p>
                <div className="card-actions">
                  <Link className="button-link" href={`/admin/${event.slug}`}>Administrar</Link>
                  {event.status === "active" && <Link href={`/${event.slug}`}>Abrir página</Link>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
