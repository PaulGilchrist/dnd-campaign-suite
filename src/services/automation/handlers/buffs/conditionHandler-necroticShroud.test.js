// @maintained-by-ai
// CLA-239: Necrotic Shroud regression — CHA DC ability + non-CD features skip Channel Divinity gate.
// Unit-side contract of conditionHandler.handle for the automation shape dispatched by
// celestialRevelationHandler (its dispatcher-side half lives in celestialRevelationHandler.test.js,
// which mocks this handler). Fully mocked and deterministic: stable behaviour, no app churn expected.
// Generic channelHandler coverage (defaults, ranges, map/pos, popup formats, CLA-303 gates) lives in
// conditionHandler.test.js and is intentionally not repeated here.
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
    it('builds DC from explicit saveAbility CHA and logs it (DC 16 = 8 + 3 + 5, never WIS)', async () => {
      const result = await handle(makeNecroticShroudAction(), makePlayerStats(), CAMPAIGN_NAME, null);

      expect(result.type).toBe('modal');
      expect(result.payload.saveDc).toBe(16);
      expect(getAbilityModifier).toHaveBeenCalledWith(expect.anything(), 'CHA');
      expect(getAbilityModifier).not.toHaveBeenCalledWith(expect.anything(), 'WIS');
      expect(addEntry).toHaveBeenCalledWith(CAMPAIGN_NAME, expect.objectContaining({
        type: 'ability_use',
        abilityName: 'Necrotic Shroud',
      }));
      expect(addEntry.mock.calls.at(-1)[1].description).toContain('CHA save DC 16');
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

    it('channel_divinity typed feature remains gated at 0 charges and carries live charges otherwise', async () => {
      const action = {
        name: 'Abjure Foes',
        automation: { type: 'channel_divinity', saveDc: 'ability', saveType: 'WIS' },
      };

      getRuntimeValue.mockImplementation((_name, key) => (key === 'channelDivinityCharges' ? 0 : null));
      const blocked = await handle(action, makePlayerStats(), CAMPAIGN_NAME, null);
      expect(blocked.type).toBe('popup');
      expect(blocked.payload.description).toBe('No Channel Divinity charges remaining.');

      getRuntimeValue.mockImplementation((_name, key) => (key === 'channelDivinityCharges' ? 3 : null));
      const allowed = await handle(action, makePlayerStats(), CAMPAIGN_NAME, null);
      expect(allowed.type).toBe('modal');
      expect(allowed.payload.channelDivinityCharges).toBe(3);
    });
  });
});
