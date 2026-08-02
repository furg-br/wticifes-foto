/**
 * Cores de marca medidas diretamente em `public/wticifes2026-logo.png`.
 *
 * Método reproduzível (`npm run extract-brand-colors`): o PNG oficial é
 * decodificado para RGBA sem redimensionamento; pixels com alpha < 250 e pixels
 * acromáticos (amplitude RGB < 40) são descartados; os valores RGB exatos
 * restantes são contados. Estes são os três picos cromáticos dominantes do
 * histograma: vermelho (201, 2, 22), amarelo (255, 179, 3) e verde (103, 145, 87).
 */
export const BRAND = {
  red: "#C90216",
  yellow: "#FFB303",
  green: "#679157",
  phrase: "Eu fui, tchê!",
} as const;

export const OFFICIAL_LOGO_SHA256 =
  "70a722d1993806f761948ab12db508c72f0149ad78c307d09953583c6d1390e6";

/** Lettering artístico aprovado (versão 5), mantido como ativo estático e imutável. */
export const OFFICIAL_PHRASE_SHA256 =
  "401db7615e1ae38f362d96ddbd762ecaf9e4f2056b655dd8630b20cb59d096e5";
