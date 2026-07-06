// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn((auto) => auto.saveDc || 15),
  createSaveListener: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));



vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../common/targetResolver.js', () => ({
  resolveTarget: vi.fn(),
}));

import { handle, processHoldMonsterRepeatSave } from './holdMonsterHandler.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

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
  });
});

// ─── handle ───

describe('holdMonsterHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('combat context validation', () => {
    it('returns popup when combat context is missing creatures', async () => {
      getCombatContext.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
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
  });
});
