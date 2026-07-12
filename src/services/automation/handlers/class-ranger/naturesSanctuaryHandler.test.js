// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(async () => ({})),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
  rangeToFeet: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

import { handle, handleMove, activateNaturesSanctuary, moveNaturesSanctuary } from './naturesSanctuaryHandler.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as logService from '../../../ui/logService.js';
import * as rangeValidation from '../../../rules/combat/rangeValidation.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';

const campaignName = 'test-campaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'Druid',
    level: 14,
    class: {
      name: 'Druid',
      class_levels: [{ level: 14, wild_shape: 4 }],
      major: { type: 'Temperate' },
      ...overrides.class,
    },
    ...overrides,
  };
}

function makeAction(overrides = {}) {
  return {
    name: "Nature's Sanctuary",
    description:
      'As a Action, expend Wild Shape to cause spectral trees and vines...',
    automation: {
      type: 'nature_sanctuary',
      range: '120_ft',
      cubeSize: 15,
      duration: '1_minute',
      moveRange: 60,
      movesPerDuration: 1,
      resourceCost: 'wild_shape',
      casting_time: '1 action',
      ...overrides.automation,
    },
    ...overrides,
  };
}

function makeMoveAction(overrides = {}) {
  return {
    name: "Nature's Sanctuary (Move)",
    automation: {
      type: 'nature_sanctuary_move',
      moveRange: 60,
      movesPerDuration: 1,
      ...overrides.automation,
    },
    ...overrides,
  };
}

const mockCreatures = [
  { name: 'Druid', type: 'player', currentHp: 50, maxHp: 50 },
  { name: 'Goblin', type: 'monster', currentHp: 7, maxHp: 7 },
  { name: 'Wolf', type: 'monster', currentHp: 11, maxHp: 11 },
  { name: 'Ally', type: 'npc', currentHp: 30, maxHp: 30 },
];

beforeEach(() => {
  vi.resetAllMocks();
  rangeValidation.rangeToFeet.mockReturnValue(120);
  damageUtils.getCombatContext.mockResolvedValue({ creatures: mockCreatures });
});

