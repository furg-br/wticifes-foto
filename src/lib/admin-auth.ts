import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { auth } from "@/auth";
import type { AdminUserRecord, EventRecord } from "@/db/schema";
import { AppError } from "./app-error";
import { getAdminAllowlist, getAdminAuditSecret, getPublicAppUrl, isAdminAuthConfigured } from "./env";
import {
  ensureAdminUser,
  findAccessibleEvent,
  findAdminUserByEmail,
  hasAnyEventAccess,
  normalizeAdminEmail,
} from "./event-repository";

export function isAllowedAdminEmail(email: string | null | undefined): email is string {
  return Boolean(email && getAdminAllowlist().has(normalizeAdminEmail(email)));
}

async function sessionEmail(): Promise<string> {
  if (!isAdminAuthConfigured()) {
    throw new AppError("ADMIN_AUTH_NOT_CONFIGURED", 503, "A autenticação administrativa não está configurada.");
  }
  let session;
  try {
    session = await auth();
  } catch (error) {
    throw new AppError("ADMIN_AUTH_FAILED", 503, "Não foi possível validar a sessão administrativa.", {
      cause: error,
    });
  }
  const email = session?.user?.email;
  if (!email) throw new AppError("ADMIN_FORBIDDEN", 403, "Acesso administrativo não autorizado.");
  return normalizeAdminEmail(email);
}

export async function requireAdminIdentity(): Promise<AdminUserRecord> {
  const email = await sessionEmail();
  const bootstrap = isAllowedAdminEmail(email);
  const existing = await findAdminUserByEmail(email);
  if (existing?.active) return existing;
  if (bootstrap) return ensureAdminUser(email, undefined, true);
  throw new AppError("ADMIN_FORBIDDEN", 403, "Acesso administrativo não autorizado.");
}

export async function requireAdmin(): Promise<AdminUserRecord> {
  const user = await requireAdminIdentity();
  if (!(await hasAnyEventAccess(user))) {
    throw new AppError("ADMIN_FORBIDDEN", 403, "Acesso administrativo não autorizado.");
  }
  return user;
}

export async function requireSuperAdmin(): Promise<AdminUserRecord> {
  const user = await requireAdmin();
  if (!user.isSuperAdmin) {
    throw new AppError("ADMIN_FORBIDDEN", 403, "Esta operação exige administração geral.");
  }
  return user;
}

export async function requireEventAdmin(slug: string): Promise<{ admin: AdminUserRecord; event: EventRecord }> {
  const admin = await requireAdmin();
  const event = await findAccessibleEvent(admin, slug);
  if (!event) throw new AppError("ADMIN_FORBIDDEN", 403, "Você não administra este espaço.");
  return { admin, event };
}

function csrfSignature(encoded: string, email: string): string {
  return createHmac("sha256", getAdminAuditSecret())
    .update(`csrf:${email}:${encoded}`)
    .digest("base64url");
}

export function createAdminCsrfToken(email: string, now = new Date()): string {
  const payload = Buffer.from(
    JSON.stringify({ e: Math.floor(now.getTime() / 1000) + 15 * 60, n: randomBytes(16).toString("base64url") }),
    "utf8",
  ).toString("base64url");
  return `${payload}.${csrfSignature(payload, email)}`;
}

export function verifyAdminCsrfToken(token: string, email: string, now = new Date()): boolean {
  const [payload = "", received = "", extra] = token.split(".");
  if (extra !== undefined || !payload || !received) return false;
  const expected = csrfSignature(payload, email);
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as unknown;
    return Boolean(
      typeof parsed === "object" &&
        parsed !== null &&
        "e" in parsed &&
        typeof parsed.e === "number" &&
        parsed.e > Math.floor(now.getTime() / 1000),
    );
  } catch {
    return false;
  }
}

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const expected = getPublicAppUrl() ?? new URL(request.url).origin;
  if (!origin || origin !== expected) {
    throw new AppError("CSRF_ORIGIN_INVALID", 403, "Origem da operação administrativa inválida.");
  }
}

export function assertAdminCsrf(request: Request, token: string, email: string): void {
  assertSameOrigin(request);
  if (!verifyAdminCsrfToken(token, email)) {
    throw new AppError("CSRF_INVALID", 403, "Proteção CSRF inválida ou expirada.");
  }
}
