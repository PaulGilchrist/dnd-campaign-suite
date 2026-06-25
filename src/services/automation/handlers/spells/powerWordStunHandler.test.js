// @improved-by-ai
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

import { handle, processPowerWordStunRepeatSave } from './powerWordStunHandler.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
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

const lowHpCombatContext = {
  creatures: [
    { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
    { name: 'TestCaster', gridX: 5, gridY: 10 },
  ],
  players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
  placedItems: [],
};

const highHpCombatContext = {
  creatures: [
    { name: 'Dragon', type: 'monster', currentHp: 300, maxHp: 500 },
    { name: 'TestCaster', gridX: 5, gridY: 10 },
  ],
  players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
  placedItems: [],
};

function setupHandleMocks(targetName, hp, hasTracking = false) {
  const combatContext = hp !== null && hp <= 150 ? lowHpCombatContext : highHpCombatContext;
  getCombatContext.mockResolvedValue(combatContext);
  buildSaveDc.mockReturnValue(15);
  resolveTarget.mockResolvedValue({ target: { name: targetName } });
  getRuntimeValue.mockImplementation((caster, key, _cName) => {
    if (key === `_${targetName.replace(/\s+/g, '_')}` && hasTracking) return true;
    if (key === 'activeConditions') return [];
    if (key === 'targetEffects') return [];
    return null;
  });
}

describe('powerWordStunHandler.handle', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('when no combat context exists', () => {
    it('should return a popup indicating no creatures in combat', async () => {
      getCombatContext.mockResolvedValue(null);
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No creatures in combat');
    });
  });

  describe('when combat context has no creatures', () => {
    it('should return a popup indicating no creatures in combat', async () => {
      getCombatContext.mockResolvedValue({ creatures: [] });
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No creatures in combat');
    });
  });

  describe('when no target is selected', () => {
    it('should return a popup indicating no target selected', async () => {
      getCombatContext.mockResolvedValue(lowHpCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No target selected');
    });
  });

  describe('when a valid target is selected', () => {
    describe('and the target has 150 HP or fewer', () => {
      it('should apply the Stunned condition', async () => {
        setupHandleMocks('Goblin', 5);
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
        setupHandleMocks('Goblin', 5);
        await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(setRuntimeValue).toHaveBeenCalledWith(
          'TestCaster',
          '_powerWordStun_Goblin',
          true,
          campaignName,
        );
      });

      it('should store target effect for repeat saves', async () => {
        setupHandleMocks('Goblin', 5);
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

      it('should log the condition application', async () => {
        setupHandleMocks('Goblin', 5);
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

      it('should include target HP in the description', async () => {
        setupHandleMocks('Goblin', 5);
        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.payload.description).toContain('5 HP');
        expect(result.payload.description).toContain('150 or fewer');
      });

      it('should log the save_result entry', async () => {
        setupHandleMocks('Goblin', 5);
        await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(addEntry).toHaveBeenCalledWith(
          campaignName,
          expect.objectContaining({
            type: 'save_result',
            rollType: 'save-power-word-stun',
            targetName: 'Goblin',
            success: false,
          }),
        );
      });

      it('should filter existing stunned condition before reapplying', async () => {
        getCombatContext.mockResolvedValue(lowHpCombatContext);
        buildSaveDc.mockReturnValue(15);
        resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
        getRuntimeValue.mockImplementation((caster, key, _cName) => {
          if (key === '_powerWordStun_Goblin') return null;
          if (key === 'activeConditions') return ['stunned', 'Frightened'];
          if (key === 'targetEffects') return [];
          return null;
        });

        await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(setRuntimeValue).toHaveBeenCalledWith(
          'Goblin',
          'activeConditions',
          expect.arrayContaining(['Frightened', 'stunned']),
          campaignName,
        );
        // Verify only one 'stunned' in the array (no duplicates)
        const stunCall = setRuntimeValue.mock.calls.find(
          call => call[1] === 'activeConditions' && call[0] === 'Goblin'
        );
        expect(stunCall[2]).toEqual(['Frightened', 'stunned']);
      });
    });

    describe('and the target has more than 150 HP', () => {
      it('should apply speed_zero instead of Stunned', async () => {
        setupHandleMocks('Dragon', 300);
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

      it('should call addExpiration for speed_zero', async () => {
        setupHandleMocks('Dragon', 300);
        await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(addExpiration).toHaveBeenCalledWith(
          'TestCaster',
          'Dragon',
          expect.arrayContaining([
            expect.objectContaining({ type: 'speed_zero' }),
          ]),
          campaignName,
          1,
        );
      });

      it('should log the condition application', async () => {
        setupHandleMocks('Dragon', 300);
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

    describe('and the target has unknown HP', () => {
      it('should apply speed_zero and note unknown HP', async () => {
        const unknownHpCombat = {
          creatures: [
            { name: 'Mystery', type: 'monster' },
            { name: 'TestCaster', gridX: 5, gridY: 10 },
          ],
          players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
          placedItems: [],
        };
        getCombatContext.mockResolvedValue(unknownHpCombat);
        buildSaveDc.mockReturnValue(15);
        resolveTarget.mockResolvedValue({ target: { name: 'Mystery' } });
        getRuntimeValue.mockReturnValue(null);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.payload.description).toContain('unknown HP');
        expect(result.payload.description).toContain('Speed is 0');
      });
    });
  });

  describe('when the target already has tracking (repeat save)', () => {
    it('should delegate to processPowerWordStunRepeatSave', async () => {
      setupHandleMocks('Goblin', 5, true);
      createSaveListener.mockReturnValue({
        promptId: 'pws-prompt',
        promise: Promise.resolve({ success: false }),
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      // When tracking exists, processPowerWordStunRepeatSave is called which prompts for CON save
      // and returns description with save result
      expect(result.payload.description).toMatch(/CON save/);
    });
  });

  describe('target resolution', () => {
    it('should call resolveTarget with campaignName and casterName', async () => {
      getCombatContext.mockResolvedValue(lowHpCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      getRuntimeValue.mockReturnValue(null);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(resolveTarget).toHaveBeenCalledWith(campaignName, 'TestCaster');
    });
  });
});

describe('powerWordStunHandler.processPowerWordStunRepeatSave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when no tracking exists', () => {
    it('should return null', async () => {
      getRuntimeValue.mockReturnValue(null);
      const result = await processPowerWordStunRepeatSave(
        'TestCaster', 'Goblin', 15, 'Power Word Stun', campaignName,
      );
      expect(result).toBeNull();
    });
  });

  describe('when tracking exists', () => {
    describe('and the repeat save succeeds', () => {
      it('should remove the Stunned condition', async () => {
        getRuntimeValue.mockImplementation((target, prop, _cName) => {
          if (prop === 'activeConditions') return ['Stunned', 'Frightened'];
          return true;
        });
        createSaveListener.mockReturnValue({
          promptId: 'pws-repeat-success',
          promise: Promise.resolve({ success: true }),
        });

        const result = await processPowerWordStunRepeatSave(
          'TestCaster', 'Goblin', 15, 'Power Word Stun', campaignName,
        );

        expect(setRuntimeValue).toHaveBeenCalledWith(
          'Goblin',
          'activeConditions',
          ['Frightened'],
          campaignName,
        );
        expect(result.payload.description).toContain('succeeded on CON save');
      });

      it('should clear tracking for the caster', async () => {
        getRuntimeValue.mockImplementation((caster, key) => {
          if (key === '_powerWordStun_Goblin') return true;
          return [];
        });
        createSaveListener.mockReturnValue({
          promptId: 'pws-repeat-track',
          promise: Promise.resolve({ success: true }),
        });

        await processPowerWordStunRepeatSave(
          'TestCaster', 'Goblin', 15, 'Power Word Stun', campaignName,
        );

        expect(setRuntimeValue).toHaveBeenCalledWith(
          'TestCaster',
          '_powerWordStun_Goblin',
          null,
          campaignName,
        );
      });

      it('should clean up the target effect', async () => {
        getRuntimeValue.mockImplementation((caster, key, prop) => {
          if (key === '_powerWordStun_Goblin') return true;
          if (prop === 'targetEffects') return [
            { target: 'Goblin', effect: 'power_word_stun_repeat_save', source: 'TestCaster' },
          ];
          return true;
        });
        createSaveListener.mockReturnValue({
          promptId: 'pws-repeat-clean',
          promise: Promise.resolve({ success: true }),
        });

        await processPowerWordStunRepeatSave(
          'TestCaster', 'Goblin', 15, 'Power Word Stun', campaignName,
        );

        expect(setRuntimeValue).toHaveBeenCalledWith(
          campaignName,
          'targetEffects',
          [],
          campaignName,
        );
      });

      it('should log the condition removal', async () => {
        getRuntimeValue.mockImplementation((target, prop, _cName) => {
          if (prop === 'activeConditions') return ['Stunned'];
          return true;
        });
        createSaveListener.mockReturnValue({
          promptId: 'pws-repeat-log',
          promise: Promise.resolve({ success: true }),
        });

        await processPowerWordStunRepeatSave(
          'TestCaster', 'Goblin', 15, 'Power Word Stun', campaignName,
        );

        expect(postLogEntry).toHaveBeenCalledWith(
          campaignName,
          expect.objectContaining({
            type: 'condition',
            action: 'removed',
            condition: 'Stunned',
          }),
        );
      });

      it('should return a popup indicating the spell ends', async () => {
        getRuntimeValue.mockImplementation((target, prop, _cName) => {
          if (prop === 'activeConditions') return ['Stunned'];
          return true;
        });
        createSaveListener.mockReturnValue({
          promptId: 'pws-repeat-popup',
          promise: Promise.resolve({ success: true }),
        });

        const result = await processPowerWordStunRepeatSave(
          'TestCaster', 'Goblin', 15, 'Power Word Stun', campaignName,
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Power Word Stun ends');
      });
    });

    describe('and the repeat save fails', () => {
      it('should return a popup indicating the spell continues', async () => {
        getRuntimeValue.mockImplementation((caster, key) => {
          if (key === '_powerWordStun_Goblin') return true;
          return [];
        });
        createSaveListener.mockReturnValue({
          promptId: 'pws-repeat-fail',
          promise: Promise.resolve({ success: false }),
        });

        const result = await processPowerWordStunRepeatSave(
          'TestCaster', 'Goblin', 15, 'Power Word Stun', campaignName,
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('failed CON save');
        expect(result.payload.description).toContain('continues');
      });
    });
  });

  describe('save listener configuration', () => {
    it('should create a save listener with CON save type', async () => {
      getRuntimeValue.mockImplementation((caster, key) => {
        if (key === '_powerWordStun_Goblin') return true;
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'pws-listener-config',
        promise: Promise.resolve({ success: true }),
      });

      await processPowerWordStunRepeatSave(
        'TestCaster', 'Goblin', 15, 'Power Word Stun', campaignName,
      );

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveType: 'CON',
        saveDc: 15,
        dcSuccess: 'none',
      });
    });
  });
});
