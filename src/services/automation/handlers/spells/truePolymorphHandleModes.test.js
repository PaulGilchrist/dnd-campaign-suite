import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn((auto) => auto.saveDc || 15),
  createSaveListener: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
  addTargetResult: vi.fn(() => Promise.resolve()),
}));

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

vi.mock('../../../../hooks/useAllySelection.js', () => ({
  getAllyList: vi.fn(),
}));

vi.mock('../../../npcs/monsterUtils.js', () => ({
  getMonsterData: vi.fn(),
}));

vi.mock('../../../ui/utils.js', () => ({
  default: { getName: (fullName) => fullName || 'Unknown' },
}));

import { handle } from './truePolymorphHandler.js';
import { createSaveListener } from '../../common/savePrompt.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getAllyList } from '../../../../hooks/useAllySelection.js';

const campaignName = 'TestCampaign';
const casterName = 'TestCaster';
const targetName = 'Goblin';

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
    name: 'True Polymorph',
    automation: { type: 'true_polymorph', saveType: 'WIS', saveDc: 15, mode: metaCtx.mode, ...metaCtx.automation },
    spell: { name: 'True Polymorph', level: 9 },
    spellSlotLevel: 9,
    metaCtx: { truePolymorphTarget: undefined, ...metaCtx },
  };
}

const baseCombatContext = {
  creatures: [
    { name: targetName, type: 'monster', currentHp: 5, maxHp: 7, traits: [] },
    { name: casterName, type: 'player' },
  ],
};

function setupBaseMocks({ allies = [casterName], saveResult = { success: false }, existingEffects = [] } = {}) {
  getCombatContext.mockResolvedValue(baseCombatContext);
  getAllyList.mockReturnValue(allies);
  getRuntimeValue.mockImplementation((key, subKey) => {
    if (key === 'campaign' && subKey === 'targetEffects') return existingEffects;
    return undefined;
  });
  createSaveListener.mockReturnValue({
    promptId: 'tpolymorph-prompt',
    promise: Promise.resolve(saveResult),
  });
}

describe('truePolymorphHandler.handle - mode handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('mode handling', () => {
    it('returns true_polymorph_object popup for creature_to_object mode', async () => {
      setupBaseMocks({ saveResult: { success: false } });

      const result = await handle(
        makeAction({ truePolymorphTarget: targetName, mode: 'creature_to_object' }),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('true_polymorph_object');
      expect(result.payload.targetName).toBe(targetName);
      expect(result.payload.casterName).toBe(casterName);
    });

    it('returns true_polymorph_select with maxCR 9 for object_into_creature mode', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);

      const result = await handle(
        makeAction({ mode: 'object_into_creature' }),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('true_polymorph_select');
      expect(result.payload.mode).toBe('object_into_creature');
      expect(result.payload.maxCR).toBe(9);
      expect(result.payload.targetName).toBeNull();
    });

    it('passes spell and spellSlotLevel in the popup payload', async () => {
      setupBaseMocks({ saveResult: { success: false } });

      const result = await handle(
        makeAction({ truePolymorphTarget: targetName }),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.payload.spell).toEqual({ name: 'True Polymorph', level: 9 });
      expect(result.payload.spellLevel).toBe(9);
    });

    it('passes campaignName in the popup payload', async () => {
      setupBaseMocks({ saveResult: { success: false } });

      const result = await handle(
        makeAction({ truePolymorphTarget: targetName }),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.payload.campaignName).toBe(campaignName);
    });
  });

  describe('object_into_creature without target', () => {
    it('returns true_polymorph_select with null targetName and maxCR 9', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);

      const result = await handle(
        makeAction({ mode: 'object_into_creature' }),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('true_polymorph_select');
      expect(result.payload.targetName).toBeNull();
      expect(result.payload.maxCR).toBe(9);
      expect(result.payload.mode).toBe('object_into_creature');
    });

    it('passes characters array in the popup for object_into_creature', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      const characters = [{ name: 'PC1' }, { name: 'PC2' }];

      const result = await handle(
        makeAction({ mode: 'object_into_creature', characters }),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.payload.characters).toEqual(characters);
    });
  });
});
