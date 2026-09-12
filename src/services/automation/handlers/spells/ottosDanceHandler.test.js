// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  handle,
  processOttoDanceSuccessSave,
} from './ottosDanceHandler.js';

import {
  makePlayerStats,
  makeAction,
  makeActionNoAutomation,
  baseCombatContext,
  createFailedSaveSetup,
  createSuccessfulSaveSetup,
} from './__tests__/ottosDance.test-utils.js';

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

vi.mock('../../common/targetResolver.js', () => ({
  resolveTarget: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
  storeSpellLastAttack: vi.fn(),
  addTargetResult: vi.fn(() => Promise.resolve()),
}));

import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { addEntry } from '../../../ui/logService.js';
import { storeSpellLastAttack, addTargetResult } from '../../common/damageRollback.js';

const campaignName = 'test-campaign';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ottosDanceHandler.handle', () => {
  describe('combat context validation', () => {
    it('should return popup when no combat context exists', async () => {
      getCombatContext.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No creatures in combat');
    });

    it('should return popup when combat context has no creatures', async () => {
      getCombatContext.mockResolvedValue({ creatures: [] });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No creatures in combat');
    });

    it('should return popup when action has no automation property', async () => {
      getCombatContext.mockResolvedValue(null);

      const result = await handle(makeActionNoAutomation(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No creatures in combat');
    });
  });

  describe('target resolution', () => {
    it('should return popup when no target selected', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No target selected');
    });

    it('should call resolveTarget with campaignName and casterName', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      getRuntimeValue.mockReturnValue(null);
      createSaveListener.mockReturnValue({
        promptId: 'otto-prompt',
        promise: Promise.resolve({ success: true }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(resolveTarget).toHaveBeenCalledWith(campaignName, 'TestCaster');
    });
  });

  describe('initial cast - successful save', () => {
    it('should return popup describing target dancing when save succeeds', async () => {
      const setup = createSuccessfulSaveSetup(getCombatContext, buildSaveDc, resolveTarget, getRuntimeValue, createSaveListener);
      setup();

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('dances comically');
    });

    it('should call addEntry with condition applied on successful save', async () => {
      const setup = createSuccessfulSaveSetup(getCombatContext, buildSaveDc, resolveTarget, getRuntimeValue, createSaveListener);
      setup();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'condition',
          action: 'applied',
          condition: 'Speed 0',
        }),
      );
    });

    it('should add expiration for speed_zero on successful save', async () => {
      const setup = createSuccessfulSaveSetup(getCombatContext, buildSaveDc, resolveTarget, getRuntimeValue, createSaveListener);
      setup();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addExpiration).toHaveBeenCalledWith(
        'TestCaster',
        'Goblin',
        expect.arrayContaining([{ type: 'speed_zero', condition: 'speed_zero' }]),
        campaignName,
        undefined,
        'TestCaster',
      );
    });

    it('should call addEntry with ability_use on initial cast', async () => {
      const setup = createSuccessfulSaveSetup(getCombatContext, buildSaveDc, resolveTarget, getRuntimeValue, createSaveListener);
      setup();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'ability_use',
          characterName: 'TestCaster',
          abilityName: "Otto's Irresistible Dance",
        }),
      );
    });

    it('should call storeSpellLastAttack with correct parameters', async () => {
      const setup = createSuccessfulSaveSetup(getCombatContext, buildSaveDc, resolveTarget, getRuntimeValue, createSaveListener);
      setup();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(storeSpellLastAttack).toHaveBeenCalledWith(campaignName, {
        casterName: 'TestCaster',
        spellName: "Otto's Irresistible Dance",
        saveType: 'WIS',
        saveDc: 20,
        attackScope: 'single',
      });
    });

    it('should call addTargetResult with success details', async () => {
      const setup = createSuccessfulSaveSetup(getCombatContext, buildSaveDc, resolveTarget, getRuntimeValue, createSaveListener);
      setup();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveResult: 'success',
        roll: 0,
        total: 0,
        conditions: [],
        appliedDamage: 0,
      });
    });

    it('should include roll and total in addTargetResult when save result has them', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(20);
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      getRuntimeValue.mockReturnValue([]);
      createSaveListener.mockReturnValue({
        promptId: 'otto-success-save',
        promise: Promise.resolve({ success: true, roll: 18, total: 22 }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveResult: 'success',
        roll: 18,
        total: 22,
        conditions: [],
        appliedDamage: 0,
      });
    });

    it('should not throw when addEntry rejects on ability_use', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(20);
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      getRuntimeValue.mockReturnValue([]);
      addEntry.mockImplementation(() => Promise.reject(new Error('log error')));
      createSaveListener.mockReturnValue({
        promptId: 'otto-error',
        promise: Promise.resolve({ success: true }),
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('dances comically');
    });
  });

  describe('initial cast - failed save', () => {
    it('should apply charmed and speed_zero conditions on failed save', async () => {
      const setup = createFailedSaveSetup({
          getCombatContext,
          buildSaveDc,
          resolveTarget,
          getRuntimeValue,
          createSaveListener,
      });
      setup();

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Charmed');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        expect.arrayContaining(['charmed', 'speed_zero']),
        campaignName,
      );
    });

    it('should add expiration for charmed and speed_zero conditions', async () => {
      const setup = createFailedSaveSetup({
          getCombatContext,
          buildSaveDc,
          resolveTarget,
          getRuntimeValue,
          createSaveListener,
      });
      setup();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addExpiration).toHaveBeenCalledWith(
        'TestCaster',
        'Goblin',
        expect.any(Array),
        campaignName,
      );
    });

    it('should call addEntry on failed save', async () => {
      const setup = createFailedSaveSetup({
          getCombatContext,
          buildSaveDc,
          resolveTarget,
          getRuntimeValue,
          createSaveListener,
      });
      setup();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'condition',
          action: 'applied',
          characterName: 'Goblin',
          condition: 'Charmed, Speed 0',
        }),
      );
    });

    it('should call addEntry with save_result on failed save', async () => {
      const setup = createFailedSaveSetup({
          getCombatContext,
          buildSaveDc,
          resolveTarget,
          getRuntimeValue,
          createSaveListener,
      });
      setup();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'save_result',
          characterName: 'TestCaster',
          targetName: 'Goblin',
          saveDc: 15,
          saveType: 'WIS',
          success: false,
        }),
      );
    });

    it('should append to existing conditions on failed save', async () => {
      const setup = createFailedSaveSetup({
          getCombatContext,
          buildSaveDc,
          resolveTarget,
          getRuntimeValue,
          createSaveListener,
          existingConditions: ['frightened'],
      });
      setup();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        expect.arrayContaining(['frightened', 'charmed', 'speed_zero']),
        campaignName,
      );
    });

    it('should register the ottos_irresistible_dance targetEffect on failed save', async () => {
      const setup = createFailedSaveSetup({
          getCombatContext,
          buildSaveDc,
          resolveTarget,
          getRuntimeValue,
          createSaveListener,
      });
      setup();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const expectedDanceEffect = {
        target: 'Goblin',
        effect: 'ottos_irresistible_dance',
        source: 'TestCaster',
        dc: 15,
        duration: 'concentration',
        conditions: ['charmed', 'speed_zero'],
      };
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'campaign',
        'targetEffects',
        [expectedDanceEffect],
        campaignName,
      );
    });

    it('should replace an existing dance targetEffect from the same caster on failed save', async () => {
      const existingEffect = {
        target: 'Goblin',
        effect: 'ottos_irresistible_dance',
        source: 'TestCaster',
        dc: 12,
        duration: 'concentration',
        conditions: ['charmed'],
      };
      const setup = createFailedSaveSetup({
          getCombatContext,
          buildSaveDc,
          resolveTarget,
          getRuntimeValue,
          createSaveListener,
          existingConditions: [],
          existingEffects: [existingEffect],
      });
      setup();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'campaign',
        'targetEffects',
        [expect.objectContaining({ target: 'Goblin', effect: 'ottos_irresistible_dance', dc: 15 })],
        campaignName,
      );
    });

    it('should call addEntry with ability_use on initial cast', async () => {
      const setup = createFailedSaveSetup({
          getCombatContext,
          buildSaveDc,
          resolveTarget,
          getRuntimeValue,
          createSaveListener,
      });
      setup();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'ability_use',
          characterName: 'TestCaster',
          abilityName: "Otto's Irresistible Dance",
        }),
      );
    });

    it('should set activeConditionMeta on failed save', async () => {
      const setup = createFailedSaveSetup({
          getCombatContext,
          buildSaveDc,
          resolveTarget,
          getRuntimeValue,
          createSaveListener,
      });
      setup();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditionMeta',
        expect.objectContaining({
          charmed: { dc: 15, ability: 'wis' },
        }),
        campaignName,
      );
    });

    it('should merge with existing activeConditionMeta on failed save', async () => {
      const existingMeta = {
        frightened: { dc: 13, ability: 'wis' },
      };
      const setup = createFailedSaveSetup({
          getCombatContext,
          buildSaveDc,
          resolveTarget,
          getRuntimeValue,
          createSaveListener,
          existingConditions: [],
          existingEffects: [],
          existingMeta,
      });
      setup();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditionMeta',
        expect.objectContaining({
          charmed: { dc: 15, ability: 'wis' },
          frightened: { dc: 13, ability: 'wis' },
        }),
        campaignName,
      );
    });

    it('should handle failed save when activeConditions is null', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      getRuntimeValue.mockReturnValue(null);
      createSaveListener.mockReturnValue({
        promptId: 'otto-null-conds',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        expect.arrayContaining(['charmed', 'speed_zero']),
        campaignName,
      );
    });

    it('should handle failed save when activeConditions is not an array', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      getRuntimeValue.mockReturnValue('not-an-array');
      createSaveListener.mockReturnValue({
        promptId: 'otto-non-array',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        expect.arrayContaining(['charmed', 'speed_zero']),
        campaignName,
      );
    });

    it('should handle failed save when targetEffects is null', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      getRuntimeValue.mockImplementation((_caster, key, _camp) => {
        if (key === 'activeConditions') return [];
        if (key === 'targetEffects') return null;
        if (key === 'activeConditionMeta') return {};
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'otto-null-effects',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'campaign',
        'targetEffects',
        [expect.objectContaining({ target: 'Goblin', effect: 'ottos_irresistible_dance' })],
        campaignName,
      );
    });

    it('should handle failed save when activeConditionMeta is null', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      getRuntimeValue.mockImplementation((_caster, key, _camp) => {
        if (key === 'activeConditions') return [];
        if (key === 'targetEffects') return [];
        if (key === 'activeConditionMeta') return null;
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'otto-null-meta',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditionMeta',
        expect.objectContaining({
          charmed: { dc: 15, ability: 'wis' },
        }),
        campaignName,
      );
    });

    it('should include roll and total in addTargetResult when save result has them', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      getRuntimeValue.mockReturnValue([]);
      createSaveListener.mockReturnValue({
        promptId: 'otto-fail-roll',
        promise: Promise.resolve({ success: false, roll: 7, total: 11 }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveResult: 'failure',
        roll: 7,
        total: 11,
        conditions: ['charmed', 'speed_zero'],
        appliedDamage: 0,
      });
    });

    it('should not throw when addEntry rejects on save_result', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      getRuntimeValue.mockReturnValue([]);
      addEntry.mockImplementation(() => Promise.reject(new Error('log error')));
      createSaveListener.mockReturnValue({
        promptId: 'otto-save-error',
        promise: Promise.resolve({ success: false }),
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Charmed');
    });

    it('should not throw when addEntry rejects on condition log', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      getRuntimeValue.mockReturnValue([]);
      addEntry
        .mockImplementationOnce(() => Promise.resolve())
        .mockImplementationOnce(() => Promise.resolve())
        .mockImplementationOnce(() => Promise.reject(new Error('log error')));
      createSaveListener.mockReturnValue({
        promptId: 'otto-cond-error',
        promise: Promise.resolve({ success: false }),
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Charmed');
    });

    it('should filter out existing charmed and speed_zero before re-adding on failed save', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      getRuntimeValue.mockReturnValue(['charmed', 'speed_zero', 'frightened']);
      createSaveListener.mockReturnValue({
        promptId: 'otto-filter',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        ['frightened', 'charmed', 'speed_zero'],
        campaignName,
      );
    });
  });
});

