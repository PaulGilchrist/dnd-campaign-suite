import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../hooks/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../maps/mapsService.js', () => ({
  loadMapData: vi.fn(),
}));

vi.mock('../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../rules/combat/rangeValidation.js', () => ({
  rangeToFeet: vi.fn(),
}));

vi.mock('../../shared/abilityLookup.js', () => ({
  getAbilityModifier: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './conditionHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import * as mapsService from '../../maps/mapsService.js';
import { getCombatContext } from '../../rules/combat/damageUtils.js';
import { rangeToFeet } from '../../rules/combat/rangeValidation.js';
import { getAbilityModifier } from '../../shared/abilityLookup.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';
const mapName = ' tavern-map';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestHero',
    level: 5,
    proficiency: 3,
    abilities: [
      { name: 'Wisdom', bonus: 2 },
      { name: 'Strength', bonus: 4 },
    ],
    class: {
      class_levels: [
        {},
        {},
        {},
        { channel_divinity: 3 },
      ],
    },
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Divine Smite',
    automation: {
      type: 'channel_divinity',
      ...automation,
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('conditionHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('buildSaveDc', () => {
    it('should return ability-based DC when saveDc === "ability" with explicit saveAbility', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ saveDc: 'ability', saveAbility: 'STR' });

      getAbilityModifier.mockReturnValue(4);
      getCombatContext.mockResolvedValue({});

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('modal');
      // 8 + STR modifier(4) + proficiency(3) = 15
      expect(result.payload.saveDc).toBe(15);
    });

    it('should return ability-based DC when saveDc === "ability" using default WIS', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ saveDc: 'ability' });

      getAbilityModifier.mockReturnValue(2);
      getCombatContext.mockResolvedValue({});

      const result = await handle(action, ps, campaignName, null);

      // 8 + WIS modifier(2) + proficiency(3) = 13
      expect(result.payload.saveDc).toBe(13);
    });

    it('should return numeric saveDc directly when saveDc is a number', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ saveDc: 16 });

      getCombatContext.mockResolvedValue({});

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.saveDc).toBe(16);
    });

    it('should return fallback DC (8 + WIS bonus + prof) when saveDc is falsy', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      getCombatContext.mockResolvedValue({});

      const result = await handle(action, ps, campaignName, null);

      // 8 + WIS bonus(2) + proficiency(3) = 13
      expect(result.payload.saveDc).toBe(13);
    });
  });

  describe('charge handling', () => {
    it('should return "no charges" popup when currentCharges is 0', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(0);
      getCombatContext.mockResolvedValue({});

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('No Channel Divinity charges remaining.');
    });

    it('should return "no charges" popup when currentCharges is negative', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(-1);
      getCombatContext.mockResolvedValue({});

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('No Channel Divinity charges remaining.');
    });

    it('should decrement charges and return modal when charges > 0', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(3);
      getCombatContext.mockResolvedValue({ combatLog: [] });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('setCondition');
    });

    it('should call setRuntimeValue with decremented charge count', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(3);
      getCombatContext.mockResolvedValue({});

      await handle(action, ps, campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'channelDivinityCharges', 2, campaignName);
    });

    it('should use max charges from class_levels when no stored value', async () => {
      const ps = makePlayerStats({ level: 4 });
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(undefined);
      getCombatContext.mockResolvedValue({});

      await handle(action, ps, campaignName, null);

      // storedCharges is undefined, so currentCharges = maxCharges (3 from class_levels[3])
      // newCharges = 3 - 1 = 2
      expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'channelDivinityCharges', 2, campaignName);
    });

    it('should default to 2 charges when class data is missing', async () => {
      const ps = makePlayerStats({ class: null });
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(undefined);
      getCombatContext.mockResolvedValue({});

      await handle(action, ps, campaignName, null);

      // currentCharges = maxCharges = 2 (default)
      // newCharges = 2 - 1 = 1
      expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'channelDivinityCharges', 1, campaignName);
    });
  });

  describe('condition and save configuration', () => {
    it('should use default condition "frightened" when auto.condition is missing', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(2);
      getCombatContext.mockResolvedValue({});

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.conditionName).toBe('frightened');
    });

    it('should use custom condition from auto.condition', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ condition: 'paralyzed' });

      getRuntimeValue.mockReturnValue(2);
      getCombatContext.mockResolvedValue({});

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.conditionName).toBe('paralyzed');
    });

    it('should use default saveType "WIS" when auto.saveType is missing', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(2);
      getCombatContext.mockResolvedValue({});

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.saveType).toBe('WIS');
    });

    it('should use custom saveType from auto.saveType', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ saveType: 'CON' });

      getRuntimeValue.mockReturnValue(2);
      getCombatContext.mockResolvedValue({});

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.saveType).toBe('CON');
    });
  });

  describe('range handling', () => {
    it('should use default range 60 when rangeToFeet returns falsy', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(2);
      rangeToFeet.mockReturnValue(null);
      getCombatContext.mockResolvedValue({});

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.rangeFeet).toBe(60);
    });

    it('should use custom range from rangeToFeet', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ range: '30ft' });

      getRuntimeValue.mockReturnValue(2);
      rangeToFeet.mockReturnValue(30);
      getCombatContext.mockResolvedValue({});

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.rangeFeet).toBe(30);
    });
  });

  describe('map and attacker position', () => {
    it('should include attackerPos when mapName provided and attacker found in mapData', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(2);
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: 'TestHero', gridX: 5, gridY: 10 }],
      });
      getCombatContext.mockResolvedValue({});

      const result = await handle(action, ps, campaignName, mapName);

      expect(result.payload.attackerPos).toEqual({ gridX: 5, gridY: 10 });
    });

    it('should return null attackerPos when mapName provided but attacker not in mapData', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(2);
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: 'OtherHero', gridX: 1, gridY: 2 }],
      });
      getCombatContext.mockResolvedValue({});

      const result = await handle(action, ps, campaignName, mapName);

      expect(result.payload.attackerPos).toBeNull();
    });

    it('should return null attackerPos when mapName is falsy', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(2);
      getCombatContext.mockResolvedValue({});

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.attackerPos).toBeNull();
    });
  });

  describe('logging', () => {
    it('should call addEntry with correct description format including saveType, DC, and range', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ saveType: 'DEX', range: '30ft' });

      getRuntimeValue.mockReturnValue(2);
      rangeToFeet.mockReturnValue(30);
      getCombatContext.mockResolvedValue({});

      await handle(action, ps, campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestHero',
        abilityName: 'Divine Smite',
        description: 'Divine Smite activated — DEX save DC 13, all targets within 30 ft.',
      });
    });
  });

  describe('modal payload', () => {
    it('should include combatSummary in modal payload', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(2);
      getCombatContext.mockResolvedValue({ round: 3, initiative: [] });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.combatSummary).toEqual({ round: 3, initiative: [] });
    });

    it('should parse duration "1_minute" to 10 rounds', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ duration: '1_minute' });

      getRuntimeValue.mockReturnValue(2);
      getCombatContext.mockResolvedValue({});

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.durationRounds).toBe(10);
    });

    it('should parse duration "3_rounds" to 3 rounds', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ duration: '3_rounds' });

      getRuntimeValue.mockReturnValue(2);
      getCombatContext.mockResolvedValue({});

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.durationRounds).toBe(3);
    });

    it('should return undefined durationRounds when no matching pattern', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ duration: 'until_end_of_combat' });

      getRuntimeValue.mockReturnValue(2);
      getCombatContext.mockResolvedValue({});

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.durationRounds).toBeUndefined();
    });

    it('should return undefined durationRounds when duration is missing', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(2);
      getCombatContext.mockResolvedValue({});

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.durationRounds).toBeUndefined();
    });

    it('should include additionalCondition in payload when provided', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ additionalCondition: 'prone' });

      getRuntimeValue.mockReturnValue(2);
      getCombatContext.mockResolvedValue({});

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.additionalCondition).toBe('prone');
    });

    it('should include null additionalCondition when not provided', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(2);
      getCombatContext.mockResolvedValue({});

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.additionalCondition).toBeNull();
    });
  });
});
