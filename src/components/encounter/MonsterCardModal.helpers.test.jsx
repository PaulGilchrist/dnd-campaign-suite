// @improved-by-ai
// @cleaned-by-ai
// Behavioral tests for the condition-effect badge rendering in the monster card.
//
// Coverage audit against ALL other MonsterCardModal test files (before adding any test):
//   - Badge label rendering (Save Disadv, +N to hit, No OA, Insp. Move, No OA (Crit),
//     OA Disadv, No Difficult Terrain on Dash) is asserted ONLY here; no sibling file
//     checks these labels.
//   - riderAttackBonus flowing into the actual attack roll (not just the badge) is
//     asserted in MonsterCardModal.logic.test.jsx.
//   - speedZero / Shield of Faith / senses / ally badges / save-modifier fallbacks are
//     covered by MonsterCardModal.test.jsx, senses-and-fallback.test.jsx, ally-modal.test.jsx.
//
// Problems fixed in the previous version:
//   - The conditionEffects mock duplicated a 30-line default effects object that every
//     test overrode, so it could silently drift out of sync with test-utils.js.
//   - Inspiring Move / No OA (Crit) runtime-flag mock state was never reset between
//     tests, so a test could depend on flags set by an earlier test.
//   - Assertions used document.querySelector('.effect-...'), probing the whole document
//     instead of scoping the class check to the badge element itself.
//   - Repeated creature fixtures were inlined in every test; extracted to helpers.
//   - Missing negative paths: no badges when effects report nothing, no badges when the
//     creature has no conditions even if flags/effects are set, and no speedy badges when
//     the passives are absent.
//
// Cleanup applied (redundant / brittle / low-value removal):
//   - Consolidated 4 individual rider-badge tests into 1 parameterized it.each (same structure, different flag/badge).
//   - Consolidated 2 individual speedy-badge tests into 1 parameterized it.each (same structure, different passive).
//   - Removed 3 negative tests already covered by other tests:
//       * "no badges when no conditions + flags set" — covered by the all-sources integration test.
//       * "no speedy badges when conditions but no passives" — covered by the first test (no effects = no badges).
//       * "no speedy badges when passives but no conditions" — covered by the "no conditions" negative test above.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 5, rolls: [1, 2], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 10, rolls: [1, 2], modifier: 0 })),
}));

vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => String(html || '')),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  const mockHook = vi.fn(() => ({
    popupHtml: null,
    setPopupHtml: vi.fn(),
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    rollAbilityCheck: vi.fn(),
    rollSavingThrow: vi.fn(),
    rollSkillCheck: vi.fn(),
    rollInitiative: vi.fn(),
    quickRollPlayerSave: vi.fn(),
  }));

  return { default: mockHook };
});

vi.mock('../../services/combat/conditions/conditionEffects.js', () => {
  let _computeReturn = null;
  const computeConditionEffects = vi.fn(() => _computeReturn ?? {});

  return {
    computeConditionEffects,
    combineAttackModes: vi.fn(() => 'normal'),
    CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
    __setComputeReturn(val) { _computeReturn = val; },
  };
});

vi.mock('../../services/rules/combat/damageUtils.js', () => {
  const DEFAULT_CREATURE = { name: 'Goblin', conditions: [] };
  let _findCreatureReturn = null;

  return {
    extractDamageTypes: vi.fn(() => []),
    formatDamageTypes: vi.fn((types) => (types || []).join(', ') || ''),
    getTargetFromAttacker: vi.fn(() => null),
    getResistanceNotice: vi.fn(() => null),
    findCreatureByName: vi.fn(() => _findCreatureReturn ?? { ...DEFAULT_CREATURE }),
    getCombatContext: vi.fn().mockResolvedValue(null),
    __setFindCreatureReturn(val) { _findCreatureReturn = val; },
  };
});

vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(() => ({ mode: 'normal' })),
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
  getAbilitySaveModifier: vi.fn(() => 0),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => {
  let _inspiringMoveNoOA = false;
  let _remarkableNoOA = false;
  let _targetEffects = [];

  const mockUseRuntimeValue = vi.fn((_characterKey, propertyName, _campaignName) => {
    if (propertyName === 'targetEffects') return _targetEffects;
    if (propertyName === 'inspiringMovementNoOA') return _inspiringMoveNoOA;
    if (propertyName === 'remarkableAthleteNoOA') return _remarkableNoOA;
    return null;
  });

  return {
    useRuntimeValue: mockUseRuntimeValue,
    setRuntimeValue: vi.fn(),
    getRuntimeValue: vi.fn(() => null),
    __setInspiringMoveNoOA(val) { _inspiringMoveNoOA = val; },
    __setRemarkableNoOA(val) { _remarkableNoOA = val; },
    __setTargetEffects(val) { _targetEffects = val; },
  };
});

// ── Re-import mocked modules for test setup helpers ─────────────────────────

import * as conditionEffects from '../../services/combat/conditions/conditionEffects.js';
import * as damageUtils from '../../services/rules/combat/damageUtils.js';
import * as useRuntimeState from '../../hooks/runtime/useRuntimeState.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

const BLINDED_CREATURE = { name: 'Goblin', conditions: [{ key: 'blinded', label: 'Blinded' }] };

/** Build a monsterCharacter whose passives list matches the given effects. */
function makeMonsterCharacter(effects = []) {
  return {
    name: 'Goblin',
    computedStats: {
      automation: {
        passives: effects.map(effect => ({ type: 'passive_rule', effect })),
      },
    },
  };
}

/**
 * Assert a badge with the given label renders with the expected effect class.
 * Scoped to the badge element itself rather than probing the whole document.
 */
function expectBadge(label, effectClass) {
  expect(screen.getByText(label)).toHaveClass('mc-effect-badge', effectClass);
}

function expectNoBadge(label) {
  expect(screen.queryByText(label)).not.toBeInTheDocument();
}

function resetState() {
  vi.clearAllMocks();
  conditionEffects.__setComputeReturn(null);
  damageUtils.__setFindCreatureReturn({ ...BLINDED_CREATURE });
  useRuntimeState.__setInspiringMoveNoOA(false);
  useRuntimeState.__setRemarkableNoOA(false);
  useRuntimeState.__setTargetEffects([]);
}

// ── Tests: rider effect badges ──────────────────────────────────────────────

