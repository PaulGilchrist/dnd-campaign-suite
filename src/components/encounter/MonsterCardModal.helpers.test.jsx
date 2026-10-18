// @maintained-by-ai
// Behavioral tests for the condition-effect badge row in the monster card modal.
//
// Ownership audit (lane #573-#606 catch-all, re-verified Oct 2026):
//   The bytes under test are MonsterCardBody.jsx :73 (conditions-section gate)
//   and buildCondEffectBadges :113-119 (seven badge branches). Grep evidence
//   across all MonsterCardModal*.test.* files: none of the labels
//   ('Save Disadv', '+N to hit', 'No OA', 'Insp. Move', 'No OA (Crit)',
//   'OA Disadv', 'No Difficult Terrain on Dash') nor the classes
//   ('mc-effect-badge', 'effect-cannot-act', 'effect-disadvantage',
//   'effect-target-adv') are asserted by any sibling — this file is the sole
//   owner. Same-named badges in ConditionEffectBadges*.test.jsx cover the
//   initiative component, not MonsterCardBody, so they do not shadow these legs.
//   riderAttackBonus flowing into the actual roll is covered in
//   MonsterCardModal.logic.test.jsx (roll path only, not the badge).
//   speedZero / Shield of Faith / senses / ally badges / save-modifier
//   fallbacks live in MonsterCardModal.test.jsx, senses-and-fallback.test.jsx,
//   ally-modal.test.jsx — none touched here.
//   KNOWN GAP (cross-file recommendation, not added): :111 'No Adv vs' and
//   :112 'Disadv vs' have zero coverage in this lane.
//
// Trim applied (12 executions → 3, one per equivalence class):
//   - Per-badge positive tests (rider it.each x3, Insp. Move, No OA (Crit),
//     speedy it.each x2, "both speedy together") collapse into the single
//     all-sources integration test — each branch :113-119 fires exactly once
//     there, with its unique label + class, so per-flag renders were pure
//     re-coverage of identical code paths.
//   - "lacks the passives" negative folds into the all-off test (same
//     hasMonsterPassive false path; characters:[] from makeProps exercises
//     it too).
//   - Kept negatives are non-redundant guards: all-off proves badges are
//     conditional (not unconditional renders); no-conditions proves the
//     :73 section gate.

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

const ALL_BADGE_LABELS = [
  'Save Disadv', '+2 to hit', 'No OA', 'Insp. Move', 'No OA (Crit)',
  'OA Disadv', 'No Difficult Terrain on Dash',
];

/** Build a monsterCharacter (named to match makeMonster) with the given passives. */
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

/** Arm every badge source: rider flags, runtime flags, speedy passives. */
function armAllSources(passives = [
  'opportunity_attacks_disadvantage',
  'ignore_difficult_terrain_on_dash',
]) {
  conditionEffects.__setComputeReturn({
    ...defaultConditionEffects,
    riderSaveDisadvantage: true,
    riderAttackBonus: 2,
    riderCannotOpportunityAttack: true,
  });
  useRuntimeState.__setInspiringMoveNoOA(true);
  useRuntimeState.__setRemarkableNoOA(true);
  return makeMonsterCharacter(passives);
}

/** Scoped badge assertion: the element itself carries the modal classes. */
function expectBadge(label, effectClass) {
  expect(screen.getByText(label)).toHaveClass('mc-effect-badge', effectClass);
}

function expectNoBadges() {
  ALL_BADGE_LABELS.forEach(label => {
    expect(screen.queryByText(label)).not.toBeInTheDocument();
  });
}

function resetState() {
  vi.clearAllMocks();
  conditionEffects.__setComputeReturn(null);
  damageUtils.__setFindCreatureReturn({ ...BLINDED_CREATURE });
  useRuntimeState.__setInspiringMoveNoOA(false);
  useRuntimeState.__setRemarkableNoOA(false);
  useRuntimeState.__setTargetEffects([]);
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('MonsterCardModal - condition effect badges', () => {
  beforeEach(resetState);

  it('renders no effect badges when the creature has conditions but no source is active', () => {
    conditionEffects.__setComputeReturn({ ...defaultConditionEffects });
    render(<MonsterCardModal {...makeProps(makeMonster())} />);

    // Section is mounted (Blinded label visible) yet zero badges leak through.
    expect(screen.getByText('Blinded')).toBeInTheDocument();
    expectNoBadges();
  });

  it('renders no effect badges when the creature has no conditions, even if every source is armed', () => {
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [] });
    const monsterCharacter = armAllSources();
    render(<MonsterCardModal {...makeProps(makeMonster(), { characters: [monsterCharacter] })} />);

    expectNoBadges();
  });

  it('renders every badge source together — riders, runtime flags, speedy passives', () => {
    const monsterCharacter = armAllSources();
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
