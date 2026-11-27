import { admin, associate, analyst, reader, pending } from '../data/personas';
import { getRepo } from '../data';
import type { MemoryRepo } from '../data/memoryRepo';
import type { Repo } from '../data';
import type { Member, MemberStatus, Role } from '../domain/permissions';
import { markDemo } from './demo/signals';
import { isDemo } from './mode';

export { isDemo, isMemoryMode } from './mode';
/** Roles a demo visitor can try (welcome screen, demo bar, `/login?as=` links). */
export type DemoRole = 'associate' | 'analyst' | 'admin';
const DEMO_ROLES: readonly DemoRole[] = ['associate', 'analyst', 'admin'];
export const demoRoleFrom = (v: string | null | undefined): DemoRole | null =>
  DEMO_ROLES.includes(v as DemoRole) ? (v as DemoRole) : null;

/** Memory mode only: the "session" is this cookie, holding a persona id. */
export const MEMORY_COOKIE = 'bos_as';
/** Memory mode only: role / status changes made by an admin, so the gate and the next page load see them. */
export const MEMORY_MEMBERS_COOKIE = 'bos_members';

export type MemberOverrides = Record<string, { role?: Role | null; status?: MemberStatus }>;

export const PERSONA_BY_ROLE = { admin, associate, analyst, reader, pending } as const;
export type PersonaRole = keyof typeof PERSONA_BY_ROLE;

export function personaIdForRole(role: string | null | undefined): string | null {
  return role && Object.prototype.hasOwnProperty.call(PERSONA_BY_ROLE, role)
    ? PERSONA_BY_ROLE[role as PersonaRole].id
    : null;
}

const ROLES: (Role | null)[] = ['admin', 'associate', 'analyst', 'reader', null];
const STATUSES: MemberStatus[] = ['pending', 'active', 'denied'];

/** Lenient parse of the overrides cookie value (anything malformed is ignored). */
export function parseOverrides(raw: string | null | undefined): MemberOverrides {
  if (!raw) return {};
  try {
    const v: unknown = JSON.parse(decodeURIComponent(raw));
    if (typeof v !== 'object' || v === null || Array.isArray(v)) return {};
    const out: MemberOverrides = {};
    for (const [id, p] of Object.entries(v as Record<string, unknown>)) {
      if (typeof p !== 'object' || p === null) continue;
      const { role, status } = p as { role?: unknown; status?: unknown };
      const o: MemberOverrides[string] = {};
      if (role !== undefined && ROLES.includes(role as Role | null)) o.role = role as Role | null;
      if (status !== undefined && STATUSES.includes(status as MemberStatus)) o.status = status as MemberStatus;
      out[id] = o;
    }
    return out;
  } catch {
    return {};
  }
}

export function memoryStatus(personaId: string | undefined, overrides: MemberOverrides = {}): 'none' | MemberStatus {
  const p = Object.values(PERSONA_BY_ROLE).find((m) => m.id === personaId);
  if (!p) return 'none';
  const status = overrides[p.id]?.status ?? p.status;
  const role = overrides[p.id]?.role !== undefined ? overrides[p.id].role : p.role;
  return status === 'active' && !role ? 'pending' : status;
}

function readCookie(name: string): string | undefined {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? m[1] : undefined;
}

/** Demo: the role remembered by the bos_as cookie, when the browser kept one. */
export function rememberedDemoRole(): DemoRole | null {
  if (typeof document === 'undefined') return null;
  const id = readCookie(MEMORY_COOKIE); // persona ids are URL-safe: no decoding needed
  return DEMO_ROLES.find((r) => PERSONA_BY_ROLE[r].id === id) ?? null;
}

/** Client-side memory repo acting as the persona named by the bos_as cookie, with earlier admin decisions applied. */
export function getMemorySessionRepo(): Repo {
  const repo = getRepo() as MemoryRepo;
  if (typeof document === 'undefined') return repo;
  for (const [id, p] of Object.entries(parseOverrides(readCookie(MEMORY_MEMBERS_COOKIE)))) repo.overrideMember(id, p);
  if (isDemo()) {
    // Without a remembered role, the persona stays the one picked earlier in this page life (welcome, demo bar).
    const role = rememberedDemoRole();
    if (role) repo.asMember(PERSONA_BY_ROLE[role].id);
  } else {
    const m = readCookie(MEMORY_COOKIE);
    if (m) repo.asMember(decodeURIComponent(m));
  }
  const session: Repo = {
    ...repo,
    async setMember(id: string, patch: Partial<Pick<Member, 'role' | 'status'>>) {
      await repo.setMember(id, patch);
      const all = parseOverrides(readCookie(MEMORY_MEMBERS_COOKIE));
      all[id] = { ...all[id], ...patch };
      document.cookie = `${MEMORY_MEMBERS_COOKIE}=${encodeURIComponent(JSON.stringify(all))}; path=/; samesite=lax`;
    },
  };
  if (isDemo()) {
    // "À essayer" checklist: any saved edit to a deal ticks « Compléter une donnée manquante ».
    Object.assign(session, {
      async patchDeal(...a: Parameters<Repo['patchDeal']>) { await repo.patchDeal(...a); markDemo('edit'); },
      async updateItem(...a: Parameters<Repo['updateItem']>) { await repo.updateItem(...a); markDemo('edit'); },
      async appendItem(...a: Parameters<Repo['appendItem']>) { await repo.appendItem(...a); markDemo('edit'); },
    } satisfies Partial<Repo>);
  }
  return session;
}
