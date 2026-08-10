import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminCsrfToken, requireSuperAdmin } from "@/lib/admin-auth";
import { findEventBySlug, listEventPeople, listPendingInvitations } from "@/lib/event-repository";
import { AdminEventNav } from "../admin-event-nav";
import { PeopleManager } from "./people-manager";

export default async function PeoplePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let admin;
  try { admin = await requireSuperAdmin(); } catch { redirect(`/admin/${slug}`); }
  const event = await findEventBySlug(slug);
  if (!event) redirect("/admin");
  const [people, invitations] = await Promise.all([listEventPeople(event.id), listPendingInvitations(event.id)]);
  return (
    <main className="admin-main">
      <section className="admin-shell">
        <header className="admin-header"><div><p className="eyebrow">{event.name}</p><h1>Pessoas</h1></div><Link href="/admin">Todos os espaços</Link></header>
        <AdminEventNav slug={slug} isSuperAdmin />
        <PeopleManager slug={slug} csrfToken={createAdminCsrfToken(admin.email)} people={people} invitations={invitations.map((item) => ({ id: item.id, email: item.email, expiresAt: item.expiresAt.toISOString() }))} />
      </section>
    </main>
  );
}
