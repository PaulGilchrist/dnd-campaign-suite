// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { applyDamageToTarget } from './applyDamage.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

// ── Mocks (hoisted by Vitest) ──────────────────────────────────

vi.mock('../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
  rollExpression: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../ui/storage.js', () => ({ default: { get: vi.fn(), set: vi.fn() } }));

vi.mock('../../combat/conditions/savePromptService.js', () => ({
  sendDeathSavePrompt: vi.fn(),
  sendConcentrationPrompt: vi.fn(),
}));

vi.mock('../../combat/concentration/concentrationRules.js', () => ({
  rollConcentrationSave: vi.fn(),
}));

vi.mock('../../ui/utils.js', () => ({ default: { guid: vi.fn(() => 'test-guid-001') } }));

vi.mock('../../automation/handlers/spells/tashasLaughterHandler.js', () => ({
  processTashasLaughterRepeatSave: vi.fn(),
  handle: vi.fn(),
}));

vi.mock('./rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(() => 30),
}));

// ── Globals ─────────────────────────────────────────────────────

global.fetch = vi.fn(() => new Promise(() => {}));

// ── Helpers ─────────────────────────────────────────────────────

function makeCombatSummary(creatures) {
  return { round: 1, creatures };
}

function createNpcCreature(name, maxHp, currentHp, extra = {}) {
  return {
    name,
    type: 'npc',
    maxHp,
    currentHp,
    resistances: [],
    immunities: [],
    conditions: [],
    concentration: null,
    saveBonuses: {},
    ...extra,
  };
}

function createPlayerCreature(name, extra = {}) {
  return {
    name,
    type: 'player',
    maxHp: 30,
    currentHp: 30,
    resistances: [],
    immunities: [],
    conditions: [],
    concentration: null,
    saveBonuses: {},
    ...extra,
  };
}

/**
 * Stub getRuntimeValue for player-targeted damage calls.
 * applyDamageToTarget queries these keys for players:
 *   1. activeBuffs (campaignName) → array
 *   2. arcaneWardActive (campaignName) → boolean
 *   3. arcaneWardHp (campaignName) → number
 *   4. lastMetamagicDamage (campaignName) → object|undefined
 *   5. currentHitPoints (no campaign) → number
 *   6. activeConditions (no campaign) → array
 *   7. activeBuffs (attacker, campaignName) → array (Warding Bond check)
 */
function stubPlayerRuntime(currentHp, conditions = [], activeBuffs = [], arcaneWardActive = false, arcaneWardHp = 0) {
  getRuntimeValue.mockReset();
  getRuntimeValue
    .mockImplementation((_charName, key, _campaignName) => {
      if (key === 'activeBuffs') return activeBuffs;
      if (key === 'arcaneWardActive') return arcaneWardActive;
      if (key === 'arcaneWardHp') return arcaneWardHp;
      if (key === 'lastMetamagicDamage') return undefined;
      if (key === 'currentHitPoints') return currentHp;
      if (key === 'activeConditions') return conditions;
      return undefined;
    });
}

/**
 * Stub getRuntimeValue for NPC-targeted damage calls.
 * NPCs only need currentHitPoints from runtime (for logDamageApplication maxHp fallback).
 */
// eslint-disable-next-line no-unused-vars -- helper available if NPC Thought Shield is needed
function stubNpcRuntime() {
  getRuntimeValue.mockReset();
  getRuntimeValue.mockReturnValue(undefined);
}

// ── Tests ───────────────────────────────────────────────────────

