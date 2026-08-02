"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface FeedImage {
  url: string;
  expires_at: string;
}

const FEED_REFRESH_INTERVAL_MS = 60_000;
const AUTO_SCROLL_INTERVAL_MS = 50;
const AUTO_SCROLL_PAUSE_TICKS = 60;

export function MasonryShowcase() {
  const [images, setImages] = useState<FeedImage[]>([]);
  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());
  const [feedFailed, setFeedFailed] = useState(false);
  const root = useRef<HTMLElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const interactionPaused = useRef(false);

  const visibleImages = useMemo(
    () => images.filter((image) => !failedUrls.has(image.url)),
    [failedUrls, images],
  );

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/vitrine/feed", { cache: "no-store" });
      if (!response.ok) throw new Error("feed unavailable");

      const body = (await response.json()) as { images?: FeedImage[] };
      setImages(body.images ?? []);
      setFailedUrls(new Set());
      setFeedFailed(false);
    } catch {
      setFeedFailed(true);
    }
  }, []);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => void refresh(), 0);
    const refreshTimer = window.setInterval(() => void refresh(), FEED_REFRESH_INTERVAL_MS);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(refreshTimer);
    };
  }, [refresh]);

  useEffect(() => {
    const container = scroller.current;
    if (!container || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let pauseTicks = 0;
    const timer = window.setInterval(() => {
      if (interactionPaused.current || container.scrollHeight <= container.clientHeight) return;

      const reachedBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 2;
      if (reachedBottom) {
        pauseTicks += 1;
        if (pauseTicks >= AUTO_SCROLL_PAUSE_TICKS) {
          container.scrollTo({ top: 0, behavior: "smooth" });
          pauseTicks = 0;
        }
        return;
      }

      pauseTicks = 0;
      container.scrollTop += 1;
    }, AUTO_SCROLL_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [visibleImages.length]);

  async function fullScreen() {
    await root.current?.requestFullscreen();
  }

  function hideFailedImage(url: string) {
    setFailedUrls((current) => new Set(current).add(url));
  }

  return (
    <section ref={root} className="showcase" aria-live="polite">
      <div className="showcase-brand">
        <span>WTICIFES 2026</span>
        <button onClick={fullScreen}>Tela cheia</button>
      </div>

      {visibleImages.length > 0 ? (
        <div
          ref={scroller}
          className="showcase-masonry-scroll"
          onMouseEnter={() => { interactionPaused.current = true; }}
          onMouseLeave={() => { interactionPaused.current = false; }}
          onFocus={() => { interactionPaused.current = true; }}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) interactionPaused.current = false;
          }}
        >
          <div className="showcase-masonry" role="list" aria-label="Fotos aprovadas do WTICIFES 2026">
            {visibleImages.map((image, index) => (
              <figure className="showcase-tile" role="listitem" key={image.url}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.url}
                  alt={`Foto ${index + 1} autorizada e aprovada para a vitrine do WTICIFES 2026`}
                  loading={index < 8 ? "eager" : "lazy"}
                  onError={() => hideFailedImage(image.url)}
                />
              </figure>
            ))}
          </div>
        </div>
      ) : (
        <div className="showcase-empty">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/wticifes2026-logo.png" alt="WTICIFES Rio Grande do Sul 2026" />
          <p>{feedFailed ? "Aguardando reconexão…" : "Novas fotos aparecerão aqui em breve."}</p>
        </div>
      )}
    </section>
  );
}
