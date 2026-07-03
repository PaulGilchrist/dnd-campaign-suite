// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
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
  });

  describe('return type', () => {
    it('returns a modal when eligible spells exist and no selection has been made', async () => {
      loadSpells.mockResolvedValue([WIZARD_LEVEL1, WIZARD_LEVEL2]);
      getRuntimeValue.mockReturnValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('spellMastery');
    });

    it('returns a popup when no eligible spells exist', async () => {
      loadSpells.mockResolvedValue([makeWizardSpell('Fireball', 3)]);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('No level 1 or 2 wizard spells with casting time of an action available.');
    });
  });

  describe('spell eligibility filtering', () => {
    it('includes level 1 and 2 wizard spells with action casting time', async () => {
      loadSpells.mockResolvedValue([WIZARD_LEVEL1, WIZARD_LEVEL2]);
      getRuntimeValue.mockReturnValue(null);

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
      getRuntimeValue.mockReturnValue(null);

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
      getRuntimeValue.mockReturnValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.level1Options).toEqual(['Action Spell', 'Shield']);
      expect(result.payload.level2Options).toEqual([]);
    });

    it('includes spells where wizard is one of multiple classes', async () => {
      loadSpells.mockResolvedValue([
        { name: 'Magic Missile', level: 1, casting_time: 'Action', range: '', description: '', classes: ['Sorcerer', 'Wizard'] },
      ]);
      getRuntimeValue.mockReturnValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.level1Options).toEqual(['Magic Missile']);
    });
  });

  describe('existing selection state', () => {
    it('returns modal with current selections when both level1 and level2 are already set', async () => {
      loadSpells.mockResolvedValue([WIZARD_LEVEL1, WIZARD_LEVEL2]);
      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'SpellMastery_level1') return 'Magic Missile';
        if (key === 'SpellMastery_level2') return 'Web';
        return null;
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.payload.currentLevel1).toBe('Magic Missile');
      expect(result.payload.currentLevel2).toBe('Web');
    });

    it('returns modal with empty selections when only one or neither is set', async () => {
      loadSpells.mockResolvedValue([WIZARD_LEVEL1, WIZARD_LEVEL2]);
      getRuntimeValue.mockReturnValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.payload.currentLevel1).toBe('');
      expect(result.payload.currentLevel2).toBe('');
    });
  });

  describe('ruleset handling', () => {
    it('loads spells for the correct ruleset', async () => {
      loadSpells.mockResolvedValue([WIZARD_LEVEL1]);
      getRuntimeValue.mockReturnValue(null);

      await handle(makeAction(), makePlayerStats({ rules: '5e' }), campaignName, null);

      expect(loadSpells).toHaveBeenCalledWith('5e');
    });
  });
});

describe('spellMasteryHandler.onSpellMasterySelected', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validation', () => {
    it('returns error when both values are empty strings', async () => {
      const result = await onSpellMasterySelected(makeAction(), makePlayerStats(), campaignName, '', '');

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('Both a level 1 and level 2 spell must be selected, and they must be different spells.');
    });

    it('returns error when either spell is missing or both are the same', async () => {
      const result1 = await onSpellMasterySelected(makeAction(), makePlayerStats(), campaignName, null, 'Web');
      expect(result1.type).toBe('popup');
      expect(result1.payload.description).toBe('Both a level 1 and level 2 spell must be selected, and they must be different spells.');

      const result2 = await onSpellMasterySelected(makeAction(), makePlayerStats(), campaignName, 'Magic Missile', null);
      expect(result2.type).toBe('popup');

      const result3 = await onSpellMasterySelected(makeAction(), makePlayerStats(), campaignName, 'Magic Missile', 'Magic Missile');
      expect(result3.type).toBe('popup');
    });
  });

  describe('clearing selection', () => {
    it('clears both runtime values when both are null', async () => {
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

    it('returns success message with spell names and key phrases', async () => {
      const result = await onSpellMasterySelected(makeAction(), makePlayerStats(), campaignName, 'Magic Missile', 'Web');

      expect(result.payload.description).toContain('Magic Missile');
      expect(result.payload.description).toContain('Web');
      expect(result.payload.description).toContain('at will');
      expect(result.payload.description).toContain('always prepared');
    });
  });
});
