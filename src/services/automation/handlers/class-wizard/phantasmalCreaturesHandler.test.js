// @maintained-by-ai
// class-wizard lane — CLA-252 Phantasmal Creatures handler contracts.
// Deterministic pure behaviour over mocked runtime accessors: no timers, no DOM,
// no registry internals. Handler stays live via HANDLER_MAP registration in
// services/automation/index.js ('phantasmal_creatures' / 'phantasmal_creatures_confirm');
// feature data authored in public/data/2024/classes.json (Illusionist lv6).
// NOTE (flagged, not acted on): the modal 'phantasmalCreatures' is not wired into any
// UI dispatch table and this handler's shared key `_Phantasmal_Creatures_freeCastCount`
// has no consumer/rest-reset — the live CLA-252 free-cast lane uses per-spell keys
// `_Phantasmal_Creatures_<Spell>_freeCastCount` in spellPreparationService/restRules.

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

  it('exports stable lane identifiers (modal + confirm)', () => {
    expect(modalName).toBe('phantasmalCreatures');
    expect(confirmType).toBe('phantasmal_creatures_confirm');
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

    it('returns info popup when free casts are spent (zero or negative), never reading past the guard', async () => {
      const action = makeAction();

      getRuntimeValue.mockReturnValue(0);
      expect(await handle(action, makePlayerStats(), campaignName)).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Phantasmal Creatures',
          description: 'No free casts remaining. Finish a Long Rest to regain them.',
          automation: action.automation,
        },
      });

      getRuntimeValue.mockReturnValue(-1);
      const negative = await handle(action, makePlayerStats(), campaignName);
      expect(negative.type).toBe('popup');
      expect(negative.payload.description).toBe('No free casts remaining. Finish a Long Rest to regain them.');

      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('falls back to usesMax when runtime value is null or undefined (?? branch)', async () => {
      getRuntimeValue.mockReturnValue(null);
      let result = await handle(makeAction({ automation: { usesMax: 2 } }), makePlayerStats(), campaignName);
      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('phantasmalCreatures');

      getRuntimeValue.mockReturnValue(undefined);
      result = await handle(makeAction(), makePlayerStats(), campaignName);
      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('phantasmalCreatures');
    });

    it('opens modal when runtime value is a non-numeric string (Number() → NaN, not ≤ 0)', async () => {
      getRuntimeValue.mockReturnValue('not a number');

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

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
    it('decrements free cast count and returns the full info popup payload', async () => {
      getRuntimeValue.mockReturnValue(1);

      const action = makeAction();
      const result = await confirmPhantasmalCreatures(action, makePlayerStats(), campaignName, true);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestWizard',
        '_Phantasmal_Creatures_freeCastCount',
        0,
        campaignName,
      );
      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Phantasmal Creatures',
          description: 'Phantasmal Creatures: Free cast of Summon Beast or Summon Fey (0 remaining). The spell school becomes Illusion and the summoned creature\'s HP is halved.<br/><br/><em>Open your spell sheet and cast Summon Beast or Summon Fey normally — no spell slot will be consumed.</em>',
          automation: {
            ...action.automation,
            noConcentration: true,
            halvedHp: true,
          },
        },
      });
    });

    it('decrements a runtime count above one — runtime value, not usesMax, is the source', async () => {
      getRuntimeValue.mockReturnValue(3); // usesMax stays 1 in makeAction defaults

      await confirmPhantasmalCreatures(makeAction(), makePlayerStats(), campaignName, false);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestWizard',
        '_Phantasmal_Creatures_freeCastCount',
        2,
        campaignName,
      );
    });

    it('returns info popup and never writes when no free casts remain (zero or negative)', async () => {
      const action = makeAction();

      getRuntimeValue.mockReturnValue(0);
      expect(await confirmPhantasmalCreatures(action, makePlayerStats(), campaignName, true)).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Phantasmal Creatures',
          description: 'No free casts remaining. Finish a Long Rest to regain them.',
          automation: action.automation,
        },
      });

      getRuntimeValue.mockReturnValue(-2);
      const negative = await confirmPhantasmalCreatures(action, makePlayerStats(), campaignName, true);
      expect(negative.type).toBe('popup');
      expect(negative.payload.description).toBe('No free casts remaining. Finish a Long Rest to regain them.');

      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('forwards noConcentration=false into payload automation', async () => {
      getRuntimeValue.mockReturnValue(1);

      const result = await confirmPhantasmalCreatures(makeAction(), makePlayerStats(), campaignName, false);

      expect(result.payload.automation.noConcentration).toBe(false);
    });

    it('uses default spell names when freeCastSpells is missing', async () => {
      getRuntimeValue.mockReturnValue(1);

      const result = await confirmPhantasmalCreatures(
        makeAction({ automation: { freeCastSpells: undefined } }),
        makePlayerStats(),
        campaignName,
        true,
      );

      expect(result.payload.description).toContain('Free cast of Summon Beast or Summon Fey');
      expect(result.payload.automation.halvedHp).toBe(true);
    });

    it('joins custom freeCastSpells with " or " (guidance tail stays hardcoded)', async () => {
      getRuntimeValue.mockReturnValue(1);

      const result = await confirmPhantasmalCreatures(
        makeAction({ automation: { freeCastSpells: ['Summon Aberration'] } }),
        makePlayerStats(),
        campaignName,
        true,
      );

      expect(result.payload.description).toContain('Free cast of Summon Aberration (0 remaining)');
      expect(result.payload.description).toContain('cast Summon Beast or Summon Fey normally');
    });

    it('uses custom action.name for the runtime key, popup name, and description prefix', async () => {
      getRuntimeValue.mockReturnValue(1);

      const customNameAction = makeAction({ name: 'My Phantasmal Creatures' });
      const result = await confirmPhantasmalCreatures(customNameAction, makePlayerStats(), campaignName, true);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestWizard',
        '_My_Phantasmal_Creatures_freeCastCount',
        0,
        campaignName,
      );
      expect(result.payload.name).toBe('My Phantasmal Creatures');
      expect(result.payload.description).toContain('My Phantasmal Creatures: Free cast of');
    });
  });
});
