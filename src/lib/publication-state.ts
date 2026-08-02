import type { ImageStatus } from "./constants";

export interface PublicationState {
  status: ImageStatus;
  consentedAt: Date | null;
  removedAt: Date | null;
  deletedAt: Date | null;
  publicationExpiresAt: Date | null;
}

export function canAppearInShowcase(image: PublicationState, now = new Date()): boolean {
  return Boolean(
    image.status === "approved" &&
      image.consentedAt &&
      !image.removedAt &&
      !image.deletedAt &&
      image.publicationExpiresAt &&
      image.publicationExpiresAt > now,
  );
}

export function allowedAdminSourceStatuses(action: "approve" | "reject" | "remove" | "block_participant") {
  if (action === "approve" || action === "reject") return ["pending_review"] as const;
  return ["pending_review", "approved"] as const;
}
