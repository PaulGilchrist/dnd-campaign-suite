// @maintained-by-ai
// CLA-279 lane — attackRollDamageCalc.js buildRollBaseDamageStep (rollBaseDamage).
// Rule (Radiant Soul, Channel Divinity): once per turn, when the holder deals radiant or
// fire damage with a feature, add Charisma to the roll. execution/index.js computeRadiantSoul
// is the single owner of the direct-path adder — attack.damage/autoFormulaOverride may
// already carry " + N [Radiant Soul]"; the step never re-appends, and marks consumption
// via the once-per-turn key "_radiantSoul_<name_with_underscores>_oncePerTurn".
// Per #1027/#1028 (fix#63 shape, 2026-10-22): the only setRuntimeValue stamp in this
// handler is this radiant-soul guard, gated on passive + damage-type match AND the
// rolled formula carrying the '[Radiant Soul]' byte (stamp-if-applied — both append
// sites gate on chaMod > 0, applyRadiantSoulBonus :33 / computeRadiantSoul :94), so a
// zero-CHA attack no longer burns the once-per-turn latch with zero bonus applied.
//
// Family split (radiant_soul):
//   attackRollDamageSteps-damageRolling.test.js          same handler: generic EE append/skip + crit dispatch — owned there
//   directSpellDamageSteps-radiantSoul.test.js           spellContext CLA-279 seam — owned there
//   turnStartEffects_additional.test.js                  once-per-turn latch RESET seam — owned there
//   handleNpcSaveDamage.radiantSoul.test.js / SaveAttackAoeModal.radiantSoul.test.jsx  save-path lanes — owned there
//
// old -> new map:
//   'appends the adder exactly once'                     strengthened: full byte/symbol pins + latch burned on 2nd call (store-mirrored key symmetry)
//   'does NOT re-append [Radiant Soul] (execution-owned)' kept + co-located autoFormulaOverride falsifier leg (#842), exact totals
//   'does not append when flag armed'                  consolidated into append test's second call (live latch, not pre-armed fixture)
//   'does not append for Cold'                         strengthened: co-located case-variant near-miss falsifier (#948) + zero-stamp negative pin (#934)
//   'does not append for non-holder'                   consolidated with zero-CHA falsifier leg (non-holder stamps nothing; zero-CHA lands nothing AND burns nothing — #1028 pin flipped, retry-fires pair #1348 shape)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Deterministic roller seam: exact bytes in, exact totals out (hand-derived once, never a
// formula-re-parsing oracle). Unknown formulas roll null → step returns null → loud failure.
const ROLL_TABLE = {
  '2d8+4': { total: 15, rolls: [6, 5], modifier: 4 }, // 6+5 = 11 dice + 4 CHA adder
  '2d8': { total: 9, rolls: [5, 4], modifier: 0 },
  '1d10+4': { total: 12, rolls: [8], modifier: 4 },
  '3d6+4': { total: 16, rolls: [4, 4, 4], modifier: 4 },
  '3d8': { total: 11, rolls: [2, 4, 5], modifier: 0 },
  '1d6+4': { total: 10, rolls: [2, 4], modifier: 4 },
  '4d6': { total: 10, rolls: [1, 2, 3, 4], modifier: 0 },
  '4d6+4': { total: 14, rolls: [1, 2, 3, 4], modifier: 4 }, // #1028 retry-fires leg
};

vi.mock('../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn((formula) => {
    const key = formula.replace(/\s*\[[^\]]*\]/g, '').replace(/\s+/g, '');
    return ROLL_TABLE[key] ?? null;
  }),
  rollExpressionDoubled: vi.fn(() => { throw new Error('crit roller must not run on a non-crit fixture'); }),
  rollExpressionMaximized: vi.fn(() => { throw new Error('maximized roller must not run without overchannel'); }),
}));

vi.mock('../../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(() => 1),
}));

// Key-symmetric runtime store: getRuntimeValue reads by key, setRuntimeValue writes by
// key — so a write-key/read-key mismatch (or a broken name→underscore derivation)
// silently breaks the latch and every leg fails loudly.
const runtimeRef = { store: {} };
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((_name, key) => runtimeRef.store[key] ?? null),
  setRuntimeValue: vi.fn((_name, key, value) => { runtimeRef.store[key] = value; }),
}));

vi.mock('../../automation/common/choiceStorage.js', () => ({
  getChosenRuntimeValue: vi.fn(() => undefined),
}));

