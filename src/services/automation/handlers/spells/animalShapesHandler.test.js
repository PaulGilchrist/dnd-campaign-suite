// @maintained-by-ai
//
// LANE: animalShapesHandler.js ONLY — the automation dispatch entry for automation.type
// 'animal_shapes' (registered in services/automation/index.js as handleAnimalShapes).
// This lane owns the handler's three branches: no-combat-context guard, already-transformed
// guard (campaign targetEffects scan + log), and the animal_shapes_target_selection popup
// composition. All deps mocked; deterministic popup-payload contracts.
//
// TRIO MAP (verified against imports — no overlap):
// - animalShapesService.test.js (#1860): animalShapesService.js mutation lane —
//   applyAnimalShapes/confirmAnimalShapesTransform/revertAnimalShapes THP & polymorphOriginal
//   writes, targetEffects/pendingExpirations storage. Near-name sibling test
//   "should handle existing animal_shapes effects during confirm transform" is the SERVICE's
//   te-merge behaviour, NOT this handler's read-only already-transformed guard — distinct.
// - animalShapesSpellData.test.js (#1861): spells.json/2024 spells.json automation.type data
//   pin. This lane builds its action inline, never reads JSON — distinct.
// Consumers (different seams, not dupes): useSpellMetamagicFlow*.test.js fabricate the
// animal_shapes_target_selection payload in the hook; targetEffectDefinitions.test.js owns
// targetEffects registry internals (this handler writes no te — read-only scan only).

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

import { handle } from './animalShapesHandler.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { addEntry } from '../../../ui/logService.js';

const campaignName = 'TestCampaign';
const casterName = 'TestCaster';

function makePlayerStats(overrides = {}) {
  return {
    name: casterName,
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Charisma', bonus: 3 }],
    spellAbilities: { saveDc: 15 },
    ...overrides,
  };
}

function makeAction(overrides = {}) {
  return {
    name: 'Animal Shapes',
    automation: { type: 'animal_shapes', saveType: 'WIS', saveDc: 15 },
    spell: { name: 'Animal Shapes', level: 8 },
    spellSlotLevel: 8,
    metaCtx: {},
    ...overrides,
  };
}

const baseCombatContext = {
  creatures: [
    { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7, traits: [] },
    { name: casterName, type: 'player' },
  ],
};

function setupBaseMocks({ existingEffects = [] } = {}) {
  getCombatContext.mockResolvedValue(baseCombatContext);
  getRuntimeValue.mockImplementation((key, subKey) => {
    if (key === 'campaign' && subKey === 'targetEffects') return existingEffects;
    return undefined;
  });
}

describe('animalShapesHandler', () => {
  beforeEach(() => {
    addEntry.mockClear();
    getRuntimeValue.mockClear();
    getCombatContext.mockClear();
  });

  describe('handle', () => {
    it('should return automation_info when no combat context', async () => {
      getCombatContext.mockResolvedValue(null);
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Animal Shapes');
      expect(result.payload.description).toBe('No creatures in combat. Animal Shapes has no effect.');
      expect(addEntry).not.toHaveBeenCalled();
    });

    it('should return automation_info when no creatures', async () => {
      getCombatContext.mockResolvedValue({ creatures: [] });
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Animal Shapes');
      expect(result.payload.description).toBe('No creatures in combat. Animal Shapes has no effect.');
      expect(addEntry).not.toHaveBeenCalled();
    });

    it('should return animal_shapes_target_selection popup', async () => {
      setupBaseMocks();
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('animal_shapes_target_selection');
      expect(result.payload.casterName).toBe(casterName);
      expect(result.payload.campaignName).toBe(campaignName);
      expect(result.payload.maxCR).toBe(4);
      expect(result.payload.allowedSizes).toEqual(['Tiny', 'Small', 'Medium', 'Large']);
      expect(result.payload.spell).toEqual({ name: 'Animal Shapes', level: 8 });
      expect(result.payload.spellLevel).toBe(8);
      expect(result.payload.automation).toEqual({ type: 'animal_shapes', saveType: 'WIS', saveDc: 15 });
    });

    it('should default automation to empty object when action has none', async () => {
      setupBaseMocks();
      const action = makeAction();
      delete action.automation;
      const result = await handle(action, makePlayerStats(), campaignName, null);
      expect(result.payload.type).toBe('animal_shapes_target_selection');
      expect(result.payload.automation).toEqual({});
    });

    it('should return automation_info when creatures already have animal_shapes effect', async () => {
      setupBaseMocks({ existingEffects: [{ effect: 'animal_shapes', target: 'Goblin' }] });
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Animal Shapes');
      expect(result.payload.description).toBe('Animal Shapes has no effect on creatures already transformed by Animal Shapes.');
      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'ability_use',
        characterName: casterName,
        abilityName: 'Animal Shapes',
      }));
    });
  });
});
