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
    vi.spyOn(global, 'fetch').mockResolvedValue(undefined);
  });

  function getFetchCall(n = 0) {
    return vi.spyOn(global, 'fetch').mock.calls[n];
  }

  it('sets a value in the store', async () => {
    setRuntimeValue('test-char', 'hp', 15, 'test-campaign');
    expect(getRuntimeValue('test-char', 'hp')).toBe(15);
  });

  it('sends a POST request to the correct API endpoint', async () => {
    setRuntimeValue('test-char', 'hp', 15, 'my-campaign');
    const callArgs = getFetchCall();
    expect(callArgs[0]).toBe('/api/campaigns/my-campaign/test-char');
    expect(callArgs[1].method).toBe('POST');
    expect(callArgs[1].mode).toBe('cors');
    expect(callArgs[1].headers).toEqual({ 'Content-Type': 'application/json' });
    const body = JSON.parse(callArgs[1].body);
    expect(body.value).toBeInstanceOf(Object);
  });

  it('encodes the campaign name in the URL', async () => {
    setRuntimeValue('test-char', 'hp', 15, 'my campaign');
    const callArgs = getFetchCall();
    expect(callArgs[0]).toBe('/api/campaigns/my%20campaign/test-char');
  });

  it('encodes the character key in the URL', async () => {
    setRuntimeValue('my char', 'hp', 15, 'test-campaign');
    const callArgs = getFetchCall();
    expect(callArgs[0]).toBe('/api/campaigns/test-campaign/my%20char');
  });

  it('sends the full store as the body', async () => {
    setRuntimeValue('test-char', 'hp', 15, 'test-campaign');
    const callArgs = getFetchCall();
    const body = JSON.parse(callArgs[1].body);
    expect(body.value).toHaveProperty('hp', 15);
  });

  it('triggers listeners when value changes', async () => {
    const listener = vi.fn();
    addStorageChangeListener('test-char', listener);
    setRuntimeValue('test-char', 'hp', 15, 'test-campaign');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('does not trigger listeners when value is unchanged', async () => {
    const listener = vi.fn();
    addStorageChangeListener('test-char', listener);
    setRuntimeValue('test-char', 'hp', 15, 'test-campaign');
    setRuntimeValue('test-char', 'hp', 15, 'test-campaign');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('does not POST when value is unchanged', async () => {
    setRuntimeValue('test-char', 'hp', 15, 'test-campaign');
    setRuntimeValue('test-char', 'hp', 15, 'test-campaign');
    expect(vi.spyOn(global, 'fetch').mock.calls.length).toBe(1);
  });

  it('updates existing value and sends full store', async () => {
    setRuntimeValue('test-char', 'hp', 15, 'test-campaign');
    setRuntimeValue('test-char', 'sp', 10, 'test-campaign');
    const callArgs = getFetchCall(1);
    const body = JSON.parse(callArgs[1].body);
    expect(body.value).toHaveProperty('hp', 15);
    expect(body.value).toHaveProperty('sp', 10);
  });

  it('handles string values', async () => {
    setRuntimeValue('test-char', 'name', 'Gandalf', 'test-campaign');
    expect(getRuntimeValue('test-char', 'name')).toBe('Gandalf');
  });

  it('handles boolean values', async () => {
    setRuntimeValue('test-char', 'active', true, 'test-campaign');
    expect(getRuntimeValue('test-char', 'active')).toBe(true);
  });

  it('handles array values', async () => {
    const arr = ['fireball', 'magic-missile'];
    setRuntimeValue('test-char', 'spells', arr, 'test-campaign');
    expect(getRuntimeValue('test-char', 'spells')).toEqual(arr);
  });

  it('handles object values', async () => {
    const obj = { str: 18, dex: 14 };
    setRuntimeValue('test-char', 'stats', obj, 'test-campaign');
    expect(getRuntimeValue('test-char', 'stats')).toEqual(obj);
  });

  it('handles null values', async () => {
    setRuntimeValue('test-char', 'hp', null, 'test-campaign');
    expect(getRuntimeValue('test-char', 'hp')).toBeNull();
  });

  it('handles zero as a valid value', async () => {
    setRuntimeValue('test-char', 'hp', 0, 'test-campaign');
    expect(getRuntimeValue('test-char', 'hp')).toBe(0);
  });

  it('handles negative values', async () => {
    setRuntimeValue('test-char', 'hp', -5, 'test-campaign');
    expect(getRuntimeValue('test-char', 'hp')).toBe(-5);
  });

  it('logs error to console when campaignName is undefined', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error');
    setRuntimeValue('test-char', 'hp', 15, undefined);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'setRuntimeValue called with undefined campaignName',
      expect.objectContaining({ characterKey: 'test-char' })
    );
    consoleErrorSpy.mockRestore();
  });

  it('calls fetch with mode cors', async () => {
    setRuntimeValue('test-char', 'hp', 15, 'test-campaign');
    const callArgs = getFetchCall();
    expect(callArgs[1].mode).toBe('cors');
  });

  it('calls fetch with Content-Type application/json header', async () => {
    setRuntimeValue('test-char', 'hp', 15, 'test-campaign');
    const callArgs = getFetchCall();
    expect(callArgs[1].headers).toEqual({ 'Content-Type': 'application/json' });
  });

  it('triggers listeners for each property change in a sequence', async () => {
    const listener = vi.fn();
    addStorageChangeListener('test-char', listener);
    setRuntimeValue('test-char', 'hp', 15, 'test-campaign');
    setRuntimeValue('test-char', 'sp', 10, 'test-campaign');
    setRuntimeValue('test-char', 'hp', 10, 'test-campaign');
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('number-string equality: 15 === "15" prevents update', async () => {
    const listener = vi.fn();
    addStorageChangeListener('test-char', listener);
    setRuntimeValue('test-char', 'hp', 15, 'test-campaign');
    setRuntimeValue('test-char', 'hp', '15', 'test-campaign');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('number-string equality: "15" === 15 prevents update', async () => {
    const listener = vi.fn();
    addStorageChangeListener('test-char', listener);
    setRuntimeValue('test-char', 'hp', '15', 'test-campaign');
    setRuntimeValue('test-char', 'hp', 15, 'test-campaign');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
