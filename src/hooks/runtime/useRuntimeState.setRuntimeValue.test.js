// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getRuntimeValue, clearRuntimeState, setRuntimeValue, addStorageChangeListener, getAllStoreKeys } from './useRuntimeState.js';

function clearAll() {
  const keys = getAllStoreKeys();
  for (const key of keys) {
    clearRuntimeState(key);
  }
}

describe('useRuntimeState — setRuntimeValue', () => {
  beforeEach(() => {
    clearAll();
    global.fetch = vi.fn().mockResolvedValue(undefined);
  });

  function getFetchCall(n = 0) {
    return global.fetch.mock.calls[n];
  }

  it('sets a value in the store and sends a POST request', () => {
    setRuntimeValue('test-char', 'hp', 15, 'test-campaign');
    expect(getRuntimeValue('test-char', 'hp')).toBe(15);
    const callArgs = getFetchCall();
    expect(callArgs[0]).toBe('/api/campaigns/test-campaign/test-char');
    expect(callArgs[1].method).toBe('POST');
    const body = JSON.parse(callArgs[1].body);
    expect(body.value).toHaveProperty('hp', 15);
  });

  it('encodes special characters in campaign name and character key', () => {
    setRuntimeValue('my char', 'hp', 15, 'my campaign');
    const callArgs = getFetchCall();
    expect(callArgs[0]).toBe('/api/campaigns/my%20campaign/my%20char');
  });

  it('updates existing value and sends full store', () => {
    setRuntimeValue('test-char', 'hp', 15, 'test-campaign');
    setRuntimeValue('test-char', 'sp', 10, 'test-campaign');
    const callArgs = getFetchCall(1);
    const body = JSON.parse(callArgs[1].body);
    expect(body.value).toHaveProperty('hp', 15);
    expect(body.value).toHaveProperty('sp', 10);
  });

  it('triggers listeners when value changes', () => {
    const listener = vi.fn();
    addStorageChangeListener('test-char', listener);
    setRuntimeValue('test-char', 'hp', 15, 'test-campaign');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('does not trigger listeners or POST when value is unchanged', () => {
    const listener = vi.fn();
    addStorageChangeListener('test-char', listener);
    setRuntimeValue('test-char', 'hp', 15, 'test-campaign');
    setRuntimeValue('test-char', 'hp', 15, 'test-campaign');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls.length).toBe(1);
  });

  it('handles all value types (string, boolean, array, object, null, 0, negative)', () => {
    setRuntimeValue('test-char', 'name', 'Gandalf', 'test-campaign');
    setRuntimeValue('test-char', 'active', true, 'test-campaign');
    setRuntimeValue('test-char', 'spells', ['fireball', 'magic-missile'], 'test-campaign');
    setRuntimeValue('test-char', 'stats', { str: 18, dex: 14 }, 'test-campaign');
    setRuntimeValue('test-char', 'empty', null, 'test-campaign');
    setRuntimeValue('test-char', 'zero', 0, 'test-campaign');
    setRuntimeValue('test-char', 'negative', -5, 'test-campaign');

    expect(getRuntimeValue('test-char', 'name')).toBe('Gandalf');
    expect(getRuntimeValue('test-char', 'active')).toBe(true);
    expect(getRuntimeValue('test-char', 'spells')).toEqual(['fireball', 'magic-missile']);
    expect(getRuntimeValue('test-char', 'stats')).toEqual({ str: 18, dex: 14 });
    expect(getRuntimeValue('test-char', 'empty')).toBeNull();
    expect(getRuntimeValue('test-char', 'zero')).toBe(0);
    expect(getRuntimeValue('test-char', 'negative')).toBe(-5);
  });

  it('triggers listeners for each property change in a sequence', () => {
    const listener = vi.fn();
    addStorageChangeListener('test-char', listener);
    setRuntimeValue('test-char', 'hp', 15, 'test-campaign');
    setRuntimeValue('test-char', 'sp', 10, 'test-campaign');
    setRuntimeValue('test-char', 'hp', 10, 'test-campaign');
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('prevents update when number-string equality matches', () => {
    const listener = vi.fn();
    addStorageChangeListener('test-char', listener);
    setRuntimeValue('test-char', 'hp', 15, 'test-campaign');
    setRuntimeValue('test-char', 'hp', '15', 'test-campaign');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('logs error to console when campaignName is undefined', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error');
    setRuntimeValue('test-char', 'hp', 15, undefined);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'setRuntimeValue called with undefined campaignName',
      expect.objectContaining({ characterKey: 'test-char' })
    );
    consoleErrorSpy.mockRestore();
  });
});