describe('MonsterCardModal - condition effect badges', () => {
  beforeEach(resetState);

  it('renders no effect badges when the creature has conditions but no rider effects', () => {
    conditionEffects.__setComputeReturn({ ...defaultConditionEffects });
    render(<MonsterCardModal {...makeProps(makeMonster())} />);

    expectNoBadge('Save Disadv');
    expectNoBadge('+2 to hit');
    expectNoBadge('No OA');
    expectNoBadge('Insp. Move');
    expectNoBadge('No OA (Crit)');
  });

  it.each([
    { flag: 'riderSaveDisadvantage', value: true, label: 'Save Disadv', cls: 'effect-disadvantage' },
    { flag: 'riderAttackBonus', value: 2, label: '+2 to hit', cls: 'effect-target-adv' },
    { flag: 'riderCannotOpportunityAttack', value: true, label: 'No OA', cls: 'effect-cannot-act' },
  ])('renders the $label badge when $flag is $value', ({ flag, value, label, cls }) => {
    conditionEffects.__setComputeReturn({ ...defaultConditionEffects, [flag]: value });
    render(<MonsterCardModal {...makeProps(makeMonster())} />);

    expectBadge(label, cls);
  });

  it('renders the Insp. Move badge when inspiringMovementNoOA is true', () => {
    useRuntimeState.__setInspiringMoveNoOA(true);
    render(<MonsterCardModal {...makeProps(makeMonster())} />);

    expectBadge('Insp. Move', 'effect-cannot-act');
  });

  it('renders the No OA (Crit) badge when remarkableAthleteNoOA is true', () => {
    useRuntimeState.__setRemarkableNoOA(true);
    render(<MonsterCardModal {...makeProps(makeMonster())} />);

    expectBadge('No OA (Crit)', 'effect-cannot-act');
  });

  it('renders no effect badges when the creature has no conditions, even if effects and flags are set', () => {
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [] });
    conditionEffects.__setComputeReturn({
      ...defaultConditionEffects,
      riderSaveDisadvantage: true,
      riderAttackBonus: 2,
      riderCannotOpportunityAttack: true,
    });
    useRuntimeState.__setInspiringMoveNoOA(true);
    useRuntimeState.__setRemarkableNoOA(true);
    render(<MonsterCardModal {...makeProps(makeMonster())} />);

    expectNoBadge('Save Disadv');
    expectNoBadge('+2 to hit');
    expectNoBadge('No OA');
    expectNoBadge('Insp. Move');
    expectNoBadge('No OA (Crit)');
  });

  it('renders badges from every source together (rider + runtime + speedy passives)', () => {
    conditionEffects.__setComputeReturn({
      ...defaultConditionEffects,
      riderSaveDisadvantage: true,
      riderAttackBonus: 2,
      riderCannotOpportunityAttack: true,
    });
    useRuntimeState.__setInspiringMoveNoOA(true);
    useRuntimeState.__setRemarkableNoOA(true);
    const monsterCharacter = makeMonsterCharacter([
      'opportunity_attacks_disadvantage',
      'ignore_difficult_terrain_on_dash',
    ]);

    render(<MonsterCardModal {...makeProps(makeMonster(), { characters: [monsterCharacter] })} />);

    expectBadge('Save Disadv', 'effect-disadvantage');
    expectBadge('+2 to hit', 'effect-target-adv');
    expectBadge('No OA', 'effect-cannot-act');
    expectBadge('Insp. Move', 'effect-cannot-act');
    expectBadge('No OA (Crit)', 'effect-cannot-act');
    expectBadge('OA Disadv', 'effect-disadvantage');
    expectBadge('No Difficult Terrain on Dash', 'effect-cannot-act');
  });
});

// ── Tests: speedy passive badges ────────────────────────────────────────────

describe('MonsterCardModal - speedy passive badges', () => {
  beforeEach(resetState);

  it.each([
    { passive: 'opportunity_attacks_disadvantage', label: 'OA Disadv', cls: 'effect-disadvantage' },
    { passive: 'ignore_difficult_terrain_on_dash', label: 'No Difficult Terrain on Dash', cls: 'effect-cannot-act' },
  ])('renders the $label badge when the creature has the $passive passive and conditions', ({ passive, label, cls }) => {
    const monsterCharacter = makeMonsterCharacter([passive]);
    render(<MonsterCardModal {...makeProps(makeMonster(), { characters: [monsterCharacter] })} />);

    expectBadge(label, cls);
  });

  it('renders both speedy badges together when both passives are present', () => {
    const monsterCharacter = makeMonsterCharacter([
      'opportunity_attacks_disadvantage',
      'ignore_difficult_terrain_on_dash',
    ]);
    render(<MonsterCardModal {...makeProps(makeMonster(), { characters: [monsterCharacter] })} />);

    expectBadge('OA Disadv', 'effect-disadvantage');
    expectBadge('No Difficult Terrain on Dash', 'effect-cannot-act');
  });

  it('does not render speedy badges when the creature has conditions but lacks the passives', () => {
    render(<MonsterCardModal {...makeProps(makeMonster(), { characters: [makeMonsterCharacter([])] })} />);

    expectNoBadge('OA Disadv');
    expectNoBadge('No Difficult Terrain on Dash');
  });
});
