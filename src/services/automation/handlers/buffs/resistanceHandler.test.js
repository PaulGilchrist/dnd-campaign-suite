// @maintained-by-ai — deterministic unit coverage of resistanceHandler.js: popup payloads,
// runtime-store keys, and delegation to registerTargetEffect / expirations / concentration / log.
// Exact payloads over contains-matchers; guards assert no side effects.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ─────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
}));

// registerTargetEffect's own merge/store semantics are covered by
// targetEffectDefinitions.test.js — here we only assert the handler delegates to it.
vi.mock('../../../combat/conditions/targetEffectDefinitions.js', () => ({
  registerTargetEffect: vi.fn(),
}));

// ── Imports ──────────────────────────────────────────────────────

import {
  handle,
  applyResistance,
  getResistanceDamageType,
  isResistanceUsedThisTurn,
  setResistanceUsedThisTurn,
} from './resistanceHandler.js';

import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as logService from '../../../ui/logService.js';
import * as combatData from '../../../encounters/combatData.js';
import * as concentrationService from '../../../combat/concentration/concentrationService.js';
import * as targetEffectDefinitions from '../../../combat/conditions/targetEffectDefinitions.js';

// ── Constants & Helpers ──────────────────────────────────────────

const CAMPAIGN_NAME = 'TestCampaign';

const DAMAGE_TYPES = [
  'Acid', 'Bludgeoning', 'Cold', 'Fire', 'Lightning',
  'Necrotic', 'Piercing', 'Poison', 'Radiant', 'Slashing', 'Thunder',
];

function makePlayerStats(overrides = {}) {
  return {
    name: 'Cleric',
    level: 5,
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Resistance',
    automation: {
      type: 'damage_reduction',
      reductionExpression: '1d4',
      damageTypes: [],
      trigger: 'damage_taken_of_chosen_resistance_type',
      casting_time: '1 action',
      ...automation,
    },
  };
}

function makeCombatSummary(creatureNames = []) {
  return {
    creatures: creatureNames.map((name, i) => ({
      name,
      initiative: 20 - i,
    })),
  };
}

// ── Tests ────────────────────────────────────────────────────────

