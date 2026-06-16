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

vi.mock('../../common/targetResolver.js', () => ({
  resolveTarget: vi.fn(),
}));

import { handle, processPowerWordStunRepeatSave } from './powerWordStunHandler.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { postLogEntry } from '../../../shared/logPoster.js';

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
    name: 'Power Word Stun',
    automation: { type: 'power_word_stun', saveDc: 15, ...automation },
  };
}

const baseCombatContext = {
  creatures: [
    { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
    { name: 'Dragon', type: 'monster', currentHp: 300, maxHp: 500 },
    { name: 'TestCaster', gridX: 5, gridY: 10 },
  ],
  players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
  placedItems: [],
};

describe('powerWordStunHandler.handle', () => {
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
        promptId: 'pws-prompt',
        promise: Promise.resolve({ success: true }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(resolveTarget).toHaveBeenCalledWith(campaignName, 'TestCaster');
    });
  });

  describe('repeat save detection', () => {
    it('should call processPowerWordStunRepeatSave when tracking exists', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      getRuntimeValue.mockImplementation((caster, key) => {
        if (key === '_powerWordStun_Goblin') return true;
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'pws-repeat',
        promise: Promise.resolve({ success: false }),
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Goblin failed CON save');
    });
  });

  describe('target with 150 HP or fewer', () => {
    function setupLowHp() {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      getRuntimeValue.mockImplementation((caster, key) => {
        if (key === '_powerWordStun_Goblin') return null;
        return [];
      });
    }

    it('should apply Stunned condition', async () => {
      setupLowHp();
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        expect.arrayContaining(['stunned']),
        campaignName,
      );
      expect(result.payload.description).toContain('Stunned');
    });

    it('should set tracking for repeat saves', async () => {
      setupLowHp();
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith('TestCaster', '_powerWordStun_Goblin', true, campaignName);
    });

    it('should store target effect for repeat saves', async () => {
      setupLowHp();
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        campaignName,
        'targetEffects',
        expect.arrayContaining([
          expect.objectContaining({
            target: 'Goblin',
            effect: 'power_word_stun_repeat_save',
            source: 'TestCaster',
          }),
        ]),
        campaignName,
      );
    });

    it('should call postLogEntry with condition applied', async () => {
      setupLowHp();
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(postLogEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'condition',
          action: 'applied',
          characterName: 'Goblin',
          condition: 'Stunned',
        }),
      );
    });

    it('should include HP in description', async () => {
      setupLowHp();
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('5 HP');
      expect(result.payload.description).toContain('150 or fewer');
    });
  });

  describe('target with more than 150 HP', () => {
    function setupHighHp() {
      const highHpCombat = {
        creatures: [
          { name: 'Dragon', type: 'monster', currentHp: 300, maxHp: 500 },
          { name: 'TestCaster', gridX: 5, gridY: 10 },
        ],
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
        placedItems: [],
      };
      getCombatContext.mockResolvedValue(highHpCombat);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue({ target: { name: 'Dragon' } });
      getRuntimeValue.mockImplementation((caster, key) => {
        if (key === '_powerWordStun_Dragon') return null;
        return [];
      });
    }

    it('should apply speed_zero instead of Stunned', async () => {
      setupHighHp();
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Dragon',
        'activeConditions',
        expect.arrayContaining(['speed_zero']),
        campaignName,
      );
      expect(result.payload.description).toContain('Speed is 0');
      expect(result.payload.description).toContain('more than 150');
    });

    it('should call postLogEntry for speed_zero', async () => {
      setupHighHp();
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(postLogEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'condition',
          action: 'applied',
          characterName: 'Dragon',
          condition: 'Speed 0',
        }),
      );
    });
  });

  describe('addEntry calls', () => {
    it('should call addEntry with save_result for stunned target', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      getRuntimeValue.mockReturnValue([]);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'save_result',
        rollType: 'save-power-word-stun',
        targetName: 'Goblin',
        success: false,
      }));
    });
  });
});

