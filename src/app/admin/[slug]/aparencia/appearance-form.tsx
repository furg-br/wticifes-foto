"use client";

/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import type { EventRecord } from "@/db/schema";
import type { EventAssetKind } from "@/lib/event-assets";

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
  const [assetMessage, setAssetMessage] = useState("");
  const [assetVersion, setAssetVersion] = useState(event.configVersion);
  const [uploadingKind, setUploadingKind] = useState<EventAssetKind | null>(null);
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

  async function uploadAsset(kind: EventAssetKind, file?: File) {
    if (!file) return;
    setBusy(true);
    setUploadingKind(kind);
    setAssetMessage("");
    try {
      const form = new FormData();
      form.set("kind", kind);
      form.set("file", file);
      form.set("csrf_token", csrfToken);
      const response = await fetch(`/api/admin/${eventSlug}/asset`, { method: "POST", body: form });
      const body = await response.json() as { version?: number; erro?: { mensagem?: string } };
      if (!response.ok) throw new Error(body.erro?.mensagem ?? "Não foi possível enviar a imagem.");
      if (typeof body.version === "number") setAssetVersion(body.version);
      const assetName = kind === "logo" ? "Logo" : kind === "side" ? "Imagem adicional" : "Favicon";
      setAssetMessage(`${assetName} atualizado com sucesso.`);
    } catch (error) {
      setAssetMessage(error instanceof Error ? error.message : "Não foi possível enviar a imagem.");
    } finally {
      setUploadingKind(null);
      setBusy(false);
    }
  }

  function selectAsset(kind: EventAssetKind, input: HTMLInputElement) {
    const file = input.files?.[0];
    input.value = "";
    void uploadAsset(kind, file);
  }

  return (
    <div className="settings-layout">
      <section className="asset-panel">
        <h2>Imagens da composição</h2>
        <div className="asset-grid">
          <label className="asset-picker">
            <span>Logo</span>
            <img src={`/api/admin/${eventSlug}/asset?kind=logo&v=${assetVersion}`} alt="Logo atual" />
            <span className="asset-picker-action">{uploadingKind === "logo" ? "Enviando logo…" : "Selecionar novo logo"}</span>
            <input className="asset-file-input" type="file" aria-label="Selecionar novo logo" accept="image/png,image/webp,image/jpeg" disabled={busy} onChange={(e) => selectAsset("logo", e.currentTarget)} />
          </label>
          <label className="asset-picker">
            <span>Imagem ao lado</span>
            <img src={`/api/admin/${eventSlug}/asset?kind=side&v=${assetVersion}`} alt="Imagem adicional atual" />
            <span className="asset-picker-action">{uploadingKind === "side" ? "Enviando imagem…" : "Selecionar nova imagem"}</span>
            <input className="asset-file-input" type="file" aria-label="Selecionar nova imagem adicional" accept="image/png,image/webp,image/jpeg" disabled={busy} onChange={(e) => selectAsset("side", e.currentTarget)} />
          </label>
          <label className="asset-picker">
            <span>Favicon</span>
            <img src={`/api/admin/${eventSlug}/asset?kind=favicon&v=${assetVersion}`} alt="Favicon atual" />
            <span className="asset-picker-action">{uploadingKind === "favicon" ? "Enviando favicon…" : "Selecionar novo favicon"}</span>
            <input className="asset-file-input" type="file" aria-label="Selecionar novo favicon" accept="image/png,image/webp,image/jpeg" disabled={busy} onChange={(e) => selectAsset("favicon", e.currentTarget)} />
          </label>
        </div>
        <small>PNG, WebP ou JPEG de até 2 MB. As imagens são normalizadas e armazenadas de forma privada.</small>
        <p role="status" className="admin-message asset-message">{assetMessage}</p>
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
