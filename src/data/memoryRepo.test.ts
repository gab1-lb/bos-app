import { describe, expect, it, vi } from 'vitest';
import { createMemoryRepo } from './memoryRepo';
import { admin, analyst, associate, reader, pending } from './personas';
import { RepoError } from './repo';
import { blankDeal, DEFAULT_MANDATE } from '../engine/samples';
import { DEFAULT_TEMPLATES } from '../domain/templates';

const fresh = () => createMemoryRepo({ now: () => new Date('2026-11-24T10:00:00Z') });
const firstId = async (r: ReturnType<typeof fresh>) => (await r.listDeals())[0].meta.id;
const code = async (p: Promise<unknown>) => p.then(() => 'ok', (e) => (e as RepoError).code);

describe('memoryRepo seed', () => {
  it('starts with the demo deal owned by the admin in analysis', async () => {
    const r = fresh();
    expect((await r.me())?.id).toBe(admin.id);
    const [d] = await r.listDeals();
    expect(d.deal.name).toBe('Projet Hélios');
    expect(d.meta).toMatchObject({ ownerId: admin.id, phase: 'analysis', id: d.deal.id });
    expect(await r.mandate()).toEqual(DEFAULT_MANDATE);
    expect(await r.templates()).toEqual(DEFAULT_TEMPLATES);
  });
  it('returns copies, not shared references', async () => {
    const r = fresh();
    const id = await firstId(r);
    (await r.getDeal(id))!.deal.name = 'X';
    expect((await r.getDeal(id))!.deal.name).toBe('Projet Hélios');
  });
});

describe('patchDeal / activity / subscribe', () => {
  it('keeps both of two patches on different paths', async () => {
    const r = fresh(); const id = await firstId(r);
    await r.patchDeal(id, ['thesis'], 'T');
    await r.patchDeal(id, ['dcf', 'wacc'], 9);
    const { deal } = (await r.getDeal(id))!;
    expect(deal.thesis).toBe('T');
    expect(deal.dcf.wacc).toBe(9);
  });
  it('rejects id patch, empty path and missing parent as invalid', async () => {
    const r = fresh(); const id = await firstId(r);
    expect(await code(r.patchDeal(id, ['id'], 'x'))).toBe('invalid');
    expect(await code(r.patchDeal(id, [], 'x'))).toBe('invalid');
    expect(await code(r.patchDeal(id, ['nope', 'x'], 1))).toBe('invalid');
    expect(await code(r.patchDeal('missing', ['thesis'], 'x'))).toBe('not_found');
  });
  it('notifies subscribers after patchDeal', async () => {
    const r = fresh(); const id = await firstId(r);
    const all = vi.fn(); const mine = vi.fn(); const other = vi.fn();
    r.subscribe(null, all); r.subscribe(id, mine); r.subscribe('other', other);
    const off = r.subscribe(id, other);
    off();
    await r.patchDeal(id, ['thesis'], 'T');
    expect(all).toHaveBeenCalledTimes(1);
    expect(mine).toHaveBeenCalledTimes(1);
    expect(other).not.toHaveBeenCalled();
  });
  it('records author and path in activity, newest first', async () => {
    const r = fresh(); const id = await firstId(r);
    await r.patchDeal(id, ['dcf', 'wacc'], 9);
    await r.patchDeal(id, ['thesis'], 'T');
    const [a, b] = await r.activity(id);
    expect(a).toMatchObject({ actorId: admin.id, kind: 'patch', path: 'thesis', newValue: 'T', dealId: id });
    expect(b).toMatchObject({ path: 'dcf.wacc', oldValue: 11, newValue: 9 });
    expect(a.id).toBeGreaterThan(b.id);
  });
});

