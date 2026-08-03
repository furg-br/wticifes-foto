import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { blockedParticipants, images, moderationAudit, type ImageRecord } from "@/db/schema";
import { getDatabase } from "@/db/client";
import type { ImageStatus } from "./constants";

export interface CreatePrivateImageInput {
  id: string;
  blobPath: string;
  contentHash: string;
  participantKeyHash?: string;
  requestKeyHash?: string;
  expiresAt: Date;
  consentTokenHash: string;
  consentTokenExpiresAt: Date;
  revocationTokenHash: string;
  safetyPriority?: number;
  safetyFlags?: string[];
}

export interface TransitionResult {
  image: ImageRecord;
  changed: boolean;
}

export interface PublicUsageStatistics {
  totalPersonalizations: number;
  uniqueParticipants: number;
  todayPersonalizations: number;
  showcasePhotos: number;
}

export async function getPublicUsageStatistics(now = new Date()): Promise<PublicUsageStatistics> {
  const result = await getDatabase().execute(sql<PublicUsageStatistics>`
    SELECT
      count(*)::int AS "totalPersonalizations",
      count(DISTINCT participant_key_hash)::int AS "uniqueParticipants",
      count(*) FILTER (
        WHERE created_at >= (
          date_trunc('day', timezone('America/Sao_Paulo', ${now}))
          AT TIME ZONE 'America/Sao_Paulo'
        )
      )::int AS "todayPersonalizations",
      count(*) FILTER (
        WHERE status = 'approved'
          AND removed_at IS NULL
          AND deleted_at IS NULL
          AND publication_expires_at > ${now}
      )::int AS "showcasePhotos"
    FROM images
  `);
  const row = result.rows[0];

  return {
    totalPersonalizations: Number(row?.totalPersonalizations ?? 0),
    uniqueParticipants: Number(row?.uniqueParticipants ?? 0),
    todayPersonalizations: Number(row?.todayPersonalizations ?? 0),
    showcasePhotos: Number(row?.showcasePhotos ?? 0),
  };
}

export async function createPrivateImage(input: CreatePrivateImageInput): Promise<ImageRecord> {
  const [created] = await getDatabase()
    .insert(images)
    .values({
      ...input,
      participantKeyHash: input.participantKeyHash ?? null,
      requestKeyHash: input.requestKeyHash ?? null,
      status: "private",
      safetyPriority: input.safetyPriority ?? 0,
      safetyFlags: input.safetyFlags ?? [],
    })
    .returning();
  if (!created) throw new Error("Falha ao persistir a imagem.");
  return created;
}

export async function findImageById(id: string): Promise<ImageRecord | undefined> {
  return getDatabase().query.images.findFirst({ where: eq(images.id, id) });
}

export async function findActiveByContentHash(contentHash: string): Promise<ImageRecord | undefined> {
  return getDatabase().query.images.findFirst({
    where: and(eq(images.contentHash, contentHash), isNull(images.deletedAt)),
  });
}

export async function claimUnidentifiedPrivateImage(
  imageId: string,
  participantHash: string,
): Promise<ImageRecord | undefined> {
  const [claimed] = await getDatabase()
    .update(images)
    .set({ participantKeyHash: participantHash })
    .where(
      and(
        eq(images.id, imageId),
        eq(images.status, "private"),
        isNull(images.participantKeyHash),
        isNull(images.consentedAt),
        isNull(images.deletedAt),
      ),
    )
    .returning();
  return claimed;
}

export async function findByRequestKey(requestKey: string): Promise<ImageRecord | undefined> {
  return getDatabase().query.images.findFirst({ where: eq(images.requestKeyHash, requestKey) });
}

export async function isParticipantBlocked(participantHash: string): Promise<boolean> {
  const record = await getDatabase().query.blockedParticipants.findFirst({
    columns: { participantKeyHash: true },
    where: eq(blockedParticipants.participantKeyHash, participantHash),
  });
  return Boolean(record);
}

export async function countParticipantImages(participantHash: string): Promise<number> {
  return getDatabase().$count(images, eq(images.participantKeyHash, participantHash));
}

