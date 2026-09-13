// @improved-by-ai
// @cleaned-by-ai
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

// ── Constants & Helpers ──────────────────────────────────────────

const CAMPAIGN_NAME = 'TestCampaign';

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
    it('returns target selection popup with creature list when combat context exists', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      combatData.getCombatSummary.mockReturnValue(
        makeCombatSummary(['Goblin', 'Orc'])
      );
      // handle() awaits getCombatSummary, so mockResolvedValue is correct here

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('resistance_target_selection');
      expect(result.payload.name).toBe('Resistance');
      expect(result.payload.creatureTargets).toEqual(['Goblin', 'Orc']);
      expect(result.payload.damageTypes).toEqual([
        'Acid', 'Bludgeoning', 'Cold', 'Fire', 'Lightning',
        'Necrotic', 'Piercing', 'Poison', 'Radiant', 'Slashing', 'Thunder',
      ]);
    });

    it('includes the caster in creature targets', async () => {
      const ps = makePlayerStats({ name: 'Cleric' });
      const action = makeAction();
      combatData.getCombatSummary.mockReturnValue(
        makeCombatSummary(['Cleric', 'Goblin'])
      );

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.creatureTargets).toEqual(['Cleric', 'Goblin']);
    });

    it('returns creatureTargets with only the caster when caster is the only creature', async () => {
      const ps = makePlayerStats({ name: 'Cleric' });
      const action = makeAction();
      combatData.getCombatSummary.mockReturnValue(
        makeCombatSummary(['Cleric'])
      );

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.creatureTargets).toEqual(['Cleric']);
    });

    it('returns empty creatureTargets when combat summary has no creatures', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      combatData.getCombatSummary.mockReturnValue({ creatures: [] });

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('resistance_target_selection');
      expect(result.payload.creatureTargets).toEqual([]);
    });

    it('returns error popup with descriptive message when no combat context', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      combatData.getCombatSummary.mockReturnValue(null);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Resistance');
      expect(result.payload.description).toBe(
        'No combat context found. Cannot apply Resistance.'
      );
    });

    it('includes automation in error popup fallback when action has no automation property', async () => {
      const ps = makePlayerStats();
      const action = { name: 'Resistance' };
      combatData.getCombatSummary.mockReturnValue(null);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.automation).toEqual({});
    });

    it('includes existing automation in target selection popup', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ customField: 'customValue' });
      combatData.getCombatSummary.mockReturnValue(
        makeCombatSummary(['Goblin'])
      );

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.automation.customField).toBe('customValue');
    });
  });

  describe('applyResistance', () => {
    it('returns null when targetName is missing', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      const result = await applyResistance(
        action,
        ps,
        CAMPAIGN_NAME,
        null,
        'fire'
      );

      expect(result).toBeNull();
    });

    it('returns null when chosenDamageType is missing', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      const result = await applyResistance(
        action,
        ps,
        CAMPAIGN_NAME,
        'Goblin',
        null
      );

      expect(result).toBeNull();
    });

    it('returns null when targetName is empty string', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      const result = await applyResistance(
        action,
        ps,
        CAMPAIGN_NAME,
        '',
        'fire'
      );

      expect(result).toBeNull();
    });

    it('returns null when chosenDamageType is empty string', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      const result = await applyResistance(
        action,
        ps,
        CAMPAIGN_NAME,
        'Goblin',
        ''
      );

      expect(result).toBeNull();
    });

    it('normalizes damage type casing to capitalized form', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      // applyResistance calls getCombatSummary synchronously (no await), so mockReturnValue is correct
      combatData.getCombatSummary.mockReturnValue(
        makeCombatSummary(['Cleric', 'Goblin'])
      );

      await applyResistance(
        action,
        ps,
        CAMPAIGN_NAME,
        'Goblin',
        'fIrE'
      );

      const callArgs = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1] === 'targetEffects'
      );
      const effects = callArgs[2];

      expect(effects[0].chosenType).toBe('Fire');
    });

    it('normalizes damage type casing to capitalized form with multiple words', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      combatData.getCombatSummary.mockReturnValue(
        makeCombatSummary(['Cleric', 'Goblin'])
      );

      await applyResistance(
        action,
        ps,
        CAMPAIGN_NAME,
        'Goblin',
        'cOld'
      );

      const callArgs = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1] === 'targetEffects'
      );
      const effects = callArgs[2];

      expect(effects[0].chosenType).toBe('Cold');
    });

    it('applies damage reduction effect to target with chosen damage type', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      combatData.getCombatSummary.mockReturnValue(
        makeCombatSummary(['Cleric', 'Goblin'])
      );

      const result = await applyResistance(
        action,
        ps,
        CAMPAIGN_NAME,
        'Goblin',
        'fire'
      );

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe(
        'Resistance applied to Goblin. They reduce damage of Fire type by 1d4 (once per turn, Concentration).'
      );
    });

    it('sets targetEffects on campaign with correct effect object', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      combatData.getCombatSummary.mockReturnValue(
        makeCombatSummary(['Cleric', 'Goblin'])
      );

      await applyResistance(
        action,
        ps,
        CAMPAIGN_NAME,
        'Goblin',
        'fire'
      );

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'campaign',
        'targetEffects',
        expect.arrayContaining([
          expect.objectContaining({
            target: 'Goblin',
            effect: 'resistance_damage_reduction',
            source: 'Cleric',
            chosenType: 'Fire',
            duration: 'concentration',
          }),
        ]),
        CAMPAIGN_NAME,
        true
      );
    });

    it('stores the chosen damage type on the target', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      combatData.getCombatSummary.mockReturnValue(
        makeCombatSummary(['Cleric', 'Goblin'])
      );

      await applyResistance(
        action,
        ps,
        CAMPAIGN_NAME,
        'Goblin',
        'fire'
      );

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'resistanceChosenDamageType',
        'Fire',
        CAMPAIGN_NAME
      );
    });

    it('resets resistanceUsedThisTurn flag to false on the target', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      combatData.getCombatSummary.mockReturnValue(
        makeCombatSummary(['Cleric', 'Goblin'])
      );

      await applyResistance(
        action,
        ps,
        CAMPAIGN_NAME,
        'Goblin',
        'fire'
      );

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'resistanceUsedThisTurn',
        false,
        CAMPAIGN_NAME
      );
    });

    it('registers expiration to remove the target effect', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      combatData.getCombatSummary.mockReturnValue(
        makeCombatSummary(['Cleric', 'Goblin'])
      );

      await applyResistance(
        action,
        ps,
        CAMPAIGN_NAME,
        'Goblin',
        'fire'
      );

      expect(expirations.addExpiration).toHaveBeenCalledWith({ attackerName: 'Cleric', targetName: 'Goblin', effects: expect.arrayContaining([
          expect.objectContaining({
            type: 'remove_target_effect',
            effectKey: 'resistance_damage_reduction',
            source: 'Cleric',
          }),
        ]), campaignName: CAMPAIGN_NAME });
    });

    it('registers concentration with combat summary data', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      combatData.getCombatSummary.mockReturnValue(
        makeCombatSummary(['Cleric', 'Goblin'])
      );

      await applyResistance(
        action,
        ps,
        CAMPAIGN_NAME,
        'Goblin',
        'fire'
      );

      expect(concentrationService.addConcentration).toHaveBeenCalledWith(
        expect.objectContaining({
          creatures: expect.arrayContaining([
            expect.objectContaining({ name: 'Cleric' }),
            expect.objectContaining({ name: 'Goblin' }),
          ]),
        }),
        'Cleric',
        'Resistance',
        10
      );
    });

    it('writes a log entry with spell_effect type', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      combatData.getCombatSummary.mockReturnValue(
        makeCombatSummary(['Cleric', 'Goblin'])
      );

      await applyResistance(
        action,
        ps,
        CAMPAIGN_NAME,
        'Goblin',
        'fire'
      );

      expect(logService.addEntry).toHaveBeenCalledWith(CAMPAIGN_NAME, {
        type: 'spell_effect',
        characterName: 'Cleric',
        spellName: 'Resistance',
        targetName: 'Goblin',
        effects: ['Resistance (Fire): reduces damage of chosen type by 1d4, once per turn'],
        timestamp: expect.any(Number),
      });
    });

    it('replaces existing Resistance effect from same source instead of appending', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      useRuntimeState.getRuntimeValue.mockReturnValue([
        { target: 'Goblin', effect: 'resistance_damage_reduction', source: 'Cleric', chosenType: 'Acid', duration: 'concentration' },
        { target: 'Goblin', effect: 'shield_of_faith', source: 'Cleric', chosenType: null, duration: 'concentration' },
      ]);
      combatData.getCombatSummary.mockReturnValue(
        makeCombatSummary(['Cleric', 'Goblin'])
      );

      await applyResistance(
        action,
        ps,
        CAMPAIGN_NAME,
        'Goblin',
        'cold'
      );

      const callArgs = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1] === 'targetEffects'
      );
      const effects = callArgs[2];

      expect(effects.filter((e) => e.effect === 'resistance_damage_reduction')).toHaveLength(1);
      expect(effects.find((e) => e.effect === 'resistance_damage_reduction').chosenType).toBe('Cold');
      expect(effects.find((e) => e.effect === 'shield_of_faith')).toBeTruthy();
    });

    it('replaces Resistance effect from different source without affecting same-target effects from other sources', async () => {
      const ps = makePlayerStats({ name: 'Paladin' });
      const action = makeAction();
      useRuntimeState.getRuntimeValue.mockReturnValue([
        { target: 'Goblin', effect: 'resistance_damage_reduction', source: 'Cleric', chosenType: 'Acid', duration: 'concentration' },
        { target: 'Goblin', effect: 'resistance_damage_reduction', source: 'Paladin', chosenType: 'Fire', duration: 'concentration' },
      ]);
      combatData.getCombatSummary.mockReturnValue(
        makeCombatSummary(['Cleric', 'Paladin', 'Goblin'])
      );

      await applyResistance(
        action,
        ps,
        CAMPAIGN_NAME,
        'Goblin',
        'lightning'
      );

      const callArgs = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1] === 'targetEffects'
      );
      const effects = callArgs[2];

      const paladinResistance = effects.filter(
        (e) => e.effect === 'resistance_damage_reduction' && e.source === 'Paladin'
      );
      expect(paladinResistance).toHaveLength(1);
      expect(paladinResistance[0].chosenType).toBe('Lightning');

      const clericResistance = effects.filter(
        (e) => e.effect === 'resistance_damage_reduction' && e.source === 'Cleric'
      );
      expect(clericResistance).toHaveLength(1);
      expect(clericResistance[0].chosenType).toBe('Acid');
    });

    it('appends when no existing effects array stored', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      useRuntimeState.getRuntimeValue.mockReturnValue(undefined);
      combatData.getCombatSummary.mockReturnValue(
        makeCombatSummary(['Cleric', 'Goblin'])
      );

      await applyResistance(
        action,
        ps,
        CAMPAIGN_NAME,
        'Goblin',
        'fire'
      );

      const callArgs = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1] === 'targetEffects'
      );
      const effects = callArgs[2];

      expect(effects).toHaveLength(1);
      expect(effects[0].effect).toBe('resistance_damage_reduction');
    });

    it('uses playerStats.name as source in effect regardless of action name', async () => {
      const ps = makePlayerStats({ name: 'Paladin' });
      const action = makeAction();
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      combatData.getCombatSummary.mockReturnValue(
        makeCombatSummary(['Paladin', 'Goblin'])
      );

      await applyResistance(
        action,
        ps,
        CAMPAIGN_NAME,
        'Goblin',
        'fire'
      );

      const callArgs = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1] === 'targetEffects'
      );
      const effects = callArgs[2];

      expect(effects[0].source).toBe('Paladin');
    });

    it('uses action.name in log entry, not playerStats.name', async () => {
      const ps = makePlayerStats({ name: 'Paladin' });
      const action = makeAction();
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      combatData.getCombatSummary.mockReturnValue(
        makeCombatSummary(['Paladin', 'Goblin'])
      );

      await applyResistance(
        action,
        ps,
        CAMPAIGN_NAME,
        'Goblin',
        'fire'
      );

      expect(logService.addEntry).toHaveBeenCalledWith(
        CAMPAIGN_NAME,
        expect.objectContaining({
          characterName: 'Paladin',
          spellName: 'Resistance',
        })
      );
    });
  });

  describe('getResistanceDamageType', () => {
    it('returns stored damage type', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue('Fire');

      expect(getResistanceDamageType('Goblin', CAMPAIGN_NAME)).toBe('Fire');
    });

    it('returns undefined when no damage type is stored', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(undefined);

      expect(getResistanceDamageType('Goblin', CAMPAIGN_NAME)).toBeUndefined();
    });

    it('returns null when no damage type is stored', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(null);

      expect(getResistanceDamageType('Goblin', CAMPAIGN_NAME)).toBeNull();
    });
  });

  describe('isResistanceUsedThisTurn', () => {
    it('returns true when flag is true', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(true);
      expect(isResistanceUsedThisTurn('Goblin', CAMPAIGN_NAME)).toBe(true);
    });

    it('returns false when flag is false', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(false);
      expect(isResistanceUsedThisTurn('Goblin', CAMPAIGN_NAME)).toBe(false);
    });

    it('returns false when flag is undefined', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(undefined);
      expect(isResistanceUsedThisTurn('Goblin', CAMPAIGN_NAME)).toBe(false);
    });

    it('returns false when flag is null', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      expect(isResistanceUsedThisTurn('Goblin', CAMPAIGN_NAME)).toBe(false);
    });
  });

  describe('setResistanceUsedThisTurn', () => {
    it('sets the flag to true', () => {
      setResistanceUsedThisTurn('Goblin', true, CAMPAIGN_NAME);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'resistanceUsedThisTurn',
        true,
        CAMPAIGN_NAME
      );
    });

    it('sets the flag to false', () => {
      setResistanceUsedThisTurn('Goblin', false, CAMPAIGN_NAME);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'resistanceUsedThisTurn',
        false,
        CAMPAIGN_NAME
      );
    });
  });
});
