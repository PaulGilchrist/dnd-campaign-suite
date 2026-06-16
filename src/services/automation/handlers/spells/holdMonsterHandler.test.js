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

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
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
    { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
    { name: 'Orc', type: 'monster', currentHp: 15, maxHp: 22 },
    { name: 'TestCaster', gridX: 5, gridY: 10 },
  ],
  players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
  placedItems: [],
};

describe('holdMonsterHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
        promptId: 'hold-prompt-resolve',
        promise: Promise.resolve({ success: true }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(resolveTarget).toHaveBeenCalledWith(campaignName, 'TestCaster');
    });
  });

  describe('repeat save detection', () => {
    it('should call processHoldMonsterRepeatSave when tracking exists', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      getRuntimeValue.mockImplementation((caster, key) => {
        if (key === '_holdMonster_Goblin') return true;
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'hold-repeat-prompt',
        promise: Promise.resolve({ success: false }),
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Goblin failed WIS save');
    });
  });

  describe('initial cast - failed save', () => {
    function setupFailedSave() {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      getRuntimeValue.mockImplementation((caster, key) => {
        if (key === '_holdMonster_Goblin') return null;
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'hold-prompt',
        promise: Promise.resolve({ success: false }),
      });
    }

    it('should apply Paralyzed condition on failed save', async () => {
      setupFailedSave();
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', expect.arrayContaining(['paralyzed']), campaignName);
      expect(result.payload.description).toContain('Paralyzed');
    });

    it('should set tracking for repeat saves on failed save', async () => {
      setupFailedSave();
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(setRuntimeValue).toHaveBeenCalledWith('TestCaster', '_holdMonster_Goblin', true, campaignName);
    });

    it('should add expiration for paralyzed condition', async () => {
      setupFailedSave();
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(addExpiration).toHaveBeenCalledWith('TestCaster', 'Goblin', expect.any(Array), campaignName, 10);
    });

    it('should store target effect for repeat saves', async () => {
      setupFailedSave();
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(setRuntimeValue).toHaveBeenCalledWith(
        campaignName,
        'targetEffects',
        expect.arrayContaining([
          expect.objectContaining({
            target: 'Goblin',
            effect: 'hold_monster_repeat_save',
            source: 'TestCaster',
          }),
        ]),
        campaignName,
      );
    });

    it('should call postLogEntry on failed save', async () => {
      setupFailedSave();
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(postLogEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'condition',
          action: 'applied',
          characterName: 'Goblin',
          condition: 'Paralyzed',
        }),
      );
    });

    it('should update existing hold effect instead of duplicating', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });

      let readCount = 0;
      getRuntimeValue.mockImplementation((caster, key, prop) => {
        if (key === '_holdMonster_Goblin') return null;
        if (prop === 'activeConditions') return [];
        if (prop === 'targetEffects') {
          readCount++;
          if (readCount === 1) {
            return [{ target: 'Goblin', effect: 'hold_monster_repeat_save', source: 'OldCaster' }];
          }
          return [{ target: 'Goblin', effect: 'hold_monster_repeat_save', source: 'TestCaster' }];
        }
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'hold-prompt-update',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const targetEffectsCalls = setRuntimeValue.mock.calls.filter(c => c[1] === 'targetEffects');
      expect(targetEffectsCalls.length).toBe(1);
      const effects = targetEffectsCalls[0][2];
      expect(effects.length).toBe(1);
      expect(effects[0].source).toBe('TestCaster');
    });
  });

  describe('initial cast - successful save', () => {
    it('should return popup when target succeeds save', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(20);
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      createSaveListener.mockReturnValue({
        promptId: 'hold-prompt-success',
        promise: Promise.resolve({ success: true }),
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('succeeded on WIS save');
    });

    it('should call addEntry with save_result on success', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(20);
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      createSaveListener.mockReturnValue({
        promptId: 'hold-prompt-save',
        promise: Promise.resolve({ success: true }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'save_result',
        targetName: 'Goblin',
        success: true,
      }));
    });
  });
});

