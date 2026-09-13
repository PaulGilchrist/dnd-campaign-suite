// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
}));

vi.mock('../../../ui/storage.js', () => ({
  default: { set: vi.fn() },
}));

import { handle } from './slowHandler.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import storage from '../../../ui/storage.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';

const campaignName = 'test-campaign';
const casterName = 'Wizard1';
const targetName = 'Goblin';
const saveDc = 15;

function makePlayerStats(overrides = {}) {
  return {
    name: casterName,
    level: 5,
    proficiency: 3,
    abilities: [{ name: 'Intelligence', bonus: 3 }],
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Slow',
    automation: { type: 'slow', ...automation },
  };
}

const baseCombatContext = {
  creatures: [
    { name: casterName, type: 'player', gridX: 5, gridY: 10 },
    { name: targetName, type: 'npc', currentHp: 7, maxHp: 7 },
  ],
  players: [{ name: casterName, gridX: 5, gridY: 10 }],
  placedItems: [],
};

// ─── handle ───

describe('slowHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('combat context validation', () => {
    it('returns popup when no creatures in combat', async () => {
      getCombatContext.mockResolvedValue(null);
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Slow');
      expect(result.payload.description).toContain('No creatures in combat');
    });
  });

  describe('action without automation property', () => {
    it('still builds a save DC with default behavior using empty object', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(saveDc);
      createSaveListener.mockReturnValue({
        promptId: 'prompt-no-auto',
        promise: Promise.resolve({ success: true }),
      });
      const actionNoAuto = { name: 'Slow' };
      await handle(actionNoAuto, makePlayerStats(), campaignName, null);
      expect(buildSaveDc).toHaveBeenCalledOnce();
      const [auto] = buildSaveDc.mock.calls[0];
      expect(auto).toEqual({});
    });
  });

  describe('save DC calculation', () => {
    it('calls buildSaveDc with action automation and playerStats', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(16);
      createSaveListener.mockReturnValue({
        promptId: 'prompt-dc',
        promise: Promise.resolve({ success: true }),
      });
      await handle(makeAction({ saveDc: 16 }), makePlayerStats(), campaignName, null);
      expect(buildSaveDc).toHaveBeenCalledOnce();
      const [auto, stats] = buildSaveDc.mock.calls[0];
      expect(auto.type).toBe('slow');
      expect(stats.name).toBe(casterName);
    });
  });

  describe('target filtering', () => {
    it('calls createSaveListener once per non-caster creature', async () => {
      const multiTargetContext = {
        creatures: [
          { name: casterName, type: 'player', gridX: 5, gridY: 10 },
          { name: 'Goblin', type: 'npc' },
          { name: 'Orc', type: 'npc' },
          { name: 'Skeleton', type: 'npc' },
        ],
        players: [{ name: casterName, gridX: 5, gridY: 10 }],
        placedItems: [],
      };
      getCombatContext.mockResolvedValue(multiTargetContext);
      buildSaveDc.mockReturnValue(saveDc);
      createSaveListener.mockReturnValue({
        promptId: 'prompt-multi',
        promise: Promise.resolve({ success: true }),
      });
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(createSaveListener).toHaveBeenCalledTimes(3);
    });

    it('calls createSaveListener with correct config per target', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(17);
      createSaveListener.mockReturnValue({
        promptId: 'prompt-config',
        promise: Promise.resolve({ success: true }),
      });
      await handle(makeAction({ saveDc: 17 }), makePlayerStats(), campaignName, null);
      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName,
        saveType: 'WIS',
        saveDc: 17,
        dcSuccess: 'none',
        disadvantage: false,
      });
    });

    it('calls addEntry with ability_use for each target', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(saveDc);
      createSaveListener.mockReturnValue({
        promptId: 'prompt-ability',
        promise: Promise.resolve({ success: true }),
      });
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'ability_use',
          characterName: casterName,
          abilityName: 'Slow',
          description: expect.stringContaining('casts Slow'),
          promptId: 'prompt-ability',
        }),
      );
    });

    it('uses single attack scope when metaCtx.targets is provided', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(saveDc);
      createSaveListener.mockReturnValue({
        promptId: 'prompt-single',
        promise: Promise.resolve({ success: true }),
      });
      const actionWithTargets = {
        name: 'Slow',
        automation: { type: 'slow' },
        metaCtx: { targets: [{ name: 'Goblin' }] },
      };
      await handle(actionWithTargets, makePlayerStats(), campaignName, null);
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'campaign', 'lastAttack',
        expect.objectContaining({ attackScope: 'single' }),
        campaignName,
      );
    });

    it('uses aoe attack scope when no metaCtx.targets', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(saveDc);
      createSaveListener.mockReturnValue({
        promptId: 'prompt-aoe',
        promise: Promise.resolve({ success: true }),
      });
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'campaign', 'lastAttack',
        expect.objectContaining({ attackScope: 'aoe' }),
        campaignName,
      );
    });

    it('selects specific targets from metaCtx.targets array', async () => {
      const twoTargetContext = {
        creatures: [
          { name: casterName, type: 'player', gridX: 5, gridY: 10 },
          { name: 'Goblin', type: 'npc' },
          { name: 'Orc', type: 'npc' },
          { name: 'Skeleton', type: 'npc' },
        ],
        players: [{ name: casterName, gridX: 5, gridY: 10 }],
        placedItems: [],
      };
      getCombatContext.mockResolvedValue(twoTargetContext);
      buildSaveDc.mockReturnValue(saveDc);
      createSaveListener.mockReturnValue({
        promptId: 'prompt-selected',
        promise: Promise.resolve({ success: true }),
      });
      const actionWithTargets = {
        name: 'Slow',
        automation: { type: 'slow' },
        metaCtx: { targets: [{ name: 'Goblin' }, { name: 'Orc' }] },
      };
      await handle(actionWithTargets, makePlayerStats(), campaignName, null);
      expect(createSaveListener).toHaveBeenCalledTimes(2);
      const firstCallTarget = createSaveListener.mock.calls[0][1].targetName;
      const secondCallTarget = createSaveListener.mock.calls[1][1].targetName;
      expect(firstCallTarget).toEqual({ name: 'Goblin' });
      expect(secondCallTarget).toEqual({ name: 'Orc' });
    });
  });

  describe('failed save - slow applied', () => {
    function setupFailedSave(existingConditions = [], existingEffects = []) {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(saveDc);
      getRuntimeValue.mockImplementation((_entity, keyOrProp, _camp) => {
        if (keyOrProp === '_slow_Goblin') return null;
        if (keyOrProp === 'activeConditions') return existingConditions;
        if (keyOrProp === 'targetEffects') return existingEffects;
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'prompt-fail',
        promise: Promise.resolve({ success: false }),
      });
    }

    it('returns popup with affected/saved counts and debuff details', async () => {
      setupFailedSave();
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Slow');
      expect(result.payload.description).toContain('is slowed');
      expect(result.payload.description).toContain('1 creature(s)');
      expect(result.payload.description).toContain('Speed halved');
      expect(result.payload.description).toContain('AC penalty');
      expect(result.payload.description).toContain('disadvantage on DEX saves');
      expect(result.payload.description).toContain('no reactions');
      expect(result.payload.description).toContain('action or bonus action');
      expect(result.payload.description).toContain('one attack max');
      expect(result.payload.description).toContain('somatic spell failure');
    });

    it('applies slow condition and appends to existing conditions', async () => {
      setupFailedSave();
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(setRuntimeValue).toHaveBeenCalledWith(
        targetName, 'activeConditions',
        expect.arrayContaining(['slow']),
        campaignName,
      );
    });

    it('appends slow to existing conditions', async () => {
      setupFailedSave(['poisoned']);
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(setRuntimeValue).toHaveBeenCalledWith(
        targetName, 'activeConditions',
        expect.arrayContaining(['poisoned', 'slow']),
        campaignName,
      );
    });

    it('adds expiration for slow condition', async () => {
      setupFailedSave();
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(addExpiration).toHaveBeenCalledWith({ attackerName: casterName, targetName, effects: expect.arrayContaining([expect.objectContaining({ type: 'condition', condition: 'slow' })]), campaignName });
    });

    it('posts condition applied and save_result log entries', async () => {
      setupFailedSave();
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'condition', action: 'applied', characterName: targetName,
          condition: 'Slow', reason: 'Slow spell',
        }),
      );
      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'save_result', characterName: casterName, targetName,
          saveDc, saveType: 'WIS', success: false,
        }),
      );
    });

    it('removes existing slow effects and adds new ones with correct count', async () => {
      const existingEffects = [
        { target: targetName, effect: 'no_reactions', source: casterName },
        { target: targetName, effect: 'action_limit', source: casterName },
        { target: 'OtherTarget', effect: 'no_reactions', source: 'OtherCaster' },
      ];
      setupFailedSave([], existingEffects);
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      const targetEffectsCalls = setRuntimeValue.mock.calls.filter(
        call => call[1] === 'targetEffects',
      );
      expect(targetEffectsCalls.length).toBeGreaterThan(0);
      const effectsArg = targetEffectsCalls[0][2];
      expect(effectsArg).toHaveLength(6);
      expect(effectsArg).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ target: 'OtherTarget', effect: 'no_reactions', source: 'OtherCaster' }),
          expect.objectContaining({ target: targetName, effect: 'no_reactions', source: casterName }),
          expect.objectContaining({ target: targetName, effect: 'dex_save_disadvantage', source: casterName }),
          expect.objectContaining({ target: targetName, effect: 'action_limit', source: casterName }),
          expect.objectContaining({ target: targetName, effect: 'single_attack_limit', source: casterName }),
          expect.objectContaining({ target: targetName, effect: 'somatic_failure_chance', source: casterName }),
        ]),
      );
    });

    it('filters out existing slow effects using the filter callback', async () => {
      const existingEffects = [
        { target: targetName, effect: 'no_reactions', source: casterName },
        { target: targetName, effect: 'dex_save_disadvantage', source: casterName },
        { target: targetName, effect: 'action_limit', source: casterName },
        { target: targetName, effect: 'single_attack_limit', source: casterName },
        { target: targetName, effect: 'somatic_failure_chance', source: casterName },
        { target: 'Other', effect: 'no_reactions', source: 'OtherCaster' },
      ];
      setupFailedSave([], existingEffects);
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      const targetEffectsCalls = setRuntimeValue.mock.calls.filter(
        call => call[1] === 'targetEffects',
      );
      expect(targetEffectsCalls.length).toBeGreaterThan(0);
      const effectsArg = targetEffectsCalls[0][2];
      expect(effectsArg).toHaveLength(6);
      const otherEffect = effectsArg.find(e => e.target === 'Other');
      expect(otherEffect).toBeDefined();
    });
  });

  describe('failed save - null runtime values', () => {
    it('handles null/non-array activeConditions gracefully', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(saveDc);
      createSaveListener.mockReturnValue({
        promptId: 'prompt-null-conds',
        promise: Promise.resolve({ success: false }),
      });

      // Test with null
      getRuntimeValue.mockImplementation((_entity, keyOrProp, _camp) => {
        if (keyOrProp === 'activeConditions') return null;
        if (keyOrProp === 'activeConditionMeta') return null;
        if (keyOrProp === 'targetEffects') return null;
        return [];
      });
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(setRuntimeValue).toHaveBeenCalledWith(
        targetName, 'activeConditions',
        expect.arrayContaining(['slow']),
        campaignName,
      );
      vi.clearAllMocks();

      // Re-setup for non-array test
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(saveDc);
      createSaveListener.mockReturnValue({
        promptId: 'prompt-nonarray-conds',
        promise: Promise.resolve({ success: false }),
      });
      getRuntimeValue.mockImplementation((_entity, keyOrProp, _camp) => {
        if (keyOrProp === 'activeConditions') return 'not-an-array';
        if (keyOrProp === 'activeConditionMeta') return {};
        if (keyOrProp === 'targetEffects') return [];
        return [];
      });
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(setRuntimeValue).toHaveBeenCalledWith(
        targetName, 'activeConditions',
        expect.arrayContaining(['slow']),
        campaignName,
      );
    });

    it('handles null/non-array targetEffects gracefully', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(saveDc);

      // Test with null
      getRuntimeValue.mockImplementation((_entity, keyOrProp, _camp) => {
        if (keyOrProp === 'activeConditions') return [];
        if (keyOrProp === 'activeConditionMeta') return {};
        if (keyOrProp === 'targetEffects') return null;
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'prompt-null-effects',
        promise: Promise.resolve({ success: false }),
      });
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      let targetEffectsCalls = setRuntimeValue.mock.calls.filter(call => call[1] === 'targetEffects');
      expect(targetEffectsCalls.length).toBeGreaterThan(0);
      expect(Array.isArray(targetEffectsCalls[0][2])).toBe(true);
      vi.clearAllMocks();

      // Re-setup for non-array test
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(saveDc);
      getRuntimeValue.mockImplementation((_entity, keyOrProp, _camp) => {
        if (keyOrProp === 'activeConditions') return [];
        if (keyOrProp === 'activeConditionMeta') return {};
        if (keyOrProp === 'targetEffects') return 'not-an-array';
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'prompt-nonarray-effects',
        promise: Promise.resolve({ success: false }),
      });
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      targetEffectsCalls = setRuntimeValue.mock.calls.filter(call => call[1] === 'targetEffects');
      expect(targetEffectsCalls.length).toBeGreaterThan(0);
      expect(Array.isArray(targetEffectsCalls[0][2])).toBe(true);
    });
  });

  describe('successful save - target resists', () => {
    function setupSuccessfulSave() {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(saveDc);
      createSaveListener.mockReturnValue({
        promptId: 'prompt-success',
        promise: Promise.resolve({ success: true }),
      });
    }

    it('returns popup indicating target saved', async () => {
      setupSuccessfulSave();
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('saved');
    });

    it('does not apply slow condition or expiration on success', async () => {
      setupSuccessfulSave();
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        targetName, 'activeConditions',
        expect.anything(), campaignName,
      );
      expect(addExpiration).not.toHaveBeenCalled();
    });

    it('calls addEntry with save_result on success', async () => {
      setupSuccessfulSave();
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'save_result', characterName: casterName, targetName,
          saveDc, saveType: 'WIS', success: true,
        }),
      );
    });
  });

  describe('multiple targets', () => {
    it('handles all targets saving successfully', async () => {
      const allSaveContext = {
        creatures: [
          { name: casterName, type: 'player', gridX: 5, gridY: 10 },
          { name: 'Goblin', type: 'npc' },
          { name: 'Orc', type: 'npc' },
        ],
        players: [{ name: casterName, gridX: 5, gridY: 10 }],
        placedItems: [],
      };
      getCombatContext.mockResolvedValue(allSaveContext);
      buildSaveDc.mockReturnValue(saveDc);
      createSaveListener.mockReturnValue({
        promptId: 'prompt-all-save',
        promise: Promise.resolve({ success: true }),
      });
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.payload.description).toContain('No creatures affected');
      expect(result.payload.description).toContain('2 creature(s) saved');
    });

    it('handles mixed save results', async () => {
      const multiTargetContext = {
        creatures: [
          { name: casterName, type: 'player', gridX: 5, gridY: 10 },
          { name: 'Goblin', type: 'npc' },
          { name: 'Orc', type: 'npc' },
        ],
        players: [{ name: casterName, gridX: 5, gridY: 10 }],
        placedItems: [],
      };
      getCombatContext.mockResolvedValue(multiTargetContext);
      buildSaveDc.mockReturnValue(saveDc);
      let callCount = 0;
      createSaveListener.mockImplementation(() => {
        callCount++;
        const success = callCount === 1 ? false : true;
        return {
          promptId: `prompt-mixed-${callCount}`,
          promise: Promise.resolve({ success }),
        };
      });
      getRuntimeValue.mockReturnValue([]);
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.payload.description).toContain('1 creature(s)');
      expect(result.payload.description).toContain('is slowed');
      expect(result.payload.description).toContain('1 creature(s) saved');
    });

    it('handles all targets failing save', async () => {
      const multiTargetContext = {
        creatures: [
          { name: casterName, type: 'player', gridX: 5, gridY: 10 },
          { name: 'Goblin', type: 'npc' },
          { name: 'Orc', type: 'npc' },
        ],
        players: [{ name: casterName, gridX: 5, gridY: 10 }],
        placedItems: [],
      };
      getCombatContext.mockResolvedValue(multiTargetContext);
      buildSaveDc.mockReturnValue(saveDc);
      createSaveListener.mockReturnValue({
        promptId: 'prompt-all-fail',
        promise: Promise.resolve({ success: false }),
      });
      getRuntimeValue.mockReturnValue([]);
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.payload.description).toContain('2 creature(s)');
      expect(result.payload.description).toContain('Goblin is slowed');
      expect(result.payload.description).toContain('Orc is slowed');
      expect(result.payload.description).toContain('saved');
    });
  });

  describe('edge cases', () => {
    it('handles caster-only combat (no targets)', async () => {
      const onlyPlayerContext = {
        creatures: [{ name: casterName, gridX: 5, gridY: 10 }],
        players: [{ name: casterName, gridX: 5, gridY: 10 }],
        placedItems: [],
      };
      getCombatContext.mockResolvedValue(onlyPlayerContext);
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(createSaveListener).not.toHaveBeenCalled();
      expect(result.payload.description).toContain('No creatures affected');
    });

    it('handles addEntry rejection in ability_use, save_result, and condition logs without throwing', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(saveDc);

      addEntry.mockImplementation(() => Promise.reject(new Error('log error')));
      createSaveListener.mockReturnValue({
        promptId: 'prompt-catch-all',
        promise: Promise.resolve({ success: true }),
      });
      await expect(
        handle(makeAction(), makePlayerStats(), campaignName, null),
      ).resolves.toBeDefined();

      vi.clearAllMocks();

      // Re-setup for failure path with condition/save_result rejections
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(saveDc);
      addEntry.mockImplementation((_camp, entry) => {
        if (entry.type === 'condition' || (entry.type === 'save_result' && entry.success === false)) {
          return Promise.reject(new Error('log error'));
        }
        return Promise.resolve();
      });
      getRuntimeValue.mockImplementation((_entity, keyOrProp, _camp) => {
        if (keyOrProp === 'activeConditions') return [];
        if (keyOrProp === 'activeConditionMeta') return {};
        if (keyOrProp === 'targetEffects') return [];
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'prompt-catch-fail',
        promise: Promise.resolve({ success: false }),
      });
      await expect(
        handle(makeAction(), makePlayerStats(), campaignName, null),
      ).resolves.toBeDefined();
      expect(addEntry).toHaveBeenCalled();
    });
  });

  describe('SP-109: real save DC, ac_penalty te, concentration persistence', () => {
    function setupFailedSaveWithDc(dc) {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(dc);
      getCombatSummary.mockReturnValue({
        creatures: [
          { name: casterName, type: 'player' },
          { name: targetName, type: 'npc' },
        ],
      });
      getRuntimeValue.mockImplementation((_entity, keyOrProp) => {
        if (keyOrProp === 'activeConditions') return [];
        if (keyOrProp === 'activeConditionMeta') return {};
        if (keyOrProp === 'targetEffects') return [];
        return null;
      });
      createSaveListener.mockReturnValue({
        promptId: 'prompt-sp109',
        promise: Promise.resolve({ success: false }),
      });
    }

    it('stamps the forwarded real DC into prompts and activeConditionMeta', async () => {
      setupFailedSaveWithDc(17);
      await handle(makeAction({ saveDc: 17 }), makePlayerStats(), campaignName, null);
      const [, listenerCfg] = createSaveListener.mock.calls[0];
      expect(listenerCfg.saveDc).toBe(17);
      expect(setRuntimeValue).toHaveBeenCalledWith(
        targetName, 'activeConditionMeta',
        expect.objectContaining({ slow: expect.objectContaining({ dc: 17, ability: 'wis' }) }),
        campaignName,
      );
    });

    it('does not write an ac_penalty te (slow condition carries the -2 AC penalty)', async () => {
      setupFailedSaveWithDc(17);
      await handle(makeAction({ saveDc: 17 }), makePlayerStats(), campaignName, null);
      const effectsArg = setRuntimeValue.mock.calls.find(c => c[1] === 'targetEffects')[2];
      expect(effectsArg.some(te => te.effect === 'ac_penalty')).toBe(false);
      expect(effectsArg.filter(te => te.target === targetName)).toHaveLength(5);
    });

    it('persists caster concentration with the real DC and stores combatSummary', async () => {
      setupFailedSaveWithDc(17);
      await handle(makeAction({ saveDc: 17 }), makePlayerStats(), campaignName, null);
      expect(addConcentration).toHaveBeenCalledWith(
        expect.objectContaining({ creatures: expect.any(Array) }),
        casterName, 'Slow', 17,
      );
      expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.objectContaining({ creatures: expect.any(Array) }), campaignName);
    });

    it('does not overwrite an existing concentration record for the same spell', async () => {
      setupFailedSaveWithDc(17);
      getCombatSummary.mockReturnValue({
        creatures: [
          { name: casterName, type: 'player', concentration: { spell: 'Slow', dc: 17 } },
          { name: targetName, type: 'npc' },
        ],
      });
      await handle(makeAction({ saveDc: 17 }), makePlayerStats(), campaignName, null);
      expect(addConcentration).not.toHaveBeenCalled();
      expect(storage.set).not.toHaveBeenCalled();
    });
  });

});
