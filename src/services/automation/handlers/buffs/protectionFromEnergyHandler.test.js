// @maintained-by-ai
// Owner of the protection_from_energy automation handler contract: popup payload
// shapes, activeBuffs/protectionFromEnergyDamageType runtime writes, expiry,
// concentration registration (SP-093), and logging. Two-stage UI flow gating lives in
// useTwoStageHandlers.protectionFromEnergy.test.js; concentration clearing lives in
// cleanupConcentrationEffects / useInitiativeEffects suites.
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

const DEFAULT_DAMAGE_TYPES = ['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder'];

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
      damageTypes: DEFAULT_DAMAGE_TYPES,
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

function activeBuffsWritten() {
  const callArgs = useRuntimeState.setRuntimeValue.mock.calls.find(
    (c) => c[1] === 'activeBuffs'
  );
  return callArgs[2];
}

// ── Tests ────────────────────────────────────────────────────────

describe('protectionFromEnergyHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handle', () => {
    it('returns target selection popup listing every creature (caster included) with damage types', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatContext([PLAYER_NAME, TARGET_NAME])
      );

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'protectionFromEnergy_target_selection',
          name: 'Protection from Energy',
          creatureTargets: [PLAYER_NAME, TARGET_NAME],
          damageTypes: DEFAULT_DAMAGE_TYPES,
          automation: action.automation,
        },
      });
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

    it('defaults damageTypes and automation when automation is missing', async () => {
      const ps = makePlayerStats();
      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatContext([TARGET_NAME])
      );

      const result = await handle({ name: 'Protection from Energy' }, ps, CAMPAIGN_NAME, null);

      expect(result.payload.damageTypes).toEqual(DEFAULT_DAMAGE_TYPES);
      expect(result.payload.automation).toEqual({});
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
    it('writes resistance buff, damage-type key, expiry, and confirmation popup for a fresh target', async () => {
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

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Protection from Energy',
          automationType: 'protection_from_energy',
          description: 'Protection from Energy applied to Goblin. They now have Resistance to Fire damage.',
          automation: action.automation,
        },
      });

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        TARGET_NAME,
        'activeBuffs',
        [{
          name: 'Protection from Energy',
          effect: 'damage_resistance',
          duration: 'Concentration, up to 1 hour',
          resistanceTypes: ['Fire'],
          sourceCharacter: PLAYER_NAME,
        }],
        CAMPAIGN_NAME
      );

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        TARGET_NAME,
        'protectionFromEnergyDamageType',
        'Fire',
        CAMPAIGN_NAME
      );

      expect(expirations.addExpiration).toHaveBeenCalledWith({
        attackerName: PLAYER_NAME,
        targetName: TARGET_NAME,
        effects: [{ type: 'remove_active_buff', buffName: 'Protection from Energy' }],
        campaignName: CAMPAIGN_NAME,
      });
    });

    it('normalizes damage type first-letter upper rest lower', async () => {
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

    it('returns null with no side effects when targetName or chosenDamageType is missing', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      const cases = [
        [null, 'fire'],
        ['', 'fire'],
        [TARGET_NAME, null],
        [TARGET_NAME, ''],
        [null, null],
      ];
      for (const [target, type] of cases) {
        expect(await applyProtectionFromEnergy(action, ps, CAMPAIGN_NAME, target, type)).toBeNull();
      }

      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(expirations.addExpiration).not.toHaveBeenCalled();
      expect(concentrationService.addConcentration).not.toHaveBeenCalled();
      expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('replaces an existing protection buff with the new damage type, preserving unrelated buffs', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue([
        { name: 'Shield of Faith', effect: 'ac_bonus', acBonus: 2 },
        { name: 'Protection from Energy', effect: 'damage_resistance', resistanceTypes: ['Acid'] },
      ]);
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

      const buffs = activeBuffsWritten();
      expect(buffs).toEqual([
        { name: 'Shield of Faith', effect: 'ac_bonus', acBonus: 2 },
        {
          name: 'Protection from Energy',
          effect: 'damage_resistance',
          duration: 'Concentration, up to 1 hour',
          resistanceTypes: ['Cold'],
          sourceCharacter: PLAYER_NAME,
        },
      ]);
    });

    it('appends the buff, preserving other buffs, when no protection buff exists', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue([
        { name: 'Shield of Faith', effect: 'ac_bonus', acBonus: 2 },
        { name: 'Bless', effect: 'ability_check_bless' },
      ]);
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

      const buffs = activeBuffsWritten();
      expect(buffs).toEqual([
        { name: 'Shield of Faith', effect: 'ac_bonus', acBonus: 2 },
        { name: 'Bless', effect: 'ability_check_bless' },
        {
          name: 'Protection from Energy',
          effect: 'damage_resistance',
          duration: 'Concentration, up to 1 hour',
          resistanceTypes: ['Cold'],
          sourceCharacter: PLAYER_NAME,
        },
      ]);
    });

    it('uses custom duration from automation when provided', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      combatData.getCombatSummary.mockReturnValue(
        makeCombatContext([TARGET_NAME])
      );

      await applyProtectionFromEnergy(
        makeAction({ duration: 'Concentration, up to 10 minutes' }),
        makePlayerStats(),
        CAMPAIGN_NAME,
        TARGET_NAME,
        'fire'
      );

      const buff = activeBuffsWritten().find((b) => b.name === 'Protection from Energy');
      expect(buff.duration).toBe('Concentration, up to 10 minutes');
    });

    it('logs the cast to the campaign log', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      combatData.getCombatSummary.mockReturnValue(
        makeCombatContext([TARGET_NAME])
      );

      await applyProtectionFromEnergy(
        makeAction(),
        makePlayerStats(),
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

    it('registers concentration using spellAbilities save DC', async () => {
      const ps = makePlayerStats({ spellAbilities: { saveDc: 13 }, proficiency: 3 });
      const cs = makeCombatContext([PLAYER_NAME, TARGET_NAME]);
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      combatData.getCombatSummary.mockReturnValue(cs);

      await applyProtectionFromEnergy(
        makeAction(),
        ps,
        CAMPAIGN_NAME,
        TARGET_NAME,
        'fire'
      );

      expect(concentrationService.addConcentration).toHaveBeenCalledWith(
        cs,
        PLAYER_NAME,
        'Protection from Energy',
        13,
        TARGET_NAME
      );
    });

    it('computes save DC as 8 + proficiency when spellAbilities is missing', async () => {
      const ps = makePlayerStats({ proficiency: 3 });
      const cs = makeCombatContext([PLAYER_NAME, TARGET_NAME]);
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      combatData.getCombatSummary.mockReturnValue(cs);

      await applyProtectionFromEnergy(
        makeAction(),
        ps,
        CAMPAIGN_NAME,
        TARGET_NAME,
        'fire'
      );

      // 8 + proficiency(3) = 11
      expect(concentrationService.addConcentration).toHaveBeenCalledWith(
        cs,
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
      expect(storageService.default.set).toHaveBeenCalledWith('combatSummary', cs, CAMPAIGN_NAME);

      // persist happens AFTER the concentration write
      const concCall = concentrationService.addConcentration.mock.invocationCallOrder[0];
      const storageCall = storageService.default.set.mock.invocationCallOrder[0];
      expect(storageCall).toBeGreaterThan(concCall);
    });
  });

  describe('isProtectionFromEnergyActive', () => {
    it('returns true when buff with correct name and effect exists', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue([
        { name: 'Protection from Energy', effect: 'damage_resistance' },
      ]);

      expect(isProtectionFromEnergyActive(TARGET_NAME, CAMPAIGN_NAME)).toBe(true);
    });

    it('returns true when the matching buff sits alongside other buffs', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue([
        { name: 'Shield of Faith', effect: 'ac_bonus' },
        { name: 'Protection from Energy', effect: 'damage_resistance' },
        { name: 'Bless', effect: 'ability_check_bless' },
      ]);

      expect(isProtectionFromEnergyActive(TARGET_NAME, CAMPAIGN_NAME)).toBe(true);
    });

    it('returns false for empty, null, or undefined stored values', () => {
      for (const stored of [[], null, undefined]) {
        useRuntimeState.getRuntimeValue.mockReturnValue(stored);
        expect(isProtectionFromEnergyActive(TARGET_NAME, CAMPAIGN_NAME)).toBe(false);
      }
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
  });

  describe('getProtectionFromEnergyDamageType', () => {
    it('reads the stored damage type by key and passes it through', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue('Fire');

      expect(getProtectionFromEnergyDamageType(TARGET_NAME, CAMPAIGN_NAME)).toBe('Fire');
      expect(useRuntimeState.getRuntimeValue).toHaveBeenCalledWith(
        TARGET_NAME,
        'protectionFromEnergyDamageType',
        CAMPAIGN_NAME
      );
    });
  });
});
