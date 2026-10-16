// @maintained-by-ai
// Opener lane of the massHealingWord trio (#1822; siblings: confirm #1820 maintained, #1821 deleted
// as factory dupes). massHealingWordHandler.js is a 12-line config wrapper around
// massHealUtils.createMassHealHandler. The shared opener contract inside the factory
// (getSpellCastingMod branches, resolveHealExpression fallbacks, null-combat-context guard,
// unnamed-creature filtering, the <=maxTargets popup boundary at exactly-max, modal payload
// schema, automation.maxTargets widening) is canonically pinned by massCureWoundsHandler.test.js
// (main lane); confirmFn application behaviour lives in massCureWoundsHandler.confirm.test.js and
// MHW confirm deltas in massHealingWordHandler.confirm.test.js. What lives HERE is Mass Healing
// Word config deltas only: the full 2d6 slot table with MOD substituted from the caster's
// Wisdom, defaultSlotLevel 3 (spell table {'3','4'} makes the pin non-vacuous),
// modalName 'massHealingWordTarget', defaultMaxTargets 6, emptyMessage full-string
// own-composition, and opener→confirm delegation evidence (every eligible name, combat order).
// Prayer-of-Healing latch internals (#1823) stay out — MHW config sets oncePerLongRest unset,
// so only its non-leak (no currentRound on the modal payload) is pinned here.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
  rollExpressionMaximized: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../rules/combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  setRuntimeBatch: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
  resolveHealingBonusesWithDetails: vi.fn(() => ({ totalBonus: 0, details: [] })),
  markFortifiedHealthUsed: vi.fn(),
  hasHealingMaximization: vi.fn(),
  hasHealingMaximizationForTarget: vi.fn(),
}));

vi.mock('../../../rules/spells/postCastHealService.js', () => ({
  triggerPostCastSelfHeals: vi.fn(() => Promise.resolve(null)),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './massHealingWordHandler.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import {
  resolveHealingBonusesWithDetails,
  hasHealingMaximization,
  hasHealingMaximizationForTarget,
} from '../../../combat/automation/automationService.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCleric',
    level: 10,
    proficiency: 4,
    hitPoints: 50,
    spellAbilities: { modifier: 3 },
    abilities: [{ name: 'Wisdom', bonus: 3 }],
    ...overrides,
  };
}

// Overrides MERGE into nested spell/automation — never replace them wholesale.
function makeAction(overrides = {}) {
  const { spell: spellOverrides, automation: automationOverrides, ...rest } = overrides;
  return {
    name: 'Mass Healing Word',
    spell: {
      name: 'Mass Healing Word',
      level: 3,
      heal_at_slot_level: {
        '3': '2d6 + MOD',
        '4': '3d6 + MOD',
        '5': '4d6 + MOD',
        '6': '5d6 + MOD',
        '7': '6d6 + MOD',
        '8': '7d6 + MOD',
        '9': '8d6 + MOD',
      },
      ...spellOverrides,
    },
    automation: { type: 'mass_healing_word', ...automationOverrides },
    ...rest,
  };
}

function makeCombatSummary(creatures) {
  return {
    players: [{ name: 'TestCleric', gridX: 1, gridY: 1 }],
    creatures,
  };
}

function sevenCreatures() {
  return [
    { name: 'Fighter', maxHp: 45, currentHp: 20, type: 'player' },
    { name: 'Rogue', maxHp: 30, currentHp: 10, type: 'player' },
    { name: 'Barbarian', maxHp: 60, currentHp: 30, type: 'npc' },
    { name: 'Wizard', maxHp: 25, currentHp: 15, type: 'player' },
    { name: 'Paladin', maxHp: 50, currentHp: 25, type: 'player' },
    { name: 'Ranger', maxHp: 40, currentHp: 20, type: 'npc' },
    { name: 'Druid', maxHp: 35, currentHp: 10, type: 'npc' },
  ];
}

// ── Tests ──────────────────────────────────────────────────────

