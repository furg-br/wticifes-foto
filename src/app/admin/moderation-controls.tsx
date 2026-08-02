"use client";

import { useState } from "react";

interface Props {
  imageId: string;
  csrfToken: string;
  status: string;
  canBlock: boolean;
}

export function ModerationControls({ imageId, csrfToken, status, canBlock }: Props) {
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function act(action: "approve" | "reject" | "remove" | "block_participant") {
    const destructive = action !== "approve";
    if (destructive && !window.confirm("Confirma esta ação? A imagem deixará de ficar disponível.")) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/moderacao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_id: imageId, action, reason: reason || undefined, csrf_token: csrfToken }),
      });
      const body = (await response.json()) as { success?: boolean; erro?: { mensagem?: string } };
      if (!response.ok) throw new Error(body.erro?.mensagem ?? "Operação não concluída.");
      setMessage("Operação concluída. Atualizando…");
      window.setTimeout(() => window.location.reload(), 400);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Operação não concluída.");
      setBusy(false);
    }
  }

  return (
    <div className="moderation-controls">
      <label>
        Motivo (opcional)
        <textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} />
      </label>
      <div className="moderation-actions">
        {status === "pending_review" && <button disabled={busy} onClick={() => act("approve")}>Aprovar</button>}
        {status === "pending_review" && <button className="danger" disabled={busy} onClick={() => act("reject")}>Rejeitar e apagar</button>}
        {status === "approved" && <button className="danger" disabled={busy} onClick={() => act("remove")}>Remover da vitrine</button>}
        {canBlock && ["pending_review", "approved"].includes(status) && (
          <button className="danger" disabled={busy} onClick={() => act("block_participant")}>Bloquear participante</button>
        )}
      </div>
      <p role="status" className="admin-message">{message}</p>
    </div>
  );
}
