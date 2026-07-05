// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { executeHandler } from './index.js';

// ── Module-level mocks ─

vi.mock('./handlers/combat/saveOnlyHandler.js', () => ({
  handle: vi.fn().mockResolvedValue({ result: 'save_only' }),
}));
vi.mock('./handlers/healing/healingHandler.js', () => ({
  handle: vi.fn().mockResolvedValue({ result: 'shared_healing' }),
}));
vi.mock('./handlers/combat/autoRerollHandler.js', () => ({
  handle: vi.fn().mockResolvedValue({ result: 'auto_reroll' }),
}));
vi.mock('./handlers/class-wizard/SavantHandler.js', () => ({
  handle: vi.fn().mockResolvedValue({ result: 'savant' }),
}));
vi.mock('./handlers/combat/damageReductionHandler.js', () => ({
  handle: vi.fn().mockResolvedValue({ result: 'damage_reduction' }),
}));
vi.mock('./handlers/class-sorcerer/protectiveFieldHandler.js', () => ({
  handle: vi.fn().mockResolvedValue({ result: 'protective_field' }),
}));
vi.mock('../../../shared/popupResponse.js', () => ({
  automationInfoPopup: vi.fn().mockReturnValue({ type: 'popup', payload: { type: 'automation_info', description: 'test' } }),
}));

// ── Helpers ─────────────────────────────────────────────────────

const campaignName = 'TestCampaign';
const mapName = 'TestMap';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestHero',
    level: 3,
    proficiencyBonus: 2,
    abilities: [{ name: 'Strength', bonus: 2 }],
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return { name: 'Test Action', automation: { ...automation } };
}

// ── Tests ───────────────────────────────────────────────────────

describe('executeHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('null/early returns', () => {
    it.each([
      [null, 'null action'],
      [undefined, 'undefined action'],
      [{}, 'empty object'],
      [{ automation: null }, 'null automation'],
    ])('returns null for %s (%s)', async (action, _label) => {
      expect(await executeHandler(action, makePlayerStats(), campaignName, mapName)).toBeNull();
    });

    it('returns null when action.automation.type is not in HANDLER_MAP', async () => {
      const result = await executeHandler(
        makeAction({ type: 'nonexistent_type' }),
        makePlayerStats(),
        campaignName,
        mapName,
      );
      expect(result).toBeNull();
    });
  });

  describe('handler routing', () => {
    it('routes a known handler type and returns its result', async () => {
      const { handle: saveOnlyHandle } = await import('./handlers/combat/saveOnlyHandler.js');
      saveOnlyHandle.mockResolvedValue({ result: 'save_only' });

      const action = makeAction({ type: 'save_only' });
      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(saveOnlyHandle).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ result: 'save_only' });
    });

    it('routes a shared handler (healing) used by multiple automation types', async () => {
      const { handle: healingHandle } = await import('./handlers/healing/healingHandler.js');
      healingHandle.mockResolvedValue({ result: 'shared_healing' });

      const action = makeAction({ type: 'healing' });
      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(healingHandle).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ result: 'shared_healing' });
    });

    it('routes a second type sharing the same handler (self_healing)', async () => {
      const { handle: healingHandle } = await import('./handlers/healing/healingHandler.js');
      healingHandle.mockResolvedValue({ result: 'shared_healing' });

      const action = makeAction({ type: 'self_healing' });
      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(healingHandle).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ result: 'shared_healing' });
    });
  });


  describe('error handling', () => {
    let originalConsoleError;

    beforeEach(() => {
      originalConsoleError = console.error;
      console.error = vi.fn();
    });

    afterEach(() => {
      console.error = originalConsoleError;
    });

    it('returns a popup with action.name when handler throws', async () => {
      const { handle: healingHandle } = await import('./handlers/healing/healingHandler.js');
      const action = makeAction({ type: 'healing' });
      action.name = 'Cure Wounds';
      healingHandle.mockRejectedValue(new Error('boom'));

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe('Failed to execute Cure Wounds');
    });
  });

  describe('spell_modifier handler', () => {
    it('returns automation_info popup for non-Metamagic types', async () => {
      const action = makeAction({ type: 'spell_modifier' });
      action.name = 'Quickened Spell';

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Quickened Spell');
    });

    it('returns null for Metamagic type', async () => {
      const action = makeAction({ type: 'spell_modifier' });
      action.name = 'Metamagic';

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(result).toBeNull();
    });
  });

  describe('damage_reduction handler', () => {
    it('routes to protectiveField when automation.cost.resource is psionicEnergy', async () => {
      const action = makeAction({
        type: 'damage_reduction',
        cost: { resource: 'psionicEnergy' },
      });

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(result.result).toBe('protective_field');
    });

    it.each([
      [{ resource: 'something_else' }, 'other resource type'],
      [undefined, 'missing cost'],
      [{}],
    ])('routes to damageReduction when cost is %s', async (cost, _label) => {
      const action = makeAction({
        type: 'damage_reduction',
        cost,
      });

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(result.result).toBe('damage_reduction');
    });
  });

  describe('auto array handling', () => {
    it('selects passive_rule entry when it has a registered handler', async () => {
      const action = {
        name: 'Guarded Mind',
        automation: [
          { type: 'passive_rule', effect: 'abjuration_savant' },
          { type: 'auto_reroll' },
        ],
      };

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(result).toEqual({ result: 'savant' });
    });

    it('selects first entry with a registered handler when no passive_rule present', async () => {
      const action = {
        name: 'Test',
        automation: [
          { type: 'auto_reroll', action: 'Bonus Action' },
          { type: 'auto_reroll' },
        ],
      };

      const { handle: autoRerollHandle } = await import('./handlers/combat/autoRerollHandler.js');
      autoRerollHandle.mockResolvedValue({ result: 'auto_reroll' });

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(result).toEqual({ result: 'auto_reroll' });
    });

    it('returns null when auto array has no actionable entries', async () => {
      const action = {
        name: 'Test',
        automation: [
          { type: 'passive_rule', effect: 'unknown_savant' },
          { type: 'unknown_type' },
        ],
      };

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(result).toBeNull();
    });

    it('returns null when auto array is empty or contains only null entries', async () => {
      const emptyAction = { name: 'Test', automation: [] };
      expect(await executeHandler(emptyAction, makePlayerStats(), campaignName, mapName)).toBeNull();

      const nullAction = { name: 'Test', automation: [null, null] };
      expect(await executeHandler(nullAction, makePlayerStats(), campaignName, mapName)).toBeNull();
    });
  });

  describe('passive_rule handler', () => {
    it.each([
      'abjuration_savant',
      'divination_savant',
      'evocation_savant',
      'illusion_savant',
    ])('routes %s passive_rule to savant handler', async (effect) => {
      const action = makeAction({ type: 'passive_rule', effect });

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(result).toEqual({ result: 'savant' });
    });

    it.each([
      ['unknown_savant', 'unknown effect'],
      [undefined, 'no effect field'],
    ])('returns null for passive_rule with %s', async (effect, _label) => {
      const action = makeAction({ type: 'passive_rule', effect });

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(result).toBeNull();
    });
  });
});
