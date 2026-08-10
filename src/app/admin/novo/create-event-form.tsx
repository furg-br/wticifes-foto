"use client";

import { useState } from "react";

export function CreateEventForm({ csrfToken }: { csrfToken: string }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  function updateName(value: string) {
    setName(value);
    setSlug(value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 63));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/registrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug, csrf_token: csrfToken }),
      });
      const body = await response.json() as { slug?: string; erro?: { mensagem?: string } };
      if (!response.ok || !body.slug) throw new Error(body.erro?.mensagem ?? "Não foi possível concluir o cadastro.");
      window.location.assign(`/admin/${body.slug}/aparencia`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível concluir o cadastro.");
      setBusy(false);
    }
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      <label>Nome<input value={name} onChange={(event) => updateName(event.target.value)} required maxLength={160} /></label>
      <label>Endereço<input value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase())} required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={63} /><small>dominio.com/{slug || "seu-endereco"}</small></label>
      <button disabled={busy}>{busy ? "Cadastrando…" : "Cadastrar"}</button>
      <p role="status" className="admin-message">{message}</p>
    </form>
  );
}
