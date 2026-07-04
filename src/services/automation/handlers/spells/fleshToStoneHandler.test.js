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

import { handle, processFleshToStoneRepeatSave } from './fleshToStoneHandler.js';
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
    name: 'Flesh to Stone',
    automation: { type: 'flesh_to_stone', saveType: 'CON', saveDc: 15, ...automation },
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

// ─── processFleshToStoneRepeatSave ───

describe('processFleshToStoneRepeatSave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when no tracking exists for the target', async () => {
    getRuntimeValue.mockReturnValue(null);

    const result = await processFleshToStoneRepeatSave(
      casterName,
      targetName,
      15,
      campaignName,
    );

    expect(result).toBeNull();
    expect(createSaveListener).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('creates save listener with correct parameters', async () => {
    getRuntimeValue.mockReturnValue([0, 0]);
    createSaveListener.mockReturnValue({
      promptId: 'fts-repeat-prompt',
      promise: Promise.resolve({ success: false }),
    });

    await processFleshToStoneRepeatSave(
      casterName,
      targetName,
      15,
      campaignName,
    );

    expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
      targetName,
      saveType: 'CON',
      saveDc: 15,
      dcSuccess: 'none',
    });
  });

  it('calls addEntry with ability_use on repeat save', async () => {
    getRuntimeValue.mockReturnValue([0, 0]);
    createSaveListener.mockReturnValue({
      promptId: 'fts-repeat-entry',
      promise: Promise.resolve({ success: false }),
    });

    await processFleshToStoneRepeatSave(
      casterName,
      targetName,
      15,
      campaignName,
    );

    expect(addEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({
        type: 'ability_use',
        characterName: casterName,
        abilityName: 'Flesh to Stone',
        description: expect.stringContaining('CON save'),
      }),
    );
  });

  describe('successful repeat save', () => {
    function setupSuccessPath(
      tracking = [0, 0],
      existingConditions = ['Restrained'],
      existingEffects = [],
    ) {
      createSaveListener.mockReturnValue({
        promptId: 'fts-success',
        promise: Promise.resolve({ success: true }),
      });
      getRuntimeValue.mockImplementation((_entity, keyOrProp, _camp) => {
        if (keyOrProp === '_fleshToStone_Goblin') return tracking;
        if (keyOrProp === 'activeConditions') return existingConditions;
        if (keyOrProp === 'targetEffects') return existingEffects;
        return [];
      });
    }

    it('ends spell after 3 successes', async () => {
      setupSuccessPath([2, 0]);

      const result = await processFleshToStoneRepeatSave(
        casterName,
        targetName,
        15,
        campaignName,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Flesh to Stone ends');
    });

    it('handles target with no Restrained condition gracefully', async () => {
      setupSuccessPath([2, 0], ['Frightened']);

      const result = await processFleshToStoneRepeatSave(
        casterName,
        targetName,
        15,
        campaignName,
      );

      expect(result.type).toBe('popup');
    });

    it('cleans up target effect for this caster only', async () => {
      setupSuccessPath([2, 0], ['Restrained'], [
        { target: targetName, effect: 'flesh_to_stone_repeat_save', source: casterName },
        { target: 'Other', effect: 'flesh_to_stone_repeat_save', source: 'OtherCaster' },
      ]);

      await processFleshToStoneRepeatSave(
        casterName,
        targetName,
        15,
        campaignName,
      );

      const targetEffectsCall = setRuntimeValue.mock.calls.find(
        (c) => c[1] === 'targetEffects',
      );
      const effects = targetEffectsCall[2];
      expect(effects).toEqual([
        { target: 'Other', effect: 'flesh_to_stone_repeat_save', source: 'OtherCaster' },
      ]);
    });

    it('posts condition removal log entry', async () => {
      setupSuccessPath([2, 0]);

      await processFleshToStoneRepeatSave(
        casterName,
        targetName,
        15,
        campaignName,
      );

      expect(postLogEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'condition',
          action: 'removed',
          characterName: targetName,
          condition: 'Restrained',
          reason: 'Flesh to Stone ended (3 successful saves)',
        }),
      );
    });

    it('calls addEntry with save_result on success', async () => {
      setupSuccessPath([2, 0]);

      await processFleshToStoneRepeatSave(
        casterName,
        targetName,
        15,
        campaignName,
      );

      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'save_result',
          characterName: casterName,
          targetName,
          saveDc: 15,
          saveType: 'CON',
          success: true,
        }),
      );
    });

    it('reports remaining successes when spell continues', async () => {
      setupSuccessPath([1, 0]);

      const result = await processFleshToStoneRepeatSave(
        casterName,
        targetName,
        15,
        campaignName,
      );

      expect(result.payload.description).toContain('1 more needed');
    });
  });

  describe('failed repeat save', () => {
    function setupFailedPath(
      tracking = [0, 0],
      existingConditions = ['Restrained'],
    ) {
      createSaveListener.mockReturnValue({
        promptId: 'fts-fail',
        promise: Promise.resolve({ success: false }),
      });
      getRuntimeValue.mockImplementation((_entity, keyOrProp, _camp) => {
        if (keyOrProp === '_fleshToStone_Goblin') return tracking;
        if (keyOrProp === 'activeConditions') return existingConditions;
        return [];
      });
    }

    it('petrifies after 3 failures', async () => {
      setupFailedPath([0, 2]);

      const result = await processFleshToStoneRepeatSave(
        casterName,
        targetName,
        15,
        campaignName,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Petrified');
    });

    it('handles target with no Restrained condition when petrifying', async () => {
      setupFailedPath([0, 2], ['Frightened']);

      const result = await processFleshToStoneRepeatSave(
        casterName,
        targetName,
        15,
        campaignName,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Petrified');
    });

    it('cleans up target effect on petrification', async () => {
      setupFailedPath([0, 2], ['Restrained'], [
        { target: targetName, effect: 'flesh_to_stone_repeat_save', source: casterName },
      ]);

      await processFleshToStoneRepeatSave(
        casterName,
        targetName,
        15,
        campaignName,
      );

      const targetEffectsCall = setRuntimeValue.mock.calls.find(
        (c) => c[1] === 'targetEffects',
      );
      expect(targetEffectsCall[2]).toEqual([]);
    });

    it('posts condition applied log entry for petrification', async () => {
      setupFailedPath([0, 2]);

      await processFleshToStoneRepeatSave(
        casterName,
        targetName,
        15,
        campaignName,
      );

      expect(postLogEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'condition',
          action: 'applied',
          characterName: targetName,
          condition: 'Petrified',
          reason: 'Flesh to Stone (3 failed saves)',
        }),
      );
    });

    it('calls addEntry with save_result on failure', async () => {
      setupFailedPath([0, 2]);

      await processFleshToStoneRepeatSave(
        casterName,
        targetName,
        15,
        campaignName,
      );

      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'save_result',
          characterName: casterName,
          targetName,
          saveDc: 15,
          saveType: 'CON',
          success: false,
        }),
      );
    });

    it('reports remaining failures when not yet petrified', async () => {
      setupFailedPath([0, 1]);

      const result = await processFleshToStoneRepeatSave(
        casterName,
        targetName,
        15,
        campaignName,
      );

      expect(result.payload.description).toContain('1 more failures');
    });
  });
});