describe('massHealingWordHandler handle() opener — config deltas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rollExpression.mockReturnValue({ total: 12, rolls: [5, 4, 3], modifier: 0 });
    getCombatContext.mockResolvedValue(
      makeCombatSummary([
        { name: 'Fighter', maxHp: 45, currentHp: 20, type: 'player' },
        { name: 'Rogue', maxHp: 30, currentHp: 10, type: 'player' },
        { name: 'Barbarian', maxHp: 60, currentHp: 30, type: 'npc' },
      ]),
    );
    getRuntimeValue.mockImplementation((_name, prop) => {
      if (prop === 'currentHitPoints') return 20;
      return null;
    });
    hasHealingMaximization.mockReturnValue(false);
    hasHealingMaximizationForTarget.mockReturnValue(false);
    resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 0, details: [] });
  });

  // ── MHW spell config: heal_at_slot_level table ────────────────

  describe('heal_at_slot_level table (own config data)', () => {
    it('walks the full 2d6-per-slot table with MOD substituted from Wisdom (+3)', async () => {
      const table = [
        [3, '2d6 + 3'],
        [4, '3d6 + 3'],
        [5, '4d6 + 3'],
        [6, '5d6 + 3'],
        [7, '6d6 + 3'],
        [8, '7d6 + 3'],
        [9, '8d6 + 3'],
      ];
      for (const [slotLevel, expression] of table) {
        await handle(
          makeAction({ automation: { slotLevel } }),
          makePlayerStats(),
          campaignName,
          null,
        );
        expect(rollExpression).toHaveBeenLastCalledWith(expression);
      }
    });

    it('defaults to defaultSlotLevel 3 when neither automation nor spell carries a level', async () => {
      // Built inline: two-entry table makes default 3 distinguishable — a default of 4
      // would resolve '3d6 + 3' instead.
      const action = {
        name: 'Mass Healing Word',
        spell: { name: 'Mass Healing Word', heal_at_slot_level: { '3': '2d6 + MOD', '4': '3d6 + MOD' } },
        automation: { type: 'mass_healing_word' },
      };
      await handle(action, makePlayerStats(), campaignName, null);
      expect(rollExpression).toHaveBeenLastCalledWith('2d6 + 3');
    });
  });

  // ── modal routing: modalName + defaultMaxTargets 6 ────────────

  it('routes 7 eligible to the massHealingWordTarget modal at default maxTargets 6 with the spell config payload', async () => {
    getCombatContext.mockResolvedValue(makeCombatSummary(sevenCreatures()));
    const action = makeAction();
    const ps = makePlayerStats();

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('modal');
    // Config deltas: this spell's modal + its default slot/maxTargets.
    expect(result.modalName).toBe('massHealingWordTarget');
    expect(result.payload.action).toBe(action);
    expect(result.payload.playerStats).toBe(ps);
    expect(result.payload.campaignName).toBe(campaignName);
    expect(result.payload.creatureTargets).toEqual(
      ['Fighter', 'Rogue', 'Barbarian', 'Wizard', 'Paladin', 'Ranger', 'Druid'],
    );
    expect(result.payload.maxTargets).toBe(6);
    expect(result.payload.healExpression).toBe('2d6 + 3');
    expect(result.payload.slotLevel).toBe(3);
    expect(result.payload.maximize).toBe(false);
    expect(result.payload.bonusHeal).toBe(0);
    expect(result.payload.bonusDetails).toEqual([]);
    // Prayer-of-Healing latch enforcement is off for Mass Healing Word — no round stamp leaks in.
    expect(result.payload).not.toHaveProperty('currentRound');
    expect(resolveHealingBonusesWithDetails).toHaveBeenCalledWith(
      ps,
      expect.objectContaining({ prof: 4, level: 10, slotLevel: 3, campaignName }),
    );
  });

  // ── empty combat: own-composition emptyMessage ────────────────

  it('returns popup error with its own emptyMessage when no creatures in combat', async () => {
    getCombatContext.mockResolvedValue(makeCombatSummary([]));

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    // Full-string own-composition pin: `${spellName}: ${emptyMessage}` config.
    expect(result.payload.description).toBe('Mass Healing Word: No creatures in combat.');
    expect(rollExpression).not.toHaveBeenCalled();
  });

  // ── opener→confirm delegation ─────────────────────────────────

  it('delegates straight to confirm when eligible <= default maxTargets: every eligible name, combat order', async () => {
    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    // 3 eligible <= default max 6: opener routes through the factory confirmFn (whose
    // application behaviour is canonical massCureWounds.confirm / MHW.confirm lanes).
    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('heal_multi');
    expect(result.payload.name).toBe('Mass Healing Word');
    expect(result.payload.formula).toBe('2d6 + 3');
    // Opener-side pin: selectedTargetNames = ALL eligible creatures, combat order.
    expect(result.payload.results.map(r => r.targetName)).toEqual(['Fighter', 'Rogue', 'Barbarian']);
  });
});
