"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface FeedImage { url: string; expires_at: string }

export function Slideshow({ intervalSeconds }: { intervalSeconds: number }) {
  const [images, setImages] = useState<FeedImage[]>([]);
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const root = useRef<HTMLElement>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/vitrine/feed", { cache: "no-store" });
      if (!response.ok) throw new Error("feed unavailable");
      const body = (await response.json()) as { images?: FeedImage[] };
      setImages(body.images ?? []);
      setIndex((current) => Math.min(current, Math.max(0, (body.images?.length ?? 1) - 1)));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => void refresh(), 0);
    const refreshTimer = window.setInterval(() => void refresh(), 60_000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(refreshTimer);
    };
  }, [refresh]);

  useEffect(() => {
    if (images.length < 2) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % images.length), intervalSeconds * 1000);
    return () => window.clearInterval(timer);
  }, [images.length, intervalSeconds]);

  useEffect(() => {
    if (images.length < 2) return;
    const next = images[(index + 1) % images.length];
    if (next) {
      const preload = new window.Image();
      preload.src = next.url;
    }
  }, [images, index]);

  async function fullScreen() {
    await root.current?.requestFullscreen();
  }

  const current = images[index];
  return (
    <section ref={root} className="showcase" aria-live="polite">
      <div className="showcase-brand"><span>WTICIFES 2026</span><button onClick={fullScreen}>Tela cheia</button></div>
      {current && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={current.url} className="showcase-photo" src={current.url} alt="Foto autorizada e aprovada para a vitrine do WTICIFES 2026" onError={() => setIndex((value) => images.length ? (value + 1) % images.length : 0)} />
      ) : (
        <div className="showcase-empty">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/wticifes2026-logo.png" alt="WTICIFES Rio Grande do Sul 2026" />
          <p>{failed ? "Aguardando reconexão…" : "Novas fotos aparecerão aqui em breve."}</p>
        </div>
      )}
    </section>
  );
}
