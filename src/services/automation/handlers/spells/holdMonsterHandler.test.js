// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn((auto) => auto.saveDc || 15),
  createSaveListener: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../shared/logPoster.js', () => ({
  postLogEntry: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../common/targetResolver.js', () => ({
  resolveTarget: vi.fn(),
}));

import { handle, processHoldMonsterRepeatSave } from './holdMonsterHandler.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { postLogEntry } from '../../../shared/logPoster.js';
import { addExpiration } from '../../../rules/effects/expirations.js';

const campaignName = 'TestCampaign';
const casterName = 'TestCaster';
const targetName = 'Goblin';

function makePlayerStats(overrides = {}) {
  return {
    name: casterName,
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Charisma', bonus: 3 }],
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Hold Monster',
    automation: { type: 'hold_monster', saveType: 'WIS', saveDc: 15, ...automation },
  };
}

const baseCombatContext = {
  creatures: [
    { name: targetName, type: 'monster', currentHp: 5, maxHp: 7 },
    { name: 'Orc', type: 'monster', currentHp: 15, maxHp: 22 },
    { name: casterName, gridX: 5, gridY: 10 },
  ],
  players: [{ name: casterName, gridX: 5, gridY: 10 }],
  placedItems: [],
};

// ─── processHoldMonsterRepeatSave ───

describe('processHoldMonsterRepeatSave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when no tracking exists for the target', async () => {
    getRuntimeValue.mockReturnValue(null);

    const result = await processHoldMonsterRepeatSave(
      casterName,
      targetName,
      15,
      'Hold Monster',
      campaignName,
    );

    expect(result).toBeNull();
    expect(createSaveListener).not.toHaveBeenCalled();
  });

  it('creates save listener with correct parameters', async () => {
    getRuntimeValue.mockReturnValue(true);
    createSaveListener.mockReturnValue({
      promptId: 'hold-repeat-prompt',
      promise: Promise.resolve({ success: true }),
    });

    await processHoldMonsterRepeatSave(
      casterName,
      targetName,
      15,
      'Hold Monster',
      campaignName,
    );

    expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
      targetName,
      saveType: 'WIS',
      saveDc: 15,
      dcSuccess: 'none',
    });
  });

  describe('successful repeat save', () => {
    function setupSuccessPath(existingConditions = ['Paralyzed', 'Frightened'], existingEffects = []) {
      createSaveListener.mockReturnValue({
        promptId: 'hold-repeat-success',
        promise: Promise.resolve({ success: true }),
      });
      getRuntimeValue.mockImplementation((_entity, keyOrProp, _camp) => {
        if (keyOrProp === '_holdMonster_Goblin') return true;
        if (keyOrProp === 'activeConditions') return existingConditions;
        if (keyOrProp === 'targetEffects') return existingEffects;
        return [];
      });
    }

    it('returns popup indicating spell ends', async () => {
      setupSuccessPath();

      const result = await processHoldMonsterRepeatSave(
        casterName,
        targetName,
        15,
        'Hold Monster',
        campaignName,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('succeeded on WIS save');
      expect(result.payload.description).toContain('ends');
    });

    it('removes Paralyzed condition keeping other conditions', async () => {
      setupSuccessPath(['Paralyzed', 'Frightened']);

      await processHoldMonsterRepeatSave(
        casterName,
        targetName,
        15,
        'Hold Monster',
        campaignName,
      );

      expect(setRuntimeValue).toHaveBeenCalledWith(
        targetName,
        'activeConditions',
        ['Frightened'],
        campaignName,
      );
    });

    it('handles target with no conditions gracefully', async () => {
      setupSuccessPath([]);

      await processHoldMonsterRepeatSave(
        casterName,
        targetName,
        15,
        'Hold Monster',
        campaignName,
      );

      expect(setRuntimeValue).toHaveBeenCalledWith(
        targetName,
        'activeConditions',
        [],
        campaignName,
      );
    });

    it('clears tracking key on success', async () => {
      setupSuccessPath(['Paralyzed']);

      await processHoldMonsterRepeatSave(
        casterName,
        targetName,
        15,
        'Hold Monster',
        campaignName,
      );

      expect(setRuntimeValue).toHaveBeenCalledWith(
        casterName,
        '_holdMonster_Goblin',
        null,
        campaignName,
      );
    });

    it('cleans up target effect for this caster only', async () => {
      setupSuccessPath(['Paralyzed'], [
        { target: targetName, effect: 'hold_monster_repeat_save', source: casterName },
        { target: 'Other', effect: 'hold_monster_repeat_save', source: 'OtherCaster' },
      ]);

      await processHoldMonsterRepeatSave(
        casterName,
        targetName,
        15,
        'Hold Monster',
        campaignName,
      );

      expect(setRuntimeValue).toHaveBeenCalledWith(
        campaignName,
        'targetEffects',
        expect.arrayContaining([
          expect.objectContaining({ target: 'Other', source: 'OtherCaster' }),
        ]),
        campaignName,
      );
      expect(setRuntimeValue).toHaveBeenCalledWith(
        campaignName,
        'targetEffects',
        expect.not.arrayContaining([
          expect.objectContaining({ source: casterName }),
        ]),
        campaignName,
      );
    });

    it('posts condition removal log entry', async () => {
      setupSuccessPath(['Paralyzed']);

      await processHoldMonsterRepeatSave(
        casterName,
        targetName,
        15,
        'Hold Monster',
        campaignName,
      );

      expect(postLogEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'condition',
          action: 'removed',
          characterName: targetName,
          condition: 'Paralyzed',
          reason: 'Hold Monster (successful save)',
        }),
      );
    });

    it('calls addEntry with save_result on success', async () => {
      setupSuccessPath(['Paralyzed']);

      await processHoldMonsterRepeatSave(
        casterName,
        targetName,
        15,
        'Hold Monster',
        campaignName,
      );

      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'save_result',
          characterName: casterName,
          targetName,
          saveDc: 15,
          saveType: 'WIS',
          success: true,
        }),
      );
    });

    it('handles non-array activeConditions gracefully', async () => {
      setupSuccessPath(null);

      const result = await processHoldMonsterRepeatSave(
        casterName,
        targetName,
        15,
        'Hold Monster',
        campaignName,
      );

      expect(result.type).toBe('popup');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        targetName,
        'activeConditions',
        [],
        campaignName,
      );
    });
  });

  describe('failed repeat save', () => {
    function setupFailedRepeat() {
      createSaveListener.mockReturnValue({
        promptId: 'hold-repeat-fail',
        promise: Promise.resolve({ success: false }),
      });
      getRuntimeValue.mockImplementation((_entity, keyOrProp) => {
        if (keyOrProp === '_holdMonster_Goblin') return true;
        return [];
      });
    }

    it('returns popup indicating spell continues', async () => {
      setupFailedRepeat();

      const result = await processHoldMonsterRepeatSave(
        casterName,
        targetName,
        15,
        'Hold Monster',
        campaignName,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('failed WIS save');
      expect(result.payload.description).toContain('continues');
    });

    it('calls addEntry with save_result on failed repeat', async () => {
      setupFailedRepeat();

      await processHoldMonsterRepeatSave(
        casterName,
        targetName,
        15,
        'Hold Monster',
        campaignName,
      );

      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'save_result',
          characterName: casterName,
          targetName,
          saveDc: 15,
          saveType: 'WIS',
          success: false,
        }),
      );
    });

    it('does not modify conditions on failed save', async () => {
      setupFailedRepeat();

      await processHoldMonsterRepeatSave(
        casterName,
        targetName,
        15,
        'Hold Monster',
        campaignName,
      );

      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        targetName,
        'activeConditions',
        expect.anything(),
        campaignName,
      );
    });

    it('does not clear tracking on failed save', async () => {
      setupFailedRepeat();

      await processHoldMonsterRepeatSave(
        casterName,
        targetName,
        15,
        'Hold Monster',
        campaignName,
      );

      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        casterName,
        '_holdMonster_Goblin',
        null,
        campaignName,
      );
    });
  });
});

