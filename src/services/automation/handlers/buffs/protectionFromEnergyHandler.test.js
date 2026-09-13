// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports (hoisted by vitest) ─────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../ui/storage.js', () => ({
  default: { set: vi.fn() },
}));

// ── Imports (Vite returns mocked versions) ───────────────────────

import {
  handle,
  applyProtectionFromEnergy,
  isProtectionFromEnergyActive,
  getProtectionFromEnergyDamageType,
} from './protectionFromEnergyHandler.js';

import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as concentrationService from '../../../combat/concentration/concentrationService.js';
import * as combatData from '../../../encounters/combatData.js';
import * as logService from '../../../ui/logService.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as storageService from '../../../ui/storage.js';

// ── Helpers ───────────────────────────────────────────────────────

const CAMPAIGN_NAME = 'TestCampaign';
const PLAYER_NAME = 'Wizard';
const TARGET_NAME = 'Goblin';

function makePlayerStats(overrides = {}) {
  return {
    name: PLAYER_NAME,
    level: 5,
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Protection from Energy',
    automation: {
      type: 'protection_from_energy',
      damageTypes: ['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder'],
      ...automation,
    },
  };
}

function makeCombatContext(creatureNames = []) {
  return {
    creatures: creatureNames.map((name) => ({
      name,
      type: name === PLAYER_NAME ? 'player' : 'npc',
    })),
  };
}

// ── Tests ────────────────────────────────────────────────────────

