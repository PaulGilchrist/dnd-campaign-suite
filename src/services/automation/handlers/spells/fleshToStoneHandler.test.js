// @maintained-by-ai
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

vi.mock('../../../combat/conditions/savePromptService.js', () => ({
  sendFleshToStonePrompt: vi.fn(),
}));

import { handle } from './fleshToStoneHandler.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { sendFleshToStonePrompt } from '../../../combat/conditions/savePromptService.js';

const campaignName = 'test-campaign';
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

const constructCombatContext = {
  ...baseCombatContext,
  creatures: [
    { name: targetName, type: 'npc', monsterType: 'construct', currentHp: 5, maxHp: 7 },
    { name: 'Orc', type: 'monster', currentHp: 15, maxHp: 22 },
    { name: casterName, gridX: 5, gridY: 10 },
  ],
};

// Find the array actually written by the handler's setRuntimeValue call,
// so replace/dedup pins can assert on the exact write, not arrayContaining
// (which passes even with stale or duplicate entries present).
function findWritten(entity, key) {
  const call = setRuntimeValue.mock.calls.find(
    ([writtenEntity, writtenKey]) => writtenEntity === entity && writtenKey === key,
  );
  expect(call, `setRuntimeValue('${entity}', '${key}', ...) was not called`).toBeTruthy();
  return call[2];
}

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

    it('returns popup when creatures array is empty', async () => {
      getCombatContext.mockResolvedValue({ creatures: [] });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No creatures in combat');
    });
  });

  describe('target resolution', () => {
    it('returns popup when no target selected (resolveTarget returns null)', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No target selected');
    });
  });

  describe('construct handling', () => {
    function setupConstruct(existingConditions = []) {
      getCombatContext.mockResolvedValue(constructCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue({ target: { name: targetName, type: 'npc', monsterType: 'construct' } });
      getRuntimeValue.mockImplementation((_entity, keyOrProp, _camp) => {
        if (keyOrProp === '_fleshToStone_Goblin') return null;
        if (keyOrProp === 'activeConditions') return existingConditions;
        return [];
      });
    }

    it('auto-succeeds with popup and logs ability_use for constructs', async () => {
      setupConstruct();

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Construct');
      expect(result.payload.description).toContain('automatically succeeds');
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

    it('applies and expires speed_zero for constructs', async () => {
      setupConstruct();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        targetName,
        'activeConditions',
        expect.arrayContaining(['speed_zero']),
        campaignName,
      );
      expect(addExpiration).toHaveBeenCalledWith({ attackerName: casterName, targetName, effects: expect.arrayContaining([{ type: 'speed_zero' }]), campaignName, rounds: undefined, expireOnCreatureName: casterName });
    });

    it('does not create save listener or send recurring prompt for constructs', async () => {
      setupConstruct();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(createSaveListener).not.toHaveBeenCalled();
      expect(sendFleshToStonePrompt).not.toHaveBeenCalled();
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

    it('deduplicates restrained condition when already present', async () => {
      setupFailedSave(['restrained']);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(findWritten(targetName, 'activeConditions')).toEqual(['restrained']);
    });

    it('adds restrained expiration on failed save', async () => {
      setupFailedSave();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addExpiration).toHaveBeenCalledWith({ attackerName: casterName, targetName, effects: expect.arrayContaining([
          { type: 'condition', condition: 'restrained' },
        ]), campaignName });
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

    it('replaces existing flesh_to_stone targetEffect for same target+source', async () => {
      const existingEffects = [
        { target: targetName, effect: 'flesh_to_stone', source: casterName, dc: 13 },
      ];
      setupFailedSave([], existingEffects);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      // arrayContaining would also pass if the stale dc:13 effect were pushed
      // alongside the new one — pin the exact written array instead.
      const written = findWritten('campaign', 'targetEffects');
      expect(written).toHaveLength(1);
      expect(written[0]).toEqual({
        target: targetName,
        effect: 'flesh_to_stone',
        source: casterName,
        dc: 15,
      });
    });

    it('stores activeConditionMeta with dc on failed save', async () => {
      setupFailedSave();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        targetName,
        'activeConditionMeta',
        expect.objectContaining({
          restrained: expect.objectContaining({
            dc: 15,
            ability: 'con',
          }),
        }),
        campaignName,
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

    it('applies speed_zero and deduplicates when already present', async () => {
      setupSuccessfulSave(['speed_zero']);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      // Exact-write pin: presence + single copy of speed_zero in one shot.
      expect(findWritten(targetName, 'activeConditions')).toEqual(['speed_zero']);
    });

    it('posts condition log entry for speed_zero on success', async () => {
      setupSuccessfulSave();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(
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

    it('does NOT set up recurring save tracking on successful save', async () => {
      setupSuccessfulSave();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(sendFleshToStonePrompt).not.toHaveBeenCalled();
    });
  });

  describe('recurring save tracking', () => {
    function setupFailedSaveWithTracking() {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue({ target: { name: targetName, type: 'monster' } });
      getRuntimeValue.mockImplementation((_entity, keyOrProp, _camp) => {
        if (keyOrProp === 'activeConditions') return [];
        if (keyOrProp === 'targetEffects') return [];
        return null;
      });
      createSaveListener.mockReturnValue({
        promptId: 'fts-fail',
        promise: Promise.resolve({ success: false }),
      });
    }

    it('sets up recurring save tracking on failed save', async () => {
      setupFailedSaveWithTracking();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'campaign',
        '_fleshToStone_Goblin',
        expect.objectContaining({
          successes: 0,
          failures: 0,
          dc: 15,
          casterName,
        }),
        campaignName,
      );
    });

    it('sends Flesh to Stone prompt on failed save', async () => {
      setupFailedSaveWithTracking();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(sendFleshToStonePrompt).toHaveBeenCalledWith(campaignName, {
        targetName,
        dc: 15,
        casterName,
      });
    });
  });

  describe('error handling', () => {
    it('survives addEntry rejections on the failed-save path (all log sites)', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue({ target: { name: targetName, type: 'monster' } });
      getRuntimeValue.mockImplementation((_entity, keyOrProp, _camp) => {
        if (keyOrProp === 'activeConditions') return [];
        if (keyOrProp === 'targetEffects') return [];
        return null;
      });
      createSaveListener.mockReturnValue({
        promptId: 'fts-err',
        promise: Promise.resolve({ success: false }),
      });
      // Reject every addEntry call — this lane hits all three .catch sites
      // (ability_use, save_result, condition applied) in one run.
      addEntry.mockRejectedValue(new Error('log error'));

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Restrained');
    });
  });

  describe('metamagic and edge cases', () => {
    it('passes disadvantage to save listener when metamagicHeighten is set', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue({ target: { name: targetName, type: 'monster' } });
      getRuntimeValue.mockImplementation((_entity, keyOrProp, _camp) => {
        if (keyOrProp === 'activeConditions') return [];
        if (keyOrProp === 'targetEffects') return [];
        return null;
      });
      createSaveListener.mockReturnValue({
        promptId: 'fts-disadv',
        promise: Promise.resolve({ success: false }),
      });

      const actionWithHeighten = {
        name: 'Flesh to Stone',
        automation: { type: 'flesh_to_stone', saveType: 'CON', saveDc: 15 },
        metaCtx: { metamagicHeighten: true },
      };

      await handle(actionWithHeighten, makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          disadvantage: true,
        }),
      );
    });

    it('stores spell last attack with correct metadata', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue({ target: { name: targetName, type: 'monster' } });
      getRuntimeValue.mockImplementation((_entity, keyOrProp, _camp) => {
        if (keyOrProp === 'activeConditions') return [];
        if (keyOrProp === 'targetEffects') return [];
        return null;
      });
      createSaveListener.mockReturnValue({
        promptId: 'fts-metadata',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'campaign',
        'lastAttack',
        expect.objectContaining({
          attackerName: casterName,
          attackName: 'Flesh to Stone',
          rollType: 'spell-save',
          saveType: 'CON',
          saveDc: 15,
          attackScope: 'single',
        }),
        campaignName,
      );
    });
  });

});
