// @maintained-by-ai
/**
 * Feature-decision lane: steps/features/assassinate.js (CLA-016 fix).
 * Owns the assassinate decision bytes: the first-round sneak window
 * (effectiveSneakDice > 0, round 1, attacker !hasActed, unlisted token
 * still armed), the campaign-keyed once-per-round latch, rogue_level
 * token → flat bonus, bonus > 0 guard sequencing BEFORE the latch stamp,
 * damageType default, and exact log bytes (app logging mandate).
 *
 * Family map (steps/features/): no sibling test touches assassinate.
 * Save-seam split: the first_round_sneak_attack_hit authored entries in
 * public/data/classes.json are damage_bonus only — no save DC, no
 * targetEffect stamps in this feature, so none are tested here.
 * Pipeline dispatch view ('2d6' label/rolls + latch through
 * resolveAttackDamage) lives in useAttackDamageResolution.classFeatures.test.js
 * and is NOT duplicated here; this lane pins the step handler internals with
 * the production 'rogue_level' constant expression (deterministic — rolls
 * zero dice, real rollExpression/automationExpressions act, no dice RNG).
 *
 * Old→new: condition ×2→1; sneak-0 ×2→1; log + campaignName folded into
 * the lv20 exact-bytes test; lv9 removed (same token path as lv20);
 * added unlisted-token/default-type and zero-bonus latch-order tests;
 * dead automationService mock purged (source never imports it).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(),
}));

// Faithful campaign-keyed store: latch reads/writes must carry campaignName.
const runtimeStore = {};
vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: (name, key, campaign) => runtimeStore[`${campaign}:${name}:${key}`],
  setRuntimeValue: (name, key, value, campaign) => { runtimeStore[`${campaign}:${name}:${key}`] = value; },
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// ── Imports ──────────────────────────────────────────────────────

import { assassinate } from './assassinate.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getCurrentCombatRound } from '../../../encounters/combatData.js';
import { addEntry } from '../../../ui/logService.js';

// ── Helpers ───────────────────────────────────────────────────────

// Verbatim from public/data/classes.json Assassin automation (CLA-016).
const ACTION = {
  type: 'damage_bonus',
  trigger: 'first_round_sneak_attack_hit',
  damageExpression: 'rogue_level',
  damageType: 'Sneak Attack',
  oncePerTurn: false,
  casting_time: 'passive',
};

const LATCH = '_assassinate_usedRound';
function makeCtx(overrides = {}) {
  return {
    campaignName: 'test-campaign',
    playerStats: { name: 'AasimarTest', level: 20, abilities: [], automation: { actions: [ACTION] } },
    targetName: 'Bandit 1',
    effectiveSneakDice: 10,
    ...overrides,
  };
}

function makePrevData() {
  return { formula: '1d6+2 [piercing] + 10d6 [Sneak Attack]', total: 45, rolls: [4, 3, 6] };
}

function armed() {
  getCombatContext.mockResolvedValue({ creatures: [{ name: 'AasimarTest', hasActed: false }] });
  getCurrentCombatRound.mockReturnValue(1);
}

// ── Tests ────────────────────────────────────────────────────────

describe('assassinate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('condition is true only when automation.actions exists', () => {
    expect(assassinate.condition(makeCtx())).toBe(true);
    expect(assassinate.condition({ playerStats: {} })).toBe(false);
  });

  describe('gates (all other bytes armed, one leg off)', () => {
    it('returns null when no damage_bonus first_round_sneak_attack_hit entry exists', async () => {
      const ctx = makeCtx({ playerStats: { name: 'AasimarTest', level: 20, abilities: [], automation: { actions: [] } } });
      expect(await assassinate.handler(ctx, makePrevData())).toBeNull();
      expect(getCombatContext).not.toHaveBeenCalled(); // short-circuits before any state read
      expect(addEntry).not.toHaveBeenCalled();
    });

    it('returns null when sneak attack applied no dice this attack (CLA-016 window)', async () => {
      armed();
      const ctx = makeCtx({ effectiveSneakDice: 0 });
      expect(await assassinate.handler(ctx, { formula: '1d6+2 [piercing]', total: 5, rolls: [4] })).toBeNull();
      expect(runtimeStore).toEqual({}); // latch never stamped on a rejected hit
      expect(addEntry).not.toHaveBeenCalled();
    });

    it('returns null in round 2', async () => {
      getCombatContext.mockResolvedValue({ creatures: [{ name: 'AasimarTest', hasActed: false }] });
      getCurrentCombatRound.mockReturnValue(2);
      expect(await assassinate.handler(makeCtx(), makePrevData())).toBeNull();
      expect(addEntry).not.toHaveBeenCalled();
    });

    it('returns null once the attacker has acted', async () => {
      getCombatContext.mockResolvedValue({ creatures: [{ name: 'AasimarTest', hasActed: true }] });
      getCurrentCombatRound.mockReturnValue(1);
      expect(await assassinate.handler(makeCtx(), makePrevData())).toBeNull();
      expect(addEntry).not.toHaveBeenCalled();
    });

    it('returns null when combat context is missing', async () => {
      getCombatContext.mockResolvedValue(null);
      getCurrentCombatRound.mockReturnValue(1);
      expect(await assassinate.handler(makeCtx(), makePrevData())).toBeNull();
      expect(addEntry).not.toHaveBeenCalled();
    });
  });

  describe('bonus application', () => {
    it('applies +rogue_level once with exact formula, log, and campaign-keyed latch bytes', async () => {
      armed();
      const result = await assassinate.handler(makeCtx(), makePrevData());
      // 'rogue_level' token-resolves to '20' (CLA-016); constant rolls no dice.
      expect(result.data.formula).toBe('1d6+2 [piercing] + 10d6 [Sneak Attack] + 20 [Sneak Attack]');
      expect(result.data.total).toBe(65);
      expect(result.data.rolls).toEqual([4, 3, 6]); // flat bonus contributes no dice
      expect(getCurrentCombatRound).toHaveBeenCalledWith('test-campaign');
      expect(runtimeStore[`test-campaign:AasimarTest:${LATCH}`]).toBe(1);
      expect(addEntry).toHaveBeenCalledWith('test-campaign', {
        type: 'ability_use',
        characterName: 'AasimarTest',
        abilityName: 'Assassinate',
        description: 'Assassinate: +20 [Sneak Attack] extra damage to Bandit 1 (first-round sneak attack hit)',
        targetName: 'Bandit 1',
      });
    });

    it('latches once per round: second qualifying sneak hit same round gets no bonus', async () => {
      armed();
      expect((await assassinate.handler(makeCtx(), makePrevData())).data.total).toBe(65);
      expect(await assassinate.handler(makeCtx(), makePrevData())).toBeNull();
      expect(addEntry).toHaveBeenCalledTimes(1);
      expect(runtimeStore[`test-campaign:AasimarTest:${LATCH}`]).toBe(1);
    });

    it('still applies when the attacker token is not on the combat tracker, defaulting the damage type', async () => {
      getCombatContext.mockResolvedValue({ creatures: [] }); // newly-added token: hasActed unknown → not yet acted
      getCurrentCombatRound.mockReturnValue(1);
      const action = { ...ACTION, damageType: undefined };
      const ctx = makeCtx({ playerStats: { name: 'Rogue Two', level: 6, abilities: [], automation: { actions: [action] } }, effectiveSneakDice: 3 });
      const result = await assassinate.handler(ctx, { formula: '1d8+1 [slashing] + 3d6 [Sneak Attack]', total: 21, rolls: [6] });
      expect(result.data.formula).toBe('1d8+1 [slashing] + 3d6 [Sneak Attack] + 6 [Sneak Attack]');
      expect(result.data.total).toBe(27);
      expect(runtimeStore[`test-campaign:Rogue Two:${LATCH}`]).toBe(1);
    });

    it('a resolved-zero bonus grants nothing and never stamps the latch', async () => {
      armed();
      const action = { ...ACTION, damageExpression: '0' };
      const ctx = makeCtx({ playerStats: { name: 'AasimarTest', level: 20, abilities: [], automation: { actions: [action] } } });
      expect(await assassinate.handler(ctx, makePrevData())).toBeNull();
      expect(runtimeStore).toEqual({}); // guard runs BEFORE setRuntimeValue — later hits stay eligible
      expect(addEntry).not.toHaveBeenCalled();
    });
  });
});
