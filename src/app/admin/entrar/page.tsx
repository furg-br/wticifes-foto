import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { requireAdmin } from "@/lib/admin-auth";

export default async function SignInPage() {
  let isAuthenticatedAdmin = false;

  try {
    await requireAdmin();
    isAuthenticatedAdmin = true;
  } catch {
    // A página de entrada permanece disponível para sessões ausentes.
  }

  if (isAuthenticatedAdmin) {
    redirect("/admin");
  }

  return (
    <main>
      <section className="auth-card">
        <p className="eyebrow">Área reservada</p>
        <h1>Administração</h1>
        <p>Entre com o e-mail do GitHub que foi autorizado ou convidado pelo administrador geral.</p>
        <form action={async () => { "use server"; await signIn("github", { redirectTo: "/admin" }); }}>
          <button type="submit">Entrar com GitHub</button>
        </form>
      </section>
    </main>
  );
}
