// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────

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

const CAMPAIGN_NAME = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return { name: 'TestHero', ...overrides };
}

function makeAction(overrides = {}) {
  return {
    name: 'False Life',
    automation: { tempHpExpression: '2d4+4', ...overrides.automation },
    ...overrides,
  };
}

function successRoll(total, formula) {
  return { total, rolls: [], modifier: 0, formula };
}

// ── Tests ──────────────────────────────────────────────────────

describe('falseLifeHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    diceRoller.rollExpression.mockReturnValue(successRoll(8, '2d4+4'));
  });

  describe('temp HP expression selection', () => {
    it('uses default 2d4+4 when no expression is provided', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ automation: {} });

      await handle(action, ps, CAMPAIGN_NAME, null);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('2d4+4');
    });

    it('uses default 2d4+4 when automation is undefined', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ automation: undefined });

      await handle(action, ps, CAMPAIGN_NAME, null);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('2d4+4');
    });

    it('uses automation.tempHpExpression when provided', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ automation: { tempHpExpression: '3d6+2' } });

      await handle(action, ps, CAMPAIGN_NAME, null);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('3d6+2');
    });

    it('overrides with spell.heal_at_slot_level when slot level matches', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        spell: { heal_at_slot_level: { 2: '4d6+4' } },
        spellSlotLevel: 2,
      });

      await handle(action, ps, CAMPAIGN_NAME, null);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('4d6+4');
    });

    it('falls back to automation.tempHpExpression when no slot-level match', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        automation: { tempHpExpression: '2d8+3' },
        spell: { heal_at_slot_level: { 2: '4d6+4' } },
        spellSlotLevel: 1,
      });

      await handle(action, ps, CAMPAIGN_NAME, null);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('2d8+3');
    });

    it('uses spell.level when spellSlotLevel is absent', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        spell: { level: 3, heal_at_slot_level: { 3: '5d6+5' } },
      });

      await handle(action, ps, CAMPAIGN_NAME, null);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('5d6+5');
    });

    it('prefers spellSlotLevel over spell.level', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        spell: { level: 2, heal_at_slot_level: { 2: '3d6+3', 3: '5d6+5' } },
        spellSlotLevel: 3,
      });

      await handle(action, ps, CAMPAIGN_NAME, null);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('5d6+5');
    });

    it('uses automation or default expression when spell object is absent', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ spell: undefined });

      await handle(action, ps, CAMPAIGN_NAME, null);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('2d4+4');
    });
  });

  describe('setRuntimeValue', () => {
    it('sets tempHp to the rolled total for the player', async () => {
      const ps = makePlayerStats({ name: 'Gandalf' });
      diceRoller.rollExpression.mockReturnValue(successRoll(12, '3d4+3'));

      await handle(makeAction(), ps, 'MyCampaign', null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Gandalf',
        'tempHp',
        12,
        'MyCampaign'
      );
    });

    it('does not call setRuntimeValue when roll fails', async () => {
      diceRoller.rollExpression.mockReturnValue(null);

      await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null);

      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('return payload structure', () => {
    it('returns success popup with correct structure', async () => {
      diceRoller.rollExpression.mockReturnValue(successRoll(11, '2d4+4'));
      const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('False Life');
      expect(result.payload.automationType).toBeUndefined();
      expect(result.payload.description).toBe(
        'False Life: Gained 11 temporary hit points (rolled 2d4+4).'
      );
      expect(result.payload.automation).toEqual({ tempHpExpression: '2d4+4' });
    });

    it('includes automationType when auto.type is set', async () => {
      const action = makeAction({ automation: { type: 'false_life' } });
      const result = await handle(action, makePlayerStats(), CAMPAIGN_NAME, null);

      expect(result.payload.automationType).toBe('false_life');
    });
  });

  describe('roll failure', () => {
    it('returns info popup with error description when roll fails', async () => {
      diceRoller.rollExpression.mockReturnValue(null);
      const result = await handle(
        makeAction({ automation: { tempHpExpression: 'invalid' } }),
        makePlayerStats(),
        CAMPAIGN_NAME,
        null
      );

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('False Life');
      expect(result.payload.description).toBe(
        'False Life: Could not roll temp HP (invalid).'
      );
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });
  });
});
