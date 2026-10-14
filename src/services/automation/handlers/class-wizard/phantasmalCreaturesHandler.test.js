import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle, confirmPhantasmalCreatures, modalName, confirmType } from './phantasmalCreaturesHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

describe('phantasmalCreaturesHandler', () => {
  const campaignName = 'test-campaign';

  function makePlayerStats(overrides = {}) {
    return { name: 'TestWizard', ...overrides };
  }

  function makeAction(overrides = {}) {
    return {
      name: 'Phantasmal Creatures',
      automation: {
        type: 'phantasmal_creatures',
        casting_time: 'passive',
        alwaysPreparedSpells: ['Summon Beast', 'Summon Fey'],
        freeCastSpells: ['Summon Beast', 'Summon Fey'],
        usesMax: 1,
        recharge: 'long_rest',
        halvesHp: true,
        ...overrides.automation,
      },
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('named exports', () => {
    it('exports modalName as "phantasmalCreatures"', () => {
      expect(modalName).toBe('phantasmalCreatures');
    });

    it('exports confirmType as "phantasmal_creatures_confirm"', () => {
      expect(confirmType).toBe('phantasmal_creatures_confirm');
    });
  });

  describe('handle', () => {
    it('returns modal with correct payload when free casts are available', async () => {
      getRuntimeValue.mockReturnValue(1);

      const action = makeAction();
      const playerStats = makePlayerStats();
      const result = await handle(action, playerStats, campaignName);

      expect(result).toEqual({
        type: 'modal',
        modalName: 'phantasmalCreatures',
        payload: {
          action,
          playerStats,
          campaignName,
          noConcentrationOption: true,
        },
      });
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('returns info popup when no free casts remaining', async () => {
      getRuntimeValue.mockReturnValue(0);

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Phantasmal Creatures',
          description: 'No free casts remaining. Finish a Long Rest to regain them.',
          automation: expect.objectContaining({ type: 'phantasmal_creatures' }),
        },
      });
    });

    it('returns info popup when free casts are negative', async () => {
      getRuntimeValue.mockReturnValue(-1);

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe('No free casts remaining. Finish a Long Rest to regain them.');
    });

    it('falls back to usesMax when runtime value is null', async () => {
      getRuntimeValue.mockReturnValue(null);

      const action = makeAction({ automation: { usesMax: 2 } });
      const result = await handle(action, makePlayerStats(), campaignName);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('phantasmalCreatures');
    });

    it('falls back to usesMax when runtime value is undefined', async () => {
      getRuntimeValue.mockReturnValue(undefined);

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('phantasmalCreatures');
    });

    it('falls back to usesMax when runtime value is NaN', async () => {
      getRuntimeValue.mockReturnValue('not a number');

      const action = makeAction({ automation: { usesMax: 1 } });
      const result = await handle(action, makePlayerStats(), campaignName);

      expect(result.type).toBe('modal');
    });

    it('uses action.name to build the runtime key', async () => {
      const customNameAction = makeAction({ name: 'Custom Phantasmal Creatures' });
      getRuntimeValue.mockReturnValue(null);

      await handle(customNameAction, makePlayerStats(), campaignName);

      expect(getRuntimeValue).toHaveBeenCalledWith(
        'TestWizard',
        '_Custom_Phantasmal_Creatures_freeCastCount',
        campaignName,
      );
    });
  });

  describe('confirmPhantasmalCreatures', () => {
    it('decrements free cast count and returns info popup', async () => {
      getRuntimeValue.mockReturnValue(1);

      const action = makeAction();
      const playerStats = makePlayerStats();
      const result = await confirmPhantasmalCreatures(action, playerStats, campaignName, true);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestWizard',
        '_Phantasmal_Creatures_freeCastCount',
        0,
        campaignName,
      );
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Phantasmal Creatures');
      expect(result.payload.description).toContain('Free cast of Summon Beast or Summon Fey');
      expect(result.payload.description).toContain('0 remaining');
      expect(result.payload.description).toContain('Illusion');
      expect(result.payload.description).toContain('HP is halved');
      expect(result.payload.automation.halvedHp).toBe(true);
      expect(result.payload.automation.noConcentration).toBe(true);
      expect(result.payload.automation.type).toBe('phantasmal_creatures');
    });

    it('decrements from custom usesMax value', async () => {
      getRuntimeValue.mockReturnValue(3);

      await confirmPhantasmalCreatures(makeAction(), makePlayerStats(), campaignName, false);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestWizard',
        '_Phantasmal_Creatures_freeCastCount',
        2,
        campaignName,
      );
    });

    it('returns info popup when no free casts remaining', async () => {
      getRuntimeValue.mockReturnValue(0);

      const result = await confirmPhantasmalCreatures(makeAction(), makePlayerStats(), campaignName, true);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Phantasmal Creatures',
          description: 'No free casts remaining. Finish a Long Rest to regain them.',
          automation: expect.objectContaining({ type: 'phantasmal_creatures' }),
        },
      });
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('returns info popup when free casts are negative', async () => {
      getRuntimeValue.mockReturnValue(-2);

      const result = await confirmPhantasmalCreatures(makeAction(), makePlayerStats(), campaignName, true);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('No free casts remaining. Finish a Long Rest to regain them.');
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('uses noConcentration=false when false is passed', async () => {
      getRuntimeValue.mockReturnValue(1);

      const result = await confirmPhantasmalCreatures(makeAction(), makePlayerStats(), campaignName, false);

      expect(result.payload.automation.noConcentration).toBe(false);
    });

    it('uses default spell names when freeCastSpells is missing', async () => {
      getRuntimeValue.mockReturnValue(1);

      const action = makeAction({ automation: { freeCastSpells: undefined } });
      const result = await confirmPhantasmalCreatures(action, makePlayerStats(), campaignName, true);

      expect(result.payload.description).toContain('Summon Beast or Summon Fey');
      expect(result.payload.automation.halvedHp).toBe(true);
    });

    it('uses custom action.name to build the runtime key', async () => {
      getRuntimeValue.mockReturnValue(1);

      const customNameAction = makeAction({ name: 'My Phantasmal Creatures' });
      await confirmPhantasmalCreatures(customNameAction, makePlayerStats(), campaignName, true);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestWizard',
        '_My_Phantasmal_Creatures_freeCastCount',
        0,
        campaignName,
      );
    });

    it('returns automation object containing original type field', async () => {
      getRuntimeValue.mockReturnValue(1);

      const result = await confirmPhantasmalCreatures(makeAction(), makePlayerStats(), campaignName, true);

      expect(result.payload.automation.type).toBe('phantasmal_creatures');
      expect(result.payload.automation.casting_time).toBe('passive');
      expect(result.payload.automation.usesMax).toBe(1);
    });
  });
});
