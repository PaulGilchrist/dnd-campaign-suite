// @maintained-by-ai
// Deterministic unit tests for the CLA-321 soulstitch spells handler (production-live:
// registered as soulstitch_spells in services/automation/index.js; applySoulstitchSelection
// called from SoulstitchSpellsModal.jsx). Fully mocked boundary deps; no timers.
// Stamp-key format is owned by useLoggedDiceRollUtils.core.test.js; stamp consumption by
// handleNpcSaveDamage tests — this file pins only the handler's own guard/payload/stamp-write contract.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../hooks/combat/loggedDiceRollUtils.js', () => ({
  soulstitchStampKey: (n) => `_${String(n).replace(/\s+/g, '_')}_Soulstitch_Spells_active`,
}));

import { handle, applySoulstitchSelection } from './soulstitchSpellsHandler.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as combatData from '../../../../services/encounters/combatData.js';
import * as logService from '../../../../services/ui/logService.js';

const campaignName = 'TestCampaign';
const STAMP_KEY = '_TestWizard_Soulstitch_Spells_active';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestWizard',
    level: 14,
    proficiency: 6,
    class: { class_levels: [{ level: 14 }] },
    ...overrides,
  };
}

function makeAction(automation = {}, spell = {}) {
  return {
    name: 'Soulstitch Spells',
    automation: { type: 'soulstitch', ...automation },
    spell,
  };
}

function makeEvocationAction(overrides = {}) {
  return makeAction(overrides, { school: 'Evocation', dc: 15 });
}

function stubCreatures(names) {
  combatData.getCombatSummary.mockReturnValue({ creatures: names.map(name => ({ name })) });
}

describe('soulstitchSpellsHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default combat context; guard tests override explicitly.
    stubCreatures(['Goblin1']);
  });

  describe('early return guards', () => {
    it('should return null when spell school is not Evocation', async () => {
      const action = makeAction({}, { school: 'Transmutation', dc: 15 });
      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result).toBeNull();
    });

    it('should return null when spell is missing entirely', async () => {
      const action = makeAction({}, undefined);
      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result).toBeNull();
    });

    it('should return null when spell has no save (missing dc, dc 0, and no auto.saveType)', async () => {
      const noDc = await handle(makeAction({}, { school: 'Evocation' }), makePlayerStats(), campaignName, null);
      const zeroDc = await handle(makeAction({}, { school: 'Evocation', dc: 0 }), makePlayerStats(), campaignName, null);

      expect(noDc).toBeNull();
      expect(zeroDc).toBeNull();
    });

    it('should return null when combat summary has no creatures', async () => {
      combatData.getCombatSummary.mockReturnValue({ creatures: null });

      const result = await handle(makeEvocationAction(), makePlayerStats(), campaignName, null);

      expect(result).toBeNull();
    });

    it('should return modal with empty eligibleTargets when combat summary creatures is empty array', async () => {
      combatData.getCombatSummary.mockReturnValue({ creatures: [] });

      const result = await handle(makeEvocationAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.payload.eligibleTargets).toEqual([]);
    });

    it('should proceed when spell has no dc but auto.saveType is present', async () => {
      const action = makeAction({ saveType: 'strength' }, { school: 'Evocation' });
      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('modal');
    });
  });

  describe('modal payload construction', () => {
    it('should return full modal payload with defaults, references, and combat context', async () => {
      const action = makeEvocationAction();
      const stats = makePlayerStats();

      const result = await handle(action, stats, campaignName, 'DungeonMap');

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('soulstitchSpells');
      expect(result.payload).toEqual({
        action,
        playerStats: stats,
        campaignName,
        mapName: 'DungeonMap',
        featureName: 'Soulstitch Spells',
        maxSelections: 2,
        eligibleTargets: ['Goblin1'],
        spellName: 'Unknown',
        spellSchool: 'evocation',
      });
      // payload carries the exact objects, not clones
      expect(result.payload.action).toBe(action);
      expect(result.payload.playerStats).toBe(stats);
    });

    it('should lowercase spellSchool in payload', async () => {
      const action = makeAction({}, { school: 'EVOCATION', dc: 15 });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.spellSchool).toBe('evocation');
    });

    it('should exclude the caster from eligible targets ("other creatures you can see")', async () => {
      stubCreatures(['Ally1', 'TestWizard', 'Enemy1']);

      const result = await handle(makeEvocationAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.eligibleTargets).toEqual(['Ally1', 'Enemy1']);
    });
  });

  describe('spell slot level and max selections', () => {
    it('should prefer action.spellSlotLevel over spell.level', async () => {
      const action = makeAction({}, { school: 'Evocation', dc: 15, level: 5 });
      action.spellSlotLevel = 2;

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.maxSelections).toBe(3);
    });

    it('should fall back to spell.level when action.spellSlotLevel is not set', async () => {
      const action = makeAction({}, { school: 'Evocation', dc: 15, level: 2 });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.maxSelections).toBe(3);
    });

    it('should default spell slot level to 1 yielding maxSelections of 2', async () => {
      const result = await handle(makeEvocationAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.maxSelections).toBe(2);
    });

    it('should default spell slot level to 1 when spell.level is 0', async () => {
      const action = makeAction({}, { school: 'Evocation', dc: 15, level: 0 });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.maxSelections).toBe(2);
    });
  });

  describe('field defaults', () => {
    it('should default featureName to "Soulstitch Spells" when action.name is missing', async () => {
      const action = {
        automation: { type: 'soulstitch' },
        spell: { school: 'Evocation', dc: 15 },
      };

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.featureName).toBe('Soulstitch Spells');
    });

    it('should use action.name as featureName when provided', async () => {
      const action = {
        name: 'Custom Feature',
        automation: { type: 'soulstitch' },
        spell: { school: 'Evocation', dc: 15 },
      };

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.featureName).toBe('Custom Feature');
    });

    it('should read spell from action.payload.spell when action.spell is missing', async () => {
      const action = {
        name: 'Soulstitch Spells',
        automation: { type: 'soulstitch' },
        payload: { spell: { school: 'Evocation', dc: 15, name: 'Lightning Bolt' } },
      };

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.spellName).toBe('Lightning Bolt');
    });

    it('should default spellName to "Unknown" when no spell name is available', async () => {
      const action = makeEvocationAction();
      action.spell.name = undefined;

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.spellName).toBe('Unknown');
    });
  });
});

