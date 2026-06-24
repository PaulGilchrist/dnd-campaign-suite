// @improved-by-ai
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
      loadSpells.mockResolvedValue([]);

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

    it('excludes level 0 (cantrip) spells', async () => {
      loadSpells.mockResolvedValue([makeWizardSpell('Fire Bolt', 0)]);
      getRuntimeValue.mockReturnValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.level1Options).toBeUndefined();
    });

    it('excludes level 3+ spells', async () => {
      loadSpells.mockResolvedValue([makeWizardSpell('Fireball', 3)]);
      getRuntimeValue.mockReturnValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
    });

    it('excludes non-wizard spells', async () => {
      const nonWizardSpells = [
        { name: 'Burning Hands', level: 1, casting_time: 'Action', range: '', description: '', classes: ['Sorcerer'] },
        { name: 'Aid', level: 2, casting_time: 'Action', range: '', description: '', classes: ['Cleric', 'Paladin'] },
      ];
      loadSpells.mockResolvedValue(nonWizardSpells);
      getRuntimeValue.mockReturnValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
    });

    it('excludes spells with non-action casting times', async () => {
      const spells = [
        makeWizardSpell('Reaction Spell', 1, 'Reaction'),
        makeWizardSpell('Bonus Action Spell', 1, '1 Bonus Action'),
        makeWizardSpell('Bonus Action Alt', 2, 'Bonus Action'),
        makeWizardSpell('Action Spell', 1, 'Action'),
      ];
      loadSpells.mockResolvedValue(spells);
      getRuntimeValue.mockReturnValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.level1Options).toEqual(['Action Spell']);
      expect(result.payload.level2Options).toEqual([]);
    });

    it('includes spells with "1 Action" casting time', async () => {
      loadSpells.mockResolvedValue([makeWizardSpell('Shield', 1, '1 Action')]);
      getRuntimeValue.mockReturnValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.level1Options).toEqual(['Shield']);
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

    it('returns modal with empty selections when only one is set', async () => {
      loadSpells.mockResolvedValue([WIZARD_LEVEL1, WIZARD_LEVEL2]);
      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'SpellMastery_level1') return 'Magic Missile';
        return null;
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.payload.currentLevel1).toBe('');
      expect(result.payload.currentLevel2).toBe('');
      expect(result.payload.level1Options).toEqual(['Magic Missile']);
      expect(result.payload.level2Options).toEqual(['Web']);
    });

    it('returns modal with empty selections when neither is set', async () => {
      loadSpells.mockResolvedValue([WIZARD_LEVEL1, WIZARD_LEVEL2]);
      getRuntimeValue.mockReturnValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.payload.currentLevel1).toBe('');
      expect(result.payload.currentLevel2).toBe('');
    });
  });

  describe('ruleset handling', () => {
    it('loads spells for the 2024 ruleset by default', async () => {
      loadSpells.mockResolvedValue([WIZARD_LEVEL1]);
      getRuntimeValue.mockReturnValue(null);

      await handle(makeAction(), makePlayerStats({ rules: '2024' }), campaignName, null);

      expect(loadSpells).toHaveBeenCalledWith('2024');
    });

    it('loads spells for the 5e ruleset when specified', async () => {
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

    it('returns error when level1 is null and level2 is provided', async () => {
      const result = await onSpellMasterySelected(makeAction(), makePlayerStats(), campaignName, null, 'Web');

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('Both a level 1 and level 2 spell must be selected, and they must be different spells.');
    });

    it('returns error when level2 is null and level1 is provided', async () => {
      const result = await onSpellMasterySelected(makeAction(), makePlayerStats(), campaignName, 'Magic Missile', null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('Both a level 1 and level 2 spell must be selected, and they must be different spells.');
    });

    it('returns error when the same spell is selected for both slots', async () => {
      const result = await onSpellMasterySelected(makeAction(), makePlayerStats(), campaignName, 'Magic Missile', 'Magic Missile');

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('Both a level 1 and level 2 spell must be selected, and they must be different spells.');
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

    it('includes the action automation in the payload', async () => {
      const result = await onSpellMasterySelected(makeAction(), makePlayerStats(), campaignName, 'Magic Missile', 'Web');

      expect(result.payload.automation).toEqual(makeAction().automation);
    });

    it('includes the action name in the payload', async () => {
      const result = await onSpellMasterySelected(makeAction(), makePlayerStats(), campaignName, 'Magic Missile', 'Web');

      expect(result.payload.name).toBe('Spell Mastery');
    });
  });
});
