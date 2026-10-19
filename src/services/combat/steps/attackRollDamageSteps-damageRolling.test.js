// @maintained-by-ai
// damageRolling lane — the dice-rolling pipeline legs of the attackRollDamageSteps
// pipeline: buildRollBaseDamageStep / buildBuildContextStep / buildSneakAttackStep
// (attackRollDamageCalc.js, composed at attackRollDamageSteps.js:14-16). Steps are
// built directly here; composite order/names/subscribe-emit chain are owned by
// attackRollDamageSteps.test.js (structure lane).
//
// CITED-OWNER (#1027, #1030): generic [Empowered Evocation] append/skip CANON arms —
// append once when mod > 0, skip when mod 0 or negative — are PRESERVED here (old
// :237-255). The CLA-120 fold-exactly-once / pre-baked dedupe gate is owned by
// attackRollDamageCalc-cla120-empowered-evocation.test.js. Cite-refresh after fold:
// append arm → it('appends the [Empowered Evocation] term once when mod > 0') :152-165;
// skip arms co-located → it('skips the [Empowered Evocation] append when modifier is 0 or negative') :168-185.
//
// Family split:
//   attackRollDamageSteps.test.js              composite structure — order, names, event chain
//   attackRollDamageCalc-cla120-*.test.js     EE fold-exactly-once / never re-append gate
//   attackRollDamageCalc-radiantSoul.test.js  Radiant Soul append + execution-owned dedupe
//   attackRollDamageSteps-endgame.test.js     overchannel step (idx 17) post-damage rolls
//   attackRollRiders.test.js                  cunningStrike rider modal (not the cost fold here)
//
// Determinism (#1026/#1027): ROLL_TABLE hand-derived ONCE (1d6→4, 1d8→5 stub
// convention), exact bytes→total lookup — never a re-parse oracle; unknown formula
// rolls null like the real roller (honest skip legs, #945), no silent { total: 6 }
// fallback (#1030 class). Unmocked-called audit (#1029): only the five modules
// attackRollDamageCalc.js imports are mocked.
//
// old -> new map:
//   3-4 condition arms per step                     → one folded all-arms condition test each
//   'clears popupHtml on crit' / 'does not clear'   → legs of crit / default-path tests
//   'uses autoFormulaOverride when no attack.damage' / 'prefers...' → 'autoFormulaOverride wins...'
//   'returns data with formula, total, rolls, modifier' (expect.any oracle) → exact toEqual in default-path test
//   'combines autoFormulaOverride with empowered evocation' → REMOVED (input-agnostic concat;
//     override selection and EE append are separate folded legs above)
//   'uses rollExpressionDoubled on crit' / '...Maximized when overchannelActive' /
//   'prefers overchannel over crit' → two roller-selection tests (crit, overchannel-beats-crit)
//   buildContext handler arms → WM-008 rebuild / map routing / sneakDice+targetName derive / no-fn guard
//   sneak handler arms → apply+stamp+preserve / missing-rolls leg / crit double / cunning fold+clamp+reset / null leg

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hand-derived once (#815/#710): rolls pinned by stub convention, totals sum the bytes.
const ROLL_TABLE = {
  '1d8+3': { total: 8, rolls: [5], modifier: 3 },
  '3d6+2': { total: 14, rolls: [4, 4, 4], modifier: 2 },
  '3d6': { total: 12, rolls: [4, 4, 4], modifier: 0 },
  '8d6': { total: 32, rolls: [4, 4, 4, 4, 4, 4, 4, 4], modifier: 0 },
  '8d6+3': { total: 35, rolls: [4, 4, 4, 4, 4, 4, 4, 4], modifier: 3 },
  '2d6': { total: 8, rolls: [4, 4], modifier: 0 },
  '1d6': { total: 4, rolls: [4], modifier: 0 },
};
const DOUBLED_TABLE = {
  '8d6': { total: 64, rolls: [4, 4, 4, 4, 4, 4, 4, 4], doubledRolls: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4], modifier: 0 },
  '2d6': { total: 16, rolls: [4, 4], doubledRolls: [4, 4, 4, 4], modifier: 0 },
};
const MAXIMIZED_TABLE = {
  '8d6': { total: 48, rolls: [6, 6, 6, 6, 6, 6, 6, 6], modifier: 0, maximized: true },
};
// Same normalization the real roller applies (tag-strip, whitespace fold).
const normKey = (formula) => (formula || '').replace(/\s*\[[^\]]*\]/g, '').replace(/\s+/g, '');