export async function submitConsent(
  imageId: string,
  tokenHash: string,
  consentVersion: string,
  now = new Date(),
): Promise<TransitionResult | undefined> {
  const [changed] = await getDatabase()
    .update(images)
    .set({
      status: "pending_review",
      consentedAt: now,
      consentVersion,
      consentTokenUsedAt: now,
      submittedAt: now,
    })
    .where(
      and(
        eq(images.id, imageId),
        eq(images.status, "private"),
        eq(images.consentTokenHash, tokenHash),
        gt(images.consentTokenExpiresAt, now),
        isNull(images.consentTokenUsedAt),
        isNull(images.deletedAt),
      ),
    )
    .returning();
  if (changed) return { image: changed, changed: true };

  const existing = await findImageById(imageId);
  if (
    existing &&
    existing.consentTokenHash === tokenHash &&
    existing.consentTokenUsedAt &&
    ["pending_review", "approved", "rejected", "removed", "expired"].includes(existing.status)
  ) {
    return { image: existing, changed: false };
  }
  return undefined;
}

interface AuditTransitionInput {
  imageId: string;
  expectedStatuses: ImageStatus[];
  newStatus: ImageStatus;
  action: string;
  moderatorId: string;
  requestId: string;
  reason?: string;
  publicationExpiresAt?: Date;
  now?: Date;
}

export async function auditedTransition(input: AuditTransitionInput): Promise<ImageRecord | undefined> {
  const now = input.now ?? new Date();
  const db = getDatabase();
  const result = await db.execute(sql<ImageRecord>`
    WITH previous AS (
      SELECT id, status
      FROM images
      WHERE id = ${input.imageId}::uuid
        AND status = ANY(${sql.raw(`ARRAY[${input.expectedStatuses.map((s) => `'${s}'::image_status`).join(",")}]`)})
        AND deleted_at IS NULL
      FOR UPDATE
    ), changed AS (
      UPDATE images AS i
      SET status = ${input.newStatus}::image_status,
          approved_at = CASE WHEN ${input.newStatus} = 'approved' THEN ${now} ELSE i.approved_at END,
          approved_by = CASE WHEN ${input.newStatus} = 'approved' THEN ${input.moderatorId} ELSE i.approved_by END,
          publication_expires_at = CASE WHEN ${input.newStatus} = 'approved' THEN ${input.publicationExpiresAt ?? null} ELSE i.publication_expires_at END,
          rejected_at = CASE WHEN ${input.newStatus} = 'rejected' THEN ${now} ELSE i.rejected_at END,
          rejected_by = CASE WHEN ${input.newStatus} = 'rejected' THEN ${input.moderatorId} ELSE i.rejected_by END,
          rejection_reason = CASE WHEN ${input.newStatus} = 'rejected' THEN ${input.reason ?? null} ELSE i.rejection_reason END,
          removed_at = CASE WHEN ${input.newStatus} = 'removed' THEN ${now} ELSE i.removed_at END,
          removed_by = CASE WHEN ${input.newStatus} = 'removed' THEN ${input.moderatorId} ELSE i.removed_by END,
          token_version = i.token_version + 1
      FROM previous p
      WHERE i.id = p.id
      RETURNING i.*, p.status AS old_status
    ), audit AS (
      INSERT INTO moderation_audit
        (id, image_id, moderator_id, action, previous_status, new_status, reason, created_at, request_id)
      SELECT ${randomUUID()}::uuid, id, ${input.moderatorId}, ${input.action}, old_status,
             ${input.newStatus}::image_status, ${input.reason ?? null}, ${now}, ${input.requestId}
      FROM changed
    )
    SELECT id, blob_path AS "blobPath", content_hash AS "contentHash", status,
      created_at AS "createdAt", expires_at AS "expiresAt", consented_at AS "consentedAt",
      consent_version AS "consentVersion", consent_token_hash AS "consentTokenHash",
      consent_token_expires_at AS "consentTokenExpiresAt", consent_token_used_at AS "consentTokenUsedAt",
      revocation_token_hash AS "revocationTokenHash", submitted_at AS "submittedAt",
      approved_at AS "approvedAt", approved_by AS "approvedBy", rejected_at AS "rejectedAt",
      rejected_by AS "rejectedBy", rejection_reason AS "rejectionReason", removed_at AS "removedAt",
      removed_by AS "removedBy", participant_key_hash AS "participantKeyHash",
      request_key_hash AS "requestKeyHash", publication_expires_at AS "publicationExpiresAt",
      token_version AS "tokenVersion", deleted_at AS "deletedAt", last_displayed_at AS "lastDisplayedAt",
      display_count AS "displayCount", safety_priority AS "safetyPriority", safety_flags AS "safetyFlags"
    FROM changed
  `);
  return result.rows[0] as ImageRecord | undefined;
}

