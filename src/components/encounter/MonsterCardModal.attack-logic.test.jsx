// @improved-by-ai
// @cleaned-by-ai
// Consolidated (redundant negative tests merged into parameterized tests):
//
//   Bulwark of Force: 3 tests → 2 tests
//     "does not apply cover when Bulwark of Force is inactive"
//     "does not apply cover when the target is not in bulwarkTargets"
//       → merged into single parameterized test covering both negative cases
//         with identical assertions (coverAcBonus: 0, coverLevel: null, coverReason: null)
//
//   Improved Duplicity: CLA-189 fixed — the picker list stores granted ALLY names;
//     monsters never gain Advantage from Improved Duplicity. These tests now assert
//     monster attacks stay un-boosted (including the old inverted-semantics case).
//
// Kept (unique behavioral coverage for handleAttack in this component):
//   Bulwark of Force cover, Improved Duplicity negatives, Graze weapon
//   mastery, and auto-crit within 5 feet.

import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
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
  const _findCreatureByName = vi.fn((_ctx, _name) => {
    return _findCreatureReturn ?? { name: 'Goblin', conditions: [] };
  });

  return {
    extractDamageTypes: vi.fn(() => []),
    formatDamageTypes: vi.fn((types) => (types || []).join(', ') || ''),
    getTargetFromAttacker: vi.fn(() => null),
    getResistanceNotice: vi.fn(() => null),
    findCreatureByName: _findCreatureByName,
    getCombatContext: vi.fn().mockResolvedValue(null),
    __setFindCreatureReturn(val) { _findCreatureReturn = val; },
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
  let _inspiringMoveNoOA = false;
  let _remarkableNoOA = false;
  let _targetEffects = [];
  let _activeBuffs = null;
  let _bulwarkActive = null;
  let _bulwarkTargets = [];
  let _invokeDuplicityAdvantageTargets = [];

  const mockUseRuntimeValue = vi.fn((_characterKey, propertyName, _campaignName) => {
    if (propertyName === 'targetEffects') return _targetEffects;
    if (propertyName === 'inspiringMovementNoOA') return _inspiringMoveNoOA;
    if (propertyName === 'remarkableAthleteNoOA') return _remarkableNoOA;
    return null;
  });

  const mockGetRuntimeValue = vi.fn((_characterKey, propertyName) => {
    if (propertyName === 'activeBuffs') return _activeBuffs;
    if (propertyName === 'bulwarkOfForceActive') return _bulwarkActive;
    if (propertyName === 'bulwarkOfForceTargets') return _bulwarkTargets;
    if (propertyName === 'invokeDuplicityAdvantageTargets') return _invokeDuplicityAdvantageTargets;
    return null;
  });

  return {
    useRuntimeValue: mockUseRuntimeValue,
    getRuntimeValue: mockGetRuntimeValue,
    __setInspiringMoveNoOA(val) { _inspiringMoveNoOA = val; },
    __setRemarkableNoOA(val) { _remarkableNoOA = val; },
    __setTargetEffects(val) { _targetEffects = val; },
    __setActiveBuffs(val) { _activeBuffs = val; },
    __setBulwarkActive(val) { _bulwarkActive = val; },
    __setBulwarkTargets(val) { _bulwarkTargets = val; },
    __setInvokeDuplicityAdvantageTargets(val) { _invokeDuplicityAdvantageTargets = val; },
  };
});

// ── Re-import mocked modules for test setup helpers ─────────────────────────

import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import * as conditionEffects from '../../services/combat/conditions/conditionEffects.js';
import * as damageUtils from '../../services/rules/combat/damageUtils.js';
import * as useRuntimeState from '../../hooks/runtime/useRuntimeState.js';

const rollAttack = useLoggedDiceRoll._rollAttack;

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Attacker monster with Player A as its selected target. */
const PLAYER_TARGETS = [
  { name: 'Goblin', targetName: 'Player A' },
  { name: 'Player A', type: 'player' },
];

/** Reset all shared mock state used by handleAttack tests. */
function resetAttackMocks() {
  vi.clearAllMocks();
  conditionEffects.__setComputeReturn(null);
  damageUtils.__setFindCreatureReturn(null);
  useRuntimeState.__setInspiringMoveNoOA(false);
  useRuntimeState.__setRemarkableNoOA(false);
  useRuntimeState.__setTargetEffects([]);
  useRuntimeState.__setActiveBuffs(null);
  useRuntimeState.__setBulwarkActive(null);
  useRuntimeState.__setBulwarkTargets([]);
  useRuntimeState.__setInvokeDuplicityAdvantageTargets([]);
}

/** Point findCreatureByName at the Goblin attacker targeting the given creature. */
function setAttackTarget(targetName = 'Player A') {
  damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [], targetName });
}

/** Render the modal with a Goblin making a melee Club attack (reach 5 ft). */
function renderAttackAction(actionOverrides, propsOverrides = {}) {
  const m = makeMonster({
    actions: [{
      name: 'Club',
      attack_bonus: 4,
      description: 'Melee Attack.',
      reach: '5 ft.',
      ...actionOverrides,
    }],
  });
  return render(<MonsterCardModal {...makeProps(m, { creatures: PLAYER_TARGETS, ...propsOverrides })} />);
}

/** Find the attack dice link by its exact text content and click it. */
function clickAttackLink(attackBonus = '+4') {
  const links = document.querySelectorAll('.mc-dice-link');
  const attackLink = Array.from(links).find((el) => el.textContent.trim() === attackBonus);
  expect(attackLink, `Expected to find attack link with text "${attackBonus}"`).toBeTruthy();
  fireEvent.click(attackLink);
}

