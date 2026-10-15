// @maintained-by-ai
// Nature's Sanctuary handler unit tests (activation handle, move handleMove,
// activateNaturesSanctuary, moveNaturesSanctuary). Fully deterministic: every
// external dependency (runtime store, expiration queue, log, combat context,
// range parsing) is mocked; assertions are exact-key / full-args pins on the
// handler's stable contract.
// Lanes owned elsewhere: resistance notices + cover application
// (buildAttackContext-*/contextBuilder-map.test.js), remove_natures_sanctuary
// expiry effects (clearExpirationEffects.test.js), Sanctuary badge rendering
// (CharSummary-Badges.test.jsx), modal confirm wiring
// (CharActionModals.target-selection-handlers.test.jsx).
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
    it('returns creature-selection modal with all combatants and isMove=false', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'wildShapeUses') return 3;
        return null;
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

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

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

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

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('already active');
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(expirations.addExpiration).not.toHaveBeenCalled();
    });

    it.each([
      ['Temperate', 'Lightning'],
      ['Arid', 'Fire'],
      ['Polar', 'Cold'],
      ['Tropical', 'Poison'],
    ])(
      'resolves %s land resistance to %s and enqueues a finite 10-round expiry (CLA-235)',
      async (landType, expectedResistance) => {
        useRuntimeState.getRuntimeValue.mockImplementation((player, key) => {
          if (key === 'wildShapeUses') return 3;
          return null;
        });

        const playerStats = makePlayerStats({
          class: { major: { type: landType } },
        });

        await handle(makeAction(), playerStats, campaignName, null);

        expect(
          useRuntimeState.setRuntimeValue,
        ).toHaveBeenCalledWith(
          'Druid',
          'naturesSanctuaryResistance',
          expectedResistance,
          campaignName,
        );
        // Rounds MUST be present — Infinity means the sanctuary never expires
        expect(expirations.addExpiration).toHaveBeenCalledWith({
          attackerName: 'Druid',
          targetName: 'Druid',
          effects: [{ type: 'remove_natures_sanctuary' }],
          campaignName,
          rounds: 10,
        });
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

      const result = await handleMove(makeMoveAction(), makePlayerStats(), campaignName, null);

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

      const result = await handleMove(makeMoveAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('not currently active');
    });

    it('blocks the move modal when the per-duration moves are exhausted (CLA-235)', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'naturesSanctuaryActive') return true;
        if (key === 'naturesSanctuaryMoves') return 1;
        return null;
      });

      const result = await handleMove(makeMoveAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No sanctuary moves remaining (1/1 used');
    });

    it('move leg never re-enqueues or strips the expiration (CLA-235)', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'naturesSanctuaryActive') return true;
        return null;
      });

      await handleMove(makeMoveAction(), makePlayerStats(), campaignName, null);
      await moveNaturesSanctuary(makeMoveAction(), makePlayerStats(), campaignName, ['Goblin']);

      expect(expirations.addExpiration).not.toHaveBeenCalled();
    });
  });

  describe('activateNaturesSanctuary', () => {
    it('activates sanctuary and stores creature list', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'wildShapeUses') return 3;
        return null;
      });

      const result = await activateNaturesSanctuary(makeAction(), makePlayerStats(), campaignName, null, ['Goblin', 'Wolf', 'Ally']);

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
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Druid',
        'naturesSanctuaryMoves',
        0,
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

    it('stores an empty creature list and logs "none" when no targets', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'wildShapeUses') return 3;
        return null;
      });

      const result = await activateNaturesSanctuary(makeAction(), makePlayerStats(), campaignName, null, []);

      expect(result.type).toBe('popup');
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Druid',
        'naturesSanctuaryCreatures',
        [],
        campaignName,
      );
      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        description: expect.stringContaining('covering 0 creature(s): none'),
      }));
    });
  });

  describe('moveNaturesSanctuary', () => {
    it.each([
      ['added creatures', ['Goblin', 'Wolf'], ['Goblin', 'Wolf', 'Ally', 'Orc'], ['Added: Ally, Orc']],
      ['removed creatures', ['Goblin', 'Wolf', 'Ally'], ['Goblin'], ['Removed: Wolf, Ally']],
      ['added and removed creatures', ['Goblin', 'Wolf'], ['Ally', 'Orc'], ['Added: Ally, Orc', 'Removed: Goblin, Wolf']],
      ['no changes', ['Goblin', 'Wolf'], ['Goblin', 'Wolf'], ['No creatures added or removed']],
    ])(
      'updates the creature list and logs delta with %s, consuming one move (CLA-235)',
      async (_label, existing, finalTargets, expectedFragments) => {
        useRuntimeState.getRuntimeValue.mockImplementation((player, key) => {
          if (key === 'naturesSanctuaryCreatures') return existing;
          if (key === 'naturesSanctuaryMoves') return 0;
          return null;
        });

        const result = await moveNaturesSanctuary(makeMoveAction(), makePlayerStats(), campaignName, finalTargets);

        expect(result.type).toBe('popup');
        expect(result.payload.description).not.toContain('No sanctuary moves remaining');
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
          'Druid',
          'naturesSanctuaryCreatures',
          finalTargets,
          campaignName,
        );
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
          'Druid',
          'naturesSanctuaryMoves',
          1,
          campaignName,
        );
        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
          type: 'ability_use',
          characterName: 'Druid',
          abilityName: "Nature's Sanctuary (Move)",
          description: expect.stringContaining("moved Nature's Sanctuary up to 60 feet"),
          timestamp: expect.any(Number),
        });
        const logged = logService.addEntry.mock.calls[0][1].description;
        expectedFragments.forEach(fragment => expect(logged).toContain(fragment));
      },
    );

    it('blocks the second move after the per-duration move is spent and logs the block (CLA-235)', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'naturesSanctuaryMoves') return 1;
        if (key === 'naturesSanctuaryCreatures') return ['Goblin'];
        return null;
      });

      const result = await moveNaturesSanctuary(makeMoveAction(), makePlayerStats(), campaignName, ['Goblin', 'Wolf']);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No sanctuary moves remaining (1/1 used');
      // Creature list must NOT be updated when blocked
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith(
        'Druid',
        'naturesSanctuaryCreatures',
        ['Goblin', 'Wolf'],
        campaignName,
      );
      // The block is logged
      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'ability_use',
        characterName: 'Druid',
        description: expect.stringContaining('no moves remaining'),
      }));
    });

    it('uses custom move range from automation config', async () => {
      const action = makeMoveAction({
        automation: { moveRange: 30 },
      });

      useRuntimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'naturesSanctuaryCreatures') return ['Goblin'];
        return null;
      });

      const result = await moveNaturesSanctuary(action, makePlayerStats(), campaignName, ['Goblin']);

      expect(result.payload.description).toContain('30 feet');
    });
  });
});
