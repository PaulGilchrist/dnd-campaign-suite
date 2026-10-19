// @maintained-by-ai
// CLA-147: Frenzy must roll exactly ONE rage_damage_d6 group on the triggering
// hit. contextBuilder-sync no longer bakes the rider into autoDamageFormula —
// attackRollBonuses.applyFrenzyBonuses is the single owner of roll + application
// + the _frenzyUsedRound latch.
//
// Ticket-distinct lane (CLA-147 ticket-decision table):
//   gate byte   : latch unset (used !== round, campaign-pinned consult) + hit + raging/reckless/STR
//   apply bytes : REAL resolveDiceExpression (unmocked) maps 'rage_damage_d6' → '4d6'
//                 at lv20 (rage_damage 4), rolled ONCE, exact formula ' + 4d6 [slashing]',
//                 rolls carried, latch stamped once per turn with round byte.
//   falsifier   : 2nd strength attack same round with the rider already carried in the
//                 incoming formula → formula byte-identical, ZERO dice rolls, ZERO writes
//                 (pre-fix live fingerprint duplicated '... + 4d6 [slashing] + 4d6 [slashing]').
// Family split: generic guard arms on this same step (miss / not reckless / not raging /
//   not STR / latch-already-used with constant '2') → attackRollDamageSteps-automationBonuses.test.js (#936 fold).
//   No-bake contextBuilder side of the ticket → contextBuilder-sync.frenzy-cla147.test.js.
// old→new map: 'lane junction' kept+strengthened (exact rolls pin, campaign-pinned round
//   fetch + latch consult, te/expiration absences); 're-fire same round' → single armed
//   pass-through falsifier with zero-call proof; 'pipeline standalone ungated base' REMOVED
//   (same branch bytes as lane junction; ungated-armed arm lives in #936 fold).
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn((f) => {
    if (!f) return null;
    const base = f.replace(/\s*\[.*?\]\s*/g, '').trim();
    if (!base) return null;
    const m = base.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
    if (m) {
      const c = parseInt(m[1], 10), s = parseInt(m[2], 10), mod = m[3] ? parseInt(m[3], 10) : 0;
      const rolls = Array(c).fill(Math.floor(s / 2) + 1);
      return { total: rolls.reduce((a, b) => a + b, 0) + mod, rolls, modifier: mod };
    }
    const n = base.match(/^(\d+)$/);
    if (n) return { total: parseInt(n[1], 10), rolls: [parseInt(n[1], 10)], modifier: 0 };
    return null;
  }),
  rollExpressionDoubled: vi.fn(),
  rollExpressionMaximized: vi.fn(),
  parseConstant: vi.fn((f) => {
    const n = String(f || '').replace(/\s*\[.*?\]\s*/g, '').trim().match(/^(\d+)$/);
    return n ? parseInt(n[1], 10) : null;
  }),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(() => 1),
}));
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));
vi.mock('../../combat/automation/automationService.js', () => ({
  evaluateAutoExpression: vi.fn(() => null),
}));
vi.mock('../../automation/common/buffToggle.js', () => ({ getActiveBuffs: vi.fn(() => []) }));
vi.mock('../../ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve({})) }));
vi.mock('../../rules/effects/expirations.js', () => ({ addExpiration: vi.fn() }));
vi.mock('../brutalStrikeSelection.js', () => ({ selectBrutalStrikeRiders: vi.fn(() => []) }));

const { buildAutomationBonusesStep } = await import('./attackRollBonuses.js');
const { rollExpression } = await import('../../dice/diceRoller.js');
const { getCurrentCombatRound } = await import('../../../encounters/combatData.js');
const { getRuntimeValue, setRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js');
const { addExpiration } = await import('../../rules/effects/expirations.js');

// Frenzy (2024 Barbarian, public/data/2024/classes.json) — verbatim automation shape.
const FRENZY_ACTION = {
  type: 'damage_bonus',
  trigger: 'reckless_attack_hit_while_raging',
  damageExpression: 'rage_damage_d6',
  damageType: 'same_as_weapon',
  oncePerTurn: true,
};

// lv20 Barbarian: rage_damage 4 → (REAL, unmocked) resolveDiceExpression maps
// 'rage_damage_d6' → '4d6'.
function frenzyStats() {
  return {
    name: 'DraconicDragon',
    level: 20,
    proficiency: 6,
    abilities: [{ name: 'Strength', bonus: 5 }, { name: 'Dexterity', bonus: 2 }],
    class: { class_levels: Array.from({ length: 20 }, (_, i) => ({ rage_damage: i === 19 ? 4 : 2 })) },
    automation: { actions: [FRENZY_ACTION], passives: [] },
  };
}

// The exact formula contextBuilder-sync emits post-CLA-147 for a Longsword STR
// attack while raging: weapon+STR + flat rage bake — no frenzy dice. The step
// owns the '4d6' rider end-to-end.
function laneCtx(overrides = {}) {
  const { frenzyUsedRound = null, ...rest } = overrides;
  getRuntimeValue.mockImplementation((_, key) => {
    if (key === 'activeBuffs') {
      return [
        { damageBonusExpression: 'rage_damage' }, // raging
        { effect: 'advantage_attacks_advantage_against' }, // reckless
      ];
    }
    if (key === '_frenzyUsedRound') return frenzyUsedRound;
    return null;
  });
  return {
    playerStats: frenzyStats(),
    campaignName: 'test-campaign',
    attack: { name: 'Longsword', damageType: 'Slashing', abilityName: 'Strength' },
    hit: true,
    formula: '1d8+5 plus 4',
    total: 13,
    rolls: [8],
    ...rest,
  };
}

describe('CLA-147 Frenzy — single rider owner (attackRollBonuses)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(null);
  });

  it('unarmed latch: lv20 STR hit resolves rage_damage_d6→4d6, rolls it ONCE, exact formula + rolls + total, stamps latch once', async () => {
    const r = await buildAutomationBonusesStep().handler(laneCtx());

    // CLA-147 regression falsifier: exactly one rider group on the exact lane formula.
    expect(r.data.formula).toBe('1d8+5 plus 4 + 4d6 [slashing]');
    // deterministic mock RNG: '4d6' → [4,4,4,4]; base weapon roll carried untouched.
    expect(r.data.rolls).toEqual([8, 4, 4, 4, 4]);
    expect(r.data.total).toBe(29);
    expect(rollExpression).toHaveBeenCalledTimes(1);
    expect(rollExpression).toHaveBeenCalledWith('4d6');

    // round + latch consulted campaign-pinned; latch stamped once with the round byte.
    expect(getCurrentCombatRound).toHaveBeenCalledWith('test-campaign');
    expect(setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(setRuntimeValue).toHaveBeenCalledWith('DraconicDragon', '_frenzyUsedRound', 1, 'test-campaign');

    // rider rides the formula only — no targetEffects/expiration side lanes.
    expect(addExpiration).not.toHaveBeenCalled();
  });

  it('armed latch + rider already carried in formula: byte-identical pass-through, zero rolls, zero writes', async () => {
    // Post-application state: latch stamped this round AND the incoming formula already
    // carries the rider group (the pre-fix double-application fingerprint input).
    const carried = {
      frenzyUsedRound: 1,
      formula: '1d8+5 plus 4 + 4d6 [slashing]',
      total: 29,
      rolls: [8, 4, 4, 4, 4],
    };
    const r = await buildAutomationBonusesStep().handler(laneCtx(carried));

    expect(r.data.formula).toBe(carried.formula);
    expect(r.data.rolls).toEqual(carried.rolls);
    expect(r.data.total).toBe(carried.total);
    // short-circuit proof: the whole step rolled nothing and wrote nothing this invocation.
    expect(rollExpression).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });
});
