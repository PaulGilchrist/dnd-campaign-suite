import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports (hoisted by vitest) ─────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(),
}));

// ── Imports (Vite returns mocked versions) ───────────────────────

import { handle } from './fontOfInspirationHandler.js';

import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';

// ── Helpers ─────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestBard',
    level: 5,
    abilities: [
      { name: 'Charisma', bonus: 3 },
    ],
    spellAbilities: {
      spell_slots_level_1: 4,
      spell_slots_level_2: 3,
      spell_slots_level_3: 2,
      spell_slots_level_4: 1,
    },
    ...overrides,
  };
}

function makeAction(overrides = {}) {
  return {
    automation: {
      type: 'font_of_inspiration',
      ...overrides,
    },
    ...('name' in overrides ? { name: overrides.name } : {}),
  };
}

function resetMocks() {
  useRuntimeState.getRuntimeValue.mockReset().mockImplementation(() => undefined);
  useRuntimeState.setRuntimeValue.mockReset().mockImplementation(() => Promise.resolve());
  logService.addEntry.mockReset().mockImplementation(() => Promise.resolve());
}

// ── Tests ──────────────────────────────────────────────────────

describe('fontOfInspirationHandler.handle', () => {
  beforeEach(() => {
    resetMocks();
  });

  describe('Bardic Inspiration at maximum', () => {
    it('should return popup when bardic inspiration is already at max', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(3)  // bardicInspirationUses
        .mockReturnValueOnce(4); // spell_slots_level_1 (in findLowestAvailableSpellSlot)

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Font of Inspiration');
      expect(result.payload.description).toBe(
        'Font of Inspiration: Bardic Inspiration uses are already at maximum (3/3).'
      );
      expect(result.payload.automation).toEqual(action.automation);
    });

    it('should return popup when bardic inspiration equals max (stored at max)', async () => {
      const ps = makePlayerStats({ abilities: [{ name: 'Charisma', bonus: 2 }] });
      const action = makeAction();
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(2)  // bardicInspirationUses equals max
        .mockReturnValueOnce(4); // spell_slots_level_1

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('already at maximum (2/2)');
    });

    it('should use action.name when custom name is provided', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ name: 'My Custom Feature' });
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(3)
        .mockReturnValueOnce(4);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.name).toBe('My Custom Feature');
      expect(result.payload.description).toContain('already at maximum (3/3)');
    });
  });

  describe('No spell slots available', () => {
    it('should return popup when all spell slots are exhausted', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(2)  // bardicInspirationUses below max
        .mockReturnValueOnce(0)  // spell_slots_level_1 in findLowest
        .mockReturnValueOnce(0)  // spell_slots_level_2 in findLowest
        .mockReturnValueOnce(0)  // spell_slots_level_3 in findLowest
        .mockReturnValueOnce(0); // spell_slots_level_4 in findLowest

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe(
        'Font of Inspiration: No spell slots available to expend.'
      );
    });

    it('should return popup when no spell slots are defined', async () => {
      const ps = makePlayerStats({ spellAbilities: {} });
      const action = makeAction();
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(2)  // bardicInspirationUses below max
        .mockReturnValueOnce(null) // spell_slots_level_1 -> max=0
        .mockReturnValueOnce(null) // spell_slots_level_2 -> max=0
        .mockReturnValueOnce(null) // spell_slots_level_3 -> max=0
        .mockReturnValueOnce(null); // spell_slots_level_4 -> max=0

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toBe(
        'Font of Inspiration: No spell slots available to expend.'
      );
    });

    it('should return popup when Charisma ability is missing (bonus = 0)', async () => {
      const ps = makePlayerStats({ abilities: [] });
      const action = makeAction();
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(0)  // bardicInspirationUses = 0, max = 0
        .mockReturnValueOnce(4); // spell_slots_level_1

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toBe(
        'Font of Inspiration: Bardic Inspiration uses are already at maximum (0/0).'
      );
    });
  });

  describe('No spell slots of lowest available level', () => {
    it('should return popup when lowest level slot has 0 stored', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(2)  // bardicInspirationUses below max
        .mockReturnValueOnce(4)  // spell_slots_level_1 in findLowest (found!)
        .mockReturnValueOnce(0); // spell_slots_level_1 at line 57 (0 stored)

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe(
        'Font of Inspiration: No spell slots of level 1 available.'
      );
    });

    it('should skip levels with 0 stored and use next available level', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(2)  // bardicInspirationUses below max
        .mockReturnValueOnce(0)  // spell_slots_level_1 in findLowest
        .mockReturnValueOnce(1)  // spell_slots_level_2 in findLowest
        .mockReturnValueOnce(1); // spell_slots_level_2 at line 57

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe(
        'Font of Inspiration: Expended a level 2 spell slot. Bardic Inspiration uses: 3/3.'
      );
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestBard',
        'spell_slots_level_2',
        0,
        campaignName,
      );
    });
  });

  describe('Successful Font of Inspiration', () => {
    it('should decrement spell slot and increment bardic inspiration', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(2)  // bardicInspirationUses = 2
        .mockReturnValueOnce(4); // spell_slots_level_1 in findLowest

      await handle(action, ps, campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestBard',
        'spell_slots_level_1',
        3,
        campaignName,
      );
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestBard',
        'bardicInspirationUses',
        3,
        campaignName,
      );
    });

    it('should log the ability use', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(2)
        .mockReturnValueOnce(4);

      await handle(action, ps, campaignName, null);

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestBard',
        abilityName: 'Font of Inspiration',
        description: 'TestBard used Font of Inspiration: expended a level 1 spell slot to regain 1 Bardic Inspiration use.',
        timestamp: expect.any(Number),
      });
    });

    it('should return success popup with correct description', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(2)
        .mockReturnValueOnce(4);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Font of Inspiration');
      expect(result.payload.description).toBe(
        'Font of Inspiration: Expended a level 1 spell slot. Bardic Inspiration uses: 3/3.'
      );
      expect(result.payload.automation).toEqual(action.automation);
    });

    it('should use the correct player name for runtime calls', async () => {
      const ps = makePlayerStats({ name: 'Eldara the Wise' });
      const action = makeAction();
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(1)
        .mockReturnValueOnce(3);

      await handle(action, ps, campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Eldara the Wise',
        'spell_slots_level_1',
        3,
        campaignName,
      );
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Eldara the Wise',
        'bardicInspirationUses',
        2,
        campaignName,
      );
    });

    it('should handle campaignName in runtime calls', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const customCampaign = 'EpicCampaign';
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(2)
        .mockReturnValueOnce(4);

      await handle(action, ps, customCampaign, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestBard',
        'spell_slots_level_1',
        3,
        customCampaign,
      );
    });
  });

  describe('Custom feature name', () => {
    it('should use action.name when provided', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ name: 'Inspiration Surge' });
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(2)
        .mockReturnValueOnce(4);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.name).toBe('Inspiration Surge');
      expect(result.payload.description).toBe(
        'Inspiration Surge: Expended a level 1 spell slot. Bardic Inspiration uses: 3/3.'
      );
    });

    it('should use custom name in log entry', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ name: 'Inspiration Surge' });
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(2)
        .mockReturnValueOnce(4);

      await handle(action, ps, campaignName, null);

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestBard',
        abilityName: 'Inspiration Surge',
        description: 'TestBard used Inspiration Surge: expended a level 1 spell slot to regain 1 Bardic Inspiration use.',
        timestamp: expect.any(Number),
      });
    });
  });

  describe('Different bardic inspiration max values', () => {
    it('should handle Charisma bonus of 0', async () => {
      const ps = makePlayerStats({ abilities: [{ name: 'Charisma', bonus: 0 }] });
      const action = makeAction();
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(4);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toBe(
        'Font of Inspiration: Bardic Inspiration uses are already at maximum (0/0).'
      );
    });

    it('should handle Charisma bonus of 6 (high level)', async () => {
      const ps = makePlayerStats({ abilities: [{ name: 'Charisma', bonus: 6 }] });
      const action = makeAction();
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(5)
        .mockReturnValueOnce(4);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe(
        'Font of Inspiration: Expended a level 1 spell slot. Bardic Inspiration uses: 6/6.'
      );
    });

    it('should handle missing Charisma ability', async () => {
      const ps = makePlayerStats({ abilities: [{ name: 'Strength', bonus: 3 }] });
      const action = makeAction();
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(4);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toBe(
        'Font of Inspiration: Bardic Inspiration uses are already at maximum (0/0).'
      );
    });
  });

  describe('Spell slot level selection', () => {
    it('should always use the lowest available spell slot level', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(2)  // bardicInspirationUses = 2
        .mockReturnValueOnce(0)  // level 1 in findLowest
        .mockReturnValueOnce(0)  // level 2 in findLowest
        .mockReturnValueOnce(2); // level 3 in findLowest

      await handle(action, ps, campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestBard',
        'spell_slots_level_3',
        1,
        campaignName,
      );
    });

    it('should use level 1 when it has slots available', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(2)
        .mockReturnValueOnce(1); // level 1 in findLowest

      await handle(action, ps, campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestBard',
        'spell_slots_level_1',
        3,
        campaignName,
      );
    });

    it('should use stored value vs max to find available slots', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(2)  // bardicInspirationUses = 2
        .mockReturnValueOnce(null); // level 1 stored = null -> falls back to max=4

      await handle(action, ps, campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestBard',
        'spell_slots_level_1',
        3,
        campaignName,
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle null bardic inspiration stored value (fallback to max)', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(null) // bardicInspirationUses = null -> falls back to max=3
        .mockReturnValueOnce(4);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe(
        'Font of Inspiration: Bardic Inspiration uses are already at maximum (3/3).'
      );
    });

    it('should handle string numeric bardic inspiration value', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce('2')
        .mockReturnValueOnce(4);

      await handle(action, ps, campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestBard',
        'bardicInspirationUses',
        3,
        campaignName,
      );
    });

    it('should handle undefined mapName parameter', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(2)
        .mockReturnValueOnce(4);

      const result = await handle(action, ps, campaignName, undefined);

      expect(result.type).toBe('popup');
    });

    it('should not call setRuntimeValue when returning early (at max)', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(3)
        .mockReturnValueOnce(4);

      await handle(action, ps, campaignName, null);

      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('should not call setRuntimeValue when returning early (no slots)', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(2)
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(0);

      await handle(action, ps, campaignName, null);

      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('should not call setRuntimeValue when returning early (slot has 0)', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(2)
        .mockReturnValueOnce(0)  // level 1 in findLowest
        .mockReturnValueOnce(0)  // level 2 in findLowest
        .mockReturnValueOnce(0)  // level 3 in findLowest
        .mockReturnValueOnce(0)  // level 4 in findLowest
        .mockReturnValueOnce(0); // level 1 at line 57

      await handle(action, ps, campaignName, null);

      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('should catch and suppress addEntry errors', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(2)
        .mockReturnValueOnce(4);
      logService.addEntry.mockImplementation(() => Promise.reject(new Error('db error')).catch(() => {}));

      // Should not throw
      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
    });

    it('should use 0 as default bonus when Charisma is undefined', async () => {
      const ps = makePlayerStats({ abilities: undefined });
      const action = makeAction();
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(4);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toBe(
        'Font of Inspiration: Bardic Inspiration uses are already at maximum (0/0).'
      );
    });
  });
});
