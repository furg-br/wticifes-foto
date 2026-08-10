import { z } from "zod";
import { SUPPORTED_IMAGE_MIME_TYPES } from "./constants";

export const submitToShowcaseSchema = z
  .object({
    image_id: z.uuid(),
    consent_token: z.string().min(32).max(256),
  })
  .strict();

export const revokeFromShowcaseSchema = z
  .object({
    image_id: z.uuid(),
    revocation_token: z.string().min(32).max(256),
  })
  .strict();

export const moderationActionSchema = z
  .object({
    image_id: z.uuid(),
    action: z.enum(["approve", "reject", "remove", "block_participant"]),
    reason: z.string().trim().max(500).optional(),
    csrf_token: z.string().min(32).max(512),
  })
  .strict();

export const standalonePersonalizeRequestSchema = z
  .object({
    upload_path: z.string().regex(/^incoming\/[a-z0-9-]{1,63}\/[0-9a-f-]{36}\.(?:jpg|jpeg|png|webp)$/i),
    mime_type: z.enum(SUPPORTED_IMAGE_MIME_TYPES),
    request_id: z.uuid(),
    participant_token: z.string().min(16).max(512).optional(),
  })
  .strict();

export const uploadClientPayloadSchema = z
  .object({ request_id: z.uuid() })
  .strict();

export const eventSlugSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(3).max(63);

export const createEventSchema = z.object({
  name: z.string().trim().min(3).max(160),
  slug: eventSlugSchema,
  csrf_token: z.string().min(32).max(512),
}).strict();

export const eventSettingsSchema = z.object({
  name: z.string().trim().min(3).max(160),
  status: z.enum(["draft", "active", "suspended", "archived"]),
  pageTitle: z.string().trim().min(1).max(160),
  pageSubtitle: z.string().trim().min(1).max(500),
  uploadTitle: z.string().trim().min(1).max(120),
  uploadLabel: z.string().trim().min(1).max(240),
  submitLabel: z.string().trim().min(1).max(80),
  consentText: z.string().trim().min(1).max(1000),
  successMessage: z.string().trim().min(1).max(500),
  showcaseTitle: z.string().trim().min(1).max(160),
  showcaseEmptyText: z.string().trim().min(1).max(240),
  csrf_token: z.string().min(32).max(512),
}).strict();

export const invitationSchema = z.object({
  email: z.email().transform((value) => value.trim().toLowerCase()),
  csrf_token: z.string().min(32).max(512),
}).strict();