describe('soulstitchSpellsHandler.applySoulstitchSelection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('empty selection handling', () => {
    it('should return info popup for empty, null, or undefined selection', async () => {
      const results = await Promise.all([
        applySoulstitchSelection(makeAction(), makePlayerStats(), campaignName, []),
        applySoulstitchSelection(makeAction(), makePlayerStats(), campaignName, null),
        applySoulstitchSelection(makeAction(), makePlayerStats(), campaignName, undefined),
      ]);

      results.forEach(result => {
        expect(result).toEqual({
          type: 'popup',
          payload: {
            type: 'automation_info',
            name: 'Soulstitch Spells',
            description: 'Soulstitch Spells: No creatures chosen.',
          },
        });
      });
    });

    it('should clear the stamp (decline = no protection this cast) and not log when no creatures selected', async () => {
      await applySoulstitchSelection(makeAction(), makePlayerStats(), campaignName, []);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledTimes(1);
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestWizard',
        STAMP_KEY,
        [],
        campaignName,
      );
      expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('should use custom featureName in empty selection popup', async () => {
      const customAction = {
        name: 'Custom Soulstitch',
        automation: { type: 'soulstitch' },
        spell: { school: 'Evocation', dc: 15 },
      };

      const result = await applySoulstitchSelection(customAction, makePlayerStats(), campaignName, []);

      expect(result.payload).toEqual({
        type: 'automation_info',
        name: 'Custom Soulstitch',
        description: 'Custom Soulstitch: No creatures chosen.',
      });
    });
  });

  describe('successful selection', () => {
    it('should store selected creatures under the persistent active key only (no cast-timestamp key)', async () => {
      const selectedNames = ['Goblin1'];

      await applySoulstitchSelection(makeAction(), makePlayerStats(), campaignName, selectedNames);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledTimes(1);
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestWizard',
        STAMP_KEY,
        selectedNames,
        campaignName,
      );
    });

    it('should log ability_use entry with full character, ability, and selection details', async () => {
      const selectedNames = ['Goblin1', 'Goblin2', 'Goblin3'];

      await applySoulstitchSelection(makeAction(), makePlayerStats(), campaignName, selectedNames);

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestWizard',
        abilityName: 'Soulstitch Spells',
        description: 'Soulstitch Spells: 3 creature(s) chosen for automatic save success: Goblin1, Goblin2, Goblin3',
      });
    });

    it('should return success popup with full pinned composition', async () => {
      const selectedNames = ['Goblin1', 'Goblin2'];

      const result = await applySoulstitchSelection(makeAction(), makePlayerStats(), campaignName, selectedNames);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Soulstitch Spells',
          description: 'Soulstitch Spells: Goblin1, Goblin2 automatically succeed on saves and take no damage.',
          automation: { type: 'soulstitch' },
        },
      });
    });

    it('should use custom featureName from action.name in popup', async () => {
      const customAction = {
        name: 'Custom Soulstitch',
        automation: { type: 'soulstitch' },
        spell: { school: 'Evocation', dc: 15 },
      };

      const result = await applySoulstitchSelection(customAction, makePlayerStats(), campaignName, ['Goblin1']);

      expect(result.payload).toEqual({
        type: 'automation_info',
        name: 'Custom Soulstitch',
        description: 'Custom Soulstitch: Goblin1 automatically succeed on saves and take no damage.',
        automation: { type: 'soulstitch' },
      });
    });
  });
});
