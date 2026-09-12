import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ------------------------------------------------------------------ */
/*  SUT import                                                         */
/* ------------------------------------------------------------------ */

import { handleGenericAutomation } from './triggerSpells.js';

/* ------------------------------------------------------------------ */
/*  Test-data factories                                                */
/* ------------------------------------------------------------------ */

function makeSpell(automation = { type: 'buff' }) {
  return { name: 'Blade Ward', automation };
}

function makePlayerStats(overrides = {}) {
  return { name: 'TestWizard', level: 5, ...overrides };
}

function makeCharacters() {
  return [{ name: 'TestWizard', level: 5 }];
}

/* ------------------------------------------------------------------ */

describe('handleGenericAutomation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('context parameter forwarding', () => {
    it('passes playerStats, campaignName, mapName, and characters to executeHandler', async () => {
      const executeHandler = vi.fn(async () => null);
      const spell = makeSpell({ type: 'buff' });
      const playerStats = makePlayerStats();
      const campaignName = 'test-campaign';
      const mapName = 'test-map';
      const characters = makeCharacters();

      await handleGenericAutomation({ spell, executeHandler, playerStats, campaignName, mapName, characters });

      expect(executeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Blade Ward',
          spell: spell,
          automation: spell.automation,
          metaCtx: {},
        }),
        playerStats,
        campaignName,
        mapName,
        characters,
      );
    });

    it('returns handled result when handler returns a value', async () => {
      const executeHandler = vi.fn(async () => ({ popup: 'activation' }));
      const spell = makeSpell({ type: 'buff' });
      const playerStats = makePlayerStats();

      const result = await handleGenericAutomation({ spell, executeHandler, playerStats: playerStats, campaignName: 'camp', mapName: 'map', characters: [] });

      expect(result).toEqual({ handled: true, result: { automationPopup: { popup: 'activation' } } });
    });

    it('returns handled true when handler returns null (no popup)', async () => {
      const executeHandler = vi.fn(async () => null);
      const spell = makeSpell({ type: 'buff' });
      const playerStats = makePlayerStats();

      const result = await handleGenericAutomation({ spell, executeHandler, playerStats: playerStats, campaignName: 'camp', mapName: 'map', characters: [] });

      expect(result).toEqual({ handled: true });
    });

    it('does not handle when spell has effects.fail or effects.success', async () => {
      const executeHandler = vi.fn(async () => null);
      const spell = makeSpell({ type: 'buff', effects: { fail: 'save' } });
      const playerStats = makePlayerStats();

      const result = await handleGenericAutomation({ spell, executeHandler, playerStats: playerStats, campaignName: 'camp', mapName: 'map', characters: [] });

      expect(result).toEqual({ handled: false });
      expect(executeHandler).not.toHaveBeenCalled();
    });

    it('does not handle spells in SERVICE_HANDLED_SPELLS set', async () => {
      const executeHandler = vi.fn(async () => null);
      const spell = makeSpell({ type: 'buff' });

      // 'hex' is in SERVICE_HANDLED_SPELLS
      spell.name = 'Hex';

      const result = await handleGenericAutomation({ spell, executeHandler, playerStats: makePlayerStats(), campaignName: 'camp', mapName: 'map', characters: [] });

      expect(result).toEqual({ handled: false });
      expect(executeHandler).not.toHaveBeenCalled();
    });

    it('handles blade_ward automation type with all context params', async () => {
      const executeHandler = vi.fn(async () => ({
        type: 'popup',
        payload: { type: 'automation_info', name: 'Blade Ward' },
      }));
      const spell = makeSpell({ type: 'buff' });
      const playerStats = makePlayerStats();
      const campaignName = 'test-campaign';
      const mapName = 'test-map';
      const characters = makeCharacters();

      const result = await handleGenericAutomation({ spell, executeHandler, playerStats, campaignName, mapName, characters });

      expect(result.handled).toBe(true);
      expect(executeHandler).toHaveBeenCalledWith(
        expect.any(Object),
        playerStats,
        campaignName,
        mapName,
        characters,
      );
    });

    it('does not handle compulsion since it uses spell gate multi-target path', async () => {
      const executeHandler = vi.fn(async () => null);
      // Actual compulsion spell data has NO automation.type, only status_effects and dc
      const spell = { name: 'Compulsion', status_effects: ['Charmed'], dc: { dc_type: 'WIS', dc_success: 'none' } };

      const result = await handleGenericAutomation({ spell, executeHandler, playerStats: makePlayerStats(), campaignName: 'camp', mapName: 'map', characters: [] });

      expect(result).toEqual({ handled: false });
      expect(executeHandler).not.toHaveBeenCalled();
    });
  });
});