describe('ottosDanceHandler.processOttoDanceSuccessSave', () => {
  it('should apply speed_zero condition', async () => {
    getRuntimeValue.mockReturnValue([]);

    const result = await processOttoDanceSuccessSave(
      'TestCaster',
      'Goblin',
      "Otto's Irresistible Dance",
      campaignName,
    );

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Goblin',
      'activeConditions',
      ['speed_zero'],
      campaignName,
    );
    expect(result.payload.description).toContain('dances comically');
  });

  it('should add expiration for speed_zero', async () => {
    getRuntimeValue.mockReturnValue([]);

    await processOttoDanceSuccessSave(
      'TestCaster',
      'Goblin',
      "Otto's Irresistible Dance",
      campaignName,
    );

    expect(addExpiration).toHaveBeenCalledWith(
      'TestCaster',
      'Goblin',
      expect.arrayContaining([{ type: 'speed_zero', condition: 'speed_zero' }]),
      campaignName,
      undefined,
      'TestCaster',
    );
  });

  it('should call addEntry', async () => {
    getRuntimeValue.mockReturnValue([]);

    await processOttoDanceSuccessSave(
      'TestCaster',
      'Goblin',
      "Otto's Irresistible Dance",
      campaignName,
    );

    expect(addEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({
        type: 'condition',
        action: 'applied',
        characterName: 'Goblin',
        condition: 'Speed 0',
      }),
    );
  });

  it('should deduplicate speed_zero when already present', async () => {
    getRuntimeValue.mockReturnValue(['speed_zero', 'frightened']);

    await processOttoDanceSuccessSave(
      'TestCaster',
      'Goblin',
      "Otto's Irresistible Dance",
      campaignName,
    );

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Goblin',
      'activeConditions',
      ['frightened', 'speed_zero'],
      campaignName,
    );
  });

  it('should handle non-array activeConditions from runtime', async () => {
    getRuntimeValue.mockReturnValue('not-an-array');

    await processOttoDanceSuccessSave(
      'TestCaster',
      'Goblin',
      "Otto's Irresistible Dance",
      campaignName,
    );

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Goblin',
      'activeConditions',
      ['speed_zero'],
      campaignName,
    );
  });

  it('should not throw when addEntry rejects', async () => {
    getRuntimeValue.mockReturnValue([]);
    addEntry.mockImplementation(() => Promise.reject(new Error('log error')));

    const result = await processOttoDanceSuccessSave(
      'TestCaster',
      'Goblin',
      "Otto's Irresistible Dance",
      campaignName,
    );

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('dances comically');
  });

  it('should filter out existing speed_zero (case-insensitive) before re-adding', async () => {
    getRuntimeValue.mockReturnValue(['SPEED_ZERO', 'charmed']);

    await processOttoDanceSuccessSave(
      'TestCaster',
      'Goblin',
      "Otto's Irresistible Dance",
      campaignName,
    );

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Goblin',
      'activeConditions',
      ['charmed', 'speed_zero'],
      campaignName,
    );
  });
});
