// @maintained-by-ai — deterministic unit tests for clairvoyantCombatantHandler.handle()'s
// own contract: uses/pact-recharge gating, popup composition (exact strings), modal payload
// shape, and the CLA-053 delegation of saveDc through buildSaveDc. buildSaveDc's internal
// arithmetic (numeric passthrough, 'ability' math, CON default) is owned by
// ../../common/savePrompt.test.js; findPactSlotLevel/hasPactSlotAvailable seam coverage lives
// in the pact-slot test below (no dedicated pactMagicUtils file). Pure behaviour behind mock
// boundaries; turn-based only, no timers, no network.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

import { handle } from './clairvoyantCombatantHandler.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

const campaignName = 'test-campaign';
const playerName = 'TestWarlock';

function makePlayerStats(overrides = {}) {
  return {
    name: playerName,
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Charisma', bonus: 3 }],
    spellAbilities: {
      spell_slots_level_1: 2,
      spell_slots_level_2: 0,
      spell_slots_level_3: 0,
      spell_slots_level_4: 0,
      spell_slots_level_5: 0,
    },
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Clairvoyant Combatant',
    automation: { type: 'clairvoyant_combatant', saveType: 'WIS', saveDc: 15, uses: 1, ...automation },
  };
}

function mockRuntimeValues(uses, target) {
  getRuntimeValue.mockImplementation((playerName, key) => {
    if (key === 'clairvoyantCombatantUses') return uses;
    if (key === 'awakenedMindTarget') return target;
    return null;
  });
}

describe('clairvoyantCombatantHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('early return: cannot use', () => {
    it('returns info popup with exact reason when uses are exhausted and no pactMagicRecharge', async () => {
      mockRuntimeValues(1, 'AwakenedTarget');

      const result = await handle(makeAction({ pactMagicRecharge: false }), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Clairvoyant Combatant');
      expect(result.payload.description).toBe(
        'Clairvoyant Combatant: No uses remaining. Recharges on a Short or Long Rest.'
      );
    });

    it('returns pact-magic recharge variant of the reason when uses are exhausted but no slots are available', async () => {
      getRuntimeValue.mockImplementation((playerName, key) => {
        if (key === 'clairvoyantCombatantUses') return 1;
        if (key === 'awakenedMindTarget') return 'AwakenedTarget';
        if (key === 'spell_slots_level_1') return 0;
        return null;
      });

      const result = await handle(
        makeAction({ pactMagicRecharge: true }),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.name).toBe('Clairvoyant Combatant');
      expect(result.payload.description).toBe(
        'Clairvoyant Combatant: No uses remaining. Recharges on a Short or Long Rest, or expend a Pact Magic spell slot to restore a use. No Pact Magic slots available.'
      );
    });

    it('returns info popup requesting Awakened Mind bond when no awakenedMindTarget is stored', async () => {
      mockRuntimeValues(0, null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe(
        'Clairvoyant Combatant requires an active Awakened Mind bond. Activate Awakened Mind first to form a telepathic bond with a creature.'
      );
    });

    it('composes the custom feature name into the popup reason', async () => {
      mockRuntimeValues(1, null);

      const result = await handle(
        { name: 'My Clairvoyance', automation: { type: 'clairvoyant_combatant', saveType: 'WIS', saveDc: 15, uses: 1 } },
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.name).toBe('My Clairvoyance');
      expect(result.payload.description).toBe(
        'My Clairvoyance: No uses remaining. Recharges on a Short or Long Rest.'
      );
    });
  });

  describe('modal return', () => {
    it('returns modal with exact payload for normal use', async () => {
      mockRuntimeValues(0, 'AwakenedTarget');

      const action = makeAction();
      const playerStats = makePlayerStats();
      const result = await handle(action, playerStats, campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('clairvoyantCombatant');
      expect(result.payload.action).toBe(action);
      expect(result.payload.playerStats).toBe(playerStats);
      expect(result.payload.campaignName).toBe(campaignName);
      expect(result.payload.targetName).toBe('AwakenedTarget');
      expect(result.payload.saveType).toBe('WIS');
      expect(result.payload.saveDc).toBe(15);
      expect(result.payload.currentUses).toBe(0);
      expect(result.payload.maxUses).toBe(1);
      expect(result.payload.pactMagicRecharge).toBe(false);
      expect(result.payload.pactSlotLevel).toBe(1);
      expect(result.payload.pactSlotsAvailable).toBe(false);
    });

    it('finds highest pact magic slot level and reports recharge availability when uses are exhausted', async () => {
      mockRuntimeValues(1, 'AwakenedTarget');

      const result = await handle(
        makeAction({ pactMagicRecharge: true }),
        makePlayerStats({
          spellAbilities: {
            spell_slots_level_1: 0,
            spell_slots_level_2: 0,
            spell_slots_level_3: 2,
            spell_slots_level_4: 0,
            spell_slots_level_5: 0,
          },
        }),
        campaignName,
        null,
      );

      expect(result.type).toBe('modal');
      expect(result.payload.pactSlotLevel).toBe(3);
      expect(result.payload.pactSlotsAvailable).toBe(true);
    });

    it('falls back to WIS saveType when auto.saveType is not provided', async () => {
      mockRuntimeValues(0, 'AwakenedTarget');

      const result = await handle(
        { automation: { type: 'clairvoyant_combatant', saveDc: 14 } },
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.payload.saveType).toBe('WIS');
    });
  });

  describe('save DC delegation (CLA-053)', () => {
    it('routes the shipped saveDc:"ability" + saveAbility:"CHA" token through buildSaveDc and returns a NUMBER, never the string "ability"', async () => {
      mockRuntimeValues(0, 'AwakenedTarget');

      // The shipped Great Old One lv6 row shape (2024/classes.json).
      const result = await handle(
        { automation: { type: 'clairvoyant_combatant', saveType: 'WIS', saveDc: 'ability', saveAbility: 'CHA', duration: '1_minute', pactMagicRecharge: true, uses: 1 } },
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(typeof result.payload.saveDc).toBe('number');
      expect(result.payload.saveDc).toBe(8 + 3 + 4); // 8 + CHA(3) + proficiency(4)
    });
  });
});
