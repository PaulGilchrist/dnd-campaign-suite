// @maintained-by-ai
// Trim pass (2026-10-18): handleAttack payload-transport seams unique to this lane.
//
// Collapsed (one it.each per branch owner, shared render):
//   Bulwark of Force cover: positive + 2 negatives → one it.each over
//     computeBulwarkCover (MonsterCardModal.jsx:1060-1068) hit / inactive-continue /
//     target-miss→NO_COVER (:1104-1118), asserted on the rollAttack ctx.
//   Graze mastery: 2 tests → one it.each over computeGrazeSettings branches
//     (:955-961); grazeAbilityName:'STR' literal pinned on both rows (:1402).
//   Auto-crit: 3 tests → one it.each pinning the isMelee && autoCritWithin5ft
//     fold (:2372) — melee true/false + ranged short-circuit. The melee-negative
//     render (characters: []) also covers the !monsterCharacter early return (:956).
//
// Removed:
//   "Improved Duplicity never buffs monster attacks (CLA-189)" suite (3 cases)
//     → vacuous on this lane: MonsterCardModal.jsx never reads
//       invokeDuplicityAdvantageTargets (grep-clean; owner is
//       services/combat/auras/duplicityAuraUtils.js:31, consumed by the
//       CharActionModals/Initiative sheet lanes), and forcedMode was pinned
//       undefined by this file's own combineAttackModes→'normal' mock +
//       resolveForcedMode (:1121-1124) — the assertion could never fail even if
//       CLA-189 inverted semantics again. Same vacuity class as the #504 Elusive
//       cut in attack-advanced (#578); real combineAttackModes fold owner is
//       MonsterCardModal.elusive-cla119.test.jsx.
//   Dead mock channels/setters no surviving test reads (REC #578 pattern):
//     __setInvokeDuplicityAdvantageTargets, __setActiveBuffs (only the removed
//     duplicity suite consumed them), __setInspiringMoveNoOA, __setRemarkableNoOA
//     (never set by any test; modal passes falsy to card-body props, :2145-2146),
//     __setTargetEffects (never set; modal coalesces storedTargetEffects ?? [],
//     :2142-2143), and the unused _rollDamage/_rollAbilityCheck/_rollSavingThrow/
//     _rollSkillCheck/_rollInitiative/_quickRollPlayerSave/_setPopupHtml mock
//     exports (only _rollAttack is read).

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
  const _rollAttack = vi.fn();

  return {
    default: vi.fn((_monsterName, _campaignName, _opts) => ({
      popupHtml: null,
      setPopupHtml: vi.fn(),
      rollAttack: _rollAttack,
    })),
    _rollAttack,
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

  return {
    extractDamageTypes: vi.fn(() => []),
    formatDamageTypes: vi.fn((types) => (types || []).join(', ') || ''),
    getTargetFromAttacker: vi.fn(() => null),
    getResistanceNotice: vi.fn(() => null),
    findCreatureByName: vi.fn((_ctx, _name) => {
      return _findCreatureReturn ?? { name: 'Goblin', conditions: [] };
    }),
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
  let _bulwarkActive = null;
  let _bulwarkTargets = [];

  return {
    useRuntimeValue: vi.fn(() => null),
    getRuntimeValue: vi.fn((_characterKey, propertyName) => {
      if (propertyName === 'bulwarkOfForceActive') return _bulwarkActive;
      if (propertyName === 'bulwarkOfForceTargets') return _bulwarkTargets;
      return null;
    }),
    __setBulwarkActive(val) { _bulwarkActive = val; },
    __setBulwarkTargets(val) { _bulwarkTargets = val; },
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
  useRuntimeState.__setBulwarkActive(null);
  useRuntimeState.__setBulwarkTargets([]);
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

  it.each([
    { bulwarkActive: true, bulwarkTargets: ['Player A'], coverAcBonus: 2, coverLevel: 'half', coverReason: 'Bulwark of Force', desc: 'active and the target is in bulwarkTargets' },
    { bulwarkActive: false, bulwarkTargets: ['Player A'], coverAcBonus: 0, coverLevel: null, coverReason: null, desc: 'inactive' },
    { bulwarkActive: true, bulwarkTargets: ['Player B'], coverAcBonus: 0, coverLevel: null, coverReason: null, desc: 'target not in bulwarkTargets' },
  ])('coverAcBonus=$coverAcBonus when Bulwark of Force is $desc', ({ bulwarkActive, bulwarkTargets, coverAcBonus, coverLevel, coverReason }) => {
    setAttackTarget();
    useRuntimeState.__setBulwarkActive(bulwarkActive);
    useRuntimeState.__setBulwarkTargets(bulwarkTargets);

    renderAttackAction(null, { characters: [{ name: 'Player A' }] });
    clickAttackLink();

    const ctx = getAttackContext();
    expect(ctx.targetName).toBe('Player A');
    expect(ctx.attackerName).toBe('Goblin');
    expect(ctx.coverAcBonus).toBe(coverAcBonus);
    expect(ctx.coverLevel).toBe(coverLevel);
    expect(ctx.coverReason).toBe(coverReason);
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

  it.each([
    { mastery: 'Graze', grazeDamage: true, grazeAbilityMod: 2, desc: 'the mastery is Graze' },
    { mastery: 'Polished', grazeDamage: false, grazeAbilityMod: 0, desc: 'the mastery is a different choice' },
  ])('grazeDamage=$grazeDamage with mod $grazeAbilityMod on a melee attack when $mastery', ({ mastery, grazeDamage, grazeAbilityMod }) => {
    setAttackTarget();
    renderAttackAction(null, { characters: [makeMonsterCharacter(mastery)] });
    clickAttackLink();

    const ctx = getAttackContext();
    expect(ctx.grazeDamage).toBe(grazeDamage);
    expect(ctx.grazeAbilityMod).toBe(grazeAbilityMod);
    expect(ctx.grazeAbilityName).toBe('STR');
  });
});

describe('MonsterCardModal - handleAttack: auto-crit within 5 feet', () => {
  beforeEach(resetAttackMocks);

  it.each([
    { autoCritWithin5ft: true, melee: true, isAutoCrit: true, desc: 'the target auto-crits within 5 feet' },
    { autoCritWithin5ft: false, melee: true, isAutoCrit: false, desc: 'the target lacks auto-crit-within-5ft' },
    { autoCritWithin5ft: true, melee: false, isAutoCrit: false, desc: 'the attack is ranged (isMelee short-circuits)' },
  ])('isAutoCrit=$isAutoCrit on a $melee attack when $desc', ({ autoCritWithin5ft, melee, isAutoCrit }) => {
    setAttackTarget();
    conditionEffects.__setComputeReturn({ ...defaultConditionEffects, autoCritWithin5ft });

    renderAttackAction(melee ? null : { name: 'Fire Bolt', description: 'Ranged Attack.', reach: undefined, range: '120 ft.' });
    clickAttackLink();

    expect(getAttackContext().isAutoCrit).toBe(isAutoCrit);
  });
});
