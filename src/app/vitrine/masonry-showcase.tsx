"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface FeedImage {
  url: string;
  expires_at: string;
}

const FEED_REFRESH_INTERVAL_MS = 60_000;
const AUTO_SCROLL_INTERVAL_MS = 50;
const AUTO_SCROLL_PAUSE_TICKS = 60;

export function randomMasonryPosition(itemCount: number, randomValue = Math.random()): number {
  return Math.min(itemCount, Math.floor(randomValue * (itemCount + 1)));
}

function QrLink({ appUrl, slug, name, className = "" }: { appUrl: string; slug: string; name: string; className?: string }) {
  return (
    <a
      className={`showcase-qr-card ${className}`.trim()}
      href={appUrl}
      aria-label="Abrir a página para criar sua foto"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/${slug}/qrcode`} alt={`QR Code para criar sua foto de ${name}`} />
      <strong>Crie sua foto</strong>
      <span>Aponte a câmera</span>
    </a>
  );
}

interface ShowcaseProps {
  appUrl: string;
  slug: string;
  name: string;
  emptyText: string;
}

export function MasonryShowcase({ appUrl, slug, name, emptyText }: ShowcaseProps) {
  const [images, setImages] = useState<FeedImage[]>([]);
  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());
  const [feedFailed, setFeedFailed] = useState(false);
  const [qrPosition, setQrPosition] = useState(0);
  const root = useRef<HTMLElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const interactionPaused = useRef(false);

  const visibleImages = useMemo(
    () => images.filter((image) => !failedUrls.has(image.url)),
    [failedUrls, images],
  );

  const masonryItems = useMemo(() => {
    const items: Array<
      | { kind: "photo"; image: FeedImage; photoIndex: number }
      | { kind: "qrcode" }
    > = visibleImages.map((image, photoIndex) => ({ kind: "photo", image, photoIndex }));
    items.splice(Math.min(qrPosition, items.length), 0, { kind: "qrcode" });
    return items;
  }, [qrPosition, visibleImages]);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/${slug}/vitrine/feed`, { cache: "no-store" });
      if (!response.ok) throw new Error("feed unavailable");

      const body = (await response.json()) as { images?: FeedImage[] };
      const nextImages = body.images ?? [];
      setImages(nextImages);
      setQrPosition(randomMasonryPosition(nextImages.length));
      setFailedUrls(new Set());
      setFeedFailed(false);
    } catch {
      setFeedFailed(true);
    }
  }, [slug]);

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
        <span>{name}</span>
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
          <div className="showcase-masonry" role="list" aria-label={`Fotos aprovadas de ${name}`}>
            {masonryItems.map((item) => item.kind === "qrcode" ? (
              <figure className="showcase-tile showcase-qr-tile" role="listitem" key="showcase-qrcode">
                <QrLink appUrl={appUrl} slug={slug} name={name} />
              </figure>
            ) : (
              <figure className="showcase-tile" role="listitem" key={item.image.url}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="showcase-photo"
                  src={item.image.url}
                  alt={`Foto ${item.photoIndex + 1} autorizada e aprovada para a vitrine de ${name}`}
                  loading={item.photoIndex < 8 ? "eager" : "lazy"}
                  onError={() => hideFailedImage(item.image.url)}
                />
              </figure>
            ))}
          </div>
        </div>
      ) : (
        <div className="showcase-empty">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/${slug}/asset/logo`} alt={name} />
          <p>{feedFailed ? "Aguardando reconexão…" : emptyText}</p>
          <QrLink appUrl={appUrl} slug={slug} name={name} className="showcase-empty-qr" />
        </div>
      )}
    </section>
  );
}
