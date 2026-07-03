// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle, confirmPhantasmalCreatures } from './phantasmalCreaturesHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
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

  describe('handle', () => {
    it('returns modal when free casts are available', async () => {
      getRuntimeValue.mockReturnValue(1);

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result).toEqual({
        type: 'modal',
        modalName: 'phantasmalCreatures',
        payload: {
          action: expect.any(Object),
          playerStats: expect.any(Object),
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
      expect(result.payload.description).toContain('No free casts remaining');
    });

    it('falls back to usesMax when runtime value is null', async () => {
      getRuntimeValue.mockReturnValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('modal');
    });

    it('falls back to usesMax when runtime value is undefined', async () => {
      getRuntimeValue.mockReturnValue(undefined);

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('modal');
    });
  });

  describe('confirmPhantasmalCreatures', () => {
    it('decrements free cast count and returns info popup', async () => {
      getRuntimeValue.mockReturnValue(1);

      const result = await confirmPhantasmalCreatures(
        makeAction(),
        makePlayerStats(),
        campaignName,
        true,
      );

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
    });

    it('decrements from custom usesMax value', async () => {
      getRuntimeValue.mockReturnValue(3);

      await confirmPhantasmalCreatures(
        makeAction(),
        makePlayerStats(),
        campaignName,
        false,
      );

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestWizard',
        '_Phantasmal_Creatures_freeCastCount',
        2,
        campaignName,
      );
    });

    it('returns info popup when no free casts remaining', async () => {
      getRuntimeValue.mockReturnValue(0);

      const result = await confirmPhantasmalCreatures(
        makeAction(),
        makePlayerStats(),
        campaignName,
        true,
      );

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

      const result = await confirmPhantasmalCreatures(
        makeAction(),
        makePlayerStats(),
        campaignName,
        true,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No free casts remaining');
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });
  });
});
