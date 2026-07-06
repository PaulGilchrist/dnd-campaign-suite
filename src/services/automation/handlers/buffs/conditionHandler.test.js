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
    it('returns ability-based DC when saveDc === "ability"', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ saveDc: 'ability', saveAbility: 'STR' });

      getAbilityModifier.mockReturnValue(4);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.type).toBe('modal');
      expect(result.payload.saveDc).toBe(15);
      expect(getAbilityModifier).toHaveBeenCalledWith(ps.abilities, 'STR');
    });

    it('defaults to WIS when saveAbility is absent', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ saveDc: 'ability' });

      getAbilityModifier.mockReturnValue(2);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.saveDc).toBe(13);
      expect(getAbilityModifier).toHaveBeenCalledWith(ps.abilities, 'WIS');
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
  });

  describe('charge handling', () => {
    it('returns popup with no charges (0)', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(0);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe('No Channel Divinity charges remaining.');
      expect(result.payload.name).toBe('Divine Smite');
      expect(result.payload.automationType).toBe('channel_divinity');
    });

    it('returns modal with charges > 0', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(3);
      getCombatContext.mockResolvedValue({ combatLog: [] });

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('setCondition');
    });

    it('falls back to class data when stored charges are undefined', async () => {
      const ps = makePlayerStats({ level: 4 });
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(undefined);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.type).toBe('modal');
    });

    it('defaults to 2 charges when class data is missing', async () => {
      const ps = makePlayerStats({ class: null });
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(undefined);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.type).toBe('modal');
      expect(result.payload.channelDivinityCharges).toBe(2);
    });
  });

  describe('configuration defaults', () => {
    it('uses defaults when auto fields are missing', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(2);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.conditionName).toBe('frightened');
      expect(result.payload.saveType).toBe('WIS');
    });

    it('uses custom condition and saveType from auto', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ condition: 'paralyzed', saveType: 'CON' });

      getRuntimeValue.mockReturnValue(2);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.conditionName).toBe('paralyzed');
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
    it('includes attackerPos and mapData when mapName provided and attacker found', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(2);
      const mapData = { players: [{ name: 'TestHero', gridX: 5, gridY: 10 }] };
      mapsService.loadMapData.mockResolvedValue(mapData);

      const result = await handle(action, ps, CAMPAIGN_NAME, MAP_NAME);

      expect(result.payload.attackerPos).toEqual({ gridX: 5, gridY: 10 });
      expect(result.payload.mapData).toBe(mapData);
    });

    it('returns null attackerPos when mapName is falsy', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.attackerPos).toBeNull();
    });

    it('returns null attackerPos when attacker not in mapData', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(2);
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: 'OtherHero', gridX: 1, gridY: 2 }],
      });

      const result = await handle(action, ps, CAMPAIGN_NAME, MAP_NAME);

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

    it('uses action name and player name from objects in log description', async () => {
      const ps = makePlayerStats({ name: 'CustomHero' });
      const action = makeAction({});
      action.name = 'Wardens Flare';

      getRuntimeValue.mockReturnValue(2);

      await handle(action, ps, CAMPAIGN_NAME, null);

      expect(addEntry).toHaveBeenCalledWith(CAMPAIGN_NAME, expect.objectContaining({
        abilityName: 'Wardens Flare',
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

    it('includes attackerName, featureName, and campaignName in payload', async () => {
      const ps = makePlayerStats({ name: 'CustomHero' });
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(2);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.attackerName).toBe('CustomHero');
      expect(result.payload.featureName).toBe('Divine Smite');
      expect(result.payload.campaignName).toBe(CAMPAIGN_NAME);
    });

    it('parses duration strings to rounds', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(2);

      const result1 = await handle({ ...action, automation: { ...action.automation, duration: '1_minute' } }, ps, CAMPAIGN_NAME, null);
      expect(result1.payload.durationRounds).toBe(10);

      const result2 = await handle({ ...action, automation: { ...action.automation, duration: '1_minute_30s' } }, ps, CAMPAIGN_NAME, null);
      expect(result2.payload.durationRounds).toBe(10);

      const result3 = await handle({ ...action, automation: { ...action.automation, duration: '3_rounds' } }, ps, CAMPAIGN_NAME, null);
      expect(result3.payload.durationRounds).toBe(3);

      const result4 = await handle({ ...action, automation: { ...action.automation, duration: '0_rounds' } }, ps, CAMPAIGN_NAME, null);
      expect(result4.payload.durationRounds).toBe(0);
    });

    it('returns undefined durationRounds when no matching pattern', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ duration: 'until_end_of_combat' });

      getRuntimeValue.mockReturnValue(2);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.durationRounds).toBeUndefined();
    });

    it('includes additionalCondition in payload when provided', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ additionalCondition: 'prone' });

      getRuntimeValue.mockReturnValue(2);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.additionalCondition).toBe('prone');
    });

    it('includes saveDc, rangeFeet, conditionName, and saveType in payload', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(2);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.saveDc).toBe(13);
      expect(result.payload.rangeFeet).toBe(60);
      expect(result.payload.conditionName).toBe('frightened');
      expect(result.payload.saveType).toBe('WIS');
    });
  });
});
