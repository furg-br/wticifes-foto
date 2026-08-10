import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import {
  adminInvitations,
  adminUsers,
  eventAdmins,
  events,
  type AdminUserRecord,
  type EventRecord,
} from "@/db/schema";
import { getDatabase } from "@/db/client";
import { generateOpaqueToken, sha256 } from "./crypto-tokens";
import { DEFAULT_EVENT_RECORD } from "./default-event";

export const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "_next",
  "privacidade",
  "termos",
  "vitrine",
  "favicon.ico",
  "openapi.json",
  "openapi.yaml",
]);

export function normalizeAdminEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function findEventBySlug(slug: string): Promise<EventRecord | undefined> {
  return getDatabase().query.events.findFirst({ where: eq(events.slug, slug.toLowerCase()) });
}

export async function findActiveEventBySlug(slug: string): Promise<EventRecord | undefined> {
  return getDatabase().query.events.findFirst({
    where: and(eq(events.slug, slug.toLowerCase()), eq(events.status, "active")),
  });
}

export async function resolvePublicEvent(slug: string): Promise<EventRecord | undefined> {
  try {
    return await findActiveEventBySlug(slug);
  } catch (error) {
    if (process.env.NODE_ENV !== "production" && slug === DEFAULT_EVENT_RECORD.slug) {
      return DEFAULT_EVENT_RECORD;
    }
    throw error;
  }
}

export async function findAdminUserByEmail(email: string): Promise<AdminUserRecord | undefined> {
  return getDatabase().query.adminUsers.findFirst({
    where: eq(adminUsers.email, normalizeAdminEmail(email)),
  });
}

export async function ensureAdminUser(
  email: string,
  name?: string | null,
  isSuperAdmin = false,
): Promise<AdminUserRecord> {
  const normalized = normalizeAdminEmail(email);
  const [user] = await getDatabase()
    .insert(adminUsers)
    .values({
      email: normalized,
      name: name?.trim() || null,
      isSuperAdmin,
      lastLoginAt: new Date(),
    })
    .onConflictDoUpdate({
      target: adminUsers.email,
      set: {
        ...(name?.trim() ? { name: name.trim() } : {}),
        ...(isSuperAdmin ? { isSuperAdmin: true } : {}),
        lastLoginAt: new Date(),
      },
    })
    .returning();
  if (!user) throw new Error("Não foi possível registrar o administrador.");
  return user;
}

export async function isAdminEmailEligible(email: string, now = new Date()): Promise<boolean> {
  const normalized = normalizeAdminEmail(email);
  const user = await findAdminUserByEmail(normalized);
  if (user?.active && user.isSuperAdmin) return true;
  if (user?.active) {
    const membership = await getDatabase().query.eventAdmins.findFirst({
      where: and(eq(eventAdmins.userId, user.id), eq(eventAdmins.active, true)),
    });
    if (membership) return true;
  }
  const invitation = await getDatabase().query.adminInvitations.findFirst({
    where: and(
      eq(adminInvitations.email, normalized),
      gt(adminInvitations.expiresAt, now),
      isNull(adminInvitations.acceptedAt),
      isNull(adminInvitations.revokedAt),
    ),
  });
  return Boolean(invitation);
}

export async function listEventsForAdmin(user: AdminUserRecord): Promise<EventRecord[]> {
  if (user.isSuperAdmin) {
    return getDatabase().query.events.findMany({ orderBy: [desc(events.createdAt)] });
  }
  const rows = await getDatabase()
    .select({ event: events })
    .from(eventAdmins)
    .innerJoin(events, eq(events.id, eventAdmins.eventId))
    .where(and(eq(eventAdmins.userId, user.id), eq(eventAdmins.active, true)))
    .orderBy(desc(events.createdAt));
  return rows.map((row) => row.event);
}

export async function hasEventAccess(user: AdminUserRecord, eventId: string): Promise<boolean> {
  if (!user.active) return false;
  if (user.isSuperAdmin) return true;
  const membership = await getDatabase().query.eventAdmins.findFirst({
    where: and(
      eq(eventAdmins.eventId, eventId),
      eq(eventAdmins.userId, user.id),
      eq(eventAdmins.active, true),
    ),
  });
  return Boolean(membership);
}

