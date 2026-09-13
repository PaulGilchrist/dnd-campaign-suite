// @improved-by-ai
// @cleaned-by-ai
// Removed redundant test: "renders the (Incapacitated) label and no attack dice link
// when the attacker cannot act" — covered by interaction.test.jsx
// ("does not render attack links when the attacker has an incapacitating condition"),
// which asserts the same (Incapacitated) label + missing attack link behavior.
// Behavioral tests for MonsterCardModal logic that is NOT covered by the
// sibling MonsterCardModal test files. Every behavior below was checked
// against ALL other MonsterCardModal test files before being added:
//
//   attacker cannot act (incapacitated)      — now covered by interaction.test.jsx
//     ("does not render attack links when the attacker has an incapacitating condition").
//     The redundant test was removed; only the non-blocking condition path remains here.
//   riderAttackBonus added to attack bonus   — not covered. helpers.test.jsx only
//     asserts the badge renders, never that rollAttack receives bonus + riderAttackBonus.
//   resistanceNotice passthrough             — not covered. attack-advanced.test.jsx
//     defines __setResistanceNoticeReturn but never uses it.
//   saveConditions from save_effect         — not covered. conditions-extraction.test.jsx
//     only asserts rendering, never the rollAttack argument.
//   handleSaveRoll autoDamage context        — not covered. save-modifier.test.jsx only
//     asserts saveDc/saveType/dcSuccess, never the autoDamage fields.
//   handleDamage critical-hit path           — not covered. auto-damage-roll.test.jsx
//     exercises the autoDamageRoll callback crit, not popupHtml.isCrit in handleDamage.
//   combat-context fallback                  — not covered. senses-and-fallback.test.jsx
//     only checks the name still renders; nothing asserts getCombatContext is used.
//
// Duplicate coverage deliberately avoided (already asserted elsewhere):
//   - rollAttack damageType / autoDamageFormula / saveDc / saveType / forcedMode
//     (attack-logic, attack-advanced, auto-damage-roll)
//   - damage/skill/ability/initiative dice clicks (interaction, damage-and-ability-checks)
//   - extractDamageDiceFromDescription unit cases (extract-damage-dice)
//   - effect badge rendering (helpers)
//   - senses, shield of faith, ally modal, save-modifier fallbacks
//     (senses-and-fallback, ally-modal, save-modifier)

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn((formula) => ({ total: parseInt(formula.split('d')[0]) * 5, rolls: [1, 2], modifier: 0 })),
  rollExpressionDoubled: vi.fn((formula) => ({ total: parseInt(formula.split('d')[0]) * 10, rolls: [1, 2], modifier: 0 })),
}));

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _rollAttack = vi.fn();
  const _rollDamage = vi.fn();
  const _rollAbilityCheck = vi.fn();
  const _rollSavingThrow = vi.fn();
  const _rollSkillCheck = vi.fn();
  const _rollInitiative = vi.fn();
  const _quickRollPlayerSave = vi.fn();
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });

  const mockHook = vi.fn((_monsterName, _campaignName, _opts) => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: _setPopupHtml,
    rollAttack: _rollAttack,
    rollDamage: _rollDamage,
    rollAbilityCheck: _rollAbilityCheck,
    rollSavingThrow: _rollSavingThrow,
    rollSkillCheck: _rollSkillCheck,
    rollInitiative: _rollInitiative,
    quickRollPlayerSave: _quickRollPlayerSave,
  }));

  return {
    default: mockHook,
    _rollAttack,
    _rollDamage,
    _rollAbilityCheck,
    _rollSavingThrow,
    _rollSkillCheck,
    _rollInitiative,
    _quickRollPlayerSave,
    _setPopupHtml,
    __setPopupHtml(val) { _popupHtml = val; },
  };
});

vi.mock('../../services/combat/conditions/conditionEffects.js', () => {
  let _computeReturn = null;
  const _computeConditionEffects = vi.fn((_conditions) => {
    return _computeReturn ?? { ...defaultConditionEffects };
  });

  return {
    computeConditionEffects: _computeConditionEffects,
    combineAttackModes: vi.fn(() => 'normal'),
    CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
    __setComputeReturn(val) { _computeReturn = val; },
  };
});

