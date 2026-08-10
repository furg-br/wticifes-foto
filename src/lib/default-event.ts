import { DEFAULT_EVENT_ID, DEFAULT_EVENT_SLUG, type EventRecord } from "@/db/schema";

const migrationDate = new Date("2026-08-01T00:00:00.000Z");

export const DEFAULT_EVENT_RECORD: EventRecord = {
  id: DEFAULT_EVENT_ID,
  slug: DEFAULT_EVENT_SLUG,
  name: "WTICIFES 2026",
  status: "active",
  pageTitle: "Eu fui, tchê!",
  pageSubtitle: "Personalize sua fotografia com a identidade oficial do WTICIFES 2026.",
  uploadTitle: "Crie sua foto",
  uploadLabel: "Escolha uma foto JPG, PNG ou WebP (até 12 MB)",
  submitLabel: "Personalizar foto",
  consentText: "Autorizo a exibição pública desta imagem nas telas e na vitrine do WTICIFES 2026, sujeita à revisão humana.",
  successMessage: "Pronto. Sua arte continua privada. Guarde o código de revogação antes de fechar a página.",
  showcaseTitle: "WTICIFES 2026",
  showcaseEmptyText: "Novas fotos aparecerão aqui em breve.",
  logoPath: "builtin:wticifes-logo",
  sideImagePath: "builtin:wticifes-phrase",
  faviconPath: "builtin:wticifes-favicon",
  configVersion: 1,
  createdBy: "migration",
  createdAt: migrationDate,
  updatedAt: migrationDate,
};
