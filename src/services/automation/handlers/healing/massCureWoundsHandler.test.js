// @maintained-by-ai
// Opener lane of the massCureWounds pair: sibling massCureWoundsHandler.confirm.test.js owns
// confirmMassCureWounds() application behaviour (clamp/apply, maxTargets slicing, hp_change
// logging, heal_multi payload internals, maximization rolls). This file owns handle() in
// massHealUtils.createMassHealHandler: casting-mod + heal-expression resolution, modal-vs-popup
// routing (maxTargets default and override), unnamed-creature eligibility filtering, modal
// payload composition, and the opener→confirm handoff (all eligible names, combat order).
// massHealUtils internals are shared with massHealingWordHandler (#1820-1822) — those pins
// live in that lane via its own spell config; the prayerOfHealing latch stays byte-inert
// here (oncePerLongRest unset for Mass Cure Wounds) and is owned by the prayerOfHealing lane.
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

import { handle } from './massCureWoundsHandler.js';
import { rollExpression, rollExpressionMaximized } from '../../../dice/diceRoller.js';
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
    name: 'Mass Cure Wounds',
    spell: {
      name: 'Mass Cure Wounds',
      level: 5,
      heal_at_slot_level: {
        '5': '3d8 + MOD',
        '6': '4d8 + MOD',
        '7': '5d8 + MOD',
        '8': '6d8 + MOD',
        '9': '7d8 + MOD',
      },
      ...spellOverrides,
    },
    automation: { type: 'mass_cure_wounds', ...automationOverrides },
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

