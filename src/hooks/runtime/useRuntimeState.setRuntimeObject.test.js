import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getRuntimeValue,
  clearRuntimeState,
  setRuntimeObject,
  addStorageChangeListener,
  getAllStoreKeys,
} from './useRuntimeState.js';

function clearAll() {
  const keys = getAllStoreKeys();
  for (const key of keys) {
    clearRuntimeState(key);
  }
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

  it('accumulates values across multiple calls and POSTs the full store', () => {
    setRuntimeObject('test-char', { hp: 15 }, 'test-campaign');
    setRuntimeObject('test-char', { sp: 10 }, 'test-campaign');
    const callArgs = getFetchCall(1);
    const body = JSON.parse(callArgs[1].body);
    expect(body.value).toHaveProperty('hp', 15);
    expect(body.value).toHaveProperty('sp', 10);
  });

  it('POSTs only the changed keys when some overlap with existing values', () => {
    setRuntimeObject('test-char', { hp: 15, sp: 10 }, 'test-campaign');
    setRuntimeObject('test-char', { hp: 20 }, 'test-campaign');
    const callArgs = getFetchCall(1);
    const body = JSON.parse(callArgs[1].body);
    expect(body.value).toHaveProperty('hp', 20);
    expect(body.value).toHaveProperty('sp', 10);
  });

  it('encodes special characters in campaign name and character key', () => {
    setRuntimeObject('my char', { hp: 15 }, 'my campaign');
    const callArgs = getFetchCall();
    expect(callArgs[0]).toBe('/api/campaigns/my%20campaign/my%20char');
  });

  it('does not POST when skipSync is true', () => {
    setRuntimeObject('test-char', { hp: 15 }, 'test-campaign', true);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(getRuntimeValue('test-char', 'hp')).toBe(15);
  });

  it('does not POST when skipSync is true even with multiple changes', () => {
    setRuntimeObject('test-char', { hp: 15, sp: 10, maxHp: 20 }, 'test-campaign', true);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(getRuntimeValue('test-char', 'hp')).toBe(15);
    expect(getRuntimeValue('test-char', 'sp')).toBe(10);
    expect(getRuntimeValue('test-char', 'maxHp')).toBe(20);
  });

  it('does not POST when no values changed', () => {
    setRuntimeObject('test-char', { hp: 15 }, 'test-campaign');
    setRuntimeObject('test-char', { hp: 15 }, 'test-campaign');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('does not trigger listeners when no values changed', () => {
    const listener = vi.fn();
    addStorageChangeListener('test-char', listener);
    setRuntimeObject('test-char', { hp: 15 }, 'test-campaign');
    setRuntimeObject('test-char', { hp: 15 }, 'test-campaign');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('triggers listeners only once even when multiple properties change', () => {
    const listener = vi.fn();
    addStorageChangeListener('test-char', listener);
    setRuntimeObject('test-char', { hp: 15, sp: 10 }, 'test-campaign');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('does not seed when passed null, undefined, or non-object', () => {
    setRuntimeObject('test-char', null, 'test-campaign');
    setRuntimeObject('test-char', undefined, 'test-campaign');
    setRuntimeObject('test-char', 'string', 'test-campaign');
    setRuntimeObject('test-char', 42, 'test-campaign');
    setRuntimeObject('test-char', [], 'test-campaign');
    expect(getRuntimeValue('test-char', 'hp')).toBeNull();
  });

  it('handles empty object (no changes, no POST, no listeners)', () => {
    const listener = vi.fn();
    addStorageChangeListener('test-char', listener);
    setRuntimeObject('test-char', {}, 'test-campaign');
    setRuntimeObject('test-char', {}, 'test-campaign');
    expect(listener).toHaveBeenCalledTimes(0);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('handles object with null values', () => {
    setRuntimeObject('test-char', { hp: null, sp: null }, 'test-campaign');
    expect(getRuntimeValue('test-char', 'hp')).toBeNull();
    expect(getRuntimeValue('test-char', 'sp')).toBeNull();
  });

  it('handles object with falsy values (0, false, empty string)', () => {
    setRuntimeObject('test-char', { hp: 0, active: false, name: '' }, 'test-campaign');
    expect(getRuntimeValue('test-char', 'hp')).toBe(0);
    expect(getRuntimeValue('test-char', 'active')).toBe(false);
    expect(getRuntimeValue('test-char', 'name')).toBe('');
  });

  it('handles object with nested objects', () => {
    setRuntimeObject('test-char', { stats: { str: 18, dex: 14 }, spells: ['fireball'] }, 'test-campaign');
    expect(getRuntimeValue('test-char', 'stats')).toEqual({ str: 18, dex: 14 });
    expect(getRuntimeValue('test-char', 'spells')).toEqual(['fireball']);
  });

  it('does not POST when number-string equality matches', () => {
    setRuntimeObject('test-char', { hp: 15 }, 'test-campaign');
    setRuntimeObject('test-char', { hp: '15' }, 'test-campaign');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('does not POST when string-number equality matches (reversed)', () => {
    setRuntimeObject('test-char', { hp: '15' }, 'test-campaign');
    setRuntimeObject('test-char', { hp: 15 }, 'test-campaign');
    expect(global.fetch).toHaveBeenCalledTimes(1);
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

  it('updates only changed properties preserving unchanged ones in the store', () => {
    setRuntimeObject('test-char', { hp: 15, sp: 10, maxHp: 20 }, 'test-campaign');
    setRuntimeObject('test-char', { hp: 10 }, 'test-campaign');
    const body = JSON.parse(getFetchCall(1)[1].body);
    expect(body.value).toHaveProperty('hp', 10);
    expect(body.value).toHaveProperty('sp', 10);
    expect(body.value).toHaveProperty('maxHp', 20);
  });

  it('is isolated per character key', () => {
    setRuntimeObject('char-a', { hp: 15 }, 'test-campaign');
    setRuntimeObject('char-b', { hp: 25 }, 'test-campaign');
    expect(getRuntimeValue('char-a', 'hp')).toBe(15);
    expect(getRuntimeValue('char-b', 'hp')).toBe(25);
    expect(getRuntimeValue('test-char', 'hp')).toBeNull();
  });
});
