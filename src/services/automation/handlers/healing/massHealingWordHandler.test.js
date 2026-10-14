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
  hasHealingMaximization: vi.fn(),
  hasHealingMaximizationForTarget: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './massHealingWordHandler.js';
import { rollExpression, rollExpressionMaximized } from '../../../dice/diceRoller.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { applyHealingToTarget } from '../../../rules/combat/applyHealing.js';
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

function makeAction(overrides = {}) {
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
      ...overrides.spell,
    },
    automation: { type: 'mass_healing_word', ...overrides.automation },
    ...overrides,
  };
}

function makeCombatSummary(creatures) {
  return {
    players: [{ name: 'TestCleric', gridX: 1, gridY: 1 }],
    creatures,
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('massHealingWordHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rollExpression.mockReturnValue({ total: 12, rolls: [5, 4, 3], modifier: 0 });
    rollExpressionMaximized.mockReturnValue({ total: 18, rolls: [6, 6, 6], modifier: 0 });
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
    applyHealingToTarget.mockReturnValue({ actualHeal: 12, oldHp: 20, newHp: 32 });
  });

  // ── getSpellCastingMod ──────────────────────────────────────

  describe('spell casting modifier resolution', () => {
    it('uses spell.spellCastingAbility when present on the spell', async () => {
      const action = {
        ...makeAction(),
        spell: {
          ...makeAction().spell,
          spellCastingAbility: 'Charisma',
          level: 3,
        },
      };
      const ps = makePlayerStats({
        abilities: [
          { name: 'Wisdom', bonus: 3 },
          { name: 'Charisma', bonus: 5 },
        ],
      });

      await handle(action, ps, campaignName, null);

      expect(rollExpression).toHaveBeenCalledWith('2d6 + 5');
    });

    it('falls back to playerStats.spellAbilities.modifier when spell has no casting ability', async () => {
      const action = makeAction();
      const ps = makePlayerStats({
        spellAbilities: { modifier: 4 },
        abilities: [{ name: 'Wisdom', bonus: 3 }],
      });

      await handle(action, ps, campaignName, null);

      expect(rollExpression).toHaveBeenCalledWith('2d6 + 4');
    });

    it('returns 0 when no spell casting ability is available', async () => {
      const action = makeAction();
      const ps = makePlayerStats({
        abilities: [],
        spellAbilities: undefined,
      });

      await handle(action, ps, campaignName, null);

      expect(rollExpression).toHaveBeenCalledWith('2d6 + 0');
    });

    it('returns 0 when spellCastingAbility does not match any ability', async () => {
      const action = {
        ...makeAction(),
        spell: {
          ...makeAction().spell,
          spellCastingAbility: 'Charisma',
        },
      };
      const ps = makePlayerStats({
        abilities: [{ name: 'Wisdom', bonus: 3 }],
        spellAbilities: undefined,
      });

      await handle(action, ps, campaignName, null);

      expect(rollExpression).toHaveBeenCalledWith('2d6 + 0');
    });

    it('uses spellCastingAbility from playerStats.spellAbilities when spell has no casting ability', async () => {
      const action = makeAction();
      const ps = makePlayerStats({
        spellAbilities: { spellCastingAbility: 'Charisma', modifier: 5 },
        abilities: [
          { name: 'Wisdom', bonus: 3 },
          { name: 'Charisma', bonus: 5 },
        ],
      });

      await handle(action, ps, campaignName, null);

      expect(rollExpression).toHaveBeenCalledWith('2d6 + 5');
    });
  });

  // ── resolveHealExpression ───────────────────────────────────

  describe('heal expression resolution', () => {
    it('uses heal_at_slot_level for the exact slot level', async () => {
      const action = { ...makeAction(), automation: { slotLevel: 3 } };
      await handle(action, makePlayerStats(), campaignName, null);
      expect(rollExpression).toHaveBeenCalledWith('2d6 + 3');
    });

    it('uses higher slot level expression when slot is higher', async () => {
      const action = {
        ...makeAction(),
        automation: { type: 'mass_healing_word', slotLevel: 5 },
      };
      await handle(action, makePlayerStats(), campaignName, null);
      expect(rollExpression).toHaveBeenCalledWith('4d6 + 3');
    });

    it('finds highest available slot below requested level', async () => {
      const action = {
        ...makeAction(),
        spell: {
          name: 'Mass Healing Word',
          level: 9,
          heal_at_slot_level: { '3': '2d6 + MOD' },
        },
      };
      await handle(action, makePlayerStats(), campaignName, null);
      expect(rollExpression).toHaveBeenCalledWith('2d6 + 3');
    });

    it('falls back to spell level when no heal_at_slot_level exists', async () => {
      const action = {
        ...makeAction(),
        spell: { name: 'Mass Healing Word', level: 3 },
      };
      const result = await handle(action, makePlayerStats(), campaignName, null);
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('Could not resolve heal expression');
    });

    it('uses slotLevel from automation over spell level', async () => {
      const action = {
        ...makeAction(),
        automation: { type: 'mass_healing_word', slotLevel: 7 },
      };
      await handle(action, makePlayerStats(), campaignName, null);
      expect(rollExpression).toHaveBeenCalledWith('6d6 + 3');
    });

    it('defaults to spell level 3 when no automation slotLevel', async () => {
      const action = makeAction();
      await handle(action, makePlayerStats(), campaignName, null);
      expect(rollExpression).toHaveBeenCalledWith('2d6 + 3');
    });
  });

  // ── handle: maxTargets ──────────────────────────────────────

  describe('maxTargets handling', () => {
    it('defaults maxTargets to 6 when not specified', async () => {
      const action = makeAction();
      const result = await handle(action, makePlayerStats(), campaignName, null);
      // With 3 creatures and default maxTargets=6: eligible <= maxTargets, so popup (confirm path)
      expect(result.type).toBe('popup');
    });

    it('uses maxTargets from automation config in confirm path', async () => {
      const action = {
        ...makeAction(),
        automation: { type: 'mass_healing_word', maxTargets: 4 },
      };
      const result = await handle(action, makePlayerStats(), campaignName, null);
      // 3 creatures <= 4 maxTargets -> popup (confirm path)
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('heal_multi');
    });
  });

  // ── handle: return types ────────────────────────────────────

  describe('handle return types', () => {
    it('returns modal when there are more eligible creatures than maxTargets', async () => {
      getCombatContext.mockResolvedValue(
        makeCombatSummary([
          { name: 'Fighter', maxHp: 45, currentHp: 20, type: 'player' },
          { name: 'Rogue', maxHp: 30, currentHp: 10, type: 'player' },
          { name: 'Barbarian', maxHp: 60, currentHp: 30, type: 'npc' },
          { name: 'Wizard', maxHp: 25, currentHp: 15, type: 'player' },
          { name: 'Paladin', maxHp: 50, currentHp: 25, type: 'player' },
          { name: 'Ranger', maxHp: 40, currentHp: 20, type: 'npc' },
          { name: 'Druid', maxHp: 35, currentHp: 10, type: 'npc' },
        ]),
      );
      const action = {
        ...makeAction(),
        automation: { type: 'mass_healing_word', maxTargets: 3 },
      };
      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('massHealingWordTarget');
      expect(result.payload.creatureTargets).toEqual([
        'Fighter', 'Rogue', 'Barbarian', 'Wizard', 'Paladin', 'Ranger', 'Druid',
      ]);
    });

    it('returns confirmMassHealingWord when eligible creatures <= maxTargets', async () => {
      const action = makeAction({ maxTargets: 10 });
      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('heal_multi');
    });

    it('returns popup error when no creatures in combat', async () => {
      getCombatContext.mockResolvedValue(makeCombatSummary([]));
      const action = makeAction();
      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No creatures in combat');
    });

    it('returns null when combat context is null', async () => {
      getCombatContext.mockResolvedValue(null);
      const action = makeAction();
      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result).toBeNull();
    });

    it('filters out creatures without names', async () => {
      getCombatContext.mockResolvedValue(
        makeCombatSummary([
          { name: 'Fighter', maxHp: 45, currentHp: 20, type: 'player' },
          { maxHp: 30, currentHp: 10, type: 'npc' },
          { name: 'Barbarian', maxHp: 60, currentHp: 30, type: 'npc' },
        ]),
      );
      const action = makeAction({ maxTargets: 10 });
      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('heal_multi');
    });

    it('returns popup error when heal expression cannot be resolved', async () => {
      const action = {
        ...makeAction(),
        spell: { name: 'Mass Healing Word', level: 3 },
      };
      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('Could not resolve heal expression');
    });
  });

  // ── handle: payload contents (modal path) ───────────────────

  describe('handle modal payload contents', () => {
    it('includes all required fields in modal payload', async () => {
      getCombatContext.mockResolvedValue(
        makeCombatSummary([
          { name: 'Fighter', maxHp: 45, currentHp: 20, type: 'player' },
          { name: 'Rogue', maxHp: 30, currentHp: 10, type: 'player' },
          { name: 'Barbarian', maxHp: 60, currentHp: 30, type: 'npc' },
          { name: 'Wizard', maxHp: 25, currentHp: 15, type: 'player' },
        ]),
      );
      const action = {
        ...makeAction(),
        automation: { type: 'mass_healing_word', maxTargets: 3 },
      };
      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.payload.action).toBe(action);
      expect(result.payload.playerStats).toBeDefined();
      expect(result.payload.campaignName).toBe(campaignName);
      expect(result.payload.creatureTargets).toEqual(['Fighter', 'Rogue', 'Barbarian', 'Wizard']);
      expect(result.payload.maxTargets).toBe(3);
      expect(result.payload.healExpression).toBe('2d6 + 3');
      expect(result.payload.maximize).toBe(false);
      expect(result.payload.bonusHeal).toBe(0);
      expect(result.payload.bonusDetails).toEqual([]);
      expect(result.payload.slotLevel).toBe(3);
    });
  });

  // ── Integration: handle → confirm flow (few targets) ────────

  describe('handle → confirm flow (few targets)', () => {
    it('returns popup directly when eligible creatures <= maxTargets', async () => {
      const action = makeAction({ maxTargets: 10 });
      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('heal_multi');
    });

    it('returns modal when eligible creatures > maxTargets', async () => {
      getCombatContext.mockResolvedValue(
        makeCombatSummary([
          { name: 'Fighter', maxHp: 45, currentHp: 20, type: 'player' },
          { name: 'Rogue', maxHp: 30, currentHp: 10, type: 'player' },
          { name: 'Barbarian', maxHp: 60, currentHp: 30, type: 'npc' },
          { name: 'Wizard', maxHp: 25, currentHp: 15, type: 'player' },
        ]),
      );
      const action = {
        ...makeAction(),
        automation: { type: 'mass_healing_word', maxTargets: 3 },
      };
      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('massHealingWordTarget');
    });

    it('returns popup when exactly maxTargets creatures exist', async () => {
      getCombatContext.mockResolvedValue(
        makeCombatSummary([
          { name: 'Fighter', maxHp: 45, currentHp: 20, type: 'player' },
          { name: 'Rogue', maxHp: 30, currentHp: 10, type: 'player' },
          { name: 'Barbarian', maxHp: 60, currentHp: 30, type: 'npc' },
        ]),
      );
      const action = {
        ...makeAction(),
        automation: { type: 'mass_healing_word', maxTargets: 3 },
      };
      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('heal_multi');
    });
  });
});