vi.mock('../../services/rules/combat/damageUtils.js', () => {
  let _findCreatureReturn = null;
  let _resistanceNoticeReturn = null;

  return {
    extractDamageTypes: vi.fn(() => []),
    formatDamageTypes: vi.fn((types) => (types || []).join(', ') || ''),
    getTargetFromAttacker: vi.fn(() => null),
    getResistanceNotice: vi.fn(() => _resistanceNoticeReturn),
    findCreatureByName: vi.fn((_ctx, _name) => {
      return _findCreatureReturn ?? { name: 'Goblin', conditions: [] };
    }),
    getCombatContext: vi.fn().mockResolvedValue(null),
    __setFindCreatureReturn(val) { _findCreatureReturn = val; },
    __setResistanceNoticeReturn(val) { _resistanceNoticeReturn = val; },
  };
});

vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(() => ({ mode: 'normal', reason: '' })),
  getDistanceFeet: vi.fn(() => null),
  getNearestPlacedItem: vi.fn(() => null),
  rangeToFeet: vi.fn((range) => {
    if (typeof range === 'number') return range;
    if (range === 'touch') return 8;
    if (!range) return null;
    const m = range.match(/^(\d+)/);
    return m ? parseInt(m[1], 10) : 30;
  }),
}));

vi.mock('../../services/maps/mapsService.js', () => ({
  loadMapData: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/shared/abilityLookup.js', () => ({
  getAbilitySaveModifier: vi.fn((_abilities, _abilityKey) => 0),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => {
  const mockUseRuntimeValue = vi.fn((_characterKey, propertyName, _campaignName) => {
    if (propertyName === 'targetEffects') return [];
    if (propertyName === 'inspiringMovementNoOA') return false;
    if (propertyName === 'remarkableAthleteNoOA') return false;
    return null;
  });

  return {
    useRuntimeValue: mockUseRuntimeValue,
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
  };
});

// ── Re-import mocked modules for test setup helpers ─────────────────────────

import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import * as conditionEffects from '../../services/combat/conditions/conditionEffects.js';
import * as damageUtils from '../../services/rules/combat/damageUtils.js';

const rollAttack = useLoggedDiceRoll._rollAttack;
const rollDamage = useLoggedDiceRoll._rollDamage;
const rollSavingThrow = useLoggedDiceRoll._rollSavingThrow;

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Find a dice link by exact text content and click it. */
function clickDiceLink(text) {
  const links = document.querySelectorAll('.mc-dice-link');
  const link = Array.from(links).find(el => el.textContent.trim() === text);
  expect(link, `Expected a dice link with text "${text}"`).toBeTruthy();
  fireEvent.click(link);
}

/** Reset all shared mock state used by the logic tests. */
function resetMocks() {
  vi.clearAllMocks();
  useLoggedDiceRoll.__setPopupHtml(null);
  conditionEffects.__setComputeReturn(null);
  damageUtils.__setFindCreatureReturn(null);
  damageUtils.__setResistanceNoticeReturn(null);
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('MonsterCardModal - handleAttack: attacker cannot act', () => {
  beforeEach(resetMocks);

  it('still renders the attack dice link when the attacker has a non-blocking condition', () => {
    damageUtils.__setFindCreatureReturn({
      name: 'Goblin',
      conditions: [{ key: 'blinded', label: 'Blinded' }],
    });

    const m = makeMonster({
      actions: [{ name: 'Club', attack_bonus: 4, description: 'Melee Attack.' }],
    });
    render(<MonsterCardModal {...makeProps(m)} />);

    expect(screen.queryByText('(Incapacitated)')).not.toBeInTheDocument();
    expect(screen.getByText('+4')).toBeInTheDocument();
  });
});

describe('MonsterCardModal - handleAttack: rider attack bonus', () => {
  beforeEach(resetMocks);

  it('adds riderAttackBonus to the effective bonus passed to rollAttack', () => {
    damageUtils.__setFindCreatureReturn({
      name: 'Goblin',
      conditions: [],
      targetName: 'Player A',
    });
    conditionEffects.__setComputeReturn({ ...defaultConditionEffects, riderAttackBonus: 2 });

    const m = makeMonster({
      actions: [{ name: 'Club', attack_bonus: 4, description: 'Melee Attack.' }],
    });
    render(<MonsterCardModal {...makeProps(m, { creatures: [{ name: 'Goblin', targetName: 'Player A' }, { name: 'Player A', type: 'player' }] })} />);

    clickDiceLink('+4');
    expect(rollAttack).toHaveBeenCalledWith('Club', 6, expect.anything());
  });
});

describe('MonsterCardModal - handleAttack: resistance notice', () => {
  beforeEach(resetMocks);

  it('passes the target resistance notice through to rollAttack', () => {
    damageUtils.__setFindCreatureReturn({
      name: 'Goblin',
      conditions: [],
      targetName: 'Ogre',
    });
    damageUtils.__setResistanceNoticeReturn('Resists slashing');

    const m = makeMonster({
      actions: [{ name: 'Club', attack_bonus: 4, damage_type_primary: 'slashing', description: 'Melee Attack.' }],
    });
    render(<MonsterCardModal {...makeProps(m, { creatures: [{ name: 'Goblin', targetName: 'Ogre' }, { name: 'Ogre', resistances: ['slashing'] }] })} />);

    clickDiceLink('+4');
    expect(damageUtils.getResistanceNotice).toHaveBeenCalledWith(['slashing'], ['slashing'], [], 'Ogre');
    const callArgs = rollAttack.mock.calls[0][2];
    expect(callArgs.resistanceNotice).toBe('Resists slashing');
  });
});

describe('MonsterCardModal - handleAttack: save conditions', () => {
  beforeEach(resetMocks);

  it('passes saveConditions parsed from save_effect to rollAttack', () => {
    damageUtils.__setFindCreatureReturn({
      name: 'Goblin',
      conditions: [],
      targetName: 'Player A',
    });

    const m = makeMonster({
      actions: [{ name: 'Petrifying Bite', attack_bonus: 4, save_dc: 13, save_type: 'Constitution', save_effect: 'On a failed save, the target is petrified.', description: 'Bite.' }],
    });
    render(<MonsterCardModal {...makeProps(m, { creatures: [{ name: 'Goblin', targetName: 'Player A' }, { name: 'Player A', type: 'player' }] })} />);

    clickDiceLink('+4');
    const callArgs = rollAttack.mock.calls[0][2];
    expect(callArgs.saveConditions).toEqual(['petrified']);
  });
});

describe('MonsterCardModal - handleSaveRoll: autoDamage context', () => {
  beforeEach(resetMocks);

  it('passes autoDamage formula, type, name, and saveConditions when rolling a save for a damaging action', () => {
    damageUtils.__setFindCreatureReturn({
      name: 'Goblin',
      conditions: [],
    });

    const m = makeMonster({
      actions: [{ name: 'Stinking Cloud', save_dc: 13, save_type: 'Constitution', damage_dice_primary: '4d6', damage_type_primary: 'poison', save_effect: 'On a failed save, the target is poisoned.', description: 'A cloud of noxious gas.' }],
    });
    render(<MonsterCardModal {...makeProps(m)} />);

    clickDiceLink('4d6');
    expect(rollSavingThrow).toHaveBeenCalledWith(
      'CON',
      0,
      expect.objectContaining({
        saveDc: 13,
        saveType: 'Constitution',
        dcSuccess: 'half',
        autoDamageFormula: '4d6',
        autoDamageDamageType: 'poison',
        autoDamageName: 'Stinking Cloud',
        saveConditions: ['poisoned'],
      })
    );
  });
});

describe('MonsterCardModal - handleDamage: critical-hit popup', () => {
  beforeEach(resetMocks);

  it('doubles damage and clears the popup when the popup roll is a critical hit', () => {
    useLoggedDiceRoll.__setPopupHtml({ isCrit: true });
    damageUtils.__setFindCreatureReturn({
      name: 'Goblin',
      conditions: [],
    });

    const m = makeMonster({
      actions: [{ name: 'Club', attack_bonus: null, damage_dice_primary: '1d6+2', damage_type_primary: 'slashing', description: 'Melee Attack.' }],
    });
    render(<MonsterCardModal {...makeProps(m)} />);

    clickDiceLink('1d6+2');
    expect(useLoggedDiceRoll._setPopupHtml).toHaveBeenCalledWith(null);
    expect(rollDamage).toHaveBeenCalledWith(
      { name: 'Club', formula: '1d6+2', total: 10, rolls: expect.any(Array), modifier: 0, context: expect.anything() }
    );
  });
});

describe('MonsterCardModal - combat-context fallback', () => {
  beforeEach(resetMocks);

  it('loads the combat context when the creatures prop is absent', () => {
    render(<MonsterCardModal {...makeProps(makeMonster(), { creatures: undefined })} />);
    expect(damageUtils.getCombatContext).toHaveBeenCalledWith('test-campaign');
  });

  it('skips the combat-context fetch when the creatures prop is provided', () => {
    render(<MonsterCardModal {...makeProps(makeMonster(), { creatures: [] })} />);
    expect(damageUtils.getCombatContext).not.toHaveBeenCalled();
  });
});
