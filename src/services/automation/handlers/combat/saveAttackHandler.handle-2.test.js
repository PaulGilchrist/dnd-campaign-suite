// @maintained-by-ai 2026-11-27 — deterministic unit contract for handle()'s routing lanes:
// tracked-uses cost (incl. long_rest_or_expend_rage fallback), heal/condition/AoE
// modal routing, effect-only and condition popups, pushEffect normalization, and
// buildSaveAttackRollResult payload + notes composition (darkness-dispelled note
// only reachable when condition+damage bypasses the AoE modal guard). Pure logic
// through module-boundary mocks; resolveScaling/resolveUses/parseDurationRounds run
// REAL (pure) instead of mirrored mocks. Full-shape toEqual on popups/modals/roll
// results; it.each tables for refusal copy, rider copy, and attacker-position lanes;
// argument-keyed getRuntimeValue re-seeds (no *Once chains). Stable unless runtime
// keys, popup copy, modal names, or payload shape change. Channel-divinity /
// wild-shape consumption and shape-resolution lanes live in
// saveAttackHandler.handle.test.js; isExhausted() booleans in
// saveAttackHandler.exhausted.test.js — do not cross-remove.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../maps/mapsService.js', () => ({
  loadMapData: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getAttackerTargetName: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
  rangeToFeet: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

// NOTE: automationExpressions.js is intentionally NOT mocked — resolveScaling /
// resolveUses are pure and exercise their real selection logic here (CLA-208
// scaling). Its diceRoller import resolves to the mocked module above.

// ── Imports ────────────────────────────────────────────────────

import { handle } from './saveAttackHandler.js';
import * as diceRoller from '../../../dice/diceRoller.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as mapsService from '../../../maps/mapsService.js';
import * as rangeValidation from '../../../rules/combat/rangeValidation.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
    level: 5,
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Breath Weapon',
    automation: {
      type: 'save_attack',
      ...automation,
    },
  };
}

// Argument-keyed re-seed for the tracked-uses lane: 'Breath Weapon' →
// getRuntimeUsesKey → 'breathWeaponUses'.
function seedUses(value, rageValue = null) {
  runtimeState.getRuntimeValue.mockImplementation((name, key) =>
    key === 'breathWeaponUses' ? value : key === 'ragePoints' ? rageValue : null
  );
}

// ── Tests ──────────────────────────────────────────────────────