export async function hasAnyEventAccess(user: AdminUserRecord): Promise<boolean> {
  if (!user.active) return false;
  if (user.isSuperAdmin) return true;
  const membership = await getDatabase().query.eventAdmins.findFirst({
    where: and(eq(eventAdmins.userId, user.id), eq(eventAdmins.active, true)),
  });
  return Boolean(membership);
}

export interface CreateEventInput {
  slug: string;
  name: string;
  createdBy: string;
}

export async function createEvent(input: CreateEventInput): Promise<EventRecord> {
  const name = input.name.trim();
  const [created] = await getDatabase()
    .insert(events)
    .values({
      slug: input.slug.toLowerCase(),
      name,
      status: "draft",
      pageTitle: name,
      pageSubtitle: "Envie sua foto e receba uma versão personalizada com a identidade do evento.",
      uploadTitle: "Crie sua foto",
      uploadLabel: "Escolha uma foto JPG, PNG ou WebP (até 12 MB)",
      submitLabel: "Personalizar foto",
      consentText: `Autorizo a exibição pública desta imagem nas telas e na vitrine de ${name}, sujeita à revisão humana.`,
      successMessage: "Pronto. Sua arte continua privada. Guarde o código de revogação antes de fechar a página.",
      showcaseTitle: name,
      showcaseEmptyText: "Novas fotos aparecerão aqui em breve.",
      logoPath: "builtin:wticifes-logo",
      sideImagePath: "builtin:wticifes-phrase",
      createdBy: normalizeAdminEmail(input.createdBy),
    })
    .returning();
  if (!created) throw new Error("Não foi possível cadastrar o evento.");
  return created;
}

export interface EventSettingsInput {
  name: string;
  status: "draft" | "active" | "suspended" | "archived";
  pageTitle: string;
  pageSubtitle: string;
  uploadTitle: string;
  uploadLabel: string;
  submitLabel: string;
  consentText: string;
  successMessage: string;
  showcaseTitle: string;
  showcaseEmptyText: string;
}

export async function updateEventSettings(eventId: string, input: EventSettingsInput): Promise<EventRecord> {
  const [updated] = await getDatabase()
    .update(events)
    .set({ ...input, configVersion: sql`${events.configVersion} + 1`, updatedAt: new Date() })
    .where(eq(events.id, eventId))
    .returning();
  if (!updated) throw new Error("Evento não encontrado.");
  return updated;
}