describe('protectionFromEnergyHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handle', () => {
    it('returns target selection popup with creature list and damage types when combat context exists', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatContext([TARGET_NAME])
      );

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('protectionFromEnergy_target_selection');
      expect(result.payload.name).toBe('Protection from Energy');
      expect(result.payload.creatureTargets).toEqual([TARGET_NAME]);
      expect(result.payload.damageTypes).toEqual(['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder']);
      expect(result.payload.automation).toEqual(action.automation);
    });

    it('includes the caster in creature targets', async () => {
      const ps = makePlayerStats({ name: PLAYER_NAME });
      const action = makeAction();
      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatContext([PLAYER_NAME, TARGET_NAME])
      );

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.creatureTargets).toContain(PLAYER_NAME);
      expect(result.payload.creatureTargets).toContain(TARGET_NAME);
      expect(result.payload.creatureTargets).toHaveLength(2);
    });

    it('returns all creatures when caster is the only creature', async () => {
      const ps = makePlayerStats({ name: PLAYER_NAME });
      const action = makeAction();
      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatContext([PLAYER_NAME])
      );

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.creatureTargets).toEqual([PLAYER_NAME]);
    });

    it('returns error popup with descriptive message when no combat context', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      damageUtils.getCombatContext.mockResolvedValue(null);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Protection from Energy');
      expect(result.payload.description).toContain('No combat context found');
      expect(result.payload.description).toContain('Protection from Energy');
    });

    it('defaults damageTypes when automation is missing', async () => {
      const ps = makePlayerStats();
      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatContext([TARGET_NAME])
      );

      const result = await handle({ name: 'Protection from Energy' }, ps, CAMPAIGN_NAME, null);

      expect(result.payload.damageTypes).toEqual(['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder']);
      expect(result.payload.automation).toEqual({});
    });

    it('defaults damageTypes when automation exists but has no damageTypes', async () => {
      const ps = makePlayerStats();
      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatContext([TARGET_NAME])
      );

      const result = await handle(
        { name: 'Protection from Energy', automation: {} },
        ps,
        CAMPAIGN_NAME,
        null
      );

      expect(result.payload.damageTypes).toEqual(['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder']);
    });

    it('passes custom damageTypes from automation through to payload', async () => {
      const ps = makePlayerStats();
      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatContext([TARGET_NAME])
      );

      const customTypes = ['Fire', 'Cold'];
      const result = await handle(
        { name: 'Protection from Energy', automation: { damageTypes: customTypes } },
        ps,
        CAMPAIGN_NAME,
        null
      );

      expect(result.payload.damageTypes).toEqual(customTypes);
    });
  });

  describe('applyProtectionFromEnergy', () => {
    it('applies resistance buff to target with chosen damage type', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      combatData.getCombatSummary.mockReturnValue(
        makeCombatContext([PLAYER_NAME, TARGET_NAME])
      );

      const result = await applyProtectionFromEnergy(
        action,
        ps,
        CAMPAIGN_NAME,
        TARGET_NAME,
        'fire'
      );

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('Resistance to Fire damage');

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        TARGET_NAME,
        'activeBuffs',
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Protection from Energy',
            effect: 'damage_resistance',
            resistanceTypes: ['Fire'],
            duration: 'Concentration, up to 1 hour',
            sourceCharacter: PLAYER_NAME,
          }),
        ]),
        CAMPAIGN_NAME
      );

      expect(expirations.addExpiration).toHaveBeenCalledWith({ attackerName: PLAYER_NAME, targetName: TARGET_NAME, effects: expect.arrayContaining([
          expect.objectContaining({
            type: 'remove_active_buff',
            buffName: 'Protection from Energy',
          }),
        ]), campaignName: CAMPAIGN_NAME });
    });

    it('normalizes damage type capitalization', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      combatData.getCombatSummary.mockReturnValue(
        makeCombatContext([TARGET_NAME])
      );

      await applyProtectionFromEnergy(
        action,
        ps,
        CAMPAIGN_NAME,
        TARGET_NAME,
        'lightning'
      );

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        TARGET_NAME,
        'protectionFromEnergyDamageType',
        'Lightning',
        CAMPAIGN_NAME
      );
    });

    it('normalizes mixed-case damage type with first-letter upper rest lower', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      combatData.getCombatSummary.mockReturnValue(
        makeCombatContext([TARGET_NAME])
      );

      await applyProtectionFromEnergy(
        action,
        ps,
        CAMPAIGN_NAME,
        TARGET_NAME,
        'NaOtRiC'
      );

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        TARGET_NAME,
        'protectionFromEnergyDamageType',
        'Naotric',
        CAMPAIGN_NAME
      );
    });

    it('returns null when targetName is missing or empty', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      expect(await applyProtectionFromEnergy(action, ps, CAMPAIGN_NAME, null, 'fire')).toBeNull();
      expect(await applyProtectionFromEnergy(action, ps, CAMPAIGN_NAME, '', 'fire')).toBeNull();
    });

    it('returns null when chosenDamageType is missing or empty', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      expect(await applyProtectionFromEnergy(action, ps, CAMPAIGN_NAME, TARGET_NAME, null)).toBeNull();
      expect(await applyProtectionFromEnergy(action, ps, CAMPAIGN_NAME, TARGET_NAME, '')).toBeNull();
    });

    it('returns null when both targetName and chosenDamageType are missing', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      expect(await applyProtectionFromEnergy(action, ps, CAMPAIGN_NAME, null, null)).toBeNull();
    });

    it('replaces existing buff instead of appending', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      useRuntimeState.getRuntimeValue.mockReturnValue([
        { name: 'Protection from Energy', effect: 'damage_resistance', resistanceTypes: ['Acid'] },
        { name: 'Shield of Faith', effect: 'ac_bonus', acBonus: 2 },
      ]);
      combatData.getCombatSummary.mockReturnValue(
        makeCombatContext([TARGET_NAME])
      );

      await applyProtectionFromEnergy(
        action,
        ps,
        CAMPAIGN_NAME,
        TARGET_NAME,
        'cold'
      );

      const callArgs = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1] === 'activeBuffs'
      );
      const buffs = callArgs[2];

      expect(buffs.filter((b) => b.name === 'Protection from Energy')).toHaveLength(1);
      expect(buffs.find((b) => b.name === 'Protection from Energy').resistanceTypes).toEqual(['Cold']);
      expect(buffs.find((b) => b.name === 'Shield of Faith')).toBeTruthy();
    });

    it('uses custom duration from automation when provided', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ duration: 'Concentration, up to 10 minutes' });
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      combatData.getCombatSummary.mockReturnValue(
        makeCombatContext([TARGET_NAME])
      );

      await applyProtectionFromEnergy(
        action,
        ps,
        CAMPAIGN_NAME,
        TARGET_NAME,
        'fire'
      );

      const callArgs = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1] === 'activeBuffs'
      );
      const buffs = callArgs[2];
      const buff = buffs.find((b) => b.name === 'Protection from Energy');

      expect(buff.duration).toBe('Concentration, up to 10 minutes');
    });

    it('uses default duration when automation has no duration', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ duration: undefined });
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      combatData.getCombatSummary.mockReturnValue(
        makeCombatContext([TARGET_NAME])
      );

      await applyProtectionFromEnergy(
        action,
        ps,
        CAMPAIGN_NAME,
        TARGET_NAME,
        'fire'
      );

      const callArgs = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1] === 'activeBuffs'
      );
      const buffs = callArgs[2];
      const buff = buffs.find((b) => b.name === 'Protection from Energy');

      expect(buff.duration).toBe('Concentration, up to 1 hour');
    });

    it('calls addEntry with the correct log payload', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      combatData.getCombatSummary.mockReturnValue(
        makeCombatContext([TARGET_NAME])
      );

      await applyProtectionFromEnergy(
        action,
        ps,
        CAMPAIGN_NAME,
        TARGET_NAME,
        'fire'
      );

      expect(logService.addEntry).toHaveBeenCalledWith(CAMPAIGN_NAME, {
        type: 'ability_use',
        characterName: PLAYER_NAME,
        abilityName: 'Protection from Energy',
        description: `${PLAYER_NAME} cast Protection from Energy on ${TARGET_NAME} for Fire resistance.`,
        targetName: TARGET_NAME,
        timestamp: expect.any(Number),
      });
    });

    it('calls addConcentration with correct parameters', async () => {
      const ps = makePlayerStats({ spellAbilities: { saveDc: 13 }, proficiency: 3 });
      const action = makeAction();
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      combatData.getCombatSummary.mockReturnValue(
        makeCombatContext([PLAYER_NAME, TARGET_NAME])
      );

      await applyProtectionFromEnergy(
        action,
        ps,
        CAMPAIGN_NAME,
        TARGET_NAME,
        'fire'
      );

      expect(concentrationService.addConcentration).toHaveBeenCalledWith(
        expect.objectContaining({ creatures: expect.any(Array) }),
        PLAYER_NAME,
        'Protection from Energy',
        13,
        TARGET_NAME
      );
    });

    it('computes save DC from proficiency when spellAbilities is missing', async () => {
      const ps = makePlayerStats({ proficiency: 3 });
      const action = makeAction();
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      combatData.getCombatSummary.mockReturnValue(
        makeCombatContext([PLAYER_NAME, TARGET_NAME])
      );

      await applyProtectionFromEnergy(
        action,
        ps,
        CAMPAIGN_NAME,
        TARGET_NAME,
        'fire'
      );

      // 8 + proficiency(3) = 11
      expect(concentrationService.addConcentration).toHaveBeenCalledWith(
        expect.any(Object),
        PLAYER_NAME,
        'Protection from Energy',
        11,
        TARGET_NAME
      );
    });

    it('persists combatSummary after addConcentration (SP-093)', async () => {
      const ps = makePlayerStats({ spellAbilities: { saveDc: 18 }, proficiency: 3 });
      const action = makeAction();
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      const cs = makeCombatContext([PLAYER_NAME, TARGET_NAME]);
      combatData.getCombatSummary.mockReturnValue(cs);
      concentrationService.addConcentration.mockImplementation((summary, name, spellName, dc, target) => {
        const creature = summary.creatures.find((c) => c.name === name);
        if (creature) creature.concentration = { spell: spellName, dc, target };
      });

      await applyProtectionFromEnergy(action, ps, CAMPAIGN_NAME, TARGET_NAME, 'lightning');

      // concentration written on the summary then persisted (fearHandler pattern)
      expect(concentrationService.addConcentration).toHaveBeenCalled();
      expect(storageService.default.set).toHaveBeenCalledWith('combatSummary', cs, CAMPAIGN_NAME);

      // persist happens AFTER the concentration write
      const concCall = concentrationService.addConcentration.mock.invocationCallOrder[0];
      const storageCall = storageService.default.set.mock.invocationCallOrder[0];
      expect(storageCall).toBeGreaterThan(concCall);
    });

    it('preserves other buffs when replacing protection buff', async () => {
      const existingBuffs = [
        { name: 'Shield of Faith', effect: 'ac_bonus', acBonus: 2 },
        { name: 'Bless', effect: 'ability_check_bless' },
      ];
      useRuntimeState.getRuntimeValue.mockReturnValue(existingBuffs);
      combatData.getCombatSummary.mockReturnValue(
        makeCombatContext([TARGET_NAME])
      );

      await applyProtectionFromEnergy(
        makeAction(),
        makePlayerStats(),
        CAMPAIGN_NAME,
        TARGET_NAME,
        'cold'
      );

      const callArgs = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1] === 'activeBuffs'
      );
      const buffs = callArgs[2];

      expect(buffs).toHaveLength(3);
      expect(buffs.find((b) => b.name === 'Shield of Faith')).toBeTruthy();
      expect(buffs.find((b) => b.name === 'Bless')).toBeTruthy();
      expect(buffs.find((b) => b.name === 'Protection from Energy')).toBeTruthy();
    });

    it('appends buff when no existing buffs array', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      combatData.getCombatSummary.mockReturnValue(
        makeCombatContext([TARGET_NAME])
      );

      await applyProtectionFromEnergy(
        action,
        ps,
        CAMPAIGN_NAME,
        TARGET_NAME,
        'fire'
      );

      const callArgs = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1] === 'activeBuffs'
      );
      const buffs = callArgs[2];

      expect(buffs).toHaveLength(1);
      expect(buffs[0].name).toBe('Protection from Energy');
      expect(buffs[0].resistanceTypes).toEqual(['Fire']);
    });

    it('sets the protectionFromEnergyDamageType on the target', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      combatData.getCombatSummary.mockReturnValue(
        makeCombatContext([TARGET_NAME])
      );

      await applyProtectionFromEnergy(
        action,
        ps,
        CAMPAIGN_NAME,
        TARGET_NAME,
        'acid'
      );

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        TARGET_NAME,
        'protectionFromEnergyDamageType',
        'Acid',
        CAMPAIGN_NAME
      );
    });
  });

  describe('isProtectionFromEnergyActive', () => {
    it('returns true when buff with correct name and effect exists', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue([
        { name: 'Protection from Energy', effect: 'damage_resistance' },
      ]);

      expect(isProtectionFromEnergyActive(TARGET_NAME, CAMPAIGN_NAME)).toBe(true);
    });

    it('returns false when activeBuffs is empty', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue([]);

      expect(isProtectionFromEnergyActive(TARGET_NAME, CAMPAIGN_NAME)).toBe(false);
    });

    it('returns false when stored value is null', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(null);

      expect(isProtectionFromEnergyActive(TARGET_NAME, CAMPAIGN_NAME)).toBe(false);
    });

    it('returns false when stored value is undefined', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(undefined);

      expect(isProtectionFromEnergyActive(TARGET_NAME, CAMPAIGN_NAME)).toBe(false);
    });

    it('returns false when buff has wrong name', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue([
        { name: 'Protection from Evil and Good', effect: 'damage_resistance' },
      ]);

      expect(isProtectionFromEnergyActive(TARGET_NAME, CAMPAIGN_NAME)).toBe(false);
    });

    it('returns false when buff has wrong effect', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue([
        { name: 'Protection from Energy', effect: 'something_else' },
      ]);

      expect(isProtectionFromEnergyActive(TARGET_NAME, CAMPAIGN_NAME)).toBe(false);
    });

    it('returns false when multiple buffs exist but none match', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue([
        { name: 'Shield of Faith', effect: 'ac_bonus' },
        { name: 'Bless', effect: 'ability_check_bless' },
      ]);

      expect(isProtectionFromEnergyActive(TARGET_NAME, CAMPAIGN_NAME)).toBe(false);
    });

    it('returns true even when other buffs are present alongside the matching one', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue([
        { name: 'Shield of Faith', effect: 'ac_bonus' },
        { name: 'Protection from Energy', effect: 'damage_resistance' },
        { name: 'Bless', effect: 'ability_check_bless' },
      ]);

      expect(isProtectionFromEnergyActive(TARGET_NAME, CAMPAIGN_NAME)).toBe(true);
    });
  });

  describe('getProtectionFromEnergyDamageType', () => {
    it('returns stored damage type', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue('Fire');

      expect(getProtectionFromEnergyDamageType(TARGET_NAME, CAMPAIGN_NAME)).toBe('Fire');
    });

    it('returns null when stored value is null', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(null);

      expect(getProtectionFromEnergyDamageType(TARGET_NAME, CAMPAIGN_NAME)).toBeNull();
    });

    it('returns undefined when stored value is undefined', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(undefined);

      expect(getProtectionFromEnergyDamageType(TARGET_NAME, CAMPAIGN_NAME)).toBeUndefined();
    });
  });
});
