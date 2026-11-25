import { describe, expect, it } from 'vitest';
import { memoryStatus, parseOverrides } from './session';

describe('memory session overrides', () => {
  it('parses leniently', () => {
    expect(parseOverrides(undefined)).toEqual({});
    expect(parseOverrides('not json')).toEqual({});
    expect(parseOverrides(encodeURIComponent(JSON.stringify({ a: { role: 'analyst', status: 'active' }, b: { role: 'root', status: 'x' }, c: 3 }))))
      .toEqual({ a: { role: 'analyst', status: 'active' }, b: {} });
  });

  it('applies admin decisions to the persona status', () => {
    expect(memoryStatus('u-pending')).toBe('pending');
    expect(memoryStatus('u-pending', { 'u-pending': { role: 'analyst', status: 'active' } })).toBe('active');
    expect(memoryStatus('u-pending', { 'u-pending': { status: 'active' } })).toBe('pending');
    expect(memoryStatus('u-pending', { 'u-pending': { status: 'denied' } })).toBe('denied');
    expect(memoryStatus('u-analyst', { 'u-analyst': { status: 'denied' } })).toBe('denied');
    expect(memoryStatus('u-admin')).toBe('active');
    expect(memoryStatus('nobody')).toBe('none');
  });
});