vi.mock('../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn((formula) => ROLL_TABLE[normKey(formula)] ?? null),
  rollExpressionDoubled: vi.fn((formula) => DOUBLED_TABLE[normKey(formula)] ?? null),
  rollExpressionMaximized: vi.fn((formula) => MAXIMIZED_TABLE[normKey(formula)] ?? null),
}));

vi.mock('../../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../automation/common/choiceStorage.js', () => ({
  getChosenRuntimeValue: vi.fn(() => undefined),
}));

vi.mock('../../combat/automation/automationService.js', () => ({
  hasTwoWeaponFighting: vi.fn(() => false),
}));

const { buildRollBaseDamageStep, buildBuildContextStep, buildSneakAttackStep } = await import('./attackRollDamageCalc.js');
const { rollExpression, rollExpressionDoubled, rollExpressionMaximized } = await import('../../dice/diceRoller.js');
const { getRuntimeValue, setRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js');

const rollBaseDamage = buildRollBaseDamageStep();
const buildContext = buildBuildContextStep();
const sneakAttack = buildSneakAttackStep();

function makeCtx(overrides = {}) {
  return {
    attack: {},
    playerStats: {
      name: 'TestChar',
      abilities: [{ name: 'Strength', bonus: 3 }],
      automation: { actions: [], passives: [] },
      level: 5,
      proficiency: 3,
    },
    campaignName: 'test-campaign',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks(); // keeps factory impls (ROLL_TABLE lookups), clears call logs
  getRuntimeValue.mockReturnValue(null);
});

describe('rollBaseDamage — formula → roller → total pipeline', () => {
  it('runs when attack.damage or autoFormulaOverride exists, skips otherwise', () => {
    expect(rollBaseDamage.condition(makeCtx({ attack: { damage: '1d8+3' } }))).toBe(true);
    expect(rollBaseDamage.condition(makeCtx({ autoFormulaOverride: '2d6' }))).toBe(true);
    expect(rollBaseDamage.condition(makeCtx({ attack: {} }))).toBe(false);
    expect(rollBaseDamage.condition({})).toBe(false);
  });

  it('rolls damage with its damage-type tag and returns exact bytes and total', async () => {
    const setPopupHtml = vi.fn();
    const result = await rollBaseDamage.handler(makeCtx({
      attack: { damage: '1d8+3' },
      setPopupHtml,
    }));

    expect(rollExpression).toHaveBeenCalledWith('1d8+3');
    expect(result.data).toEqual({ formula: '1d8+3', total: 8, rolls: [5], modifier: 3 });
    expect(setPopupHtml).not.toHaveBeenCalled(); // popup clear is a crit-only arm

    const tagged = await rollBaseDamage.handler(makeCtx({
      attack: { damage: '1d8+3', damageType: 'Necrotic' },
    }));
    expect(rollExpression).toHaveBeenCalledWith('1d8+3 [necrotic]');
    expect(tagged.data).toEqual({ formula: '1d8+3 [necrotic]', total: 8, rolls: [5], modifier: 3 });
  });

  it('autoFormulaOverride wins over attack.damage', async () => {
    // '2d8+4' is unmapped: if priority inverted, the roller rolls null and the
    // exact-data assertions below fail loudly (no silent fallback).
    const result = await rollBaseDamage.handler(makeCtx({
      attack: { damage: '2d8+4' },
      autoFormulaOverride: '3d6+2',
    }));

    expect(rollExpression).toHaveBeenCalledWith('3d6+2');
    expect(rollExpression).not.toHaveBeenCalledWith('2d8+4');
    expect(result.data).toEqual({ formula: '3d6+2', total: 14, rolls: [4, 4, 4], modifier: 2 });
  });

  // CITED-OWNER #1027 append arm (old :227-235 → here): PRESERVE.
  it('appends the [Empowered Evocation] term once when mod > 0', async () => {
    const result = await rollBaseDamage.handler(makeCtx({
      attack: { damage: '8d6' },
      empoweredEvocationModifier: 3,
    }));

    expect(rollExpression).toHaveBeenCalledWith('8d6 + 3 [Empowered Evocation]');
    expect(result.data).toEqual({
      formula: '8d6 + 3 [Empowered Evocation]',
      total: 35,
      rolls: [4, 4, 4, 4, 4, 4, 4, 4],
      modifier: 3,
    });
  });

  // CITED-OWNER #1027 skip arms (old :237-255 → here): PRESERVE, co-located falsifiers.
  it('skips the [Empowered Evocation] append when modifier is 0 or negative', async () => {
    const zero = await rollBaseDamage.handler(makeCtx({
      attack: { damage: '8d6' },
      empoweredEvocationModifier: 0,
    }));
    expect(rollExpression).toHaveBeenCalledWith('8d6');
    expect(zero.data.formula).toBe('8d6');
    expect(zero.data.total).toBe(32);

    rollExpression.mockClear();
    const negative = await rollBaseDamage.handler(makeCtx({
      attack: { damage: '8d6' },
      empoweredEvocationModifier: -1,
    }));
    expect(rollExpression).toHaveBeenCalledWith('8d6');
    expect(rollExpression).not.toHaveBeenCalledWith(expect.stringContaining('Empowered'));
    expect(negative.data).toEqual({ formula: '8d6', total: 32, rolls: [4, 4, 4, 4, 4, 4, 4, 4], modifier: 0 });
  });

  it('routes crit through the doubled roller — exact dice count, doubled total — and clears the crit popup', async () => {
    const setPopupHtml = vi.fn();
    const result = await rollBaseDamage.handler(makeCtx({
      attack: { damage: '8d6' },
      isCrit: true,
      setPopupHtml,
    }));

    expect(setPopupHtml).toHaveBeenCalledWith(null);
    expect(rollExpressionDoubled).toHaveBeenCalledWith('8d6');
    expect(rollExpression).not.toHaveBeenCalled();
    expect(rollExpressionMaximized).not.toHaveBeenCalled();
    expect(result.data).toEqual({
      formula: '8d6',
      total: 64, // (8d6 raw 32) * 2 + 0
      rolls: [4, 4, 4, 4, 4, 4, 4, 4],
      modifier: 0,
    });
  });

  it('overchannel maximizes to flat top bytes and beats crit doubling', async () => {
    const result = await rollBaseDamage.handler(makeCtx({
      attack: { damage: '8d6' },
      isCrit: true,
      overchannelActive: true,
    }));

    expect(rollExpressionMaximized).toHaveBeenCalledWith('8d6');
    expect(rollExpressionDoubled).not.toHaveBeenCalled();
    expect(rollExpression).not.toHaveBeenCalled();
    expect(result.data).toEqual({
      formula: '8d6',
      total: 48, // 8 dice at face value, no doubling applied
      rolls: [6, 6, 6, 6, 6, 6, 6, 6],
      modifier: 0,
    });
  });

  it('returns null when the roller cannot parse the formula (honest skip, #945)', async () => {
    const result = await rollBaseDamage.handler(makeCtx({ attack: { damage: '0' } }));

    expect(rollExpression).toHaveBeenCalledWith('0');
    expect(result).toBeNull();
  });
});

describe('buildContext — damage-phase ctx rebuild', () => {
  it('runs unless a prebuilt ctx or autoDamageSource short-circuits it', () => {
    expect(buildContext.condition(makeCtx())).toBe(true);
    expect(buildContext.condition(makeCtx({ buildCtxResult: { sneakAttackDice: 2 } }))).toBe(false);
    expect(buildContext.condition(makeCtx({ autoDamageSource: 'some-source' }))).toBe(false);
  });

  it('rebuilds via buildCtxSync WITHOUT consuming one-shot attack te (WM-008)', async () => {
    const buildCtxSync = vi.fn(async () => ({ sneakAttackDice: 2, targetName: 'Orc' }));
    const buildCtx = vi.fn();
    const ctx = makeCtx({ attack: { damage: '1d8+3' }, buildCtxSync, buildCtx });
    const result = await buildContext.handler(ctx);

    expect(buildCtxSync).toHaveBeenCalledWith({ damage: '1d8+3' }, { consumeAttackTe: false });
    expect(buildCtx).not.toHaveBeenCalled();
    expect(result.data).toEqual({
      buildCtxResult: { sneakAttackDice: 2, targetName: 'Orc' },
      sneakDice: 2,
      targetName: 'Orc',
    });
  });

  it('routes to the map-aware buildCtx when mapName is present', async () => {
    const buildCtx = vi.fn(async () => ({ sneakAttackDice: 3 }));
    const buildCtxSync = vi.fn();
    const ctx = makeCtx({ mapName: 'test-map', buildCtx, buildCtxSync });
    const result = await buildContext.handler(ctx);

    expect(buildCtx).toHaveBeenCalledWith({}, { consumeAttackTe: false });
    expect(buildCtxSync).not.toHaveBeenCalled();
    expect(result.data).toEqual({ buildCtxResult: { sneakAttackDice: 3 }, sneakDice: 3 });
  });

  it('defaults sneakDice to 0 and adopts targetName only when ctx has none', async () => {
    const empty = await buildContext.handler(makeCtx({
      buildCtxSync: async () => ({}),
    }));
    expect(empty.data).toEqual({ buildCtxResult: {}, sneakDice: 0 });

    const occupied = await buildContext.handler(makeCtx({
      targetName: 'Orc',
      buildCtxSync: async () => ({ sneakAttackDice: 1, targetName: 'Goblin' }),
    }));
    expect(occupied.data.targetName).toBeUndefined();
    expect(occupied.data.sneakDice).toBe(1);
  });

  it('returns empty data when no build function is available', async () => {
    expect((await buildContext.handler(makeCtx())).data).toEqual({});
  });
});

describe('sneakAttack — sneak dice fold into the running damage payload', () => {
  const baseSneakCtx = (overrides = {}) => makeCtx({
    sneakDice: 2,
    formula: '1d8+3',
    total: 11,
    rolls: [8, 3],
    ...overrides,
  });

  it('runs only when sneakDice is positive', () => {
    expect(sneakAttack.condition(makeCtx({ sneakDice: 2 }))).toBe(true);
    expect(sneakAttack.condition(makeCtx({ sneakDice: 0 }))).toBe(false);
    expect(sneakAttack.condition(makeCtx())).toBe(false);
    expect(sneakAttack.condition(makeCtx({ sneakDice: -1 }))).toBe(false);
  });

  it('adds the sneak roll with exact bytes, preserves existing rolls, and stamps the used round', async () => {
    const result = await sneakAttack.handler(baseSneakCtx());

    expect(rollExpression).toHaveBeenCalledWith('2d6');
    expect(result.data).toEqual({
      formula: '1d8+3 + 2d6 [Sneak Attack]',
      total: 19, // 11 + sneak 8
      rolls: [8, 3, 4, 4],
      effectiveSneakDice: 2,
    });
    expect(setRuntimeValue).toHaveBeenCalledWith('TestChar', '_SneakAttack_usedRound', 1, 'test-campaign');
    expect(setRuntimeValue).not.toHaveBeenCalledWith('TestChar', '_cunningStrikeCostUsed', 0, 'test-campaign');

    // Missing rolls array → output carries only the sneak rolls.
    rollExpression.mockReturnValueOnce(ROLL_TABLE['1d6']);
    const noRolls = await sneakAttack.handler(baseSneakCtx({ sneakDice: 1, rolls: undefined }));
    expect(noRolls.data).toEqual({
      formula: '1d8+3 + 1d6 [Sneak Attack]',
      total: 15,
      rolls: [4],
      effectiveSneakDice: 1,
    });
  });

  it('doubles sneak dice on crit and not on a normal hit', async () => {
    const crit = await sneakAttack.handler(baseSneakCtx({ isCrit: true }));
    expect(rollExpressionDoubled).toHaveBeenCalledWith('2d6');
    expect(rollExpression).not.toHaveBeenCalled();
    expect(crit.data).toEqual({
      formula: '1d8+3 + 2d6 [Sneak Attack]',
      total: 27, // 11 + (2d6 raw 8) * 2
      rolls: [8, 3, 4, 4],
      effectiveSneakDice: 2,
    });

    rollExpression.mockClear();
    rollExpressionDoubled.mockClear();
    const hit = await sneakAttack.handler(baseSneakCtx({ isCrit: false }));
    expect(rollExpression).toHaveBeenCalledWith('2d6');
    expect(rollExpressionDoubled).not.toHaveBeenCalled();
    expect(hit.data.total).toBe(19);
  });

  it('folds cunning strike cost into sneak dice, clamps at 0, and resets the cost only once spent', async () => {
    // Leg 1: cost 1 of sneak 3 → 2d6 applied, cost reset.
    getRuntimeValue.mockImplementation((_name, prop) => (prop === '_cunningStrikeCostUsed' ? 1 : null));
    const reduced = await sneakAttack.handler(baseSneakCtx({ sneakDice: 3 }));
    expect(rollExpression).toHaveBeenCalledWith('2d6');
    expect(reduced.data).toEqual({
      formula: '1d8+3 + 2d6 [Sneak Attack]',
      total: 19,
      rolls: [8, 3, 4, 4],
      effectiveSneakDice: 2,
    });
    expect(setRuntimeValue).toHaveBeenCalledWith('TestChar', '_cunningStrikeCostUsed', 0, 'test-campaign');

    // Leg 2: cost exceeds dice → nothing rolls, nothing stamped, spent cost still reset.
    rollExpression.mockClear();
    setRuntimeValue.mockClear();
    getRuntimeValue.mockImplementation((_name, prop) => (prop === '_cunningStrikeCostUsed' ? 5 : null));
    const clamped = await sneakAttack.handler(baseSneakCtx({ sneakDice: 2 }));
    expect(rollExpression).not.toHaveBeenCalled();
    expect(rollExpressionDoubled).not.toHaveBeenCalled();
    expect(clamped.data).toEqual({ formula: '1d8+3', total: 11, rolls: [8, 3], effectiveSneakDice: 0 });
    expect(setRuntimeValue).toHaveBeenCalledWith('TestChar', '_cunningStrikeCostUsed', 0, 'test-campaign');
    expect(setRuntimeValue).not.toHaveBeenCalledWith('TestChar', '_SneakAttack_usedRound', 1, 'test-campaign');
  });

  it('a null roll leaves formula, total, and stamps untouched (honest skip, #945)', async () => {
    rollExpression.mockReturnValueOnce(null);
    const result = await sneakAttack.handler(baseSneakCtx());

    expect(rollExpression).toHaveBeenCalledWith('2d6');
    expect(result.data).toEqual({ formula: '1d8+3', total: 11, rolls: [8, 3], effectiveSneakDice: 2 });
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });
});
