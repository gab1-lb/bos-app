import { admin, associate, analyst, reader, pending } from '../data/personas';
import { getRepo } from '../data';
import type { MemoryRepo } from '../data/memoryRepo';
import type { Repo } from '../data';

export const isMemoryMode = () => process.env.NEXT_PUBLIC_DATA_MODE === 'memory';

/** Memory mode only: the "session" is this cookie, holding a persona id. */
export const MEMORY_COOKIE = 'bos_as';

export const PERSONA_BY_ROLE = { admin, associate, analyst, reader, pending } as const;
export type PersonaRole = keyof typeof PERSONA_BY_ROLE;

export function personaIdForRole(role: string | null | undefined): string | null {
  return role && Object.prototype.hasOwnProperty.call(PERSONA_BY_ROLE, role)
    ? PERSONA_BY_ROLE[role as PersonaRole].id
    : null;
}

export function memoryStatus(personaId: string | undefined): 'none' | 'pending' | 'active' {
  const p = Object.values(PERSONA_BY_ROLE).find((m) => m.id === personaId);
  return !p ? 'none' : p.status === 'pending' ? 'pending' : 'active';
}

/** Client-side memory repo acting as the persona named by the bos_as cookie. */
export function getMemorySessionRepo(): Repo {
  const repo = getRepo() as MemoryRepo;
  if (typeof document !== 'undefined') {
    const m = document.cookie.match(new RegExp(`(?:^|; )${MEMORY_COOKIE}=([^;]*)`));
    if (m) repo.asMember(decodeURIComponent(m[1]));
  }
  return repo;
}
