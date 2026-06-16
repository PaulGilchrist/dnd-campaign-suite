import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './falseLifeHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as diceRoller from '../../../dice/diceRoller.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestHero',
    ...overrides,
  };
}

function makeAction(overrides = {}) {
  return {
    name: 'False Life',
    automation: {
      tempHpExpression: '2d4+4',
      ...overrides.automation,
    },
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('falseLifeHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Default temp HP expression', () => {
    it('should use default tempHpExpression 2d4+4 when auto.tempHpExpression is missing', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ automation: { tempHpExpression: undefined } });
      diceRoller.rollExpression.mockReturnValue({ total: 8, rolls: [3, 2], modifier: 4, formula: '2d4+4' });

      await handle(action, ps, campaignName, null);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('2d4+4');
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(ps.name, 'tempHp', 8, campaignName);
    });

    it('should use default tempHpExpression when automation object is empty', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ automation: {} });
      diceRoller.rollExpression.mockReturnValue({ total: 9, rolls: [5, 1], modifier: 3, formula: '2d4+4' });

      const result = await handle(action, ps, campaignName, null);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('2d4+4');
      expect(result.payload.description).toContain('Gained 9 temporary hit points');
    });

    it('should use default tempHpExpression when automation is undefined', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ automation: undefined });
      diceRoller.rollExpression.mockReturnValue({ total: 10, rolls: [6, 1], modifier: 3, formula: '2d4+4' });

      await handle(action, ps, campaignName, null);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('2d4+4');
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(ps.name, 'tempHp', 10, campaignName);
    });
  });

  describe('Custom temp HP expression from automation', () => {
    it('should use auto.tempHpExpression when provided', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ automation: { tempHpExpression: '3d6+2' } });
      diceRoller.rollExpression.mockReturnValue({ total: 15, rolls: [5, 4, 3], modifier: 3, formula: '3d6+2' });

      const result = await handle(action, ps, campaignName, null);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('3d6+2');
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(ps.name, 'tempHp', 15, campaignName);
      expect(result.payload.description).toContain('Gained 15 temporary hit points');
    });
  });

  describe('Spell slot level overrides', () => {
    it('should use spell.heal_at_slot_level for the given slot level', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        automation: { tempHpExpression: '2d4+4' },
        spell: { heal_at_slot_level: { 2: '3d6+3' } },
        spellSlotLevel: 2,
      });
      diceRoller.rollExpression.mockReturnValue({ total: 18, rolls: [6, 5, 4], modifier: 3, formula: '3d6+3' });

      const result = await handle(action, ps, campaignName, null);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('3d6+3');
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(ps.name, 'tempHp', 18, campaignName);
      expect(result.payload.description).toContain('Gained 18 temporary hit points');
    });

    it('should use spell.heal_at_slot_level for slot level 1', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        automation: { tempHpExpression: '2d4+4' },
        spell: { heal_at_slot_level: { 1: '2d4+6' } },
        spellSlotLevel: 1,
      });
      diceRoller.rollExpression.mockReturnValue({ total: 12, rolls: [4, 3], modifier: 5, formula: '2d4+6' });

      await handle(action, ps, campaignName, null);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('2d4+6');
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(ps.name, 'tempHp', 12, campaignName);
    });

    it('should fall back to auto.tempHpExpression when spell.heal_at_slot_level has no matching slot', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        automation: { tempHpExpression: '4d4+4' },
        spell: { heal_at_slot_level: { 2: '3d6+3' } },
        spellSlotLevel: 1,
      });
      diceRoller.rollExpression.mockReturnValue({ total: 14, rolls: [3, 4, 3, 1], modifier: 6, formula: '4d4+4' });

      await handle(action, ps, campaignName, null);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('4d4+4');
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(ps.name, 'tempHp', 14, campaignName);
    });

    it('should use spell.level as fallback for slot level when spellSlotLevel is not provided', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        automation: { tempHpExpression: '2d4+4' },
        spell: { level: 3, heal_at_slot_level: { 3: '4d6+6' } },
      });
      diceRoller.rollExpression.mockReturnValue({ total: 24, rolls: [6, 5, 4, 3], modifier: 6, formula: '4d6+6' });

      await handle(action, ps, campaignName, null);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('4d6+6');
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(ps.name, 'tempHp', 24, campaignName);
    });

    it('should prefer spellSlotLevel over spell.level for slot lookup', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        automation: { tempHpExpression: '2d4+4' },
        spell: { level: 2, heal_at_slot_level: { 2: '3d6+3', 3: '4d6+6' } },
        spellSlotLevel: 3,
      });
      diceRoller.rollExpression.mockReturnValue({ total: 24, rolls: [6, 5, 4, 3], modifier: 6, formula: '4d6+6' });

      await handle(action, ps, campaignName, null);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('4d6+6');
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(ps.name, 'tempHp', 24, campaignName);
    });

    it('should use default expression when spell object is missing', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        automation: { tempHpExpression: '1d8+2' },
        spell: undefined,
        spellSlotLevel: 1,
      });
      diceRoller.rollExpression.mockReturnValue({ total: 6, rolls: [4], modifier: 2, formula: '1d8+2' });

      await handle(action, ps, campaignName, null);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d8+2');
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(ps.name, 'tempHp', 6, campaignName);
    });

    it('should use default expression when spellSlotLevel is undefined and spell has no level', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        automation: { tempHpExpression: '5d4+5' },
        spell: {},
      });
      diceRoller.rollExpression.mockReturnValue({ total: 16, rolls: [4, 3, 4, 2, 3], modifier: 4, formula: '5d4+5' });

      await handle(action, ps, campaignName, null);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('5d4+5');
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(ps.name, 'tempHp', 16, campaignName);
    });
  });

  describe('Roll failure handling', () => {
    it('should return popup with error description when rollExpression returns null', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ automation: { tempHpExpression: 'invalid' } });
      diceRoller.rollExpression.mockReturnValue(null);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('False Life');
      expect(result.payload.automationType).toBeUndefined();
      expect(result.payload.description).toContain('Could not roll temp HP');
      expect(result.payload.description).toContain('invalid');
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('should return error popup when rollExpression returns undefined', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      diceRoller.rollExpression.mockReturnValue(undefined);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('setRuntimeValue calls', () => {
    it('should call setRuntimeValue with player name, tempHp key, rolled amount, and campaign name', async () => {
      const ps = makePlayerStats({ name: 'Gandalf' });
      const action = makeAction();
      diceRoller.rollExpression.mockReturnValue({ total: 7, rolls: [3, 1], modifier: 3, formula: '2d4+3' });

      await handle(action, ps, 'MyCampaign', null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Gandalf', 'tempHp', 7, 'MyCampaign');
    });

    it('should use result.total as the tempHp amount', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      diceRoller.rollExpression.mockReturnValue({ total: 42, rolls: [20, 18], modifier: 4, formula: '2d20+4' });

      await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(ps.name, 'tempHp', 42, campaignName);
    });
  });

  describe('Return payload structure', () => {
    it('should return type popup with automation_info payload type', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      diceRoller.rollExpression.mockReturnValue({ total: 8, rolls: [2, 2], modifier: 4, formula: '2d4+4' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
    });

    it('should include action name in payload', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ name: 'Custom False Life' });
      diceRoller.rollExpression.mockReturnValue({ total: 8, rolls: [2, 2], modifier: 4, formula: '2d4+4' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.name).toBe('Custom False Life');
    });

    it('should include automationType in payload when auto.type is set', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ automation: { type: 'false_life', tempHpExpression: '2d4+4' } });
      diceRoller.rollExpression.mockReturnValue({ total: 8, rolls: [2, 2], modifier: 4, formula: '2d4+4' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.automationType).toBe('false_life');
    });

    it('should include automation object in payload', async () => {
      const ps = makePlayerStats();
      const autoConfig = { type: 'false_life', tempHpExpression: '3d6+3' };
      const action = makeAction({ automation: autoConfig });
      diceRoller.rollExpression.mockReturnValue({ total: 12, rolls: [4, 4, 4], modifier: 0, formula: '3d6+3' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.automation).toEqual(autoConfig);
    });

    it('should include description with amount and rolled formula', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ name: 'False Life' });
      diceRoller.rollExpression.mockReturnValue({ total: 11, rolls: [5, 2], modifier: 4, formula: '2d4+4' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toBe('False Life: Gained 11 temporary hit points (rolled 2d4+4).');
    });
  });

  describe('Map name parameter (unused)', () => {
    it('should accept mapName parameter but not use it', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      diceRoller.rollExpression.mockReturnValue({ total: 8, rolls: [2, 2], modifier: 4, formula: '2d4+4' });

      await handle(action, ps, campaignName, 'DungeonMap1');

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('2d4+4');
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(ps.name, 'tempHp', 8, campaignName);
    });
  });
});
