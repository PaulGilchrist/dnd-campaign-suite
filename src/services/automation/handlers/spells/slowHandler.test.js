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

import { processSlowRepeatSave, handle } from './slowHandler.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';

const campaignName = 'TestCampaign';
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

// ─── processSlowRepeatSave ───

describe('processSlowRepeatSave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when no tracking data exists', async () => {
    getRuntimeValue.mockReturnValue(null);

    const result = await processSlowRepeatSave(casterName, targetName, saveDc, campaignName);

    expect(result).toBeNull();
    expect(createSaveListener).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('creates save listener with correct parameters', async () => {
    getRuntimeValue.mockReturnValue(true);
    createSaveListener.mockReturnValue({
      promptId: 'save-prompt-1',
      promise: Promise.resolve({ success: true }),
    });

    await processSlowRepeatSave(casterName, targetName, saveDc, campaignName);

    expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
      targetName,
      saveType: 'WIS',
      saveDc,
      dcSuccess: 'none',
    });
  });

  it('calls addEntry with ability_use on repeat save', async () => {
    getRuntimeValue.mockReturnValue(true);
    createSaveListener.mockReturnValue({
      promptId: 'save-prompt-entry',
      promise: Promise.resolve({ success: true }),
    });

    await processSlowRepeatSave(casterName, targetName, saveDc, campaignName);

    expect(addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'ability_use',
      characterName: casterName,
      abilityName: 'Slow (repeat save)',
      description: expect.stringContaining(targetName),
      promptId: 'save-prompt-entry',
    });
  });

  describe('successful repeat save', () => {
    function setupSuccessPath(existingConditions = ['Slow'], existingEffects = []) {
      createSaveListener.mockReturnValue({
        promptId: 'save-prompt-success',
        promise: Promise.resolve({ success: true }),
      });
      getRuntimeValue.mockImplementation((_entity, keyOrProp, _camp) => {
        if (keyOrProp === '_slow_Goblin') return true;
        if (keyOrProp === 'activeConditions') return existingConditions;
        if (keyOrProp === 'targetEffects') return existingEffects;
        return [];
      });
    }

    it('returns popup indicating target succeeded on WIS save', async () => {
      setupSuccessPath();

      const result = await processSlowRepeatSave(casterName, targetName, saveDc, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('succeeded on WIS save');
      expect(result.payload.description).toContain(targetName);
    });

    it('removes slow condition keeping other conditions', async () => {
      setupSuccessPath(['Slow', 'poisoned']);

      await processSlowRepeatSave(casterName, targetName, saveDc, campaignName);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        targetName,
        'activeConditions',
        ['poisoned'],
        campaignName,
      );
    });

    it('handles target with no conditions gracefully', async () => {
      setupSuccessPath([]);

      await processSlowRepeatSave(casterName, targetName, saveDc, campaignName);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        targetName,
        'activeConditions',
        [],
        campaignName,
      );
    });

    it('clears tracking key on success', async () => {
      setupSuccessPath(['Slow']);

      await processSlowRepeatSave(casterName, targetName, saveDc, campaignName);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        casterName,
        '_slow_Goblin',
        null,
        campaignName,
      );
    });

    it('removes slow-related target effects for caster only', async () => {
      setupSuccessPath(['Slow'], [
        { target: targetName, effect: 'speed_halved', source: casterName },
        { target: targetName, effect: 'no_reactions', source: casterName },
        { target: targetName, effect: 'ac_penalty', source: casterName },
        { target: targetName, effect: 'dex_save_disadvantage', source: casterName },
        { target: targetName, effect: 'other_effect', source: 'OtherCaster' },
      ]);

      await processSlowRepeatSave(casterName, targetName, saveDc, campaignName);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        campaignName,
        'targetEffects',
        expect.arrayContaining([
          expect.objectContaining({ effect: 'other_effect', source: 'OtherCaster' }),
        ]),
        campaignName,
      );
    });

    it('posts condition removal log entry', async () => {
      setupSuccessPath(['Slow']);

      await processSlowRepeatSave(casterName, targetName, saveDc, campaignName);

      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'condition',
          action: 'removed',
          characterName: targetName,
          condition: 'Slow',
          reason: 'Slow (successful repeat save)',
        }),
      );
    });

    it('calls addEntry with save_result on success', async () => {
      setupSuccessPath(['Slow']);

      await processSlowRepeatSave(casterName, targetName, saveDc, campaignName);

      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'save_result',
          characterName: casterName,
          rollType: 'save-slow',
          targetName,
          saveDc,
          saveType: 'WIS',
          success: true,
        }),
      );
    });
  });

  describe('failed repeat save', () => {
    function setupFailedRepeat() {
      createSaveListener.mockReturnValue({
        promptId: 'save-prompt-fail',
        promise: Promise.resolve({ success: false }),
      });
      getRuntimeValue.mockImplementation((_entity, keyOrProp) => {
        if (keyOrProp === '_slow_Goblin') return true;
        return [];
      });
    }

    it('returns popup indicating target failed WIS save', async () => {
      setupFailedRepeat();

      const result = await processSlowRepeatSave(casterName, targetName, saveDc, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('failed WIS save');
      expect(result.payload.description).toContain('continues');
    });

    it('calls addEntry with save_result on failed repeat', async () => {
      setupFailedRepeat();

      await processSlowRepeatSave(casterName, targetName, saveDc, campaignName);

      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'save_result',
          characterName: casterName,
          rollType: 'save-slow',
          targetName,
          saveDc,
          saveType: 'WIS',
          success: false,
        }),
      );
    });
  });
});

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

    it('returns popup indicating target is slowed', async () => {
      setupFailedSave();

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Slow');
      expect(result.payload.description).toContain('is slowed');
      expect(result.payload.description).toContain('1 creature(s)');
    });

    it('applies slow condition to target', async () => {
      setupFailedSave();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        targetName,
        'activeConditions',
        expect.arrayContaining(['slow']),
        campaignName,
      );
    });

    it('appends slow to existing conditions', async () => {
      setupFailedSave(['poisoned']);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        targetName,
        'activeConditions',
        expect.arrayContaining(['poisoned', 'slow']),
        campaignName,
      );
    });

    it('sets tracking key for repeat save', async () => {
      setupFailedSave();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        casterName,
        '_slow_Goblin',
        true,
        campaignName,
      );
    });

    it('adds expiration for slow condition', async () => {
      setupFailedSave();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addExpiration).toHaveBeenCalledWith(
        casterName,
        targetName,
        expect.arrayContaining([expect.objectContaining({ type: 'condition', condition: 'slow' })]),
        campaignName,
        10,
      );
    });

    it('stores all slow debuff target effects with dc and saveType', async () => {
      setupFailedSave();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const targetEffectsCall = setRuntimeValue.mock.calls.find(
        (c) => c[1] === 'targetEffects',
      );
      expect(targetEffectsCall).toBeDefined();
      const effects = targetEffectsCall[2];
      const effectTypes = effects.map((e) => e.effect);
      expect(effectTypes).toContain('speed_halved');
      expect(effectTypes).toContain('no_reactions');
      expect(effectTypes).toContain('ac_penalty');
      expect(effectTypes).toContain('slow_repeat_save');
      const repeatSaveEffect = effects.find((e) => e.effect === 'slow_repeat_save');
      expect(repeatSaveEffect.dc).toBe(saveDc);
      expect(repeatSaveEffect.saveType).toBe('WIS');
    });

    it('posts condition applied log entry', async () => {
      setupFailedSave();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'condition',
          action: 'applied',
          characterName: targetName,
          condition: 'Slow',
          reason: 'Slow spell',
        }),
      );
    });

    it('calls addEntry with save_result on failed save', async () => {
      setupFailedSave();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'save_result',
          characterName: casterName,
          targetName,
          saveDc,
          saveType: 'WIS',
          success: false,
        }),
      );
    });

    it('includes slow debuff details in popup description', async () => {
      setupFailedSave();

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('Speed halved');
      expect(result.payload.description).toContain('AC penalty');
      expect(result.payload.description).toContain('disadvantage on DEX saves');
      expect(result.payload.description).toContain('no reactions');
      expect(result.payload.description).toContain('action or bonus action');
      expect(result.payload.description).toContain('one attack max');
      expect(result.payload.description).toContain('somatic spell failure');
      expect(result.payload.description).toContain('Repeats WIS save');
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

    it('does not apply slow condition on success', async () => {
      setupSuccessfulSave();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        targetName,
        'activeConditions',
        expect.anything(),
        campaignName,
      );
    });

    it('does not add expiration on success', async () => {
      setupSuccessfulSave();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addExpiration).not.toHaveBeenCalled();
    });

    it('calls addEntry with save_result on success', async () => {
      setupSuccessfulSave();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'save_result',
          characterName: casterName,
          targetName,
          saveDc,
          saveType: 'WIS',
          success: true,
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
  });
});