describe('powerWordStunHandler.processPowerWordStunRepeatSave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null when no tracking exists', async () => {
    getRuntimeValue.mockReturnValue(null);
    const result = await processPowerWordStunRepeatSave('TestCaster', 'Goblin', 15, 'Power Word Stun', campaignName);
    expect(result).toBeNull();
  });

  it('should create save listener with CON save type', async () => {
    getRuntimeValue.mockImplementation((caster, key) => {
      if (key === '_powerWordStun_Goblin') return true;
      return [];
    });
    createSaveListener.mockReturnValue({
      promptId: 'pws-repeat-listener',
      promise: Promise.resolve({ success: true }),
    });

    await processPowerWordStunRepeatSave('TestCaster', 'Goblin', 15, 'Power Word Stun', campaignName);

    expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
      targetName: 'Goblin',
      saveType: 'CON',
      saveDc: 15,
      dcSuccess: 'none',
    });
  });

  describe('successful repeat save', () => {
    it('should remove Stunned condition', async () => {
      getRuntimeValue.mockImplementation((target, prop) => {
        if (prop === 'activeConditions') return ['Stunned', 'Frightened'];
        return true;
      });
      createSaveListener.mockReturnValue({
        promptId: 'pws-repeat-success',
        promise: Promise.resolve({ success: true }),
      });

      const result = await processPowerWordStunRepeatSave('TestCaster', 'Goblin', 15, 'Power Word Stun', campaignName);

      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', ['Frightened'], campaignName);
      expect(result.payload.description).toContain('succeeded on CON save');
    });

    it('should clear tracking', async () => {
      getRuntimeValue.mockImplementation((caster, key) => {
        if (key === '_powerWordStun_Goblin') return true;
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'pws-repeat-track',
        promise: Promise.resolve({ success: true }),
      });

      await processPowerWordStunRepeatSave('TestCaster', 'Goblin', 15, 'Power Word Stun', campaignName);

      expect(setRuntimeValue).toHaveBeenCalledWith('TestCaster', '_powerWordStun_Goblin', null, campaignName);
    });

    it('should clean up target effect', async () => {
      getRuntimeValue.mockImplementation((caster, key, prop) => {
        if (key === '_powerWordStun_Goblin') return true;
        if (prop === 'targetEffects') return [{ target: 'Goblin', effect: 'power_word_stun_repeat_save', source: 'TestCaster' }];
        return true;
      });
      createSaveListener.mockReturnValue({
        promptId: 'pws-repeat-clean',
        promise: Promise.resolve({ success: true }),
      });

      await processPowerWordStunRepeatSave('TestCaster', 'Goblin', 15, 'Power Word Stun', campaignName);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        campaignName,
        'targetEffects',
        expect.not.arrayContaining([
          expect.objectContaining({ target: 'Goblin', effect: 'power_word_stun_repeat_save', source: 'TestCaster' }),
        ]),
        campaignName,
      );
    });

    it('should call postLogEntry for condition removal', async () => {
      getRuntimeValue.mockImplementation((target, prop) => {
        if (prop === 'activeConditions') return ['Stunned'];
        return true;
      });
      createSaveListener.mockReturnValue({
        promptId: 'pws-repeat-log',
        promise: Promise.resolve({ success: true }),
      });

      await processPowerWordStunRepeatSave('TestCaster', 'Goblin', 15, 'Power Word Stun', campaignName);

      expect(postLogEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'condition',
          action: 'removed',
          condition: 'Stunned',
        }),
      );
    });
  });

  describe('failed repeat save', () => {
    it('should return popup indicating spell continues', async () => {
      getRuntimeValue.mockImplementation((caster, key) => {
        if (key === '_powerWordStun_Goblin') return true;
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'pws-repeat-fail',
        promise: Promise.resolve({ success: false }),
      });

      const result = await processPowerWordStunRepeatSave('TestCaster', 'Goblin', 15, 'Power Word Stun', campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('failed CON save');
      expect(result.payload.description).toContain('continues');
    });
  });
});
