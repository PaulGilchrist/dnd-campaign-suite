// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  handle,
  processOttoDanceSuccessSave,
} from './ottosDanceHandler.js';

import {
  makePlayerStats,
  makeAction,
  setupCast,
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

const castSetup = (opts = {}) => setupCast({
  getCombatContext,
  buildSaveDc,
  resolveTarget,
  getRuntimeValue,
  createSaveListener,
  ...opts,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ottosDanceHandler.handle', () => {
  it('returns popup when combat context is missing or has no creatures', async () => {
    for (const combatContext of [null, { creatures: [] }]) {
      getCombatContext.mockResolvedValue(combatContext);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No creatures in combat');
    }
  });

  it('returns popup when no target selected', async () => {
    castSetup();
    resolveTarget.mockResolvedValue(null);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('No target selected');
  });

  it('builds WIS save prompt for resolved target, links ability_use log, Heightened adds disadvantage', async () => {
    castSetup({ promptId: 'otto-prompt' });

    await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(resolveTarget).toHaveBeenCalledWith(campaignName, 'TestCaster');
    expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
      targetName: 'Goblin',
      saveType: 'WIS',
      saveDc: 15,
      dcSuccess: 'none',
      disadvantage: false,
    });
    expect(addEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({
        type: 'ability_use',
        characterName: 'TestCaster',
        abilityName: "Otto's Irresistible Dance",
        promptId: 'otto-prompt',
      }),
    );

    castSetup({ dc: 20 });
    await handle(makeAction({}, { metaCtx: { metamagicHeighten: true } }), makePlayerStats(), campaignName, null);

    expect(createSaveListener).toHaveBeenLastCalledWith(campaignName, {
      targetName: 'Goblin',
      saveType: 'WIS',
      saveDc: 20,
      dcSuccess: 'none',
      disadvantage: true,
    });
  });

  it('stores spell last attack for rollback before the save resolves', async () => {
    castSetup({ dc: 20 });

    await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(storeSpellLastAttack).toHaveBeenCalledWith(campaignName, {
      casterName: 'TestCaster',
      spellName: "Otto's Irresistible Dance",
      saveType: 'WIS',
      saveDc: 20,
      attackScope: 'single',
    });
  });

  describe('successful save', () => {
    it('records save result and returns dances-comically popup, defaulting missing roll/total to 0', async () => {
      castSetup({ saveResult: { success: true, roll: 18, total: 22 } });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('dances comically');
      expect(addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveResult: 'success',
        roll: 18,
        total: 22,
        conditions: [],
        appliedDamage: 0,
      });

      castSetup({ saveResult: { success: true } });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addTargetResult).toHaveBeenLastCalledWith(campaignName, {
        targetName: 'Goblin',
        saveResult: 'success',
        roll: 0,
        total: 0,
        conditions: [],
        appliedDamage: 0,
      });
    });

    it('still returns popup and applies speed_zero when every log write rejects', async () => {
      castSetup({ saveResult: { success: true } });
      addEntry
        .mockRejectedValueOnce(new Error('log error'))
        .mockRejectedValueOnce(new Error('log error'));

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('dances comically');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        ['speed_zero'],
        campaignName,
      );
    });
  });

  describe('failed save', () => {
    it('applies Charmed + speed_zero (deduped, preserving others) with rules-text popup', async () => {
      castSetup({
        saveResult: { success: false },
        activeConditions: ['charmed', 'speed_zero', 'frightened'],
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toBe(
        "Goblin failed WIS save and is Charmed with Speed 0. While Charmed, the target has Disadvantage on Dexterity saving throws and attack rolls, and other creatures have Advantage on attack rolls against it.",
      );
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        ['frightened', 'charmed', 'speed_zero'],
        campaignName,
      );
      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'condition',
          action: 'applied',
          characterName: 'Goblin',
          condition: 'Charmed, Speed 0',
          reason: "Otto's Irresistible Dance",
        }),
      );
    });

    it('merges charmed meta into existing activeConditionMeta', async () => {
      castSetup({
        saveResult: { success: false },
        activeConditionMeta: { frightened: { dc: 13, ability: 'wis' } },
      });

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

    it('registers the concentration dance targetEffect, replacing an existing effect from the same caster', async () => {
      const danceEffect = {
        target: 'Goblin',
        effect: 'ottos_irresistible_dance',
        source: 'TestCaster',
        dc: 15,
        duration: 'concentration',
        conditions: ['charmed', 'speed_zero'],
      };

      castSetup({ saveResult: { success: false } });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'campaign',
        'targetEffects',
        [danceEffect],
        campaignName,
      );

      castSetup({
        saveResult: { success: false },
        targetEffects: [{ ...danceEffect, dc: 12, conditions: ['charmed'] }],
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenLastCalledWith(
        'campaign',
        'targetEffects',
        [danceEffect],
        campaignName,
      );
    });

    it('tolerates null and non-array stored collections', async () => {
      castSetup({
        saveResult: { success: false },
        activeConditions: null,
        targetEffects: null,
        activeConditionMeta: null,
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        ['charmed', 'speed_zero'],
        campaignName,
      );
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'campaign',
        'targetEffects',
        [expect.objectContaining({ target: 'Goblin', effect: 'ottos_irresistible_dance' })],
        campaignName,
      );
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditionMeta',
        expect.objectContaining({ charmed: { dc: 15, ability: 'wis' } }),
        campaignName,
      );

      castSetup({ saveResult: { success: false }, activeConditions: 'not-an-array' });
      setRuntimeValue.mockClear();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        ['charmed', 'speed_zero'],
        campaignName,
      );
    });

    it('logs save_result with DC and roll outcome, defaulting missing roll/total to 0', async () => {
      castSetup({ saveResult: { success: false, roll: 7, total: 11 } });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'save_result',
          rollType: 'save-ottos-dance',
          characterName: 'TestCaster',
          targetName: 'Goblin',
          saveDc: 15,
          saveType: 'WIS',
          success: false,
        }),
      );
      expect(addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveResult: 'failure',
        roll: 7,
        total: 11,
        conditions: ['charmed', 'speed_zero'],
        appliedDamage: 0,
      });

      castSetup({ saveResult: { success: false } });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addTargetResult).toHaveBeenLastCalledWith(campaignName, {
        targetName: 'Goblin',
        saveResult: 'failure',
        roll: 0,
        total: 0,
        conditions: ['charmed', 'speed_zero'],
        appliedDamage: 0,
      });
    });

    it('adds expiration for charmed and speed_zero effects', async () => {
      castSetup({ saveResult: { success: false } });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addExpiration).toHaveBeenCalledWith({
        attackerName: 'TestCaster',
        targetName: 'Goblin',
        effects: [
          { type: 'charmed', condition: 'charmed' },
          { type: 'speed_zero', condition: 'speed_zero' },
        ],
        campaignName,
      });
    });

    it('returns Charmed popup even when every log write rejects', async () => {
      castSetup({ saveResult: { success: false } });
      addEntry
        .mockRejectedValueOnce(new Error('log error'))
        .mockRejectedValueOnce(new Error('log error'))
        .mockRejectedValueOnce(new Error('log error'));

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Charmed');
    });
  });
});

