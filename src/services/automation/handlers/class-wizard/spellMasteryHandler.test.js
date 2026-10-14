import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/dataLoader.js', () => ({
  loadSpells: vi.fn(),
}));

import { handle, onSpellMasterySelected } from './spellMasteryHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { loadSpells } from '../../../ui/dataLoader.js';

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestWizard',
    level: 14,
    proficiency: 6,
    rules: '2024',
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Spell Mastery',
    automation: { type: 'spell_mastery', ...automation },
  };
}

function makeWizardSpell(name, level, castingTime = 'Action', extra = {}) {
  return {
    name,
    level,
    casting_time: castingTime,
    range: '120 ft',
    description: '',
    classes: ['Wizard'],
    ...extra,
  };
}

const WIZARD_LEVEL1 = makeWizardSpell('Magic Missile', 1);
const WIZARD_LEVEL2 = makeWizardSpell('Web', 2);

describe('spellMasteryHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(undefined);
  });

  describe('return type and payload based on selection state', () => {
    it('returns a popup when no eligible spells exist', async () => {
      loadSpells.mockResolvedValue([makeWizardSpell('Fireball', 3)]);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('No level 1 or 2 wizard spells with casting time of an action available.');
    });

    it('returns a modal with optionDetails when eligible spells exist and no selection has been made', async () => {
      loadSpells.mockResolvedValue([WIZARD_LEVEL1, WIZARD_LEVEL2]);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('spellMastery');
      expect(result.payload.optionDetails).toBeDefined();
      expect(result.payload.currentLevel1).toBe('');
      expect(result.payload.currentLevel2).toBe('');
    });

    it('returns a modal with current selections and no optionDetails when both are already set', async () => {
      loadSpells.mockResolvedValue([WIZARD_LEVEL1, WIZARD_LEVEL2]);
      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'SpellMastery_level1') return 'Magic Missile';
        if (key === 'SpellMastery_level2') return 'Web';
        return undefined;
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.payload.currentLevel1).toBe('Magic Missile');
      expect(result.payload.currentLevel2).toBe('Web');
      expect(result.payload.optionDetails).toBeUndefined();
    });

    it('returns a modal with optionDetails and empty current values when only level1 is already set', async () => {
      loadSpells.mockResolvedValue([WIZARD_LEVEL1, WIZARD_LEVEL2]);
      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'SpellMastery_level1') return 'Magic Missile';
        return undefined;
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.payload.optionDetails).toBeDefined();
      expect(result.payload.currentLevel1).toBe('');
      expect(result.payload.currentLevel2).toBe('');
    });

    it('returns a modal with optionDetails and empty current values when only level2 is already set', async () => {
      loadSpells.mockResolvedValue([WIZARD_LEVEL1, WIZARD_LEVEL2]);
      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'SpellMastery_level2') return 'Web';
        return undefined;
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.payload.optionDetails).toBeDefined();
      expect(result.payload.currentLevel1).toBe('');
      expect(result.payload.currentLevel2).toBe('');
    });
  });

  describe('spell eligibility filtering', () => {
    it('includes level 1 and 2 wizard spells with action casting time', async () => {
      loadSpells.mockResolvedValue([WIZARD_LEVEL1, WIZARD_LEVEL2]);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.level1Options).toEqual(['Magic Missile']);
      expect(result.payload.level2Options).toEqual(['Web']);
    });

    it('excludes non-wizard spells and non-action casting times', async () => {
      const nonWizardSpells = [
        { name: 'Burning Hands', level: 1, casting_time: 'Action', range: '', description: '', classes: ['Sorcerer'] },
        { name: 'Aid', level: 2, casting_time: 'Action', range: '', description: '', classes: ['Cleric', 'Paladin'] },
      ];
      loadSpells.mockResolvedValue(nonWizardSpells);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
    });

    it('filters by casting time allowing both "Action" and "1 Action"', async () => {
      const spells = [
        makeWizardSpell('Reaction Spell', 1, 'Reaction'),
        makeWizardSpell('Bonus Action Spell', 1, '1 Bonus Action'),
        makeWizardSpell('Bonus Action Alt', 2, 'Bonus Action'),
        makeWizardSpell('Action Spell', 1, 'Action'),
        makeWizardSpell('Shield', 1, '1 Action'),
      ];
      loadSpells.mockResolvedValue(spells);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.level1Options).toEqual(['Action Spell', 'Shield']);
      expect(result.payload.level2Options).toEqual([]);
    });

    it('includes spells where wizard is one of multiple classes', async () => {
      loadSpells.mockResolvedValue([
        { name: 'Magic Missile', level: 1, casting_time: 'Action', range: '', description: '', classes: ['Sorcerer', 'Wizard'] },
      ]);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.level1Options).toEqual(['Magic Missile']);
    });

    it('excludes spells with missing classes field', async () => {
      loadSpells.mockResolvedValue([
        { name: 'Orphan Spell', level: 1, casting_time: 'Action' },
      ]);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
    });

    it('excludes spells with missing casting_time field', async () => {
      loadSpells.mockResolvedValue([
        { name: 'Timeless Spell', level: 1, classes: ['Wizard'] },
      ]);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
    });

    it('excludes spells outside level 1-2 range', async () => {
      const spells = [
        makeWizardSpell('Cantrip', 0),
        makeWizardSpell('Fireball', 3),
        makeWizardSpell('Wish', 9),
      ];
      loadSpells.mockResolvedValue(spells);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
    });
  });

  describe('payload structure', () => {
    it('uses fallback values when spell fields are missing in optionDetails', async () => {
      const incompleteSpell = {
        name: 'Incomplete',
        level: 1,
        classes: ['Wizard'],
        casting_time: 'Action',
      };
      loadSpells.mockResolvedValue([incompleteSpell]);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.optionDetails['Incomplete']).toEqual({
        name: 'Incomplete',
        level: 1,
        casting_time: 'Action',
        range: '',
        description: '',
        damage: null,
      });
    });
  });

  describe('ruleset handling', () => {
    it('loads spells for the correct ruleset', async () => {
      loadSpells.mockResolvedValue([WIZARD_LEVEL1]);

      await handle(makeAction(), makePlayerStats({ rules: '5e' }), campaignName, null);

      expect(loadSpells).toHaveBeenCalledWith('5e');
    });

    it('defaults to 2024 when rules is null', async () => {
      loadSpells.mockResolvedValue([WIZARD_LEVEL1]);

      await handle(makeAction(), makePlayerStats({ rules: null }), campaignName, null);

      expect(loadSpells).toHaveBeenCalledWith('2024');
    });
  });
});

