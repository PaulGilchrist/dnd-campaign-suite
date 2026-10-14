import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../combat/automation/automationService.js', () => ({
  evaluateAutoExpression: vi.fn(),
  resolveDiceExpression: vi.fn((expr) => expr),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../common/damageRollback.js', () => ({
  findLastAttack: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../rules/combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './damageReductionHandler.js';
import * as automationService from '../../../combat/automation/automationService.js';
import * as logService from '../../../ui/logService.js';
import * as damageRollback from '../../common/damageRollback.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as applyHealing from '../../../rules/combat/applyHealing.js';
import * as diceRoller from '../../../dice/diceRoller.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'test-campaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestHero',
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Defensive Reaction',
    automation: {
      type: 'damage_reduction',
      ...automation,
    },
  };
}

function setupMocks() {
  automationService.evaluateAutoExpression.mockReturnValue(5);
  diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
  logService.addEntry.mockResolvedValue({});
  damageRollback.findLastAttack.mockResolvedValue({
    attackEvent: { targetName: 'TestHero' },
    targetName: 'TestHero',
    totalDamage: 10,
    damageTypes: ['Slashing'],
  });
  damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });
  applyHealing.applyHealingToTarget.mockResolvedValue({ actualHeal: 5 });
}

// ── Tests ──────────────────────────────────────────────────────

