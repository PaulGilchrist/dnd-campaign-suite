// @maintained-by-ai
// MonsterCardModal save-chip click lane (ownership cited: interaction.test.jsx:10 "action
// save_dc chip → save-modifier.test.jsx"). Pins the modifier-resolution producer seam once,
// click → roll: executeBlockSaveRoll (MonsterCardModal.jsx:445-446) resolves the save bonus via
// getSaveModifierForSaveType (MonsterCardHelpers.js:644-657) and threads it into
// rollSavingThrow(abbr, mod, ctx). Every resolution branch earns a distinct byte here:
// player abilities beat creature saving_throws (real unmocked abilityLookup save ?? bonus),
// saving_throws beats ability_score_modifiers, an honest 0 in saving_throws does NOT fall
// through (!= null semantics at Helpers:635), negatives ride the asm fallback, the non-player
// branch (Helpers:656), no-source → 0, and the MA-0049 no-target refusal (zero-roll canary).
// Cited owners, not re-tested here: roll consumption (useLoggedDiceRoll/saveProcessing), full
// save-context shape (MonsterCardModal.secondary-save-transport.test.js, ma1563:44),
// abbreviation map (MonsterCardModal.test-utils.test.js saveAbilityAbbr), and no-target
// popup/log bytes (MonsterCardHelpers.usage.test.js). No DC arithmetic is restated — the
// authored save_dc is pinned verbatim as it reaches the roll.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';

// ── Mocks (each bisected: only what the save-chip click lane needs) ─────
// useLoggedDiceRoll — the spy under test; popupHtml static (no popup consumer here).
vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  const _rollSavingThrow = vi.fn();
  return {
    default: vi.fn(() => ({
      popupHtml: null,
      setPopupHtml: vi.fn(),
      rollAttack: vi.fn(),
      rollDamage: vi.fn(),
      rollAbilityCheck: vi.fn(),
      rollSavingThrow: _rollSavingThrow,
      rollSkillCheck: vi.fn(),
      rollInitiative: vi.fn(),
      quickRollPlayerSave: vi.fn(),
    })),
    _rollSavingThrow,
  };
});

// damageUtils — arms the Goblin→target attacker link (getTarget, Modal:2298) and
// silences the render-time getCombatContext fetch (Modal:2125).
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  extractDamageTypes: vi.fn(() => []),
  formatDamageTypes: vi.fn((types) => (types || []).join(', ') || ''),
  getTargetFromAttacker: vi.fn(() => null),
  getResistanceNotice: vi.fn(() => null),
  findCreatureByName: vi.fn(() => null),
  getCombatContext: vi.fn().mockResolvedValue(null),
}));

// Zero-network guarantee: refusals/logs never hit the live API from this lane.
vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(() => null),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
  setRuntimeObject: vi.fn(),
}));

// Render-time condition reducer (Modal:1445/2362) — inert defaults; condition
// math belongs to its own owners, not this modifier lane.
vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn(() => ({ ...defaultConditionEffects })),
  combineAttackModes: vi.fn(() => 'normal'),
  CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
}));

// abilityLookup intentionally UNMOCKED — the real getAbilitySaveModifier (save ?? bonus)
// runs through the seam and is pinned by the abilities-priority case below.

import * as damageUtils from '../../services/rules/combat/damageUtils.js';
import * as logService from '../../services/ui/logService.js';
import { _rollSavingThrow as rollSavingThrow } from '../../hooks/combat/useLoggedDiceRoll.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Render a Goblin with a single Web block-save row and arm the given target. */
function renderSaveRow({ saveType, saveDc, targetEntry, characters = [] }) {
  damageUtils.findCreatureByName.mockReturnValue({
    name: 'Goblin',
    conditions: [],
    ...(targetEntry ? { targetName: targetEntry.name } : {}),
  });
  const creatures = [{ name: 'Goblin', conditions: [] }, ...(targetEntry ? [targetEntry] : [])];
  const monster = makeMonster({
    actions: [{ name: 'Web', description: `${saveType} Saving Throw: DC ${saveDc}`, save_dc: saveDc, save_type: saveType }],
  });
  render(<MonsterCardModal {...makeProps(monster, { creatures, characters })} />);
  return Array.from(document.querySelectorAll('.mc-dice-link-save-clickable'))
    .find(el => el.textContent.includes(`DC ${saveDc}`)) || null;
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('MonsterCardModal — save chip click resolves target save modifier (executeBlockSaveRoll → getSaveModifierForSaveType)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    {
      desc: 'player abilities win over creature saving_throws (save over bonus via real abilityLookup)',
      saveType: 'Dexterity', saveDc: 13, abbr: 'DEX', expectedMod: 5,
      targetEntry: { name: 'Player A', type: 'player', saving_throws: { dex: { modifier: 9 } }, ability_score_modifiers: { dex: 8 } },
      characters: [{ name: 'Player A', abilities: [{ name: 'Dexterity', save: 5, bonus: 3 }] }],
    },
    {
      desc: 'player without abilities reads creature saving_throws, beating ability_score_modifiers',
      saveType: 'Wisdom', saveDc: 12, abbr: 'WIS', expectedMod: 2,
      targetEntry: { name: 'Player A', type: 'player', saving_throws: { wis: { modifier: 2 } }, ability_score_modifiers: { wis: 7 } },
      characters: [],
    },
    {
      desc: 'saving_throws modifier of 0 is an honest zero, not a fall-through to ability_score_modifiers',
      saveType: 'Dexterity', saveDc: 15, abbr: 'DEX', expectedMod: 0,
      targetEntry: { name: 'Player A', type: 'player', saving_throws: { dex: { modifier: 0 } }, ability_score_modifiers: { dex: 4 } },
      characters: [],
    },
    {
      desc: 'player falls through to ability_score_modifiers with the negative sign preserved',
      saveType: 'Strength', saveDc: 12, abbr: 'STR', expectedMod: -2,
      targetEntry: { name: 'Player A', type: 'player', saving_throws: {}, ability_score_modifiers: { str: -2 } },
      characters: [],
    },
    {
      desc: 'non-player target resolves its own saving_throws',
      saveType: 'Constitution', saveDc: 14, abbr: 'CON', expectedMod: 4,
      targetEntry: { name: 'Ogre', saving_throws: { con: { modifier: 4 } } },
      characters: [],
    },
    {
      desc: 'no modifier source anywhere resolves to 0',
      saveType: 'Charisma', saveDc: 13, abbr: 'CHA', expectedMod: 0,
      targetEntry: { name: 'Player A', type: 'player' },
      characters: [],
    },
  ])('$desc', ({ saveType, saveDc, abbr, expectedMod, targetEntry, characters }) => {
    const saveLink = renderSaveRow({ saveType, saveDc, targetEntry, characters });
    expect(saveLink).toBeInTheDocument();

    fireEvent.click(saveLink);

    expect(rollSavingThrow).toHaveBeenCalledTimes(1);
    expect(rollSavingThrow).toHaveBeenCalledWith(abbr, expectedMod, expect.objectContaining({
      saveDc,
      saveType,
      targetName: targetEntry.name,
    }));
  });

  it('renders the DC chip with no armed target but refuses the click — zero rolls, refusal logged (MA-0049)', () => {
    const saveLink = renderSaveRow({ saveType: 'Dexterity', saveDc: 13, targetEntry: null });
    expect(saveLink).toBeInTheDocument();

    fireEvent.click(saveLink);

    expect(rollSavingThrow).not.toHaveBeenCalled();
    expect(logService.addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({ automationType: expect.stringContaining('refused') }));
  });
});
