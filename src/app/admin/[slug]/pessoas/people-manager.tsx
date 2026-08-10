"use client";

import { useState } from "react";

interface Person { id: string; email: string; name: string | null; active: boolean; createdAt: Date }
interface Invitation { id: string; email: string; expiresAt: string }

export function PeopleManager({ slug, csrfToken, people, invitations }: { slug: string; csrfToken: string; people: Person[]; invitations: Invitation[] }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [invitationUrl, setInvitationUrl] = useState("");
  const [busy, setBusy] = useState(false);

  async function invite(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage(""); setInvitationUrl("");
    try {
      const response = await fetch(`/api/admin/${slug}/convites`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, csrf_token: csrfToken }) });
      const body = await response.json() as { invitation_url?: string; already_registered?: boolean; erro?: { mensagem?: string } };
      if (!response.ok) throw new Error(body.erro?.mensagem ?? "Não foi possível criar o convite.");
      if (body.invitation_url) { setInvitationUrl(body.invitation_url); setMessage("Convite criado. Copie e envie o link à pessoa."); }
      else setMessage("A pessoa já possuía conta e recebeu acesso imediatamente.");
      setEmail("");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível criar o convite."); }
    finally { setBusy(false); }
  }

  async function setActive(userId: string, active: boolean) {
    if (!active && !window.confirm("Remover o acesso desta pessoa?")) return;
    setBusy(true);
    const response = await fetch(`/api/admin/${slug}/pessoas`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: userId, active, csrf_token: csrfToken }) });
    if (response.ok) window.location.reload();
    else { const body = await response.json() as { erro?: { mensagem?: string } }; setMessage(body.erro?.mensagem ?? "Operação não concluída."); setBusy(false); }
  }

  return (
    <div className="people-layout">
      <form className="admin-form" onSubmit={invite}><h2>Convidar administrador</h2><label>E-mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label><button disabled={busy}>Criar convite</button><p role="status" className="admin-message">{message}</p>{invitationUrl && <div className="invitation-link"><code>{invitationUrl}</code><button type="button" onClick={() => void navigator.clipboard.writeText(invitationUrl)}>Copiar link</button></div>}</form>
      <section><h2>Administradores</h2>{people.length === 0 ? <p className="admin-empty">Nenhum administrador associado.</p> : <div className="people-list">{people.map((person) => <article key={person.id}><div><strong>{person.name || person.email}</strong><span>{person.email}</span></div><button className={person.active ? "danger" : ""} disabled={busy} onClick={() => void setActive(person.id, !person.active)}>{person.active ? "Remover acesso" : "Reativar"}</button></article>)}</div>}</section>
      {invitations.length > 0 && <section><h2>Convites pendentes</h2><div className="people-list">{invitations.map((item) => <article key={item.id}><div><strong>{item.email}</strong><span>Expira em {new Date(item.expiresAt).toLocaleString("pt-BR")}</span></div></article>)}</div></section>}
    </div>
  );
}
