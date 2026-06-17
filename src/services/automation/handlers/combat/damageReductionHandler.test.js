import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../combat/automation/automationService.js', () => ({
  evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
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

// ── Tests ──────────────────────────────────────────────────────

describe('damageReductionHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Shield requirement', () => {
    it('should return popup when requiresShield and player has no shield', async () => {
      const ps = makePlayerStats({ inventory: { equipped: [] } });
      const action = makeAction({ requiresShield: true, reductionExpression: '2d6' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('holding a Shield');
    });

    it('should proceed when requiresShield and player has a shield', async () => {
      automationService.evaluateAutoExpression.mockReturnValue(5);
      const ps = makePlayerStats({
        inventory: { equipped: ['Shield'] },
        equipment: [{ name: 'Shield', equipment_category: 'Shield' }],
      });
      const action = makeAction({ requiresShield: true, reductionExpression: '2d6' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('Reduce damage by');
    });
  });

  describe('Shield or weapon requirement', () => {
    it('should return popup when requiresShieldOrWeapon and no shield/weapon equipped', async () => {
      const ps = makePlayerStats({ inventory: { equipped: ['Leather Armor'] } });
      const action = makeAction({ requiresShieldOrWeapon: true, reductionExpression: '2d6' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('holding a Shield or a Simple or Martial weapon');
    });

    it('should proceed when requiresShieldOrWeapon and player has a weapon', async () => {
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
  });

  describe('Zero on success / half on fail effect', () => {
    it('should call handleZeroOnSuccessHalfOnFail when effect matches', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        effect: 'zero_on_success_half_on_fail',
        requiresShield: false,
      });

      runtimeState.getRuntimeValue.mockReturnValue(true);

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
  });

  describe('Normal damage reduction', () => {
    it('should evaluate reduction expression and return popup', async () => {
      automationService.evaluateAutoExpression.mockReturnValue(7);
      const ps = makePlayerStats();
      const action = makeAction({ reductionExpression: '2d6+1' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('Reduce damage by <strong>7</strong>');
    });

    it('should include trigger text when auto.trigger is set', async () => {
      automationService.evaluateAutoExpression.mockReturnValue(3);
      const ps = makePlayerStats();
      const action = makeAction({ reductionExpression: '1d4', trigger: 'When hit by an attack' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('Trigger: When hit by an attack');
    });

    it('should use string reduction when evaluateAutoExpression returns non-number', async () => {
      automationService.evaluateAutoExpression.mockReturnValue(null);
      const ps = makePlayerStats();
      const action = makeAction({ reductionExpression: '2d6+1' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('2d6+1');
    });

    it('should add log entry with ability_use type', async () => {
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
  });
});
