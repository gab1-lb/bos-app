import type { Member } from '../domain/permissions';

const mk = (id: string, name: string, role: Member['role'], status: Member['status']): Member => ({
  id, email: `${id}@example.com`, name, avatarUrl: null, role, status, locale: 'fr',
});

export const admin: Member = mk('u-admin', 'Alice Admin', 'admin', 'active');
export const associate: Member = mk('u-associate', 'Aron Associate', 'associate', 'active');
export const analyst: Member = mk('u-analyst', 'Anna Analyst', 'analyst', 'active');
export const reader: Member = mk('u-reader', 'Rita Reader', 'reader', 'active');
export const pending: Member = mk('u-pending', 'Paul Pending', null, 'pending');

export const PERSONAS: Member[] = [admin, associate, analyst, reader, pending];
