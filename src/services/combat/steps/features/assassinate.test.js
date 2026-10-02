// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(),
}));

vi.mock('../../../combat/automation/automationService.js', async () => {
  const real = await vi.importActual('../../../combat/automation/automationExpressions.js');
  return { resolveNumericExpression: real.resolveNumericExpression };
});

const runtimeStore = {};
vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: (name, key) => runtimeStore[`${name}:${key}`],
  setRuntimeValue: (name, key, value) => { runtimeStore[`${name}:${key}`] = value; },
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

const ACTION = {
  type: 'damage_bonus',
  trigger: 'first_round_sneak_attack_hit',
  damageExpression: 'rogue_level',
  damageType: 'Sneak Attack',
  oncePerTurn: false,
  casting_time: 'passive',
};

function rogue(level = 20) {
  return { name: 'AasimarTest', level, abilities: [] };
}

function makeCtx(overrides = {}) {
  return {
    campaignName: 'test-campaign',
    playerStats: { ...rogue(), automation: { actions: [ACTION] } },
    targetName: 'Bandit 1',
    effectiveSneakDice: 10,
    ...overrides,
  };
}

function makePrevData() {
  return { formula: '1d6+2 [piercing] + 10d6 [Sneak Attack]', total: 45, rolls: [4, 3, 6] };
}

function armedCombat() {
  getCombatContext.mockResolvedValue({ creatures: [{ name: 'AasimarTest', hasActed: false }] });
  getCurrentCombatRound.mockReturnValue(1);
}

// ── Tests ────────────────────────────────────────────────────────

describe('assassinate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
  });

  describe('condition', () => {
    it('true when automation.actions exists', () => {
      expect(assassinate.condition(makeCtx())).toBe(true);
    });

    it('false when automation is missing', () => {
      expect(assassinate.condition({ playerStats: {} })).toBe(false);
    });
  });

  describe('early returns', () => {
    it('returns null when no damage_bonus action entry', async () => {
      const ctx = makeCtx({ playerStats: { ...rogue(), automation: { actions: [] } } });
      expect(await assassinate.handler(ctx, makePrevData())).toBeNull();
    });

    it('returns null when Sneak Attack did not apply dice on this attack', async () => {
      armedCombat();
      const ctx = makeCtx({ effectiveSneakDice: 0 });
      expect(await assassinate.handler(ctx, makePrevData())).toBeNull();
    });

    it('returns null when sneak dice were fully spent on Cunning Strike', async () => {
      armedCombat();
      const ctx = makeCtx({ effectiveSneakDice: 0 });
      const prev = { formula: '1d6+2 [piercing]', total: 5, rolls: [4] };
      expect(await assassinate.handler(ctx, prev)).toBeNull();
    });

    it('returns null when combat context is missing', async () => {
      getCombatContext.mockResolvedValue(null);
      expect(await assassinate.handler(makeCtx(), makePrevData())).toBeNull();
    });

    it('returns null in round 2', async () => {
      getCombatContext.mockResolvedValue({ creatures: [{ name: 'AasimarTest', hasActed: false }] });
      getCurrentCombatRound.mockReturnValue(2);
      expect(await assassinate.handler(makeCtx(), makePrevData())).toBeNull();
    });

    it('returns null once the attacker has acted', async () => {
      getCombatContext.mockResolvedValue({ creatures: [{ name: 'AasimarTest', hasActed: true }] });
      getCurrentCombatRound.mockReturnValue(1);
      expect(await assassinate.handler(makeCtx(), makePrevData())).toBeNull();
    });
  });

  describe('application', () => {
    it('resolves rogue_level token to 20 at level 20', async () => {
      armedCombat();
      const result = await assassinate.handler(makeCtx(), makePrevData());
      expect(result).not.toBeNull();
      expect(result.data.formula).toBe('1d6+2 [piercing] + 10d6 [Sneak Attack] + 20 [Sneak Attack]');
      expect(result.data.total).toBe(65);
    });

    it('applies round-1-only once-per-round latch: second sneak hit same round gets no bonus', async () => {
      armedCombat();
      const first = await assassinate.handler(makeCtx(), makePrevData());
      expect(first.data.total).toBe(65);
      expect(runtimeStore['AasimarTest:_assassinate_usedRound']).toBe(1);

      const second = await assassinate.handler(makeCtx(), makePrevData());
      expect(second).toBeNull();
    });

    it('logs the bonus as an ability_use entry', async () => {
      armedCombat();
      await assassinate.handler(makeCtx(), makePrevData());
      expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
        type: 'ability_use',
        characterName: 'AasimarTest',
        abilityName: 'Assassinate',
        targetName: 'Bandit 1',
      }));
      expect(addEntry.mock.calls[0][1].description).toContain('+20 [Sneak Attack]');
    });

    it('threads campaignName into round lookup and runtime latch', async () => {
      armedCombat();
      await assassinate.handler(makeCtx(), makePrevData());
      expect(getCurrentCombatRound).toHaveBeenCalledWith('test-campaign');
    });

    it('scales with rogue level (lv9 adds +9)', async () => {
      armedCombat();
      const ctx = makeCtx({ playerStats: { ...rogue(9), automation: { actions: [ACTION] } }, effectiveSneakDice: 5 });
      const result = await assassinate.handler(ctx, makePrevData());
      expect(result.data.formula).toMatch(/\+ 9 \[Sneak Attack\]$/);
      expect(result.data.total).toBe(54);
    });
  });
});
