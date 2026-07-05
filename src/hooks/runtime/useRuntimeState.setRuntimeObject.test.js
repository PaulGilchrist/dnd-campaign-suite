// @cleaned-by-ai
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

  it('sets multiple properties at once', () => {
    setRuntimeObject('test-char', { hp: 15, sp: 10, maxHp: 20, maxSp: 15 }, 'test-campaign');
    expect(getRuntimeValue('test-char', 'hp')).toBe(15);
    expect(getRuntimeValue('test-char', 'sp')).toBe(10);
    expect(getRuntimeValue('test-char', 'maxHp')).toBe(20);
    expect(getRuntimeValue('test-char', 'maxSp')).toBe(15);
  });

  it('POSTs the full store body when values change', () => {
    setRuntimeObject('test-char', { hp: 15 }, 'test-campaign');
    setRuntimeObject('test-char', { sp: 10 }, 'test-campaign');
    const callArgs = vi.spyOn(global, 'fetch').mock.calls[1];
    const body = JSON.parse(callArgs[1].body);
    expect(body.value).toHaveProperty('hp', 15);
    expect(body.value).toHaveProperty('sp', 10);
  });

  it('does not POST when skipSync is true', () => {
    setRuntimeObject('test-char', { hp: 15 }, 'test-campaign', true);
    expect(vi.spyOn(global, 'fetch').mock.calls.length).toBe(0);
    expect(getRuntimeValue('test-char', 'hp')).toBe(15);
  });

  it('does not POST when no values changed', () => {
    setRuntimeObject('test-char', { hp: 15 }, 'test-campaign');
    setRuntimeObject('test-char', { hp: 15 }, 'test-campaign');
    expect(vi.spyOn(global, 'fetch').mock.calls.length).toBe(1);
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
    expect(getRuntimeValue('test-char', 'hp')).toBeNull();
  });

  it('handles empty object (no changes)', () => {
    const listener = vi.fn();
    addStorageChangeListener('test-char', listener);
    setRuntimeObject('test-char', {}, 'test-campaign');
    setRuntimeObject('test-char', {}, 'test-campaign');
    expect(listener).toHaveBeenCalledTimes(0);
    expect(vi.spyOn(global, 'fetch').mock.calls.length).toBe(0);
  });

  it('handles object with null values', () => {
    setRuntimeObject('test-char', { hp: null, sp: null }, 'test-campaign');
    expect(getRuntimeValue('test-char', 'hp')).toBeNull();
    expect(getRuntimeValue('test-char', 'sp')).toBeNull();
  });

  it('does not POST when number-string equality matches', () => {
    setRuntimeObject('test-char', { hp: 15 }, 'test-campaign');
    setRuntimeObject('test-char', { hp: '15' }, 'test-campaign');
    expect(vi.spyOn(global, 'fetch').mock.calls.length).toBe(1);
  });

  it('does not throw when fetch rejects but skipSync is true', () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('network error'));
    expect(() => {
      setRuntimeObject('test-char', { hp: 15 }, 'test-campaign', true);
    }).not.toThrow();
  });
});