describe("Nature's Sanctuary Handler", () => {
  describe('handle (activation)', () => {
    it('returns modal with creature targets excluding self', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'wildShapeUses') return 3;
        if (key === 'naturesSanctuaryActive') return null;
        return null;
      });

      const action = makeAction();
      const playerStats = makePlayerStats();

      const result = await handle(action, playerStats, campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('naturesSanctuaryCreatures');
      expect(result.payload.creatureTargets).toHaveLength(4);
      expect(result.payload.creatureTargets.map(t => t.name)).toEqual(['Druid', 'Goblin', 'Wolf', 'Ally']);
      expect(result.payload.isMove).toBe(false);
      expect(result.payload.defaultSelected).toBeUndefined();
    });

    it('returns error when no wild shape uses remain', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'wildShapeUses') return 0;
        return null;
      });

      const action = makeAction();
      const playerStats = makePlayerStats();

      const result = await handle(action, playerStats, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain(
        "No Wild Shape uses remaining",
      );
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(expirations.addExpiration).not.toHaveBeenCalled();
    });

    it('returns error when sanctuary is already active', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'wildShapeUses') return 3;
        if (key === 'naturesSanctuaryActive') return true;
        return null;
      });

      const action = makeAction();
      const playerStats = makePlayerStats();

      const result = await handle(action, playerStats, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('already active');
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(expirations.addExpiration).not.toHaveBeenCalled();
    });

    it('sets up expiration and resolves land resistance', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'wildShapeUses') return 3;
        if (key === 'naturesSanctuaryActive') return null;
        return null;
      });

      const action = makeAction();
      const playerStats = makePlayerStats();

      await handle(action, playerStats, campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Druid',
        'naturesSanctuaryResistance',
        'Lightning',
        campaignName,
      );
      expect(expirations.addExpiration).toHaveBeenCalledWith(
        'Druid',
        'Druid',
        [{ type: 'remove_natures_sanctuary' }],
        campaignName,
      );
    });

    it.each([
      ['Arid', 'Fire'],
      ['Polar', 'Cold'],
      ['Tropical', 'Poison'],
    ])(
      'resists %s land type (%s)',
      async (landType, expectedResistance) => {
        useRuntimeState.getRuntimeValue.mockImplementation((player, key) => {
          if (key === 'wildShapeUses') return 3;
          if (key === 'naturesSanctuaryActive') return null;
          return null;
        });

        const action = makeAction();
        const playerStats = makePlayerStats({
          class: { major: { type: landType } },
        });

        await handle(action, playerStats, campaignName, null);

        expect(
          useRuntimeState.setRuntimeValue,
        ).toHaveBeenCalledWith(
          'Druid',
          'naturesSanctuaryResistance',
          expectedResistance,
          campaignName,
        );
      },
    );
  });

  describe('handleMove', () => {
    it('returns modal with creature targets and defaultSelected', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'naturesSanctuaryActive') return true;
        if (key === 'naturesSanctuaryCreatures') return ['Goblin', 'Wolf'];
        return null;
      });

      const action = makeMoveAction();
      const playerStats = makePlayerStats();

      const result = await handleMove(action, playerStats, campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('naturesSanctuaryCreatures');
      expect(result.payload.creatureTargets).toHaveLength(4);
      expect(result.payload.defaultSelected).toEqual(['Goblin', 'Wolf']);
      expect(result.payload.isMove).toBe(true);
    });

    it('returns error when sanctuary not active', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'naturesSanctuaryActive') return null;
        return null;
      });

      const action = makeMoveAction();
      const playerStats = makePlayerStats();

      const result = await handleMove(action, playerStats, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('not currently active');
    });
  });

  describe('activateNaturesSanctuary', () => {
    it('activates sanctuary and stores creature list', async () => {
      const action = makeAction();
      const playerStats = makePlayerStats();
      const targetNames = ['Goblin', 'Wolf', 'Ally'];

      useRuntimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'wildShapeUses') return 3;
        return null;
      });

      const result = await activateNaturesSanctuary(action, playerStats, campaignName, null, targetNames);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe("Nature's Sanctuary");
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Druid',
        'wildShapeUses',
        2,
        campaignName,
      );
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Druid',
        'naturesSanctuaryActive',
        true,
        campaignName,
      );
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Druid',
        'naturesSanctuaryCreatures',
        ['Goblin', 'Wolf', 'Ally'],
        campaignName,
      );
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Druid',
        'naturesSanctuaryRange',
        120,
        campaignName,
      );
      expect(expirations.addExpiration).not.toHaveBeenCalled();
      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'Druid',
        abilityName: "Nature's Sanctuary",
        description: expect.stringContaining('Goblin, Wolf, Ally'),
        timestamp: expect.any(Number),
      });
    });

    it('handles empty creature list', async () => {
      const action = makeAction();
      const playerStats = makePlayerStats();

      useRuntimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'wildShapeUses') return 3;
        return null;
      });

      const result = await activateNaturesSanctuary(action, playerStats, campaignName, null, []);

      expect(result.type).toBe('popup');
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Druid',
        'naturesSanctuaryCreatures',
        [],
        campaignName,
      );
    });
  });

  describe('moveNaturesSanctuary', () => {
    it('updates creature list and logs delta with added creatures', async () => {
      const action = makeMoveAction();
      const playerStats = makePlayerStats();
      const targetNames = ['Goblin', 'Wolf', 'Ally', 'Orc'];

      useRuntimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'naturesSanctuaryCreatures') return ['Goblin', 'Wolf'];
        return null;
      });

      const result = await moveNaturesSanctuary(action, playerStats, campaignName, targetNames);

      expect(result.type).toBe('popup');
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Druid',
        'naturesSanctuaryCreatures',
        ['Goblin', 'Wolf', 'Ally', 'Orc'],
        campaignName,
      );
      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'Druid',
        abilityName: "Nature's Sanctuary (Move)",
        description: expect.stringContaining('Added: Ally, Orc'),
        timestamp: expect.any(Number),
      });
    });

    it('logs delta with removed creatures', async () => {
      const action = makeMoveAction();
      const playerStats = makePlayerStats();
      const targetNames = ['Goblin'];

      useRuntimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'naturesSanctuaryCreatures') return ['Goblin', 'Wolf', 'Ally'];
        return null;
      });

      await moveNaturesSanctuary(action, playerStats, campaignName, targetNames);

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'Druid',
        abilityName: "Nature's Sanctuary (Move)",
        description: expect.stringContaining('Removed: Wolf, Ally'),
        timestamp: expect.any(Number),
      });
    });

    it('logs delta with both added and removed creatures', async () => {
      const action = makeMoveAction();
      const playerStats = makePlayerStats();
      const targetNames = ['Ally', 'Orc'];

      useRuntimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'naturesSanctuaryCreatures') return ['Goblin', 'Wolf'];
        return null;
      });

      await moveNaturesSanctuary(action, playerStats, campaignName, targetNames);

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'Druid',
        abilityName: "Nature's Sanctuary (Move)",
        description: expect.stringContaining('Added: Ally, Orc'),
        timestamp: expect.any(Number),
      });
      const callArgs = logService.addEntry.mock.calls[0][1];
      expect(callArgs.description).toContain('Removed: Goblin, Wolf');
    });

    it('handles no changes in creature list', async () => {
      const action = makeMoveAction();
      const playerStats = makePlayerStats();
      const targetNames = ['Goblin', 'Wolf'];

      useRuntimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'naturesSanctuaryCreatures') return ['Goblin', 'Wolf'];
        return null;
      });

      await moveNaturesSanctuary(action, playerStats, campaignName, targetNames);

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'Druid',
        abilityName: "Nature's Sanctuary (Move)",
        description: expect.stringContaining('No creatures added or removed'),
        timestamp: expect.any(Number),
      });
    });

    it('uses custom move range from automation config', async () => {
      const action = makeMoveAction({
        automation: { moveRange: 30 },
      });
      const playerStats = makePlayerStats();

      useRuntimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'naturesSanctuaryCreatures') return ['Goblin'];
        return null;
      });

      const result = await moveNaturesSanctuary(action, playerStats, campaignName, ['Goblin']);

      expect(result.payload.description).toContain('30 feet');
    });
  });
});
