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

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
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



// ── Tests ──────────────────────────────────────────────────────

describe('buffHandler.handle - special effects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('dash_action trigger', () => {
    it('should add speed bonus buff and return popup when bonusAmount > 0 and buff not already present', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Haste',
        automation: {
          type: 'buff',
          trigger: 'dash_action',
          effect: 'speed_bonus',
          bonus: '10 ft',
          duration: '1_round',
        },
      };
      runtimeState.getRuntimeValue.mockReturnValue([]);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('+10 ft Speed');
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        ps.name,
        'activeBuffs',
        [
          {
            name: 'Haste',
            tempBuff: true,
            speedBonus: 10,
            duration: '1_round',
          },
        ],
        campaignName
      );
    });

    it('should NOT add buff again if dash buff with same name already exists', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Haste',
        automation: {
          type: 'buff',
          trigger: 'dash_action',
          effect: 'speed_bonus',
          bonus: '10 ft',
        },
      };
      runtimeState.getRuntimeValue.mockReturnValue([
        { name: 'Haste', tempBuff: true, speedBonus: 10, duration: '1_round' },
      ]);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('+10 ft Speed');
      // setRuntimeValue should not have been called for activeBuffs
      const buffCalls = runtimeState.setRuntimeValue.mock.calls.filter(
        call => call[1] === 'activeBuffs'
      );
      expect(buffCalls.length).toBe(0);
    });

    it('should parse bonus from String format correctly', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Feature',
        automation: {
          type: 'buff',
          trigger: 'dash_action',
          effect: 'speed_bonus',
          bonus: '15 feet',
        },
      };
      runtimeState.getRuntimeValue.mockReturnValue([]);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        ps.name,
        'activeBuffs',
        [
          {
            name: 'Feature',
            tempBuff: true,
            speedBonus: 15,
            duration: 'same_action',
          },
        ],
        campaignName
      );
    });

    it('should return default popup when bonus string has no number (bonusAmount is 0)', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Feature',
        automation: {
          type: 'buff',
          trigger: 'dash_action',
          effect: 'speed_bonus',
          bonus: 'unlimited',
        },
      };
      runtimeState.getRuntimeValue.mockReturnValue([]);
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, campaignName, null);

      // When bonusAmount is 0, the dash_action block doesn't return;
      // execution falls through to the default toggleBuff path
      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('activated on yourself');
    });

    it('should use stored buffs when they exist', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Haste',
        automation: {
          type: 'buff',
          trigger: 'dash_action',
          effect: 'speed_bonus',
          bonus: '10 ft',
        },
      };
      runtimeState.getRuntimeValue.mockReturnValue([
        { name: 'OtherBuff', tempBuff: true, speedBonus: 5, duration: '1_round' },
      ]);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        ps.name,
        'activeBuffs',
        [
          { name: 'OtherBuff', tempBuff: true, speedBonus: 5, duration: '1_round' },
          { name: 'Haste', tempBuff: true, speedBonus: 10, duration: 'same_action' },
        ],
        campaignName
      );
    });
  });

  describe('requiredLevel check', () => {
    it('should return error popup when player level is below requiredLevel', async () => {
      const ps = makePlayerStats({ level: 3 });
      const action = {
        name: 'Draconic Flight',
        automation: {
          type: 'buff',
          effect: 'fly_speed_equals_walk_speed',
          requiredLevel: 5,
        },
      };

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('requires character level 5');
      expect(result.payload.description).toContain('You are level 3');
    });

    it('should allow buff when player level meets requiredLevel', async () => {
      const ps = makePlayerStats({ level: 5 });
      const action = {
        name: 'Draconic Flight',
        automation: {
          type: 'buff',
          effect: 'fly_speed_equals_walk_speed',
          requiredLevel: 5,
        },
      };
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalled();
    });

    it('should allow buff when player level exceeds requiredLevel', async () => {
      const ps = makePlayerStats({ level: 10 });
      const action = {
        name: 'Draconic Flight',
        automation: {
          type: 'buff',
          effect: 'fly_speed_equals_walk_speed',
          requiredLevel: 5,
        },
      };
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalled();
    });

    it('should not check requiredLevel when auto.requiredLevel is missing', async () => {
      const ps = makePlayerStats({ level: 1 });
      const action = {
        name: 'Test Buff',
        automation: {
          type: 'buff',
          effect: 'some_effect',
        },
      };
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalled();
    });
  });

  describe('long_rest recharge', () => {
    it('should return "cannot be used again" popup when buff is not active and recharge is long_rest without uses', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Rage',
        automation: {
          type: 'buff',
          effect: 'rage',
          recharge: 'long_rest',
        },
      };
      runtimeState.getRuntimeValue.mockReturnValue([]);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('cannot be used again until a Long Rest');
    });

    it('should proceed with buff toggle when buff IS active and recharge is long_rest without uses', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Rage',
        automation: {
          type: 'buff',
          effect: 'rage',
          recharge: 'long_rest',
        },
      };
      runtimeState.getRuntimeValue.mockReturnValue([
        { name: 'Rage', effect: 'rage' },
      ]);
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalled();
    });

    it('should skip long_rest check when auto.uses is present', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Rage',
        automation: {
          type: 'buff',
          effect: 'rage',
          recharge: 'long_rest',
          uses: 2,
        },
      };
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalled();
    });

    it('should skip long_rest check when recharge is not long_rest', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Test Buff',
        automation: {
          type: 'buff',
          effect: 'some_effect',
          recharge: 'short_rest',
        },
      };
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalled();
    });
  });

  describe('invisible effect', () => {
    it('should add invisible condition when buff was not active', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Invisibility',
        automation: {
          type: 'buff',
          effect: 'invisible',
        },
      };
      runtimeState.getRuntimeValue.mockReturnValue([]);
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        ps.name,
        'activeConditions',
        ['invisible'],
        campaignName
      );
    });

    it('should not duplicate invisible condition if already present', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Invisibility',
        automation: {
          type: 'buff',
          effect: 'invisible',
        },
      };
      // First getRuntimeValue call in invisible block is for activeConditions
      runtimeState.getRuntimeValue
        .mockReturnValueOnce(['invisible']);
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, null);

      // setRuntimeValue should NOT be called for activeConditions since invisible is already there
      const condCalls = runtimeState.setRuntimeValue.mock.calls.filter(
        call => call[1] === 'activeConditions'
      );
      expect(condCalls.length).toBe(0);
    });

    it('should remove invisible condition when buff was active (toggle off)', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Invisibility',
        automation: {
          type: 'buff',
          effect: 'invisible',
        },
      };
      // First getRuntimeValue call in invisible block is for activeConditions
      runtimeState.getRuntimeValue
        .mockReturnValueOnce(['invisible', 'prone']);
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        ps.name,
        'activeConditions',
        ['prone'],
        campaignName
      );
    });

    it('should not call setRuntimeValue for conditions when invisible already absent and toggling off', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Invisibility',
        automation: {
          type: 'buff',
          effect: 'invisible',
        },
      };
      runtimeState.getRuntimeValue
        .mockReturnValueOnce([])
        .mockReturnValueOnce(['prone']);
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      await handle(action, ps, campaignName, null);

      // setRuntimeValue should not have been called because invisible was not in conditions
      const condCalls = runtimeState.setRuntimeValue.mock.calls.filter(
        call => call[1] === 'activeConditions'
      );
      expect(condCalls.length).toBe(0);
    });

    it('should set invisKey when buff was not active', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Invisibility',
        automation: {
          type: 'buff',
          effect: 'invisible',
        },
      };
      runtimeState.getRuntimeValue.mockReturnValue([]);
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        campaignName,
        '_activeInvisibility_TestHero',
        ps.name,
        campaignName
      );
    });

    it('should set invisKey to null when buff was active (toggle off)', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Invisibility',
        automation: {
          type: 'buff',
          effect: 'invisible',
        },
      };
      runtimeState.getRuntimeValue.mockReturnValue([]);
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        campaignName,
        '_activeInvisibility_TestHero',
        null,
        campaignName
      );
    });

    it('should use targetName for invisKey when target differs from player', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Invisibility',
        automation: {
          type: 'buff',
          effect: 'invisible',
          target: 'willing_creature',
        },
      };
      combatData.getCombatSummary.mockReturnValue({ enemies: [] });
      damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'AllyTarget' });
      runtimeState.getRuntimeValue
        .mockReturnValueOnce([])
        .mockReturnValueOnce([]);
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        campaignName,
        '_activeInvisibility_AllyTarget',
        ps.name,
        campaignName
      );
    });
  });

  describe('see_invisibility effect', () => {
    it('should add expiration when buff was not active', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'See Invisibility',
        automation: {
          type: 'buff',
          effect: 'see_invisibility',
        },
      };
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, null);

      expect(expirations.addExpiration).toHaveBeenCalledWith(
        ps.name,
        ps.name,
        expect.arrayContaining([
          expect.objectContaining({
            type: 'remove_active_buff',
            buffName: 'See Invisibility',
          }),
        ]),
        campaignName
      );
    });

    it('should NOT add expiration when buff was active (toggle off)', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'See Invisibility',
        automation: {
          type: 'buff',
          effect: 'see_invisibility',
        },
      };
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      await handle(action, ps, campaignName, null);

      expect(expirations.addExpiration).not.toHaveBeenCalled();
    });
  });

  describe('fly_speed_equals_walk_speed effect', () => {
    it('should do nothing when wasActive is true (buff being toggled off)', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Draconic Flight',
        automation: {
          type: 'buff',
          effect: 'fly_speed_equals_walk_speed',
        },
      };
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      await handle(action, ps, campaignName, null);

      // The code has an empty if block for this case, so no assertions needed
      // Just verify no errors were thrown
      expect(buffToggle.toggleBuff).toHaveBeenCalled();
    });

    it('should do nothing when wasActive is false', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Draconic Flight',
        automation: {
          type: 'buff',
          effect: 'fly_speed_equals_walk_speed',
        },
      };
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalled();
    });
  });

  describe('haste effect', () => {
    it('should add expiration when buff was not active', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Haste',
        automation: {
          type: 'buff',
          effect: 'haste',
        },
      };
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, null);

      expect(expirations.addExpiration).toHaveBeenCalledWith(
        ps.name,
        ps.name,
        expect.arrayContaining([
          expect.objectContaining({
            type: 'remove_active_buff',
            buffName: 'Haste',
          }),
        ]),
        campaignName
      );
    });
  });

  describe('shape_shift tempHp with Moon Druid override', () => {
    it('should override tempHp to 3 x Druid level for Moon Druid with shape_shift effect', async () => {
      const ps = makePlayerStats({
        level: 7,
        class: { major: { name: 'Druid' }, subclass: { name: 'Moon' } },
      });
      const action = {
        name: 'Wild Shape',
        automation: {
          type: 'buff',
          effect: 'shape_shift',
          tempHpExpression: '2d6+4',
        },
      };
      runtimeState.getRuntimeValue.mockReturnValue([]);
      automationService.evaluateAutoExpression.mockReturnValue(10);
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, null);

      // Should use 3 * 7 = 21, not the evaluated expression result of 10
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        ps.name,
        'tempHp',
        21,
        campaignName
      );
    });

    it('should use evaluated expression for non-Moon Druid with shape_shift', async () => {
      const ps = makePlayerStats({
        level: 7,
        class: { major: { name: 'Barbarian' }, subclass: { name: null } },
      });
      const action = {
        name: 'Wild Shape',
        automation: {
          type: 'buff',
          effect: 'shape_shift',
          tempHpExpression: '2d6+4',
        },
      };
      runtimeState.getRuntimeValue.mockReturnValue([]);
      automationService.evaluateAutoExpression.mockReturnValue(10);
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        ps.name,
        'tempHp',
        10,
        campaignName
      );
    });

    it('should override using level 1 when playerStats.level is missing', async () => {
      const ps = makePlayerStats({
        level: undefined,
        class: { major: { name: 'Druid' }, subclass: { name: 'Moon' } },
      });
      const action = {
        name: 'Wild Shape',
        automation: {
          type: 'buff',
          effect: 'shape_shift',
          tempHpExpression: '2d6+4',
        },
      };
      runtimeState.getRuntimeValue.mockReturnValue([]);
      automationService.evaluateAutoExpression.mockReturnValue(10);
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        ps.name,
        'tempHp',
        3,
        campaignName
      );
    });
  });

  describe('vow_of_enmity delegation', () => {
    it('should delegate to handleVowOfEnmity when auto.effect === vow_of_enmity', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Vow of Enmity',
        automation: {
          type: 'buff',
          effect: 'vow_of_enmity',
        },
      };
      vowOfEnmityHandler.handle.mockResolvedValue({
        type: 'popup',
        payload: {},
      });

      const result = await handle(action, ps, campaignName, null);

      expect(vowOfEnmityHandler.handle).toHaveBeenCalledWith(
        action,
        ps,
        campaignName,
        null
      );
      expect(result).toEqual({ type: 'popup', payload: {} });
    });
  });

  describe('bonus_teleport delegation', () => {
    it('should delegate to handleTeleport when auto.effect === bonus_teleport', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Misty Step',
        automation: {
          type: 'buff',
          effect: 'bonus_teleport',
        },
      };
      tempTeleportHandler.handle.mockReturnValue({ type: 'popup', payload: {} });

      const result = await handle(action, ps, campaignName, null);

      expect(tempTeleportHandler.handle).toHaveBeenCalledWith(
        action,
        ps,
        campaignName,
        null
      );
      expect(result).toEqual({ type: 'popup', payload: {} });
    });
  });

  describe('shadow_step_teleport delegation', () => {
    it('should delegate to handleTeleport when auto.effect === shadow_step_teleport', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Shadow Step',
        automation: {
          type: 'buff',
          effect: 'shadow_step_teleport',
        },
      };
      tempTeleportHandler.handle.mockReturnValue({ type: 'popup', payload: {} });

      const result = await handle(action, ps, campaignName, null);

      expect(tempTeleportHandler.handle).toHaveBeenCalledWith(
        action,
        ps,
        campaignName,
        null
      );
      expect(result).toEqual({ type: 'popup', payload: {} });
    });
  });

  describe('moonlight_step_teleport delegation', () => {
    it('should delegate to handleTeleport when auto.effect === moonlight_step_teleport', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Moonlight Step',
        automation: {
          type: 'buff',
          effect: 'moonlight_step_teleport',
        },
      };
      tempTeleportHandler.handle.mockReturnValue({ type: 'popup', payload: {} });

      const result = await handle(action, ps, campaignName, null);

      expect(tempTeleportHandler.handle).toHaveBeenCalledWith(
        action,
        ps,
        campaignName,
        null
      );
      expect(result).toEqual({ type: 'popup', payload: {} });
    });
  });
});