export async function revokeImage(
  imageId: string,
  revocationHash: string,
  requestId: string,
  now = new Date(),
): Promise<TransitionResult | undefined> {
  const existing = await findImageById(imageId);
  if (!existing || existing.revocationTokenHash !== revocationHash) return undefined;
  if (existing.status === "removed") return { image: existing, changed: false };
  if (existing.deletedAt) return { image: existing, changed: false };
  const changed = await auditedTransition({
    imageId,
    expectedStatuses: ["private", "pending_review", "approved", "rejected"],
    newStatus: "removed",
    action: "participant_revoked",
    moderatorId: "participant",
    requestId,
    reason: "consent_revoked",
    now,
  });
  return changed ? { image: changed, changed: true } : undefined;
}

export async function markDeleted(imageId: string, now = new Date()): Promise<void> {
  await getDatabase().update(images).set({ deletedAt: now }).where(eq(images.id, imageId));
}

export async function listModeration(status: ImageStatus, limit = 50): Promise<ImageRecord[]> {
  return getDatabase().query.images.findMany({
    where: and(eq(images.status, status), isNull(images.deletedAt)),
    orderBy: [desc(images.safetyPriority), desc(images.submittedAt), desc(images.createdAt)],
    limit,
  });
}

export async function listShowcaseCandidates(now: Date, limit: number): Promise<ImageRecord[]> {
  return getDatabase().query.images.findMany({
    where: and(
      eq(images.status, "approved"),
      isNotNull(images.consentedAt),
      isNull(images.removedAt),
      isNull(images.deletedAt),
      gt(images.publicationExpiresAt, now),
    ),
    orderBy: [asc(images.lastDisplayedAt), asc(images.displayCount), sql`random()`],
    limit,
  });
}

export async function markShowcaseDisplayed(ids: string[], now = new Date()): Promise<void> {
  if (ids.length === 0) return;
  await getDatabase()
    .update(images)
    .set({ lastDisplayedAt: now, displayCount: sql`${images.displayCount} + 1` })
    .where(inArray(images.id, ids));
}

export async function blockParticipantFromImage(
  image: ImageRecord,
  moderatorId: string,
  reason: string | undefined,
): Promise<void> {
  if (!image.participantKeyHash) throw new Error("Imagem sem participante identificável.");
  await getDatabase()
    .insert(blockedParticipants)
    .values({
      participantKeyHash: image.participantKeyHash,
      blockedBy: moderatorId,
      reason: reason ?? null,
      sourceImageId: image.id,
    })
    .onConflictDoNothing();
}