// ─── handle ───

describe('holdMonsterHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('combat context validation', () => {
    it('returns popup when combat context is null', async () => {
      getCombatContext.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No creatures in combat');
    });

    it('returns popup when combat context has no creatures', async () => {
      getCombatContext.mockResolvedValue({ creatures: [] });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No creatures in combat');
    });

    it('returns popup when creatures array is missing', async () => {
      getCombatContext.mockResolvedValue({});

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No creatures in combat');
    });
  });

  describe('target resolution', () => {
    it('returns popup when no target selected', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No target selected');
    });

    it('returns popup when target has no name', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue({});

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No target selected');
    });

    it('calls resolveTarget with campaignName and casterName', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue({ target: { name: targetName } });
      getRuntimeValue.mockReturnValue(null);
      createSaveListener.mockReturnValue({
        promptId: 'hold-prompt-resolve',
        promise: Promise.resolve({ success: true }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(resolveTarget).toHaveBeenCalledWith(campaignName, casterName);
    });
  });

  describe('repeat save detection', () => {
    it('delegates to processHoldMonsterRepeatSave when tracking exists', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue({ target: { name: targetName } });
      getRuntimeValue.mockImplementation((_caster, key) => {
        if (key === '_holdMonster_Goblin') return true;
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'hold-repeat-prompt',
        promise: Promise.resolve({ success: false }),
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('failed WIS save');
      expect(result.payload.description).toContain('continues');
    });
  });

  describe('initial cast - failed save', () => {
    function setupFailedSave(existingConditions = [], existingEffects = []) {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue({ target: { name: targetName } });
      getRuntimeValue.mockImplementation((_entity, keyOrProp, _camp) => {
        if (keyOrProp === '_holdMonster_Goblin') return null;
        if (keyOrProp === 'activeConditions') return existingConditions;
        if (keyOrProp === 'targetEffects') return existingEffects;
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'hold-prompt',
        promise: Promise.resolve({ success: false }),
      });
    }

    it('applies Paralyzed condition on failed save', async () => {
      setupFailedSave();
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        targetName,
        'activeConditions',
        expect.arrayContaining(['paralyzed']),
        campaignName,
      );
      expect(result.payload.description).toContain('Paralyzed');
    });

    it('appends paralyzed to existing conditions', async () => {
      setupFailedSave(['Frightened']);
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        targetName,
        'activeConditions',
        expect.arrayContaining(['Frightened', 'paralyzed']),
        campaignName,
      );
    });

    it('handles non-array existing conditions gracefully', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue({ target: { name: targetName } });
      getRuntimeValue.mockImplementation((_caster, keyOrProp, _camp) => {
        if (keyOrProp === '_holdMonster_Goblin') return null;
        if (keyOrProp === 'activeConditions') return null;
        if (keyOrProp === 'targetEffects') return [];
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'hold-prompt-null',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        targetName,
        'activeConditions',
        ['paralyzed'],
        campaignName,
      );
    });

    it('sets tracking key for repeat saves on failed save', async () => {
      setupFailedSave();
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        casterName,
        '_holdMonster_Goblin',
        true,
        campaignName,
      );
    });

    it('adds expiration for paralyzed condition', async () => {
      setupFailedSave();
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addExpiration).toHaveBeenCalledWith(
        casterName,
        targetName,
        expect.arrayContaining([
          expect.objectContaining({ type: 'condition', condition: 'paralyzed' }),
        ]),
        campaignName,
        10,
      );
    });

    it('stores target effect for repeat saves', async () => {
      setupFailedSave();
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        campaignName,
        'targetEffects',
        expect.arrayContaining([
          expect.objectContaining({
            target: targetName,
            effect: 'hold_monster_repeat_save',
            source: casterName,
          }),
        ]),
        campaignName,
      );
    });

    it('includes dc and saveType in stored target effect', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(17);
      resolveTarget.mockResolvedValue({ target: { name: targetName } });
      getRuntimeValue.mockImplementation((_caster, keyOrProp, _camp) => {
        if (keyOrProp === '_holdMonster_Goblin') return null;
        if (keyOrProp === 'activeConditions') return [];
        if (keyOrProp === 'targetEffects') return [];
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'hold-prompt-dc',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const targetEffectsCall = setRuntimeValue.mock.calls.find(
        (c) => c[1] === 'targetEffects',
      );
      const effects = targetEffectsCall[2];
      const holdEffect = effects.find(
        (e) => e.effect === 'hold_monster_repeat_save',
      );
      expect(holdEffect.dc).toBe(17);
      expect(holdEffect.saveType).toBe('WIS');
    });

    it('updates existing hold effect instead of duplicating', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue({ target: { name: targetName } });

      let readCount = 0;
      getRuntimeValue.mockImplementation((caster, keyOrProp, _prop) => {
        if (keyOrProp === '_holdMonster_Goblin') return null;
        if (keyOrProp === 'activeConditions') return [];
        if (keyOrProp === 'targetEffects') {
          readCount++;
          if (readCount === 1) {
            return [
              {
                target: targetName,
                effect: 'hold_monster_repeat_save',
                source: 'OldCaster',
              },
            ];
          }
          return [
            {
              target: targetName,
              effect: 'hold_monster_repeat_save',
              source: casterName,
            },
          ];
        }
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'hold-prompt-update',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const targetEffectsCalls = setRuntimeValue.mock.calls.filter(
        (c) => c[1] === 'targetEffects',
      );
      expect(targetEffectsCalls.length).toBe(1);
      const effects = targetEffectsCalls[0][2];
      expect(effects.length).toBe(1);
      expect(effects[0].source).toBe(casterName);
    });

    it('calls postLogEntry on failed save', async () => {
      setupFailedSave();
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(postLogEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'condition',
          action: 'applied',
          characterName: targetName,
          condition: 'Paralyzed',
          reason: 'Hold Monster',
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
          saveDc: 15,
          saveType: 'WIS',
          success: false,
        }),
      );
    });
  });

  describe('initial cast - successful save', () => {
    function setupSuccessfulSave() {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(20);
      resolveTarget.mockResolvedValue({ target: { name: targetName } });
      createSaveListener.mockReturnValue({
        promptId: 'hold-prompt-success',
        promise: Promise.resolve({ success: true }),
      });
    }

    it('returns popup when target succeeds save', async () => {
      setupSuccessfulSave();

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('succeeded on WIS save');
    });

    it('does not apply any conditions on success', async () => {
      setupSuccessfulSave();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        targetName,
        'activeConditions',
        expect.anything(),
        campaignName,
      );
    });

    it('does not set tracking key on success', async () => {
      setupSuccessfulSave();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        casterName,
        '_holdMonster_Goblin',
        true,
        campaignName,
      );
    });

    it('does not add expiration on success', async () => {
      setupSuccessfulSave();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addExpiration).not.toHaveBeenCalled();
    });

    it('does not store target effects on success', async () => {
      setupSuccessfulSave();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const targetEffectsCalls = setRuntimeValue.mock.calls.filter(
        (c) => c[1] === 'targetEffects',
      );
      expect(targetEffectsCalls.length).toBe(0);
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
          saveDc: 20,
          saveType: 'WIS',
          success: true,
        }),
      );
    });
  });
});
