import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminCsrfToken, requireEventAdmin } from "@/lib/admin-auth";
import { AdminEventNav } from "../admin-event-nav";
import { AppearanceForm } from "./appearance-form";

export default async function AppearancePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let access;
  try { access = await requireEventAdmin(slug); } catch { redirect("/admin"); }
  return (
    <main className="admin-main">
      <section className="admin-shell">
        <header className="admin-header">
          <div><p className="eyebrow">{access.event.name}</p><h1>Aparência e textos</h1></div>
          <Link href="/admin">Todos os espaços</Link>
        </header>
        <AdminEventNav slug={slug} isSuperAdmin={access.admin.isSuperAdmin} />
        <AppearanceForm event={access.event} csrfToken={createAdminCsrfToken(access.admin.email)} />
      </section>
    </main>
  );
}