export async function updateEventAsset(
  eventId: string,
  kind: "logo" | "side",
  pathname: string,
): Promise<EventRecord> {
  const [updated] = await getDatabase()
    .update(events)
    .set({
      ...(kind === "logo" ? { logoPath: pathname } : { sideImagePath: pathname }),
      configVersion: sql`${events.configVersion} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(events.id, eventId))
    .returning();
  if (!updated) throw new Error("Evento não encontrado.");
  return updated;
}

export async function incrementEventConfigVersion(eventId: string): Promise<void> {
  const current = await getDatabase().query.events.findFirst({ where: eq(events.id, eventId) });
  if (!current) return;
  await getDatabase()
    .update(events)
    .set({ configVersion: current.configVersion + 1, updatedAt: new Date() })
    .where(eq(events.id, eventId));
}

export interface EventPerson {
  id: string;
  email: string;
  name: string | null;
  active: boolean;
  createdAt: Date;
}

export async function listEventPeople(eventId: string): Promise<EventPerson[]> {
  const rows = await getDatabase()
    .select({
      id: adminUsers.id,
      email: adminUsers.email,
      name: adminUsers.name,
      active: eventAdmins.active,
      createdAt: eventAdmins.createdAt,
    })
    .from(eventAdmins)
    .innerJoin(adminUsers, eq(adminUsers.id, eventAdmins.userId))
    .where(eq(eventAdmins.eventId, eventId))
    .orderBy(desc(eventAdmins.createdAt));
  return rows;
}

export async function listPendingInvitations(eventId: string, now = new Date()) {
  return getDatabase().query.adminInvitations.findMany({
    where: and(
      eq(adminInvitations.eventId, eventId),
      gt(adminInvitations.expiresAt, now),
      isNull(adminInvitations.acceptedAt),
      isNull(adminInvitations.revokedAt),
    ),
    orderBy: [desc(adminInvitations.createdAt)],
  });
}

export async function createAdminInvitation(eventId: string, email: string, invitedBy: string) {
  const normalized = normalizeAdminEmail(email);
  const inviter = await findAdminUserByEmail(invitedBy);
  const existing = await findAdminUserByEmail(normalized);
  if (existing) {
    await getDatabase()
      .insert(eventAdmins)
      .values({ eventId, userId: existing.id, active: true, grantedBy: inviter?.id })
      .onConflictDoUpdate({
        target: [eventAdmins.eventId, eventAdmins.userId],
        set: { active: true, grantedBy: inviter?.id ?? null },
      });
    return { alreadyRegistered: true as const, token: undefined };
  }

  await getDatabase()
    .update(adminInvitations)
    .set({ revokedAt: new Date() })
    .where(and(
      eq(adminInvitations.eventId, eventId),
      eq(adminInvitations.email, normalized),
      isNull(adminInvitations.acceptedAt),
      isNull(adminInvitations.revokedAt),
    ));

  const token = generateOpaqueToken();
  await getDatabase().insert(adminInvitations).values({
    eventId,
    email: normalized,
    tokenHash: sha256(token),
    invitedBy: inviter?.id,
    expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
  });
  return { alreadyRegistered: false as const, token };
}

export async function acceptAdminInvitation(token: string, email: string): Promise<EventRecord | undefined> {
  const normalized = normalizeAdminEmail(email);
  const now = new Date();
  const invitation = await getDatabase().query.adminInvitations.findFirst({
    where: and(
      eq(adminInvitations.tokenHash, sha256(token)),
      eq(adminInvitations.email, normalized),
      gt(adminInvitations.expiresAt, now),
      isNull(adminInvitations.acceptedAt),
      isNull(adminInvitations.revokedAt),
    ),
  });
  if (!invitation) return undefined;
  const user = await ensureAdminUser(normalized);
  await getDatabase()
    .insert(eventAdmins)
    .values({ eventId: invitation.eventId, userId: user.id, active: true, grantedBy: invitation.invitedBy })
    .onConflictDoUpdate({
      target: [eventAdmins.eventId, eventAdmins.userId],
      set: { active: true, grantedBy: invitation.invitedBy },
    });
  await getDatabase()
    .update(adminInvitations)
    .set({ acceptedAt: now })
    .where(eq(adminInvitations.id, invitation.id));
  return getDatabase().query.events.findFirst({ where: eq(events.id, invitation.eventId) });
}

export async function setEventAdminActive(eventId: string, userId: string, active: boolean): Promise<boolean> {
  const [updated] = await getDatabase()
    .update(eventAdmins)
    .set({ active })
    .where(and(eq(eventAdmins.eventId, eventId), eq(eventAdmins.userId, userId)))
    .returning({ userId: eventAdmins.userId });
  return Boolean(updated);
}

export async function findAnyInvitationForEmail(email: string, now = new Date()) {
  return getDatabase().query.adminInvitations.findFirst({
    where: and(
      eq(adminInvitations.email, normalizeAdminEmail(email)),
      gt(adminInvitations.expiresAt, now),
      isNull(adminInvitations.acceptedAt),
      isNull(adminInvitations.revokedAt),
    ),
  });
}

export async function findAccessibleEvent(user: AdminUserRecord, slug: string): Promise<EventRecord | undefined> {
  const event = await findEventBySlug(slug);
  if (!event || !(await hasEventAccess(user, event.id))) return undefined;
  return event;
}

export async function revokeInvitation(eventId: string, invitationId: string): Promise<boolean> {
  const [updated] = await getDatabase()
    .update(adminInvitations)
    .set({ revokedAt: new Date() })
    .where(and(
      eq(adminInvitations.id, invitationId),
      eq(adminInvitations.eventId, eventId),
      isNull(adminInvitations.acceptedAt),
      isNull(adminInvitations.revokedAt),
    ))
    .returning({ id: adminInvitations.id });
  return Boolean(updated);
}

export async function findInvitationByToken(token: string) {
  return getDatabase().query.adminInvitations.findFirst({
    where: and(
      eq(adminInvitations.tokenHash, sha256(token)),
      gt(adminInvitations.expiresAt, new Date()),
      isNull(adminInvitations.acceptedAt),
      isNull(adminInvitations.revokedAt),
    ),
  });
}
