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

  describe('no spend at handler phase (pay-at-CONFIRM move, 2026-11-05)', () => {
    beforeEach(() => {
      // Fix (no-target self-harm bug): a LEGAL (other-creature) target must be
      // armed before the modal opens. Fix (charge-visibility improve): the
      // charge write + ability_use spend log MOVED to DivineSparkModal's
      // branch-confirm — the handler must now write/spend NOTHING.
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ally' } });
      useRuntimeState.getRuntimeValue.mockReturnValue(3);
    });

    it('writes no channelDivinityCharges and logs no ability_use row on the happy path', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('modal');
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      const loggedTypes = logService.addEntry.mock.calls.map(c => c[1]?.type);
      expect(loggedTypes).not.toContain('ability_use');
    });

    it('passes the runtime stored charges through the payload for the modal header', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.channelDivinityCharges).toBe(3);
    });

    it('CLA-092: lv8 caster with no stored charges and no class_levels entry falls back to 3 (classes.json), not 2', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(undefined);

      const ps = makePlayerStats({ level: 8, class: undefined });
      const action = makeAction();

      const result = await handle(action, ps, campaignName, null);

      // Absent stored key → the payload carries the pool MAX (the modal's
      // confirm initializes stored to max − 1).
      expect(result.payload.channelDivinityCharges).toBe(3);
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
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

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.channelDivinityCharges).toBe(4);
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('modal payload', () => {
    beforeEach(() => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ally' } });
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
          targetName: 'Ally',
          campaignName,
          channelDivinityCharges: 2,
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

  // Regression (bug-divine-spark-no-target-self-harms): an unarmed row-click
  // used to fall back to `playerStats.name`, silently self-targeting and
  // spending a Channel Divinity charge; Harm then forced the caster's own CON
  // save vs their DC. Rules text (2024 classes.json Cleric lv2): "another
  // creature you can see within 30 feet of yourself" — both refusals must
  // happen BEFORE the charge spend with zero write.
  describe('no-legal-target refusal (zero charge spend)', () => {
    beforeEach(() => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
    });

    it('refuses with an automation_info popup and spends nothing when no target is armed', async () => {
      targetResolver.resolveTarget.mockResolvedValue(null);

      const ps = makePlayerStats();
      const action = makeAction();

      const result = await handle(action, ps, campaignName, null);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: action.name,
          automationType: 'divine_spark',
          description: 'No target selected — Divine Spark requires another creature within 30 feet.',
          automation: action.automation,
        },
      });
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'automation',
        characterName: ps.name,
        abilityName: action.name,
        automationDetail: 'divine_spark_refused',
        reason: 'no_target',
      }));
      // No ability_use activation row on refusal.
      const loggedTypes = logService.addEntry.mock.calls.map(c => c[1]?.type);
      expect(loggedTypes).not.toContain('ability_use');
    });

    it('refuses and spends nothing when the armed target is the caster themselves', async () => {
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'TestHero' } });

      const ps = makePlayerStats();
      const action = makeAction();

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe(
        "You can't target yourself with Divine Spark — it requires another creature."
      );
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        automationDetail: 'divine_spark_refused',
        reason: 'cannot_target_self',
      }));
    });

    it('resolves the target before opening the modal on the happy path', async () => {
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ally' } });

      const ps = makePlayerStats();
      const action = makeAction();

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.payload.targetName).toBe('Ally');
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('logging', () => {
    beforeEach(() => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      targetResolver.resolveTarget.mockResolvedValue(null);
    });

    it('logs no ability_use activation row — the spend row moved to modal confirm', async () => {
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ally' } });

      const ps = makePlayerStats();
      const action = makeAction();

      await handle(action, ps, campaignName, null);

      const loggedTypes = logService.addEntry.mock.calls.map(c => c[1]?.type);
      expect(loggedTypes).not.toContain('ability_use');
    });
  });

});