describe('massCureWoundsHandler handle() opener', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rollExpression.mockReturnValue({ total: 18, rolls: [6, 7, 5], modifier: 0 });
    rollExpressionMaximized.mockReturnValue({ total: 24, rolls: [8, 8, 8], modifier: 0 });
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
  });

  // ── getSpellCastingMod (via handle) ─────────────────────────

  describe('spell casting modifier resolution', () => {
    it('uses spell.spellCastingAbility when present on the spell', async () => {
      const action = makeAction({ spell: { spellCastingAbility: 'Intelligence' } });
      const ps = makePlayerStats({
        abilities: [
          { name: 'Wisdom', bonus: 3 },
          { name: 'Intelligence', bonus: 5 },
        ],
      });

      await handle(action, ps, campaignName, null);

      expect(rollExpression).toHaveBeenCalledWith('3d8 + 5');
    });

    it('falls back to playerStats.spellAbilities.modifier when spell has no casting ability', async () => {
      const ps = makePlayerStats({ spellAbilities: { modifier: 4 } });

      await handle(makeAction(), ps, campaignName, null);

      expect(rollExpression).toHaveBeenCalledWith('3d8 + 4');
    });

    it('returns 0 when spellCastingAbility does not match any ability', async () => {
      const action = makeAction({ spell: { spellCastingAbility: 'Charisma' } });
      const ps = makePlayerStats({
        abilities: [{ name: 'Wisdom', bonus: 3 }],
        spellAbilities: undefined,
      });

      await handle(action, ps, campaignName, null);

      expect(rollExpression).toHaveBeenCalledWith('3d8 + 0');
    });

    it('returns 0 when no spell casting ability is available', async () => {
      const ps = makePlayerStats({ abilities: [], spellAbilities: undefined });

      await handle(makeAction(), ps, campaignName, null);

      expect(rollExpression).toHaveBeenCalledWith('3d8 + 0');
    });
  });

  // ── resolveHealExpression / resolveSlotLevel ────────────────

  describe('heal expression resolution', () => {
    it('uses heal_at_slot_level for the exact slot level', async () => {
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(rollExpression).toHaveBeenCalledWith('3d8 + 3');
    });

    it('uses automation.slotLevel over spell.level and the higher slot expression', async () => {
      const action = makeAction({ automation: { slotLevel: 8 } });
      await handle(action, makePlayerStats(), campaignName, null);
      expect(rollExpression).toHaveBeenCalledWith('6d8 + 3');
    });

    it('falls back to highest available slot below requested level', async () => {
      const action = makeAction({
        spell: { level: 9, heal_at_slot_level: { '5': '3d8 + MOD' } },
      });
      await handle(action, makePlayerStats(), campaignName, null);
      expect(rollExpression).toHaveBeenCalledWith('3d8 + 3');
    });

    it('defaults to slot level 5 when neither automation nor spell carries a level', async () => {
      // Built inline: defaultSlotLevel=5 only distinguishes itself when spell.level is absent.
      const action = {
        name: 'Mass Cure Wounds',
        spell: { name: 'Mass Cure Wounds', heal_at_slot_level: { '5': '3d8 + MOD' } },
        automation: { type: 'mass_cure_wounds' },
      };
      await handle(action, makePlayerStats(), campaignName, null);
      expect(rollExpression).toHaveBeenCalledWith('3d8 + 3');
    });

    it('returns popup error when no heal_at_slot_level exists', async () => {
      const action = makeAction({ spell: { heal_at_slot_level: undefined } });
      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe('Mass Cure Wounds: Could not resolve heal expression.');
    });
  });

  // ── maxTargets routing ──────────────────────────────────────

  describe('maxTargets routing', () => {
    it('routes popup directly when eligible <= maxTargets, handing every eligible name to confirm in combat order', async () => {
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('heal_multi');
      expect(result.payload.name).toBe('Mass Cure Wounds');
      expect(result.payload.formula).toBe('3d8 + 3');
      // Opener-side pin: selectedTargetNames = ALL eligible creatures, combat order.
      expect(result.payload.results.map(r => r.targetName)).toEqual(['Fighter', 'Rogue', 'Barbarian']);
    });

    it('uses automation.maxTargets override to widen routing past the default of 6', async () => {
      getCombatContext.mockResolvedValue(makeCombatSummary(sevenCreatures()));
      const action = makeAction({ automation: { maxTargets: 7 } });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      // 7 eligible: default maxTargets 6 would route to modal — automation config routes popup.
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('heal_multi');
      expect(result.payload.results).toHaveLength(7);
    });

    it('defaults maxTargets to 6 and routes to modal when eligible exceed it', async () => {
      getCombatContext.mockResolvedValue(makeCombatSummary(sevenCreatures()));

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('massCureWoundsTarget');
      expect(result.payload.maxTargets).toBe(6);
      expect(result.payload.creatureTargets).toEqual(
        ['Fighter', 'Rogue', 'Barbarian', 'Wizard', 'Paladin', 'Ranger', 'Druid'],
      );
    });
  });

  // ── modal payload contents ──────────────────────────────────

  describe('modal payload contents', () => {
    it('includes all required fields and calls bonus resolution with the slot level', async () => {
      getCombatContext.mockResolvedValue(
        makeCombatSummary([
          ...sevenCreatures().slice(0, 3),
          { name: 'Wizard', maxHp: 25, currentHp: 15, type: 'player' },
        ]),
      );
      const action = makeAction({ automation: { maxTargets: 3 } });
      const ps = makePlayerStats();

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.payload.action).toBe(action);
      expect(result.payload.playerStats).toBe(ps);
      expect(result.payload.campaignName).toBe(campaignName);
      expect(result.payload.creatureTargets).toEqual(['Fighter', 'Rogue', 'Barbarian', 'Wizard']);
      expect(result.payload.maxTargets).toBe(3);
      expect(result.payload.healExpression).toBe('3d8 + 3');
      expect(result.payload.maximize).toBe(false);
      expect(result.payload.bonusHeal).toBe(0);
      expect(result.payload.bonusDetails).toEqual([]);
      expect(result.payload.slotLevel).toBe(5);
      // Prayer-of-Healing latch enforcement is off for Mass Cure Wounds — no round stamp leaks in.
      expect(result.payload).not.toHaveProperty('currentRound');
      expect(resolveHealingBonusesWithDetails).toHaveBeenCalledWith(
        ps,
        expect.objectContaining({ prof: 4, level: 10, slotLevel: 5, campaignName }),
      );
    });

    it('propagates maximization and bonus healing flags from automationService into the modal payload', async () => {
      hasHealingMaximization.mockReturnValue(true);
      resolveHealingBonusesWithDetails.mockReturnValue({
        totalBonus: 5,
        details: [{ name: 'Disciple of Life', amount: 5 }],
      });
      getCombatContext.mockResolvedValue(makeCombatSummary(sevenCreatures()));

      const result = await handle(makeAction({ automation: { maxTargets: 3 } }), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.payload.maximize).toBe(true);
      expect(result.payload.bonusHeal).toBe(5);
      expect(result.payload.bonusDetails).toEqual([{ name: 'Disciple of Life', amount: 5 }]);
    });
  });

  // ── guard paths ─────────────────────────────────────────────

  describe('guard paths', () => {
    it('returns null when combat context is null', async () => {
      getCombatContext.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result).toBeNull();
    });

    it('returns popup error when no creatures in combat', async () => {
      getCombatContext.mockResolvedValue(makeCombatSummary([]));

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      // Full-string own-composition pin: `${spellName}: ${emptyMessage}` config.
      expect(result.payload.description).toBe('Mass Cure Wounds: No creatures in combat.');
    });

    it('filters unnamed creatures out of eligibility', async () => {
      getCombatContext.mockResolvedValue(
        makeCombatSummary([
          ...sevenCreatures().slice(0, 6),
          { maxHp: 30, currentHp: 10, type: 'npc' },
          { maxHp: 20, currentHp: 5, type: 'player' },
        ]),
      );

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      // 8 raw entries over default max 6 would force modal; 6 named eligible routes popup.
      expect(result.type).toBe('popup');
      expect(result.payload.results.map(r => r.targetName)).toEqual([
        'Fighter', 'Rogue', 'Barbarian', 'Wizard', 'Paladin', 'Ranger',
      ]);
    });
  });
});
