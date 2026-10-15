// @maintained-by-ai: 2026-10-15
// Deterministic contract test for divineSparkHandler: all seams (runtime store,
// target resolver, log service) are mocked; assertions pin the handler's in/out
// behaviour (charge validation/deduction, modal payload contract, logging).
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

    it('CLA-092: lv8 caster with no stored charges and no class_levels entry falls back to 3 (classes.json), not 2', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(undefined);

      const ps = makePlayerStats({ level: 8, class: undefined });
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

    it('returns the full modal payload for default inputs', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      const result = await handle(action, ps, campaignName, null);

      expect(result).toEqual({
        type: 'modal',
        modalName: 'divineSpark',
        payload: {
          featureName: action.name,
          attackerName: ps.name,
          targetName: ps.name,
          campaignName,
          healExpression: '1d8 + 2',
          damageExpression: '1d8 + 2',
          damageTypes: ['Necrotic', 'Radiant'],
          saveType: 'CON',
          wisModifier: 2,
        },
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

    it.each`
      label                                    | automation                                          | expectedDamageTypes       | expectedSaveType
      ${'passes through auto values'}        | ${{ damageTypes: ['Fire', 'Cold'], saveType: 'WIS' }} | ${['Fire', 'Cold']} | ${'WIS'}
      ${'falls back to defaults when null'}  | ${{ damageTypes: null, saveType: null }}              | ${['Necrotic', 'Radiant']} | ${'CON'}
      ${'preserves empty damageTypes array'} | ${{ damageTypes: [] }}                              | ${[]}                   | ${'CON'}
    `('damageTypes/saveType: $label', async ({ automation, expectedDamageTypes, expectedSaveType }) => {
      const ps = makePlayerStats();
      const action = makeAction(automation);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.damageTypes).toEqual(expectedDamageTypes);
      expect(result.payload.saveType).toBe(expectedSaveType);
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