describe('holdMonsterHandler.processHoldMonsterRepeatSave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null when no tracking exists', async () => {
    getRuntimeValue.mockReturnValue(null);
    const result = await processHoldMonsterRepeatSave('TestCaster', 'Goblin', 15, 'Hold Monster', campaignName);
    expect(result).toBeNull();
  });

  it('should create save listener with WIS save type', async () => {
    getRuntimeValue.mockReturnValue(true);
    createSaveListener.mockReturnValue({
      promptId: 'hold-repeat-prompt',
      promise: Promise.resolve({ success: true }),
    });

    await processHoldMonsterRepeatSave('TestCaster', 'Goblin', 15, 'Hold Monster', campaignName);

    expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
      targetName: 'Goblin',
      saveType: 'WIS',
      saveDc: 15,
      dcSuccess: 'none',
    });
  });

  describe('successful repeat save', () => {
    it('should remove Paralyzed condition', async () => {
      getRuntimeValue.mockImplementation((target, prop) => {
        if (prop === 'activeConditions') return ['Paralyzed', 'Frightened'];
        return true;
      });
      createSaveListener.mockReturnValue({
        promptId: 'hold-repeat-success',
        promise: Promise.resolve({ success: true }),
      });

      const result = await processHoldMonsterRepeatSave('TestCaster', 'Goblin', 15, 'Hold Monster', campaignName);

      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', ['Frightened'], campaignName);
      expect(result.payload.description).toContain('succeeded on WIS save');
    });

    it('should clear tracking', async () => {
      getRuntimeValue.mockImplementation((caster, key) => {
        if (key === '_holdMonster_Goblin') return true;
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'hold-repeat-track',
        promise: Promise.resolve({ success: true }),
      });

      await processHoldMonsterRepeatSave('TestCaster', 'Goblin', 15, 'Hold Monster', campaignName);

      expect(setRuntimeValue).toHaveBeenCalledWith('TestCaster', '_holdMonster_Goblin', null, campaignName);
    });

    it('should clean up target effect', async () => {
      getRuntimeValue.mockImplementation((key, prop) => {
        if (prop === 'activeConditions') return [];
        if (prop === 'targetEffects') return [{ target: 'Goblin', effect: 'hold_monster_repeat_save', source: 'TestCaster' }];
        return true;
      });
      createSaveListener.mockReturnValue({
        promptId: 'hold-repeat-clean',
        promise: Promise.resolve({ success: true }),
      });

      await processHoldMonsterRepeatSave('TestCaster', 'Goblin', 15, 'Hold Monster', campaignName);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        campaignName,
        'targetEffects',
        expect.not.arrayContaining([
          expect.objectContaining({ target: 'Goblin', effect: 'hold_monster_repeat_save', source: 'TestCaster' }),
        ]),
        campaignName,
      );
    });

    it('should call postLogEntry for condition removal', async () => {
      getRuntimeValue.mockImplementation((target, prop) => {
        if (prop === 'activeConditions') return ['Paralyzed'];
        return true;
      });
      createSaveListener.mockReturnValue({
        promptId: 'hold-repeat-log',
        promise: Promise.resolve({ success: true }),
      });

      await processHoldMonsterRepeatSave('TestCaster', 'Goblin', 15, 'Hold Monster', campaignName);

      expect(postLogEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'condition',
          action: 'removed',
          condition: 'Paralyzed',
        }),
      );
    });
  });

  describe('failed repeat save', () => {
    it('should return popup indicating spell continues', async () => {
      getRuntimeValue.mockReturnValue(true);
      createSaveListener.mockReturnValue({
        promptId: 'hold-repeat-fail',
        promise: Promise.resolve({ success: false }),
      });

      const result = await processHoldMonsterRepeatSave('TestCaster', 'Goblin', 15, 'Hold Monster', campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('failed WIS save');
      expect(result.payload.description).toContain('continues');
    });

    it('should call addEntry with save_result on failed repeat', async () => {
      getRuntimeValue.mockReturnValue(true);
      createSaveListener.mockReturnValue({
        promptId: 'hold-repeat-fail-entry',
        promise: Promise.resolve({ success: false }),
      });

      await processHoldMonsterRepeatSave('TestCaster', 'Goblin', 15, 'Hold Monster', campaignName);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'save_result',
        success: false,
      }));
    });
  });
});
