import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './fontOfInspirationHandler.js';

import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';
const playerName = 'TestBard';

function makePlayerStats(overrides = {}) {
  return {
    name: playerName,
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
      ...overrides.automation,
    },
    ...('name' in overrides ? { name: overrides.name } : {}),
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('fontOfInspirationHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRuntimeState.getRuntimeValue.mockReset();
  });

  describe('bardic inspiration at maximum', () => {
    it('should return info popup when bardic inspiration uses are at maximum', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(3)
        .mockReturnValueOnce(4);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Font of Inspiration');
      expect(result.payload.description).toBe(
        'Font of Inspiration: Bardic Inspiration uses are already at maximum (3/3).'
      );
      expect(result.payload.automation).toEqual(action.automation);
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('should cap displayed value at max when stored exceeds max', async () => {
      const ps = makePlayerStats({ abilities: [{ name: 'Charisma', bonus: 2 }] });
      const action = makeAction();
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(5)
        .mockReturnValueOnce(4);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toBe(
        'Font of Inspiration: Bardic Inspiration uses are already at maximum (2/2).'
      );
    });

    it('should use custom name when provided', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ name: 'My Custom Feature' });
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(3)
        .mockReturnValueOnce(4);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.name).toBe('My Custom Feature');
      expect(result.payload.description).toContain('already at maximum');
    });

    it('should handle missing or undefined Charisma ability (defaults to 0 max)', async () => {
      const ps = makePlayerStats({ abilities: [] });
      const action = makeAction();
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(4);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toBe(
        'Font of Inspiration: Bardic Inspiration uses are already at maximum (0/0).'
      );
    });

    it('should handle undefined abilities array (defaults to 0 max)', async () => {
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

    it('should treat null or undefined bardic inspiration uses as max (defaults to Charisma bonus)', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(null);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toBe(
        'Font of Inspiration: Bardic Inspiration uses are already at maximum (3/3).'
      );
    });

    it('should default feature name when action.name is an empty string', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ name: '' });
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(3)
        .mockReturnValueOnce(4);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.name).toBe('Font of Inspiration');
    });
  });

  describe('no spell slots available', () => {
    it('should return info popup when all spell slots are exhausted', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(2)
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(0);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe(
        'Font of Inspiration: No spell slots available to expend.'
      );
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('should return info popup when lowest level slot has 0 stored', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(2)
        .mockReturnValueOnce(4)
        .mockReturnValueOnce(0);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toBe(
        'Font of Inspiration: No spell slots of level 1 available.'
      );
    });

    it('should skip levels with 0 stored and use the next level with slots', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(2)
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(1)
        .mockReturnValueOnce(1);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toBe(
        'Font of Inspiration: Expended a level 2 spell slot. Bardic Inspiration uses: 3/3.'
      );
      expect(useRuntimeState.setRuntimeValue).toHaveBeenNthCalledWith(
        1,
        'TestBard',
        'spell_slots_level_2',
        0,
        campaignName,
      );
    });

    it('should handle undefined spellAbilities (all levels default to 0)', async () => {
      const ps = makePlayerStats({ spellAbilities: undefined });
      const action = makeAction();
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(1)
        .mockReturnValueOnce(4)
        .mockReturnValueOnce(0);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toBe(
        'Font of Inspiration: No spell slots of level 1 available.'
      );
    });
  });

  describe('successful font of inspiration', () => {
    it('should decrement spell slot and increment bardic inspiration', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(2)
        .mockReturnValueOnce(4);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(useRuntimeState.setRuntimeValue).toHaveBeenNthCalledWith(
        1,
        'TestBard',
        'spell_slots_level_1',
        3,
        campaignName,
      );
      expect(useRuntimeState.setRuntimeValue).toHaveBeenNthCalledWith(
        2,
        'TestBard',
        'bardicInspirationUses',
        3,
        campaignName,
      );
      expect(result.payload.description).toBe(
        'Font of Inspiration: Expended a level 1 spell slot. Bardic Inspiration uses: 3/3.'
      );
      expect(result.payload.automation).toEqual(action.automation);
    });

    it('should log the ability use with correct data', async () => {
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

    it('should use the correct player name and campaignName for runtime calls', async () => {
      const ps = makePlayerStats({ name: 'Eldara the Wise' });
      const action = makeAction();
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(1)
        .mockReturnValueOnce(3)
        .mockReturnValueOnce(3);

      await handle(action, ps, campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenNthCalledWith(
        1,
        'Eldara the Wise',
        'spell_slots_level_1',
        2,
        campaignName,
      );
      expect(useRuntimeState.setRuntimeValue).toHaveBeenNthCalledWith(
        2,
        'Eldara the Wise',
        'bardicInspirationUses',
        2,
        campaignName,
      );
    });

    it('should handle high Charisma bonus (level 20 bard)', async () => {
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

    it('should use custom name in popup, description, and log entry', async () => {
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

      await handle(action, ps, campaignName, null);

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestBard',
        abilityName: 'Inspiration Surge',
        description: 'TestBard used Inspiration Surge: expended a level 1 spell slot to regain 1 Bardic Inspiration use.',
        timestamp: expect.any(Number),
      });
    });

    it('should use custom name in log characterName field', async () => {
      const ps = makePlayerStats({ name: 'Lyra' });
      const action = makeAction({ name: 'Lyra\'s Inspiration' });
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(1)
        .mockReturnValueOnce(3)
        .mockReturnValueOnce(3);

      await handle(action, ps, campaignName, null);

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'Lyra',
        abilityName: 'Lyra\'s Inspiration',
        description: 'Lyra used Lyra\'s Inspiration: expended a level 1 spell slot to regain 1 Bardic Inspiration use.',
        timestamp: expect.any(Number),
      });
    });

    it('should handle string numbers for bardic inspiration uses', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce('2')
        .mockReturnValueOnce(4);

      const result = await handle(action, ps, campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenNthCalledWith(
        2,
        'TestBard',
        'bardicInspirationUses',
        3,
        campaignName,
      );
      expect(result.payload.description).toBe(
        'Font of Inspiration: Expended a level 1 spell slot. Bardic Inspiration uses: 3/3.'
      );
    });

    it('should handle string numbers for spell slots', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(2)
        .mockReturnValueOnce(4)
        .mockReturnValueOnce('3');

      const result = await handle(action, ps, campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenNthCalledWith(
        1,
        'TestBard',
        'spell_slots_level_1',
        2,
        campaignName,
      );
      expect(result.payload.description).toBe(
        'Font of Inspiration: Expended a level 1 spell slot. Bardic Inspiration uses: 3/3.'
      );
    });
  });

  describe('spell slot level selection', () => {
    it('should always use the lowest available spell slot level', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(2)
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(2);

      await handle(action, ps, campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenNthCalledWith(
        1,
        'TestBard',
        'spell_slots_level_3',
        1,
        campaignName,
      );
    });

    it('should use max as fallback when stored value is null', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(2)
        .mockReturnValueOnce(4)
        .mockReturnValueOnce(null);

      await handle(action, ps, campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenNthCalledWith(
        1,
        'TestBard',
        'spell_slots_level_1',
        3,
        campaignName,
      );
    });

    it('should skip levels with null stored value that are at max', async () => {
      const ps = makePlayerStats({
        abilities: [{ name: 'Charisma', bonus: 5 }],
        spellAbilities: {
          spell_slots_level_1: 0,
          spell_slots_level_2: 3,
        },
      });
      const action = makeAction();
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(4)
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(1);

      await handle(action, ps, campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenNthCalledWith(
        1,
        'TestBard',
        'spell_slots_level_2',
        2,
        campaignName,
      );
    });

    it('should use the highest available spell slot when lower levels are exhausted', async () => {
      const ps = makePlayerStats({
        spellAbilities: {
          spell_slots_level_1: 0,
          spell_slots_level_2: 0,
          spell_slots_level_3: 0,
          spell_slots_level_4: 1,
        },
      });
      const action = makeAction();
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(1);

      await handle(action, ps, campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenNthCalledWith(
        1,
        'TestBard',
        'spell_slots_level_4',
        0,
        campaignName,
      );
    });

    it('should handle negative stored spell slot value (treats as 0)', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(2)
        .mockReturnValueOnce(4)
        .mockReturnValueOnce(-1);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toBe(
        'Font of Inspiration: No spell slots of level 1 available.'
      );
    });
  });

  describe('runtime value edge cases', () => {
    it('should handle negative bardic inspiration uses (treats as below max)', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(-1)
        .mockReturnValueOnce(4);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(useRuntimeState.setRuntimeValue).toHaveBeenNthCalledWith(
        2,
        'TestBard',
        'bardicInspirationUses',
        0,
        campaignName,
      );
    });
  });
});