export async function auditedBlockParticipant(
  imageId: string,
  moderatorId: string,
  requestId: string,
  reason?: string,
  now = new Date(),
): Promise<ImageRecord | undefined> {
  const result = await getDatabase().execute(sql<ImageRecord>`
    WITH previous AS (
      SELECT id, status, participant_key_hash
      FROM images
      WHERE id = ${imageId}::uuid
        AND status IN ('pending_review'::image_status, 'approved'::image_status)
        AND participant_key_hash IS NOT NULL
        AND deleted_at IS NULL
      FOR UPDATE
    ), changed AS (
      UPDATE images AS i
      SET status = 'removed'::image_status,
          removed_at = ${now},
          removed_by = ${moderatorId},
          token_version = i.token_version + 1
      FROM previous p
      WHERE i.id = p.id
      RETURNING i.*, p.status AS old_status, p.participant_key_hash AS blocked_hash
    ), blocked AS (
      INSERT INTO blocked_participants
        (participant_key_hash, blocked_at, blocked_by, reason, source_image_id)
      SELECT blocked_hash, ${now}, ${moderatorId}, ${reason ?? null}, id FROM changed
      ON CONFLICT (participant_key_hash) DO NOTHING
    ), audit AS (
      INSERT INTO moderation_audit
        (id, image_id, moderator_id, action, previous_status, new_status, reason, created_at, request_id)
      SELECT ${randomUUID()}::uuid, id, ${moderatorId}, 'block_participant', old_status,
        'removed'::image_status, ${reason ?? null}, ${now}, ${requestId}
      FROM changed
    )
    SELECT id, blob_path AS "blobPath", content_hash AS "contentHash", status,
      created_at AS "createdAt", expires_at AS "expiresAt", consented_at AS "consentedAt",
      consent_version AS "consentVersion", consent_token_hash AS "consentTokenHash",
      consent_token_expires_at AS "consentTokenExpiresAt", consent_token_used_at AS "consentTokenUsedAt",
      revocation_token_hash AS "revocationTokenHash", submitted_at AS "submittedAt",
      approved_at AS "approvedAt", approved_by AS "approvedBy", rejected_at AS "rejectedAt",
      rejected_by AS "rejectedBy", rejection_reason AS "rejectionReason", removed_at AS "removedAt",
      removed_by AS "removedBy", participant_key_hash AS "participantKeyHash",
      request_key_hash AS "requestKeyHash", publication_expires_at AS "publicationExpiresAt",
      token_version AS "tokenVersion", deleted_at AS "deletedAt", last_displayed_at AS "lastDisplayedAt",
      display_count AS "displayCount", safety_priority AS "safetyPriority", safety_flags AS "safetyFlags"
    FROM changed
  `);
  return result.rows[0] as ImageRecord | undefined;
}

export async function listRetentionCandidates(now: Date, limits: {
  privateBefore: Date;
  pendingBefore: Date;
  rejectedBefore: Date;
}): Promise<ImageRecord[]> {
  return getDatabase().query.images.findMany({
    where: and(
      isNull(images.deletedAt),
      or(
        and(eq(images.status, "private"), lt(images.createdAt, limits.privateBefore)),
        and(eq(images.status, "pending_review"), lt(images.submittedAt, limits.pendingBefore)),
        and(eq(images.status, "rejected"), lt(images.rejectedAt, limits.rejectedBefore)),
        eq(images.status, "removed"),
        and(eq(images.status, "approved"), lt(images.publicationExpiresAt, now)),
        eq(images.status, "expired"),
      ),
    ),
    limit: 500,
  });
}

export async function expireImage(imageId: string, now = new Date()): Promise<void> {
  await getDatabase()
    .update(images)
    .set({ status: "expired", tokenVersion: sql`${images.tokenVersion} + 1` })
    .where(and(eq(images.id, imageId), eq(images.status, "approved"), lt(images.publicationExpiresAt, now)));
}

export async function expireForRetention(
  imageId: string,
  expectedStatus: ImageStatus,
): Promise<void> {
  await getDatabase()
    .update(images)
    .set({ status: "expired", tokenVersion: sql`${images.tokenVersion} + 1` })
    .where(and(eq(images.id, imageId), eq(images.status, expectedStatus), isNull(images.deletedAt)));
}

export async function listKnownBlobPaths(): Promise<Set<string>> {
  const rows = await getDatabase().select({ blobPath: images.blobPath }).from(images).where(isNull(images.deletedAt));
  return new Set(rows.map((row) => row.blobPath));
}

export async function listActiveStorageRecords(): Promise<Array<{ id: string; blobPath: string; status: ImageStatus }>> {
  return getDatabase()
    .select({ id: images.id, blobPath: images.blobPath, status: images.status })
    .from(images)
    .where(isNull(images.deletedAt));
}

export async function queueStats(now = new Date()): Promise<{ pending: number; nearExpiry: number }> {
  const near = new Date(now.getTime() + 6 * 60 * 60 * 1000);
  const [pending, nearExpiry] = await Promise.all([
    getDatabase().$count(images, and(eq(images.status, "pending_review"), isNull(images.deletedAt))),
    getDatabase().$count(
      images,
      and(eq(images.status, "pending_review"), isNull(images.deletedAt), lt(images.expiresAt, near)),
    ),
  ]);
  return { pending, nearExpiry };
}

export async function listAudit(imageId?: string, limit = 100) {
  return getDatabase().query.moderationAudit.findMany({
    where: imageId ? eq(moderationAudit.imageId, imageId) : undefined,
    orderBy: [desc(moderationAudit.createdAt)],
    limit,
  });
}
