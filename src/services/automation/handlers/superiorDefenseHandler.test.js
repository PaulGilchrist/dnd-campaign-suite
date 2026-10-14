import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './superiorDefenseHandler.js';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../ui/logService.js';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestHero',
    level: 5,
    class: {
      class_levels: [
        { level: 5, focus_points: 6 },
      ],
    },
    ...overrides,
  };
}

function makeAction(overrides = {}) {
  return {
    name: 'Superior Defense',
    automation: { type: 'superior_defense' },
    ...overrides,
  };
}

function mockRuntimeValues(valuesByKey) {
  runtimeState.getRuntimeValue.mockImplementation((playerName, key) => {
    return valuesByKey[key];
  });
}

describe('superiorDefenseHandler', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('deactivation', () => {
    it('should remove the buff, log, and return ended popup when buff is active', async () => {
      mockRuntimeValues({
        activeBuffs: [{ name: 'Superior Defense', effect: 'damage_resistance' }],
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe('Superior Defense ended.');
      expect(result.payload.name).toBe('Superior Defense');
      expect(result.payload.automationType).toBe('superior_defense');
      expect(result.payload.automation).toEqual({ type: 'superior_defense' });
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestHero',
        'activeBuffs',
        [],
        campaignName,
      );
      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestHero',
        abilityName: 'Superior Defense',
        description: 'TestHero ended Superior Defense.',
      });
    });

    it('should remove only the matching buff and preserve others', async () => {
      mockRuntimeValues({
        activeBuffs: [
          { name: 'Superior Defense', effect: 'damage_resistance', duration: '1_minute' },
          { name: 'Other Buff', effect: 'other' },
        ],
      });

      await handle(makeAction(), makePlayerStats(), campaignName);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestHero',
        'activeBuffs',
        [{ name: 'Other Buff', effect: 'other' }],
        campaignName,
      );
    });

    it('should handle addEntry rejection during deactivation without throwing', async () => {
      mockRuntimeValues({
        activeBuffs: [{ name: 'Superior Defense', effect: 'damage_resistance' }],
      });
      logService.addEntry.mockRejectedValue(new Error('log failure'));

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.payload.description).toBe('Superior Defense ended.');
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestHero',
        'activeBuffs',
        [],
        campaignName,
      );
    });
  });

  describe('focus point validation', () => {
    it('should fail when focus is below default cost (3)', async () => {
      mockRuntimeValues({
        activeBuffs: [],
        focusPoints: 2,
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe(
        'Not enough Focus Points. Superior Defense requires 3 Focus Points.',
      );
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('should fail when focus is below a custom cost', async () => {
      mockRuntimeValues({
        activeBuffs: [],
        focusPoints: 2,
      });

      const result = await handle(
        makeAction({ automation: { type: 'superior_defense', cost: 5 } }),
        makePlayerStats(),
        campaignName,
      );

      expect(result.payload.description).toBe(
        'Not enough Focus Points. Superior Defense requires 5 Focus Points.',
      );
    });

    it('should use maxFocus when focusPoints is missing', async () => {
      mockRuntimeValues({
        activeBuffs: [],
        focusPoints: undefined,
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.payload.description).toContain('3 Focus Points remaining');
    });
  });

  describe('activation', () => {
    it('should activate buff when focus is sufficient', async () => {
      mockRuntimeValues({
        activeBuffs: [],
        focusPoints: 6,
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe(
        'Superior Defense activated. Resistance to all damage except Force for 1 minute or until Incapacitated. (3 Focus Points remaining)',
      );
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestHero',
        'focusPoints',
        3,
        campaignName,
      );
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestHero',
        'activeBuffs',
        [
          {
            name: 'Superior Defense',
            effect: 'damage_resistance',
            duration: '1_minute',
            resistanceTypes: [
              'acid', 'bludgeoning', 'cold', 'fire', 'lightning',
              'piercing', 'poison', 'slashing', 'thunder',
              'necrotic', 'psychic', 'radiant',
            ],
          },
        ],
        campaignName,
      );
      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestHero',
        abilityName: 'Superior Defense',
        description: 'TestHero activated Superior Defense. Resistance to all damage except Force for 1 minute or until Incapacitated.',
      });
    });

    it('should add buff to existing buffs array', async () => {
      mockRuntimeValues({
        activeBuffs: [{ name: 'Other Buff', effect: 'other' }],
        focusPoints: 6,
      });

      await handle(makeAction(), makePlayerStats(), campaignName);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestHero',
        'activeBuffs',
        expect.arrayContaining([
          expect.objectContaining({ name: 'Other Buff' }),
          expect.objectContaining({ name: 'Superior Defense' }),
        ]),
        campaignName,
      );
    });

    it('should use custom duration from automation when provided', async () => {
      mockRuntimeValues({
        activeBuffs: [],
        focusPoints: 6,
      });

      await handle(
        makeAction({ automation: { type: 'superior_defense', duration: '10_minutes' } }),
        makePlayerStats(),
        campaignName,
      );

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestHero',
        'focusPoints',
        3,
        campaignName,
      );
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestHero',
        'activeBuffs',
        expect.arrayContaining([
          expect.objectContaining({ duration: '10_minutes' }),
        ]),
        campaignName,
      );
    });

    it('should handle non-array stored activeBuffs by treating as empty', async () => {
      mockRuntimeValues({
        activeBuffs: 'invalid',
        focusPoints: 6,
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.payload.description).toContain('activated');
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestHero',
        'activeBuffs',
        expect.arrayContaining([
          expect.objectContaining({ name: 'Superior Defense' }),
        ]),
        campaignName,
      );
    });

    it('should succeed when focus exactly equals the cost (boundary)', async () => {
      mockRuntimeValues({
        activeBuffs: [],
        focusPoints: 3,
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.payload.description).toContain('0 Focus Points remaining');
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestHero',
        'focusPoints',
        0,
        campaignName,
      );
    });

    it('should handle addEntry rejection during activation without throwing', async () => {
      mockRuntimeValues({
        activeBuffs: [],
        focusPoints: 6,
      });
      logService.addEntry.mockRejectedValue(new Error('log failure'));

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.payload.description).toContain('activated');
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestHero',
        'focusPoints',
        3,
        campaignName,
      );
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestHero',
        'activeBuffs',
        expect.arrayContaining([
          expect.objectContaining({ name: 'Superior Defense' }),
        ]),
        campaignName,
      );
    });
  });
});
