// @maintained-by-ai
// Canonical home for setRuntimeObject contract tests (useRuntimeState.js).
// Pure in-memory store behaviour with mocked fetch — deterministic, no timers,
// no DOM, no app coupling beyond the exported function signature.
// Scope split: getRuntimeValue/setRuntimeValue/setRuntimeBatch/seedTrackedResources
// and the raw store API live in useRuntimeState.core.test.js.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getRuntimeValue,
  clearRuntimeState,
  setRuntimeObject,
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

describe('useRuntimeState — setRuntimeObject', () => {
  beforeEach(() => {
    clearAll();
    vi.spyOn(global, 'fetch').mockResolvedValue(undefined);
    global.fetch.mockClear();
  });

  function getFetchCall(n = 0) {
    return global.fetch.mock.calls[n];
  }

  it('sets multiple properties at once', () => {
    setRuntimeObject('test-char', { hp: 15, sp: 10, maxHp: 20, maxSp: 15 }, 'test-campaign');
    expect(getRuntimeValue('test-char', 'hp')).toBe(15);
    expect(getRuntimeValue('test-char', 'sp')).toBe(10);
    expect(getRuntimeValue('test-char', 'maxHp')).toBe(20);
    expect(getRuntimeValue('test-char', 'maxSp')).toBe(15);
  });

  it('POSTs the full store body with correct URL format and method', () => {
    setRuntimeObject('test-char', { hp: 15 }, 'test-campaign');
    const callArgs = getFetchCall();
    expect(callArgs[0]).toBe('/api/campaigns/test-campaign/test-char');
    expect(callArgs[1].method).toBe('POST');
    expect(callArgs[1].mode).toBe('cors');
    expect(callArgs[1].headers).toEqual({ 'Content-Type': 'application/json' });
    const body = JSON.parse(callArgs[1].body);
    expect(body.value).toHaveProperty('hp', 15);
  });

  it('accumulates across calls and POSTs the full store, updating changed keys and preserving unchanged ones', () => {
    setRuntimeObject('test-char', { hp: 15, sp: 10 }, 'test-campaign');
    setRuntimeObject('test-char', { maxHp: 20 }, 'test-campaign');
    setRuntimeObject('test-char', { hp: 10 }, 'test-campaign');
    const body = JSON.parse(getFetchCall(2)[1].body);
    expect(body.value).toEqual({ hp: 10, sp: 10, maxHp: 20 });
  });

  it('encodes special characters in campaign name and character key', () => {
    setRuntimeObject('my char', { hp: 15 }, 'my campaign');
    const callArgs = getFetchCall();
    expect(callArgs[0]).toBe('/api/campaigns/my%20campaign/my%20char');
  });

  it('does not POST when skipSync is true but still updates the store', () => {
    setRuntimeObject('test-char', { hp: 15, sp: 10, maxHp: 20 }, 'test-campaign', true);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(getRuntimeValue('test-char', 'hp')).toBe(15);
    expect(getRuntimeValue('test-char', 'sp')).toBe(10);
    expect(getRuntimeValue('test-char', 'maxHp')).toBe(20);
  });

  it('does not POST or notify when nothing changes (empty object or identical values)', () => {
    const listener = vi.fn();
    addStorageChangeListener('test-char', listener);
    setRuntimeObject('test-char', {}, 'test-campaign');
    expect(global.fetch).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
    setRuntimeObject('test-char', { hp: 15 }, 'test-campaign');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledTimes(1);
    setRuntimeObject('test-char', { hp: 15 }, 'test-campaign');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('triggers listeners only once even when multiple properties change', () => {
    const listener = vi.fn();
    addStorageChangeListener('test-char', listener);
    setRuntimeObject('test-char', { hp: 15, sp: 10 }, 'test-campaign');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('does not seed or POST when passed null, undefined, or non-object', () => {
    setRuntimeObject('test-char', null, 'test-campaign');
    setRuntimeObject('test-char', undefined, 'test-campaign');
    setRuntimeObject('test-char', 'string', 'test-campaign');
    setRuntimeObject('test-char', 42, 'test-campaign');
    setRuntimeObject('test-char', [], 'test-campaign');
    expect(getRuntimeValue('test-char', 'hp')).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('stores null and falsy values (0, false, empty string)', () => {
    setRuntimeObject('test-char', { hp: null, active: false, name: '', tempHp: 0 }, 'test-campaign');
    expect(getRuntimeValue('test-char', 'hp')).toBeNull();
    expect(getRuntimeValue('test-char', 'active')).toBe(false);
    expect(getRuntimeValue('test-char', 'name')).toBe('');
    expect(getRuntimeValue('test-char', 'tempHp')).toBe(0);
  });

  it('handles object with nested objects', () => {
    setRuntimeObject('test-char', { stats: { str: 18, dex: 14 }, spells: ['fireball'] }, 'test-campaign');
    expect(getRuntimeValue('test-char', 'stats')).toEqual({ str: 18, dex: 14 });
    expect(getRuntimeValue('test-char', 'spells')).toEqual(['fireball']);
  });

  it('does not POST when number-string equality matches (both directions)', () => {
    setRuntimeObject('test-char', { hp: 15, mp: '15' }, 'test-campaign');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    setRuntimeObject('test-char', { hp: '15', mp: 15 }, 'test-campaign');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    // coercion-equal values do not overwrite the stored originals
    expect(getRuntimeValue('test-char', 'hp')).toBe(15);
    expect(getRuntimeValue('test-char', 'mp')).toBe('15');
  });

  it('POSTs when nested object values differ', () => {
    setRuntimeObject('test-char', { stats: { str: 18 } }, 'test-campaign');
    setRuntimeObject('test-char', { stats: { str: 20 } }, 'test-campaign');
    expect(global.fetch).toHaveBeenCalledTimes(2);
    const body = JSON.parse(getFetchCall(1)[1].body);
    expect(body.value.stats).toEqual({ str: 20 });
  });

  it('does not POST when nested object values are equal', () => {
    setRuntimeObject('test-char', { stats: { str: 18, dex: 14 } }, 'test-campaign');
    setRuntimeObject('test-char', { stats: { str: 18, dex: 14 } }, 'test-campaign');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('does not POST without a campaignName but still updates the store and notifies', () => {
    const listener = vi.fn();
    addStorageChangeListener('test-char', listener);
    setRuntimeObject('test-char', { hp: 15 });
    expect(global.fetch).not.toHaveBeenCalled();
    expect(getRuntimeValue('test-char', 'hp')).toBe(15);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('logs guard error but still writes and POSTs when characterKey === campaignName', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error');
    setRuntimeObject('test-char', { hp: 15 }, 'test-char');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[setRuntimeObject] characterKey === campaignName'),
      expect.objectContaining({ characterKey: 'test-char', campaignName: 'test-char' })
    );
    consoleErrorSpy.mockRestore();
    expect(getRuntimeValue('test-char', 'hp')).toBe(15);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('catches a rejected POST and logs the error without throwing', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error');
    global.fetch.mockRejectedValueOnce(new Error('network down'));
    expect(() => setRuntimeObject('test-char', { hp: 15 }, 'test-campaign')).not.toThrow();
    await Promise.resolve(); // flush the .catch microtask
    expect(consoleErrorSpy).toHaveBeenCalledWith('[useRuntimeState] Error:', expect.any(Error));
    consoleErrorSpy.mockRestore();
    expect(getRuntimeValue('test-char', 'hp')).toBe(15);
  });

  it('is isolated per character key', () => {
    setRuntimeObject('char-a', { hp: 15 }, 'test-campaign');
    setRuntimeObject('char-b', { hp: 25 }, 'test-campaign');
    expect(getRuntimeValue('char-a', 'hp')).toBe(15);
    expect(getRuntimeValue('char-b', 'hp')).toBe(25);
    expect(getRuntimeValue('test-char', 'hp')).toBeNull();
  });
});
