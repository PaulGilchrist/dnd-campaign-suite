// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../common/buffToggle.js', () => ({
  toggleBuff: vi.fn(),
}));

vi.mock('../class-warlock/tempTeleportHandler.js', () => ({
  handle: vi.fn(),
}));

vi.mock('../class-cleric-paladin/vowOfEnmityHandler.js', () => ({
  handle: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
  evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './buffHandler.js';
import * as buffToggle from '../../common/buffToggle.js';
import * as tempTeleportHandler from '../class-warlock/tempTeleportHandler.js';
import * as vowOfEnmityHandler from '../class-cleric-paladin/vowOfEnmityHandler.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as combatData from '../../../encounters/combatData.js';
import * as automationService from '../../../combat/automation/automationService.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as expirations from '../../../rules/effects/expirations.js';

// ── Constants ──────────────────────────────────────────────────

const CAMPAIGN_NAME = 'TestCampaign';

// ── Helpers ────────────────────────────────────────────────────

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestHero',
    level: 5,
    proficiency: 3,
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

describe('buffHandler.handle - special effects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('dash_action trigger', () => {
    it('should add speed bonus buff and return popup when bonusAmount > 0 and buff not already present', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        trigger: 'dash_action',
        effect: 'speed_bonus',
        bonus: '10 ft',
        duration: '1_round',
      });
      runtimeState.getRuntimeValue.mockReturnValue([]);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('Test Buff: +10 ft Speed for this Dash action.');
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        ps.name,
        'activeBuffs',
        [
          { name: 'Test Buff', tempBuff: true, speedBonus: 10, duration: '1_round' },
        ],
        CAMPAIGN_NAME
      );
    });

    it('should not add duplicate temp buff if one already exists with same name and tempBuff flag', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        trigger: 'dash_action',
        effect: 'speed_bonus',
        bonus: '10 ft',
      });
      runtimeState.getRuntimeValue.mockReturnValue([
        { name: 'Test Buff', tempBuff: true, speedBonus: 10, duration: '1_round' },
      ]);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.type).toBe('popup');
      const buffCalls = runtimeState.setRuntimeValue.mock.calls.filter(
        call => call[1] === 'activeBuffs'
      );
      expect(buffCalls).toHaveLength(0);
    });

    it('should parse bonus from "feet" format correctly', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        trigger: 'dash_action',
        effect: 'speed_bonus',
        bonus: '15 feet',
      });
      runtimeState.getRuntimeValue.mockReturnValue([]);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.description).toBe('Test Buff: +15 ft Speed for this Dash action.');
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        ps.name,
        'activeBuffs',
        [{ name: 'Test Buff', tempBuff: true, speedBonus: 15, duration: 'same_action' }],
        CAMPAIGN_NAME
      );
    });

    it('should fall through to default toggleBuff when bonus string has no number (bonusAmount is 0)', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        trigger: 'dash_action',
        effect: 'speed_bonus',
        bonus: 'unlimited',
      });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.type).toBe('popup');
      expect(buffToggle.toggleBuff).toHaveBeenCalled();
    });

    it('should append new buff to existing stored buffs', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        trigger: 'dash_action',
        effect: 'speed_bonus',
        bonus: '10 ft',
      });
      runtimeState.getRuntimeValue.mockReturnValue([
        { name: 'OtherBuff', tempBuff: true, speedBonus: 5, duration: '1_round' },
      ]);

      await handle(action, ps, CAMPAIGN_NAME, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        ps.name,
        'activeBuffs',
        [
          { name: 'OtherBuff', tempBuff: true, speedBonus: 5, duration: '1_round' },
          { name: 'Test Buff', tempBuff: true, speedBonus: 10, duration: 'same_action' },
        ],
        CAMPAIGN_NAME
      );
    });

    it('should default duration to "same_action" when auto.duration is missing', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        trigger: 'dash_action',
        effect: 'speed_bonus',
        bonus: '5 ft',
      });
      runtimeState.getRuntimeValue.mockReturnValue([]);

      await handle(action, ps, CAMPAIGN_NAME, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        ps.name,
        'activeBuffs',
        [{ name: 'Test Buff', tempBuff: true, speedBonus: 5, duration: 'same_action' }],
        CAMPAIGN_NAME
      );
    });

    it('should treat missing bonus as 0 and fall through to toggleBuff', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        trigger: 'dash_action',
        effect: 'speed_bonus',
      });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, CAMPAIGN_NAME, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalled();
    });

    it('should treat null bonus as 0 and fall through to toggleBuff', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        trigger: 'dash_action',
        effect: 'speed_bonus',
        bonus: null,
      });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, CAMPAIGN_NAME, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalled();
    });
  });

  describe('invisible effect', () => {
    it('should add invisible to activeConditions when toggling on', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'invisible' });
      runtimeState.getRuntimeValue.mockReturnValueOnce([]);
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, CAMPAIGN_NAME, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        ps.name,
        'activeConditions',
        ['invisible'],
        CAMPAIGN_NAME
      );
    });

    it('should not duplicate invisible when already in activeConditions', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'invisible' });
      runtimeState.getRuntimeValue.mockReturnValueOnce(['invisible']);
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, CAMPAIGN_NAME, null);

      const condCalls = runtimeState.setRuntimeValue.mock.calls.filter(
        call => call[1] === 'activeConditions'
      );
      expect(condCalls).toHaveLength(0);
    });

    it('should remove invisible from activeConditions when toggling off', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'invisible' });
      runtimeState.getRuntimeValue.mockReturnValueOnce(['invisible', 'prone']);
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      await handle(action, ps, CAMPAIGN_NAME, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        ps.name,
        'activeConditions',
        ['prone'],
        CAMPAIGN_NAME
      );
    });

    it('should not call setRuntimeValue for conditions when invisible absent and toggling off', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'invisible' });
      runtimeState.getRuntimeValue.mockReturnValueOnce([]);
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      await handle(action, ps, CAMPAIGN_NAME, null);

      const condCalls = runtimeState.setRuntimeValue.mock.calls.filter(
        call => call[1] === 'activeConditions'
      );
      expect(condCalls).toHaveLength(0);
    });

    it('should set _activeInvisibility key to player name when toggling on', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'invisible' });
      runtimeState.getRuntimeValue.mockReturnValue([]);
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, CAMPAIGN_NAME, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        CAMPAIGN_NAME,
        '_activeInvisibility_TestHero',
        ps.name,
        CAMPAIGN_NAME
      );
    });

    it('should set _activeInvisibility key to null when toggling off', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'invisible' });
      runtimeState.getRuntimeValue.mockReturnValue([]);
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      await handle(action, ps, CAMPAIGN_NAME, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        CAMPAIGN_NAME,
        '_activeInvisibility_TestHero',
        null,
        CAMPAIGN_NAME
      );
    });

    it('should use targetName for _activeInvisibility key when target differs from player', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'invisible', target: 'willing_creature' });
      combatData.getCombatSummary.mockReturnValue({ enemies: [] });
      damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'AllyTarget' });
      runtimeState.getRuntimeValue.mockReturnValue([]);
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, CAMPAIGN_NAME, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        CAMPAIGN_NAME,
        '_activeInvisibility_AllyTarget',
        ps.name,
        CAMPAIGN_NAME
      );
    });

    it('should use player name as target when combatSummary is null', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'invisible', target: 'willing_creature' });
      combatData.getCombatSummary.mockReturnValue(null);
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, CAMPAIGN_NAME, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
        ps.name,
        'Test Buff',
        expect.any(Object),
        CAMPAIGN_NAME,
        ps.name
      );
    });
  });

  describe('see_invisibility effect', () => {
    it('should add expiration when toggling on', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'see_invisibility' });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, CAMPAIGN_NAME, null);

      expect(expirations.addExpiration).toHaveBeenCalledWith(
        ps.name,
        ps.name,
        expect.arrayContaining([
          expect.objectContaining({
            type: 'remove_active_buff',
            buffName: 'Test Buff',
          }),
        ]),
        CAMPAIGN_NAME
      );
    });

    it('should not add expiration when toggling off', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'see_invisibility' });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      await handle(action, ps, CAMPAIGN_NAME, null);

      expect(expirations.addExpiration).not.toHaveBeenCalled();
    });
  });

  describe('haste effect', () => {
    it('should add expiration when toggling on', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'haste' });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, CAMPAIGN_NAME, null);

      expect(expirations.addExpiration).toHaveBeenCalledWith(
        ps.name,
        ps.name,
        expect.arrayContaining([
          expect.objectContaining({
            type: 'remove_active_buff',
            buffName: 'Test Buff',
          }),
        ]),
        CAMPAIGN_NAME
      );
    });
  });

  describe('haste effect toggling off', () => {
    it('should remove speed_zero condition from activeConditions when present', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'haste' });
      runtimeState.getRuntimeValue.mockReturnValueOnce(['speed_zero', 'blinded']);
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      await handle(action, ps, CAMPAIGN_NAME, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        ps.name,
        'activeConditions',
        ['blinded'],
        CAMPAIGN_NAME
      );
    });

    it('should not call setRuntimeValue when speed_zero is not in conditions', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'haste' });
      runtimeState.getRuntimeValue.mockReturnValueOnce(['blinded']);
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      await handle(action, ps, CAMPAIGN_NAME, null);

      const condCalls = runtimeState.setRuntimeValue.mock.calls.filter(
        call => call[1] === 'activeConditions'
      );
      expect(condCalls).toHaveLength(0);
    });
  });

  describe('shape_shift tempHp with Moon Druid override', () => {
    it('should override tempHp to 3 x Druid level for Moon Druid with shape_shift effect', async () => {
      const ps = makePlayerStats({
        level: 7,
        class: { major: { name: 'Druid' }, subclass: { name: 'Moon' } },
      });
      const action = makeAction({
        tempHpExpression: '2d6+4',
        effect: 'shape_shift',
      });
      runtimeState.getRuntimeValue.mockReturnValue([]);
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, CAMPAIGN_NAME, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        ps.name,
        'tempHp',
        21,
        CAMPAIGN_NAME
      );
    });

    it('should override using level 1 when playerStats.level is undefined for Moon Druid', async () => {
      const ps = makePlayerStats({
        level: undefined,
        class: { major: { name: 'Druid' }, subclass: { name: 'Moon' } },
      });
      const action = makeAction({
        tempHpExpression: '2d6+4',
        effect: 'shape_shift',
      });
      runtimeState.getRuntimeValue.mockReturnValue([]);
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, CAMPAIGN_NAME, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        ps.name,
        'tempHp',
        3,
        CAMPAIGN_NAME
      );
    });

    it('should use evaluated expression for non-Moon Druid with shape_shift', async () => {
      const ps = makePlayerStats({
        level: 7,
        class: { major: { name: 'Barbarian' }, subclass: { name: null } },
      });
      const action = makeAction({
        tempHpExpression: '2d6+4',
        effect: 'shape_shift',
      });
      runtimeState.getRuntimeValue.mockReturnValue([]);
      automationService.evaluateAutoExpression.mockReturnValue(10);
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, CAMPAIGN_NAME, null);

      expect(automationService.evaluateAutoExpression).toHaveBeenCalledWith('2d6+4', ps);
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        ps.name,
        'tempHp',
        10,
        CAMPAIGN_NAME
      );
    });

    it('should not apply Moon Druid override when effect is not shape_shift', async () => {
      const ps = makePlayerStats({
        level: 7,
        class: { major: { name: 'Druid' }, subclass: { name: 'Moon' } },
      });
      const action = makeAction({
        tempHpExpression: '2d6+2',
        effect: 'other',
      });
      runtimeState.getRuntimeValue.mockReturnValue([]);
      automationService.evaluateAutoExpression.mockReturnValue(8);
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, CAMPAIGN_NAME, null);

      expect(automationService.evaluateAutoExpression).toHaveBeenCalledWith('2d6+2', ps);
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        ps.name,
        'tempHp',
        8,
        CAMPAIGN_NAME
      );
    });

    it('should not apply Moon Druid override when class major is Druid but subclass is not Moon', async () => {
      const ps = makePlayerStats({
        level: 7,
        class: { major: { name: 'Druid' }, subclass: { name: 'Land' } },
      });
      const action = makeAction({
        tempHpExpression: '2d6+2',
        effect: 'shape_shift',
      });
      runtimeState.getRuntimeValue.mockReturnValue([]);
      automationService.evaluateAutoExpression.mockReturnValue(8);
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, CAMPAIGN_NAME, null);

      expect(automationService.evaluateAutoExpression).toHaveBeenCalledWith('2d6+2', ps);
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        ps.name,
        'tempHp',
        8,
        CAMPAIGN_NAME
      );
    });
  });

  describe('delegation to sub-handlers', () => {
    it('should delegate to vowOfEnmityHandler when effect === vow_of_enmity', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'vow_of_enmity' });
      vowOfEnmityHandler.handle.mockResolvedValue({
        type: 'popup',
        payload: {},
      });

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(vowOfEnmityHandler.handle).toHaveBeenCalledWith(
        action,
        ps,
        CAMPAIGN_NAME,
        null
      );
      expect(result).toEqual({ type: 'popup', payload: {} });
    });

    it('should delegate to tempTeleportHandler when effect === bonus_teleport', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'bonus_teleport' });
      tempTeleportHandler.handle.mockReturnValue({ type: 'popup', payload: {} });

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(tempTeleportHandler.handle).toHaveBeenCalledWith(
        action,
        ps,
        CAMPAIGN_NAME,
        null
      );
      expect(result).toEqual({ type: 'popup', payload: {} });
    });

    it('should delegate to tempTeleportHandler when effect === shadow_step_teleport', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'shadow_step_teleport' });
      tempTeleportHandler.handle.mockReturnValue({ type: 'popup', payload: {} });

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(tempTeleportHandler.handle).toHaveBeenCalledWith(
        action,
        ps,
        CAMPAIGN_NAME,
        null
      );
      expect(result).toEqual({ type: 'popup', payload: {} });
    });

    it('should delegate to tempTeleportHandler when effect === moonlight_step_teleport', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'moonlight_step_teleport' });
      tempTeleportHandler.handle.mockReturnValue({ type: 'popup', payload: {} });

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(tempTeleportHandler.handle).toHaveBeenCalledWith(
        action,
        ps,
        CAMPAIGN_NAME,
        null
      );
      expect(result).toEqual({ type: 'popup', payload: {} });
    });
  });
});
