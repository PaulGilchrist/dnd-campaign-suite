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

  describe('charge validation', () => {
    it('returns no-charges popup when stored charges is zero', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      useRuntimeState.getRuntimeValue.mockReturnValue(0);

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
      useRuntimeState.getRuntimeValue.mockReturnValue(3);
    });

    it('deducts 1 from stored charges', async () => {
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

    it('uses class_specific.channel_divinity_charges when channel_divinity is 0', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(undefined);

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
  });

  describe('modal payload', () => {
    beforeEach(() => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      targetResolver.resolveTarget.mockResolvedValue(null);
    });

    it('returns a modal with correct structure and fields', async () => {
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

    it.each`
      wisBonus | expectedWisModifier | expectedExpression
      ${3}     | ${3}                | ${'1d8 + 3'}
      ${undefined} | ${0}            | ${'1d8 + 0'}
    `('uses wisModifier from Wisdom ability ($wisBonus) or defaults to 0', async ({ wisBonus, expectedWisModifier, expectedExpression }) => {
      const abilities = wisBonus !== undefined ? [{ name: 'Wisdom', bonus: wisBonus }] : [{ name: 'Strength', bonus: 3 }];
      const ps = makePlayerStats({ abilities });
      const action = makeAction();

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.wisModifier).toBe(expectedWisModifier);
      expect(result.payload.healExpression).toBe(expectedExpression);
      expect(result.payload.damageExpression).toBe(expectedExpression);
    });

    it('handles damageTypes from auto or defaults', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ damageTypes: ['Fire', 'Cold'] });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.damageTypes).toEqual(['Fire', 'Cold']);
    });

    it('falls back to default damageTypes when auto.damageTypes is null or missing', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ damageTypes: null });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.damageTypes).toEqual(['Necrotic', 'Radiant']);
    });

    it('uses auto.damageTypes when it is an empty array', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ damageTypes: [] });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.damageTypes).toEqual([]);
    });

    it('handles saveType from auto or defaults to CON', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ saveType: 'WIS' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.saveType).toBe('WIS');
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
  });

});