// ─── handle ───

describe('fleshToStoneHandler.handle', () => {
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
        promptId: 'fts-resolve',
        promise: Promise.resolve({ success: true }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(resolveTarget).toHaveBeenCalledWith(campaignName, casterName);
    });
  });

  describe('construct handling', () => {
    const constructContext = {
      ...baseCombatContext,
      creatures: [
        { name: targetName, type: 'construct', currentHp: 5, maxHp: 7 },
        { name: 'Orc', type: 'monster', currentHp: 15, maxHp: 22 },
        { name: casterName, gridX: 5, gridY: 10 },
      ],
    };

    function setupConstruct(existingConditions = []) {
      getCombatContext.mockResolvedValue(constructContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue({ target: { name: targetName, type: 'construct' } });
      getRuntimeValue.mockImplementation((_entity, keyOrProp, _camp) => {
        if (keyOrProp === '_fleshToStone_Goblin') return null;
        if (keyOrProp === 'activeConditions') return existingConditions;
        return [];
      });
    }

    it('returns popup indicating construct auto-succeeds', async () => {
      setupConstruct();

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Construct');
      expect(result.payload.description).toContain('automatically succeeds');
    });

    it('applies speed_zero condition to constructs', async () => {
      setupConstruct();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        targetName,
        'activeConditions',
        expect.arrayContaining(['speed_zero']),
        campaignName,
      );
    });

    it('removes existing speed_zero before reapplying', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue({ target: { name: targetName, type: 'construct' } });
      getRuntimeValue.mockImplementation((_entity, keyOrProp, _camp) => {
        if (keyOrProp === '_fleshToStone_Goblin') return null;
        if (keyOrProp === 'activeConditions') return ['speed_zero', 'Frightened'];
        return [];
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const condsCall = setRuntimeValue.mock.calls.find(
        (c) => c[1] === 'activeConditions',
      );
      const conds = condsCall[2];
      expect(conds.filter((c) => c === 'speed_zero').length).toBe(1);
      expect(conds).toContain('Frightened');
    });

    it('adds speed_zero expiration for constructs', async () => {
      setupConstruct();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addExpiration).toHaveBeenCalledWith(
        casterName,
        targetName,
        expect.arrayContaining([{ type: 'speed_zero' }]),
        campaignName,
        1,
      );
    });

    it('does not create save listener for constructs', async () => {
      setupConstruct();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(createSaveListener).not.toHaveBeenCalled();
    });

    it('calls addEntry for construct auto-succeed', async () => {
      setupConstruct();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'ability_use',
          characterName: casterName,
          abilityName: 'Flesh to Stone',
          description: expect.stringContaining('Construct'),
        }),
      );
    });

    it('handles missing creature type defaults to non-construct', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue({ target: { name: targetName } });
      getRuntimeValue.mockReturnValue(null);
      createSaveListener.mockReturnValue({
        promptId: 'fts-no-type',
        promise: Promise.resolve({ success: true }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalled();
    });
  });

  describe('initial cast - failed save', () => {
    function setupFailedSave(
      existingConditions = [],
      existingEffects = [],
    ) {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue({ target: { name: targetName, type: 'monster' } });
      getRuntimeValue.mockImplementation((_entity, keyOrProp, _camp) => {
        if (keyOrProp === '_fleshToStone_Goblin') return null;
        if (keyOrProp === 'activeConditions') return existingConditions;
        if (keyOrProp === 'targetEffects') return existingEffects;
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'fts-fail',
        promise: Promise.resolve({ success: false }),
      });
    }

    it('applies Restrained condition on failed save', async () => {
      setupFailedSave();

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('Restrained');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        targetName,
        'activeConditions',
        expect.arrayContaining(['restrained']),
        campaignName,
      );
    });

    it('initializes tracking [0, 1] on failed save', async () => {
      setupFailedSave();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        casterName,
        '_fleshToStone_Goblin',
        [0, 1],
        campaignName,
      );
    });

    it('adds restrained expiration on failed save', async () => {
      setupFailedSave();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addExpiration).toHaveBeenCalledWith(
        casterName,
        targetName,
        expect.arrayContaining([
          { type: 'condition', condition: 'restrained' },
        ]),
        campaignName,
        10,
      );
    });

    it('stores target effect for repeat saves', async () => {
      setupFailedSave();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const targetEffectsCall = setRuntimeValue.mock.calls.find(
        (c) => c[1] === 'targetEffects',
      );
      const effects = targetEffectsCall[2];
      const fleshEffect = effects.find(
        (e) => e.effect === 'flesh_to_stone_repeat_save',
      );
      expect(fleshEffect).toEqual(
        expect.objectContaining({
          target: targetName,
          effect: 'flesh_to_stone_repeat_save',
          source: casterName,
          condition: 'restrained',
          saveType: 'CON',
          duration: 'concentration',
        }),
      );
    });

    it('includes saveDc in stored target effect', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(18);
      resolveTarget.mockResolvedValue({ target: { name: targetName, type: 'monster' } });
      getRuntimeValue.mockImplementation((_entity, keyOrProp, _camp) => {
        if (keyOrProp === '_fleshToStone_Goblin') return null;
        if (keyOrProp === 'activeConditions') return [];
        if (keyOrProp === 'targetEffects') return [];
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'fts-dc',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const targetEffectsCall = setRuntimeValue.mock.calls.find(
        (c) => c[1] === 'targetEffects',
      );
      const effects = targetEffectsCall[2];
      const fleshEffect = effects.find(
        (e) => e.effect === 'flesh_to_stone_repeat_save',
      );
      expect(fleshEffect.dc).toBe(18);
    });

    it('updates existing effect instead of duplicating', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue({ target: { name: targetName, type: 'monster' } });

      let readCount = 0;
      getRuntimeValue.mockImplementation((caster, keyOrProp, _prop) => {
        if (keyOrProp === '_fleshToStone_Goblin') return null;
        if (keyOrProp === 'activeConditions') return [];
        if (keyOrProp === 'targetEffects') {
          readCount++;
          if (readCount === 1) {
            return [
              {
                target: targetName,
                effect: 'flesh_to_stone_repeat_save',
                source: 'OldCaster',
              },
            ];
          }
          return [
            {
              target: targetName,
              effect: 'flesh_to_stone_repeat_save',
              source: casterName,
            },
          ];
        }
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'fts-update',
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

    it('posts condition applied log entry', async () => {
      setupFailedSave();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(postLogEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'condition',
          action: 'applied',
          characterName: targetName,
          condition: 'Restrained',
          reason: 'Flesh to Stone',
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
          saveType: 'CON',
          success: false,
        }),
      );
    });

    it('calls addEntry with ability_use on initial cast', async () => {
      setupFailedSave();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'ability_use',
          characterName: casterName,
          abilityName: 'Flesh to Stone',
          description: expect.stringContaining('casts Flesh to Stone'),
        }),
      );
    });
  });

  describe('initial cast - successful save', () => {
    function setupSuccessfulSave(
      existingConditions = [],
      existingEffects = [],
    ) {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue({ target: { name: targetName, type: 'monster' } });
      getRuntimeValue.mockImplementation((_entity, keyOrProp, _camp) => {
        if (keyOrProp === '_fleshToStone_Goblin') return null;
        if (keyOrProp === 'activeConditions') return existingConditions;
        if (keyOrProp === 'targetEffects') return existingEffects;
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'fts-success',
        promise: Promise.resolve({ success: true }),
      });
    }

    it('returns popup indicating successful save', async () => {
      setupSuccessfulSave();

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('succeeded on CON save');
    });

    it('applies speed_zero on successful save', async () => {
      setupSuccessfulSave();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        targetName,
        'activeConditions',
        expect.arrayContaining(['speed_zero']),
        campaignName,
      );
    });

    it('removes existing speed_zero before reapplying on success', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue({ target: { name: targetName, type: 'monster' } });
      getRuntimeValue.mockImplementation((_entity, keyOrProp, _camp) => {
        if (keyOrProp === '_fleshToStone_Goblin') return null;
        if (keyOrProp === 'activeConditions') return ['speed_zero', 'Frightened'];
        if (keyOrProp === 'targetEffects') return [];
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'fts-success-sz',
        promise: Promise.resolve({ success: true }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const condsCall = setRuntimeValue.mock.calls.find(
        (c) => c[1] === 'activeConditions',
      );
      const conds = condsCall[2];
      expect(conds.filter((c) => c === 'speed_zero').length).toBe(1);
      expect(conds).toContain('Frightened');
    });

    it('adds speed_zero expiration on successful save', async () => {
      setupSuccessfulSave();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addExpiration).toHaveBeenCalledWith(
        casterName,
        targetName,
        expect.arrayContaining([{ type: 'speed_zero' }]),
        campaignName,
        1,
      );
    });

    it('posts condition log entry for speed_zero on success', async () => {
      setupSuccessfulSave();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(postLogEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'condition',
          action: 'applied',
          characterName: targetName,
          condition: 'Speed 0',
          reason: 'Flesh to Stone (successful save)',
        }),
      );
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
          saveDc: 15,
          saveType: 'CON',
          success: true,
        }),
      );
    });

    it('does not apply Restrained on success', async () => {
      setupSuccessfulSave();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const restrainedCalls = setRuntimeValue.mock.calls.filter(
        (c) => c[1] === 'activeConditions',
      );
      for (const call of restrainedCalls) {
        expect(call[2]).not.toContain('restrained');
      }
    });

    it('does not set tracking key on success', async () => {
      setupSuccessfulSave();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const trackingCalls = setRuntimeValue.mock.calls.filter(
        (c) => c[1] === '_fleshToStone_Goblin',
      );
      expect(trackingCalls.length).toBe(0);
    });

    it('does not store target effects on success', async () => {
      setupSuccessfulSave();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const targetEffectsCalls = setRuntimeValue.mock.calls.filter(
        (c) => c[1] === 'targetEffects',
      );
      expect(targetEffectsCalls.length).toBe(0);
    });

    it('does not add restrained expiration on success', async () => {
      setupSuccessfulSave();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const restraintExpirations = addExpiration.mock.calls.filter(
        (call) =>
          call[2].some(
            (e) => e.type === 'condition' && e.condition === 'restrained',
          ),
      );
      expect(restraintExpirations.length).toBe(0);
    });
  });

  describe('repeat save delegation', () => {
    it('delegates to processFleshToStoneRepeatSave when tracking exists', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue({ target: { name: targetName, type: 'monster' } });
      getRuntimeValue.mockImplementation((_caster, key) => {
        if (key === '_fleshToStone_Goblin') return [0, 1];
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'fts-delegate',
        promise: Promise.resolve({ success: false }),
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('failed CON save');
      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName,
        saveType: 'CON',
        saveDc: 15,
        dcSuccess: 'none',
      });
    });

    it('uses buildSaveDc to compute save DC', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(18);
      resolveTarget.mockResolvedValue({ target: { name: targetName, type: 'monster' } });
      getRuntimeValue.mockImplementation((_caster, key) => {
        if (key === '_fleshToStone_Goblin') return [0, 0];
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'fts-dc-calc',
        promise: Promise.resolve({ success: true }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(buildSaveDc).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'flesh_to_stone', saveType: 'CON', saveDc: 15 }),
        expect.any(Object),
      );
    });
  });

  describe('tracking key normalization', () => {
    it('handles target names with spaces', async () => {
      const spaceyTarget = 'Iron Golem';
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue({ target: { name: spaceyTarget, type: 'monster' } });
      getRuntimeValue.mockImplementation((_caster, key) => {
        if (key === '_fleshToStone_Iron_Golem') return [0, 1];
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'fts-space',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: spaceyTarget,
        saveType: 'CON',
        saveDc: 15,
        dcSuccess: 'none',
      });
    });
  });
});
