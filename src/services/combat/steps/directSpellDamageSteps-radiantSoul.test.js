// @maintained-by-ai
// CLA-279 lane — directSpellDamageSteps.js, spell side of the radiant_soul split.
// Rule (Radiant Soul, Channel Divinity): once per turn, when the holder deals radiant or
// fire damage with a feature, add Charisma to the roll. execution/index.js computeRadiantSoul
// is the single owner of the direct-path adder — attack.damage/autoFormulaOverride may
// already carry " + N [Radiant Soul]"; spellContext (idx 1) never re-appends.
// spellRollDamage (idx 2) owns consumption: stamps "_radiantSoul_<name_with_underscores>
// _oncePerTurn" campaign-keyed, gated on passive + damage-type match (NOT on chaMod —
// zero-CHA burn is the same defect class pinned honestly in the attack lane, #1028).
//
// Applied-rec #1042 verdict: the cited "spellRollDamage writes consumption flag" test
// exists ONLY in this file at old :91-101 — no separate radiantSoul.test.js. This lane
// is the OWNER of the spell-side consumption leg; subsumed into the append test's
// cross-step latch below (exact stamp bytes, campaign-keyed #825/#1021, live latch).
//
// Family split (radiant_soul):
//   attackRollDamageCalc-radiantSoul.test.js   attack-pipeline rollBaseDamage adder+latch — owned there (#1028)
//   directSpellDamageSteps-rolling.test.js     spellRollDamage roll dispatch/crit/maximize/null — owned there (idx 2 maximizer, #1044)
//   directSpellDamageSteps-context.test.js     spellContext EE/Blessed Strikes/Elemental Affinity — owned there (#1043)
//   directSpellDamageSteps-cla120-….test.js    CLA-120 pre-baked [Empowered Evocation] seam — owned there (#1042 sibling)
//   turnStartEffects_additional.test.js          once-per-turn latch RESET seam — owned there
//
// old -> new map:
//   'appends exactly once'                     strengthened: cross-step latch falsifier (live stamp by idx 2, then idx 1 silenced), underscore/space key derivation pinned
//   'does NOT re-append [Radiant Soul]'      kept + co-located autoFormulaOverride falsifier leg (#842) + idempotent true-byte re-stamp
//   'flag armed'                               consolidated into append test's live latch (no pre-armed fixture)
//   'does not append for Cold'               strengthened: co-located uppercase near-miss falsifier (#948) + zero-stamp negative pin (#934/#1026)
//   'spellRollDamage consumption flag'       consolidated into append test's stamp leg (exact bytes campaign-keyed)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Deterministic roller seam: exact bytes in, exact totals out (hand-derived once, never a
// formula-re-parsing oracle #815/#1032). Unknown formulas roll null → step returns null.
const ROLL_TABLE = {
  '2d6+3': { total: 10, rolls: [2, 5], modifier: 3 }, // 2+5 = 7 dice + 3 CHA adder
  '2d6': { total: 7, rolls: [2, 5], modifier: 0 },
  '1d10+3': { total: 8, rolls: [5], modifier: 3 }, // pre-baked CHA, not re-appended
  '3d6+3': { total: 9, rolls: [1, 2, 3], modifier: 3 },
  '3d8': { total: 12, rolls: [3, 4, 5], modifier: 0 },
};

vi.mock('../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn((formula) => {
    const key = formula.replace(/\s*\[[^\]]*\]/g, '').replace(/\s+/g, '');
    return ROLL_TABLE[key] ?? null;
  }),
  rollExpressionDoubled: vi.fn(() => { throw new Error('crit roller must not run on a non-crit fixture'); }),
  rollExpressionMaximized: vi.fn(() => { throw new Error('maximized roller must not run without overchannel'); }),
}));

vi.mock('../../rules/spells/postCastRiderService.js', () => ({
  getEmpoweredEvocationFeatures: vi.fn(() => []),
  getEmpoweredEvocationIntModifier: vi.fn(() => 0),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve({})),
}));

vi.mock('../../../services/automation/common/choiceStorage.js', () => ({
  getChosenRuntimeValue: vi.fn(() => undefined),
}));

