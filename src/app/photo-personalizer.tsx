"use client";

import { upload } from "@vercel/blob/client";
import { type FormEvent, useState } from "react";
import { getOrCreateParticipantToken } from "@/lib/participant-identity";

interface PersonalizationResult {
  success: true;
  image_id: string;
  result_url: string;
  consent_token: string;
  revocation_token: string;
  expires_at: string;
  reused: boolean;
}

const extensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

let volatileParticipantToken: string | undefined;

function participantToken(): string {
  const create = () => crypto.randomUUID();
  try {
    return getOrCreateParticipantToken(window.localStorage, create);
  } catch {
    volatileParticipantToken ??= `${create()}${create()}`;
    return volatileParticipantToken;
  }
}

interface PhotoPersonalizerProps {
  slug: string;
  name: string;
  uploadTitle: string;
  uploadLabel: string;
  submitLabel: string;
  consentText: string;
  successMessage: string;
}

export function PhotoPersonalizer(props: PhotoPersonalizerProps) {
  const [file, setFile] = useState<File>();
  const [result, setResult] = useState<PersonalizationResult>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [revocationCode, setRevocationCode] = useState("");

  async function personalize(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    const extension = extensions[file.type];
    if (!extension || file.size > 12 * 1024 * 1024) {
      setMessage("Escolha uma foto JPG, PNG ou WebP de até 12 MB.");
      return;
    }
    setBusy(true);
    setMessage("Enviando sua foto com segurança…");
    setResult(undefined);
    setSubmitted(false);
    try {
      const requestId = crypto.randomUUID();
      const anonymousParticipantToken = participantToken();
      const blob = await upload(`incoming/${props.slug}/${crypto.randomUUID()}.${extension}`, file, {
        access: "private",
        handleUploadUrl: `/api/${props.slug}/upload`,
        clientPayload: JSON.stringify({ request_id: requestId }),
      });
      setMessage("Criando sua arte…");
      const response = await fetch(`/api/${props.slug}/personalizar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          upload_path: blob.pathname,
          mime_type: file.type,
          request_id: requestId,
          participant_token: anonymousParticipantToken,
        }),
      });
      const body = (await response.json()) as PersonalizationResult & { erro?: { mensagem?: string } };
      if (!response.ok) throw new Error(body.erro?.mensagem ?? "Não foi possível personalizar a foto.");
      setResult(body);
      setMessage(body.reused
        ? "Esta foto já havia sido processada. Recuperamos a imagem e os controles de consentimento e revogação."
        : props.successMessage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível personalizar a foto.");
    } finally {
      setBusy(false);
    }
  }

  async function submitForReview() {
    if (!result || !consent) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/${props.slug}/vitrine/submeter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_id: result.image_id, consent_token: result.consent_token }),
      });
      const body = (await response.json()) as { erro?: { mensagem?: string } };
      if (!response.ok) throw new Error(body.erro?.mensagem ?? "Não foi possível enviar para análise.");
      setSubmitted(true);
      setMessage("Consentimento registrado. A foto aguarda aprovação humana e ainda não está pública.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível enviar para análise.");
    } finally {
      setBusy(false);
    }
  }

  async function revokeCredentials(imageId: string, revocationToken: string) {
    if (!window.confirm("Revogar o consentimento e apagar a imagem?")) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/${props.slug}/vitrine/revogar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_id: imageId, revocation_token: revocationToken }),
      });
      const body = (await response.json()) as { erro?: { mensagem?: string } };
      if (!response.ok) throw new Error(body.erro?.mensagem ?? "Não foi possível revogar.");
      setResult(undefined);
      setSubmitted(false);
      setRevocationCode("");
      setMessage("Consentimento revogado e imagem retirada imediatamente.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível revogar.");
    } finally {
      setBusy(false);
    }
  }

  async function revokeSavedCode() {
    const separator = revocationCode.indexOf(":");
    if (separator < 1) {
      setMessage("Código de revogação inválido.");
      return;
    }
    await revokeCredentials(revocationCode.slice(0, separator), revocationCode.slice(separator + 1));
  }

  async function copyRevocationCode() {
    if (!result) return;
    await navigator.clipboard.writeText(`${result.image_id}:${result.revocation_token}`);
    setMessage("Código de revogação copiado. Guarde-o em local privado.");
  }

  return (
    <section className="personalizer" aria-labelledby="personalizer-title">
      <h2 id="personalizer-title">{props.uploadTitle}</h2>
      <form onSubmit={personalize}>
        <label className="file-picker">
          {props.uploadLabel}
          <input type="file" accept="image/jpeg,image/png,image/webp" required onChange={(event) => setFile(event.target.files?.[0])} />
        </label>
        <button disabled={busy || !file} type="submit">{busy ? "Processando…" : props.submitLabel}</button>
      </form>
      <p role="status" className="personalizer-message">{message}</p>
      {result && (
        <div className="personalizer-result">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={result.result_url} alt={`Sua foto personalizada com a marca de ${props.name}`} />
          <a className="download-button" href={result.result_url} download={`${props.slug}-eu-fui.jpg`}>Baixar JPEG</a>
          <div className="revocation-code">
            <strong>Código de revogação</strong>
            <code>{`${result.image_id}:${result.revocation_token}`}</code>
            <small>Guarde este código para recuperar o controle ou apagar a imagem depois.</small>
          </div>
          {!submitted && (
            <div className="consent-box">
              <label><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /> {props.consentText}</label>
              <button type="button" disabled={busy || !consent} onClick={submitForReview}>Enviar para análise</button>
            </div>
          )}
          <button type="button" disabled={busy} onClick={copyRevocationCode}>Copiar código de revogação</button>
          <button className="danger" type="button" disabled={busy} onClick={() => revokeCredentials(result.image_id, result.revocation_token)}>Revogar e apagar</button>
        </div>
      )}
      <details className="saved-revocation">
        <summary>Revogar com um código salvo</summary>
        <label>
          Código de revogação
          <input value={revocationCode} onChange={(event) => setRevocationCode(event.target.value)} autoComplete="off" />
        </label>
        <button className="danger" type="button" disabled={busy || !revocationCode} onClick={revokeSavedCode}>Revogar e apagar</button>
      </details>
    </section>
  );
}
