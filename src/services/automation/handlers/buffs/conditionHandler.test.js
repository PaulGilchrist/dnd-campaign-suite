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

vi.mock('../../../ui/dataLoader.js', () => ({
  loadMonsters: vi.fn().mockResolvedValue([]),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './conditionHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import * as mapsService from '../../../maps/mapsService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { getAbilityModifier } from '../../../shared/abilityLookup.js';
import * as dataLoader from '../../../ui/dataLoader.js';

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

// ── Tests ──────────────────────────────────────────────────────

describe('conditionHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReset();
    setRuntimeValue.mockReset().mockResolvedValue(undefined);
    getAbilityModifier.mockReset();
    getCombatContext.mockReset().mockResolvedValue({});
    rangeToFeet.mockReset();
    mapsService.loadMapData.mockReset();
    addEntry.mockReset().mockResolvedValue({});
    dataLoader.loadMonsters.mockReset().mockResolvedValue([]);
  });

  describe('buildSaveDc integration', () => {
    it('returns ability-based DC when saveDc === "ability"', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ saveDc: 'ability', saveAbility: 'STR' });

      getAbilityModifier.mockReturnValue(4);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.type).toBe('modal');
      expect(result.payload.saveDc).toBe(15);
      expect(getAbilityModifier).toHaveBeenCalledWith(ps.abilities, 'STR');
    });

    it('uses handler default WIS when saveAbility is absent', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ saveDc: 'ability' });

      getAbilityModifier.mockReturnValue(2);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.saveDc).toBe(13);
      expect(getAbilityModifier).toHaveBeenCalledWith(ps.abilities, 'WIS');
    });

    it('uses first element when saveAbility is an array', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ saveDc: 'ability', saveAbility: ['DEX', 'CON'] });

      getAbilityModifier.mockReturnValue(1);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.saveDc).toBe(12);
      expect(getAbilityModifier).toHaveBeenCalledWith(ps.abilities, 'DEX');
    });

    it('returns numeric saveDc directly without calling getAbilityModifier for saveDc', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ saveDc: 16 });

      getAbilityModifier.mockReturnValue(0);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.saveDc).toBe(16);
      expect(getAbilityModifier).toHaveBeenCalledWith(ps.abilities, 'CHA');
      expect(getAbilityModifier).not.toHaveBeenCalledWith(ps.abilities, 'WIS');
    });

    it('returns fallback DC when saveDc is falsy', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      getAbilityModifier.mockReturnValue(2);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.saveDc).toBe(13);
      expect(getAbilityModifier).toHaveBeenCalledWith(ps.abilities, 'WIS');
    });

    it('uses spell_save_dc from playerStats when saveDc === "spell_save_dc"', async () => {
      const ps = makePlayerStats({ spellAbilities: { saveDc: 15 } });
      const action = makeAction({ saveDc: 'spell_save_dc' });

      getAbilityModifier.mockReturnValue(0);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.saveDc).toBe(15);
      expect(getAbilityModifier).toHaveBeenCalledWith(ps.abilities, 'CHA');
      expect(getAbilityModifier).not.toHaveBeenCalledWith(ps.abilities, 'WIS');
    });

    it('CLA-238: Channel Divinity cost feature defaults DC ability to CHA', async () => {
      const ps = makePlayerStats({ proficiency: 6 });
      const action = makeAction({ saveType: 'STR', cost: '1 Channel Divinity' });

      getAbilityModifier.mockImplementation((abilities, ability) => (ability === 'CHA' ? 5 : -1));

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.saveDc).toBe(19);
      expect(getAbilityModifier).toHaveBeenCalledWith(ps.abilities, 'CHA');
      expect(getAbilityModifier).not.toHaveBeenCalledWith(ps.abilities, 'WIS');
    });

    it('CLA-238: resourceCost channel_divinity feature defaults DC ability to CHA', async () => {
      const ps = makePlayerStats({ proficiency: 6 });
      const action = makeAction({ saveType: 'STR', resourceCost: 'channel_divinity' });

      getAbilityModifier.mockImplementation((abilities, ability) => (ability === 'CHA' ? 5 : -1));

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.saveDc).toBe(19);
      expect(getAbilityModifier).toHaveBeenCalledWith(ps.abilities, 'CHA');
      expect(getAbilityModifier).not.toHaveBeenCalledWith(ps.abilities, 'WIS');
    });

    it('CLA-238: explicit saveAbility overrides CHA default for Channel Divinity features', async () => {
      const ps = makePlayerStats({ proficiency: 6 });
      const action = makeAction({ saveType: 'STR', cost: '1 Channel Divinity', saveAbility: 'CON' });

      getAbilityModifier.mockImplementation((abilities, ability) => (ability === 'CHA' ? 5 : 2));

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.saveDc).toBe(16);
    });

    it('CLA-238: non-Channel-Divinity feature without cost still defaults DC ability to WIS', async () => {
      const ps = makePlayerStats({ proficiency: 3 });
      const action = makeAction({ saveDc: 'ability', saveType: 'STR' });

      getAbilityModifier.mockImplementation((abilities, ability) => (ability === 'CHA' ? 5 : 2));

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.saveDc).toBe(13);
      expect(getAbilityModifier).toHaveBeenCalledWith(ps.abilities, 'WIS');
    });

    it('derives spell_save_dc from CHA when spellAbilities.saveDc is missing', async () => {
      const ps = makePlayerStats({ spellAbilities: {} });
      const action = makeAction({ saveDc: 'spell_save_dc' });

      getAbilityModifier.mockReturnValue(3);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.saveDc).toBe(14);
      expect(getAbilityModifier).toHaveBeenCalledWith(ps.abilities, 'CHA');
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

    it('returns popup with negative charges', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(-1);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
    });

    it('returns popup when stored charges are string "0"', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      getRuntimeValue.mockReturnValue('0');

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.type).toBe('popup');
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
      expect(result.payload.channelDivinityCharges).toBe(3);
    });

    it('uses channel_divinity_charges from class data when present', async () => {
      const ps = makePlayerStats({ level: 4 });
      const action = makeAction({});

      ps.class.class_levels[3] = { class_specific: { channel_divinity_charges: 5 } };

      getRuntimeValue.mockReturnValue(undefined);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.channelDivinityCharges).toBe(5);
    });

    it('uses default charge count when class data is missing', async () => {
      const ps = makePlayerStats({ class: null });
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(undefined);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

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

    it('uses zero as default range when rangeToFeet returns 0', async () => {
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
    it('includes attackerPos and mapData when mapName provided and attacker found', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(2);
      const mapData = { players: [{ name: 'TestHero', gridX: 5, gridY: 10 }] };
      mapsService.loadMapData.mockResolvedValue(mapData);

      const result = await handle(action, ps, CAMPAIGN_NAME, MAP_NAME);

      expect(result.payload.attackerPos).toEqual({ gridX: 5, gridY: 10 });
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

    it('skips map lookup when mapName is null', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(2);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(mapsService.loadMapData).not.toHaveBeenCalled();
      expect(result.payload.attackerPos).toBeNull();
    });
  });

  describe('logging', () => {
    it('calls addEntry with correct description format including saveType, DC, range, and maxTargets', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ saveType: 'DEX', range: '30ft' });

      getRuntimeValue.mockReturnValue(2);
      rangeToFeet.mockReturnValue(30);
      getAbilityModifier.mockReturnValue(2);

      await handle(action, ps, CAMPAIGN_NAME, null);

      expect(addEntry).toHaveBeenCalledWith(CAMPAIGN_NAME, {
        type: 'ability_use',
        characterName: 'TestHero',
        abilityName: 'Divine Smite',
        description: 'Divine Smite activated — DEX save DC 13, up to 2 targets within 30 ft.',
      });
    });

    it('does not call addEntry when no charges remain', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(0);

      await handle(action, ps, CAMPAIGN_NAME, null);

      expect(addEntry).not.toHaveBeenCalled();
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
      getAbilityModifier.mockReturnValue(2);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.saveDc).toBe(13);
      expect(result.payload.rangeFeet).toBe(60);
      expect(result.payload.conditionName).toBe('frightened');
      expect(result.payload.saveType).toBe('WIS');
    });

    it('includes monsters array from loadMonsters', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(2);
      const mockMonsters = [{ name: 'Goblin' }, { name: 'Skeleton' }];
      dataLoader.loadMonsters.mockResolvedValue(mockMonsters);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.monsters).toEqual(mockMonsters);
    });

    it('includes empty monsters array when loadMonsters fails', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(2);
      dataLoader.loadMonsters.mockRejectedValue(new Error('Data unavailable'));

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.monsters).toEqual([]);
    });
  });

  describe('maxTargets handling', () => {
    it('passes maxTargets based on CHA modifier', async () => {
      const ps = makePlayerStats({
        abilities: [
          { name: 'Charisma', bonus: 3 },
          { name: 'Wisdom', bonus: 2 },
        ],
      });
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(2);
      getAbilityModifier.mockReturnValue(3);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.maxTargets).toBe(3);
      expect(getAbilityModifier).toHaveBeenCalledWith(ps.abilities, 'CHA');
    });

    it('uses minimum 1 when CHA modifier is negative', async () => {
      const ps = makePlayerStats({
        abilities: [
          { name: 'Charisma', bonus: -1 },
          { name: 'Wisdom', bonus: 2 },
        ],
      });
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(2);
      getAbilityModifier.mockReturnValue(-1);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.maxTargets).toBe(1);
    });

    it('uses 1 when CHA modifier is 0', async () => {
      const ps = makePlayerStats({
        abilities: [
          { name: 'Charisma', bonus: 0 },
          { name: 'Wisdom', bonus: 2 },
        ],
      });
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(2);
      getAbilityModifier.mockReturnValue(0);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.maxTargets).toBe(1);
    });

    it('uses CHA modifier when positive', async () => {
      const ps = makePlayerStats({
        abilities: [
          { name: 'Charisma', bonus: 5 },
          { name: 'Wisdom', bonus: 2 },
        ],
      });
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(2);
      getAbilityModifier.mockReturnValue(5);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.maxTargets).toBe(5);
    });

    it('CLA-303: maxTargets "all" (Turn Undead RAW) opens the cap to Infinity', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Turn Undead',
        automation: {
          type: 'set_condition',
          saveType: 'WIS',
          saveAbility: 'WIS',
          resourceCost: 'channel_divinity',
          maxTargets: 'all',
        },
      };

      getRuntimeValue.mockReturnValue(2);
      getAbilityModifier.mockReturnValue(1);

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.maxTargets).toBe(Infinity);
      const logDesc = addEntry.mock.calls.find(c => String(c[1]?.description).includes('activated'))[1].description;
      expect(logDesc).toContain('up to all targets');
    });

    it('CLA-303: resourceCost channel_divinity gates set_condition features at 0 charges', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Turn Undead',
        automation: {
          type: 'set_condition',
          saveType: 'WIS',
          saveAbility: 'WIS',
          resourceCost: 'channel_divinity',
          maxTargets: 'all',
        },
      };

      getRuntimeValue.mockImplementation((name, key) => (key === 'channelDivinityCharges' ? 0 : null));

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('No Channel Divinity charges remaining.');
    });

    it('CLA-303: CD-gated feature with explicit saveAbility WIS builds WIS-based DC (not CHA)', async () => {
      const ps = makePlayerStats({ proficiency: 4 });
      const action = {
        name: 'Turn Undead',
        automation: {
          type: 'set_condition',
          saveType: 'WIS',
          saveAbility: 'WIS',
          resourceCost: 'channel_divinity',
          maxTargets: 'all',
        },
      };

      getRuntimeValue.mockImplementation((name, key) => (key === 'channelDivinityCharges' ? 2 : null));
      getAbilityModifier.mockImplementation((abilities, ability) => (ability === 'WIS' ? 5 : 0));

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.type).toBe('modal');
      expect(result.payload.saveDc).toBe(17);
      expect(result.payload.channelDivinityCharges).toBe(2);
    });
  });
});