describe('resistanceHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handle', () => {
    it('returns resistance target selection popup with full combat roster (caster included)', async () => {
      const action = makeAction();
      combatData.getCombatSummary.mockReturnValue(
        makeCombatSummary(['Cleric', 'Goblin', 'Orc'])
      );

      const result = await handle(action, makePlayerStats(), CAMPAIGN_NAME, null);

      expect(combatData.getCombatSummary).toHaveBeenCalledWith(CAMPAIGN_NAME);
      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'resistance_target_selection',
          name: 'Resistance',
          creatureTargets: ['Cleric', 'Goblin', 'Orc'],
          damageTypes: DAMAGE_TYPES,
          automation: action.automation,
        },
      });
    });

    it('returns empty creatureTargets when combat summary has no creatures', async () => {
      const action = makeAction();
      combatData.getCombatSummary.mockReturnValue({ creatures: [] });

      const result = await handle(action, makePlayerStats(), CAMPAIGN_NAME, null);

      expect(result.payload.creatureTargets).toEqual([]);
    });

    it('defaults automation to empty object when action has none', async () => {
      combatData.getCombatSummary.mockReturnValue(makeCombatSummary(['Goblin']));

      const selection = await handle({ name: 'Resistance' }, makePlayerStats(), CAMPAIGN_NAME, null);
      expect(selection.payload.automation).toEqual({});

      combatData.getCombatSummary.mockReturnValue(null);
      const error = await handle({ name: 'Resistance' }, makePlayerStats(), CAMPAIGN_NAME, null);
      expect(error.payload.automation).toEqual({});
    });

    it('returns error popup with descriptive message when no combat context', async () => {
      const action = makeAction();
      combatData.getCombatSummary.mockReturnValue(null);

      const result = await handle(action, makePlayerStats(), CAMPAIGN_NAME, null);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Resistance',
          description: 'No combat context found. Cannot apply Resistance.',
          automation: action.automation,
        },
      });
    });
  });

  describe('applyResistance', () => {
    it('returns null without side effects when targetName or chosenDamageType is missing', async () => {
      const action = makeAction();

      for (const [targetName, chosenDamageType] of [
        [null, 'fire'],
        ['', 'fire'],
        ['Goblin', null],
        ['Goblin', ''],
      ]) {
        const result = await applyResistance(action, makePlayerStats(), CAMPAIGN_NAME, targetName, chosenDamageType);

        expect(result).toBeNull();
        expect(targetEffectDefinitions.registerTargetEffect).not.toHaveBeenCalled();
        expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
        expect(combatData.getCombatSummary).not.toHaveBeenCalled();
        expect(concentrationService.addConcentration).not.toHaveBeenCalled();
        expect(expirations.addExpiration).not.toHaveBeenCalled();
        expect(logService.addEntry).not.toHaveBeenCalled();
      }
    });

    it('returns automation_info popup describing the applied resistance', async () => {
      const action = makeAction();
      combatData.getCombatSummary.mockReturnValue(makeCombatSummary(['Cleric', 'Goblin']));

      const result = await applyResistance(action, makePlayerStats(), CAMPAIGN_NAME, 'Goblin', 'fire');

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Resistance',
          automationType: 'damage_reduction',
          description: 'Resistance applied to Goblin. They reduce damage of Fire type by 1d4 (once per turn, Concentration).',
          automation: action.automation,
        },
      });
    });

    it('normalizes chosen damage type casing and registers the effect on the target', async () => {
      const action = makeAction();
      combatData.getCombatSummary.mockReturnValue(makeCombatSummary(['Cleric', 'Goblin']));

      await applyResistance(action, makePlayerStats(), CAMPAIGN_NAME, 'Goblin', 'fIrE');

      expect(targetEffectDefinitions.registerTargetEffect).toHaveBeenCalledWith(
        CAMPAIGN_NAME,
        'Goblin',
        'resistance_damage_reduction',
        'Cleric',
        { chosenType: 'Fire' }
      );
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'resistanceChosenDamageType',
        'Fire',
        CAMPAIGN_NAME
      );
    });

    it('resets resistanceUsedThisTurn flag to false on the target', async () => {
      const action = makeAction();
      combatData.getCombatSummary.mockReturnValue(makeCombatSummary(['Cleric', 'Goblin']));

      await applyResistance(action, makePlayerStats({ name: 'Paladin' }), CAMPAIGN_NAME, 'Goblin', 'fire');

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'resistanceUsedThisTurn',
        false,
        CAMPAIGN_NAME
      );
      // Only the chosen-type and used-flag writes go direct to the runtime store.
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledTimes(2);
      expect(targetEffectDefinitions.registerTargetEffect).toHaveBeenCalledWith(
        CAMPAIGN_NAME,
        'Goblin',
        'resistance_damage_reduction',
        'Paladin',
        { chosenType: 'Fire' }
      );
    });

    it('registers expiration to remove the target effect', async () => {
      const action = makeAction();
      combatData.getCombatSummary.mockReturnValue(makeCombatSummary(['Cleric', 'Goblin']));

      await applyResistance(action, makePlayerStats(), CAMPAIGN_NAME, 'Goblin', 'fire');

      expect(expirations.addExpiration).toHaveBeenCalledWith({
        attackerName: 'Cleric',
        targetName: 'Goblin',
        effects: [
          { type: 'remove_target_effect', effectKey: 'resistance_damage_reduction', source: 'Cleric' },
        ],
        campaignName: CAMPAIGN_NAME,
      });
    });

    it('registers concentration on the caster with the combat summary', async () => {
      const action = makeAction();
      const summary = makeCombatSummary(['Cleric', 'Goblin']);
      combatData.getCombatSummary.mockReturnValue(summary);

      await applyResistance(action, makePlayerStats(), CAMPAIGN_NAME, 'Goblin', 'fire');

      expect(concentrationService.addConcentration).toHaveBeenCalledWith(
        summary,
        'Cleric',
        'Resistance',
        10
      );
    });

    it('writes a spell_effect log entry', async () => {
      const action = makeAction();
      combatData.getCombatSummary.mockReturnValue(makeCombatSummary(['Cleric', 'Goblin']));

      await applyResistance(action, makePlayerStats(), CAMPAIGN_NAME, 'Goblin', 'fire');

      expect(logService.addEntry).toHaveBeenCalledWith(CAMPAIGN_NAME, {
        type: 'spell_effect',
        characterName: 'Cleric',
        spellName: 'Resistance',
        targetName: 'Goblin',
        effects: ['Resistance (Fire): reduces damage of chosen type by 1d4, once per turn'],
        timestamp: expect.any(Number),
      });
    });
  });

  describe('getResistanceDamageType', () => {
    it('returns the stored damage type', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue('Fire');

      expect(getResistanceDamageType('Goblin', CAMPAIGN_NAME)).toBe('Fire');
      expect(useRuntimeState.getRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'resistanceChosenDamageType',
        CAMPAIGN_NAME
      );
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('passes through a missing stored value', () => {
      for (const missing of [undefined, null]) {
        useRuntimeState.getRuntimeValue.mockReturnValue(missing);

        expect(getResistanceDamageType('Goblin', CAMPAIGN_NAME)).toBe(missing);
      }
    });
  });

  describe('isResistanceUsedThisTurn', () => {
    it('returns true only when the flag is stored true', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(true);

      expect(isResistanceUsedThisTurn('Goblin', CAMPAIGN_NAME)).toBe(true);
      expect(useRuntimeState.getRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'resistanceUsedThisTurn',
        CAMPAIGN_NAME
      );
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('returns false for any non-true stored value', () => {
      for (const stored of [false, null, undefined]) {
        useRuntimeState.getRuntimeValue.mockReturnValue(stored);

        expect(isResistanceUsedThisTurn('Goblin', CAMPAIGN_NAME)).toBe(false);
        expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      }
    });
  });

  describe('setResistanceUsedThisTurn', () => {
    it('writes the flag through the runtime store', () => {
      setResistanceUsedThisTurn('Goblin', true, CAMPAIGN_NAME);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'resistanceUsedThisTurn',
        true,
        CAMPAIGN_NAME
      );
    });
  });
});
