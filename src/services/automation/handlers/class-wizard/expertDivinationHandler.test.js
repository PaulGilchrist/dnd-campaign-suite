import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
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

describe('expertDivinationHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('school filtering', () => {
    it('returns null for non-Divination spell school', async () => {
      const result = await handle(
        makeAction({ school: 'Evocation' }),
        makePlayerStats(), campaignName, null,
      );

      expect(result).toBeNull();
    });

    it('returns null when spell has no school', async () => {
      const result = await handle(
        makeAction({ school: undefined }),
        makePlayerStats(), campaignName, null,
      );

      expect(result).toBeNull();
    });

    it('returns null when action has no spell property', async () => {
      const action = makeAction();
      delete action.spell;

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result).toBeNull();
    });

    it('matches Divination school case-insensitively', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'spell_slots_level_1') return 1;
        if (key === 'spell_slots_level_2') return 1;
        return null;
      });

      const result = await handle(
        makeAction({ school: 'DIVINATION' }),
        makePlayerStats(), campaignName, null,
      );

      expect(result).not.toBeNull();
      expect(result.type).toBe('popup');
      expect(setRuntimeValue).toHaveBeenCalled();
    });

    it('matches lowercase divination school', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'spell_slots_level_1') return 1;
        if (key === 'spell_slots_level_2') return 1;
        return null;
      });

      const result = await handle(
        makeAction({ school: 'divination' }),
        makePlayerStats(), campaignName, null,
      );

      expect(result).not.toBeNull();
    });

    it('returns null when school has surrounding whitespace', async () => {
      const result = await handle(
        makeAction({ school: ' Divination ' }),
        makePlayerStats(), campaignName, null,
      );

      expect(result).toBeNull();
    });
  });

  describe('spell slot level validation', () => {
    it('returns null for level 1 spell slot', async () => {
      const result = await handle(
        makeAction({ level: 1 }),
        makePlayerStats(), campaignName, null,
      );

      expect(result).toBeNull();
    });

    it('returns null when spell.level is missing', async () => {
      const result = await handle(
        makeAction({ level: undefined }),
        makePlayerStats(), campaignName, null,
      );

      expect(result).toBeNull();
    });

    it('returns null for cantrip (level 0)', async () => {
      const result = await handle(
        makeAction({ level: 0 }),
        makePlayerStats(), campaignName, null,
      );

      expect(result).toBeNull();
    });

    it('uses action.spellSlotLevel when spell.level is missing', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'spell_slots_level_1') return 1;
        if (key === 'spell_slots_level_2') return 1;
        if (key === 'spell_slots_level_3') return 1;
        return null;
      });

      const result = await handle(
        makeAction({ level: undefined }, { spellSlotLevel: 4 }),
        makePlayerStats(), campaignName, null,
      );

      expect(result).not.toBeNull();
      expect(setRuntimeValue).toHaveBeenCalled();
    });
  });

  describe('slot availability and restoration', () => {
    it('returns info popup when no eligible spell slots are available (all zero)', async () => {
      getRuntimeValue.mockReturnValue(0);

      const result = await handle(
        makeAction({ level: 2 }),
        makePlayerStats(), campaignName, null,
      );

      expect(result).not.toBeNull();
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No eligible spell slots');
    });

    it('returns info popup when only eligible slot level has 0 remaining', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'spell_slots_level_1') return 0;
        return null;
      });

      const result = await handle(
        makeAction({ level: 2 }),
        makePlayerStats(), campaignName, null,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No eligible spell slots');
    });

    it('returns info popup when all eligible levels are at max capacity', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'spell_slots_level_1') return 4;
        if (key === 'spell_slots_level_2') return 3;
        return null;
      });

      const result = await handle(
        makeAction({ level: 3 }),
        makePlayerStats(), campaignName, null,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No eligible spell slots');
    });

    it('restores level 1 slot when casting with level 2 slot (only eligible level)', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'spell_slots_level_1') return 1;
        return null;
      });

      const result = await handle(
        makeAction({ level: 2, name: 'Detect Magic' }),
        makePlayerStats(), campaignName, null,
      );

      expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'spell_slots_level_1', 2, campaignName);
      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('level 1');
    });

    it('picks highest eligible level with expended slots', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'spell_slots_level_1') return 2;
        if (key === 'spell_slots_level_2') return 1;
        if (key === 'spell_slots_level_3') return 2;
        return null;
      });

      const result = await handle(
        makeAction({ level: 4 }),
        makePlayerStats(), campaignName, null,
      );

      // maxRegainLevel=3, iterates 3→1: level 3 (2<3) matches first
      expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'spell_slots_level_3', 3, campaignName);
      expect(result.payload.description).toContain('level 3');
    });

    it('skips levels at max capacity and picks highest level with expended slots', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'spell_slots_level_1') return 4;
        if (key === 'spell_slots_level_2') return 2;
        if (key === 'spell_slots_level_3') return 1;
        return null;
      });

      const result = await handle(
        makeAction({ level: 4 }),
        makePlayerStats(), campaignName, null,
      );

      // maxRegainLevel=3, level 3: 1<3 true, picked
      expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'spell_slots_level_3', 2, campaignName);
      expect(result.payload.description).toContain('level 3');
    });

    it('picks lowest level when all higher levels are at max capacity', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'spell_slots_level_1') return 1;
        if (key === 'spell_slots_level_2') return 3;
        return null;
      });

      const result = await handle(
        makeAction({ level: 3 }),
        makePlayerStats(), campaignName, null,
      );

      // maxRegainLevel=2, level 2: 3<3 false (at max), level 1: 1<4 true
      expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'spell_slots_level_1', 2, campaignName);
      expect(result.payload.description).toContain('level 1');
    });
  });

  describe('maxRegainLevel capping', () => {
    it('caps maxRegainLevel at 5 for high-level spell slots', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'spell_slots_level_5') return 1;
        if (key === 'spell_slots_level_6') return 1;
        return null;
      });

      const result = await handle(
        makeAction({ level: 9 }),
        makePlayerStats(), campaignName, null,
      );

      // maxRegainLevel = Math.min(5, 8) = 5, level 5: 1<2 true
      expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'spell_slots_level_5', 2, campaignName);
      expect(result.payload.description).toContain('level 5');
    });

    it('does not check levels above maxRegainLevel', async () => {
      const spy = vi.fn();
      getRuntimeValue.mockImplementation((name, key) => {
        spy(key);
        if (key === 'spell_slots_level_1') return 1;
        return null;
      });

      await handle(
        makeAction({ level: 2 }),
        makePlayerStats(), campaignName, null,
      );

      // maxRegainLevel = Math.min(5, 1) = 1, only checks level 1
      expect(spy).toHaveBeenCalledWith('spell_slots_level_1');
      expect(spy).not.toHaveBeenCalledWith('spell_slots_level_2');
    });
  });

  describe('side effects on success', () => {
    it('calls setRuntimeValue with incremented slot count', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'spell_slots_level_1') return 1;
        if (key === 'spell_slots_level_2') return 1;
        return null;
      });

      await handle(
        makeAction({ level: 3 }),
        makePlayerStats(), campaignName, null,
      );

      // maxRegainLevel=2, iterates 2→1: level 2 (1<3) matches first
      expect(setRuntimeValue).toHaveBeenCalledTimes(1);
      expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'spell_slots_level_2', 2, campaignName);
    });

    it('logs an entry with correct details', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'spell_slots_level_1') return 1;
        return null;
      });

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
        }),
      );
    });

    it('returns a popup with restoration details', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'spell_slots_level_2') return 1;
        return null;
      });

      const result = await handle(
        makeAction({ level: 4 }),
        makePlayerStats(), campaignName, null,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Expert Divination');
      expect(result.payload.description).toContain('You regain');
      expect(result.payload.description).toContain('level 2');
    });
  });
});
