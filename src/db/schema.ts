import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { IMAGE_STATUSES } from "@/lib/constants";

export const DEFAULT_EVENT_ID = "00000000-0000-4000-8000-000000000001";
export const DEFAULT_EVENT_SLUG = "wticifes-2026";

export const imageStatus = pgEnum("image_status", IMAGE_STATUSES);

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: varchar("slug", { length: 63 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    status: varchar("status", { length: 24 }).notNull().default("draft"),
    pageTitle: varchar("page_title", { length: 160 }).notNull(),
    pageSubtitle: varchar("page_subtitle", { length: 500 }).notNull(),
    uploadTitle: varchar("upload_title", { length: 120 }).notNull().default("Crie sua foto"),
    uploadLabel: varchar("upload_label", { length: 240 }).notNull(),
    submitLabel: varchar("submit_label", { length: 80 }).notNull().default("Personalizar foto"),
    consentText: varchar("consent_text", { length: 1000 }).notNull(),
    successMessage: varchar("success_message", { length: 500 }).notNull(),
    showcaseTitle: varchar("showcase_title", { length: 160 }).notNull(),
    showcaseEmptyText: varchar("showcase_empty_text", { length: 240 }).notNull(),
    logoPath: text("logo_path").notNull(),
    sideImagePath: text("side_image_path").notNull(),
    faviconPath: text("favicon_path").notNull().default("builtin:wticifes-favicon"),
    configVersion: integer("config_version").notNull().default(1),
    createdBy: varchar("created_by", { length: 320 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("events_slug_uidx").on(table.slug),
    index("events_status_idx").on(table.status),
  ],
);

export const adminUsers = pgTable(
  "admin_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 320 }).notNull(),
    name: varchar("name", { length: 160 }),
    active: boolean("active").notNull().default(true),
    isSuperAdmin: boolean("is_super_admin").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  },
  (table) => [uniqueIndex("admin_users_email_uidx").on(table.email)],
);

export const eventAdmins = pgTable(
  "event_admins",
  {
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 32 }).notNull().default("event_admin"),
    active: boolean("active").notNull().default(true),
    grantedBy: uuid("granted_by").references(() => adminUsers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.eventId, table.userId] }),
    index("event_admins_user_idx").on(table.userId, table.active),
  ],
);

export const adminInvitations = pgTable(
  "admin_invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 320 }).notNull(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    invitedBy: uuid("invited_by").references(() => adminUsers.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("admin_invitations_token_uidx").on(table.tokenHash),
    index("admin_invitations_email_idx").on(table.email, table.expiresAt),
    index("admin_invitations_event_idx").on(table.eventId, table.createdAt),
  ],
);

export const images = pgTable(
  "images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .default(DEFAULT_EVENT_ID)
      .references(() => events.id, { onDelete: "restrict" }),
    eventConfigVersion: integer("event_config_version").notNull().default(1),
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
    uniqueIndex("images_event_active_content_hash_uidx")
      .on(table.eventId, table.contentHash)
      .where(sql`${table.deletedAt} is null`),
    uniqueIndex("images_event_request_key_hash_uidx")
      .on(table.eventId, table.requestKeyHash)
      .where(sql`${table.requestKeyHash} is not null and ${table.deletedAt} is null`),
    index("images_event_status_idx").on(table.eventId, table.status),
    index("images_created_at_idx").on(table.createdAt),
    index("images_publication_expires_at_idx").on(table.publicationExpiresAt),
    index("images_event_feed_idx").on(table.eventId, table.status, table.publicationExpiresAt, table.lastDisplayedAt),
    index("images_event_participant_key_hash_idx").on(table.eventId, table.participantKeyHash),
  ],
);

export const moderationAudit = pgTable(
  "moderation_audit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .default(DEFAULT_EVENT_ID)
      .references(() => events.id, { onDelete: "restrict" }),
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
    index("moderation_audit_event_idx").on(table.eventId, table.createdAt),
    index("moderation_audit_image_idx").on(table.imageId, table.createdAt),
    index("moderation_audit_created_at_idx").on(table.createdAt),
  ],
);

export const blockedParticipants = pgTable(
  "blocked_participants",
  {
    eventId: uuid("event_id")
      .notNull()
      .default(DEFAULT_EVENT_ID)
      .references(() => events.id, { onDelete: "cascade" }),
    participantKeyHash: varchar("participant_key_hash", { length: 64 }).notNull(),
    blockedAt: timestamp("blocked_at", { withTimezone: true }).notNull().defaultNow(),
    blockedBy: varchar("blocked_by", { length: 64 }).notNull(),
    reason: varchar("reason", { length: 500 }),
    sourceImageId: uuid("source_image_id")
      .notNull()
      .references(() => images.id, { onDelete: "restrict" }),
  },
  (table) => [
    primaryKey({ columns: [table.eventId, table.participantKeyHash] }),
    index("blocked_participants_blocked_at_idx").on(table.blockedAt),
  ],
);

export type EventRecord = typeof events.$inferSelect;
export type AdminUserRecord = typeof adminUsers.$inferSelect;
export type ImageRecord = typeof images.$inferSelect;