/** The attack context object passed to rollAttack (fails if rollAttack not called). */
function getAttackContext() {
  expect(rollAttack).toHaveBeenCalled();
  return rollAttack.mock.calls[0][2];
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('MonsterCardModal - handleAttack: Bulwark of Force cover', () => {
  beforeEach(resetAttackMocks);

  it('applies +2 AC cover when Bulwark of Force is active and the target is in bulwarkTargets', () => {
    setAttackTarget();
    useRuntimeState.__setBulwarkActive(true);
    useRuntimeState.__setBulwarkTargets(['Player A']);

    renderAttackAction(null, { characters: [{ name: 'Player A' }] });
    clickAttackLink();

    const ctx = getAttackContext();
    expect(ctx.coverAcBonus).toBe(2);
    expect(ctx.coverLevel).toBe('half');
    expect(ctx.coverReason).toBe('Bulwark of Force');
  });

  it.each([
    { bulwarkActive: false, bulwarkTargets: ['Player A'], desc: 'inactive' },
    { bulwarkActive: true, bulwarkTargets: ['Player B'], desc: 'target not in bulwarkTargets' },
  ])('does not apply cover when Bulwark of Force is $desc', ({ bulwarkActive, bulwarkTargets }) => {
    setAttackTarget();
    useRuntimeState.__setBulwarkActive(bulwarkActive);
    useRuntimeState.__setBulwarkTargets(bulwarkTargets);

    renderAttackAction(null, { characters: [{ name: 'Player A' }] });
    clickAttackLink();

    const ctx = getAttackContext();
    expect(ctx.coverAcBonus).toBe(0);
    expect(ctx.coverLevel).toBeNull();
    expect(ctx.coverReason).toBeNull();
  });
});

describe('MonsterCardModal - handleAttack: Improved Duplicity never buffs monster attacks (CLA-189)', () => {
  beforeEach(resetAttackMocks);

  function makeCleric() {
    return {
      name: 'Cleric',
      computedStats: {
        automation: {
          passives: [{ effect: 'enhanced_distraction_and_healing' }],
        },
      },
    };
  }

  it.each([
    { advantageTargets: ['Goblin'], buffs: [{ effect: 'create_illusion', isImprovedDuplicity: true }], desc: 'the monster name matches the granted list (inverted-semantics regression)' },
    { advantageTargets: ['Player A'], buffs: [{ effect: 'create_illusion', isImprovedDuplicity: true }], desc: 'a granted ally is the monster target' },
    { advantageTargets: ['Goblin'], buffs: [], desc: 'the cleric lacks an improved duplicity buff' },
  ])('does not grant the attacking monster advantage when $desc', ({ advantageTargets, buffs }) => {
    setAttackTarget();
    useRuntimeState.__setInvokeDuplicityAdvantageTargets(advantageTargets);
    useRuntimeState.__setActiveBuffs(buffs);

    renderAttackAction(null, { characters: [makeCleric()] });
    clickAttackLink();

    expect(getAttackContext().forcedMode).toBeUndefined();
  });
});

describe('MonsterCardModal - handleAttack: Graze weapon mastery', () => {
  beforeEach(resetAttackMocks);

  function makeMonsterCharacter(mastery) {
    return {
      name: 'Goblin',
      computedStats: {
        automation: {
          passives: [{ type: 'weapon_mastery_choice', chosenMastery: mastery }],
        },
        abilities: [{ name: 'Strength', bonus: 2 }],
      },
    };
  }

  it('enables graze damage with the Strength modifier on a melee attack when the mastery is Graze', () => {
    setAttackTarget();
    renderAttackAction(null, { characters: [makeMonsterCharacter('Graze')] });
    clickAttackLink();

    const ctx = getAttackContext();
    expect(ctx.grazeDamage).toBe(true);
    expect(ctx.grazeAbilityMod).toBe(2);
    expect(ctx.grazeAbilityName).toBe('STR');
  });

  it('does not enable graze damage for a different weapon mastery', () => {
    setAttackTarget();
    renderAttackAction(null, { characters: [makeMonsterCharacter('Polished')] });
    clickAttackLink();

    const ctx = getAttackContext();
    expect(ctx.grazeDamage).toBe(false);
    expect(ctx.grazeAbilityMod).toBe(0);
  });
});

describe('MonsterCardModal - handleAttack: auto-crit within 5 feet', () => {
  beforeEach(resetAttackMocks);

  it('sets isAutoCrit on a melee attack when the target auto-crits within 5 feet', () => {
    setAttackTarget();
    conditionEffects.__setComputeReturn({ ...defaultConditionEffects, autoCritWithin5ft: true });

    renderAttackAction();
    clickAttackLink();

    expect(getAttackContext().isAutoCrit).toBe(true);
  });

  it('does not set isAutoCrit on a melee attack when the target lacks auto-crit-within-5ft', () => {
    setAttackTarget();

    renderAttackAction();
    clickAttackLink();

    expect(getAttackContext().isAutoCrit).toBe(false);
  });

  it('does not set isAutoCrit on a ranged attack even when auto-crit-within-5ft applies', () => {
    setAttackTarget();
    conditionEffects.__setComputeReturn({ ...defaultConditionEffects, autoCritWithin5ft: true });

    renderAttackAction({ name: 'Fire Bolt', description: 'Ranged Attack.', reach: undefined, range: '120 ft.' });
    clickAttackLink();

    expect(getAttackContext().isAutoCrit).toBe(false);
  });
});
