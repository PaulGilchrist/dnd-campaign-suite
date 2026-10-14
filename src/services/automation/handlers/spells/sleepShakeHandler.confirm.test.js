import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
  rangeToFeet: vi.fn(),
  getDistanceFeet: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../common/targetResolver.js', () => ({
  resolveMapPositions: vi.fn(),
}));

import { handleConfirm } from './sleepShakeHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { addEntry } from '../../../ui/logService.js';

const campaignName = 'TestCampaign';
const mapName = 'test-map';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Shake Asleep',
    automation: {
      type: 'sleep_shake',
      range: '5 ft',
      ...automation,
    },
  };
}

describe('sleepShakeHandler - handleConfirm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('player creature target', () => {
    it('removes incapacitated and unconscious from player conditions', async () => {
      const ctx = {
        creatures: [
          { name: 'AllyPlayer', type: 'player' },
          { name: 'TestCaster', gridX: 5, gridY: 10 },
        ],
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }, { name: 'AllyPlayer', gridX: 6, gridY: 10 }],
        placedItems: [],
      };
      getCombatContext.mockResolvedValue(ctx);
      getRuntimeValue.mockReturnValue(['incapacitated', 'unconscious', 'poisoned']);

      const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'AllyPlayer');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'AllyPlayer',
        'activeConditions',
        ['poisoned'],
        campaignName,
      );
      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('AllyPlayer is no longer affected by Sleep');
    });

    it('does not modify conditions when none of incapacitated/unconscious are present', async () => {
      const ctx = {
        creatures: [
          { name: 'AllyPlayer', type: 'player' },
          { name: 'TestCaster', gridX: 5, gridY: 10 },
        ],
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }, { name: 'AllyPlayer', gridX: 6, gridY: 10 }],
        placedItems: [],
      };
      getCombatContext.mockResolvedValue(ctx);
      getRuntimeValue.mockReturnValue(['frightened', 'poisoned']);

      const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'AllyPlayer');

      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(result.type).toBe('popup');
    });

    it('logs condition removal entries for incapacitated and unconscious when removed', async () => {
      const ctx = {
        creatures: [
          { name: 'AllyPlayer', type: 'player' },
          { name: 'TestCaster', gridX: 5, gridY: 10 },
        ],
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }, { name: 'AllyPlayer', gridX: 6, gridY: 10 }],
        placedItems: [],
      };
      getCombatContext.mockResolvedValue(ctx);
      getRuntimeValue.mockReturnValue(['incapacitated', 'unconscious', 'poisoned']);

      const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'AllyPlayer');

      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'condition',
          action: 'removed',
          characterName: 'AllyPlayer',
          condition: 'Incapacitated',
          reason: 'Shake Asleep (Sleep spell)',
        }),
      );
      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'condition',
          action: 'removed',
          characterName: 'AllyPlayer',
          condition: 'Unconscious',
          reason: 'Shake Asleep (Sleep spell)',
        }),
      );
      expect(result.type).toBe('popup');
    });

    it('logs condition removal for any of the 2 target conditions not in filtered array (player path)', async () => {
      const ctx = {
        creatures: [
          { name: 'AllyPlayer', type: 'player' },
          { name: 'TestCaster', gridX: 5, gridY: 10 },
        ],
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }, { name: 'AllyPlayer', gridX: 6, gridY: 10 }],
        placedItems: [],
      };
      getCombatContext.mockResolvedValue(ctx);
      getRuntimeValue.mockReturnValue(['incapacitated', 'poisoned']);

      await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'AllyPlayer');

      const incapCalls = addEntry.mock.calls.filter(
        (call) => call[1]?.condition === 'Incapacitated',
      );
      expect(incapCalls.length).toBe(1);
      const unconCalls = addEntry.mock.calls.filter(
        (call) => call[1]?.condition === 'Unconscious',
      );
      expect(unconCalls.length).toBe(1);
    });

    it('logs ability_use entry for player target', async () => {
      const ctx = {
        creatures: [
          { name: 'AllyPlayer', type: 'player' },
          { name: 'TestCaster', gridX: 5, gridY: 10 },
        ],
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }, { name: 'AllyPlayer', gridX: 6, gridY: 10 }],
        placedItems: [],
      };
      getCombatContext.mockResolvedValue(ctx);
      getRuntimeValue.mockReturnValue(['incapacitated']);

      await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'AllyPlayer');

      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'ability_use',
          characterName: 'TestCaster',
          abilityName: 'Shake Asleep',
          description: expect.stringContaining('TestCaster used an action to shake AllyPlayer out of its magical slumber'),
          targetName: 'AllyPlayer',
        }),
      );
    });

    it('handles empty conditions array for player', async () => {
      const ctx = {
        creatures: [
          { name: 'AllyPlayer', type: 'player' },
          { name: 'TestCaster', gridX: 5, gridY: 10 },
        ],
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }, { name: 'AllyPlayer', gridX: 6, gridY: 10 }],
        placedItems: [],
      };
      getCombatContext.mockResolvedValue(ctx);
      getRuntimeValue.mockReturnValue([]);

      const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'AllyPlayer');

      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(result.type).toBe('popup');
    });

    it('handles null conditions for player', async () => {
      const ctx = {
        creatures: [
          { name: 'AllyPlayer', type: 'player' },
          { name: 'TestCaster', gridX: 5, gridY: 10 },
        ],
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }, { name: 'AllyPlayer', gridX: 6, gridY: 10 }],
        placedItems: [],
      };
      getCombatContext.mockResolvedValue(ctx);
      getRuntimeValue.mockReturnValue(null);

      const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'AllyPlayer');

      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(result.type).toBe('popup');
    });

    it('only logs condition removal when condition was actually present (player path — only unconscious present)', async () => {
      const ctx = {
        creatures: [
          { name: 'AllyPlayer', type: 'player' },
          { name: 'TestCaster', gridX: 5, gridY: 10 },
        ],
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }, { name: 'AllyPlayer', gridX: 6, gridY: 10 }],
        placedItems: [],
      };
      getCombatContext.mockResolvedValue(ctx);
      getRuntimeValue.mockReturnValue(['unconscious', 'poisoned']);

      await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'AllyPlayer');

      const incapCalls = addEntry.mock.calls.filter(
        (call) => call[1]?.condition === 'Incapacitated',
      );
      expect(incapCalls.length).toBe(1);
      const unconCalls = addEntry.mock.calls.filter(
        (call) => call[1]?.condition === 'Unconscious',
      );
      expect(unconCalls.length).toBe(1);
    });
  });

  describe('handleConfirm — monster creature target', () => {
    it('removes incapacitated and unconscious from monster conditions', async () => {
      const ctx = {
        creatures: [
          { name: 'Goblin', type: 'monster' },
          { name: 'TestCaster', gridX: 5, gridY: 10 },
        ],
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
        placedItems: [],
      };
      getCombatContext.mockResolvedValue(ctx);
      getRuntimeValue.mockReturnValue(['incapacitated', 'unconscious', 'poisoned']);

      const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Goblin');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        ['poisoned'],
        campaignName,
      );
      expect(result.type).toBe('popup');
    });

    it('does not modify conditions when none of incapacitated/unconscious are present (monster)', async () => {
      const ctx = {
        creatures: [
          { name: 'Goblin', type: 'monster' },
          { name: 'TestCaster', gridX: 5, gridY: 10 },
        ],
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
        placedItems: [],
      };
      getCombatContext.mockResolvedValue(ctx);
      getRuntimeValue.mockReturnValue(['frightened', 'poisoned']);

      const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Goblin');

      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(result.type).toBe('popup');
    });

    it('logs condition removal entries for monsters', async () => {
      const ctx = {
        creatures: [
          { name: 'Goblin', type: 'monster' },
          { name: 'TestCaster', gridX: 5, gridY: 10 },
        ],
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
        placedItems: [],
      };
      getCombatContext.mockResolvedValue(ctx);
      getRuntimeValue.mockReturnValue(['incapacitated', 'unconscious', 'poisoned']);

      const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Goblin');

      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'condition',
          action: 'removed',
          characterName: 'Goblin',
          condition: 'Incapacitated',
          reason: 'Shake Asleep (Sleep spell)',
        }),
      );
      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'condition',
          action: 'removed',
          characterName: 'Goblin',
          condition: 'Unconscious',
          reason: 'Shake Asleep (Sleep spell)',
        }),
      );
      expect(result.type).toBe('popup');
    });

    it('logs ability_use entry for monster target', async () => {
      const ctx = {
        creatures: [
          { name: 'Goblin', type: 'monster' },
          { name: 'TestCaster', gridX: 5, gridY: 10 },
        ],
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
        placedItems: [],
      };
      getCombatContext.mockResolvedValue(ctx);
      getRuntimeValue.mockReturnValue(['incapacitated']);

      await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Goblin');

      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'ability_use',
          characterName: 'TestCaster',
          abilityName: 'Shake Asleep',
          targetName: 'Goblin',
        }),
      );
    });

    it('handles empty conditions array for monster', async () => {
      const ctx = {
        creatures: [
          { name: 'Goblin', type: 'monster' },
          { name: 'TestCaster', gridX: 5, gridY: 10 },
        ],
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
        placedItems: [],
      };
      getCombatContext.mockResolvedValue(ctx);
      getRuntimeValue.mockReturnValue([]);

      const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Goblin');

      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(result.type).toBe('popup');
    });

    it('only logs conditions that were actually present (monster path)', async () => {
      const ctx = {
        creatures: [
          { name: 'Goblin', type: 'monster' },
          { name: 'TestCaster', gridX: 5, gridY: 10 },
        ],
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
        placedItems: [],
      };
      getCombatContext.mockResolvedValue(ctx);
      getRuntimeValue.mockReturnValue(['unconscious', 'poisoned']);

      await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Goblin');

      const incapCalls = addEntry.mock.calls.filter(
        (call) => call[1]?.condition === 'Incapacitated',
      );
      expect(incapCalls.length).toBe(0);
      const unconCalls = addEntry.mock.calls.filter(
        (call) => call[1]?.condition === 'Unconscious',
      );
      expect(unconCalls.length).toBe(1);
    });
  });

  describe('handleConfirm — edge cases', () => {
    it('returns null when no targetName provided', async () => {
      const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, null);

      expect(result).toBeNull();
    });

    it('returns null when targetName is empty string', async () => {
      const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, '');

      expect(result).toBeNull();
    });

    it('still returns popup when creature not found in combat context', async () => {
      const ctx = {
        creatures: [
          { name: 'Goblin', type: 'monster' },
          { name: 'TestCaster', gridX: 5, gridY: 10 },
        ],
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
        placedItems: [],
      };
      getCombatContext.mockResolvedValue(ctx);

      const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'NonExistent');

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('NonExistent is no longer affected by Sleep');
    });

    it('still returns popup when combat context is missing', async () => {
      getCombatContext.mockResolvedValue(null);

      const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Goblin');

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Goblin is no longer affected by Sleep');
    });

    it('still returns popup when creatures array is missing in combat context', async () => {
      getCombatContext.mockResolvedValue({});

      const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Goblin');

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Goblin is no longer affected by Sleep');
    });

    it('always logs ability_use entry even when creature not found', async () => {
      getCombatContext.mockResolvedValue(null);

      await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Goblin');

      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'ability_use',
          characterName: 'TestCaster',
          abilityName: 'Shake Asleep',
          targetName: 'Goblin',
        }),
      );
    });
  });
});
