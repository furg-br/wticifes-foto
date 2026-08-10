"use client";

import { useState } from "react";

export function AcceptInvitation({ token, csrfToken, emailMatches }: { token: string; csrfToken: string; emailMatches: boolean }) {
  const [message, setMessage] = useState(emailMatches ? "" : "Entre usando exatamente o e-mail que recebeu o convite.");
  const [busy, setBusy] = useState(false);
  async function accept() {
    setBusy(true);
    const response = await fetch("/api/admin/convite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, csrf_token: csrfToken }) });
    const body = await response.json() as { slug?: string; erro?: { mensagem?: string } };
    if (response.ok && body.slug) window.location.assign(`/admin/${body.slug}`);
    else { setMessage(body.erro?.mensagem ?? "Não foi possível aceitar o convite."); setBusy(false); }
  }
  return <div><button disabled={busy || !emailMatches} onClick={() => void accept()}>{busy ? "Confirmando…" : "Aceitar convite"}</button><p role="status" className="admin-message">{message}</p></div>;
}
