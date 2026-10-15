// @maintained-by-ai — pure handler over two mock boundaries (runtime store, logService);
// deterministic guard/selection/side-effect contract, stable unless the Expert Divination rule changes.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue({}),
}));

import { handle } from './expertDivinationHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestWizard',
    level: 14,
    proficiency: 6,
    spellAbilities: {
      spell_slots_level_1: 4,
      spell_slots_level_2: 3,
      spell_slots_level_3: 3,
      spell_slots_level_4: 3,
      spell_slots_level_5: 2,
    },
    ...overrides,
  };
}

function makeAction(spellOverrides = {}, actionOverrides = {}) {
  return {
    name: 'Expert Divination',
    automation: { type: 'expert_divination' },
    spell: { school: 'Divination', level: 3, name: 'Scrying', ...spellOverrides },
    ...actionOverrides,
  };
}

// Mock runtime: return the listed current-slot counts, null for every other level.
function slotsAt(levelCounts) {
  getRuntimeValue.mockImplementation((name, key) => levelCounts[key] ?? null);
}

describe('expertDivinationHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('guard clauses', () => {
    it('returns null when spell school is not Divination', async () => {
      const result = await handle(
        makeAction({ school: 'Evocation' }),
        makePlayerStats(), campaignName, null,
      );

      expect(result).toBeNull();
    });

    it('returns null when spell is undefined or school is an empty string', async () => {
      const noSpell = await handle(
        { name: 'Expert Divination', automation: { type: 'expert_divination' } },
        makePlayerStats(), campaignName, null,
      );
      const emptySchool = await handle(
        makeAction({ school: '' }),
        makePlayerStats(), campaignName, null,
      );

      expect(noSpell).toBeNull();
      expect(emptySchool).toBeNull();
    });

    it('returns null for cantrip (level 0) and level 1 spells', async () => {
      const result0 = await handle(
        makeAction({ level: 0 }),
        makePlayerStats(), campaignName, null,
      );
      const result1 = await handle(
        makeAction({ level: 1 }),
        makePlayerStats(), campaignName, null,
      );

      expect(result0).toBeNull();
      expect(result1).toBeNull();
    });

    it('returns null when slot level is zero or entirely missing', async () => {
      const zeroSlot = await handle(
        makeAction({ level: undefined }, { spellSlotLevel: 0 }),
        makePlayerStats(), campaignName, null,
      );
      const noLevels = await handle(
        makeAction({ level: undefined }, {}),
        makePlayerStats(), campaignName, null,
      );

      expect(zeroSlot).toBeNull();
      expect(noLevels).toBeNull();
    });

    it('matches Divination school case-insensitively', async () => {
      slotsAt({ spell_slots_level_1: 1, spell_slots_level_2: 1 });

      const result = await handle(
        makeAction({ school: 'DIVINATION' }),
        makePlayerStats(), campaignName, null,
      );

      expect(result).not.toBeNull();
      expect(result.type).toBe('popup');
    });

    it('uses action.spellSlotLevel when spell.level is missing', async () => {
      slotsAt({ spell_slots_level_1: 1, spell_slots_level_2: 1, spell_slots_level_3: 1 });

      const result = await handle(
        makeAction({ level: undefined }, { spellSlotLevel: 4 }),
        makePlayerStats(), campaignName, null,
      );

      expect(result).not.toBeNull();
      expect(result.type).toBe('popup');
    });
  });

  describe('slot availability checks', () => {
    it('returns info popup when all eligible slot levels have zero current slots', async () => {
      slotsAt({ spell_slots_level_1: 0, spell_slots_level_2: 0 });

      const result = await handle(
        makeAction({ level: 3 }),
        makePlayerStats(), campaignName, null,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No eligible spell slots');
    });

    it('returns info popup when eligible levels are at max capacity', async () => {
      slotsAt({ spell_slots_level_1: 4, spell_slots_level_2: 3 });

      const result = await handle(
        makeAction({ level: 3 }),
        makePlayerStats(), campaignName, null,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No eligible spell slots');
    });

    it('returns info popup when playerStats.spellAbilities is undefined', async () => {
      const result = await handle(
        makeAction({ level: 3 }),
        makePlayerStats({ spellAbilities: undefined }),
        campaignName, null,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No eligible spell slots');
    });
  });

  describe('slot selection logic', () => {
    it('picks highest eligible level with expended slots', async () => {
      slotsAt({ spell_slots_level_1: 2, spell_slots_level_2: 1, spell_slots_level_3: 2 });

      const result = await handle(
        makeAction({ level: 4 }),
        makePlayerStats(), campaignName, null,
      );

      expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'spell_slots_level_3', 3, campaignName);
      expect(result.payload.description).toContain('level 3');
    });

    it('skips levels at max capacity and picks next lower with expended slots', async () => {
      slotsAt({ spell_slots_level_1: 2, spell_slots_level_2: 1, spell_slots_level_3: 3 });

      const result = await handle(
        makeAction({ level: 4 }),
        makePlayerStats(), campaignName, null,
      );

      expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'spell_slots_level_2', 2, campaignName);
      expect(result.payload.description).toContain('level 2');
    });

    it('caps max regain level at 5 for high-level spell slots', async () => {
      slotsAt({ spell_slots_level_5: 1 });

      const result = await handle(
        makeAction({ level: 9 }),
        makePlayerStats(), campaignName, null,
      );

      expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'spell_slots_level_5', 2, campaignName);
      expect(result.payload.description).toContain('level 5');
    });
  });

  describe('side effects', () => {
    it('calls addEntry with correct ability_use log data', async () => {
      slotsAt({ spell_slots_level_1: 1 });

      await handle(
        makeAction({ level: 3, name: 'Scrying' }),
        makePlayerStats(), campaignName, null,
      );

      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'ability_use',
          characterName: 'TestWizard',
          abilityName: 'Expert Divination',
          description: expect.stringMatching(/level 1.*Scrying/),
          timestamp: expect.any(Number),
        }),
      );
    });

    it('returns popup with restoration details and echoed automation', async () => {
      slotsAt({ spell_slots_level_2: 1 });

      const result = await handle(
        makeAction({ level: 4 }),
        makePlayerStats(), campaignName, null,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Expert Divination');
      expect(result.payload.description).toContain('You regain');
      expect(result.payload.description).toContain('level 2');
      expect(result.payload.description).toContain('expended slot level 4');
      expect(result.payload.automation).toEqual({ type: 'expert_divination' });
    });

    it('does not throw when addEntry rejects', async () => {
      slotsAt({ spell_slots_level_1: 1 });
      addEntry.mockRejectedValueOnce(new Error('log write failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await handle(
        makeAction({ level: 3, name: 'Scrying' }),
        makePlayerStats(), campaignName, null,
      );

      expect(result.type).toBe('popup');
      expect(consoleSpy).toHaveBeenCalledWith(
        '[expertDivination] Error:',
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });
  });
});
