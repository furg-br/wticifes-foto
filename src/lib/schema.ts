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
    upload_path: z.string().regex(/^incoming\/[0-9a-f-]{36}\.(?:jpg|jpeg|png|webp)$/i),
    mime_type: z.enum(SUPPORTED_IMAGE_MIME_TYPES),
    request_id: z.uuid(),
    participant_token: z.string().min(16).max(512).optional(),
  })
  .strict();

export const uploadClientPayloadSchema = z
  .object({ request_id: z.uuid() })
  .strict();
