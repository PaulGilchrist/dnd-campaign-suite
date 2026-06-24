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

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle, restoreAdrenalineRushUses } from './buffHandler.js';
import * as buffToggle from '../../common/buffToggle.js';
import * as tempTeleportHandler from '../class-warlock/tempTeleportHandler.js';
import * as vowOfEnmityHandler from '../class-cleric-paladin/vowOfEnmityHandler.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as combatData from '../../../encounters/combatData.js';
import * as automationService from '../../../combat/automation/automationService.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

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

describe('buffHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Teleport effects delegation', () => {
    const teleportEffects = [
      'teleport_on_rage',
      'teleport_swap_with_illusion',
      'shadow_step_teleport',
      'moonlight_step_teleport',
      'bonus_teleport',
    ];

    for (const effect of teleportEffects) {
      it(`should delegate to handleTeleport when effect === ${effect}`, async () => {
        const ps = makePlayerStats();
        const action = makeAction({ effect });
        tempTeleportHandler.handle.mockReturnValue({ type: 'popup', payload: {} });

        const result = await handle(action, ps, campaignName, null);

        expect(tempTeleportHandler.handle).toHaveBeenCalledWith(action, ps, campaignName, null);
        expect(result).toEqual({ type: 'popup', payload: {} });
      });
    }
  });

  describe('Vow of Enmity delegation', () => {
    it('should delegate to handleVowOfEnmity when effect === vow_of_enmity', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'vow_of_enmity' });
      vowOfEnmityHandler.handle.mockReturnValue({ type: 'popup', payload: {} });

      const result = await handle(action, ps, campaignName, null);

      expect(vowOfEnmityHandler.handle).toHaveBeenCalledWith(action, ps, campaignName, null);
      expect(result).toEqual({ type: 'popup', payload: {} });
    });
  });

  describe('Dash action trigger', () => {
    it('should add a temp buff to activeBuffs when trigger === dash_action and bonusAmount > 0', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Swift Step',
        automation: {
          type: 'buff',
          trigger: 'dash_action',
          effect: 'speed_bonus',
          bonus: '10 ft',
          duration: '1 round',
        },
      };
      runtimeState.getRuntimeValue.mockReturnValue(null);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe('Swift Step: +10 ft Speed for this Dash action.');
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        ps.name,
        'activeBuffs',
        expect.arrayContaining([
          expect.objectContaining({ name: 'Swift Step', tempBuff: true, speedBonus: 10 }),
        ]),
        campaignName
      );
    });

    it('should fall through to normal buff flow when bonusAmount is 0', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Empty Buff',
        automation: {
          type: 'buff',
          trigger: 'dash_action',
          effect: 'speed_bonus',
          bonus: '0 ft',
        },
      };
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, campaignName, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalled();
      expect(result.payload.description).toBe('Empty Buff activated on yourself (10 min)');
    });

    it('should not add duplicate temp buff if one already exists', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Swift Step',
        automation: {
          type: 'buff',
          trigger: 'dash_action',
          effect: 'speed_bonus',
          bonus: '10 ft',
        },
      };
      const existingBuff = { name: 'Swift Step', tempBuff: true, speedBonus: 10, duration: 'same_action' };
      runtimeState.getRuntimeValue.mockReturnValue([existingBuff]);

      await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('Required level guard', () => {
    it('should block activation when player level is below requiredLevel', async () => {
      const ps = makePlayerStats({ level: 3 });
      const action = makeAction({ requiredLevel: 5 });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe(
        'Test Buff requires character level 5. You are level 3.'
      );
      expect(buffToggle.toggleBuff).not.toHaveBeenCalled();
    });

    it('should allow activation when player level meets requiredLevel', async () => {
      const ps = makePlayerStats({ level: 5 });
      const action = makeAction({ requiredLevel: 5 });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('activated on yourself');
      expect(buffToggle.toggleBuff).toHaveBeenCalled();
    });
  });

  describe('Long rest recharge guard', () => {
    it('should block activation when recharge is long_rest, no uses field, and buff is not active', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ recharge: 'long_rest' });
      runtimeState.getRuntimeValue.mockReturnValue([]);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('cannot be used again until a Long Rest');
      expect(buffToggle.toggleBuff).not.toHaveBeenCalled();
    });

    it('should allow activation when recharge is long_rest but buff is already active (toggling off)', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ recharge: 'long_rest' });
      runtimeState.getRuntimeValue.mockReturnValue([{ name: 'Test Buff' }]);
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      await handle(action, ps, campaignName, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalled();
    });

    it('should not apply long_rest guard when auto.uses is present', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ recharge: 'long_rest', uses: 3 });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalled();
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

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
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

  describe('Temp HP on buff activation', () => {
    it('should set tempHp via setRuntimeValue when buff was not active and tempHpExpression exists', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ tempHpExpression: '2d4+3' });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
      automationService.evaluateAutoExpression.mockReturnValue(7);

      await handle(action, ps, campaignName, null);

      expect(automationService.evaluateAutoExpression).toHaveBeenCalledWith('2d4+3', ps);
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

    it('should NOT set tempHp when evaluateAutoExpression returns negative value', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ tempHpExpression: '1d2' });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
      automationService.evaluateAutoExpression.mockReturnValue(-1);

      await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('should use Circle of the Moon override for temp HP when effect is shape_shift', async () => {
      const ps = makePlayerStats({
        level: 7,
        class: { major: { name: 'Druid' }, subclass: { name: 'Moon' } },
      });
      const action = makeAction({ tempHpExpression: '2d6+2', effect: 'shape_shift' });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
      automationService.evaluateAutoExpression.mockReturnValue(7);

      await handle(action, ps, campaignName, null);

      expect(automationService.evaluateAutoExpression).toHaveBeenCalledWith('2d6+2', ps);
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(ps.name, 'tempHp', 21, campaignName);
    });

    it('should NOT apply Moon Druid override when effect is not shape_shift', async () => {
      const ps = makePlayerStats({
        level: 7,
        class: { major: { name: 'Druid' }, subclass: { name: 'Moon' } },
      });
      const action = makeAction({ tempHpExpression: '2d6+2', effect: 'buff' });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
      automationService.evaluateAutoExpression.mockReturnValue(8);

      await handle(action, ps, campaignName, null);

      expect(automationService.evaluateAutoExpression).toHaveBeenCalledWith('2d6+2', ps);
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(ps.name, 'tempHp', 8, campaignName);
    });
  });

  describe('Invisible effect', () => {
    it('should add invisible to activeConditions when wasActive is false', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'invisible' });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
      runtimeState.getRuntimeValue.mockReturnValue([]);

      await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        ps.name,
        'activeConditions',
        expect.arrayContaining(['invisible']),
        campaignName
      );
    });

    it('should not duplicate invisible in activeConditions if already present', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'invisible' });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
      runtimeState.getRuntimeValue.mockReturnValue(['invisible']);

      await handle(action, ps, campaignName, null);

      // setRuntimeValue should NOT be called for activeConditions since invisible is already present
      const conditionCalls = runtimeState.setRuntimeValue.mock.calls.filter(
        call => call[1] === 'activeConditions'
      );
      expect(conditionCalls.length).toBe(0);
      // But _activeInvisibility key should still be set
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        campaignName,
        `_activeInvisibility_${ps.name}`,
        ps.name,
        campaignName
      );
    });

    it('should remove invisible from activeConditions when wasActive is true', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'invisible' });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });
      runtimeState.getRuntimeValue.mockReturnValue(['bleeding', 'invisible', 'poisoned']);

      await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        ps.name,
        'activeConditions',
        ['bleeding', 'poisoned'],
        campaignName
      );
    });

    it('should set _activeInvisibility key when wasActive is false', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'invisible' });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
      runtimeState.getRuntimeValue.mockReturnValue([]);

      await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        campaignName,
        `_activeInvisibility_${ps.name}`,
        ps.name,
        campaignName
      );
    });

    it('should null _activeInvisibility key when wasActive is true', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'invisible' });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });
      runtimeState.getRuntimeValue.mockReturnValue([]);

      await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        campaignName,
        `_activeInvisibility_${ps.name}`,
        null,
        campaignName
      );
    });
  });

  describe('See invisibility effect', () => {
    it('should add expiration when wasActive is false', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'see_invisibility' });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, null);

      expect(expirations.addExpiration).toHaveBeenCalledWith(
        ps.name,
        ps.name,
        expect.arrayContaining([
          expect.objectContaining({ type: 'remove_active_buff', buffName: 'Test Buff' }),
        ]),
        campaignName
      );
    });

    it('should NOT add expiration when wasActive is true', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'see_invisibility' });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      await handle(action, ps, campaignName, null);

      expect(expirations.addExpiration).not.toHaveBeenCalled();
    });
  });

  describe('Haste effect', () => {
    it('should add expiration when wasActive is false', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'haste' });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, null);

      expect(expirations.addExpiration).toHaveBeenCalledWith(
        ps.name,
        ps.name,
        expect.arrayContaining([
          expect.objectContaining({ type: 'remove_active_buff', buffName: 'Test Buff' }),
        ]),
        campaignName
      );
    });

    it('should remove speed_zero condition when wasActive is true', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'haste' });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });
      runtimeState.getRuntimeValue.mockReturnValue(['speed_zero', 'blinded']);

      await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        ps.name,
        'activeConditions',
        ['blinded'],
        campaignName
      );
    });

    it('should NOT call setRuntimeValue when speed_zero is not in conditions', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'haste' });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });
      runtimeState.getRuntimeValue.mockReturnValue(['blinded']);

      await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('Fly speed equals walk speed effect', () => {
    it('should be a no-op when toggling off', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'fly_speed_equals_walk_speed' });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toBe('Test Buff toggled OFF');
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('Return value shape', () => {
    it('should return a popup with automation_info type payload', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ type: 'buff' });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, campaignName, null);

      expect(result).toMatchObject({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: action.name,
          automationType: 'buff',
        },
      });
    });

    it('should include automation object in payload', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ duration: '1 hour' });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.automation).toEqual(action.automation);
    });
  });
});

describe('buffHandler.restoreAdrenalineRushUses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should set adrenalineRushUses to null for the given player', () => {
    restoreAdrenalineRushUses('TestHero', campaignName);

    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestHero',
      'adrenalineRushUses',
      null,
      campaignName
    );
  });
});
