// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
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
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as rangeValidation from '../../../rules/combat/rangeValidation.js';
import * as expirations from '../../../rules/effects/expirations.js';

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

describe('saveAttackHandler - handle', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    savePrompt.buildSaveDc.mockReturnValue(13);
    rangeValidation.rangeToFeet.mockReturnValue(30);
    damageUtils.getCombatContext.mockResolvedValue({});
    runtimeState.getRuntimeValue.mockReturnValue(null);
  });

  describe('handle - variable damage type', () => {
    it('should resolve variable damage type from subrace damage_resistance', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 10, rolls: [5, 5], modifier: 0 });
      runtimeState.getRuntimeValue.mockReturnValue(null);

      const ps = makePlayerStats({
        race: { subrace: { damage_resistance: 'fire' } },
      });
      const action = makeAction({ damageType: 'variable', damage: '2d6' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('roll');
      expect(result.payload.contextConfig.damageType).toBe('fire');
    });

    it('should keep explicit damageType when not variable', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 8, rolls: [8], modifier: 0 });
      runtimeState.getRuntimeValue.mockReturnValue(null);

      const ps = makePlayerStats({
        race: { subrace: { damage_resistance: 'fire' } },
      });
      const action = makeAction({ damageType: 'lightning', damage: '2d6' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.contextConfig.damageType).toBe('lightning');
    });

    it('should keep variable damageType when no subrace damage_resistance', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 6, rolls: [6], modifier: 0 });
      runtimeState.getRuntimeValue.mockReturnValueOnce(null);

      const ps = makePlayerStats();
      const action = makeAction({ damageType: 'variable', damage: '1d6' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.contextConfig.damageType).toBe('variable');
    });
  });

  describe('handle - variable shape resolution', () => {
    it('should default to cone shape when variable with options and no choice made', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(null);

      const action = makeAction({
        shape: 'variable',
        hasOptions: true,
        optionDetails: {
          cone: { shape: 'cone' },
          line: { shape: 'line' },
        },
        damage: '1d8',
      });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('saveAttackAoe');
      expect(result.payload.shape).toBe('cone');
    });

    it('should resolve shape to cone fallback when variable but no optionDetails', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 10, rolls: [10], modifier: 0 });
      runtimeState.getRuntimeValue.mockReturnValue(null);
      damageUtils.getAttackerTargetName.mockReturnValue(null);

      const action = makeAction({ shape: 'variable', damage: '1d8' });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('saveAttackAoe');
      expect(result.payload.shape).toBe('cone');
    });

    it('should resolve shape from optionDetails when option has been chosen', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 10, rolls: [10], modifier: 0 });
      runtimeState.getRuntimeValue.mockReturnValueOnce('line');
      runtimeState.getRuntimeValue.mockReturnValue(null);
      damageUtils.getAttackerTargetName.mockReturnValue(null);

      const action = makeAction({
        shape: 'variable',
        hasOptions: true,
        optionDetails: {
          cone: { shape: 'cone' },
          line: { shape: 'line' },
        },
        damage: '1d8',
      });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('saveAttackAoe');
      expect(result.payload.shape).toBe('line');
    });
  });

  describe('handle - hasOptions option resolution', () => {
    it('should merge optionDetails into automation when option is chosen', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 10, rolls: [10], modifier: 0 });
      runtimeState.getRuntimeValue.mockReturnValueOnce('cone_option');
      runtimeState.getRuntimeValue.mockReturnValue(null);
      damageUtils.getAttackerTargetName.mockReturnValue(null);

      const action = makeAction({
        hasOptions: true,
        optionDetails: {
          cone_option: { shape: 'cone', damage: '4d6' },
        },
      });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('saveAttackAoe');
      expect(result.payload.damage).toBe('4d6');
    });
  });

  describe('handle - channel divinity cost', () => {
    it('should return popup when channel divinity charges are depleted', async () => {
      runtimeState.getRuntimeValue.mockReturnValueOnce(0);

      const ps = makePlayerStats({
        class: { class_levels: [{ level: 5, channel_divinity: 2 }] },
      });
      const action = makeAction({ resourceCost: 'channel_divinity' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Breath Weapon');
      expect(result.payload.description).toBe('No Channel Divinity charges remaining.');
      expect(result.payload.automation).toEqual(action.automation);
    });

    it('should decrement channel divinity charges on use', async () => {
      runtimeState.getRuntimeValue.mockReturnValueOnce(2);

      const ps = makePlayerStats({
        class: { class_levels: [{ level: 5, channel_divinity: 2 }] },
      });
      const action = makeAction({ resourceCost: 'channel_divinity' });

      await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestCaster',
        'channelDivinityCharges',
        1,
        campaignName,
      );
    });
  });

  describe('handle - wild shape cost', () => {
    it('should return popup when wild shape uses are insufficient', async () => {
      runtimeState.getRuntimeValue.mockReturnValueOnce(0);

      const ps = makePlayerStats({
        class: { class_levels: [{ level: 5, wild_shape: 1 }] },
      });
      const action = makeAction({ resourceCost: 'wild_shape' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe(
        'Breath Weapon: Not enough Wild Shape uses remaining. 1 use required.',
      );
    });

    it('should return popup with plural when doubleEmanation requires 2 uses', async () => {
      runtimeState.getRuntimeValue.mockReturnValueOnce(1);

      const ps = makePlayerStats({
        class: { class_levels: [{ level: 5, wild_shape: 2 }] },
      });
      const action = makeAction({ resourceCost: 'wild_shape', doubleEmanation: true });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe(
        'Breath Weapon: Not enough Wild Shape uses remaining. 2 uses required.',
      );
    });

    it('should decrement wild shape uses on use', async () => {
      runtimeState.getRuntimeValue.mockReturnValueOnce(2);
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });

      const ps = makePlayerStats({
        class: { class_levels: [{ level: 5, wild_shape: 2 }] },
      });
      const action = makeAction({ resourceCost: 'wild_shape' });

      await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestCaster',
        'wildShapeUses',
        1,
        campaignName,
      );
    });

    it('should decrement by 2 when doubleEmanation is set', async () => {
      runtimeState.getRuntimeValue.mockReturnValueOnce(3);
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });

      const ps = makePlayerStats({
        class: { class_levels: [{ level: 5, wild_shape: 3 }] },
      });
      const action = makeAction({ resourceCost: 'wild_shape', doubleEmanation: true });

      await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestCaster',
        'wildShapeUses',
        1,
        campaignName,
      );
    });

    it('should set expiration for area effects with duration', async () => {
      runtimeState.getRuntimeValue.mockReturnValueOnce(2);
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });

      const ps = makePlayerStats({
        class: { class_levels: [{ level: 5, wild_shape: 2 }] },
      });
      const action = makeAction({
        resourceCost: 'wild_shape',
        shape: 'cone',
        duration: '1_minute_rounds',
      });

      await handle(action, ps, campaignName, null);

      expect(expirations.addExpiration).toHaveBeenCalledWith({ attackerName: 'TestCaster', targetName: 'TestCaster', effects: [{ type: 'remove_active_buff', buffName: 'Breath Weapon' }], campaignName });
    });

    it('should not set expiration for non-area shape', async () => {
      runtimeState.getRuntimeValue.mockReturnValueOnce(2);
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });

      const ps = makePlayerStats({
        class: { class_levels: [{ level: 5, wild_shape: 2 }] },
      });
      const action = makeAction({
        resourceCost: 'wild_shape',
        shape: 'single_target',
        duration: '1_minute_rounds',
      });

      await handle(action, ps, campaignName, null);

      expect(expirations.addExpiration).not.toHaveBeenCalled();
    });

    it('should not set expiration when duration cannot be parsed', async () => {
      runtimeState.getRuntimeValue.mockReturnValueOnce(2);
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });

      const ps = makePlayerStats({
        class: { class_levels: [{ level: 5, wild_shape: 2 }] },
      });
      const action = makeAction({
        resourceCost: 'wild_shape',
        shape: 'cone',
        duration: 'invalid',
      });

      await handle(action, ps, campaignName, null);

      expect(expirations.addExpiration).not.toHaveBeenCalled();
    });
  });
});
