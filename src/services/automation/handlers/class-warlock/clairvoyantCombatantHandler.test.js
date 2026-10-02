// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../common/savePrompt.js', async (importActual) => {
  const actual = await importActual();
  return {
    ...actual,
    createSaveListener: vi.fn(),
  };
});
// CLA-053: real buildSaveDc via importActual — the handler now routes the
// data token saveDc:'ability' through it (the old local resolver returned
// the STRING 'ability', making every save compare always-fail).

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

  describe('early return: no uses remaining', () => {
    it('should return info popup when no uses remaining without pact magic recharge', async () => {
      mockRuntimeValues(1, 'AwakenedTarget');

      const result = await handle(makeAction({ pactMagicRecharge: false }), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Clairvoyant Combatant');
      expect(result.payload.description).toContain('No uses remaining');
      expect(result.payload.description).toContain('Short or Long Rest');
    });

    it('should return info popup when no uses remaining with pact magic recharge but no slots', async () => {
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
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Clairvoyant Combatant');
      expect(result.payload.description).toContain('No Pact Magic slots available');
    });
  });

  describe('modal return', () => {
    it('should return modal with correct payload for normal use', async () => {
      mockRuntimeValues(0, 'AwakenedTarget');

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('clairvoyantCombatant');
      expect(result.payload.targetName).toBe('AwakenedTarget');
      expect(result.payload.saveType).toBe('WIS');
      expect(result.payload.saveDc).toBe(15);
      expect(result.payload.currentUses).toBe(0);
      expect(result.payload.maxUses).toBe(1);
      expect(result.payload.pactMagicRecharge).toBe(false);
      expect(result.payload.pactSlotLevel).toBe(1);
      expect(result.payload.pactSlotsAvailable).toBe(false);
    });

    it('should find highest pact magic slot level when recharge is available', async () => {
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

      expect(result.payload.pactSlotLevel).toBe(3);
      expect(result.payload.pactSlotsAvailable).toBe(true);
    });

    it('should use custom feature name in modal action', async () => {
      mockRuntimeValues(0, 'AwakenedTarget');

      const result = await handle(
        { name: 'My Clairvoyance', automation: { type: 'clairvoyant_combatant', saveType: 'WIS', saveDc: 15, uses: 1 } },
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('clairvoyantCombatant');
      expect(result.payload.action.name).toBe('My Clairvoyance');
    });
  });

  describe('save DC computation (CLA-053: routed through buildSaveDc)', () => {
    it('should use numeric saveDc passthrough when provided', async () => {
      mockRuntimeValues(0, 'AwakenedTarget');

      const result = await handle(
        { automation: { type: 'clairvoyant_combatant', saveDc: 18 } },
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.payload.saveDc).toBe(18);
    });

    it('should return a NUMBER, never the string "ability", for saveDc:"ability" + saveAbility:"CHA"', async () => {
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

    it('should compute DC 16 on the lv14 HexWarlock byte-shape host', async () => {
      mockRuntimeValues(0, 'Bandit 1');

      const result = await handle(
        { automation: { type: 'clairvoyant_combatant', saveType: 'WIS', saveDc: 'ability', saveAbility: 'CHA', duration: '1_minute', pactMagicRecharge: true, uses: 1 } },
        makePlayerStats({ level: 14, proficiency: 5, abilities: [{ name: 'Charisma', bonus: 3 }] }),
        campaignName,
        null,
      );

      expect(result.payload.saveDc).toBe(16); // 8 + PB 5 + CHA 3
    });

    it('should fallback to WIS saveType when auto.saveType is not provided', async () => {
      mockRuntimeValues(0, 'AwakenedTarget');

      const result = await handle(
        { automation: { type: 'clairvoyant_combatant', saveDc: 14 } },
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.payload.saveType).toBe('WIS');
    });

    it('should default to CON ability when saveDc:"ability" omits saveAbility', async () => {
      mockRuntimeValues(0, 'AwakenedTarget');

      const result = await handle(
        { automation: { type: 'clairvoyant_combatant', saveType: 'WIS', saveDc: 'ability' } },
        makePlayerStats({ abilities: [{ name: 'Charisma', bonus: 3 }, { name: 'Constitution', bonus: 2 }] }),
        campaignName,
        null,
      );

      expect(result.payload.saveDc).toBe(8 + 2 + 4); // CON default per buildSaveDc
    });
  });
});
