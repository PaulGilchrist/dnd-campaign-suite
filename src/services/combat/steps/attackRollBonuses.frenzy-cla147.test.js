// @improved-by-ai
// CLA-147: Frenzy must roll exactly ONE rage_damage_d6 group on the triggering
// hit. contextBuilder-sync no longer bakes the rider into autoDamageFormula —
// attackRollBonuses.applyFrenzyBonuses is the single owner of roll + application
// + the _frenzyUsedRound latch. These tests pin the lane junction (contextBuilder
// output formula fed into the step) and the once-per-turn re-fire guard.
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
const { getRuntimeValue, setRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js');

const FRENZY_ACTION = {
  type: 'damage_bonus',
  trigger: 'reckless_attack_hit_while_raging',
  damageExpression: 'rage_damage_d6',
  damageType: 'same_as_weapon',
  oncePerTurn: true,
};

// lv20 Barbarian: rage_damage 4 → 'rage_damage_d6' resolves to '4d6'
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

function ragingRecklessBuffs() {
  return [
    { damageBonusExpression: 'rage_damage' },
    { effect: 'advantage_attacks_advantage_against' },
  ];
}

// The exact formula contextBuilder-sync emits post-CLA-147 fix for a Longsword
// STR attack while raging: weapon+STR, then the flat rage bake — no frenzy dice.
// (Live fingerprint pre-fix: '1d8+5 plus 4 plus 4d6 [slashing] + 4d6 [slashing]'.)
function contextBuilderLaneCtx(overrides = {}) {
  const frenzyUsedRound = overrides.frenzyUsedRound ?? null;
  getRuntimeValue.mockImplementation((_, key) => {
    if (key === 'activeBuffs') return ragingRecklessBuffs();
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
    ...overrides,
  };
}

function frenzyGroupCount(formula) {
  return (formula.match(/\+ 4d6 \[slashing\]/g) || []).length;
}

describe('CLA-147 Frenzy — single rider owner (attackRollBonuses)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(null);
  });

  it('lane junction: contextBuilder base formula + step → exactly ONE frenzy group rolled/applied, latch set once', async () => {
    const step = buildAutomationBonusesStep();
    const ctx = contextBuilderLaneCtx();

    const r = await step.handler(ctx);

    expect(frenzyGroupCount(r.data.formula)).toBe(1);
    expect(r.data.formula).toBe('1d8+5 plus 4 + 4d6 [slashing]');
    // exactly one 4d6 group rolled (base 1d8 already rolled upstream, not here)
    const d6Rolls = rollExpression.mock.calls.filter(([f]) => f === '4d6');
    expect(d6Rolls).toHaveLength(1);
    // one rider group of 4 dice rides the rolls array
    expect(r.data.rolls).toHaveLength(5);
    expect(r.data.total).toBe(13 + 16);
    expect(setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(setRuntimeValue).toHaveBeenCalledWith('DraconicDragon', '_frenzyUsedRound', 1, 'test-campaign');
  });

  it('re-fire same round after latch: second invocation adds zero frenzy dice', async () => {
    const step = buildAutomationBonusesStep();
    const first = await step.handler(contextBuilderLaneCtx());
    expect(frenzyGroupCount(first.data.formula)).toBe(1);

    // Latch now set (per live applyFrenzyBonuses write) → second attack same round: no rider
    const second = await step.handler(contextBuilderLaneCtx({
      frenzyUsedRound: 1,
      formula: first.data.formula,
      total: first.data.total,
      rolls: first.data.rolls,
    }));

    expect(frenzyGroupCount(second.data.formula)).toBe(1);
    expect(second.data.formula).toBe(first.data.formula);
    expect(rollExpression.mock.calls.filter(([f]) => f === '4d6')).toHaveLength(1);
  });

  it('pipeline standalone: ungated base formula still gains exactly ONE frenzy group on hit', async () => {
    const step = buildAutomationBonusesStep();
    const ctx = contextBuilderLaneCtx({ formula: '1d8+5', total: 13 - 4, rolls: [8] });

    const r = await step.handler(ctx);

    expect(frenzyGroupCount(r.data.formula)).toBe(1);
    expect(rollExpression.mock.calls.filter(([f]) => f === '4d6')).toHaveLength(1);
    expect(setRuntimeValue).toHaveBeenCalledWith('DraconicDragon', '_frenzyUsedRound', 1, 'test-campaign');
  });
});