describe('permissions mirror the database', () => {
  it('analyst cannot validate the BOTe; reader cannot edit', async () => {
    const r = fresh(); const id = await firstId(r);
    r.asMember(analyst.id);
    expect(await code(r.validateBote(id))).toBe('forbidden');
    r.asMember(reader.id);
    expect(await code(r.patchDeal(id, ['thesis'], 'x'))).toBe('forbidden');
    expect(await code(r.createDeal(blankDeal()))).toBe('forbidden');
    r.asMember(pending.id);
    expect(await r.listDeals()).toEqual([]);
    expect(await code(r.patchDeal(id, ['thesis'], 'x'))).toBe('forbidden');
  });
  it('validateBote: only in associate_review, not by owner', async () => {
    const r = fresh(); const id = await firstId(r);
    expect(await code(r.validateBote(id))).toBe('invalid');
    await r.setPhase(id, 'associate_review');
    expect(await code(r.validateBote(id))).toBe('forbidden'); // admin owns it
    r.asMember(associate.id);
    await r.validateBote(id);
    expect((await r.getDeal(id))!.meta).toMatchObject({ validatedBy: associate.id });
  });
  it('setPhase refuses decided; analyst limited to phases 1-3; leaving review clears validation', async () => {
    const r = fresh(); const id = await firstId(r);
    expect(await code(r.setPhase(id, 'decided'))).toBe('invalid');
    r.asMember(analyst.id);
    expect(await code(r.setPhase(id, 'committee'))).toBe('forbidden');
    await r.setPhase(id, 'bote_written');
    r.asMember(admin.id);
    await r.setPhase(id, 'associate_review');
    r.asMember(associate.id);
    await r.validateBote(id);
    await r.setPhase(id, 'analysis');
    expect((await r.getDeal(id))!.meta).toMatchObject({ phase: 'analysis', validatedBy: null, validatedAt: null });
    r.asMember(admin.id);
    await r.setPhase(id, 'committee');
    r.asMember(analyst.id);
    expect(await code(r.setPhase(id, 'analysis'))).toBe('forbidden');
  });
  it('decide, archive, delete rules', async () => {
    const r = fresh(); const id = await firstId(r);
    r.asMember(analyst.id);
    expect(await code(r.decide(id, 'go_dd'))).toBe('forbidden');
    expect(await code(r.archive(id, true))).toBe('forbidden'); // not owner
    expect(await code(r.deleteDeal(id))).toBe('forbidden');
    r.asMember(associate.id);
    expect(await code(r.decide(id, 'bogus' as never))).toBe('invalid');
    await r.decide(id, 'go_dd');
    expect((await r.getDeal(id))!.meta).toMatchObject({ phase: 'decided', decision: 'go_dd', decidedAt: '2026-11-24T10:00:00.000Z' });
    await r.setPhase(id, 'committee');
    expect((await r.getDeal(id))!.meta).toMatchObject({ decision: null, decidedAt: null });
    await r.archive(id, true);
    expect((await r.getDeal(id))!.meta.archived).toBe(true);
    await r.deleteDeal(id);
    expect(await r.getDeal(id)).toBeNull();
    expect(await code(r.deleteDeal(id))).toBe('not_found');
  });
  it('analyst can archive own deal', async () => {
    const r = fresh();
    r.asMember(analyst.id);
    const id = await r.createDeal(blankDeal('Mine'));
    const rec = (await r.getDeal(id))!;
    expect(rec.meta).toMatchObject({ ownerId: analyst.id, phase: 'im_received' });
    expect(rec.deal.id).toBe(id);
    await r.archive(id, true);
  });
  it('setOwner refused during associate_review, clears validation, checks new owner', async () => {
    const r = fresh(); const id = await firstId(r);
    await r.setPhase(id, 'associate_review');
    expect(await code(r.setOwner(id, analyst.id))).toBe('forbidden');
    await r.setPhase(id, 'committee');
    expect(await code(r.setOwner(id, reader.id))).toBe('invalid');
    expect(await code(r.setOwner(id, 'ghost'))).toBe('invalid');
    await r.setOwner(id, analyst.id);
    expect((await r.getDeal(id))!.meta).toMatchObject({ ownerId: analyst.id, validatedBy: null });
    r.asMember(analyst.id);
    expect(await code(r.setOwner(id, analyst.id))).toBe('forbidden');
  });
  it('contributors must be active members and are deduplicated', async () => {
    const r = fresh(); const id = await firstId(r);
    expect(await code(r.setContributors(id, [pending.id]))).toBe('invalid');
    await r.setContributors(id, [analyst.id, analyst.id]);
    expect((await r.getDeal(id))!.meta.contributorIds).toEqual([analyst.id]);
  });
  it('committee date', async () => {
    const r = fresh(); const id = await firstId(r);
    await r.setCommitteeDate(id, '2026-12-01');
    expect((await r.getDeal(id))!.meta.committeeDate).toBe('2026-12-01');
    await r.setCommitteeDate(id, null);
    expect((await r.getDeal(id))!.meta.committeeDate).toBeNull();
  });
  it('importDeal is senior-only, keeps meta, owner = importer', async () => {
    const r = fresh();
    const meta = { ...(await r.listDeals())[0].meta, phase: 'decided' as const, decision: 'no_go' as const, ownerId: 'x' };
    const { id: _id, ...rest } = meta; void _id;
    r.asMember(analyst.id);
    expect(await code(r.importDeal(blankDeal('Old'), rest))).toBe('forbidden');
    r.asMember(associate.id);
    const id = await r.importDeal(blankDeal('Old'), rest);
    expect((await r.getDeal(id))!.meta).toMatchObject({ ownerId: associate.id, phase: 'decided', decision: 'no_go' });
    expect(await code(r.importDeal(blankDeal('Bad'), { ...rest, decision: null }))).toBe('invalid');
  });
});

describe('members, invites, mandate, templates, locale', () => {
  it('admin-only management', async () => {
    const r = fresh();
    await r.setMember(pending.id, { role: 'analyst', status: 'active' });
    expect((await r.members()).find((m) => m.id === pending.id)).toMatchObject({ role: 'analyst', status: 'active' });
    await r.invite('New@Example.com', 'reader');
    await r.setMandate({ ...DEFAULT_MANDATE, hurdle: 20 });
    await r.saveTemplate({ ...DEFAULT_TEMPLATES[0], subject: 'S' });
    expect((await r.mandate()).hurdle).toBe(20);
    const t = (await r.templates()).filter((x) => x.key === DEFAULT_TEMPLATES[0].key && x.locale === DEFAULT_TEMPLATES[0].locale);
    expect(t).toHaveLength(1);
    expect(t[0].subject).toBe('S');
    r.asMember(associate.id);
    expect(await code(r.setMember(analyst.id, { role: 'admin' }))).toBe('forbidden');
    expect(await code(r.invite('a@b.c', 'reader'))).toBe('forbidden');
    expect(await code(r.setMandate(DEFAULT_MANDATE))).toBe('forbidden');
    expect(await code(r.saveTemplate(DEFAULT_TEMPLATES[0]))).toBe('forbidden');
  });
  it('setMyLocale updates own member only', async () => {
    const r = fresh();
    r.asMember(reader.id);
    await r.setMyLocale('en');
    expect((await r.me())!.locale).toBe('en');
    expect(await code(r.setMyLocale('de' as never))).toBe('invalid');
    r.asMember(admin.id);
    expect((await r.me())!.locale).toBe('fr');
  });
});
