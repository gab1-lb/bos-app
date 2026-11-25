import { admin, associate, analyst, reader, pending } from '../data/personas';
import { getRepo } from '../data';
import type { MemoryRepo } from '../data/memoryRepo';
import type { Repo } from '../data';
import type { Member, MemberStatus, Role } from '../domain/permissions';

export const isMemoryMode = () => process.env.NEXT_PUBLIC_DATA_MODE === 'memory';
/** Public demo build (memory data, visitors enter without an account). */
export const isDemo = () => isMemoryMode() && process.env.NEXT_PUBLIC_DEMO === '1';
/** Role a demo visitor starts with. */
export const DEMO_ROLE = 'analyst';

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

/** Client-side memory repo acting as the persona named by the bos_as cookie, with earlier admin decisions applied. */
export function getMemorySessionRepo(): Repo {
  const repo = getRepo() as MemoryRepo;
  if (typeof document === 'undefined') return repo;
  for (const [id, p] of Object.entries(parseOverrides(readCookie(MEMORY_MEMBERS_COOKIE)))) repo.overrideMember(id, p);
  const m = readCookie(MEMORY_COOKIE);
  if (m) repo.asMember(decodeURIComponent(m));
  return {
    ...repo,
    async setMember(id: string, patch: Partial<Pick<Member, 'role' | 'status'>>) {
      await repo.setMember(id, patch);
      const all = parseOverrides(readCookie(MEMORY_MEMBERS_COOKIE));
      all[id] = { ...all[id], ...patch };
      document.cookie = `${MEMORY_MEMBERS_COOKIE}=${encodeURIComponent(JSON.stringify(all))}; path=/; samesite=lax`;
    },
  };
}
