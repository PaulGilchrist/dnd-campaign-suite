// @maintained-by-ai
// CLA-120 lane — directSpellDamageSteps.js steps[1] spellContext (direct-spell path).
// Rule (5e Evocation 10th level, Empowered Evocation): add your INT modifier to the
// damage roll of an evocation spell you cast. Single owner of the fold is
// execution/index.js computeEmpoweredEvocation (damageCalculation-cla120.test.js),
// which may pre-bake " + N [Empowered Evocation]" into attack.damage /
// autoFormulaOverride via noSavePath autoDamageFormula. This lane owns ONLY the step-
// level dedupe guard (directSpellDamageSteps.js:15 `!formula.includes('[EE]')`):
// never re-append a pre-baked term on the direct-spell pipeline.
//
// CLA-120 family split (INT fold):
//   attackRollDamageCalc-cla120-empowered-evocation.test.js  attack-roll step (rollBaseDamage) — owned there (#1027)
//   damageCalculation-cla120.test.js                         computeEmpoweredEvocation — single fold owner
//   attackPostProcessing-cla120-potent-cantrip.test.js     potent-cantrip miss-half fold seam
//   spellCastHandler.damage.test.js:241                    handler-level idempotent fold (different seam)
//   savePath-aoe-empowered-evocation.test.js               AoE save one-roll-per-cast payload
//   THIS FILE                                              spellContext pre-baked [EE] dedupe guard
//
// directSpellDamageSteps family split (same module, other seams):
//   directSpellDamageSteps-context.test.js    generic spellContext arms: formula selection,
//     EE append '8d6'→'8d6 + 3 [EE]' (:142-152), non-evocation skip (:166-176), mod-0 /
//     no-feature skips, blessed strikes, elemental affinity — verified: never feeds a
//     pre-baked '[EE]' input, so the dedupe arm lives nowhere else
//   directSpellDamageSteps-radiantSoul.test.js  CLA-279 [Radiant Soul] dedupe seam (parallel lane)
//   directSpellDamageSteps-rolling/-riders/-overchannel/-structure.test.js  other steps
//
// old -> new map:
//   'does NOT append a second term to a pre-baked formula (execution-owned)'  strengthened: two input channels (attack.damage + autoFormulaOverride), exact result.data toEqual
//   'folds the INT term exactly once onto an unmarked formula (PASS control)'  removed — byte-dup of context.test.js:142-152 append arm
//   'non-evocation school gate stays zero'                                      removed — byte-dup of context.test.js:166-176 skip arm
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// This lane only builds formulas — any roll is a lane violation, so every roller
// throws a sentinel instead of a parser-oracle stub (#1027/#1032).
vi.mock('../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => { throw new Error('spellContext must not roll — roll legs owned by directSpellDamageSteps-rolling.test.js'); }),
  rollExpressionDoubled: vi.fn(() => { throw new Error('spellContext must not roll'); }),
  rollExpressionMaximized: vi.fn(() => { throw new Error('spellContext must not roll'); }),
}));

// Live riders read by applyEmpoweredEvocation; defaults set in beforeEach.
vi.mock('../../rules/spells/postCastRiderService.js', () => ({
  getEmpoweredEvocationFeatures: vi.fn(),
  getEmpoweredEvocationIntModifier: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(() => { throw new Error('spellContext must not log — log legs owned by the overchannel lane'); }),
}));

// Reached by applyBlessedStrikes / applyRadiantSoul on every spellContext call —
// neutral values so only the EE dedupe guard can alter the formula.
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

// Reached by applyElementalAffinity — undefined keeps the adder off.
vi.mock('../../../services/automation/common/choiceStorage.js', () => ({
  getChosenRuntimeValue: vi.fn(() => undefined),
}));

const _featureModulesRef = { value: [] };
vi.mock('./features/index.js', () => ({
  get featureModules() { return _featureModulesRef.value; },
}));

const { buildDirectSpellDamageSteps } = await import('./directSpellDamageSteps.js');
const { getEmpoweredEvocationFeatures, getEmpoweredEvocationIntModifier } = await import('../../rules/spells/postCastRiderService.js');

function makeCtx(overrides = {}) {
  return {
    attack: {},
    playerStats: {
      name: 'EvokerWizard',
      abilities: [{ name: 'Intelligence', bonus: 5 }],
      automation: { passives: [], actions: [] },
    },
    campaignName: 'test-campaign',
    isCantrip: true,
    autoDamageSchool: 'Evocation',
    ...overrides,
  };
}

describe('spellContext — CLA-120 pre-baked [Empowered Evocation] never re-folded', () => {
  let steps;

  beforeEach(() => {
    // All three append preconditions stay LIVE (feature, Evocation school, mod 5 > 0):
    // if the includes-guard were deleted, output would double-fold to
    // '4d10 + 5 [Empowered Evocation] + 5 [Empowered Evocation]' and fail exact bytes.
    vi.mocked(getEmpoweredEvocationFeatures).mockReturnValue([{ type: 'empowered_evocation', name: 'Empowered Evocation' }]);
    vi.mocked(getEmpoweredEvocationIntModifier).mockReturnValue(5);
    _featureModulesRef.value = [];
    steps = buildDirectSpellDamageSteps();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the pre-baked formula byte-identical from both input channels (execution-owned)', async () => {
    // Channel 1: execution baked the term into attack.damage (noSavePath autoDamageFormula).
    const baked = await steps[1].handler(makeCtx({
      attack: { damage: '4d10 + 5 [Empowered Evocation]', damageType: 'Fire' },
    }));
    expect(baked.data).toEqual({ formula: '4d10 + 5 [Empowered Evocation]' });

    // Channel 2: same baked term arriving via autoFormulaOverride (source :105 fallback).
    const override = await steps[1].handler(makeCtx({
      attack: {},
      autoFormulaOverride: '2d8 + 5 [Empowered Evocation]',
    }));
    expect(override.data).toEqual({ formula: '2d8 + 5 [Empowered Evocation]' });
  });
});