// Key-symmetric runtime store: getRuntimeValue reads by key, setRuntimeValue writes by
// key — so a write-key/read-key mismatch (or a broken name→underscore derivation)
// silently breaks the latch and every leg fails loudly.
const runtimeRef = { store: {} };
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((_name, key) => runtimeRef.store[key] ?? null),
  setRuntimeValue: vi.fn((_name, key, value) => { runtimeRef.store[key] = value; }),
}));

vi.mock('./features/index.js', () => ({
  featureModules: [],
}));

const { buildDirectSpellDamageSteps } = await import('./directSpellDamageSteps.js');
const runtime = await import('../../../hooks/runtime/useRuntimeState.js');
const { rollExpression } = await import('../../dice/diceRoller.js');

// Space in the name pins the .replace(/\s+/g, '_') key derivation on read AND write.
const HOLDER = 'Hexed Warlock';
const LATCH_KEY = '_radiantSoul_Hexed_Warlock_oncePerTurn';

function makeHolderStats(charisma = 3) {
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

describe('directSpellDamageSteps — CLA-279 Radiant Soul single-source adder (spell lane)', () => {
  let steps;

  beforeEach(() => {
    vi.clearAllMocks();
    runtimeRef.store = {};
    steps = buildDirectSpellDamageSteps();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('spellContext appends the CHA adder exactly once, spellRollDamage burns the latch under the derived campaign-keyed bytes, and the next spell is silent', async () => {
    // Append leg: unmarked eligible formula, latch disarmed.
    const ctx = makeCtx({ attack: { damage: '2d6', damageType: 'Fire' } });
    const appended = await steps[1].handler(ctx);
    expect(appended.data.formula).toBe('2d6 + 3 [Radiant Soul]');
    expect(appended.data.formula.match(/\[Radiant Soul\]/g)).toHaveLength(1);
    // Read-side key bytes + campaign pinned (#1021).
    expect(runtime.getRuntimeValue).toHaveBeenCalledWith(HOLDER, LATCH_KEY, 'test-campaign');

    // Stamp leg (#1042 carried rec, owned here): roll the appended formula the context
    // step actually produced — exact call bytes, exact consumption stamp, campaign-keyed.
    const rolled = await steps[2].handler({ ...ctx, formula: appended.data.formula });
    expect(rollExpression).toHaveBeenCalledWith('2d6 + 3 [Radiant Soul]');
    expect(rolled.data).toEqual({ formula: '2d6 + 3 [Radiant Soul]', total: 10, rolls: [2, 5], modifier: 3 });
    expect(runtime.setRuntimeValue).toHaveBeenCalledWith(HOLDER, LATCH_KEY, true, 'test-campaign');
    expect(runtimeRef.store[LATCH_KEY]).toBe(true);

    // Live-latch falsifier (replaces the pre-armed fixture): same holder, fresh eligible
    // unmarked spell — the adder is GONE (once per turn), not merely deduped.
    const second = await steps[1].handler(makeCtx({ attack: { damage: '2d6', damageType: 'Radiant' } }));
    expect(second.data.formula).toBe('2d6');
    expect(second.data.formula.match(/\[Radiant Soul\]/g)).toBeNull();
  });

  it('never re-appends a pre-baked [Radiant Soul] term — execution/index.js owns the direct-path adder', async () => {
    // Lane 1: computeRadiantSoul baked "+ 3 [Radiant Soul]" into attack.damage.
    const baked = await steps[1].handler(makeCtx({
      attack: { damage: '1d10 + 3 [Radiant Soul]', damageType: 'Fire' },
    }));
    expect(baked.data.formula).toBe('1d10 + 3 [Radiant Soul]');
    expect(baked.data.formula.match(/\[Radiant Soul\]/g)).toHaveLength(1);

    // Lane 2 (co-located falsifier #842): pre-baked term arrives via autoFormulaOverride.
    const override = await steps[1].handler(makeCtx({
      autoFormulaOverride: '3d6 + 3 [Radiant Soul]',
      attack: { damageType: 'Radiant' },
    }));
    expect(override.data.formula).toBe('3d6 + 3 [Radiant Soul]');
    expect(override.data.formula.match(/\[Radiant Soul\]/g)).toHaveLength(1);

    // Execution consumed it already; roll step re-stamps the same true bytes (idempotent).
    const rolled = await steps[2].handler(makeCtx({
      attack: { damage: '1d10 + 3 [Radiant Soul]', damageType: 'Fire' },
      formula: '1d10 + 3 [Radiant Soul]',
    }));
    expect(rolled.data.total).toBe(8); // d10 roll of 5 + 3 pre-baked CHA, derived once
    expect(runtime.setRuntimeValue).toHaveBeenCalledWith(HOLDER, LATCH_KEY, true, 'test-campaign');
  });

  it('gates on the passive damageTypes list: Cold appends nothing and stamps nothing; case variants still append', async () => {
    // Near-miss (#948): same holder, same CHA, unarmed latch — only the type differs.
    const cold = await steps[1].handler(makeCtx({ attack: { damage: '3d8', damageType: 'Cold' } }));
    expect(cold.data.formula).toBe('3d8');
    // Zero-stamp honest leg: type gate failed on the roll step too, so no latch burn (#934/#1026).
    const coldRoll = await steps[2].handler({ ...makeCtx({ attack: { damage: '3d8', damageType: 'Cold' } }), formula: '3d8' });
    expect(coldRoll.data.total).toBe(12); // 3+4+5 dice, no adder
    expect(runtime.setRuntimeValue).not.toHaveBeenCalled();
    expect(runtimeRef.store[LATCH_KEY]).toBeUndefined();

    // Case-insensitive falsifier: uppercase 'FIRE' vs lowercased passive list.
    const hot = await steps[1].handler(makeCtx({ attack: { damage: '2d6', damageType: 'FIRE' } }));
    expect(hot.data.formula).toBe('2d6 + 3 [Radiant Soul]');
    expect(runtime.setRuntimeValue).not.toHaveBeenCalled(); // spellContext never stamps
    const hotRoll = await steps[2].handler({ ...makeCtx({ attack: { damage: '2d6', damageType: 'FIRE' } }), formula: hot.data.formula });
    expect(hotRoll.data.total).toBe(10); // 2+5 dice + 3 CHA, derived once
    expect(runtime.setRuntimeValue).toHaveBeenCalledWith(HOLDER, LATCH_KEY, true, 'test-campaign');
  });

  it('appends nothing for a non-holder, no "+ 0" term for zero-CHA (which still burns the latch — same defect class as attack lane #1028), and a null roll burns nothing', async () => {
    // Non-holder: applyRadiantSoul returns before the store is even read.
    const outsider = await steps[1].handler(makeCtx({
      attack: { damage: '2d6', damageType: 'Fire' },
      playerStats: { name: 'Frost Wizard', abilities: [{ name: 'Charisma', bonus: 3 }], automation: { passives: [], actions: [] } },
    }));
    expect(outsider.data.formula).toBe('2d6');
    expect(outsider.data.formula.match(/\[Radiant Soul\]/g)).toBeNull();
    expect(runtime.getRuntimeValue.mock.calls.filter(([, key]) => String(key).includes('radiantSoul'))).toHaveLength(0);
    expect(runtime.setRuntimeValue).not.toHaveBeenCalled();

    // Zero-CHA falsifier: without the chaMod<=0 guard the formula would carry
    // "+ 0 [Radiant Soul]".
    const zeroCtx = makeCtx({ attack: { damage: '2d6', damageType: 'Fire' }, playerStats: makeHolderStats(0) });
    const zeroCtxResult = await steps[1].handler(zeroCtx);
    expect(zeroCtxResult.data.formula).toBe('2d6');

    // Null-roll integrity first: roller returns null (formula off-table) → step returns
    // null BEFORE the consumption block — a failed roll must not burn the latch.
    const nullRoll = await steps[2].handler({ ...zeroCtx, formula: '9d100' });
    expect(nullRoll).toBeNull();
    expect(runtime.setRuntimeValue).not.toHaveBeenCalled();

    // Honest pin (#825/#1026 WATCH): the stamp is gated only on passive + type match,
    // NOT on chaMod — the latch burns despite zero applied bonus (reported upstream,
    // never fixed here).
    const zeroRoll = await steps[2].handler({ ...zeroCtx, formula: '2d6' });
    expect(zeroRoll.data.total).toBe(7); // 2+5 dice, no adder
    expect(runtime.setRuntimeValue).toHaveBeenCalledWith(HOLDER, LATCH_KEY, true, 'test-campaign');
  });
});
