// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getRuntimeValue, clearRuntimeState, setRuntimeObject, addStorageChangeListener, getAllStoreKeys } from './useRuntimeState.js';

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
  });

  it('sets multiple properties at once', async () => {
    setRuntimeObject('test-char', { hp: 15, sp: 10, maxHp: 20, maxSp: 15 }, 'test-campaign');
    expect(getRuntimeValue('test-char', 'hp')).toBe(15);
    expect(getRuntimeValue('test-char', 'sp')).toBe(10);
    expect(getRuntimeValue('test-char', 'maxHp')).toBe(20);
    expect(getRuntimeValue('test-char', 'maxSp')).toBe(15);
  });

  it('does not POST when skipSync is true', async () => {
    setRuntimeObject('test-char', { hp: 15 }, 'test-campaign', true);
    expect(vi.spyOn(global, 'fetch').mock.calls.length).toBe(0);
    expect(getRuntimeValue('test-char', 'hp')).toBe(15);
  });

  it('POSTs when skipSync is false (default)', async () => {
    setRuntimeObject('test-char', { hp: 15 }, 'test-campaign', false);
    expect(vi.spyOn(global, 'fetch').mock.calls.length).toBe(1);
  });

  it('does not POST when skipSync is false but campaignName is missing', async () => {
    setRuntimeObject('test-char', { hp: 15 }, undefined, false);
    expect(vi.spyOn(global, 'fetch').mock.calls.length).toBe(0);
  });

  it('does not trigger listeners when no values changed', async () => {
    const listener = vi.fn();
    addStorageChangeListener('test-char', listener);
    setRuntimeObject('test-char', { hp: 15 }, 'test-campaign');
    setRuntimeObject('test-char', { hp: 15 }, 'test-campaign');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('does not POST when no values changed', async () => {
    setRuntimeObject('test-char', { hp: 15 }, 'test-campaign');
    setRuntimeObject('test-char', { hp: 15 }, 'test-campaign');
    expect(vi.spyOn(global, 'fetch').mock.calls.length).toBe(1);
  });

  it('triggers listeners only once even when multiple properties change', async () => {
    const listener = vi.fn();
    addStorageChangeListener('test-char', listener);
    setRuntimeObject('test-char', { hp: 15, sp: 10 }, 'test-campaign');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('does not seed when passed null', async () => {
    setRuntimeObject('test-char', null, 'test-campaign');
    expect(getRuntimeValue('test-char', 'hp')).toBeNull();
  });

  it('does not seed when passed undefined', async () => {
    setRuntimeObject('test-char', undefined, 'test-campaign');
    expect(getRuntimeValue('test-char', 'hp')).toBeNull();
  });

  it('does not seed when passed a non-object primitive', async () => {
    setRuntimeObject('test-char', 'string', 'test-campaign');
    expect(getRuntimeValue('test-char', 'hp')).toBeNull();
  });

  it('updates the full store body in the POST request', async () => {
    setRuntimeObject('test-char', { hp: 15 }, 'test-campaign');
    setRuntimeObject('test-char', { sp: 10 }, 'test-campaign');
    const callArgs = vi.spyOn(global, 'fetch').mock.calls[1];
    const body = JSON.parse(callArgs[1].body);
    expect(body.value).toHaveProperty('hp', 15);
    expect(body.value).toHaveProperty('sp', 10);
  });

  it('handles empty object (no changes)', async () => {
    const listener = vi.fn();
    addStorageChangeListener('test-char', listener);
    setRuntimeObject('test-char', {}, 'test-campaign');
    setRuntimeObject('test-char', {}, 'test-campaign');
    expect(listener).toHaveBeenCalledTimes(0);
    expect(vi.spyOn(global, 'fetch').mock.calls.length).toBe(0);
  });

  it('handles object with null values', async () => {
    setRuntimeObject('test-char', { hp: null, sp: null }, 'test-campaign');
    expect(getRuntimeValue('test-char', 'hp')).toBeNull();
    expect(getRuntimeValue('test-char', 'sp')).toBeNull();
  });

  it('handles object with array values', async () => {
    const arr = ['fireball', 'magic-missile'];
    setRuntimeObject('test-char', { spells: arr }, 'test-campaign');
    expect(getRuntimeValue('test-char', 'spells')).toEqual(arr);
  });

  it('handles object with nested object values', async () => {
    const obj = { stats: { str: 18, dex: 14 } };
    setRuntimeObject('test-char', obj, 'test-campaign');
    expect(getRuntimeValue('test-char', 'stats')).toEqual({ str: 18, dex: 14 });
  });

  it('does not throw when fetch rejects but skipSync is true', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('network error'));
    expect(() => {
      setRuntimeObject('test-char', { hp: 15 }, 'test-campaign', true);
    }).not.toThrow();
  });

  it('number-string equality prevents unnecessary POST', async () => {
    setRuntimeObject('test-char', { hp: 15 }, 'test-campaign');
    setRuntimeObject('test-char', { hp: '15' }, 'test-campaign');
    expect(vi.spyOn(global, 'fetch').mock.calls.length).toBe(1);
  });

  it('sends the full store including previously set values', async () => {
    setRuntimeObject('test-char', { hp: 15, sp: 10 }, 'test-campaign');
    const callArgs = vi.spyOn(global, 'fetch').mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.value).toHaveProperty('hp', 15);
    expect(body.value).toHaveProperty('sp', 10);
  });
});
