import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createObservers } from './observers.js';

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve({})),
}));

const { addEntry } = await import('../../ui/logService.js');

function makeCtx(overrides = {}) {
  return {
    campaignName: 'test-campaign',
    playerStats: { name: 'Gimli' },
    attack: { name: 'Greataxe', damageType: 'slashing' },
    targetName: 'Orc',
    total: 25,
    ...overrides,
  };
}

describe('createObservers', () => {
  let observers;

  beforeEach(() => {
    vi.clearAllMocks();
    observers = createObservers();
  });

  describe('damage:rolled observer', () => {
    it('calls addEntry with roll data', async () => {
      const obs = observers.find(o => o.event === 'damage:rolled');
      const ctx = makeCtx();
      const result = { data: { formula: '1d12+3', rolls: [7], total: 10, modifier: 3 } };

      await obs.handler(ctx, result);

      expect(addEntry).toHaveBeenCalledWith('test-campaign', {
        type: 'roll',
        characterName: 'Gimli',
        rollType: 'damage',
        name: 'Greataxe',
        formula: '1d12+3',
        rolls: [7],
        total: 10,
        modifier: 3,
        damageType: 'slashing',
        targetName: 'Orc',
      });
    });

    it('skips when no formula in result', async () => {
      const obs = observers.find(o => o.event === 'damage:rolled');
      await obs.handler(makeCtx(), { data: {} });
      expect(addEntry).not.toHaveBeenCalled();
    });

    it('handles null targetName', async () => {
      const obs = observers.find(o => o.event === 'damage:rolled');
      const ctx = makeCtx({ targetName: null });
      const result = { data: { formula: '1d6', rolls: [4], total: 4, modifier: 0 } };

      await obs.handler(ctx, result);

      expect(addEntry).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ targetName: null }));
    });

    it('handles addEntry error gracefully', async () => {
      addEntry.mockRejectedValueOnce(new Error('Network error'));
      const obs = observers.find(o => o.event === 'damage:rolled');
      const ctx = makeCtx();
      const result = { data: { formula: '1d6', rolls: [3], total: 3, modifier: 0 } };

      await expect(obs.handler(ctx, result)).resolves.toBeUndefined();
    });
  });

  describe('sneak:applied observer', () => {
    it('calls addEntry when sneak dice applied', async () => {
      const obs = observers.find(o => o.event === 'sneak:applied');
      const ctx = makeCtx();
      const result = { data: { effectiveSneakDice: 3 } };

      await obs.handler(ctx, result);

      expect(addEntry).toHaveBeenCalledWith('test-campaign', {
        type: 'ability_use',
        characterName: 'Gimli',
        abilityName: 'Sneak Attack',
        description: 'Gimli applied Sneak Attack (3d6)',
        targetName: 'Orc',
        timestamp: expect.any(Number),
      });
    });

    it('skips when no effectiveSneakDice', async () => {
      const obs = observers.find(o => o.event === 'sneak:applied');
      await obs.handler(makeCtx(), { data: {} });
      expect(addEntry).not.toHaveBeenCalled();
    });
  });

  describe('damage:applied observer', () => {
    it('calls addEntry on completed damage', async () => {
      const obs = observers.find(o => o.event === 'damage:applied');
      const ctx = makeCtx({ total: 25 });
      const result = { data: { _done: true } };

      await obs.handler(ctx, result);

      expect(addEntry).toHaveBeenCalledWith('test-campaign', {
        type: 'action_complete',
        characterName: 'Gimli',
        actionName: 'Greataxe',
        description: 'Gimli completed Greataxe with 25 total damage.',
        total: 25,
        targetName: 'Orc',
        timestamp: expect.any(Number),
      });
    });

    it('skips when not done', async () => {
      const obs = observers.find(o => o.event === 'damage:applied');
      await obs.handler(makeCtx(), { data: {} });
      expect(addEntry).not.toHaveBeenCalled();
    });
  });

  it('returns three observers', () => {
    expect(observers).toHaveLength(3);
    expect(observers.map(o => o.event)).toEqual(['damage:rolled', 'sneak:applied', 'damage:applied']);
  });
});
