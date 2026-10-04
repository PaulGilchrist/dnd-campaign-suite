import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadInventory, normalizeInventory } from './inventoryService.js';

function mockJsonOnce(body) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => body,
  });
}

describe('normalizeInventory', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('returns a complete empty shape for undefined payloads', () => {
    expect(normalizeInventory(undefined)).toEqual({
      currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
      items: [],
    });
  });

  it('returns a complete empty shape for empty objects and logs the anomaly', () => {
    const empty = normalizeInventory({});
    expect(empty.currency).toEqual({ pp: 0, gp: 0, sp: 0, cp: 0 });
    expect(empty.items).toEqual([]);
    expect(console.error).toHaveBeenCalled();
  });

  it('repairs partial items and currency while keeping valid entries', () => {
    const fixed = normalizeInventory({
      currency: { gp: '12', sp: -4 },
      items: [
        { name: 'Torch', quantity: 0 },
        { id: 'keep', name: ' Antitoxin ', quantity: 2.7, description: 'venom' },
        { name: '' },
        null,
      ],
    });
    expect(fixed.currency).toEqual({ pp: 0, gp: 12, sp: 0, cp: 0 });
    expect(fixed.items).toHaveLength(2);
    expect(fixed.items[0]).toMatchObject({ id: 'keep', name: 'Antitoxin', quantity: 2, description: 'venom' });
    expect(fixed.items[1].id).toBeTruthy();
  });
});

describe('loadInventory', () => {
  it('never resolves undefined when a stale server answers { value: null }', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockJsonOnce({ value: null });
    const inventory = await loadInventory('test-campaign');
    expect(inventory.items).toEqual([]);
    expect(inventory.currency).toEqual({ pp: 0, gp: 0, sp: 0, cp: 0 });
  });

  it('passes through a valid server payload', async () => {
    mockJsonOnce({
      inventory: {
        currency: { pp: 1, gp: 2, sp: 3, cp: 4 },
        items: [{ id: 'a', name: 'Torch', quantity: 2, description: '' }],
      },
    });
    const inventory = await loadInventory('test-campaign');
    expect(inventory.currency.gp).toBe(2);
    expect(inventory.items).toEqual([{ id: 'a', name: 'Torch', quantity: 2, description: '' }]);
  });
});