vi.mock('../../combat/automation/automationService.js', () => ({
  hasTwoWeaponFighting: vi.fn(() => false),
}));

const { buildRollBaseDamageStep } = await import('./attackRollDamageCalc.js');
const runtime = await import('../../../hooks/runtime/useRuntimeState.js');
const { rollExpression } = await import('../../dice/diceRoller.js');

// Space in the name pins the .replace(/\s+/g, '_') key derivation on read AND write.
const HOLDER = 'Hexed Warlock';
const LATCH_KEY = '_radiantSoul_Hexed_Warlock_oncePerTurn';

function makeHolderStats(charisma = 4) {
  return {
    name: HOLDER,
    abilities: [{ name: 'Charisma', bonus: charisma }],
    automation: {
      passives: [{ type: 'radiant_soul', hasAutomation: true, damageTypes: ['Radiant', 'Fire'] }],
      actions: [],
    },
  };
}

function makeCtx(overrides = {}) {
  return { attack: {}, playerStats: makeHolderStats(), campaignName: 'test-campaign', ...overrides };
}

describe('rollBaseDamage — CLA-279 Radiant Soul single-source adder', () => {
  let step;

  beforeEach(() => {
    vi.clearAllMocks();
    runtimeRef.store = {};
    step = buildRollBaseDamageStep();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('appends the CHA adder exactly once, burns the once-per-turn latch under the derived key, and skips on the next attack', async () => {
    const setPopupHtml = vi.fn();
    const ctx = makeCtx({ attack: { damage: '2d8', damageType: 'Fire' }, setPopupHtml });

    const first = await step.handler(ctx);
    // '[fire]' tag byte-order pinned BEFORE the appended adder (#1027 shape).
    expect(first.data.formula).toBe('2d8 [fire] + 4 [Radiant Soul]');
    expect(first.data.total).toBe(15); // 6+5 dice + 4 CHA, derived once
    expect(first.data.rolls).toEqual([6, 5]);
    expect(first.data.modifier).toBe(4);
    expect(rollExpression).toHaveBeenCalledWith('2d8 [fire] + 4 [Radiant Soul]');
    // Consumption stamp: exact key bytes, campaign-pinned (#934/#1021).
    expect(runtime.setRuntimeValue).toHaveBeenCalledWith(HOLDER, LATCH_KEY, true, 'test-campaign');
    // Non-crit fixture must not touch the popup (#942/#951 negative pin).
    expect(setPopupHtml).not.toHaveBeenCalled();

    // Two-call latch falsifier: same ctx again — flag now armed in the key-mirrored
    // store, so the adder is GONE (once per turn), not merely deduped.
    const second = await step.handler(ctx);
    expect(second.data.formula).toBe('2d8 [fire]');
    expect(second.data.total).toBe(9);
    expect(second.data.rolls).toEqual([5, 4]);
    expect(second.data.formula.match(/\[Radiant Soul\]/g)).toBeNull();
  });

  it('never re-appends a pre-baked [Radiant Soul] term — execution/index.js owns the direct-path adder', async () => {
    // Lane 1: computeRadiantSoul baked "+ 4 [Radiant Soul]" into attack.damage.
    const baked = await step.handler(makeCtx({
      attack: { damage: '1d10 + 4 [Radiant Soul]', damageType: 'Fire' },
    }));
    expect(baked.data.formula).toBe('1d10 + 4 [Radiant Soul] [fire]');
    expect(baked.data.formula.match(/\[Radiant Soul\]/g)).toHaveLength(1);
    expect(baked.data.total).toBe(12); // d10 roll of 8 + 4 pre-baked CHA, derived once
    expect(rollExpression).toHaveBeenCalledWith('1d10 + 4 [Radiant Soul] [fire]');

    // Lane 2 (co-located falsifier): pre-baked term arrives via autoFormulaOverride.
    const override = await step.handler(makeCtx({
      autoFormulaOverride: '3d6 + 4 [Radiant Soul]',
    }));
    expect(override.data.formula).toBe('3d6 + 4 [Radiant Soul]');
    expect(override.data.formula.match(/\[Radiant Soul\]/g)).toHaveLength(1);
    expect(override.data.total).toBe(16); // 4+4+4 dice + 4 pre-baked CHA
    // Execution consumed it already; step re-stamps the same true bytes (idempotent).
    expect(runtime.setRuntimeValue).toHaveBeenCalledWith(HOLDER, LATCH_KEY, true, 'test-campaign');
  });

  it('gates on the passive damageTypes list: Cold appends nothing and stamps nothing; case variants still match', async () => {
    // Near-miss (#948): same holder, same CHA, unarmed latch — only the type differs.
    const cold = await step.handler(makeCtx({
      attack: { damage: '3d8', damageType: 'Cold' },
    }));
    expect(cold.data.formula).toBe('3d8 [cold]');
    expect(cold.data.total).toBe(11);
    expect(cold.data.formula.match(/\[Radiant Soul\]/g)).toBeNull();
    // Zero-stamp honest leg: gate failed, so no latch burn (#934).
    expect(runtime.setRuntimeValue).not.toHaveBeenCalled();

    // Case-insensitive falsifier: uppercase 'Radiant' vs lowercased passive list.
    const hot = await step.handler(makeCtx({
      attack: { damage: '1d6', damageType: 'Radiant' },
    }));
    expect(hot.data.formula).toBe('1d6 [radiant] + 4 [Radiant Soul]');
    expect(hot.data.total).toBe(10); // 2+4 dice + 4 CHA
    expect(runtime.setRuntimeValue).toHaveBeenCalledWith(HOLDER, LATCH_KEY, true, 'test-campaign');
  });

  it('appends nothing for a non-holder, and a zero-CHA attack lands no bonus and leaves the latch ARMED (#1028 fixed) — the next qualifying attack rides', async () => {
    // Non-holder: gate returns before the store is even read.
    const outsider = await step.handler(makeCtx({
      attack: { damage: '4d6', damageType: 'Fire' },
      playerStats: { name: 'Draconic Sorcerer', abilities: [{ name: 'Charisma', bonus: 4 }], automation: { passives: [], actions: [] } },
    }));
    expect(outsider.data.formula).toBe('4d6 [fire]');
    expect(outsider.data.total).toBe(10);
    expect(outsider.data.formula.match(/\[Radiant Soul\]/g)).toBeNull();
    expect(runtime.getRuntimeValue).not.toHaveBeenCalled();
    expect(runtime.setRuntimeValue).not.toHaveBeenCalled();

    // Zero-CHA falsifier: without the append-side chaMod<=0 guard the formula would
    // carry "+ 0 [Radiant Soul]". #1028 pin FLIPPED (fix#63 stamp-if-applied shape):
    // markRadiantSoulUsed now refuses when the rolled formula carries no
    // '[Radiant Soul]' byte — zero bonus landed, so nothing is consumed. Disk law
    // (public/data/2024/classes.json, Warlock → Celestial Patron lv6): "add Charisma
    // modifier to that spell's damage" — Cha mod 0 adds nothing, consumes nothing.
    const zeroPs = makeHolderStats(0);
    const zeroCtx = makeCtx({ attack: { damage: '4d6', damageType: 'Fire' }, playerStats: zeroPs });
    const zeroCha = await step.handler(zeroCtx);
    expect(zeroCha.data.formula).toBe('4d6 [fire]');
    expect(zeroCha.data.total).toBe(10);
    expect(runtime.setRuntimeValue).not.toHaveBeenCalled();
    expect(runtimeRef.store[LATCH_KEY]).toBeUndefined(); // latch dark, not burned

    // Retry-qualifying pair (#1348 shape): CHA buffed 0→4 mid-fight — the next
    // Radiant/Fire attack MUST ride now (the old burn denied it) and consume exactly once.
    zeroPs.abilities = [{ name: 'Charisma', bonus: 4 }];
    const retry = await step.handler(zeroCtx);
    expect(retry.data.formula).toBe('4d6 [fire] + 4 [Radiant Soul]');
    expect(retry.data.total).toBe(14); // 1+2+3+4 dice + 4 CHA, derived once
    expect(runtime.setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(runtime.setRuntimeValue).toHaveBeenCalledWith(HOLDER, LATCH_KEY, true, 'test-campaign');
    expect(runtimeRef.store[LATCH_KEY]).toBe(true);

    // Once-per-turn holds from the APPLIED leg onward: third attack appends nothing
    // and re-stamps nothing (no redundant latch byte written when armed).
    const third = await step.handler(zeroCtx);
    expect(third.data.formula).toBe('4d6 [fire]');
    expect(runtime.setRuntimeValue).toHaveBeenCalledTimes(1);
  });
});
