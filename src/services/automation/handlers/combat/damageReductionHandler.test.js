// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../combat/automation/automationService.js', () => ({
  evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './damageReductionHandler.js';
import * as automationService from '../../../combat/automation/automationService.js';
import * as logService from '../../../ui/logService.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

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
  logService.addEntry.mockResolvedValue({});
}

// ── Tests ──────────────────────────────────────────────────────

describe('damageReductionHandler', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setupMocks();
  });

  // ── Shield requirement ──────────────────────────────────────

  describe('requiresShield', () => {
    it('returns popup with shield message when player has no shield', async () => {
      const ps = makePlayerStats({ inventory: { equipped: [] } });
      const action = makeAction({ requiresShield: true, reductionExpression: '2d6' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('holding a Shield');
      expect(result.payload.automation).toBe(action.automation);
      expect(result.payload.automationType).toBe('damage_reduction');
    });

    it('proceeds when player has a shield equipped', async () => {
      automationService.evaluateAutoExpression.mockReturnValue(5);
      const ps = makePlayerStats({
        inventory: { equipped: ['Shield'] },
        equipment: [{ name: 'Shield', armor_category: 'Shield' }],
      });
      const action = makeAction({ requiresShield: true, reductionExpression: '2d6' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Reduce damage by');
    });

    it('proceeds when player has a magic shield equipped', async () => {
      automationService.evaluateAutoExpression.mockReturnValue(5);
      const ps = makePlayerStats({
        inventory: { equipped: ['+2 Shield'] },
        equipment: [{ name: 'Shield', armor_category: 'Shield' }],
      });
      const action = makeAction({ requiresShield: true, reductionExpression: '2d6' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Reduce damage by');
    });

    it('does not proceed when player only has a weapon (no shield)', async () => {
      const ps = makePlayerStats({
        inventory: { equipped: ['Longsword'] },
        equipment: [{ name: 'Longsword', equipment_category: 'Weapon' }],
      });
      const action = makeAction({ requiresShield: true, reductionExpression: '2d6' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('holding a Shield');
    });
  });

  // ── Shield or weapon requirement ────────────────────────────

  describe('requiresShieldOrWeapon', () => {
    it('returns popup when player has no shield or weapon', async () => {
      const ps = makePlayerStats({ inventory: { equipped: ['Leather Armor'] } });
      const action = makeAction({ requiresShieldOrWeapon: true, reductionExpression: '2d6' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('holding a Shield or a Simple or Martial weapon');
    });

    it('proceeds when player has a weapon equipped', async () => {
      automationService.evaluateAutoExpression.mockReturnValue(5);
      const ps = makePlayerStats({
        inventory: { equipped: ['Longsword'] },
        equipment: [{ name: 'Longsword', equipment_category: 'Weapon' }],
      });
      const action = makeAction({ requiresShieldOrWeapon: true, reductionExpression: '2d6' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Reduce damage by');
    });

    it('proceeds when player has a shield equipped', async () => {
      automationService.evaluateAutoExpression.mockReturnValue(5);
      const ps = makePlayerStats({
        inventory: { equipped: ['Shield'] },
        equipment: [{ name: 'Shield', armor_category: 'Shield' }],
      });
      const action = makeAction({ requiresShieldOrWeapon: true, reductionExpression: '2d6' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Reduce damage by');
    });

    it('proceeds when player has a magic weapon equipped', async () => {
      automationService.evaluateAutoExpression.mockReturnValue(5);
      const ps = makePlayerStats({
        inventory: { equipped: ['+1 Longsword'] },
        equipment: [{ name: 'Longsword', equipment_category: 'Weapon' }],
      });
      const action = makeAction({ requiresShieldOrWeapon: true, reductionExpression: '2d6' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Reduce damage by');
    });
  });

  // ── requiresShield checked before requiresShieldOrWeapon ────

  describe('requirement priority', () => {
    it('requiresShield blocks even when requiresShieldOrWeapon would pass', async () => {
      const ps = makePlayerStats({
        inventory: { equipped: ['Longsword'] },
        equipment: [{ name: 'Longsword', equipment_category: 'Weapon' }],
      });
      const action = makeAction({
        requiresShield: true,
        requiresShieldOrWeapon: true,
        reductionExpression: '2d6',
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('holding a Shield');
      expect(result.payload.description).not.toContain('Shield or a Simple or Martial weapon');
    });
  });

  // ── zero_on_success_half_on_fail effect ─────────────────────

  describe('zero_on_success_half_on_fail effect', () => {
    it('sets interveneShieldActive runtime value', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        effect: 'zero_on_success_half_on_fail',
        requiresShield: false,
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('activated');
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestHero',
        'interveneShieldActive',
        true,
        campaignName,
      );
    });

    it('returns popup with correct description for zero_on_success_half_on_fail', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        effect: 'zero_on_success_half_on_fail',
        requiresShield: false,
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Defensive Reaction');
      expect(result.payload.automationType).toBe('damage_reduction');
      expect(result.payload.description).toBe(
        'Defensive Reaction activated. The next time you would take damage from an effect that allows a Dexterity saving throw for half damage, you take no damage on a successful save and half damage on a failed save.',
      );
    });

    it('does not throw when addEntry rejects (fire-and-forget logging)', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        effect: 'zero_on_success_half_on_fail',
        requiresShield: false,
      });
      const testError = new Error('log save failed');
      logService.addEntry.mockRejectedValue(testError);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
    });

    it('does not proceed with zero_on_success_half_on_fail when requiresShield is true and player lacks shield', async () => {
      const ps = makePlayerStats({ inventory: { equipped: [] } });
      const action = makeAction({
        effect: 'zero_on_success_half_on_fail',
        requiresShield: true,
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('holding a Shield');
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  // ── Normal damage reduction ─────────────────────────────────

  describe('normal damage reduction', () => {
    it('evaluates reduction expression and returns popup with result', async () => {
      automationService.evaluateAutoExpression.mockReturnValue(7);
      const ps = makePlayerStats();
      const action = makeAction({ reductionExpression: '2d6+1' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('Reduce damage by <strong>7</strong>');
      expect(result.payload.automation).toBe(action.automation);
      expect(result.payload.automationType).toBe('damage_reduction');
    });

    it('includes trigger text when auto.trigger is set', async () => {
      automationService.evaluateAutoExpression.mockReturnValue(3);
      const ps = makePlayerStats();
      const action = makeAction({ reductionExpression: '1d4', trigger: 'When hit by an attack' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('Trigger: When hit by an attack');
    });

    it('omits trigger text when auto.trigger is not set', async () => {
      automationService.evaluateAutoExpression.mockReturnValue(4);
      const ps = makePlayerStats();
      const action = makeAction({ reductionExpression: '1d4' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).not.toContain('Trigger:');
    });

    it('falls back to string expression when evaluateAutoExpression returns non-number', async () => {
      const nonNumericValues = [null, undefined, ''];
      for (const nonNumericValue of nonNumericValues) {
        vi.resetAllMocks();
        setupMocks();
        automationService.evaluateAutoExpression.mockReturnValue(nonNumericValue);
        const ps = makePlayerStats();
        const action = makeAction({ reductionExpression: '2d6+1' });

        const result = await handle(action, ps, campaignName, null);

        expect(result.payload.description).toContain('2d6+1');
      }
    });

    it('adds log entry with ability_use type', async () => {
      automationService.evaluateAutoExpression.mockReturnValue(5);
      const ps = makePlayerStats();
      const action = makeAction({ reductionExpression: '2d4' });

      await handle(action, ps, campaignName, null);

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestHero',
        abilityName: 'Defensive Reaction',
        description: 'TestHero used Defensive Reaction to reduce damage by 5.',
      });
    });

    it('uses correct character and ability names in log entry', async () => {
      automationService.evaluateAutoExpression.mockReturnValue(2);
      const ps = makePlayerStats({ name: 'ElvenRogue' });
      const action = {
        name: 'Armor of Agathys',
        automation: { type: 'damage_reduction', reductionExpression: '1d4' },
      };

      await handle(action, ps, campaignName, null);

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'ElvenRogue',
        abilityName: 'Armor of Agathys',
        description: 'ElvenRogue used Armor of Agathys to reduce damage by 2.',
      });
    });

    it('propagates error when addEntry rejects', async () => {
      automationService.evaluateAutoExpression.mockReturnValue(5);
      const ps = makePlayerStats();
      const action = makeAction({ reductionExpression: '2d6' });
      const testError = new Error('log save failed');
      logService.addEntry.mockRejectedValue(testError);

      await expect(handle(action, ps, campaignName, null)).rejects.toThrow('log save failed');
    });
  });
});
