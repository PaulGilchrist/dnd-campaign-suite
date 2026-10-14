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
import { addTargetResult } from '../../common/damageRollback.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getAllyList } from '../../../../hooks/useAllySelection.js';
import { addEntry } from '../../../ui/logService.js';

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

describe('truePolymorphHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('combat context validation', () => {
    it('returns popup when combat context has no creatures', async () => {
      getCombatContext.mockResolvedValue({ creatures: [] });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No creatures in combat');
    });

    it('returns popup when combat context is null', async () => {
      getCombatContext.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No creatures in combat');
    });
  });

  describe('target validation', () => {
    it('returns popup when no truePolymorphTarget provided (creature_to_creature mode)', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No target selected');
    });

    it('skips target validation for object_into_creature mode', async () => {
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
      expect(result.payload.targetName).toBeNull();
    });

    it('returns info popup when target not found in combat (non-object mode)', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);

      const result = await handle(
        makeAction({ truePolymorphTarget: 'NonExistent' }),
        makePlayerStats(),
        campaignName,
        null,
      );

      // Target not found means targetCreature is undefined, falls through to the
      // default "no valid target" path for non-object modes
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No valid target');
    });

    it('returns popup when target is already transformed (true_polymorph effect)', async () => {
      setupBaseMocks({
        existingEffects: [{ target: targetName, effect: 'true_polymorph', source: casterName }],
      });

      const result = await handle(
        makeAction({ truePolymorphTarget: targetName }),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('already transformed');
      expect(createSaveListener).not.toHaveBeenCalled();
    });

    it('returns popup when target is already transformed (polymorph effect)', async () => {
      setupBaseMocks({
        existingEffects: [{ target: targetName, effect: 'polymorph', source: casterName }],
      });

      const result = await handle(
        makeAction({ truePolymorphTarget: targetName }),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.payload.description).toContain('already transformed');
    });

    it('returns popup when target is already transformed (object_transform effect)', async () => {
      setupBaseMocks({
        existingEffects: [{ target: targetName, effect: 'object_transform', source: casterName }],
      });

      const result = await handle(
        makeAction({ truePolymorphTarget: targetName }),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.payload.description).toContain('already transformed');
    });

    it('handles array target in existing effects check', async () => {
      setupBaseMocks({
        existingEffects: [{ target: [targetName, 'extra'], effect: 'true_polymorph', source: casterName }],
      });

      const result = await handle(
        makeAction({ truePolymorphTarget: targetName }),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.payload.description).toContain('already transformed');
    });

    it('returns popup when target has 0 hit points', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: targetName, type: 'monster', currentHp: 0, maxHp: 7, traits: [] },
          { name: casterName, type: 'player' },
        ],
      });
      getAllyList.mockReturnValue([casterName]);
      getRuntimeValue.mockImplementation(() => undefined);

      const result = await handle(
        makeAction({ truePolymorphTarget: targetName }),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('0 hit points');
      expect(createSaveListener).not.toHaveBeenCalled();
    });

    it('returns popup when target has hit_points.current = 0', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: targetName, type: 'monster', hit_points: { current: 0, max: 7 }, traits: [] },
          { name: casterName, type: 'player' },
        ],
      });
      getAllyList.mockReturnValue([casterName]);
      getRuntimeValue.mockImplementation(() => undefined);

      const result = await handle(
        makeAction({ truePolymorphTarget: targetName }),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.payload.description).toContain('0 hit points');
    });

    it('returns popup when target is a shapechanger (traits)', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: targetName, type: 'monster', currentHp: 5, maxHp: 7, traits: [{ name: 'Shapechanger' }] },
          { name: casterName, type: 'player' },
        ],
      });
      getAllyList.mockReturnValue([casterName]);
      getRuntimeValue.mockImplementation(() => undefined);

      const result = await handle(
        makeAction({ truePolymorphTarget: targetName }),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.payload.description).toContain('shapechanger');
      expect(createSaveListener).not.toHaveBeenCalled();
    });

    it('returns popup when target is a shapechanger (special_abilities)', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          {
            name: targetName,
            type: 'monster',
            currentHp: 5,
            maxHp: 7,
            special_abilities: [{ name: 'Shapechanger' }],
          },
          { name: casterName, type: 'player' },
        ],
      });
      getAllyList.mockReturnValue([casterName]);
      getRuntimeValue.mockImplementation(() => undefined);

      const result = await handle(
        makeAction({ truePolymorphTarget: targetName }),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.payload.description).toContain('shapechanger');
    });

    it('returns popup when target type is shapechanger', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: targetName, type: 'npc', monsterType: 'Shapechanger', currentHp: 5, maxHp: 7 },
          { name: casterName, type: 'player' },
        ],
      });
      getAllyList.mockReturnValue([casterName]);
      getRuntimeValue.mockImplementation(() => undefined);

      const result = await handle(
        makeAction({ truePolymorphTarget: targetName }),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.payload.description).toContain('shapechanger');
    });

    it('returns popup when target type includes shapechanger substring', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: targetName, type: 'npc', monsterType: 'Were-Shapechanger', currentHp: 5, maxHp: 7 },
          { name: casterName, type: 'player' },
        ],
      });
      getAllyList.mockReturnValue([casterName]);
      getRuntimeValue.mockImplementation(() => undefined);

      const result = await handle(
        makeAction({ truePolymorphTarget: targetName }),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.payload.description).toContain('shapechanger');
    });

    it('returns popup when target has shapechanger type tag', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: targetName, type: 'monstrosity', currentHp: 5, maxHp: 7, type_tags: ['shapechanger'] },
          { name: casterName, type: 'player' },
        ],
      });
      getAllyList.mockReturnValue([casterName]);
      getRuntimeValue.mockImplementation(() => undefined);

      const result = await handle(
        makeAction({ truePolymorphTarget: targetName }),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.payload.description).toContain('shapechanger');
    });
  });

  describe('non-ally target save flow', () => {
    it('returns true_polymorph_select popup when target fails save', async () => {
      setupBaseMocks({ saveResult: { success: false, roll: 5, total: 6 } });

      const result = await handle(
        makeAction({ truePolymorphTarget: targetName }),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('true_polymorph_select');
      expect(result.payload.targetName).toBe(targetName);
      expect(result.payload.casterName).toBe(casterName);
      expect(result.payload.mode).toBe('creature_to_creature');
      expect(createSaveListener).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({ targetName, saveType: 'WIS', saveDc: 15 }),
      );
    });

    it('returns automation_info when target succeeds save', async () => {
      setupBaseMocks({ saveResult: { success: true, roll: 15, total: 20 } });

      const result = await handle(
        makeAction({ truePolymorphTarget: targetName }),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('resisted the transformation');
      expect(addTargetResult).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({ targetName, saveResult: 'success' }),
      );
    });

    it('passes metamagicHeighten as disadvantage', async () => {
      setupBaseMocks();

      await handle(
        makeAction({ truePolymorphTarget: targetName, metamagicHeighten: true }),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(createSaveListener).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({ disadvantage: true }),
      );
    });

    it('does not set disadvantage when metamagicHeighten is absent', async () => {
      setupBaseMocks({ saveResult: { success: false } });

      await handle(
        makeAction({ truePolymorphTarget: targetName }),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(createSaveListener).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({ disadvantage: false }),
      );
    });

    it('logs save-polymorph result entries on failure', async () => {
      setupBaseMocks({ saveResult: { success: false, roll: 5, total: 6 } });

      await handle(
        makeAction({ truePolymorphTarget: targetName }),
        makePlayerStats(),
        campaignName,
        null,
      );

      const saveResultCalls = vi.mocked(addEntry).mock.calls.filter(
        (call) => call[1]?.rollType === 'save-polymorph',
      );
      expect(saveResultCalls.length).toBe(1);
      expect(saveResultCalls[0][1].success).toBe(false);
    });

    it('logs save-polymorph result entries on success', async () => {
      setupBaseMocks({ saveResult: { success: true, roll: 15, total: 20 } });

      await handle(
        makeAction({ truePolymorphTarget: targetName }),
        makePlayerStats(),
        campaignName,
        null,
      );

      const saveResultCalls = vi.mocked(addEntry).mock.calls.filter(
        (call) => call[1]?.rollType === 'save-polymorph',
      );
      expect(saveResultCalls.length).toBe(1);
      expect(saveResultCalls[0][1].success).toBe(true);
    });

    it('includes promptId in ability_use log entry', async () => {
      setupBaseMocks({ saveResult: { success: false } });

      await handle(
        makeAction({ truePolymorphTarget: targetName }),
        makePlayerStats(),
        campaignName,
        null,
      );

      const abilityCalls = vi.mocked(addEntry).mock.calls.filter(
        (call) => call[1]?.type === 'ability_use' && call[1]?.description.includes('must make a WIS save'),
      );
      expect(abilityCalls.length).toBe(1);
      expect(abilityCalls[0][1].promptId).toBe('tpolymorph-prompt');
    });

    it('passes default DC from buildSaveDc when saveDc not in automation', async () => {
      const { buildSaveDc } = await import('../../common/savePrompt.js');
      buildSaveDc.mockReturnValue(18);
      setupBaseMocks({ saveResult: { success: false } });

      await handle(
        makeAction({ truePolymorphTarget: targetName, automation: { type: 'true_polymorph', saveType: 'WIS' } }),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(createSaveListener).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({ saveDc: 18 }),
      );
    });
  });

  describe('ally target', () => {
    it('skips the save and returns true_polymorph_select popup for allies', async () => {
      setupBaseMocks({ allies: [casterName, targetName] });

      const result = await handle(
        makeAction({ truePolymorphTarget: targetName }),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.payload.type).toBe('true_polymorph_select');
      expect(createSaveListener).not.toHaveBeenCalled();
    });

    it('uses utils.getName for ally matching', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Goblin the Brave', type: 'monster', currentHp: 5, maxHp: 7, traits: [] },
          { name: casterName, type: 'player' },
        ],
      });
      getAllyList.mockReturnValue([casterName, 'Goblin the Brave']);
      getRuntimeValue.mockImplementation(() => undefined);

      const result = await handle(
        makeAction({ truePolymorphTarget: 'Goblin the Brave' }),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.payload.type).toBe('true_polymorph_select');
      expect(createSaveListener).not.toHaveBeenCalled();
    });
  });

  describe('no valid target fallback', () => {
    it('returns automation_info when target is not found and mode is not object_into_creature', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);

      const result = await handle(
        makeAction({ truePolymorphTarget: 'NonExistent' }),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No valid target');
    });
  });

  describe('already transformed logging', () => {
    it('logs ability_use when target is already transformed', async () => {
      setupBaseMocks({
        existingEffects: [{ target: targetName, effect: 'true_polymorph', source: 'OldCaster' }],
      });

      await handle(
        makeAction({ truePolymorphTarget: targetName }),
        makePlayerStats(),
        campaignName,
        null,
      );

      const abilityCalls = vi.mocked(addEntry).mock.calls.filter(
        (call) => call[1]?.type === 'ability_use',
      );
      expect(abilityCalls.length).toBe(1);
      expect(abilityCalls[0][1].description).toContain('already transformed');
    });

    it('logs ability_use when target has 0 hit points', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: targetName, type: 'monster', currentHp: 0, traits: [] },
          { name: casterName, type: 'player' },
        ],
      });
      getAllyList.mockReturnValue([casterName]);
      getRuntimeValue.mockImplementation(() => undefined);

      await handle(
        makeAction({ truePolymorphTarget: targetName }),
        makePlayerStats(),
        campaignName,
        null,
      );

      const abilityCalls = vi.mocked(addEntry).mock.calls.filter(
        (call) => call[1]?.type === 'ability_use',
      );
      expect(abilityCalls.length).toBe(1);
      expect(abilityCalls[0][1].description).toContain('0 hit points');
    });

    it('logs ability_use when target is a shapechanger', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: targetName, type: 'npc', monsterType: 'Shapechanger', currentHp: 5 },
          { name: casterName, type: 'player' },
        ],
      });
      getAllyList.mockReturnValue([casterName]);
      getRuntimeValue.mockImplementation(() => undefined);

      await handle(
        makeAction({ truePolymorphTarget: targetName }),
        makePlayerStats(),
        campaignName,
        null,
      );

      const abilityCalls = vi.mocked(addEntry).mock.calls.filter(
        (call) => call[1]?.type === 'ability_use',
      );
      expect(abilityCalls.length).toBe(1);
      expect(abilityCalls[0][1].description).toContain('shapechanger');
    });
  });

  describe('player target with 0 HP', () => {
    it('reads currentHitPoints from runtime store for player-type targets', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: targetName, type: 'player', currentHp: 5 },
          { name: casterName, type: 'player' },
        ],
      });
      getAllyList.mockReturnValue([casterName]);
      getRuntimeValue.mockImplementation((key, subKey, cn) => {
        if (key === targetName && subKey === 'currentHitPoints' && cn === campaignName) return 0;
        return undefined;
      });

      const result = await handle(
        makeAction({ truePolymorphTarget: targetName }),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.payload.description).toContain('0 hit points');
    });

    it('uses creature currentHp when runtime store returns non-number', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: targetName, type: 'player', currentHp: 0 },
          { name: casterName, type: 'player' },
        ],
      });
      getAllyList.mockReturnValue([casterName]);
      getRuntimeValue.mockImplementation((key, subKey, cn) => {
        if (key === targetName && subKey === 'currentHitPoints' && cn === campaignName) return 'invalid';
        return undefined;
      });

      const result = await handle(
        makeAction({ truePolymorphTarget: targetName }),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.payload.description).toContain('0 hit points');
    });
  });
});
