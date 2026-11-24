import type { SupabaseClient } from '@supabase/supabase-js';
import { createMemoryRepo } from './memoryRepo';
import { createSupabaseRepo } from './supabaseRepo';
import { RepoError, type Repo } from './repo';

export * from './repo';
export { createMemoryRepo } from './memoryRepo';
export { createSupabaseRepo } from './supabaseRepo';

let memory: Repo | null = null;

/** Memory repo (module-level singleton) when NEXT_PUBLIC_DATA_MODE === 'memory', else Supabase (needs a client). */
export function getRepo(client?: SupabaseClient): Repo {
  if (process.env.NEXT_PUBLIC_DATA_MODE === 'memory') return (memory ??= createMemoryRepo());
  if (!client) throw new RepoError('invalid', 'getRepo: a Supabase client is required outside memory mode');
  return createSupabaseRepo(client);
}
