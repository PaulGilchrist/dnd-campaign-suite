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

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

// ── Imports (Vite returns mocked versions) ───────────────────────

import { handle, applyStoneSkin, isStoneSkinActive, getStoneSkinDamageTypes } from './stoneSkinHandler.js';

import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as logService from '../../../ui/logService.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as concentrationService from '../../../combat/concentration/concentrationService.js';
import * as combatData from '../../../encounters/combatData.js';

// ── Helpers ───────────────────────────────────────────────────────

const CAMPAIGN_NAME = 'TestCampaign';
const PLAYER_NAME = 'TestWizard';
const TARGET_NAME = 'Ally1';

function makePlayerStats(overrides = {}) {
  return {
    name: PLAYER_NAME,
    proficiency: 3,
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Stone Skin',
    automation: {
      type: 'protection_from_energy',
      damageTypes: ['Bludgeoning', 'Piercing', 'Slashing'],
      duration: 'Concentration, up to 1 hour',
      ...automation,
    },
  };
}

function makeCombatContext(creatureNames = []) {
  return {
    creatures: creatureNames.map((name) => ({ name })),
  };
}

// ── Tests ─────────────────────────────────────────────────────────

describe('stoneSkinHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handle', () => {
    it('returns info popup when no combat context', async () => {
      damageUtils.getCombatContext.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, 'TestMap');

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Stone Skin');
      expect(result.payload.description).toContain('No combat context found');
      expect(result.payload.description).toContain('Stone Skin');
    });

    it('returns target selection popup with all creatures including caster when combat context exists', async () => {
      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatContext([TARGET_NAME, PLAYER_NAME])
      );

      const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, 'TestMap');

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('stoneSkin_target_selection');
      expect(result.payload.name).toBe('Stone Skin');
      expect(result.payload.creatureTargets).toEqual([TARGET_NAME, PLAYER_NAME]);
      expect(result.payload.automation).toEqual(makeAction().automation);
    });

    it('returns all creatures when only the caster is present', async () => {
      damageUtils.getCombatContext.mockResolvedValue(makeCombatContext([PLAYER_NAME]));

      const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, 'TestMap');

      expect(result.payload.creatureTargets).toEqual([PLAYER_NAME]);
    });

    it('returns empty creatureTargets list when combat context has no creatures', async () => {
      damageUtils.getCombatContext.mockResolvedValue(makeCombatContext([]));

      const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, 'TestMap');

      expect(result.payload.creatureTargets).toEqual([]);
    });

    it('handles action with no automation property', async () => {
      damageUtils.getCombatContext.mockResolvedValue(makeCombatContext([TARGET_NAME]));

      const result = await handle({ name: 'Stone Skin' }, makePlayerStats(), CAMPAIGN_NAME, 'TestMap');

      expect(result.payload.type).toBe('stoneSkin_target_selection');
      expect(result.payload.automation).toEqual({});
    });

    it('passes automation object through to payload', async () => {
      damageUtils.getCombatContext.mockResolvedValue(makeCombatContext([TARGET_NAME]));
      const customAutomation = { type: 'protection_from_energy', damageTypes: ['Fire'] };

      const result = await handle(
        { name: 'Stone Skin', automation: customAutomation },
        makePlayerStats(),
        CAMPAIGN_NAME,
        'TestMap'
      );

      expect(result.payload.automation).toBe(customAutomation);
    });
  });

  describe('applyStoneSkin', () => {
    it('returns null when target is falsy', async () => {
      const result = await applyStoneSkin(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null);
      expect(result).toBeNull();
    });

    it('returns null when target is an empty string', async () => {
      const result = await applyStoneSkin(makeAction(), makePlayerStats(), CAMPAIGN_NAME, '');
      expect(result).toBeNull();
    });

    it('applies resistance buff to target and stores damage types', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue([]);
      combatData.getCombatSummary.mockReturnValue(makeCombatContext([PLAYER_NAME]));

      const result = await applyStoneSkin(makeAction(), makePlayerStats(), CAMPAIGN_NAME, TARGET_NAME);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('Stone Skin');
      expect(result.payload.description).toContain(TARGET_NAME);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        TARGET_NAME,
        'activeBuffs',
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Stone Skin',
            effect: 'damage_resistance',
            resistanceTypes: ['Bludgeoning', 'Piercing', 'Slashing'],
            sourceCharacter: PLAYER_NAME,
          }),
        ]),
        CAMPAIGN_NAME,
      );

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        TARGET_NAME,
        'stoneSkinDamageTypes',
        ['Bludgeoning', 'Piercing', 'Slashing'],
        CAMPAIGN_NAME,
      );

      expect(expirations.addExpiration).toHaveBeenCalledWith({ attackerName: PLAYER_NAME, targetName: TARGET_NAME, effects: expect.any(Array), campaignName: CAMPAIGN_NAME });

      expect(concentrationService.addConcentration).toHaveBeenCalled();
      expect(logService.addEntry).toHaveBeenCalled();
    });

    it('replaces existing Stone Skin buff with updated damage types', async () => {
      const existingBuff = {
        name: 'Stone Skin',
        effect: 'damage_resistance',
        resistanceTypes: ['Bludgeoning'],
      };
      useRuntimeState.getRuntimeValue.mockReturnValue([existingBuff]);
      combatData.getCombatSummary.mockReturnValue(makeCombatContext([PLAYER_NAME]));

      await applyStoneSkin(makeAction(), makePlayerStats(), CAMPAIGN_NAME, TARGET_NAME);

      const buffsArg = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1] === 'activeBuffs'
      )[2];
      const stoneSkinBuffs = buffsArg.filter((b) => b.name === 'Stone Skin');
      expect(stoneSkinBuffs).toHaveLength(1);
      expect(stoneSkinBuffs[0].resistanceTypes).toEqual(['Bludgeoning', 'Piercing', 'Slashing']);
    });

    it('replaces existing Stone Skin while preserving other buffs', async () => {
      const existingStoneSkin = {
        name: 'Stone Skin',
        effect: 'damage_resistance',
        resistanceTypes: ['Bludgeoning'],
      };
      const otherBuff = {
        name: 'Mage Armor',
        effect: 'ac_bonus',
        acValue: 12,
      };
      useRuntimeState.getRuntimeValue.mockReturnValue([existingStoneSkin, otherBuff]);
      combatData.getCombatSummary.mockReturnValue(makeCombatContext([PLAYER_NAME]));

      await applyStoneSkin(makeAction(), makePlayerStats(), CAMPAIGN_NAME, TARGET_NAME);

      const buffsArg = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1] === 'activeBuffs'
      )[2];
      expect(buffsArg).toHaveLength(2);
      expect(buffsArg).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'Mage Armor' }),
          expect.objectContaining({ name: 'Stone Skin', resistanceTypes: ['Bludgeoning', 'Piercing', 'Slashing'] }),
        ]),
      );
    });

    it('uses default damage types when automation does not specify them', async () => {
      const action = makeAction({ damageTypes: undefined });
      useRuntimeState.getRuntimeValue.mockReturnValue([]);
      combatData.getCombatSummary.mockReturnValue(makeCombatContext([PLAYER_NAME]));

      await applyStoneSkin(action, makePlayerStats(), CAMPAIGN_NAME, TARGET_NAME);

      const buffsArg = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1] === 'activeBuffs'
      )[2];
      const stoneSkinBuff = buffsArg.find((b) => b.name === 'Stone Skin');
      expect(stoneSkinBuff.resistanceTypes).toEqual(['Bludgeoning', 'Piercing', 'Slashing']);
    });

    it('uses default damage types when automation is missing entirely', async () => {
      const action = { name: 'Stone Skin' };
      useRuntimeState.getRuntimeValue.mockReturnValue([]);
      combatData.getCombatSummary.mockReturnValue(makeCombatContext([PLAYER_NAME]));

      await applyStoneSkin(action, makePlayerStats(), CAMPAIGN_NAME, TARGET_NAME);

      const buffsArg = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1] === 'activeBuffs'
      )[2];
      const stoneSkinBuff = buffsArg.find((b) => b.name === 'Stone Skin');
      expect(stoneSkinBuff.resistanceTypes).toEqual(['Bludgeoning', 'Piercing', 'Slashing']);
    });

    it('uses default duration when automation has no duration', async () => {
      const action = makeAction({ duration: undefined });
      useRuntimeState.getRuntimeValue.mockReturnValue([]);
      combatData.getCombatSummary.mockReturnValue(makeCombatContext([PLAYER_NAME]));

      await applyStoneSkin(action, makePlayerStats(), CAMPAIGN_NAME, TARGET_NAME);

      const buffsArg = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1] === 'activeBuffs'
      )[2];
      const buff = buffsArg.find((b) => b.name === 'Stone Skin');
      expect(buff.duration).toBe('Concentration, up to 1 hour');
    });

    it('uses custom duration from automation when provided', async () => {
      const action = makeAction({ duration: 'Concentration, up to 10 minutes' });
      useRuntimeState.getRuntimeValue.mockReturnValue([]);
      combatData.getCombatSummary.mockReturnValue(makeCombatContext([PLAYER_NAME]));

      await applyStoneSkin(action, makePlayerStats(), CAMPAIGN_NAME, TARGET_NAME);

      const buffsArg = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1] === 'activeBuffs'
      )[2];
      const buff = buffsArg.find((b) => b.name === 'Stone Skin');
      expect(buff.duration).toBe('Concentration, up to 10 minutes');
    });

    it('adds concentration with save DC from playerStats.spellAbilities.saveDc', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue([]);
      combatData.getCombatSummary.mockReturnValue(makeCombatContext([PLAYER_NAME]));

      await applyStoneSkin(
        makeAction(),
        makePlayerStats({ spellAbilities: { saveDc: 15 } }),
        CAMPAIGN_NAME,
        TARGET_NAME
      );

      expect(concentrationService.addConcentration).toHaveBeenCalledWith(
        expect.objectContaining({ creatures: expect.any(Array) }),
        PLAYER_NAME,
        'Stone Skin',
        15,
        TARGET_NAME,
      );
    });

    it('adds concentration with save DC computed as 8 + proficiency when spellAbilities is missing', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue([]);
      combatData.getCombatSummary.mockReturnValue(makeCombatContext([PLAYER_NAME]));

      await applyStoneSkin(
        makeAction(),
        makePlayerStats({ proficiency: 4 }),
        CAMPAIGN_NAME,
        TARGET_NAME
      );

      // 8 + 4 = 12
      expect(concentrationService.addConcentration).toHaveBeenCalledWith(
        expect.any(Object),
        PLAYER_NAME,
        'Stone Skin',
        12,
        TARGET_NAME,
      );
    });

    it('logs the ability use with correct payload', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue([]);
      combatData.getCombatSummary.mockReturnValue(makeCombatContext([PLAYER_NAME]));

      await applyStoneSkin(makeAction(), makePlayerStats(), CAMPAIGN_NAME, TARGET_NAME);

      expect(logService.addEntry).toHaveBeenCalledWith(CAMPAIGN_NAME, {
        type: 'ability_use',
        characterName: PLAYER_NAME,
        abilityName: 'Stone Skin',
        description: expect.stringContaining(TARGET_NAME),
        targetName: TARGET_NAME,
        timestamp: expect.any(Number),
      });
    });

    it('appends buff when no existing buffs array', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      combatData.getCombatSummary.mockReturnValue(makeCombatContext([PLAYER_NAME]));

      await applyStoneSkin(makeAction(), makePlayerStats(), CAMPAIGN_NAME, TARGET_NAME);

      const buffsArg = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1] === 'activeBuffs'
      )[2];

      expect(buffsArg).toHaveLength(1);
      expect(buffsArg[0].name).toBe('Stone Skin');
      expect(buffsArg[0].resistanceTypes).toEqual(['Bludgeoning', 'Piercing', 'Slashing']);
    });
  });

  describe('isStoneSkinActive', () => {
    it('returns true when Stone Skin buff with damage_resistance exists', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue([
        { name: 'Stone Skin', effect: 'damage_resistance' },
      ]);

      expect(isStoneSkinActive(TARGET_NAME, CAMPAIGN_NAME)).toBe(true);
    });

    it('returns false when buff has wrong name', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue([
        { name: 'Protection from Energy', effect: 'damage_resistance' },
      ]);

      expect(isStoneSkinActive(TARGET_NAME, CAMPAIGN_NAME)).toBe(false);
    });

    it('returns false when buff has wrong effect', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue([
        { name: 'Stone Skin', effect: 'ac_bonus' },
      ]);

      expect(isStoneSkinActive(TARGET_NAME, CAMPAIGN_NAME)).toBe(false);
    });

    it('returns false when activeBuffs is empty', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue([]);

      expect(isStoneSkinActive(TARGET_NAME, CAMPAIGN_NAME)).toBe(false);
    });

    it('returns false when activeBuffs is null', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(null);

      expect(isStoneSkinActive(TARGET_NAME, CAMPAIGN_NAME)).toBe(false);
    });

    it('returns false when activeBuffs is undefined', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(undefined);

      expect(isStoneSkinActive(TARGET_NAME, CAMPAIGN_NAME)).toBe(false);
    });

    it('returns true when multiple buffs include Stone Skin', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue([
        { name: 'Mage Armor', effect: 'ac_bonus' },
        { name: 'Stone Skin', effect: 'damage_resistance' },
        { name: 'Shield', effect: 'ac_bonus' },
      ]);

      expect(isStoneSkinActive(TARGET_NAME, CAMPAIGN_NAME)).toBe(true);
    });

    it('returns false when multiple buffs exist but none match Stone Skin', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue([
        { name: 'Mage Armor', effect: 'ac_bonus' },
        { name: 'Shield', effect: 'ac_bonus' },
      ]);

      expect(isStoneSkinActive(TARGET_NAME, CAMPAIGN_NAME)).toBe(false);
    });
  });

  describe('getStoneSkinDamageTypes', () => {
    it('returns the stored damage types', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(['Bludgeoning', 'Piercing', 'Slashing']);

      expect(getStoneSkinDamageTypes(TARGET_NAME, CAMPAIGN_NAME)).toEqual(['Bludgeoning', 'Piercing', 'Slashing']);
    });

    it('returns null when nothing is stored', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(null);

      expect(getStoneSkinDamageTypes(TARGET_NAME, CAMPAIGN_NAME)).toBeNull();
    });

    it('returns undefined when nothing is stored', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(undefined);

      expect(getStoneSkinDamageTypes(TARGET_NAME, CAMPAIGN_NAME)).toBeUndefined();
    });
  });
});
