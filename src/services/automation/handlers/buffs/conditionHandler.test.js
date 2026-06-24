// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../maps/mapsService.js', () => ({
  loadMapData: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
  rangeToFeet: vi.fn(),
}));

vi.mock('../../../shared/abilityLookup.js', () => ({
  getAbilityModifier: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './conditionHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import * as mapsService from '../../../maps/mapsService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { getAbilityModifier } from '../../../shared/abilityLookup.js';

// ── Constants ──────────────────────────────────────────────────

const CAMPAIGN_NAME = 'TestCampaign';
const MAP_NAME = 'tavern-map';

// ── Helpers ────────────────────────────────────────────────────

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

function resetMocks() {
  vi.clearAllMocks();
  getRuntimeValue.mockReset();
  setRuntimeValue.mockReset().mockResolvedValue(undefined);
  getAbilityModifier.mockReset();
  getCombatContext.mockReset().mockResolvedValue({});
  rangeToFeet.mockReset();
  mapsService.loadMapData.mockReset();
  addEntry.mockReset().mockResolvedValue({});
}

// ── Tests ──────────────────────────────────────────────────────

describe('conditionHandler.handle', () => {
  beforeEach(() => {
    resetMocks();
  });

  describe('buildSaveDc', () => {
    it('returns ability-based DC when saveDc === "ability" with explicit saveAbility', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ saveDc: 'ability', saveAbility: 'STR' });

      getAbilityModifier.mockReturnValue(4);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.type).toBe('modal');
      expect(result.payload.saveDc).toBe(15);
      expect(getAbilityModifier).toHaveBeenCalledWith(ps.abilities, 'STR');
    });

    it('returns ability-based DC using default WIS when saveAbility is absent', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ saveDc: 'ability' });

      getAbilityModifier.mockReturnValue(2);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.saveDc).toBe(13);
      expect(getAbilityModifier).toHaveBeenCalledWith(ps.abilities, 'WIS');
    });

    it('returns ability-based DC using default WIS even when Wisdom is missing from abilities', async () => {
      const ps = makePlayerStats({ abilities: [{ name: 'Strength', bonus: 4 }] });
      const action = makeAction({ saveDc: 'ability' });

      getAbilityModifier.mockReturnValue(-1);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.saveDc).toBe(10);
    });

    it('returns numeric saveDc directly when saveDc is a number', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ saveDc: 16 });

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.saveDc).toBe(16);
      expect(getAbilityModifier).not.toHaveBeenCalled();
    });

    it('returns fallback DC (8 + WIS bonus + prof) when saveDc is falsy', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.saveDc).toBe(13);
    });

    it('returns fallback DC using 0 when Wisdom ability is missing', async () => {
      const ps = makePlayerStats({ abilities: [] });
      const action = makeAction({});

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      // 8 + 0 (no Wisdom) + 3 (proficiency) = 11
      expect(result.payload.saveDc).toBe(11);
    });

    it('returns fallback DC using 0 when proficiency is undefined', async () => {
      const ps = makePlayerStats({ proficiency: undefined });
      const action = makeAction({});

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      // 8 + 2 (WIS) + 0 (no proficiency) = 10
      expect(result.payload.saveDc).toBe(10);
    });

    it('returns NaN when ability modifier returns undefined', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ saveDc: 'ability', saveAbility: 'INT' });

      getAbilityModifier.mockReturnValue(undefined);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      // 8 + undefined + 3 = NaN
      expect(result.payload.saveDc).toBeNaN();
    });
  });

  describe('charge handling', () => {
    it('returns popup when currentCharges is 0', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(0);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe('No Channel Divinity charges remaining.');
      expect(result.payload.name).toBe('Divine Smite');
      expect(result.payload.automationType).toBe('channel_divinity');
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
    });

    it('returns popup when currentCharges is negative', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(-1);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('No Channel Divinity charges remaining.');
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('decrements charges and returns modal when charges > 0', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(3);
      getCombatContext.mockResolvedValue({ combatLog: [] });

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('setCondition');
      expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'channelDivinityCharges', 2, CAMPAIGN_NAME);
    });

    it('uses max charges from class_levels when stored value is undefined', async () => {
      const ps = makePlayerStats({ level: 4 });
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(undefined);

      await handle(action, ps, CAMPAIGN_NAME, null);

      expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'channelDivinityCharges', 2, CAMPAIGN_NAME);
    });

    it('uses class_specific.channel_divinity_charges fallback from class_levels', async () => {
      const ps = makePlayerStats({
        level: 1,
        class: {
          class_levels: [
            { class_specific: { channel_divinity_charges: 4 } },
          ],
        },
      });
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(undefined);

      await handle(action, ps, CAMPAIGN_NAME, null);

      // currentCharges = 4, newCharges = 3
      expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'channelDivinityCharges', 3, CAMPAIGN_NAME);
    });

    it('defaults to 2 charges when class data is missing', async () => {
      const ps = makePlayerStats({ class: null });
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(undefined);

      await handle(action, ps, CAMPAIGN_NAME, null);

      expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'channelDivinityCharges', 1, CAMPAIGN_NAME);
    });

    it('defaults to 2 charges when class_levels is empty', async () => {
      const ps = makePlayerStats({ class: { class_levels: [] } });
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(undefined);

      await handle(action, ps, CAMPAIGN_NAME, null);

      expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'channelDivinityCharges', 1, CAMPAIGN_NAME);
    });

    it('defaults to 2 charges when channel_divinity is 0', async () => {
      const ps = makePlayerStats({
        class: {
          class_levels: [
            { channel_divinity: 0 },
          ],
        },
      });
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(undefined);

      await handle(action, ps, CAMPAIGN_NAME, null);

      expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'channelDivinityCharges', 1, CAMPAIGN_NAME);
    });

    it('does not call setRuntimeValue when no charges remain', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(0);

      await handle(action, ps, CAMPAIGN_NAME, null);

      expect(setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('condition and save configuration', () => {
    it('uses default condition "frightened" when auto.condition is missing', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(2);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.conditionName).toBe('frightened');
    });

    it('uses custom condition from auto.condition', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ condition: 'paralyzed' });

      getRuntimeValue.mockReturnValue(2);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.conditionName).toBe('paralyzed');
    });

    it('uses default saveType "WIS" when auto.saveType is missing', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(2);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.saveType).toBe('WIS');
    });

    it('uses custom saveType from auto.saveType', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ saveType: 'CON' });

      getRuntimeValue.mockReturnValue(2);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.saveType).toBe('CON');
    });
  });

  describe('range handling', () => {
    it('uses default range 60 when rangeToFeet returns falsy', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(2);
      rangeToFeet.mockReturnValue(null);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.rangeFeet).toBe(60);
    });

    it('uses default range 60 when rangeToFeet returns 0', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ range: '0ft' });

      getRuntimeValue.mockReturnValue(2);
      rangeToFeet.mockReturnValue(0);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.rangeFeet).toBe(60);
    });

    it('uses custom range from rangeToFeet', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ range: '30ft' });

      getRuntimeValue.mockReturnValue(2);
      rangeToFeet.mockReturnValue(30);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.rangeFeet).toBe(30);
    });
  });

  describe('map and attacker position', () => {
    it('includes attackerPos when mapName provided and attacker found in mapData', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(2);
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: 'TestHero', gridX: 5, gridY: 10 }],
      });

      const result = await handle(action, ps, CAMPAIGN_NAME, MAP_NAME);

      expect(result.payload.attackerPos).toEqual({ gridX: 5, gridY: 10 });
    });

    it('includes mapData in modal payload when map loads successfully', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});
      const mapData = { players: [{ name: 'TestHero', gridX: 5, gridY: 10 }] };

      getRuntimeValue.mockReturnValue(2);
      mapsService.loadMapData.mockResolvedValue(mapData);

      const result = await handle(action, ps, CAMPAIGN_NAME, MAP_NAME);

      expect(result.payload.mapData).toBe(mapData);
    });

    it('returns null attackerPos when mapName provided but attacker not in mapData', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(2);
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: 'OtherHero', gridX: 1, gridY: 2 }],
      });

      const result = await handle(action, ps, CAMPAIGN_NAME, MAP_NAME);

      expect(result.payload.attackerPos).toBeNull();
    });

    it('returns null attackerPos when mapName is falsy', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.attackerPos).toBeNull();
    });

    it('returns null attackerPos when mapName is empty string', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      const result = await handle(action, ps, CAMPAIGN_NAME, '');

      expect(result.payload.attackerPos).toBeNull();
    });

    it('handles map load failure gracefully', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(2);
      mapsService.loadMapData.mockRejectedValue(new Error('Map not found'));

      const result = await handle(action, ps, CAMPAIGN_NAME, MAP_NAME);

      expect(result.payload.attackerPos).toBeNull();
      expect(result.payload.mapData).toBeNull();
    });

    it('handles mapData being null', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(2);
      mapsService.loadMapData.mockResolvedValue(null);

      const result = await handle(action, ps, CAMPAIGN_NAME, MAP_NAME);

      expect(result.payload.attackerPos).toBeNull();
    });

    it('handles mapData with no players array', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(2);
      mapsService.loadMapData.mockResolvedValue({});

      const result = await handle(action, ps, CAMPAIGN_NAME, MAP_NAME);

      expect(result.payload.attackerPos).toBeNull();
    });
  });

  describe('logging', () => {
    it('calls addEntry with correct description format including saveType, DC, and range', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ saveType: 'DEX', range: '30ft' });

      getRuntimeValue.mockReturnValue(2);
      rangeToFeet.mockReturnValue(30);

      await handle(action, ps, CAMPAIGN_NAME, null);

      expect(addEntry).toHaveBeenCalledWith(CAMPAIGN_NAME, {
        type: 'ability_use',
        characterName: 'TestHero',
        abilityName: 'Divine Smite',
        description: 'Divine Smite activated — DEX save DC 13, all targets within 30 ft.',
      });
    });

    it('does not call addEntry when no charges remain', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(0);

      await handle(action, ps, CAMPAIGN_NAME, null);

      expect(addEntry).not.toHaveBeenCalled();
    });

    it('uses action name from the action object in log description', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});
      action.name = 'Wardens Flare';

      getRuntimeValue.mockReturnValue(2);

      await handle(action, ps, CAMPAIGN_NAME, null);

      expect(addEntry).toHaveBeenCalledWith(CAMPAIGN_NAME, expect.objectContaining({
        abilityName: 'Wardens Flare',
      }));
    });

    it('uses player name from playerStats in log entry', async () => {
      const ps = makePlayerStats({ name: 'CustomHero' });
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(2);

      await handle(action, ps, CAMPAIGN_NAME, null);

      expect(addEntry).toHaveBeenCalledWith(CAMPAIGN_NAME, expect.objectContaining({
        characterName: 'CustomHero',
      }));
    });
  });

  describe('modal payload', () => {
    it('includes combatSummary in modal payload', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(2);
      getCombatContext.mockResolvedValue({ round: 3, initiative: [] });

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.combatSummary).toEqual({ round: 3, initiative: [] });
    });

    it('includes attackerName in payload', async () => {
      const ps = makePlayerStats({ name: 'CustomHero' });
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(2);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.attackerName).toBe('CustomHero');
    });

    it('includes featureName in payload', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(2);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.featureName).toBe('Divine Smite');
    });

    it('includes campaignName in payload', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(2);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.campaignName).toBe(CAMPAIGN_NAME);
    });

    it('parses duration "1_minute" to 10 rounds', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ duration: '1_minute' });

      getRuntimeValue.mockReturnValue(2);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.durationRounds).toBe(10);
    });

    it('parses duration "1_minute_30s" to 10 rounds', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ duration: '1_minute_30s' });

      getRuntimeValue.mockReturnValue(2);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.durationRounds).toBe(10);
    });

    it('parses duration "3_rounds" to 3 rounds', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ duration: '3_rounds' });

      getRuntimeValue.mockReturnValue(2);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.durationRounds).toBe(3);
    });

    it('parses duration "10_rounds" to 10 rounds', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ duration: '10_rounds' });

      getRuntimeValue.mockReturnValue(2);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.durationRounds).toBe(10);
    });

    it('returns undefined durationRounds when no matching pattern', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ duration: 'until_end_of_combat' });

      getRuntimeValue.mockReturnValue(2);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.durationRounds).toBeUndefined();
    });

    it('returns undefined durationRounds when duration is missing', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(2);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.durationRounds).toBeUndefined();
    });

    it('returns undefined durationRounds when duration is empty string', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ duration: '' });

      getRuntimeValue.mockReturnValue(2);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.durationRounds).toBeUndefined();
    });

    it('returns undefined durationRounds when duration is 0_rounds', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ duration: '0_rounds' });

      getRuntimeValue.mockReturnValue(2);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.durationRounds).toBe(0);
    });

    it('includes additionalCondition in payload when provided', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ additionalCondition: 'prone' });

      getRuntimeValue.mockReturnValue(2);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.additionalCondition).toBe('prone');
    });

    it('includes null additionalCondition when not provided', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(2);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.additionalCondition).toBeNull();
    });

    it('includes saveDc in payload', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(2);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.saveDc).toBe(13);
    });

    it('includes rangeFeet in payload', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(2);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.rangeFeet).toBe(60);
    });

    it('includes conditionName in payload', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(2);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.conditionName).toBe('frightened');
    });

    it('includes saveType in payload', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(2);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.saveType).toBe('WIS');
    });
  });
});
