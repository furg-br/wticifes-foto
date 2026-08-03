"use client";

import { useCallback, useEffect, useState } from "react";

interface PublicStatistics {
  total_personalizations: number;
  unique_participants: number;
  today_personalizations: number;
  showcase_photos: number;
  updated_at: string;
}

const REFRESH_INTERVAL_MS = 60_000;
const number = new Intl.NumberFormat("pt-BR");

export function UsageStatistics() {
  const [statistics, setStatistics] = useState<PublicStatistics>();
  const [failed, setFailed] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/estatisticas");
      if (!response.ok) throw new Error("statistics unavailable");
      setStatistics((await response.json()) as PublicStatistics);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => void refresh(), 0);
    const refreshTimer = window.setInterval(() => void refresh(), REFRESH_INTERVAL_MS);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(refreshTimer);
    };
  }, [refresh]);

  const values = [
    ["Personalizações", statistics?.total_personalizations],
    ["Participantes", statistics?.unique_participants],
    ["Criadas hoje", statistics?.today_personalizations],
    ["Na vitrine", statistics?.showcase_photos],
  ] as const;

  return (
    <section className="usage-statistics" aria-labelledby="statistics-title" aria-live="polite">
      <div className="usage-statistics-heading">
        <h2 id="statistics-title">WTICIFES em números</h2>
        <p>Contagens agregadas e anônimas</p>
      </div>
      <dl>
        {values.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value === undefined ? "—" : number.format(value)}</dd>
          </div>
        ))}
      </dl>
      {failed && !statistics && <p className="statistics-unavailable">Estatísticas temporariamente indisponíveis.</p>}
      <small>Participantes são estimados por identificadores anônimos mantidos nos navegadores.</small>
    </section>
  );
}
