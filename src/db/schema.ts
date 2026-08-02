import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { IMAGE_STATUSES } from "@/lib/constants";

export const imageStatus = pgEnum("image_status", IMAGE_STATUSES);

export const images = pgTable(
  "images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blobPath: text("blob_path").notNull(),
    contentHash: varchar("content_hash", { length: 64 }).notNull(),
    status: imageStatus("status").notNull().default("private"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consentedAt: timestamp("consented_at", { withTimezone: true }),
    consentVersion: varchar("consent_version", { length: 64 }),
    consentTokenHash: varchar("consent_token_hash", { length: 64 }),
    consentTokenExpiresAt: timestamp("consent_token_expires_at", { withTimezone: true }),
    consentTokenUsedAt: timestamp("consent_token_used_at", { withTimezone: true }),
    revocationTokenHash: varchar("revocation_token_hash", { length: 64 }).notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedBy: varchar("approved_by", { length: 64 }),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    rejectedBy: varchar("rejected_by", { length: 64 }),
    rejectionReason: varchar("rejection_reason", { length: 500 }),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    removedBy: varchar("removed_by", { length: 64 }),
    participantKeyHash: varchar("participant_key_hash", { length: 64 }),
    requestKeyHash: varchar("request_key_hash", { length: 64 }),
    publicationExpiresAt: timestamp("publication_expires_at", { withTimezone: true }),
    tokenVersion: integer("token_version").notNull().default(1),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    lastDisplayedAt: timestamp("last_displayed_at", { withTimezone: true }),
    displayCount: integer("display_count").notNull().default(0),
    safetyPriority: integer("safety_priority").notNull().default(0),
    safetyFlags: text("safety_flags").array(),
  },
  (table) => [
    uniqueIndex("images_active_content_hash_uidx")
      .on(table.contentHash)
      .where(sql`${table.deletedAt} is null`),
    uniqueIndex("images_request_key_hash_uidx")
      .on(table.requestKeyHash)
      .where(sql`${table.requestKeyHash} is not null and ${table.deletedAt} is null`),
    index("images_status_idx").on(table.status),
    index("images_created_at_idx").on(table.createdAt),
    index("images_publication_expires_at_idx").on(table.publicationExpiresAt),
    index("images_feed_idx").on(table.status, table.publicationExpiresAt, table.lastDisplayedAt),
    index("images_participant_key_hash_idx").on(table.participantKeyHash),
  ],
);

export const moderationAudit = pgTable(
  "moderation_audit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    imageId: uuid("image_id")
      .notNull()
      .references(() => images.id, { onDelete: "restrict" }),
    moderatorId: varchar("moderator_id", { length: 64 }).notNull(),
    action: varchar("action", { length: 64 }).notNull(),
    previousStatus: imageStatus("previous_status").notNull(),
    newStatus: imageStatus("new_status").notNull(),
    reason: varchar("reason", { length: 500 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    requestId: varchar("request_id", { length: 128 }).notNull(),
  },
  (table) => [
    index("moderation_audit_image_idx").on(table.imageId, table.createdAt),
    index("moderation_audit_created_at_idx").on(table.createdAt),
  ],
);

export const blockedParticipants = pgTable(
  "blocked_participants",
  {
    participantKeyHash: varchar("participant_key_hash", { length: 64 }).primaryKey(),
    blockedAt: timestamp("blocked_at", { withTimezone: true }).notNull().defaultNow(),
    blockedBy: varchar("blocked_by", { length: 64 }).notNull(),
    reason: varchar("reason", { length: 500 }),
    sourceImageId: uuid("source_image_id")
      .notNull()
      .references(() => images.id, { onDelete: "restrict" }),
  },
  (table) => [index("blocked_participants_blocked_at_idx").on(table.blockedAt)],
);

export type ImageRecord = typeof images.$inferSelect;
