import { redirect } from "next/navigation";
import { createAdminCsrfToken, requireAdminIdentity } from "@/lib/admin-auth";
import { findInvitationByToken } from "@/lib/event-repository";
import { AcceptInvitation } from "./accept-invitation";

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = await findInvitationByToken(token);
  if (!invitation) return <main><section className="auth-card"><h1>Convite indisponível</h1><p>Este convite expirou, foi revogado ou já foi utilizado.</p></section></main>;
  let admin;
  try { admin = await requireAdminIdentity(); } catch { redirect(`/api/auth/signin?callbackUrl=${encodeURIComponent(`/admin/convite/${token}`)}`); }
  return <main><section className="auth-card"><p className="eyebrow">Convite administrativo</p><h1>Confirmar acesso</h1><p>O convite foi emitido para <strong>{invitation.email}</strong>. Você entrou como <strong>{admin.email}</strong>.</p><AcceptInvitation token={token} csrfToken={createAdminCsrfToken(admin.email)} emailMatches={invitation.email === admin.email} /></section></main>;
}
