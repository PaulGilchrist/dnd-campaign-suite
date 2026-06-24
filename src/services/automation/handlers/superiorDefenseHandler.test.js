// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle, activateAtTurnStart } from './superiorDefenseHandler.js';
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

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Configure getRuntimeValue to dispatch on key, returning the appropriate value.
 * Returns a function to call before each test so the mock is fresh.
 */
function mockGetRuntimeValue(dispatch) {
  runtimeState.getRuntimeValue.mockImplementation((playerName, key, _cName) => dispatch(playerName, key, _cName));
}

// ── Tests ──────────────────────────────────────────────────────

describe('superiorDefenseHandler', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('handle', () => {
    describe('Buff deactivation', () => {
      it('should deactivate when buff is already active', async () => {
        mockGetRuntimeValue((playerName, key, _cName) => {
          if (key === 'activeBuffs') return [{ name: 'Superior Defense', effect: 'damage_resistance' }];
          return null;
        });

        const action = {
          name: 'Superior Defense',
          automation: { type: 'superior_defense' },
        };

        const result = await handle(action, makePlayerStats(), campaignName);

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
          campaignName
        );
        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
          type: 'ability_use',
          characterName: 'TestHero',
          abilityName: 'Superior Defense',
          description: 'TestHero ended Superior Defense.',
        });
      });

      it('should remove only the matching buff and preserve others', async () => {
        mockGetRuntimeValue((playerName, key, _cName) => {
          if (key === 'activeBuffs') return [
            { name: 'Superior Defense', effect: 'damage_resistance', duration: '1_minute' },
            { name: 'Other Buff', effect: 'other' },
          ];
          return null;
        });

        const action = {
          name: 'Superior Defense',
          automation: { type: 'superior_defense' },
        };

        await handle(action, makePlayerStats(), campaignName);

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
          'TestHero',
          'activeBuffs',
          [{ name: 'Other Buff', effect: 'other' }],
          campaignName
        );
      });

      it('should return automation object in payload', async () => {
        mockGetRuntimeValue((playerName, key, _cName) => {
          if (key === 'activeBuffs') return [{ name: 'Superior Defense' }];
          return null;
        });

        const auto = { type: 'superior_defense', cost: 3 };
        const action = {
          name: 'Superior Defense',
          automation: auto,
        };

        const result = await handle(action, makePlayerStats(), campaignName);

        expect(result.payload.automation).toEqual(auto);
        expect(result.payload.automationType).toBe('superior_defense');
        expect(result.payload.name).toBe('Superior Defense');
      });

      it('should handle addEntry rejection gracefully', async () => {
        mockGetRuntimeValue((playerName, key, _cName) => {
          if (key === 'activeBuffs') return [{ name: 'Superior Defense' }];
          return null;
        });
        logService.addEntry.mockRejectedValue(new Error('Network error'));

        const action = {
          name: 'Superior Defense',
          automation: { type: 'superior_defense' },
        };

        const result = await handle(action, makePlayerStats(), campaignName);

        expect(result.payload.description).toBe('Superior Defense ended.');
      });
    });

    describe('Focus point check', () => {
      it('should fail when current focus is less than default cost (3)', async () => {
        mockGetRuntimeValue((playerName, key, _cName) => {
          if (key === 'activeBuffs') return [];
          if (key === 'focusPoints') return 2;
          return null;
        });

        const action = {
          name: 'Superior Defense',
          automation: { type: 'superior_defense' },
        };

        const result = await handle(action, makePlayerStats(), campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toBe(
          'Not enough Focus Points. Superior Defense requires 3 Focus Points.'
        );
        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
        expect(logService.addEntry).not.toHaveBeenCalled();
      });

      it('should fail when current focus is less than custom cost', async () => {
        mockGetRuntimeValue((playerName, key, _cName) => {
          if (key === 'activeBuffs') return [];
          if (key === 'focusPoints') return 2;
          return null;
        });

        const action = {
          name: 'Superior Defense',
          automation: { type: 'superior_defense', cost: 5 },
        };

        const result = await handle(action, makePlayerStats(), campaignName);

        expect(result.payload.description).toBe(
          'Not enough Focus Points. Superior Defense requires 5 Focus Points.'
        );
      });

      it('should fail when maxFocus is 0 (no class_levels)', async () => {
        const ps = makePlayerStats({ class: { class_levels: [] } });
        mockGetRuntimeValue((playerName, key, _cName) => {
          if (key === 'activeBuffs') return [];
          if (key === 'focusPoints') return 0;
          return null;
        });

        const action = {
          name: 'Superior Defense',
          automation: { type: 'superior_defense' },
        };

        const result = await handle(action, ps, campaignName);

        expect(result.payload.description).toBe(
          'Not enough Focus Points. Superior Defense requires 3 Focus Points.'
        );
      });

      it('should use default cost of 3 when auto.cost is null', async () => {
        mockGetRuntimeValue((playerName, key, _cName) => {
          if (key === 'activeBuffs') return [];
          if (key === 'focusPoints') return 3;
          return null;
        });

        const action = {
          name: 'Superior Defense',
          automation: { type: 'superior_defense', cost: null },
        };

        const result = await handle(action, makePlayerStats(), campaignName);

        expect(result.payload.description).toContain('0 Focus Points remaining');
      });

      it('should use default cost of 3 when auto.cost is undefined', async () => {
        mockGetRuntimeValue((playerName, key, _cName) => {
          if (key === 'activeBuffs') return [];
          if (key === 'focusPoints') return 3;
          return null;
        });

        const action = {
          name: 'Superior Defense',
          automation: { type: 'superior_defense' },
        };

        const result = await handle(action, makePlayerStats(), campaignName);

        expect(result.payload.description).toContain('0 Focus Points remaining');
      });
    });

    describe('Buff activation', () => {
      it('should activate buff when focus is sufficient', async () => {
        mockGetRuntimeValue((playerName, key, _cName) => {
          if (key === 'activeBuffs') return [];
          if (key === 'focusPoints') return 6;
          return null;
        });

        const action = {
          name: 'Superior Defense',
          automation: { type: 'superior_defense' },
        };

        const result = await handle(action, makePlayerStats(), campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toBe(
          'Superior Defense activated. Resistance to all damage except Force for 1 minute or until Incapacitated. (3 Focus Points remaining)'
        );
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
          'TestHero',
          'focusPoints',
          3,
          campaignName
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
          campaignName
        );
        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
          type: 'ability_use',
          characterName: 'TestHero',
          abilityName: 'Superior Defense',
          description: 'TestHero activated Superior Defense. Resistance to all damage except Force for 1 minute or until Incapacitated.',
        });
      });

      it('should use custom duration from auto.duration when provided', async () => {
        mockGetRuntimeValue((playerName, key, _cName) => {
          if (key === 'activeBuffs') return [];
          if (key === 'focusPoints') return 6;
          return null;
        });

        const action = {
          name: 'Superior Defense',
          automation: { type: 'superior_defense', duration: '10_minutes' },
        };

        await handle(action, makePlayerStats(), campaignName);

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
          'TestHero',
          'activeBuffs',
          expect.arrayContaining([
            expect.objectContaining({ duration: '10_minutes' }),
          ]),
          campaignName
        );
      });

      it('should use default duration of 1_minute when auto.duration is missing', async () => {
        mockGetRuntimeValue((playerName, key, _cName) => {
          if (key === 'activeBuffs') return [];
          if (key === 'focusPoints') return 6;
          return null;
        });

        const action = {
          name: 'Superior Defense',
          automation: { type: 'superior_defense' },
        };

        await handle(action, makePlayerStats(), campaignName);

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
          'TestHero',
          'activeBuffs',
          expect.arrayContaining([
            expect.objectContaining({ duration: '1_minute' }),
          ]),
          campaignName
        );
      });

      it('should add buff to existing buffs array', async () => {
        mockGetRuntimeValue((playerName, key, _cName) => {
          if (key === 'activeBuffs') return [{ name: 'Other Buff', effect: 'other' }];
          if (key === 'focusPoints') return 6;
          return null;
        });

        const action = {
          name: 'Superior Defense',
          automation: { type: 'superior_defense' },
        };

        await handle(action, makePlayerStats(), campaignName);

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
          'TestHero',
          'activeBuffs',
          expect.arrayContaining([
            expect.objectContaining({ name: 'Other Buff' }),
            expect.objectContaining({ name: 'Superior Defense' }),
          ]),
          campaignName
        );
      });

      it('should handle non-array stored activeBuffs by treating as empty', async () => {
        mockGetRuntimeValue((playerName, key, _cName) => {
          if (key === 'activeBuffs') return 'invalid';
          if (key === 'focusPoints') return 6;
          return null;
        });

        const action = {
          name: 'Superior Defense',
          automation: { type: 'superior_defense' },
        };

        const result = await handle(action, makePlayerStats(), campaignName);

        expect(result.payload.description).toContain('activated');
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
          'TestHero',
          'activeBuffs',
          expect.arrayContaining([
            expect.objectContaining({ name: 'Superior Defense' }),
          ]),
          campaignName
        );
      });

      it('should handle addEntry rejection during activation gracefully', async () => {
        mockGetRuntimeValue((playerName, key, _cName) => {
          if (key === 'activeBuffs') return [];
          if (key === 'focusPoints') return 6;
          return null;
        });
        logService.addEntry.mockRejectedValue(new Error('Network error'));

        const action = {
          name: 'Superior Defense',
          automation: { type: 'superior_defense' },
        };

        const result = await handle(action, makePlayerStats(), campaignName);

        expect(result.payload.description).toContain('activated');
      });

      it('should handle focusPoints stored as string by converting to number', async () => {
        mockGetRuntimeValue((playerName, key, _cName) => {
          if (key === 'activeBuffs') return [];
          if (key === 'focusPoints') return '6';
          return null;
        });

        const action = {
          name: 'Superior Defense',
          automation: { type: 'superior_defense' },
        };

        const result = await handle(action, makePlayerStats(), campaignName);

        expect(result.payload.description).toContain('3 Focus Points remaining');
      });

      it('should use maxFocus as fallback when focusPoints not in runtime state', async () => {
        mockGetRuntimeValue((playerName, key, _cName) => {
          if (key === 'activeBuffs') return [];
          if (key === 'focusPoints') return undefined;
          return null;
        });

        const action = {
          name: 'Superior Defense',
          automation: { type: 'superior_defense' },
        };

        const result = await handle(action, makePlayerStats(), campaignName);

        expect(result.payload.description).toContain('3 Focus Points remaining');
      });

      it('should use currentFocus from runtime state over maxFocus when both available', async () => {
        mockGetRuntimeValue((playerName, key, _cName) => {
          if (key === 'activeBuffs') return [];
          if (key === 'focusPoints') return 4;
          return null;
        });

        const action = {
          name: 'Superior Defense',
          automation: { type: 'superior_defense' },
        };

        const result = await handle(action, makePlayerStats(), campaignName);

        expect(result.payload.description).toContain('1 Focus Points remaining');
      });
    });
  });

  describe('activateAtTurnStart', () => {
    describe('Incapacitated check', () => {
      it('should return early when player is incapacitated', async () => {
        mockGetRuntimeValue((playerName, key) => {
          if (key === 'activeConditions') return ['Incapacitated'];
          return null;
        });

        const result = await activateAtTurnStart(
          makePlayerStats(),
          campaignName
        );

        expect(result).toEqual({ activated: false, reason: 'incapacitated' });
        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
        expect(logService.addEntry).not.toHaveBeenCalled();
      });

      it('should return early when player has incapacitated condition (case insensitive)', async () => {
        mockGetRuntimeValue((playerName, key) => {
          if (key === 'activeConditions') return ['INCAPACITATED'];
          return null;
        });

        const result = await activateAtTurnStart(
          makePlayerStats(),
          campaignName
        );

        expect(result).toEqual({ activated: false, reason: 'incapacitated' });
      });

      it('should return early when incapacitated is among multiple conditions', async () => {
        mockGetRuntimeValue((playerName, key) => {
          if (key === 'activeConditions') return ['Blinded', 'Incapacitated', 'Deafened'];
          return null;
        });

        const result = await activateAtTurnStart(
          makePlayerStats(),
          campaignName
        );

        expect(result).toEqual({ activated: false, reason: 'incapacitated' });
      });
    });

    describe('Already active check', () => {
      it('should return early when buff is already active', async () => {
        mockGetRuntimeValue((playerName, key) => {
          if (key === 'activeConditions') return [];
          if (key === 'activeBuffs') return [{ name: 'Superior Defense', effect: 'damage_resistance' }];
          return null;
        });

        const result = await activateAtTurnStart(
          makePlayerStats(),
          campaignName
        );

        expect(result).toEqual({ activated: false, reason: 'already_active' });
        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
      });

      it('should check among multiple buffs', async () => {
        mockGetRuntimeValue((playerName, key) => {
          if (key === 'activeConditions') return [];
          if (key === 'activeBuffs') return [
            { name: 'Mage Armor', effect: 'mage_armor' },
            { name: 'Superior Defense', effect: 'damage_resistance' },
            { name: 'Bless', effect: 'bless' },
          ];
          return null;
        });

        const result = await activateAtTurnStart(
          makePlayerStats(),
          campaignName
        );

        expect(result).toEqual({ activated: false, reason: 'already_active' });
      });
    });

    describe('Automation check', () => {
      it('should return early when no automation found (empty specialActions)', async () => {
        mockGetRuntimeValue((playerName, key) => {
          if (key === 'activeConditions') return [];
          if (key === 'activeBuffs') return [];
          return null;
        });

        const ps = makePlayerStats({
          automation: { specialActions: [] },
        });

        const result = await activateAtTurnStart(ps, campaignName);

        expect(result).toEqual({ activated: false, reason: 'no_automation' });
        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
      });

      it('should return early when specialActions is undefined', async () => {
        mockGetRuntimeValue((playerName, key) => {
          if (key === 'activeConditions') return [];
          if (key === 'activeBuffs') return [];
          return null;
        });

        const ps = makePlayerStats({ automation: undefined });

        const result = await activateAtTurnStart(ps, campaignName);

        expect(result).toEqual({ activated: false, reason: 'no_automation' });
      });

      it('should return early when playerStats.automation is undefined', async () => {
        mockGetRuntimeValue((playerName, key) => {
          if (key === 'activeConditions') return [];
          if (key === 'activeBuffs') return [];
          return null;
        });

        const ps = makePlayerStats();
        delete ps.automation;

        const result = await activateAtTurnStart(ps, campaignName);

        expect(result).toEqual({ activated: false, reason: 'no_automation' });
      });
    });

    describe('Focus point check', () => {
      it('should return insufficient_focus when focus is below cost', async () => {
        mockGetRuntimeValue((playerName, key) => {
          if (key === 'activeConditions') return [];
          if (key === 'activeBuffs') return [];
          if (key === 'focusPoints') return 1;
          return null;
        });

        const ps = makePlayerStats({
          automation: {
            specialActions: [
              { name: 'Superior Defense', automation: { type: 'superior_defense', cost: 3 } },
            ],
          },
        });

        const result = await activateAtTurnStart(ps, campaignName);

        expect(result).toEqual({
          activated: false,
          reason: 'insufficient_focus',
          cost: 3,
          available: 1,
        });
        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
      });

      it('should use default cost of 3 when auto.cost is missing', async () => {
        mockGetRuntimeValue((playerName, key) => {
          if (key === 'activeConditions') return [];
          if (key === 'activeBuffs') return [];
          if (key === 'focusPoints') return 2;
          return null;
        });

        const ps = makePlayerStats({
          automation: {
            specialActions: [
              { name: 'Superior Defense', automation: { type: 'superior_defense' } },
            ],
          },
        });

        const result = await activateAtTurnStart(ps, campaignName);

        expect(result).toEqual({
          activated: false,
          reason: 'insufficient_focus',
          cost: 3,
          available: 2,
        });
      });

      it('should succeed when focus equals cost', async () => {
        mockGetRuntimeValue((playerName, key) => {
          if (key === 'activeConditions') return [];
          if (key === 'activeBuffs') return [];
          if (key === 'focusPoints') return 3;
          return null;
        });

        const ps = makePlayerStats({
          automation: {
            specialActions: [
              { name: 'Superior Defense', automation: { type: 'superior_defense', cost: 3 } },
            ],
          },
        });

        const result = await activateAtTurnStart(ps, campaignName);

        expect(result.activated).toBe(true);
        expect(result.remainingFocus).toBe(0);
      });
    });

    describe('Buff activation', () => {
      it('should activate buff and return success', async () => {
        mockGetRuntimeValue((playerName, key) => {
          if (key === 'activeConditions') return [];
          if (key === 'activeBuffs') return [];
          if (key === 'focusPoints') return 6;
          return null;
        });

        const ps = makePlayerStats({
          automation: {
            specialActions: [
              { name: 'Superior Defense', automation: { type: 'superior_defense', cost: 3 } },
            ],
          },
        });

        const result = await activateAtTurnStart(ps, campaignName);

        expect(result).toEqual({ activated: true, remainingFocus: 3 });
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
          'TestHero',
          'focusPoints',
          3,
          campaignName
        );
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
          'TestHero',
          'activeBuffs',
          expect.arrayContaining([
            expect.objectContaining({
              name: 'Superior Defense',
              effect: 'damage_resistance',
              duration: '1_minute',
              resistanceTypes: [
                'acid', 'bludgeoning', 'cold', 'fire', 'lightning',
                'piercing', 'poison', 'slashing', 'thunder',
                'necrotic', 'psychic', 'radiant',
              ],
            }),
          ]),
          campaignName
        );
        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
          type: 'ability_use',
          characterName: 'TestHero',
          abilityName: 'Superior Defense',
          description: 'TestHero activated Superior Defense at start of turn. Resistance to all damage except Force.',
        });
      });

      it('should use custom duration from automation', async () => {
        mockGetRuntimeValue((playerName, key) => {
          if (key === 'activeConditions') return [];
          if (key === 'activeBuffs') return [];
          if (key === 'focusPoints') return 6;
          return null;
        });

        const ps = makePlayerStats({
          automation: {
            specialActions: [
              { name: 'Superior Defense', automation: { type: 'superior_defense', cost: 3, duration: '10_minutes' } },
            ],
          },
        });

        await activateAtTurnStart(ps, campaignName);

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
          'TestHero',
          'activeBuffs',
          expect.arrayContaining([
            expect.objectContaining({ duration: '10_minutes' }),
          ]),
          campaignName
        );
      });

      it('should add buff to existing buffs', async () => {
        mockGetRuntimeValue((playerName, key) => {
          if (key === 'activeConditions') return [];
          if (key === 'activeBuffs') return [{ name: 'Mage Armor', effect: 'mage_armor' }];
          if (key === 'focusPoints') return 6;
          return null;
        });

        const ps = makePlayerStats({
          automation: {
            specialActions: [
              { name: 'Superior Defense', automation: { type: 'superior_defense', cost: 3 } },
            ],
          },
        });

        await activateAtTurnStart(ps, campaignName);

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
          'TestHero',
          'activeBuffs',
          expect.arrayContaining([
            expect.objectContaining({ name: 'Mage Armor' }),
            expect.objectContaining({ name: 'Superior Defense' }),
          ]),
          campaignName
        );
      });

      it('should handle non-array stored activeBuffs by treating as empty', async () => {
        mockGetRuntimeValue((playerName, key) => {
          if (key === 'activeConditions') return [];
          if (key === 'activeBuffs') return 'invalid';
          if (key === 'focusPoints') return 6;
          return null;
        });

        const ps = makePlayerStats({
          automation: {
            specialActions: [
              { name: 'Superior Defense', automation: { type: 'superior_defense', cost: 3 } },
            ],
          },
        });

        const result = await activateAtTurnStart(ps, campaignName);

        expect(result.activated).toBe(true);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
          'TestHero',
          'activeBuffs',
          expect.arrayContaining([
            expect.objectContaining({ name: 'Superior Defense' }),
          ]),
          campaignName
        );
      });

      it('should handle addEntry rejection gracefully', async () => {
        mockGetRuntimeValue((playerName, key) => {
          if (key === 'activeConditions') return [];
          if (key === 'activeBuffs') return [];
          if (key === 'focusPoints') return 6;
          return null;
        });
        logService.addEntry.mockRejectedValue(new Error('Network error'));

        const ps = makePlayerStats({
          automation: {
            specialActions: [
              { name: 'Superior Defense', automation: { type: 'superior_defense', cost: 3 } },
            ],
          },
        });

        const result = await activateAtTurnStart(ps, campaignName);

        expect(result.activated).toBe(true);
      });

      it('should use maxFocus as fallback when focusPoints not in runtime state', async () => {
        mockGetRuntimeValue((playerName, key) => {
          if (key === 'activeConditions') return [];
          if (key === 'activeBuffs') return [];
          if (key === 'focusPoints') return undefined;
          return null;
        });

        const ps = makePlayerStats({
          automation: {
            specialActions: [
              { name: 'Superior Defense', automation: { type: 'superior_defense', cost: 3 } },
            ],
          },
        });

        const result = await activateAtTurnStart(ps, campaignName);

        expect(result.activated).toBe(true);
        expect(result.remainingFocus).toBe(3);
      });

      it('should handle focusPoints stored as string', async () => {
        mockGetRuntimeValue((playerName, key) => {
          if (key === 'activeConditions') return [];
          if (key === 'activeBuffs') return [];
          if (key === 'focusPoints') return '6';
          return null;
        });

        const ps = makePlayerStats({
          automation: {
            specialActions: [
              { name: 'Superior Defense', automation: { type: 'superior_defense', cost: 3 } },
            ],
          },
        });

        const result = await activateAtTurnStart(ps, campaignName);

        expect(result.activated).toBe(true);
        expect(result.remainingFocus).toBe(3);
      });

      it('should use custom cost from automation', async () => {
        mockGetRuntimeValue((playerName, key) => {
          if (key === 'activeConditions') return [];
          if (key === 'activeBuffs') return [];
          if (key === 'focusPoints') return 8;
          return null;
        });

        const ps = makePlayerStats({
          automation: {
            specialActions: [
              { name: 'Superior Defense', automation: { type: 'superior_defense', cost: 5 } },
            ],
          },
        });

        const result = await activateAtTurnStart(ps, campaignName);

        expect(result.activated).toBe(true);
        expect(result.remainingFocus).toBe(3);
      });
    });
  });
});
