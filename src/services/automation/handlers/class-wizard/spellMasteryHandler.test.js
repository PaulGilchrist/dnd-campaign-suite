// @maintained-by-ai
// Deterministic unit contract for the 2024 Spell Mastery automation handler:
// selection-state modal/popup payloads, eligibility predicate branches, and
// runtime-key writes (SpellMastery_level1/2). Both exports are live:
// handle -> spell_mastery in services/automation/index.js,
// onSpellMasterySelected -> CharSpecialActions.jsx useWizardSpellConfirms.
// Only direct deps are mocked; no timers, no DOM, pure handler behaviour.
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

const NO_ELIGIBLE_MSG = 'No level 1 or 2 wizard spells with casting time of an action available.';
const BOTH_REQUIRED_MSG = 'Both a level 1 and level 2 spell must be selected, and they must be different spells.';
const CLEARED_MSG = 'Spell Mastery selection cleared.';

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
    // clearAllMocks does not reset implementations — pin both mocks'
    // defaults here so per-test stubs cannot leak across tests.
    getRuntimeValue.mockReturnValue(undefined);
    loadSpells.mockResolvedValue([]);
  });

  it('returns a popup when no eligible spells exist', async () => {
    loadSpells.mockResolvedValue([makeWizardSpell('Fireball', 3)]);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.name).toBe('Spell Mastery');
    expect(result.payload.description).toBe(NO_ELIGIBLE_MSG);
  });

  it('returns a modal with options and optionDetails and empty current values when no selection has been made', async () => {
    loadSpells.mockResolvedValue([WIZARD_LEVEL1, WIZARD_LEVEL2]);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('modal');
    expect(result.modalName).toBe('spellMastery');
    expect(result.payload.level1Options).toEqual(['Magic Missile']);
    expect(result.payload.level2Options).toEqual(['Web']);
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
    expect(result.modalName).toBe('spellMastery');
    expect(result.payload.currentLevel1).toBe('Magic Missile');
    expect(result.payload.currentLevel2).toBe('Web');
    expect(result.payload.optionDetails).toBeUndefined();
    expect(result.payload.level1Options).toEqual(['Magic Missile']);
    expect(result.payload.level2Options).toEqual(['Web']);
  });

  it('falls back to the fresh-selection modal when only one of the two selections is set', async () => {
    loadSpells.mockResolvedValue([WIZARD_LEVEL1, WIZARD_LEVEL2]);

    for (const [key, value] of [
      ['SpellMastery_level1', 'Magic Missile'],
      ['SpellMastery_level2', 'Web'],
    ]) {
      getRuntimeValue.mockImplementation((_name, k) => (k === key ? value : undefined));

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.payload.optionDetails).toBeDefined();
      expect(result.payload.currentLevel1).toBe('');
      expect(result.payload.currentLevel2).toBe('');
    }
  });

  it('filters eligibility by wizard class, level 1-2, and action casting time', async () => {
    // Each spell fails exactly one eligibility branch; together none survive.
    const ineligibleSpells = [
      makeWizardSpell('Fireball', 3),                        // level too high
      makeWizardSpell('Thunderwave', 0),                    // cantrip
      makeWizardSpell('Wish', 9),                           // level too high
      { name: 'Burning Hands', level: 1, casting_time: 'Action', range: '', description: '', classes: ['Sorcerer'] },
      { name: 'Aid', level: 2, casting_time: 'Action', range: '', description: '', classes: ['Cleric', 'Paladin'] },
      { name: 'Orphan Spell', level: 1, casting_time: 'Action' },  // missing classes
      { name: 'Timeless Spell', level: 1, classes: ['Wizard'] },   // missing casting_time
    ];

    for (const spell of ineligibleSpells) {
      loadSpells.mockResolvedValue([spell]);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description, spell.name).toBe(NO_ELIGIBLE_MSG);
    }
  });

  it('allows casting time "Action" and "1 Action" only', async () => {
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

  it('includes spells where wizard is one of multiple classes, case-insensitively', async () => {
    loadSpells.mockResolvedValue([
      makeWizardSpell('Magic Missile', 1, 'Action', { classes: ['Sorcerer', 'Wizard'] }),
      makeWizardSpell('Shield', 1, 'Action', { classes: ['wizard'] }),
    ]);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.payload.level1Options).toEqual(['Magic Missile', 'Shield']);
  });

  it('uses fallback values in optionDetails when spell fields are missing', async () => {
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

  it('loads spells for the character ruleset, defaulting to 2024', async () => {
    loadSpells.mockResolvedValue([WIZARD_LEVEL1]);

    await handle(makeAction(), makePlayerStats({ rules: '5e' }), campaignName, null);
    expect(loadSpells).toHaveBeenCalledWith('5e');

    await handle(makeAction(), makePlayerStats({ rules: null }), campaignName, null);
    expect(loadSpells).toHaveBeenLastCalledWith('2024');
  });
});

describe('spellMasteryHandler.onSpellMasterySelected', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setRuntimeValue.mockResolvedValue(undefined);
  });

  it('returns an error popup without writing runtime state for invalid selections', async () => {
    const errorCases = [
      ['', ''],
      [null, 'Web'],
      ['Magic Missile', null],
      ['Magic Missile', 'Magic Missile'],
      ['', 'Web'],
      ['Magic Missile', ''],
      [undefined, 'Web'],
      ['Magic Missile', undefined],
    ];

    for (const [l1, l2] of errorCases) {
      const result = await onSpellMasterySelected(makeAction(), makePlayerStats(), campaignName, l1, l2);

      expect(result.type, `${l1}/${l2}`).toBe('popup');
      expect(result.payload.description, `${l1}/${l2}`).toBe(BOTH_REQUIRED_MSG);
      expect(setRuntimeValue, `${l1}/${l2}`).not.toHaveBeenCalled();
    }
  });

  it('clears both runtime values when both selections are null or undefined', async () => {
    for (const [l1, l2] of [[null, null], [undefined, undefined]]) {
      const result = await onSpellMasterySelected(makeAction(), makePlayerStats(), campaignName, l1, l2);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe(CLEARED_MSG);
      expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'SpellMastery_level1', null, campaignName, true);
      expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'SpellMastery_level2', null, campaignName, true);
    }
  });

  it('writes both runtime values and returns a confirmation popup for a valid selection', async () => {
    const validCases = [
      ['Magic Missile', 'Web'],
      ["Fireball's Flame", 'Ray of Frost'],
    ];

    for (const [l1, l2] of validCases) {
      const result = await onSpellMasterySelected(makeAction(), makePlayerStats(), campaignName, l1, l2);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe(
        `Spell Mastery: You can now cast <b>${l1}</b> (level 1) and <b>${l2}</b> (level 2) at will without expending spell slots. These spells are always prepared.`
      );
      expect(result.payload.automation).toEqual({ type: 'spell_mastery' });
      expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'SpellMastery_level1', l1, campaignName, true);
      expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'SpellMastery_level2', l2, campaignName, true);
    }
  });
});
