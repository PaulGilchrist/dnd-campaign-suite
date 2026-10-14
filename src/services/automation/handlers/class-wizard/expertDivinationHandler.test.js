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

    it('returns null when spell school is an empty string', async () => {
      const result = await handle(
        makeAction({ school: '' }),
        makePlayerStats(), campaignName, null,
      );

      expect(result).toBeNull();
    });

    it('returns null when action.spell is undefined', async () => {
      const result = await handle(
        { name: 'Expert Divination', automation: { type: 'expert_divination' } },
        makePlayerStats(), campaignName, null,
      );

      expect(result).toBeNull();
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

    it('returns null when spellSlotLevel is missing or zero', async () => {
      const result = await handle(
        makeAction({ level: undefined }, { spellSlotLevel: 0 }),
        makePlayerStats(), campaignName, null,
      );

      expect(result).toBeNull();
    });

    it('returns null when both spellSlotLevel and spell.level are missing', async () => {
      const result = await handle(
        makeAction({ level: undefined }, {}),
        makePlayerStats(), campaignName, null,
      );

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
      expect(result.type).toBe('popup');
    });

    it('returns null when spellSlotLevel is 2 but no eligible slots exist', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'spell_slots_level_1') return 4;
        return null;
      });

      const result = await handle(
        makeAction({ level: 2 }),
        makePlayerStats(), campaignName, null,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No eligible spell slots');
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
        if (key === 'spell_slots_level_1') return 2;
        if (key === 'spell_slots_level_2') return 1;
        if (key === 'spell_slots_level_3') return 3;
        return null;
      });

      const result = await handle(
        makeAction({ level: 4 }),
        makePlayerStats(), campaignName, null,
      );

      expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'spell_slots_level_2', 2, campaignName);
      expect(result.payload.description).toContain('level 2');
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

    it('skips levels where all slots are fully expended (current = 0)', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'spell_slots_level_1') return 0;
        if (key === 'spell_slots_level_2') return 1;
        return null;
      });

      const result = await handle(
        makeAction({ level: 3 }),
        makePlayerStats(), campaignName, null,
      );

      expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'spell_slots_level_2', 2, campaignName);
      expect(result.payload.description).toContain('level 2');
    });
  });

  describe('side effects', () => {
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

    it('returns popup with restoration details including slot and expended info', async () => {
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

    it('does not throw when addEntry rejects', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'spell_slots_level_1') return 1;
        return null;
      });

      addEntry.mockRejectedValue(new Error('log write failed'));

      const consoleErr = console.error;
      console.error = vi.fn();

      const result = await handle(
        makeAction({ level: 3, name: 'Scrying' }),
        makePlayerStats(), campaignName, null,
      );

      expect(result.type).toBe('popup');
      expect(console.error).toHaveBeenCalledWith(
        '[expertDivination] Error:',
        expect.any(Error),
      );

      console.error = consoleErr;
    });
  });
});