describe('saveAttackHandler - handle (part 2)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    savePrompt.buildSaveDc.mockReturnValue(13);
    rangeValidation.rangeToFeet.mockReturnValue(30);
    runtimeState.getRuntimeValue.mockReturnValue(null);
    // Async contract (savePath.js getCombatContext is async) — a bare vi.fn()
    // would hand buildAoeModal a sync undefined and mask a dropped await.
    damageUtils.getCombatContext.mockResolvedValue(null);
  });

  describe('handle - uses cost', () => {
    it.each([
      { title: 'plain uses-exhausted', recharge: undefined },
      { title: 'long_rest_or_expend_rage with no rage', recharge: 'long_rest_or_expend_rage' },
    ])('refuses with popup when uses are 0 ($title)', async ({ recharge }) => {
      seedUses(0);
      const action = makeAction({ usesMax: 1, ...(recharge ? { recharge } : {}) });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Breath Weapon',
          description: 'Breath Weapon has been used and cannot be used again until a long rest.',
          automation: action.automation,
        },
      });
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('auto-spends one rage point and continues when long_rest_or_expend_rage and rage available', async () => {
      seedUses(0, 6);
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });

      const action = makeAction({ usesMax: 1, recharge: 'long_rest_or_expend_rage', damage: '1d6' });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('roll');
      expect(result.payload.formula).toBe('1d6');
      // zero-spend census: rage is the ONLY write
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledTimes(1);
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('TestCaster', 'ragePoints', 5, campaignName);
    });

    it('decrements tracked uses by exactly one on successful use', async () => {
      seedUses(1);
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });

      const action = makeAction({ usesMax: 1, damage: '1d6' });

      await handle(action, makePlayerStats(), campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledTimes(1);
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestCaster',
        'breathWeaponUses',
        0,
        campaignName,
      );
    });

    it('skips the whole uses lane when maxUses is 0 (at-will action)', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });

      const action = makeAction({ usesMax: 0, damage: '1d6' });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('roll');
      expect(result.payload.total).toBe(5);
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('handle - area + healing', () => {
    it('ships the full saveAttackHeal payload with default CON save and half dcSuccess', async () => {
      damageUtils.getCombatContext.mockResolvedValue({ round: 2 });
      const action = makeAction({ shape: 'cone', healExpression: '2d4', damage: '1d6' });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result).toEqual({
        type: 'modal',
        modalName: 'saveAttackHeal',
        payload: {
          combatSummary: { round: 2 },
          attackerName: 'TestCaster',
          attackerPos: null,
          saveDc: 13,
          campaignName,
          mapData: null,
          featureName: 'Breath Weapon',
          saveType: 'CON',
          rangeFeet: 30,
          damageExpression: '1d6',
          damageType: '',
          healExpression: '2d4',
          dcSuccess: 'half',
          shape: 'cone',
          attackerGridX: undefined,
          attackerGridY: undefined,
        },
      });
      // no auto.range → emanation fallback measured from the resolved shape
      expect(rangeValidation.rangeToFeet.mock.calls).toEqual([['cone']]);

      // same branch, explicit saveType override
      const custom = await handle(
        makeAction({ shape: 'cone', healExpression: '2d4', saveType: 'WIS' }),
        makePlayerStats(),
        campaignName,
        null,
      );
      expect(custom.payload.saveType).toBe('WIS');
    });

    // CLA-208: real resolveScaling must select the highest entry <= level and
    // feed damage/heal independently; auto.range must bypass the fallback lane.
    it('resolves level scaling and auto.range into the saveAttackHeal payload', async () => {
      const action = makeAction({
        shape: 'sphere',
        range: '60_ft',
        damage: '2d6',
        healExpression: '2d4',
        scaling: { '10': '3d6', '14': '4d6' },
        healScaling: { '10': '3d6', '14': '4d8' },
      });

      const result = await handle(
        action,
        makePlayerStats({ level: 20 }),
        campaignName,
        null,
      );

      expect(result.modalName).toBe('saveAttackHeal');
      expect(result.payload.damageExpression).toBe('4d6');
      expect(result.payload.healExpression).toBe('4d8');
      expect(result.payload.rangeFeet).toBe(30); // rangeToFeet is mocked → returns 30
      expect(rangeValidation.rangeToFeet.mock.calls).toEqual([['60_ft']]);
    });

    it.each([
      {
        title: 'attacker found',
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
        load: 'resolve',
        expectedPos: { gridX: 5, gridY: 10 },
        expectedGrid: [5, 10],
      },
      {
        title: 'attacker absent from map',
        players: [{ name: 'OtherPlayer', gridX: 1, gridY: 2 }],
        load: 'resolve',
        expectedPos: null,
        expectedGrid: [undefined, undefined],
      },
      {
        title: 'map load rejects',
        players: undefined,
        load: 'reject',
        expectedPos: null,
        expectedGrid: [undefined, undefined],
      },
    ])('resolves attackerPos when $title', async ({ players, load, expectedPos, expectedGrid }) => {
      if (load === 'reject') {
        mapsService.loadMapData.mockRejectedValueOnce(new Error('not found'));
      } else {
        mapsService.loadMapData.mockResolvedValue({ players });
      }

      const action = makeAction({ shape: 'cone', healExpression: '2d4' });

      const result = await handle(action, makePlayerStats(), campaignName, 'test-map');

      expect(result.type).toBe('modal');
      expect(result.payload.attackerPos).toEqual(expectedPos);
      expect(result.payload.attackerGridX).toBe(expectedGrid[0]);
      expect(result.payload.attackerGridY).toBe(expectedGrid[1]);
    });

    it('falls through to the damage roll (no modal) when healExpression has no area shape', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });

      const action = makeAction({ healExpression: '2d4', damage: '1d6' });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('roll');
      expect(result.modalName).toBeUndefined();
    });
  });

  describe('handle - condition inflicted', () => {
    it('ships the full setCondition modal payload with default WIS save', async () => {
      damageUtils.getCombatContext.mockResolvedValue({ round: 2 });
      const action = makeAction({ shape: 'cone', conditionInflicted: 'Poisoned' });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result).toEqual({
        type: 'modal',
        modalName: 'setCondition',
        payload: {
          combatSummary: { round: 2 },
          attackerName: 'TestCaster',
          attackerPos: null,
          saveDc: 13,
          campaignName,
          mapData: null,
          featureName: 'Breath Weapon',
          conditionName: 'poisoned',
          saveType: 'WIS',
          rangeFeet: 30,
          durationRounds: undefined,
          shape: 'cone',
          attackerGridX: undefined,
          attackerGridY: undefined,
        },
      });

      // same branch, explicit saveType override
      const custom = await handle(
        makeAction({ shape: 'cone', conditionInflicted: 'Stunned', saveType: 'CON' }),
        makePlayerStats(),
        campaignName,
        null,
      );
      expect(custom.payload.saveType).toBe('CON');
    });

    it.each([
      { condition: 'Poisoned', saveType: undefined, expectedSave: 'WIS' },
      { condition: 'Blinded', saveType: 'INT', expectedSave: 'INT' },
    ])('routes condition without area shape to a popup ($expectedSave default-vs-override)', async ({
      condition,
      saveType,
      expectedSave,
    }) => {
      const action = makeAction({ conditionInflicted: condition, ...(saveType ? { saveType } : {}) });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Breath Weapon',
          description: `Breath Weapon — ${expectedSave} save DC 13. On a failed save, target has the ${condition} condition.`,
          automation: action.automation,
        },
      });
    });

    it('bypasses the condition modal when damage is present, folding condition into contextConfig', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });

      const action = makeAction({ shape: 'cone', conditionInflicted: 'Poisoned', damage: '1d6' });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('roll');
      expect(result.payload.contextConfig.conditionInflicted).toBe('Poisoned');
    });
  });

  describe('handle - effect only (no damage)', () => {
    it.each([
      {
        title: 'speed_reduction with explicit value',
        automation: { effect: 'speed_reduction', effectValue: '15_ft' },
        description: "Breath Weapon — DEX save DC 13. On a failed save, the target's Speed is reduced by 15 ft.",
      },
      {
        title: 'push with custom saveType',
        automation: { effect: 'push', effectValue: '10_ft', saveType: 'STR' },
        description: 'Breath Weapon — STR save DC 13. On a failed save, the target is pushed 10 ft.',
      },
      {
        title: 'push defaults to 10 ft',
        automation: { effect: 'push' },
        description: 'Breath Weapon — DEX save DC 13. On a failed save, the target is pushed 10 ft.',
      },
      {
        title: 'speed_reduction defaults to 15 ft',
        automation: { effect: 'speed_reduction' },
        description: "Breath Weapon — DEX save DC 13. On a failed save, the target's Speed is reduced by 15 ft.",
      },
      {
        title: 'unknown effect renders raw string',
        automation: { effect: 'custom_effect' },
        description: 'Breath Weapon — DEX save DC 13. On a failed save, custom_effect.',
      },
    ])('returns the effect-only popup: $title', async ({ automation, description }) => {
      const action = makeAction(automation);

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Breath Weapon',
          description,
          automation: action.automation,
        },
      });
    });
  });

  describe('handle - damage roll', () => {
    it('ships the full roll payload with defaulted contextConfig', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 12, rolls: [7, 5], modifier: 0 });

      const action = makeAction({ damage: '2d6' });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result).toEqual({
        type: 'roll',
        payload: {
          rollType: 'damage',
          name: 'Breath Weapon',
          formula: '2d6',
          total: 12,
          rolls: [7, 5],
          modifier: 0,
          notes: undefined,
          contextConfig: {
            damageType: '',
            saveDc: 13,
            saveType: 'DEX',
            dcSuccess: 'none',
            attackerName: 'TestCaster',
            conditionInflicted: null,
            shape: '',
          },
        },
      });
      // the expression handed to the roller is the resolved scaling/base expression
      expect(diceRoller.rollExpression).toHaveBeenCalledWith('2d6');
    });

    // An area shape with damage only reaches the roll path (buildSaveAttackRollResult,
    // where the darkness-dispelled note lives) when conditionInflicted bypasses the
    // saveAttackAoe modal guard — the AoE modal itself is pinned in handle.test.js.
    it.each([
      {
        title: 'rider only (no area)',
        automation: { damage: '1d8', effect: 'push', effectValue: '10_ft' },
        notes: 'the target is pushed 10 ft',
      },
      {
        title: 'darkness only (area via condition bypass)',
        automation: { damage: '1d8', shape: 'cone', conditionInflicted: 'Poisoned' },
        notes: 'Magical Darkness in the area is dispelled.',
      },
      {
        title: 'darkness then rider, space-joined',
        automation: { damage: '1d8', shape: 'cone', conditionInflicted: 'Poisoned', effect: 'push', effectValue: '5_ft' },
        notes: 'Magical Darkness in the area is dispelled. the target is pushed 5 ft',
      },
    ])('composes roll notes: $title', async ({ automation, notes }) => {
      diceRoller.rollExpression.mockReturnValue({ total: 10, rolls: [10], modifier: 0 });

      const result = await handle(makeAction(automation), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('roll');
      expect(result.payload.notes).toBe(notes);
    });

    it('returns null when rollExpression fails', async () => {
      diceRoller.rollExpression.mockReturnValue(null);

      const result = await handle(makeAction({ damage: '2d6' }), makePlayerStats(), campaignName, null);

      expect(result).toBeNull();
    });

    it.each([
      { shape: 'cone', expected: 'half' },
      { shape: 'line', expected: 'none' },
    ])('defaults dcSuccess to $expected for shape $shape in the AoE modal', async ({ shape, expected }) => {
      const action = makeAction({ damage: '1d8', shape });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('saveAttackAoe');
      expect(result.payload.dcSuccess).toBe(expected);
    });

    it('passes explicit dcSuccess and saveType through to contextConfig unlabelled', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 10, rolls: [10], modifier: 0 });

      const action = makeAction({ damage: '1d8', dcSuccess: 1, saveType: 'CON' });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('roll');
      expect(result.payload.contextConfig.dcSuccess).toBe(1);
      expect(result.payload.contextConfig.saveType).toBe('CON');
    });
  });

  describe('handle - pushEffect normalization', () => {
    it.each([
      {
        title: 'fills effect when effect is missing',
        automation: { damage: '1d8', pushEffect: 'push', effectValue: '10_ft' },
        notes: 'the target is pushed 10 ft',
      },
      {
        title: 'does not override an existing effect',
        automation: { damage: '1d8', pushEffect: 'push', effect: 'speed_reduction', effectValue: '20_ft' },
        notes: "the target's Speed is reduced by 20 ft",
      },
    ])('normalizes pushEffect: $title', async ({ automation, notes }) => {
      diceRoller.rollExpression.mockReturnValue({ total: 10, rolls: [10], modifier: 0 });

      const result = await handle(makeAction(automation), makePlayerStats(), campaignName, null);

      expect(result.payload.notes).toBe(notes);
    });
  });
});
