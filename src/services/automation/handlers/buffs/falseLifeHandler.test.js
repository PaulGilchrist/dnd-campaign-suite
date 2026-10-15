// @maintained-by-ai
// Deterministic contract tests for the pure falseLifeHandler: all side-effecting
// dependencies (dice roller, log service, temp-HP service) are mocked, so this
// suite pins expression-selection, temp HP application, logging, and popup
// payloads without touching app moving parts.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../dice/diceRoller.js', () => ({ rollExpression: vi.fn() }));
vi.mock('../../../ui/logService.js', () => ({ addEntry: vi.fn().mockResolvedValue(undefined) }));
vi.mock('./tempHpService.js', () => ({ setTempHp: vi.fn() }));

import { handle } from './falseLifeHandler.js';
import * as diceRoller from '../../../dice/diceRoller.js';
import * as logService from '../../../ui/logService.js';
import * as tempHpService from './tempHpService.js';

const CAMPAIGN_NAME = 'test-campaign';

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

describe('falseLifeHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    diceRoller.rollExpression.mockReturnValue(successRoll(8, '2d4+4'));
  });

  describe('temp HP expression selection', () => {
    it.each([undefined, null, {}])(
      'uses default 2d4+4 when automation is %s',
      async (automation) => {
        await handle({ name: 'False Life', automation }, makePlayerStats(), CAMPAIGN_NAME, null);

        expect(diceRoller.rollExpression).toHaveBeenCalledWith('2d4+4');
      }
    );

    it('uses automation.tempHpExpression when provided', async () => {
      await handle(
        makeAction({ automation: { tempHpExpression: '3d6+2' } }),
        makePlayerStats(),
        CAMPAIGN_NAME,
        null,
      );

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('3d6+2');
    });

    it('uses spell.level when spellSlotLevel is absent', async () => {
      const action = makeAction({
        spell: { level: 3, heal_at_slot_level: { 3: '5d6+5' } },
      });

      await handle(action, makePlayerStats(), CAMPAIGN_NAME, null);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('5d6+5');
    });

    it('prefers spellSlotLevel over spell.level', async () => {
      const action = makeAction({
        spell: { level: 2, heal_at_slot_level: { 2: '3d6+3', 3: '5d6+5' } },
        spellSlotLevel: 3,
      });

      await handle(action, makePlayerStats(), CAMPAIGN_NAME, null);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('5d6+5');
    });

    it('falls back to automation.tempHpExpression when spellSlotLevel does not match any heal_at_slot_level key', async () => {
      const action = makeAction({
        spell: { heal_at_slot_level: { 2: '4d6+4' } },
        spellSlotLevel: 1,
        automation: { tempHpExpression: '2d8+3' },
      });

      await handle(action, makePlayerStats(), CAMPAIGN_NAME, null);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('2d8+3');
    });

    it('uses default when spell is null', async () => {
      await handle(makeAction({ spell: null }), makePlayerStats(), CAMPAIGN_NAME, null);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('2d4+4');
    });
  });

  describe('temp HP application and logging', () => {
    it('calls setTempHp with the rolled total and logs an hp_change entry', async () => {
      const ps = makePlayerStats({ name: 'Gandalf' });
      diceRoller.rollExpression.mockReturnValue(successRoll(12, '3d4+3'));

      await handle(makeAction({ automation: { tempHpExpression: '3d4+3' } }), ps, CAMPAIGN_NAME, null);

      expect(tempHpService.setTempHp).toHaveBeenCalledWith('Gandalf', 12, CAMPAIGN_NAME);
      expect(logService.addEntry).toHaveBeenCalledWith(
        CAMPAIGN_NAME,
        expect.objectContaining({
          type: 'hp_change',
          targetName: 'Gandalf',
          delta: 12,
          isTempHp: true,
          sourceName: 'Gandalf',
          note: 'False Life (3d4+3)',
        }),
      );
    });

    it('succeeds even when addEntry rejects', async () => {
      logService.addEntry.mockRejectedValue(new Error('disk write failed'));

      const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('Gained 8 temporary hit points');
      expect(tempHpService.setTempHp).toHaveBeenCalled();
    });
  });

  describe('return payload structure', () => {
    it('returns success popup with correct structure', async () => {
      diceRoller.rollExpression.mockReturnValue(successRoll(11, '2d4+4'));
      const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('False Life');
      expect(result.payload.description).toBe(
        'False Life: Gained 11 temporary hit points (rolled 2d4+4).',
      );
      expect(result.payload.automation).toEqual({ tempHpExpression: '2d4+4' });
    });

    it('includes automationType when auto.type is set', async () => {
      const action = makeAction({ automation: { type: 'false_life' } });
      const result = await handle(action, makePlayerStats(), CAMPAIGN_NAME, null);

      expect(result.payload.automationType).toBe('false_life');
    });

    it('has undefined automationType when auto.type is absent', async () => {
      const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null);

      expect(result.payload.automationType).toBeUndefined();
    });
  });

  describe('roll failure', () => {
    it('returns info popup, applies no temp HP, and logs nothing when roll fails', async () => {
      diceRoller.rollExpression.mockReturnValue(null);
      const result = await handle(
        makeAction({ automation: { tempHpExpression: 'invalid' } }),
        makePlayerStats(),
        CAMPAIGN_NAME,
        null,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('False Life');
      expect(result.payload.description).toBe(
        'False Life: Could not roll temp HP (invalid).',
      );
      expect(result.payload.automation).toEqual({ tempHpExpression: 'invalid' });
      expect(tempHpService.setTempHp).not.toHaveBeenCalled();
      expect(logService.addEntry).not.toHaveBeenCalled();
    });
  });
});
