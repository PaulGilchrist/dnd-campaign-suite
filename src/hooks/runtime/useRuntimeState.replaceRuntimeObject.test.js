// @maintained-by-ai
// Canonical home for replaceRuntimeObject contract tests (useRuntimeState.js) —
// the SSE-echo adoption lane for full-bucket (character) stores.
// Regression for bug-changedata-key-removal-stale-on-mounted-tab: the server's
// wildcard POST route replaces the whole bucket, so an echo whose payload is
// missing a key means the key is GONE server-side. The old merge-only adoption
// (setRuntimeObject skipSync) left the ghost key in a mounted tab's store, and
// allegiance gates reading getRuntimeValue(...,'selectedAllies') kept enforcing
// the deleted list until reload. These tests lock the eviction + the
// memory-only (never-POSTs) guarantee.
// Sibling merge-semantics contract lives in useRuntimeState.setRuntimeObject.test.js.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getRuntimeValue,
  hasRuntimeValue,
  clearRuntimeState,
  replaceRuntimeObject,
  addStorageChangeListener,
  getAllStoreKeys,
  listeners,
} from './useRuntimeState.js';

function clearAll() {
  const keys = getAllStoreKeys();
  for (const key of keys) {
    clearRuntimeState(key);
  }
  listeners.clear();
}

describe('useRuntimeState — replaceRuntimeObject (full-bucket SSE echo adoption)', () => {
  beforeEach(() => {
    clearAll();
    vi.spyOn(global, 'fetch').mockResolvedValue(undefined);
    global.fetch.mockClear();
  });

  it('evicts a key absent from the echoed bucket (the exact bug: removed selectedAllies)', () => {
    // Mounted tab holds the Lion-buff bearer bucket WITH the defector ally list.
    replaceRuntimeObject('DraconicDragon', {
      activeBuffs: [{ optionName: 'Lion', range: '5 ft' }],
      selectedAllies: ['DraconicDragon'],
    });
    // Another client replace-POSTs the bucket WITHOUT selectedAllies — the echo
    // is now the complete server truth, so the ghost key must leave the store.
    replaceRuntimeObject('DraconicDragon', {
      activeBuffs: [{ optionName: 'Lion', range: '5 ft' }],
    });
    expect(hasRuntimeValue('DraconicDragon', 'selectedAllies')).toBe(false);
    expect(getRuntimeValue('DraconicDragon', 'selectedAllies')).toBeNull();
    // Keys still present server-side survive untouched.
    expect(getRuntimeValue('DraconicDragon', 'activeBuffs')).toEqual([
      { optionName: 'Lion', range: '5 ft' },
    ]);
  });

  it('never POSTs — the echo is memory-only adoption (skipSync law)', () => {
    replaceRuntimeObject('test-char', { hp: 15 }, 'test-campaign');
    replaceRuntimeObject('test-char', { maxHp: 20 });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('updates and adds payload keys, preserving falsy values that are present', () => {
    replaceRuntimeObject('test-char', { hp: 10, tempHp: 5, active: true, flag: 'on' });
    replaceRuntimeObject('test-char', { hp: 4, tempHp: 0, active: false, flag: null, fresh: 'new' });
    expect(getRuntimeValue('test-char', 'hp')).toBe(4);
    expect(getRuntimeValue('test-char', 'tempHp')).toBe(0);
    expect(getRuntimeValue('test-char', 'active')).toBe(false);
    expect(getRuntimeValue('test-char', 'flag')).toBeNull();
    expect(hasRuntimeValue('test-char', 'tempHp')).toBe(true);
    expect(hasRuntimeValue('test-char', 'flag')).toBe(true);
    expect(getRuntimeValue('test-char', 'fresh')).toBe('new');
  });

  it('notifies store listeners exactly once when anything changed (eviction alone counts)', () => {
    const listener = vi.fn();
    addStorageChangeListener('test-char', listener);
    replaceRuntimeObject('test-char', { hp: 15, ghost: 'gone-next-echo' });
    expect(listener).toHaveBeenCalledTimes(1);
    // Pure eviction (no value writes) must still wake consumers.
    replaceRuntimeObject('test-char', { hp: 15 });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('does not notify when the echoed bucket equals the current store', () => {
    replaceRuntimeObject('test-char', { hp: 15, sp: '15' });
    const listener = vi.fn();
    addStorageChangeListener('test-char', listener);
    replaceRuntimeObject('test-char', { hp: '15', sp: 15 });
    expect(listener).not.toHaveBeenCalled();
    // Coercion-equal values keep the stored originals (shared valuesEqual law).
    expect(getRuntimeValue('test-char', 'hp')).toBe(15);
    expect(getRuntimeValue('test-char', 'sp')).toBe('15');
  });

  it('leaves the store untouched on null/undefined/non-object payloads', () => {
    replaceRuntimeObject('test-char', { hp: 15 });
    replaceRuntimeObject('test-char', null);
    replaceRuntimeObject('test-char', undefined);
    replaceRuntimeObject('test-char', 'corrupt');
    replaceRuntimeObject('test-char', 42);
    expect(getRuntimeValue('test-char', 'hp')).toBe(15);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('drops an array payload with a console error instead of evicting the live bucket', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error');
    replaceRuntimeObject('test-char', { hp: 15 });
    replaceRuntimeObject('test-char', [1, 2]);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[replaceRuntimeObject]'),
      expect.objectContaining({ characterKey: 'test-char' })
    );
    expect(getRuntimeValue('test-char', 'hp')).toBe(15);
    consoleErrorSpy.mockRestore();
  });

  it('is isolated per character key', () => {
    replaceRuntimeObject('char-a', { hp: 15, ghost: 'x' });
    replaceRuntimeObject('char-b', { hp: 25 });
    replaceRuntimeObject('char-a', { hp: 16 });
    expect(getRuntimeValue('char-a', 'hp')).toBe(16);
    expect(hasRuntimeValue('char-a', 'ghost')).toBe(false);
    expect(getRuntimeValue('char-b', 'hp')).toBe(25);
    expect(getRuntimeValue('test-char', 'hp')).toBeNull();
  });
});
