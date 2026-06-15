import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../common/buffToggle.js', () => ({
  toggleBuff: vi.fn(),
}));

vi.mock('../class-warlock/tempTeleportHandler.js', () => ({
  handle: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

vi.mock('../../../combat/automationService.js', () => ({
  evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../../../hooks/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './buffHandler.js';
import * as buffToggle from '../../common/buffToggle.js';
import * as tempTeleportHandler from '../class-warlock/tempTeleportHandler.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as combatData from '../../../encounters/combatData.js';
import * as automationService from '../../../combat/automationService.js';
import * as runtimeState from '../../../../hooks/useRuntimeState.js';

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
    name: 'Test Buff',
    automation: {
      type: 'buff',
      ...automation,
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('buffHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Teleport effects delegation', () => {
    it('should delegate to handleTeleport when auto.effect === teleport_on_rage', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'teleport_on_rage' });
      tempTeleportHandler.handle.mockReturnValue({ type: 'popup', payload: {} });

      const result = await handle(action, ps, campaignName, null);

      expect(tempTeleportHandler.handle).toHaveBeenCalledWith(action, ps, campaignName, null);
      expect(result).toEqual({ type: 'popup', payload: {} });
    });

    it('should delegate to handleTeleport when auto.effect === teleport_swap_with_illusion', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'teleport_swap_with_illusion' });
      tempTeleportHandler.handle.mockReturnValue({ type: 'popup', payload: {} });

      const result = await handle(action, ps, campaignName, null);

      expect(tempTeleportHandler.handle).toHaveBeenCalledWith(action, ps, campaignName, null);
      expect(result).toEqual({ type: 'popup', payload: {} });
    });
  });

  describe('Target resolution', () => {
    it('should use playerStats.name as targetName when auto.target is not willing_creature', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ target: 'self' });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
        ps.name,
        action.name,
        action.automation,
        campaignName,
        ps.name
      );
    });

    it('should use target name from getTargetFromAttacker when auto.target === willing_creature and combatSummary exists', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ target: 'willing_creature' });
      combatData.getCombatSummary.mockReturnValue({ enemies: [] });
      damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'AllyTarget' });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
        ps.name,
        action.name,
        action.automation,
        campaignName,
        'AllyTarget'
      );
    });

    it('should use playerStats.name when auto.target === willing_creature but no combatSummary', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ target: 'willing_creature' });
      combatData.getCombatSummary.mockReturnValue(null);
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
        ps.name,
        action.name,
        action.automation,
        campaignName,
        ps.name
      );
    });

    it('should use playerStats.name when auto.target === willing_creature but getTargetFromAttacker returns null', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ target: 'willing_creature' });
      combatData.getCombatSummary.mockReturnValue({ enemies: [] });
      damageUtils.getTargetFromAttacker.mockReturnValue(null);
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
        ps.name,
        action.name,
        action.automation,
        campaignName,
        ps.name
      );
    });
  });

  describe('Buff toggling', () => {
    it('should call toggleBuff with correct arguments', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ type: 'buff' });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
        ps.name,
        action.name,
        action.automation,
        campaignName,
        ps.name
      );
    });

    it('should return toggled OFF description when wasActive is true', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ type: 'buff' });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toBe(`${action.name} toggled OFF`);
    });

    it('should return activated on yourself when targetName === playerStats.name and wasActive is false', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ type: 'buff' });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toBe(`${action.name} activated on yourself (10 min)`);
    });

    it('should return activated on {targetName} when targetName differs from playerStats.name', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ target: 'willing_creature' });
      combatData.getCombatSummary.mockReturnValue({ enemies: [] });
      damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'AllyTarget' });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toBe(`${action.name} activated on AllyTarget (10 min)`);
    });

    it('should use auto.duration in description when provided', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ type: 'buff', duration: '1 hour' });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toBe(`${action.name} activated on yourself (1 hour)`);
    });

    it('should use 10 min default duration when auto.duration is missing', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ type: 'buff' });
      delete action.automation.duration;
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toBe(`${action.name} activated on yourself (10 min)`);
    });
  });

  describe('Temp HP', () => {
    it('should set tempHp via setRuntimeValue when buff was not active and tempHpExpression exists', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ tempHpExpression: '2d4+3' });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
      automationService.evaluateAutoExpression.mockReturnValue(7);

      await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(ps.name, 'tempHp', 7, campaignName);
    });

    it('should NOT set tempHp when buff was already active', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ tempHpExpression: '2d4+3' });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });
      automationService.evaluateAutoExpression.mockReturnValue(7);

      await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('should NOT set tempHp when tempHpExpression is missing', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('should NOT set tempHp when evaluateAutoExpression returns non-positive value', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ tempHpExpression: '1d2' });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
      automationService.evaluateAutoExpression.mockReturnValue(0);

      await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('should use result of evaluateAutoExpression for tempHp amount', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ tempHpExpression: '3d6' });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
      automationService.evaluateAutoExpression.mockReturnValue(12);

      await handle(action, ps, campaignName, null);

      expect(automationService.evaluateAutoExpression).toHaveBeenCalledWith('3d6', ps);
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(ps.name, 'tempHp', 12, campaignName);
    });
  });

  describe('bonus_action_dash (Adrenaline Rush)', () => {
    it('should grant temp HP equal to proficiency bonus and decrement uses', async () => {
      const ps = makePlayerStats({ proficiency: 4 });
      runtimeState.getRuntimeValue.mockReturnValue(null);
      automationService.evaluateAutoExpression.mockReturnValue(4);

      const action = {
        name: 'Adrenaline Rush',
        automation: {
          type: 'temp_buff',
          effect: 'bonus_action_dash',
          bonusEffect: 'temp_hp',
          bonusExpression: 'proficiency_bonus',
          uses: 'proficiency_bonus',
          recharge: 'short_rest',
          casting_time: '1 bonus action',
        },
      };

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Dash action as a Bonus Action');
      expect(result.payload.description).toContain('4 temporary hit points');
      expect(result.payload.description).toContain('3 uses remaining');
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(ps.name, 'tempHp', 4, campaignName);
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        ps.name,
        'testhero_adrenalineRushUses',
        3,
        campaignName
      );
    });

    it('should return no uses remaining when all uses exhausted', async () => {
      const ps = makePlayerStats({ proficiency: 4 });
      runtimeState.getRuntimeValue
        .mockReturnValueOnce(Date.now())
        .mockReturnValueOnce(0);

      const action = {
        name: 'Adrenaline Rush',
        automation: {
          type: 'temp_buff',
          effect: 'bonus_action_dash',
          bonusEffect: 'temp_hp',
          bonusExpression: 'proficiency_bonus',
          uses: 'proficiency_bonus',
          recharge: 'short_rest',
        },
      };

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('no uses remaining');
      expect(result.payload.description).toContain('Short or Long Rest');
    });

    it('should reset uses when no rest timestamp exists', async () => {
      const ps = makePlayerStats({ proficiency: 4 });
      runtimeState.getRuntimeValue.mockReturnValue(null);
      automationService.evaluateAutoExpression.mockReturnValue(4);

      const action = {
        name: 'Adrenaline Rush',
        automation: {
          type: 'temp_buff',
          effect: 'bonus_action_dash',
          bonusEffect: 'temp_hp',
          bonusExpression: 'proficiency_bonus',
          uses: 'proficiency_bonus',
          recharge: 'short_rest',
        },
      };

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('3 uses remaining');
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        ps.name,
        'testhero_adrenalineRushUses',
        3,
        campaignName
      );
    });
  });
});
