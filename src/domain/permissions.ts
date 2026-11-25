import type { Locale } from '../i18n/format';
import type { DealMeta, Phase } from './phases';

export type Role = 'admin' | 'associate' | 'analyst' | 'reader';
export type MemberStatus = 'pending' | 'active' | 'denied';
export type Member = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: Role | null;
  status: MemberStatus;
  locale: Locale;
};

export type Action =
  | 'read' | 'edit' | 'create'
  | `setPhase:${Phase}`
  | 'validateBote' | 'decide' | 'delete' | 'archive' | 'setOwner'
  | 'manageMembers' | 'manageMandate' | 'manageTemplates' | 'import';

const ANALYST_PHASES: string[] = ['im_received', 'analysis', 'bote_written'];

export function can(member: Member, action: Action, deal?: DealMeta): boolean {
  if (member.status !== 'active' || !member.role) return false;
  const role = member.role;
  if (action === 'read') return true;
  if (role === 'reader') return false;
  const senior = role === 'admin' || role === 'associate';

  if (action === 'edit' || action === 'create') return true;
  if (action.startsWith('setPhase:')) {
    // analysts move deals only within phases 1-3: both the target and the current phase (no deal: fail closed)
    return senior || (ANALYST_PHASES.includes(action.slice(9)) && !!deal && ANALYST_PHASES.includes(deal.phase));
  }
  if (action === 'archive') return senior || deal?.ownerId === member.id;
  if (action === 'validateBote') return senior && deal?.ownerId !== member.id;
  // as set_owner: never mid-review (a senior owner could hand the deal away and validate their own BOTe)
  if (action === 'setOwner') return senior && !!deal && deal.phase !== 'associate_review';
  if (action === 'decide' || action === 'delete' || action === 'import') {
    return senior;
  }
  // manageMembers | manageMandate | manageTemplates
  return role === 'admin';
}