describe('damageReductionHandler - normal damage reduction', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setupMocks();
  });

  describe('normal damage reduction', () => {
    it('evaluates reduction expression and returns popup with result', async () => {
      automationService.evaluateAutoExpression.mockReturnValue(7);
      applyHealing.applyHealingToTarget.mockResolvedValue({ actualHeal: 7 });
      const ps = makePlayerStats();
      const action = makeAction({ reductionExpression: '2d6+1' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('2d6+1 = 7');
      expect(result.payload.automation).toBe(action.automation);
      expect(result.payload.automationType).toBe('damage_reduction');
    });

    it('includes trigger text when auto.trigger is set', async () => {
      automationService.evaluateAutoExpression.mockReturnValue(3);
      applyHealing.applyHealingToTarget.mockResolvedValue({ actualHeal: 3 });
      const ps = makePlayerStats();
      const action = makeAction({ reductionExpression: '1d4', trigger: 'When hit by an attack' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('Trigger: When hit by an attack');
    });

    it('omits trigger text when auto.trigger is not set', async () => {
      automationService.evaluateAutoExpression.mockReturnValue(4);
      applyHealing.applyHealingToTarget.mockResolvedValue({ actualHeal: 4 });
      const ps = makePlayerStats();
      const action = makeAction({ reductionExpression: '1d4' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).not.toContain('Trigger:');
    });

    it('falls back to zero when evaluateAutoExpression returns non-number and rollExpression fails', async () => {
      const nonNumericValues = [null, undefined, ''];
      for (const nonNumericValue of nonNumericValues) {
        vi.resetAllMocks();
        setupMocks();
        automationService.evaluateAutoExpression.mockReturnValue(nonNumericValue);
        diceRoller.rollExpression.mockReturnValue(null);
        applyHealing.applyHealingToTarget.mockResolvedValue({ actualHeal: 0 });
        const ps = makePlayerStats();
        const action = makeAction({ reductionExpression: '2d6+1' });

        const result = await handle(action, ps, campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Deflect roll:</b> 0');
      }
    });

    it('adds log entry with ability_use type', async () => {
      automationService.evaluateAutoExpression.mockReturnValue(5);
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
      applyHealing.applyHealingToTarget.mockResolvedValue({ actualHeal: 5 });
      const ps = makePlayerStats();
      const action = makeAction({ reductionExpression: '2d4' });

      await handle(action, ps, campaignName, null);

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestHero',
        abilityName: 'Defensive Reaction',
        description: 'TestHero used Defensive Reaction to reduce damage by 2d4 = 5 (healed for 5 HP).',
      });
    });

    it('does not throw when addEntry rejects (fire-and-forget logging)', async () => {
      automationService.evaluateAutoExpression.mockReturnValue(5);
      applyHealing.applyHealingToTarget.mockResolvedValue({ actualHeal: 5 });
      const ps = makePlayerStats();
      const action = makeAction({ reductionExpression: '2d6' });
      const testError = new Error('log save failed');
      logService.addEntry.mockImplementation(() => Promise.reject(testError));

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
    });

    // ── Additional coverage: handle early return paths ────────

    it('returns popup when no attackEvent in lastAttack', async () => {
      damageRollback.findLastAttack.mockResolvedValue({
        attackEvent: null,
        targetName: 'TestHero',
        totalDamage: 10,
      });
      const ps = makePlayerStats();
      const action = makeAction({ reductionExpression: '2d6' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No recent attack found');
    });

    it('returns popup when lastAttack targetName does not match player', async () => {
      damageRollback.findLastAttack.mockResolvedValue({
        attackEvent: { targetName: 'OtherPlayer' },
        targetName: 'OtherPlayer',
        totalDamage: 10,
      });
      const ps = makePlayerStats();
      const action = makeAction({ reductionExpression: '2d6' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('The last attack did not target you');
    });

    // ── Trigger matching ──────────────────────────────────────

    describe('trigger matching', () => {
      const triggerTests = [
        { name: 'bludgeoning', damageTypes: ['Bludgeoning'], trigger: 'bludgeoning_piercing_slashing_damage', expectMatch: true },
        { name: 'piercing', damageTypes: ['Piercing'], trigger: 'bludgeoning_piercing_slashing_damage', expectMatch: true },
        { name: 'slashing', damageTypes: ['Slashing'], trigger: 'bludgeoning_piercing_slashing_damage', expectMatch: true },
        { name: 'fire (no match)', damageTypes: ['Fire'], trigger: 'bludgeoning_piercing_slashing_damage', expectMatch: false },
        { name: 'any_damage with damage', damageTypes: [], trigger: 'any_damage', totalDamage: 10, expectMatch: true },
        { name: 'any_damage without damage', damageTypes: [], trigger: 'any_damage', totalDamage: 0, expectMatch: false },
        { name: 'ranged weapon', damageTypes: ['Piercing'], trigger: 'ranged_weapon_attack_hit', weaponType: 'ranged', expectMatch: true },
        { name: 'melee weapon (no match)', damageTypes: ['Slashing'], trigger: 'ranged_weapon_attack_hit', weaponType: 'melee', expectMatch: false },
        { name: 'no trigger', damageTypes: ['Fire'], trigger: undefined, expectMatch: true },
      ];

      for (const tt of triggerTests) {
        it(`matches ${tt.name}`, async () => {
          const lastAttack = {
            attackEvent: { targetName: 'TestHero', ...(tt.weaponType ? { weaponType: tt.weaponType } : {}) },
            targetName: 'TestHero',
            totalDamage: tt.totalDamage ?? 10,
            damageTypes: tt.damageTypes,
          };
          damageRollback.findLastAttack.mockResolvedValue(lastAttack);
          automationService.evaluateAutoExpression.mockReturnValue(5);
          applyHealing.applyHealingToTarget.mockResolvedValue({ actualHeal: 5 });

          const ps = makePlayerStats();
          const action = makeAction({ reductionExpression: '1d4', trigger: tt.trigger });

          const result = await handle(action, ps, campaignName, null);

          if (tt.expectMatch) {
            expect(result.payload.description).toContain('Reduce damage by');
          } else {
            expect(result.payload.description).toContain('does not match the trigger condition');
          }
        });
      }
    });

    // ── rollReductionExpression edge cases ────────────────────

    describe('rollReductionExpression', () => {
      it('returns zero when no reductionExpression is provided', async () => {
        damageRollback.findLastAttack.mockResolvedValue({
          attackEvent: { targetName: 'TestHero' },
          targetName: 'TestHero',
          totalDamage: 10,
          damageTypes: ['Slashing'],
        });
        applyHealing.applyHealingToTarget.mockResolvedValue({ actualHeal: 0 });
        const ps = makePlayerStats();
        const action = makeAction({});

        const result = await handle(action, ps, campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Deflect roll:</b> 0');
      });

      it('uses dice expression path when evaluateAutoExpression returns non-number', async () => {
        automationService.evaluateAutoExpression.mockReturnValue('2d6');
        diceRoller.rollExpression.mockReturnValue({ total: 7, rolls: [3, 4] });
        applyHealing.applyHealingToTarget.mockResolvedValue({ actualHeal: 7 });
        const ps = makePlayerStats();
        const action = makeAction({ reductionExpression: '2d6' });

        const result = await handle(action, ps, campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('2d6 = 7');
      });
    });

    // ── Edge cases for helper functions ───────────────────────

    describe('helper function edge cases', () => {
      it('handles non-string items in equipped array gracefully', async () => {
        damageRollback.findLastAttack.mockResolvedValue({
          attackEvent: { targetName: 'TestHero' },
          targetName: 'TestHero',
          totalDamage: 10,
          damageTypes: ['Slashing'],
        });
        const ps = makePlayerStats({
          inventory: { equipped: [null, 42, 'Shield'] },
          equipment: [{ name: 'Shield', armor_category: 'Shield' }],
        });
        const action = makeAction({ requiresShield: true, reductionExpression: '2d6' });

        const result = await handle(action, ps, campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Reduce damage by');
      });

      it('handles playerStats with no class_levels for getMonkLevel', async () => {
        automationService.evaluateAutoExpression.mockReturnValue(5);
        damageRollback.findLastAttack.mockResolvedValue({
          attackEvent: { targetName: 'TestHero' },
          targetName: 'TestHero',
          totalDamage: 10,
          damageTypes: ['Slashing'],
        });
        applyHealing.applyHealingToTarget.mockResolvedValue({ actualHeal: 5 });
        const ps = makePlayerStats({ class: {} });
        const action = makeAction({ reductionExpression: '2d6' });

        const result = await handle(action, ps, campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Reduce damage by');
      });
    });
  });
});
