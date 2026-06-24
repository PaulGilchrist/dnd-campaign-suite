// @improved-by-ai
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

    it('returns null when spell property is missing from action', async () => {
      const action = makeAction();
      delete action.spell;

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result).toBeNull();
    });

    it('returns null when spell has no school property', async () => {
      const result = await handle(
        makeAction({ school: undefined }),
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

    it('returns null for level 1 spell (maxRegainLevel would be 0)', async () => {
      const result = await handle(
        makeAction({ level: 1 }),
        makePlayerStats(), campaignName, null,
      );

      expect(result).toBeNull();
    });

    it('returns null when spell.level and spellSlotLevel are both missing', async () => {
      const action = makeAction({ level: undefined });
      delete action.spellSlotLevel;

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result).toBeNull();
    });

    it('returns null when spell.level and spellSlotLevel are both zero', async () => {
      const action = makeAction({ level: 0 }, { spellSlotLevel: 0 });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result).toBeNull();
    });
  });

  describe('Divination school matching', () => {
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
    });

    it('uses action.spellSlotLevel as fallback when spell.level is missing', async () => {
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
      expect(result.type).toBe('popup');
    });
  });

  describe('slot availability checks', () => {
    it('returns info popup when all eligible slot levels have zero current slots', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'spell_slots_level_1') return 0;
        if (key === 'spell_slots_level_2') return 0;
        return null;
      });

      const result = await handle(
        makeAction({ level: 3 }),
        makePlayerStats(), campaignName, null,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No eligible spell slots');
    });

    it('returns info popup when eligible levels are at max capacity', async () => {
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

    it('returns info popup when playerStats.spellAbilities is missing', async () => {
      const stats = makePlayerStats();
      delete stats.spellAbilities;

      const result = await handle(
        makeAction({ level: 3 }),
        stats, campaignName, null,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No eligible spell slots');
    });

    it('returns info popup when no eligible level has maxSlots > 0', async () => {
      const stats = makePlayerStats({
        spellAbilities: {
          spell_slots_level_1: 0,
          spell_slots_level_2: 0,
          spell_slots_level_3: 0,
        },
      });

      const result = await handle(
        makeAction({ level: 3 }),
        stats, campaignName, null,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No eligible spell slots');
    });
  });

  describe('slot selection logic', () => {
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

      expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'spell_slots_level_3', 3, campaignName);
      expect(result.payload.description).toContain('level 3');
    });

    it('skips levels at max capacity and picks next lower with expended slots', async () => {
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

      expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'spell_slots_level_3', 2, campaignName);
      expect(result.payload.description).toContain('level 3');
    });

    it('picks lowest eligible level when all higher levels are at max', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'spell_slots_level_1') return 1;
        if (key === 'spell_slots_level_2') return 3;
        return null;
      });

      const result = await handle(
        makeAction({ level: 3 }),
        makePlayerStats(), campaignName, null,
      );

      expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'spell_slots_level_1', 2, campaignName);
      expect(result.payload.description).toContain('level 1');
    });

    it('restores a lower-level slot when casting with a higher-level slot for a lower-level spell', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'spell_slots_level_1') return 1;
        return null;
      });

      const result = await handle(
        makeAction({ level: 2, name: 'Detect Magic' }),
        makePlayerStats(), campaignName, null,
      );

      expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'spell_slots_level_1', 2, campaignName);
      expect(result.payload.description).toContain('level 1');
    });

    it('caps maxRegainLevel at 5 for high-level spell slots', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'spell_slots_level_5') return 1;
        return null;
      });

      const result = await handle(
        makeAction({ level: 9 }),
        makePlayerStats(), campaignName, null,
      );

      expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'spell_slots_level_5', 2, campaignName);
      expect(result.payload.description).toContain('level 5');
    });

    it('does not query slot levels above maxRegainLevel', async () => {
      const querySpy = vi.fn();
      getRuntimeValue.mockImplementation((name, key) => {
        querySpy(key);
        if (key === 'spell_slots_level_1') return 1;
        return null;
      });

      await handle(
        makeAction({ level: 2 }),
        makePlayerStats(), campaignName, null,
      );

      expect(querySpy).toHaveBeenCalledWith('spell_slots_level_1');
      expect(querySpy).not.toHaveBeenCalledWith('spell_slots_level_2');
    });
  });

  describe('side effects', () => {
    it('calls setRuntimeValue exactly once with correct arguments', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'spell_slots_level_1') return 1;
        if (key === 'spell_slots_level_2') return 1;
        return null;
      });

      await handle(
        makeAction({ level: 3 }),
        makePlayerStats(), campaignName, null,
      );

      expect(setRuntimeValue).toHaveBeenCalledTimes(1);
      expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'spell_slots_level_2', 2, campaignName);
    });

    it('calls addEntry with correct ability_use log data', async () => {
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
          description: expect.stringMatching(/level 1.*Scrying/),
          timestamp: expect.any(Number),
        }),
      );
    });

    it('returns popup with restoration details', async () => {
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
      expect(result.payload.description).toContain('expended slot level 4');
    });

    it('includes automation object in popup payload', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'spell_slots_level_1') return 1;
        return null;
      });

      const result = await handle(
        makeAction({ level: 3 }),
        makePlayerStats(), campaignName, null,
      );

      expect(result.payload.automation).toEqual({ type: 'expert_divination' });
    });
  });

  describe('info popup structure', () => {
    it('includes automation object in no-slots popup payload', async () => {
      getRuntimeValue.mockReturnValue(0);

      const result = await handle(
        makeAction({ level: 2 }),
        makePlayerStats(), campaignName, null,
      );

      expect(result.payload.automation).toEqual({ type: 'expert_divination' });
    });

    it('uses action.name in popup description when no slots available', async () => {
      getRuntimeValue.mockReturnValue(0);

      const result = await handle(
        makeAction({ level: 2 }, { name: 'Custom Ability' }),
        makePlayerStats(), campaignName, null,
      );

      expect(result.payload.description).toContain('Custom Ability');
    });
  });
});
