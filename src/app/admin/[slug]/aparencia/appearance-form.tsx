"use client";

/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import type { EventRecord } from "@/db/schema";

export function AppearanceForm({ event, csrfToken }: { event: EventRecord; csrfToken: string }) {
  const [settings, setSettings] = useState({
    name: event.name,
    status: event.status as "draft" | "active" | "suspended" | "archived",
    pageTitle: event.pageTitle,
    pageSubtitle: event.pageSubtitle,
    uploadTitle: event.uploadTitle,
    uploadLabel: event.uploadLabel,
    submitLabel: event.submitLabel,
    consentText: event.consentText,
    successMessage: event.successMessage,
    showcaseTitle: event.showcaseTitle,
    showcaseEmptyText: event.showcaseEmptyText,
  });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  function field<K extends keyof typeof settings>(key: K, value: typeof settings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/${eventSlug}/configuracao`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...settings, csrf_token: csrfToken }),
      });
      const body = await response.json() as { version?: number; erro?: { mensagem?: string } };
      if (!response.ok) throw new Error(body.erro?.mensagem ?? "Não foi possível salvar.");
      setMessage(`Configuração salva. Versão ${body.version}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally { setBusy(false); }
  }

  const eventSlug = event.slug;

  async function uploadAsset(kind: "logo" | "side", file?: File) {
    if (!file) return;
    setBusy(true);
    setMessage("");
    try {
      const form = new FormData();
      form.set("kind", kind);
      form.set("file", file);
      form.set("csrf_token", csrfToken);
      const response = await fetch(`/api/admin/${eventSlug}/asset`, { method: "POST", body: form });
      const body = await response.json() as { version?: number; erro?: { mensagem?: string } };
      if (!response.ok) throw new Error(body.erro?.mensagem ?? "Não foi possível enviar a imagem.");
      setMessage(`Imagem atualizada. Versão ${body.version}.`);
      window.setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível enviar a imagem.");
      setBusy(false);
    }
  }

  return (
    <div className="settings-layout">
      <section className="asset-panel">
        <h2>Imagens da composição</h2>
        <div className="asset-grid">
          <label><span>Logo</span><img src={`/api/${eventSlug}/asset/logo?v=${event.configVersion}`} alt="Logo atual" /><input type="file" accept="image/png,image/webp,image/jpeg" disabled={busy} onChange={(e) => void uploadAsset("logo", e.target.files?.[0])} /></label>
          <label><span>Imagem ao lado</span><img src={`/api/${eventSlug}/asset/side?v=${event.configVersion}`} alt="Imagem adicional atual" /><input type="file" accept="image/png,image/webp,image/jpeg" disabled={busy} onChange={(e) => void uploadAsset("side", e.target.files?.[0])} /></label>
        </div>
        <small>PNG, WebP ou JPEG de até 2 MB. As imagens são normalizadas e armazenadas de forma privada.</small>
      </section>
      <form className="admin-form" onSubmit={save}>
        <h2>Identificação e publicação</h2>
        <label>Nome<input value={settings.name} maxLength={160} onChange={(e) => field("name", e.target.value)} /></label>
        <label>Status<select value={settings.status} onChange={(e) => field("status", e.target.value as typeof settings.status)}><option value="draft">Rascunho</option><option value="active">Ativo</option><option value="suspended">Suspenso</option><option value="archived">Arquivado</option></select></label>
        <h2>Página de envio</h2>
        <label>Título<input value={settings.pageTitle} maxLength={160} onChange={(e) => field("pageTitle", e.target.value)} /></label>
        <label>Apresentação<textarea value={settings.pageSubtitle} maxLength={500} onChange={(e) => field("pageSubtitle", e.target.value)} /></label>
        <label>Título do formulário<input value={settings.uploadTitle} maxLength={120} onChange={(e) => field("uploadTitle", e.target.value)} /></label>
        <label>Orientação do arquivo<input value={settings.uploadLabel} maxLength={240} onChange={(e) => field("uploadLabel", e.target.value)} /></label>
        <label>Texto do botão<input value={settings.submitLabel} maxLength={80} onChange={(e) => field("submitLabel", e.target.value)} /></label>
        <label>Texto do consentimento<textarea value={settings.consentText} maxLength={1000} onChange={(e) => field("consentText", e.target.value)} /></label>
        <label>Mensagem de sucesso<textarea value={settings.successMessage} maxLength={500} onChange={(e) => field("successMessage", e.target.value)} /></label>
        <h2>Vitrine</h2>
        <label>Título<input value={settings.showcaseTitle} maxLength={160} onChange={(e) => field("showcaseTitle", e.target.value)} /></label>
        <label>Mensagem sem fotos<input value={settings.showcaseEmptyText} maxLength={240} onChange={(e) => field("showcaseEmptyText", e.target.value)} /></label>
        <button disabled={busy}>{busy ? "Salvando…" : "Salvar e publicar configuração"}</button>
        <p role="status" className="admin-message">{message}</p>
      </form>
    </div>
  );
}
