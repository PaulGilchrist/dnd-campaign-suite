// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi } from 'vitest';

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

function makeAction(metaCtx = {}) {
  return {
    name: 'Animal Shapes',
    automation: { type: 'animal_shapes', saveType: 'WIS', saveDc: 15 },
    spell: { name: 'Animal Shapes', level: 8 },
    spellSlotLevel: 8,
    metaCtx,
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
  describe('handle', () => {
    it('should return automation_info when no combat context', async () => {
      getCombatContext.mockResolvedValue(null);
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No creatures in combat');
    });

    it('should return automation_info when no creatures', async () => {
      getCombatContext.mockResolvedValue({ creatures: [] });
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No creatures in combat');
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
    });

    it('should return automation_info when creatures already have animal_shapes effect', async () => {
      setupBaseMocks({ existingEffects: [{ effect: 'animal_shapes', target: 'Goblin' }] });
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('already transformed');
      expect(addEntry).toHaveBeenCalled();
    });
  });
});
