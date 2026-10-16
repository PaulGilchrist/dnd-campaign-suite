// @maintained-by-ai — deterministic unit contract for handle()'s routing lanes:
// tracked-uses cost (incl. long_rest_or_expend_rage fallback), heal/condition/AoE
// modal routing, effect-only and condition popups, pushEffect normalization, and
// buildSaveAttackRollResult payload + notes composition (darkness-dispelled note
// only reachable when condition+damage bypasses the AoE modal guard). Pure logic
// through module-boundary mocks; stable unless runtime keys, popup copy, modal
// names, or payload shape change. Channel-divinity / wild-shape consumption and
// shape-resolution lanes live in saveAttackHandler.handle.test.js; isExhausted()
// booleans in saveAttackHandler.exhausted.test.js — do not cross-remove.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../maps/mapsService.js', () => ({
  loadMapData: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getAttackerTargetName: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
  rangeToFeet: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../combat/automation/automationExpressions.js', () => ({
  resolveUses: vi.fn(),
  resolveScaling: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './saveAttackHandler.js';
import * as diceRoller from '../../../dice/diceRoller.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as mapsService from '../../../maps/mapsService.js';
import * as rangeValidation from '../../../rules/combat/rangeValidation.js';
import * as automationExpressions from '../../../combat/automation/automationExpressions.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
    level: 5,
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Breath Weapon',
    automation: {
      type: 'save_attack',
      ...automation,
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('saveAttackHandler - handle (part 2)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    savePrompt.buildSaveDc.mockReturnValue(13);
    rangeValidation.rangeToFeet.mockReturnValue(30);
    runtimeState.getRuntimeValue.mockReturnValue(null);
  });

  describe('handle - uses cost', () => {
    it('should return popup when uses are 0', async () => {
      runtimeState.getRuntimeValue.mockReturnValueOnce(0);
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });

      const action = makeAction({ usesMax: 1 });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe(
        'Breath Weapon has been used and cannot be used again until a long rest.',
      );
    });

    it('should auto-spend rage and continue when long_rest_or_expend_rage and rage available', async () => {
      runtimeState.getRuntimeValue.mockReturnValueOnce(0).mockReturnValueOnce(6);
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });

      const action = makeAction({ usesMax: 1, recharge: 'long_rest_or_expend_rage' });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('roll');
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('TestCaster', 'ragePoints', 5, campaignName);
    });

    it('should show exhausted popup when long_rest_or_expend_rage and no rage available', async () => {
      runtimeState.getRuntimeValue.mockReturnValueOnce(0);

      const action = makeAction({ usesMax: 1, recharge: 'long_rest_or_expend_rage' });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.description).toBe(
        'Breath Weapon has been used and cannot be used again until a long rest.',
      );
    });

    it('should decrement uses on successful use', async () => {
      runtimeState.getRuntimeValue.mockReturnValueOnce(1);
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });

      const action = makeAction({ usesMax: 1 });

      await handle(action, makePlayerStats(), campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestCaster',
        'breathweaponUses',
        0,
        campaignName,
      );
    });

    it('should proceed to damage roll when maxUses is 0', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });

      const action = makeAction({ usesMax: 0, damage: '1d6' });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('roll');
      expect(result.payload.total).toBe(5);
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('handle - area + healing', () => {
    it('should return saveAttackHeal modal when healExpression and area shape present', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
      mapsService.loadMapData.mockResolvedValue(null);

      const action = makeAction({
        shape: 'cone',
        healExpression: '2d4',
        damage: '1d6',
      });

      const result = await handle(action, makePlayerStats(), campaignName, 'test-map');

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('saveAttackHeal');
      expect(result.payload.saveType).toBe('CON');
      expect(result.payload.featureName).toBe('Breath Weapon');
      expect(result.payload.saveDc).toBe(13);
      expect(result.payload.damageExpression).toBe('1d6');
      expect(result.payload.healExpression).toBe('2d4');
      expect(result.payload.rangeFeet).toBe(30);
    });

    // CLA-208: scaled damage + heal expressions and auto.range must reach the modal payload
    it('resolves level scaling and auto.range into the saveAttackHeal payload', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
      automationExpressions.resolveScaling.mockImplementation((stats, scaling) => {
        if (!scaling) return null;
        const entries = Object.entries(scaling).map(([level, damage]) => ({ level: parseInt(level, 10), damage }));
        return entries.sort((a, b) => a.level - b.level).filter(e => stats.level >= e.level).pop() || null;
      });

      const action = makeAction({
        shape: 'sphere',
        range: '60_ft',
        damage: '2d6',
        healExpression: '2d6',
        scaling: { '10': '3d6', '14': '4d6' },
        healScaling: { '10': '3d6', '14': '4d6' },
        resourceCost: 'wild_shape',
      });

      const result = await handle(action, makePlayerStats({ level: 20, class: { class_levels: [{ level: 20, wild_shape: 4 }] } }), campaignName, null);

      expect(result.modalName).toBe('saveAttackHeal');
      expect(result.payload.damageExpression).toBe('4d6');
      expect(result.payload.healExpression).toBe('4d6');
      expect(result.payload.rangeFeet).toBe(30); // rangeToFeet is mocked → returns 30
      expect(rangeValidation.rangeToFeet).toHaveBeenCalledWith('60_ft');
    });

    it('should use custom saveType when provided', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });

      const action = makeAction({
        shape: 'cone',
        healExpression: '2d4',
        saveType: 'WIS',
      });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.saveType).toBe('WIS');
    });

    it('should not return modal for healing without area shape', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });

      const action = makeAction({
        healExpression: '2d4',
        damage: '1d6',
      });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('roll');
      expect(result.modalName).toBeUndefined();
    });

    it('should include attacker position when map data is available', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });

      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
      });

      const action = makeAction({
        shape: 'cone',
        healExpression: '2d4',
      });

      const result = await handle(action, makePlayerStats(), campaignName, 'test-map');

      expect(result.payload.attackerPos).toEqual({ gridX: 5, gridY: 10 });
    });

    it('should return null attackerPos when map load fails', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });

      mapsService.loadMapData.mockRejectedValueOnce(new Error('not found'));

      const action = makeAction({
        shape: 'cone',
        healExpression: '2d4',
      });

      const result = await handle(action, makePlayerStats(), campaignName, 'test-map');

      expect(result.payload.attackerPos).toBeNull();
    });

    it('should return null attackerPos when attacker not found in map data', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });

      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: 'OtherPlayer', gridX: 1, gridY: 2 }],
      });

      const action = makeAction({
        shape: 'cone',
        healExpression: '2d4',
      });

      const result = await handle(action, makePlayerStats(), campaignName, 'test-map');

      expect(result.payload.attackerPos).toBeNull();
    });
  });

  describe('handle - condition inflicted', () => {
    it('should return setCondition modal for condition + area shape', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });

      const action = makeAction({
        shape: 'cone',
        conditionInflicted: 'Poisoned',
      });

      const result = await handle(action, makePlayerStats(), campaignName, 'test-map');

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('setCondition');
      expect(result.payload.conditionName).toBe('poisoned');
      expect(result.payload.saveType).toBe('WIS');
      expect(result.payload.featureName).toBe('Breath Weapon');
      expect(result.payload.saveDc).toBe(13);
    });

    it('should use custom saveType for condition modal', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });

      const action = makeAction({
        shape: 'cone',
        conditionInflicted: 'Stunned',
        saveType: 'CON',
      });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.saveType).toBe('CON');
    });

    it('should return popup for condition without area shape', async () => {
      const action = makeAction({ conditionInflicted: 'Poisoned' });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe(
        'Breath Weapon — WIS save DC 13. On a failed save, target has the Poisoned condition.',
      );
    });

    it('should return popup with custom saveType for condition without area shape', async () => {
      const action = makeAction({ conditionInflicted: 'Blinded', saveType: 'INT' });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.description).toBe(
        'Breath Weapon — INT save DC 13. On a failed save, target has the Blinded condition.',
      );
    });

    it('should not return modal when conditionInflicted is present with damage', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });

      const action = makeAction({
        shape: 'cone',
        conditionInflicted: 'Poisoned',
        damage: '1d6',
      });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('roll');
      expect(result.payload.contextConfig.conditionInflicted).toBe('Poisoned');
    });
  });

  describe('handle - effect only (no damage)', () => {
    it('should return popup for effect without damage', async () => {
      const action = makeAction({ effect: 'speed_reduction', effectValue: '15_ft' });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe(
        'Breath Weapon — DEX save DC 13. On a failed save, the target\'s Speed is reduced by 15 ft.',
      );
    });

    it('should use custom saveType for effect popup', async () => {
      const action = makeAction({ effect: 'push', effectValue: '10_ft', saveType: 'STR' });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.description).toBe(
        'Breath Weapon — STR save DC 13. On a failed save, the target is pushed 10 ft.',
      );
    });

    it('should use default 10 ft when effectValue is missing for push', async () => {
      const action = makeAction({ effect: 'push' });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.description).toBe(
        'Breath Weapon — DEX save DC 13. On a failed save, the target is pushed 10 ft.',
      );
    });

    it('should use default 15 ft when effectValue is missing for speed_reduction', async () => {
      const action = makeAction({ effect: 'speed_reduction' });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.description).toBe(
        'Breath Weapon — DEX save DC 13. On a failed save, the target\'s Speed is reduced by 15 ft.',
      );
    });

    it('should return raw effect string for unknown effect types', async () => {
      const action = makeAction({ effect: 'custom_effect' });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.description).toBe(
        'Breath Weapon — DEX save DC 13. On a failed save, custom_effect.',
      );
    });
  });

  describe('handle - damage roll', () => {
    it('should return roll payload with correct damage values', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 12, rolls: [7, 5], modifier: 0 });

      const action = makeAction({ damage: '2d6' });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('roll');
      expect(result.payload.rollType).toBe('damage');
      expect(result.payload.name).toBe('Breath Weapon');
      expect(result.payload.total).toBe(12);
      expect(result.payload.formula).toBe('2d6');
      expect(result.payload.rolls).toEqual([7, 5]);
      expect(result.payload.modifier).toBe(0);
    });

    it('should include rider description in notes for push effect', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 10, rolls: [10], modifier: 0 });

      const action = makeAction({ damage: '1d8', effect: 'push', effectValue: '10_ft' });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.notes).toBe(
        'the target is pushed 10 ft',
      );
    });

    // An area shape with damage only reaches the roll path (buildSaveAttackRollResult,
    // where the darkness-dispelled note lives) when conditionInflicted bypasses the
    // saveAttackAoe modal guard — the AoE modal itself is pinned in handle.test.js.
    it('should include darkness dispelled note on roll for area shape with condition and damage', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 10, rolls: [10], modifier: 0 });

      const action = makeAction({ damage: '1d8', shape: 'cone', conditionInflicted: 'Poisoned' });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('roll');
      expect(result.payload.notes).toBe('Magical Darkness in the area is dispelled.');
    });

    it('should combine darkness dispelled and rider notes on roll for area with effect', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 10, rolls: [10], modifier: 0 });

      const action = makeAction({
        damage: '1d8',
        shape: 'cone',
        conditionInflicted: 'Poisoned',
        effect: 'push',
        effectValue: '5_ft',
      });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('roll');
      expect(result.payload.notes).toBe(
        'Magical Darkness in the area is dispelled. the target is pushed 5 ft',
      );
    });

    it('should return null when rollExpression returns null', async () => {
      diceRoller.rollExpression.mockReturnValue(null);

      const action = makeAction({ damage: '2d6' });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result).toBeNull();
    });

    it('should set contextConfig with correct defaults', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 10, rolls: [10], modifier: 0 });

      const action = makeAction({ damage: '1d8' });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.contextConfig).toEqual({
        damageType: '',
        saveDc: 13,
        saveType: 'DEX',
        dcSuccess: 'none',
        attackerName: 'TestCaster',
        conditionInflicted: null,
        shape: '',
      });
    });

    it('should set dcSuccess based on shape and explicit value', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 10, rolls: [10], modifier: 0 });

      const action1 = makeAction({ damage: '1d8', shape: 'cone' });
      const result1 = await handle(action1, makePlayerStats(), campaignName, null);
      expect(result1.type).toBe('modal');
      expect(result1.modalName).toBe('saveAttackAoe');
      expect(result1.payload.dcSuccess).toBe('half');

      const action2 = makeAction({ damage: '1d8', shape: 'line' });
      const result2 = await handle(action2, makePlayerStats(), campaignName, null);
      expect(result2.type).toBe('modal');
      expect(result2.payload.dcSuccess).toBe('none');

      const action3 = makeAction({ damage: '1d8', dcSuccess: 1 });
      const result3 = await handle(action3, makePlayerStats(), campaignName, null);
      expect(result3.payload.contextConfig.dcSuccess).toBe(1);
    });

    it('should include custom saveType in contextConfig', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 10, rolls: [10], modifier: 0 });

      const action = makeAction({ damage: '1d8', saveType: 'CON' });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.contextConfig.saveType).toBe('CON');
    });
  });

  describe('handle - pushEffect normalization', () => {
    it('should set effect from pushEffect when effect is missing', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 10, rolls: [10], modifier: 0 });

      const action = makeAction({ damage: '1d8', pushEffect: 'push', effectValue: '10_ft' });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.notes).toBe('the target is pushed 10 ft');
    });

    it('should not override existing effect with pushEffect', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 10, rolls: [10], modifier: 0 });

      const action = makeAction({ damage: '1d8', pushEffect: 'push', effect: 'speed_reduction', effectValue: '20_ft' });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.notes).toBe("the target's Speed is reduced by 20 ft");
    });
  });
});
