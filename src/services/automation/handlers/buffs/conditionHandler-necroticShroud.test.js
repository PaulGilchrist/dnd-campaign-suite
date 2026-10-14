// CLA-239: Necrotic Shroud regression — CHA DC ability + non-CD features skip Channel Divinity gate
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
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { getAbilityModifier } from '../../../shared/abilityLookup.js';
import * as dataLoader from '../../../ui/dataLoader.js';

// ── Constants ──────────────────────────────────────────────────

const CAMPAIGN_NAME = 'TestCampaign';

// ── Helpers ────────────────────────────────────────────────────

function makePlayerStats(overrides = {}) {
  return {
    name: 'AasimarTest',
    level: 14,
    proficiency: 5,
    abilities: [
      { name: 'Charisma', bonus: 3 },
      { name: 'Wisdom', bonus: 1 },
    ],
    class: {
      class_levels: new Array(14).fill({}),
    },
    ...overrides,
  };
}

// Automation exactly as celestialRevelationHandler dispatches Necrotic Shroud.
function makeNecroticShroudAction() {
  return {
    name: 'Necrotic Shroud',
    automation: {
      type: 'set_condition',
      saveType: 'CHA',
      saveAbility: 'CHA',
      saveDc: 'ability',
      condition: 'frightened',
      range: '10 ft',
      duration: 'until_end_of_next_turn',
      casting_time: '1 bonus action',
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('conditionHandler CLA-239 Necrotic Shroud', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReset();
    getAbilityModifier.mockReset();
    getCombatContext.mockReset().mockResolvedValue({});
    rangeToFeet.mockReset();
    addEntry.mockReset().mockResolvedValue({});
    dataLoader.loadMonsters.mockReset().mockResolvedValue([]);
    getAbilityModifier.mockImplementation((abilities, ability) => (ability === 'CHA' ? 3 : 1));
    getRuntimeValue.mockReturnValue(null);
  });

  describe('save DC ability', () => {
    it('builds DC from CHA when explicit saveAbility CHA is passed (DC 16 = 8 + 3 + 5)', async () => {
      const result = await handle(makeNecroticShroudAction(), makePlayerStats(), CAMPAIGN_NAME, null);

      expect(result.type).toBe('modal');
      expect(result.payload.saveDc).toBe(16);
      expect(getAbilityModifier).toHaveBeenCalledWith(expect.anything(), 'CHA');
      expect(getAbilityModifier).not.toHaveBeenCalledWith(expect.anything(), 'WIS');
    });

    it('log line reports CHA save with the CHA-based DC', async () => {
      await handle(makeNecroticShroudAction(), makePlayerStats(), CAMPAIGN_NAME, null);

      expect(addEntry).toHaveBeenCalledWith(CAMPAIGN_NAME, expect.objectContaining({
        type: 'ability_use',
        characterName: 'AasimarTest',
        abilityName: 'Necrotic Shroud',
      }));
      const description = addEntry.mock.calls.at(-1)[1].description;
      expect(description).toContain('CHA save DC 16');
    });

    it('parses until_end_of_next_turn duration to durationRounds 2', async () => {
      const result = await handle(makeNecroticShroudAction(), makePlayerStats(), CAMPAIGN_NAME, null);

      expect(result.payload.durationRounds).toBe(2);
      expect(result.payload.conditionName).toBe('frightened');
      expect(result.payload.saveType).toBe('CHA');
    });
  });

  describe('Channel Divinity gate', () => {
    it('non-CD set_condition feature skips the CD charge gate with stale 0 charges', async () => {
      getRuntimeValue.mockImplementation((_name, key) => (key === 'channelDivinityCharges' ? 0 : null));

      const result = await handle(makeNecroticShroudAction(), makePlayerStats(), CAMPAIGN_NAME, null);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('setCondition');
    });

    it('non-CD feature payload does not leak channelDivinityCharges for consumption', async () => {
      getRuntimeValue.mockImplementation((_name, key) => (key === 'channelDivinityCharges' ? 2 : null));

      const result = await handle(makeNecroticShroudAction(), makePlayerStats(), CAMPAIGN_NAME, null);

      expect(result.payload.channelDivinityCharges).toBeNull();
    });

    it('channel_divinity typed feature is still gated when charges are 0', async () => {
      getRuntimeValue.mockImplementation((_name, key) => (key === 'channelDivinityCharges' ? 0 : null));

      const action = {
        name: 'Abjure Foes',
        automation: { type: 'channel_divinity', saveDc: 'ability', saveType: 'WIS' },
      };

      const result = await handle(action, makePlayerStats(), CAMPAIGN_NAME, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('No Channel Divinity charges remaining.');
    });

    it('channel_divinity feature payload still carries channelDivinityCharges', async () => {
      getRuntimeValue.mockImplementation((_name, key) => (key === 'channelDivinityCharges' ? 3 : null));

      const action = {
        name: 'Abjure Foes',
        automation: { type: 'channel_divinity', saveDc: 'ability', saveType: 'WIS' },
      };

      const result = await handle(action, makePlayerStats(), CAMPAIGN_NAME, null);

      expect(result.type).toBe('modal');
      expect(result.payload.channelDivinityCharges).toBe(3);
    });

    it('resourceCost channel_divinity feature is gated even with set_condition type', async () => {
      getRuntimeValue.mockImplementation((_name, key) => (key === 'channelDivinityCharges' ? 0 : null));

      const action = {
        name: 'Turn the Undead',
        automation: { type: 'set_condition', resourceCost: 'channel_divinity', saveDc: 'ability' },
      };

      const result = await handle(action, makePlayerStats(), CAMPAIGN_NAME, null);

      expect(result.type).toBe('popup');
    });
  });
});
