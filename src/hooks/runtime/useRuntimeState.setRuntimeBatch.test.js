// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getRuntimeValue, clearRuntimeState, setRuntimeBatch, addStorageChangeListener, getAllStoreKeys } from './useRuntimeState.js';

function clearAll() {
  const keys = getAllStoreKeys();
  for (const key of keys) {
    clearRuntimeState(key);
  }
}

describe('useRuntimeState — setRuntimeBatch', () => {
  beforeEach(() => {
    clearAll();
    vi.spyOn(global, 'fetch').mockResolvedValue(undefined);
  });

  it('sets multiple properties at once', async () => {
    setRuntimeBatch('test-char', { hp: 15, sp: 10, maxHp: 20 }, 'test-campaign');
    expect(getRuntimeValue('test-char', 'hp')).toBe(15);
    expect(getRuntimeValue('test-char', 'sp')).toBe(10);
    expect(getRuntimeValue('test-char', 'maxHp')).toBe(20);
  });

  it('sends a POST request to the correct API endpoint', async () => {
    setRuntimeBatch('test-char', { hp: 15 }, 'test-campaign');
    const callArgs = vi.spyOn(global, 'fetch').mock.calls[0];
    expect(callArgs[0]).toBe('/api/campaigns/test-campaign/test-char');
    expect(callArgs[1].method).toBe('POST');
    expect(callArgs[1].mode).toBe('cors');
    expect(callArgs[1].headers).toEqual({ 'Content-Type': 'application/json' });
    const body = JSON.parse(callArgs[1].body);
    expect(body.value).toBeInstanceOf(Object);
  });

  it('encodes the campaign name in the URL', async () => {
    setRuntimeBatch('test-char', { hp: 15 }, 'my campaign');
    const callArgs = vi.spyOn(global, 'fetch').mock.calls[0];
    expect(callArgs[0]).toBe('/api/campaigns/my%20campaign/test-char');
  });

  it('encodes the character key in the URL', async () => {
    setRuntimeBatch('my char', { hp: 15 }, 'test-campaign');
    const callArgs = vi.spyOn(global, 'fetch').mock.calls[0];
    expect(callArgs[0]).toBe('/api/campaigns/test-campaign/my%20char');
  });

  it('sends the full store as the body', async () => {
    setRuntimeBatch('test-char', { hp: 15, sp: 10 }, 'test-campaign');
    const callArgs = vi.spyOn(global, 'fetch').mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.value).toHaveProperty('hp', 15);
    expect(body.value).toHaveProperty('sp', 10);
  });

  it('triggers listeners when at least one value changes', async () => {
    const listener = vi.fn();
    addStorageChangeListener('test-char', listener);
    setRuntimeBatch('test-char', { hp: 15, sp: 10 }, 'test-campaign');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('does not trigger listeners when no values changed', async () => {
    const listener = vi.fn();
    addStorageChangeListener('test-char', listener);
    setRuntimeBatch('test-char', { hp: 15 }, 'test-campaign');
    setRuntimeBatch('test-char', { hp: 15 }, 'test-campaign');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('does not POST when no values changed', async () => {
    setRuntimeBatch('test-char', { hp: 15 }, 'test-campaign');
    setRuntimeBatch('test-char', { hp: 15 }, 'test-campaign');
    expect(vi.spyOn(global, 'fetch').mock.calls.length).toBe(1);
  });

  it('does not seed when passed null', async () => {
    setRuntimeBatch('test-char', null, 'test-campaign');
    expect(getRuntimeValue('test-char', 'hp')).toBeNull();
  });

  it('does not seed when passed undefined', async () => {
    setRuntimeBatch('test-char', undefined, 'test-campaign');
    expect(getRuntimeValue('test-char', 'hp')).toBeNull();
  });

  it('does not seed when passed a non-object primitive', async () => {
    setRuntimeBatch('test-char', 'string', 'test-campaign');
    expect(getRuntimeValue('test-char', 'hp')).toBeNull();
  });

  it('does not seed when passed a number', async () => {
    setRuntimeBatch('test-char', 42, 'test-campaign');
    expect(getRuntimeValue('test-char', 'hp')).toBeNull();
  });

  it('updates the full store body including previously set values', async () => {
    setRuntimeBatch('test-char', { hp: 15 }, 'test-campaign');
    setRuntimeBatch('test-char', { sp: 10 }, 'test-campaign');
    const callArgs = vi.spyOn(global, 'fetch').mock.calls[1];
    const body = JSON.parse(callArgs[1].body);
    expect(body.value).toHaveProperty('hp', 15);
    expect(body.value).toHaveProperty('sp', 10);
  });

  it('handles empty properties object (no changes)', async () => {
    const listener = vi.fn();
    addStorageChangeListener('test-char', listener);
    setRuntimeBatch('test-char', {}, 'test-campaign');
    expect(listener).toHaveBeenCalledTimes(0);
    expect(vi.spyOn(global, 'fetch').mock.calls.length).toBe(0);
  });

  it('handles object with null values', async () => {
    setRuntimeBatch('test-char', { hp: null }, 'test-campaign');
    expect(getRuntimeValue('test-char', 'hp')).toBeNull();
  });

  it('handles object with array values', async () => {
    const arr = ['fireball', 'magic-missile'];
    setRuntimeBatch('test-char', { spells: arr }, 'test-campaign');
    expect(getRuntimeValue('test-char', 'spells')).toEqual(arr);
  });

  it('handles object with nested object values', async () => {
    const obj = { stats: { str: 18, dex: 14 } };
    setRuntimeBatch('test-char', obj, 'test-campaign');
    expect(getRuntimeValue('test-char', 'stats')).toEqual({ str: 18, dex: 14 });
  });

  it('handles zero as a valid value', async () => {
    setRuntimeBatch('test-char', { hp: 0 }, 'test-campaign');
    expect(getRuntimeValue('test-char', 'hp')).toBe(0);
  });

  it('handles negative values', async () => {
    setRuntimeBatch('test-char', { hp: -5 }, 'test-campaign');
    expect(getRuntimeValue('test-char', 'hp')).toBe(-5);
  });

  it('handles boolean values', async () => {
    setRuntimeBatch('test-char', { active: true }, 'test-campaign');
    expect(getRuntimeValue('test-char', 'active')).toBe(true);
  });

  it('handles string values', async () => {
    setRuntimeBatch('test-char', { name: 'Gandalf' }, 'test-campaign');
    expect(getRuntimeValue('test-char', 'name')).toBe('Gandalf');
  });

  it('number-string equality prevents unnecessary POST and listener trigger', async () => {
    const listener = vi.fn();
    addStorageChangeListener('test-char', listener);
    setRuntimeBatch('test-char', { hp: 15 }, 'test-campaign');
    setRuntimeBatch('test-char', { hp: '15' }, 'test-campaign');
    expect(vi.spyOn(global, 'fetch').mock.calls.length).toBe(1);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('calls fetch with mode cors', async () => {
    setRuntimeBatch('test-char', { hp: 15 }, 'test-campaign');
    const callArgs = vi.spyOn(global, 'fetch').mock.calls[0];
    expect(callArgs[1].mode).toBe('cors');
  });

  it('calls fetch with Content-Type application/json header', async () => {
    setRuntimeBatch('test-char', { hp: 15 }, 'test-campaign');
    const callArgs = vi.spyOn(global, 'fetch').mock.calls[0];
    expect(callArgs[1].headers).toEqual({ 'Content-Type': 'application/json' });
  });

  it('partially updates store (some same, some different)', async () => {
    const listener = vi.fn();
    addStorageChangeListener('test-char', listener);
    setRuntimeBatch('test-char', { hp: 15, sp: 10 }, 'test-campaign');
    setRuntimeBatch('test-char', { hp: 15, sp: 5 }, 'test-campaign');
    expect(getRuntimeValue('test-char', 'hp')).toBe(15);
    expect(getRuntimeValue('test-char', 'sp')).toBe(5);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(vi.spyOn(global, 'fetch').mock.calls.length).toBe(2);
  });

  it('handles large batch of properties', async () => {
    const props = {
      hp: 20, sp: 10, maxHp: 20, maxSp: 10,
      str: 18, dex: 14, con: 16, int: 12, wis: 10, cha: 8,
      ac: 16, initiative: 2, speed: 30,
      spells: ['fireball', 'magic-missile'],
      active: true,
    };
    setRuntimeBatch('test-char', props, 'test-campaign');
    expect(getRuntimeValue('test-char', 'hp')).toBe(20);
    expect(getRuntimeValue('test-char', 'str')).toBe(18);
    expect(getRuntimeValue('test-char', 'spells')).toEqual(['fireball', 'magic-missile']);
    expect(getRuntimeValue('test-char', 'active')).toBe(true);
  });

  it('logs error to console when campaignName is undefined', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error');
    setRuntimeBatch('test-char', { hp: 15 }, undefined);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'setRuntimeBatch called with undefined campaignName',
      expect.objectContaining({ characterKey: 'test-char' })
    );
    consoleErrorSpy.mockRestore();
  });
});
