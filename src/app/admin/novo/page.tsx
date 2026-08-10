import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminCsrfToken, requireSuperAdmin } from "@/lib/admin-auth";
import { CreateEventForm } from "./create-event-form";

export default async function NewEventPage() {
  let admin;
  try { admin = await requireSuperAdmin(); } catch { redirect("/admin"); }
  return (
    <main className="admin-main">
      <section className="admin-shell admin-form-shell">
        <Link href="/admin">← Voltar</Link>
        <p className="eyebrow">Administração geral</p>
        <h1>Novo cadastro</h1>
        <p>O endereço público será criado diretamente na raiz do domínio.</p>
        <CreateEventForm csrfToken={createAdminCsrfToken(admin.email)} />
      </section>
    </main>
  );
}
