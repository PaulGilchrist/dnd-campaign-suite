// @maintained-by-ai 2026-11-26
// Deterministic contract test for divineSparkHandler: all seams (runtime store,
// target resolver, log service) are mocked and Date.now is frozen. The handler
// is READ-ONLY (pay-at-CONFIRM move, 2026-11-05): it never writes charges and
// never logs an activation row — refusal rows are its only commits. Coverage:
// charge-pool derivation, no-charge gate ordering, no-legal-target refusals
// (zero spend), full modal payload schema, WIS/damage-type derivation.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
const FROZEN_NOW = 1700000000000;

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

// The refusal log row the handler commits for target refusals (full shape,
// frozen timestamp) — reused by the refusal family's exact addEntry census.
function refusalRow(reason) {
  return [campaignName, {
    type: 'automation',
    characterName: 'TestHero',
    abilityName: 'Divine Spark',
    automationType: 'divine_spark',
    automationDetail: 'divine_spark_refused',
    reason,
    description: `Divine Spark refused — ${reason}`,
    timestamp: FROZEN_NOW,
  }];
}

// ── Tests ──────────────────────────────────────────────────────

describe('divineSparkHandler.handle', () => {
  let nowSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    nowSpy = vi.spyOn(Date, 'now').mockReturnValue(FROZEN_NOW);
  });

  afterEach(() => {
    nowSpy.mockRestore();
  });

  // Rules text (public/data/2024/classes.json Cleric lv2): "another creature
  // you can see within 30 feet of yourself". Regression (bug-divine-spark-no-
  // target-self-harms): an unarmed row-click used to fall back to
  // `playerStats.name`, silently self-targeting; the old handler also spent a
  // charge before refusing. Every refusal must commit ZERO writes, and the
  // charge gate must fire before the target seam is even consulted.
  describe('refusal family (full popup shape, zero-spend censuses)', () => {
    it.each([
      {
        label: 'zero stored charges — refuses before the target seam is consulted',
        stats: makePlayerStats(),
        stored: 0,
        armed: undefined,
        description: 'No Channel Divinity charges remaining.',
        targetCalls: [],
        logCalls: [],
      },
      {
        label: 'derived pool is zero (lv1, no class entry, key absent) — same refusal',
        stats: makePlayerStats({ level: 1, class: undefined }),
        stored: undefined,
        armed: undefined,
        description: 'No Channel Divinity charges remaining.',
        targetCalls: [],
        logCalls: [],
      },
      {
        label: 'no target armed — refuses with reason no_target',
        stats: makePlayerStats(),
        stored: 2,
        armed: null,
        description: 'No target selected — Divine Spark requires another creature within 30 feet.',
        targetCalls: [[campaignName, 'TestHero']],
        logCalls: [refusalRow('no_target')],
      },
      {
        label: 'armed target is the caster — refuses with reason cannot_target_self',
        stats: makePlayerStats(),
        stored: 2,
        armed: { target: { name: 'TestHero' } },
        description: "You can't target yourself with Divine Spark — it requires another creature.",
        targetCalls: [[campaignName, 'TestHero']],
        logCalls: [refusalRow('cannot_target_self')],
      },
    ])('$label', async ({ stats, stored, armed, description, targetCalls, logCalls }) => {
      useRuntimeState.getRuntimeValue.mockReturnValue(stored);
      targetResolver.resolveTarget.mockResolvedValue(armed);

      const action = makeAction();
      const result = await handle(action, stats, campaignName, null);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: action.name,
          automationType: 'divine_spark',
          description,
          automation: action.automation,
        },
      });
      // Zero-spend census: the charge key is read, never written; the only
      // permitted commit is the exact refusal log row (or none pre-gate).
      expect(useRuntimeState.setRuntimeValue.mock.calls).toEqual([]);
      expect(targetResolver.resolveTarget.mock.calls).toEqual(targetCalls);
      expect(logService.addEntry.mock.calls).toEqual(logCalls);
    });
  });

  // Pay-at-CONFIRM (2026-11-05): the charge write + ability_use spend log live
  // in DivineSparkModal's branch-confirm. The happy-path handler commits
  // NOTHING — exact zero censuses across every write/log seam.
  it('happy path commits nothing: charges read once, target resolved once, zero writes, zero log rows', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(2);
    targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ally' } });

    const ps = makePlayerStats();
    const result = await handle(makeAction(), ps, campaignName, null);

    expect(result.type).toBe('modal');
    expect(useRuntimeState.getRuntimeValue.mock.calls).toEqual([['TestHero', 'channelDivinityCharges']]);
    expect(targetResolver.resolveTarget.mock.calls).toEqual([[campaignName, 'TestHero']]);
    expect(useRuntimeState.setRuntimeValue.mock.calls).toEqual([]);
    expect(logService.addEntry.mock.calls).toEqual([]);
  });

  it('returns the full modal payload for default inputs', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(2);
    targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ally' } });

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

  // resolveSparkCharges precedence: stored value (even above class max) wins;
  // absent key falls back to class entry → class_specific → level table
  // (CLA-092: mirrors 2024 classes.json Cleric 2/3/4 charges).
  describe('charge pool derivation for the modal header', () => {
    it.each([
      {
        label: 'stored 3 wins over class max 2 (pay-at-confirm base)',
        stats: makePlayerStats(),
        stored: 3,
        expected: 3,
      },
      {
        label: 'key absent → class entry channel_divinity max',
        stats: makePlayerStats(),
        stored: undefined,
        expected: 2,
      },
      {
        label: 'CLA-092: lv8 with no class_levels entry falls back to 3 (classes.json), not 2',
        stats: makePlayerStats({ level: 8, class: undefined }),
        stored: undefined,
        expected: 3,
      },
      {
        label: 'channel_divinity 0 defers to class_specific.channel_divinity_charges',
        stats: makePlayerStats({
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
        }),
        stored: undefined,
        expected: 4,
      },
    ])('$label', async ({ stats, stored, expected }) => {
      useRuntimeState.getRuntimeValue.mockReturnValue(stored);
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ally' } });

      const result = await handle(makeAction(), stats, campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.payload.channelDivinityCharges).toBe(expected);
      expect(useRuntimeState.setRuntimeValue.mock.calls).toEqual([]);
    });
  });

  describe('wisModifier derivation', () => {
    it.each`
      wisBonus       | expectedWisModifier | expectedExpression
      ${3}           | ${3}                | ${'1d8 + 3'}
      ${undefined}   | ${0}                | ${'1d8 + 0'}
    `('uses wisModifier from Wisdom ability ($wisBonus) or defaults to 0', async ({ wisBonus, expectedWisModifier, expectedExpression }) => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ally' } });

      const abilities = wisBonus !== undefined ? [{ name: 'Wisdom', bonus: wisBonus }] : [{ name: 'Strength', bonus: 3 }];
      const ps = makePlayerStats({ abilities });

      const result = await handle(makeAction(), ps, campaignName, null);

      expect(result.payload.wisModifier).toBe(expectedWisModifier);
      expect(result.payload.healExpression).toBe(expectedExpression);
      expect(result.payload.damageExpression).toBe(expectedExpression);
    });
  });

  describe('damageTypes/saveType derivation', () => {
    it.each`
      label                                    | automation                                          | expectedDamageTypes          | expectedSaveType
      ${'passes through auto values'}          | ${{ damageTypes: ['Fire', 'Cold'], saveType: 'WIS' }} | ${['Fire', 'Cold']}          | ${'WIS'}
      ${'falls back to defaults when null'}    | ${{ damageTypes: null, saveType: null }}              | ${['Necrotic', 'Radiant']} | ${'CON'}
      ${'preserves empty damageTypes array'}  | ${{ damageTypes: [] }}                                | ${[]}                        | ${'CON'}
    `('$label', async ({ automation, expectedDamageTypes, expectedSaveType }) => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ally' } });

      const result = await handle(makeAction(automation), makePlayerStats(), campaignName, null);

      expect(result.payload.damageTypes).toEqual(expectedDamageTypes);
      expect(result.payload.saveType).toBe(expectedSaveType);
    });
  });
});