describe('ottosDanceHandler.processOttoDanceSuccessSave', () => {
  const run = () => processOttoDanceSuccessSave(
    'TestCaster',
    'Goblin',
    "Otto's Irresistible Dance",
    campaignName,
  );

  it('re-adds speed_zero case-insensitively, preserving other conditions, with full popup copy', async () => {
    getRuntimeValue.mockReturnValue(['SPEED_ZERO', 'frightened']);

    const result = await run();

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Goblin',
      'activeConditions',
      ['frightened', 'speed_zero'],
      campaignName,
    );
    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe(
      'Goblin succeeded on WIS save and dances comically until the end of its next turn, spending all movement in place.',
    );
  });

  it('tolerates non-array activeConditions from runtime', async () => {
    getRuntimeValue.mockReturnValue('not-an-array');

    await run();

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Goblin',
      'activeConditions',
      ['speed_zero'],
      campaignName,
    );
  });

  it('adds expiration keyed to the caster', async () => {
    getRuntimeValue.mockReturnValue([]);

    await run();

    expect(addExpiration).toHaveBeenCalledWith({
      attackerName: 'TestCaster',
      targetName: 'Goblin',
      effects: [{ type: 'speed_zero', condition: 'speed_zero' }],
      campaignName,
      rounds: undefined,
      expireOnCreatureName: 'TestCaster',
    });
  });

  it('logs Speed 0 condition applied', async () => {
    getRuntimeValue.mockReturnValue([]);

    await run();

    expect(addEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({
        type: 'condition',
        action: 'applied',
        characterName: 'Goblin',
        condition: 'Speed 0',
        reason: "Otto's Irresistible Dance (successful save)",
      }),
    );
  });

  it('does not throw when addEntry rejects', async () => {
    getRuntimeValue.mockReturnValue([]);
    addEntry.mockRejectedValueOnce(new Error('log error'));

    const result = await run();

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('dances comically');
  });
});