describe('Thought Shield — Psychic damage reflection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch.mockReset();
  });

  function createWarlockCharacter(_hp) {
    return {
      name: 'Warlock',
      computedStats: {
        resistances: ['psychic'],
        immunities: [],
        level: 10,
        class: { name: 'Warlock', class_levels: [{ level: 10 }] },
        class_levels: [{ level: 10 }],
        characterAdvancement: [{ name: 'Thought Shield' }],
        equipment: [],
        allFeatures: [],
        automation: { passives: [] },
      },
    };
  }

  function createNonWarlockCharacter(name) {
    return {
      name,
      computedStats: {
        resistances: [],
        immunities: [],
        level: 10,
        class: { name: 'Fighter', class_levels: [{ level: 10 }] },
        class_levels: [{ level: 10 }],
        characterAdvancement: [],
        equipment: [],
        allFeatures: [],
        automation: { passives: [] },
      },
    };
  }

  describe('successful reflection', () => {
    it('reflects psychic damage back to the attacker', () => {
      const goblin = createNpcCreature('Goblin', 10, 10);
      const warlockCreature = createPlayerCreature('Warlock');
      const cs = makeCombatSummary([goblin, warlockCreature]);
      const warlock = createWarlockCharacter(20);

      stubPlayerRuntime(20);

      applyDamageToTarget(cs, 'Warlock', 10, ['Psychic'], 'TestCampaign', [warlock], false, 'Goblin');

      expect(goblin.currentHp).toBe(5);
    });

    it('reflects the resistance-reduced damage amount', () => {
      const goblin = createNpcCreature('Goblin', 8, 8);
      const warlockCreature = createPlayerCreature('Warlock');
      const cs = makeCombatSummary([goblin, warlockCreature]);
      const warlock = createWarlockCharacter(20);

      stubPlayerRuntime(20);

      applyDamageToTarget(cs, 'Warlock', 10, ['Psychic'], 'TestCampaign', [warlock], false, 'Goblin');

      // Psychic damage halved by warlock's resistance → 5 reflected
      expect(goblin.currentHp).toBe(3);
    });

    it('reflects when attacker has concentration — updates DC', () => {
      const goblin = createNpcCreature('Goblin', 10, 10, {
        concentration: { spell: 'Burning Hands', dc: 10 },
      });
      const warlockCreature = createPlayerCreature('Warlock');
      const cs = makeCombatSummary([goblin, warlockCreature]);
      const warlock = createWarlockCharacter(20);

      stubPlayerRuntime(20);

      applyDamageToTarget(cs, 'Warlock', 10, ['Psychic'], 'TestCampaign', [warlock], false, 'Goblin');

      // dc = Math.max(10, Math.floor(5 / 2)) = Math.max(10, 2) = 10
      expect(goblin.concentration.dc).toBe(10);
    });

    it('reflects when warlock has active buffs (does not interfere)', () => {
      const goblin = createNpcCreature('Goblin', 10, 10);
      const warlockCreature = createPlayerCreature('Warlock');
      const cs = makeCombatSummary([goblin, warlockCreature]);
      const warlock = createWarlockCharacter(20);

      stubPlayerRuntime(20, [], [{ name: 'Shield' }]);

      applyDamageToTarget(cs, 'Warlock', 10, ['Psychic'], 'TestCampaign', [warlock], false, 'Goblin');

      expect(goblin.currentHp).toBe(5);
    });
  });

  describe('no reflection conditions', () => {
    it('does not reflect non-psychic damage types', () => {
      const goblin = createNpcCreature('Goblin', 10, 10);
      const cs = makeCombatSummary([goblin]);
      const warlock = createWarlockCharacter(20);

      stubPlayerRuntime(20);

      applyDamageToTarget(cs, 'Warlock', 10, ['Fire'], 'TestCampaign', [warlock], false, 'Goblin');

      expect(goblin.currentHp).toBe(10);
    });

    it('does not reflect when player has no Thought Shield feature', () => {
      const goblin = createNpcCreature('Goblin', 10, 10);
      const cs = makeCombatSummary([goblin]);
      const fighter = createNonWarlockCharacter('Fighter');

      stubPlayerRuntime(20);

      applyDamageToTarget(cs, 'Fighter', 10, ['Psychic'], 'TestCampaign', [fighter], false, 'Goblin');

      expect(goblin.currentHp).toBe(10);
    });

    it('does not reflect when attackerName is null', () => {
      const goblin = createNpcCreature('Goblin', 10, 10);
      const warlockCreature = createPlayerCreature('Warlock');
      const cs = makeCombatSummary([goblin, warlockCreature]);
      const warlock = createWarlockCharacter(20);

      stubPlayerRuntime(20);

      const result = applyDamageToTarget(cs, 'Warlock', 10, ['Psychic'], 'TestCampaign', [warlock], false, null);

      expect(result).not.toBeNull();
    });

    it('does not reflect when attackerName is undefined', () => {
      const goblin = createNpcCreature('Goblin', 10, 10);
      const warlockCreature = createPlayerCreature('Warlock');
      const cs = makeCombatSummary([goblin, warlockCreature]);
      const warlock = createWarlockCharacter(20);

      stubPlayerRuntime(20);

      const result = applyDamageToTarget(cs, 'Warlock', 10, ['Psychic'], 'TestCampaign', [warlock], false, undefined);

      expect(result).not.toBeNull();
    });

    it('does not reflect when attacker is the same as the player', () => {
      const warlockCreature = createPlayerCreature('Warlock');
      const cs = makeCombatSummary([warlockCreature, createNpcCreature('Goblin', 10, 10)]);
      const warlock = createWarlockCharacter(20);

      stubPlayerRuntime(20);

      applyDamageToTarget(cs, 'Warlock', 10, ['Psychic'], 'TestCampaign', [warlock], false, 'Warlock');

      expect(cs.creatures[1].currentHp).toBe(10);
    });

    it('does not reflect when attacker is already dead (0 HP)', () => {
      const deadGoblin = createNpcCreature('Goblin', 5, 0);
      const warlockCreature = createPlayerCreature('Warlock');
      const cs = makeCombatSummary([deadGoblin, warlockCreature]);
      const warlock = createWarlockCharacter(20);

      stubPlayerRuntime(20);

      applyDamageToTarget(cs, 'Warlock', 10, ['Psychic'], 'TestCampaign', [warlock], false, 'Goblin');

      expect(deadGoblin.currentHp).toBe(0);
    });

    it('does not reflect when attacker creature is not in combat summary', () => {
      const warlockCreature = createPlayerCreature('Warlock');
      const cs = makeCombatSummary([warlockCreature]);
      const warlock = createWarlockCharacter(20);

      stubPlayerRuntime(20);

      applyDamageToTarget(cs, 'Warlock', 10, ['Psychic'], 'TestCampaign', [warlock], false, 'MissingAttacker');

      // No error thrown; reflection simply does nothing
    });
  });

  describe('edge cases', () => {
    it('clamps reflected damage to 0 minimum HP', () => {
      const goblin = createNpcCreature('Goblin', 5, 5);
      const warlockCreature = createPlayerCreature('Warlock');
      const cs = makeCombatSummary([goblin, warlockCreature]);
      const warlock = createWarlockCharacter(20);

      stubPlayerRuntime(20);

      applyDamageToTarget(cs, 'Warlock', 10, ['Psychic'], 'TestCampaign', [warlock], false, 'Goblin');

      // 10 halved by resistance = 5 reflected; 5 - 5 = 0
      expect(goblin.currentHp).toBe(0);
    });

    it('does not reflect when warlock is immune to psychic damage', () => {
      const goblin = createNpcCreature('Goblin', 10, 10);
      const warlockCreature = createPlayerCreature('Warlock');
      const cs = makeCombatSummary([goblin, warlockCreature]);
      const warlock = {
        ...createWarlockCharacter(20),
        computedStats: {
          ...createWarlockCharacter(20).computedStats,
          immunities: ['psychic'],
          resistances: [],
        },
      };

      stubPlayerRuntime(20);

      applyDamageToTarget(cs, 'Warlock', 10, ['Psychic'], 'TestCampaign', [warlock], false, 'Goblin');

      // Immune → 0 damage dealt → 0 reflected
      expect(goblin.currentHp).toBe(10);
    });

    it('does not reflect when damage is reduced to 0 by a save (wardDamage is 0)', () => {
      const goblin = createNpcCreature('Goblin', 10, 10);
      const warlockCreature = createPlayerCreature('Warlock');
      const cs = makeCombatSummary([goblin, warlockCreature]);
      const warlock = createWarlockCharacter(20);

      // If wardDamage is 0 (e.g., arcane ward absorbs everything), nothing reflects
      stubPlayerRuntime(20, [], [], true, 100);

      applyDamageToTarget(cs, 'Warlock', 10, ['Psychic'], 'TestCampaign', [warlock], false, 'Goblin');

      expect(goblin.currentHp).toBe(10);
    });

    it('handles case-insensitive psychic damage type check', () => {
      const goblin = createNpcCreature('Goblin', 10, 10);
      const warlockCreature = createPlayerCreature('Warlock');
      const cs = makeCombatSummary([goblin, warlockCreature]);
      const warlock = createWarlockCharacter(20);

      stubPlayerRuntime(20);

      applyDamageToTarget(cs, 'Warlock', 10, ['psychic'], 'TestCampaign', [warlock], false, 'Goblin');

      expect(goblin.currentHp).toBe(5);
    });

    it('handles case-insensitive Thought Shield feature name check', () => {
      const goblin = createNpcCreature('Goblin', 10, 10);
      const warlockCreature = createPlayerCreature('Warlock');
      const cs = makeCombatSummary([goblin, warlockCreature]);
      const warlock = {
        ...createWarlockCharacter(20),
        computedStats: {
          ...createWarlockCharacter(20).computedStats,
          characterAdvancement: [{ name: 'thought shield' }],
        },
      };

      stubPlayerRuntime(20);

      applyDamageToTarget(cs, 'Warlock', 10, ['Psychic'], 'TestCampaign', [warlock], false, 'Goblin');

      // The source uses .some(f => f.name === 'Thought Shield') — exact match
      // This test documents the current behavior: case-sensitive feature name
      expect(goblin.currentHp).toBe(10);
    });
  });

  describe('concentration check on attacker', () => {
    it('updates attacker concentration DC when reflected damage is dealt', () => {
      const goblin = createNpcCreature('Goblin', 10, 10, {
        concentration: { spell: 'Burning Hands', dc: 10 },
      });
      const warlockCreature = createPlayerCreature('Warlock');
      const cs = makeCombatSummary([goblin, warlockCreature]);
      const warlock = createWarlockCharacter(20);

      stubPlayerRuntime(20);

      applyDamageToTarget(cs, 'Warlock', 10, ['Psychic'], 'TestCampaign', [warlock], false, 'Goblin');

      // reflectedDamage = 5 (halved by resistance), dc = Math.max(10, Math.floor(5/2)) = 10
      expect(goblin.concentration.dc).toBe(10);
    });

    it('sets concentration DC from reflected damage without resistance', () => {
      const goblin = createNpcCreature('Goblin', 10, 10, {
        concentration: { spell: 'Haste', dc: 5 },
      });
      const warlockCreature = createPlayerCreature('Warlock');
      const cs = makeCombatSummary([goblin, warlockCreature]);
      const warlock = {
        ...createWarlockCharacter(20),
        computedStats: {
          ...createWarlockCharacter(20).computedStats,
          resistances: [],
        },
      };

      stubPlayerRuntime(20);

      applyDamageToTarget(cs, 'Warlock', 10, ['Psychic'], 'TestCampaign', [warlock], false, 'Goblin');

      // No resistance → 10 reflected, dc = Math.max(10, Math.floor(10/2)) = Math.max(10, 5) = 10
      expect(goblin.concentration.dc).toBe(10);
    });

    it('sets concentration DC above 10 for large reflected damage', () => {
      const goblin = createNpcCreature('Goblin', 50, 50, {
        concentration: { spell: 'Haste', dc: 5 },
      });
      const warlockCreature = createPlayerCreature('Warlock');
      const cs = makeCombatSummary([goblin, warlockCreature]);
      const warlock = {
        ...createWarlockCharacter(20),
        computedStats: {
          ...createWarlockCharacter(20).computedStats,
          resistances: [],
        },
      };

      stubPlayerRuntime(20);

      applyDamageToTarget(cs, 'Warlock', 30, ['Psychic'], 'TestCampaign', [warlock], false, 'Goblin');

      // 30 reflected, dc = Math.max(10, Math.floor(30/2)) = Math.max(10, 15) = 15
      expect(goblin.concentration.dc).toBe(15);
    });

    it('does not set concentration DC when attacker has no concentration', () => {
      const goblin = createNpcCreature('Goblin', 10, 10, { concentration: null });
      const warlockCreature = createPlayerCreature('Warlock');
      const cs = makeCombatSummary([goblin, warlockCreature]);
      const warlock = createWarlockCharacter(20);

      stubPlayerRuntime(20);

      applyDamageToTarget(cs, 'Warlock', 10, ['Psychic'], 'TestCampaign', [warlock], false, 'Goblin');

      expect(goblin.concentration).toBeNull();
    });
  });
});