describe('spellMasteryHandler.onSpellMasterySelected', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validation', () => {
    it('returns an error popup for invalid inputs', async () => {
      const errorCases = [
        { l1: '', l2: '' },
        { l1: null, l2: 'Web' },
        { l1: 'Magic Missile', l2: null },
        { l1: 'Magic Missile', l2: 'Magic Missile' },
        { l1: '', l2: 'Web' },
        { l1: 'Magic Missile', l2: '' },
        { l1: undefined, l2: 'Web' },
        { l1: 'Magic Missile', l2: undefined },
      ];

      for (const { l1, l2 } of errorCases) {
        const result = await onSpellMasterySelected(makeAction(), makePlayerStats(), campaignName, l1, l2);
        expect(result.type).toBe('popup');
      }
    });
  });

  describe('clearing selection', () => {
    it('clears both runtime values when both are null or undefined', async () => {
      const result = await onSpellMasterySelected(makeAction(), makePlayerStats(), campaignName, null, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('Spell Mastery selection cleared.');
      expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'SpellMastery_level1', null, campaignName, true);
      expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'SpellMastery_level2', null, campaignName, true);
    });
  });

  describe('successful selection', () => {
    it('sets runtime values for both selected spells', async () => {
      const result = await onSpellMasterySelected(makeAction(), makePlayerStats(), campaignName, 'Magic Missile', 'Web');

      expect(result.type).toBe('popup');
      expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'SpellMastery_level1', 'Magic Missile', campaignName, true);
      expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'SpellMastery_level2', 'Web', campaignName, true);
    });

    it('handles spell names with special characters', async () => {
      const result = await onSpellMasterySelected(makeAction(), makePlayerStats(), campaignName, "Fireball's Flame", 'Ray of Frost');

      expect(result.payload.description).toContain("Fireball's Flame");
      expect(result.payload.description).toContain('Ray of Frost');
      expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'SpellMastery_level1', "Fireball's Flame", campaignName, true);
      expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'SpellMastery_level2', 'Ray of Frost', campaignName, true);
    });
  });
});
