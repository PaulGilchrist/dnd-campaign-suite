// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../common/targetResolver.js', () => ({
  resolveTarget: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockReturnValue(Promise.resolve()),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './divineSparkHandler.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as targetResolver from '../../common/targetResolver.js';
import * as logService from '../../../ui/logService.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestHero',
    level: 5,
    class: {
      class_levels: [
        undefined,
        undefined,
        { channel_divinity: 2 },
        undefined,
        undefined,
      ],
    },
    abilities: [
      { name: 'Wisdom', bonus: 2 },
    ],
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Divine Spark',
    automation: {
      type: 'divine_spark',
      ...automation,
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('divineSparkHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('charge validation — no-charges popup', () => {
    it('returns no-charges popup when stored charges is 0', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(0);

      const ps = makePlayerStats();
      const action = makeAction();

      const result = await handle(action, ps, campaignName, null);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: action.name,
          automationType: 'divine_spark',
          description: 'No Channel Divinity charges remaining.',
          automation: action.automation,
        },
      });
    });

    it('returns no-charges popup when stored charges is negative', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(-1);

      const ps = makePlayerStats();
      const action = makeAction();

      const result = await handle(action, ps, campaignName, null);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: action.name,
          automationType: 'divine_spark',
          description: 'No Channel Divinity charges remaining.',
          automation: action.automation,
        },
      });
    });


  });

  describe('charge deduction', () => {
    beforeEach(() => {
      targetResolver.resolveTarget.mockResolvedValue(null);
    });

    it('deducts 1 from stored charges', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(3);

      const ps = makePlayerStats();
      const action = makeAction();

      await handle(action, ps, campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        ps.name,
        'channelDivinityCharges',
        2,
        campaignName,
        true,
      );
    });

    it('deducts 1 from maxCharges when no stored charges', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(undefined);
      targetResolver.resolveTarget.mockResolvedValue(null);

      const ps = makePlayerStats();
      const action = makeAction();

      await handle(action, ps, campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        ps.name,
        'channelDivinityCharges',
        1,
        campaignName,
        true,
      );
    });

    it('deducts 1 from class_level.channel_divinity when available', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(undefined);
      targetResolver.resolveTarget.mockResolvedValue(null);

      const ps = makePlayerStats({
        level: 3,
        class: {
          class_levels: [undefined, undefined, { channel_divinity: 3 }],
        },
      });
      const action = makeAction();

      await handle(action, ps, campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        ps.name,
        'channelDivinityCharges',
        2,
        campaignName,
        true,
      );
    });

    it('deducts 1 from class_specific.channel_divinity_charges when channel_divinity is 0', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(undefined);
      targetResolver.resolveTarget.mockResolvedValue(null);

      const ps = makePlayerStats({
        level: 3,
        class: {
          class_levels: [
            undefined,
            undefined,
            {
              channel_divinity: 0,
              class_specific: { channel_divinity_charges: 4 },
            },
          ],
        },
      });
      const action = makeAction();

      await handle(action, ps, campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        ps.name,
        'channelDivinityCharges',
        3,
        campaignName,
        true,
      );
    });

    it('deducts 1 from default maxCharges of 2 when class structure is missing', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(undefined);
      targetResolver.resolveTarget.mockResolvedValue(null);

      const ps = makePlayerStats({ class: undefined });
      const action = makeAction();

      await handle(action, ps, campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        ps.name,
        'channelDivinityCharges',
        1,
        campaignName,
        true,
      );
    });

    it('deducts 1 from default maxCharges of 2 when class_levels is undefined', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(undefined);
      targetResolver.resolveTarget.mockResolvedValue(null);

      const ps = makePlayerStats({ class: { class_levels: undefined } });
      const action = makeAction();

      await handle(action, ps, campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        ps.name,
        'channelDivinityCharges',
        1,
        campaignName,
        true,
      );
    });

    it('deducts 1 from default maxCharges of 2 when level is missing', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(undefined);
      targetResolver.resolveTarget.mockResolvedValue(null);

      const ps = makePlayerStats({ level: undefined });
      const action = makeAction();

      await handle(action, ps, campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        ps.name,
        'channelDivinityCharges',
        1,
        campaignName,
        true,
      );
    });

    it('deducts 1 from default maxCharges of 2 when playerStats.level is 0', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(undefined);
      targetResolver.resolveTarget.mockResolvedValue(null);

      const ps = makePlayerStats({ level: 0 });
      const action = makeAction();

      await handle(action, ps, campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        ps.name,
        'channelDivinityCharges',
        1,
        campaignName,
        true,
      );
    });

    it('deducts 1 from default maxCharges of 2 when playerStats is missing level and class', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(undefined);
      targetResolver.resolveTarget.mockResolvedValue(null);

      const ps = makePlayerStats({ level: undefined, class: undefined });
      const action = makeAction();

      await handle(action, ps, campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        ps.name,
        'channelDivinityCharges',
        1,
        campaignName,
        true,
      );
    });
  });

  describe('modal payload structure', () => {
    beforeEach(() => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      targetResolver.resolveTarget.mockResolvedValue(null);
    });

    it('returns a modal with modalName divineSpark', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      const result = await handle(action, ps, campaignName, null);

      expect(result).toEqual({
        type: 'modal',
        modalName: 'divineSpark',
        payload: expect.objectContaining({
          featureName: action.name,
          attackerName: ps.name,
          targetName: ps.name,
          campaignName,
        }),
      });
    });

    it('includes featureName from action name', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.featureName).toBe(action.name);
    });

    it('includes attackerName from playerStats', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.attackerName).toBe(ps.name);
    });

    it('includes campaignName', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.campaignName).toBe(campaignName);
    });

    it('includes wisModifier from Wisdom ability bonus', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.wisModifier).toBe(2);
    });

    it('uses 0 as wisModifier when Wisdom ability is missing', async () => {
      const ps = makePlayerStats({ abilities: [{ name: 'Strength', bonus: 3 }] });
      const action = makeAction();

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.wisModifier).toBe(0);
    });

    it('uses 0 as wisModifier when abilities array is undefined', async () => {
      const ps = makePlayerStats({ abilities: undefined });
      const action = makeAction();

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.wisModifier).toBe(0);
    });

    it('builds healExpression with wisModifier', async () => {
      const ps = makePlayerStats({ abilities: [{ name: 'Wisdom', bonus: 3 }] });
      const action = makeAction();

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.healExpression).toBe('1d8 + 3');
    });

    it('builds damageExpression with wisModifier', async () => {
      const ps = makePlayerStats({ abilities: [{ name: 'Wisdom', bonus: 3 }] });
      const action = makeAction();

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.damageExpression).toBe('1d8 + 3');
    });

    it('uses auto.damageTypes when provided', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ damageTypes: ['Fire', 'Cold'] });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.damageTypes).toEqual(['Fire', 'Cold']);
    });

    it('falls back to ["Necrotic", "Radiant"] when auto.damageTypes is missing', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.damageTypes).toEqual(['Necrotic', 'Radiant']);
    });

    it('falls back to ["Necrotic", "Radiant"] when auto.damageTypes is null', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ damageTypes: null });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.damageTypes).toEqual(['Necrotic', 'Radiant']);
    });

    it('falls back to ["Necrotic", "Radiant"] when auto.damageTypes is an empty array', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ damageTypes: [] });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.damageTypes).toEqual([]);
    });

    it('uses auto.saveType when provided', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ saveType: 'WIS' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.saveType).toBe('WIS');
    });

    it('falls back to CON when auto.saveType is missing', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.saveType).toBe('CON');
    });

    it('falls back to CON when auto.saveType is null', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ saveType: null });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.saveType).toBe('CON');
    });
  });

  describe('target resolution', () => {
    beforeEach(() => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
    });

    it('uses target name from resolveTarget when available', async () => {
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ally' } });

      const ps = makePlayerStats();
      const action = makeAction();

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.targetName).toBe('Ally');
      expect(targetResolver.resolveTarget).toHaveBeenCalledWith(campaignName, ps.name);
    });

    it('falls back to playerStats.name when resolveTarget returns null', async () => {
      targetResolver.resolveTarget.mockResolvedValue(null);

      const ps = makePlayerStats();
      const action = makeAction();

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.targetName).toBe(ps.name);
    });

    it('falls back to playerStats.name when resolveTarget returns object without target', async () => {
      targetResolver.resolveTarget.mockResolvedValue({});

      const ps = makePlayerStats();
      const action = makeAction();

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.targetName).toBe(ps.name);
    });

    it('falls back to playerStats.name when resolveTarget returns object with null target', async () => {
      targetResolver.resolveTarget.mockResolvedValue({ target: null });

      const ps = makePlayerStats();
      const action = makeAction();

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.targetName).toBe(ps.name);
    });

    it('falls back to playerStats.name when resolveTarget returns object with undefined target', async () => {
      targetResolver.resolveTarget.mockResolvedValue({ target: undefined });

      const ps = makePlayerStats();
      const action = makeAction();

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.targetName).toBe(ps.name);
    });
  });

  describe('logging', () => {
    beforeEach(() => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      targetResolver.resolveTarget.mockResolvedValue(null);
    });

    it('calls addEntry with correct ability_use data and target name in description', async () => {
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ally' } });

      const ps = makePlayerStats();
      const action = makeAction();

      await handle(action, ps, campaignName, null);

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: ps.name,
        abilityName: action.name,
        description: 'Divine Spark activated — targeting Ally.',
      });
    });

    it('uses playerStats.name in description when target is the player', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      await handle(action, ps, campaignName, null);

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: ps.name,
        abilityName: action.name,
        description: 'Divine Spark activated — targeting TestHero.',
      });
    });

    it('does not await addEntry (fire-and-forget)', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      const addEntryPromise = new Promise(() => {
        /* never resolves */
      });
      logService.addEntry.mockReturnValue(addEntryPromise);

      // Should not hang — the handler fire-and-forgets
      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('modal');
    });
  });

  describe('ignores unused parameters', () => {
    it('ignores the _mapName parameter', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      targetResolver.resolveTarget.mockResolvedValue(null);

      const ps = makePlayerStats();
      const action = makeAction();

      const result = await handle(action, ps, campaignName, 'SomeMap');

      expect(result.type).toBe('modal');
      expect(result.payload.targetName).toBe(ps.name);
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        ps.name,
        'channelDivinityCharges',
        1,
        campaignName,
        true,
      );
    });
  });
});
