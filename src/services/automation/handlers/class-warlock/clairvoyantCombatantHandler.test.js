// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));

import { handle } from './clairvoyantCombatantHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestWarlock',
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Charisma', bonus: 3 }],
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Clairvoyant Combatant',
    automation: { type: 'clairvoyant_combatant', saveType: 'WIS', saveDc: 15, uses: 1, ...automation },
  };
}

function dispatchSaveResult(promptId, success) {
  window.dispatchEvent(new CustomEvent('save-result', {
    detail: { promptId, success },
  }));
}

describe('clairvoyantCombatantHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('active target check', () => {
    it('should return info popup when already active against a target', async () => {
      getRuntimeValue.mockImplementation((playerName, key) => {
        if (key === 'clairvoyantCombatantTarget') return 'ExistingTarget';
        return null;
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Clairvoyant Combatant');
      expect(result.payload.description).toContain('already active');
      expect(result.payload.description).toContain('ExistingTarget');
    });

    it('should use custom feature name from action when already active', async () => {
      getRuntimeValue.mockImplementation((playerName, key) => {
        if (key === 'clairvoyantCombatantTarget') return 'ExistingTarget';
        return null;
      });

      const result = await handle(
        { name: 'Custom Clairvoyance', automation: { type: 'clairvoyant_combatant' } },
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.payload.name).toBe('Custom Clairvoyance');
      expect(result.payload.description).toContain('Custom Clairvoyance');
    });
  });

  describe('uses check', () => {
    it('should return info popup when no uses remaining and no pact magic recharge', async () => {
      getRuntimeValue.mockImplementation((playerName, key) => {
        if (key === 'clairvoyantCombatantTarget') return null;
        if (key === 'clairvoyantCombatantUses') return 1;
        return null;
      });

      const result = await handle(makeAction({ pactMagicRecharge: false }), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No uses remaining');
      expect(result.payload.description).toContain('Short or Long Rest');
    });

    it('should return info popup when no uses remaining with pact magic recharge enabled', async () => {
      getRuntimeValue.mockImplementation((playerName, key) => {
        if (key === 'clairvoyantCombatantTarget') return null;
        if (key === 'clairvoyantCombatantUses') return 1;
        if (key === 'warlockPactMagic') return 0;
        return null;
      });

      const result = await handle(makeAction({ pactMagicRecharge: true }), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No uses remaining');
      expect(result.payload.description).toContain('No Pact Magic slots available');
    });

    it('should spend a pact magic slot to restore a use when available', async () => {
      getRuntimeValue.mockImplementation((playerName, key) => {
        if (key === 'clairvoyantCombatantTarget') return null;
        if (key === 'clairvoyantCombatantUses') return 1;
        if (key === 'warlockPactMagic') return 2;
        return null;
      });

      const result = await handle(makeAction({ pactMagicRecharge: true }), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(setRuntimeValue).toHaveBeenCalledWith('TestWarlock', 'warlockPactMagic', 1, campaignName);
      expect(setRuntimeValue).toHaveBeenCalledWith('TestWarlock', 'clairvoyantCombatantUses', 0, campaignName);
    });

    it('should log ability_use when pact magic slot is expended', async () => {
      getRuntimeValue.mockImplementation((playerName, key) => {
        if (key === 'clairvoyantCombatantTarget') return null;
        if (key === 'clairvoyantCombatantUses') return 1;
        if (key === 'warlockPactMagic') return 2;
        return null;
      });

      await handle(makeAction({ pactMagicRecharge: true }), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'ability_use',
        characterName: 'TestWarlock',
        abilityName: 'Clairvoyant Combatant',
        description: expect.stringContaining('Pact Magic'),
      }));
    });

    it('should handle uses as string from runtime store', async () => {
      getRuntimeValue.mockImplementation((playerName, key) => {
        if (key === 'clairvoyantCombatantTarget') return null;
        if (key === 'clairvoyantCombatantUses') return '0';
        return null;
      });

      getTargetFromAttacker.mockReturnValue({ name: 'EnemyTarget' });
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({ promptId: 'string-uses' });
      getCombatContext.mockResolvedValue({ creatures: [{ name: 'EnemyTarget' }] });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
    });

    it('should handle uses as null from runtime store', async () => {
      getRuntimeValue.mockImplementation((playerName, key) => {
        if (key === 'clairvoyantCombatantTarget') return null;
        if (key === 'clairvoyantCombatantUses') return null;
        return null;
      });

      getTargetFromAttacker.mockReturnValue({ name: 'EnemyTarget' });
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({ promptId: 'null-uses' });
      getCombatContext.mockResolvedValue({ creatures: [{ name: 'EnemyTarget' }] });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
    });

    it('should support maxUses greater than 1', async () => {
      getRuntimeValue.mockImplementation((playerName, key) => {
        if (key === 'clairvoyantCombatantTarget') return null;
        if (key === 'clairvoyantCombatantUses') return 1;
        return null;
      });

      getTargetFromAttacker.mockReturnValue({ name: 'EnemyTarget' });
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({ promptId: 'multi-uses' });
      getCombatContext.mockResolvedValue({ creatures: [{ name: 'EnemyTarget' }] });

      const result = await handle(makeAction({ uses: 3 }), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('1 / 3');
    });

    it('should exhaust uses when current equals max and pact recharge is enabled but no slots', async () => {
      getRuntimeValue.mockImplementation((playerName, key) => {
        if (key === 'clairvoyantCombatantTarget') return null;
        if (key === 'clairvoyantCombatantUses') return 2;
        if (key === 'warlockPactMagic') return 0;
        return null;
      });

      const result = await handle(makeAction({ pactMagicRecharge: true, uses: 2 }), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No Pact Magic slots available');
    });
  });

  describe('target resolution', () => {
    it('should return info popup when no target selected in combat', async () => {
      getRuntimeValue.mockImplementation((playerName, key) => {
        if (key === 'clairvoyantCombatantTarget') return null;
        if (key === 'clairvoyantCombatantUses') return 0;
        return null;
      });
      getTargetFromAttacker.mockReturnValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No target selected');
    });

    it('should increment use counter based on current value', async () => {
      getRuntimeValue.mockImplementation((playerName, key) => {
        if (key === 'clairvoyantCombatantTarget') return null;
        if (key === 'clairvoyantCombatantUses') return 0;
        return null;
      });
      getTargetFromAttacker.mockReturnValue({ name: 'EnemyTarget' });
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({ promptId: 'incr-zero' });
      getCombatContext.mockResolvedValue({ creatures: [{ name: 'EnemyTarget' }] });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith('TestWarlock', 'clairvoyantCombatantUses', 1, campaignName);
    });

    it('should increment use counter from non-zero current value', async () => {
      getRuntimeValue.mockImplementation((playerName, key) => {
        if (key === 'clairvoyantCombatantTarget') return null;
        if (key === 'clairvoyantCombatantUses') return 1;
        return null;
      });
      getTargetFromAttacker.mockReturnValue({ name: 'EnemyTarget' });
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({ promptId: 'incr-one' });
      getCombatContext.mockResolvedValue({ creatures: [{ name: 'EnemyTarget' }] });

      await handle(makeAction({ uses: 3 }), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith('TestWarlock', 'clairvoyantCombatantUses', 2, campaignName);
    });
  });

  describe('target effects', () => {
    function setupFull(overrides = {}) {
      getRuntimeValue.mockImplementation((playerName, key, _campaign) => {
        if (key === 'clairvoyantCombatantTarget') return null;
        if (key === 'clairvoyantCombatantUses') return 0;
        if (key === 'targetEffects' && playerName === campaignName) return [];
        if (key === 'activeBuffs') return [];
        return null;
      });
      getTargetFromAttacker.mockReturnValue({ name: 'EnemyTarget' });
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({ promptId: 'clairvoyant-full' });
      getCombatContext.mockResolvedValue({ creatures: [{ name: 'EnemyTarget' }] });
      Object.assign(overrides, {});
    }

    it('should add target effect with correct properties', async () => {
      setupFull();
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        campaignName,
        'targetEffects',
        expect.arrayContaining([
          expect.objectContaining({
            target: 'EnemyTarget',
            source: 'Clairvoyant Combatant',
            effect: 'clairvoyant_combatant',
            duration: '1_minute',
            saveType: 'WIS',
            saveDc: 15,
            saveAbility: 'CHA',
            attackerAdvantage: true,
            defenderDisadvantage: true,
          }),
        ]),
        campaignName,
      );
    });

    it('should append to existing targetEffects array', async () => {
      getRuntimeValue.mockImplementation((playerName, key, _campaign) => {
        if (key === 'clairvoyantCombatantTarget') return null;
        if (key === 'clairvoyantCombatantUses') return 0;
        if (key === 'targetEffects' && playerName === campaignName) return [{ target: 'OldTarget', effect: 'other_effect' }];
        if (key === 'activeBuffs') return [];
        return null;
      });
      getTargetFromAttacker.mockReturnValue({ name: 'EnemyTarget' });
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({ promptId: 'append-effects' });
      getCombatContext.mockResolvedValue({ creatures: [{ name: 'EnemyTarget' }] });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        campaignName,
        'targetEffects',
        expect.arrayContaining([
          expect.objectContaining({ effect: 'other_effect' }),
          expect.objectContaining({ effect: 'clairvoyant_combatant' }),
        ]),
        campaignName,
      );
    });

    it('should handle existing targetEffects as null', async () => {
      getRuntimeValue.mockImplementation((playerName, key, _campaign) => {
        if (key === 'clairvoyantCombatantTarget') return null;
        if (key === 'clairvoyantCombatantUses') return 0;
        if (key === 'targetEffects' && playerName === campaignName) return null;
        if (key === 'activeBuffs') return [];
        return null;
      });
      getTargetFromAttacker.mockReturnValue({ name: 'EnemyTarget' });
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({ promptId: 'null-effects' });
      getCombatContext.mockResolvedValue({ creatures: [{ name: 'EnemyTarget' }] });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        campaignName,
        'targetEffects',
        expect.arrayContaining([
          expect.objectContaining({ effect: 'clairvoyant_combatant' }),
        ]),
        campaignName,
      );
    });

    it('should store active target for the player', async () => {
      setupFull();
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestWarlock',
        'clairvoyantCombatantTarget',
        'EnemyTarget',
        campaignName,
      );
    });

    it('should add to activeBuffs array', async () => {
      setupFull();
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestWarlock',
        'activeBuffs',
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Clairvoyant Combatant',
            effect: 'clairvoyant_combatant',
            duration: '1_minute',
            target: 'EnemyTarget',
          }),
        ]),
        campaignName,
      );
    });

    it('should handle activeBuffs as null', async () => {
      getRuntimeValue.mockImplementation((playerName, key, _campaign) => {
        if (key === 'clairvoyantCombatantTarget') return null;
        if (key === 'clairvoyantCombatantUses') return 0;
        if (key === 'targetEffects' && playerName === campaignName) return [];
        if (key === 'activeBuffs') return null;
        return null;
      });
      getTargetFromAttacker.mockReturnValue({ name: 'EnemyTarget' });
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({ promptId: 'null-buffs' });
      getCombatContext.mockResolvedValue({ creatures: [{ name: 'EnemyTarget' }] });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestWarlock',
        'activeBuffs',
        expect.arrayContaining([
          expect.objectContaining({ effect: 'clairvoyant_combatant' }),
        ]),
        campaignName,
      );
    });

    it('should append to existing activeBuffs', async () => {
      getRuntimeValue.mockImplementation((playerName, key, _campaign) => {
        if (key === 'clairvoyantCombatantTarget') return null;
        if (key === 'clairvoyantCombatantUses') return 0;
        if (key === 'targetEffects' && playerName === campaignName) return [];
        if (key === 'activeBuffs') return [{ effect: 'old_buff', target: 'OtherTarget' }];
        return null;
      });
      getTargetFromAttacker.mockReturnValue({ name: 'EnemyTarget' });
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({ promptId: 'append-buffs' });
      getCombatContext.mockResolvedValue({ creatures: [{ name: 'EnemyTarget' }] });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestWarlock',
        'activeBuffs',
        expect.arrayContaining([
          expect.objectContaining({ effect: 'old_buff' }),
          expect.objectContaining({ effect: 'clairvoyant_combatant' }),
        ]),
        campaignName,
      );
    });

    it('should use custom duration from automation config', async () => {
      getRuntimeValue.mockImplementation((playerName, key, _campaign) => {
        if (key === 'clairvoyantCombatantTarget') return null;
        if (key === 'clairvoyantCombatantUses') return 0;
        if (key === 'targetEffects' && playerName === campaignName) return [];
        if (key === 'activeBuffs') return [];
        return null;
      });
      getTargetFromAttacker.mockReturnValue({ name: 'EnemyTarget' });
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({ promptId: 'custom-duration' });
      getCombatContext.mockResolvedValue({ creatures: [{ name: 'EnemyTarget' }] });

      await handle(makeAction({ duration: '10_minutes' }), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        campaignName,
        'targetEffects',
        expect.arrayContaining([
          expect.objectContaining({ duration: '10_minutes' }),
        ]),
        campaignName,
      );
    });

    it('should use custom saveType from automation config', async () => {
      getRuntimeValue.mockImplementation((playerName, key, _campaign) => {
        if (key === 'clairvoyantCombatantTarget') return null;
        if (key === 'clairvoyantCombatantUses') return 0;
        if (key === 'targetEffects' && playerName === campaignName) return [];
        if (key === 'activeBuffs') return [];
        return null;
      });
      getTargetFromAttacker.mockReturnValue({ name: 'EnemyTarget' });
      buildSaveDc.mockReturnValue(17);
      createSaveListener.mockReturnValue({ promptId: 'custom-save-type' });
      getCombatContext.mockResolvedValue({ creatures: [{ name: 'EnemyTarget' }] });

      await handle(makeAction({ saveType: 'CHA', saveDc: 17 }), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        campaignName,
        'targetEffects',
        expect.arrayContaining([
          expect.objectContaining({ saveType: 'CHA', saveDc: 17 }),
        ]),
        campaignName,
      );
    });
  });

  describe('save listener', () => {
    function setupFull() {
      getRuntimeValue.mockImplementation((playerName, key, _campaign) => {
        if (key === 'clairvoyantCombatantTarget') return null;
        if (key === 'clairvoyantCombatantUses') return 0;
        if (key === 'targetEffects' && playerName === campaignName) return [];
        if (key === 'activeBuffs') return [];
        return null;
      });
      getTargetFromAttacker.mockReturnValue({ name: 'EnemyTarget' });
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({ promptId: 'clairvoyant-listener' });
      getCombatContext.mockResolvedValue({ creatures: [{ name: 'EnemyTarget' }] });
    }

    it('should create save listener with correct parameters', async () => {
      setupFull();
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'EnemyTarget',
        saveType: 'WIS',
        saveDc: 15,
      });
    });

    it('should add event listener for save-result', async () => {
      setupFull();
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEventListenerSpy).toHaveBeenCalledWith('save-result', expect.any(Function));
      addEventListenerSpy.mockRestore();
    });

    it('should log ability_use entry with save prompt details', async () => {
      setupFull();
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'ability_use',
        characterName: 'TestWarlock',
        abilityName: 'Clairvoyant Combatant',
        targetName: 'EnemyTarget',
        promptId: 'clairvoyant-listener',
        description: expect.stringContaining('EnemyTarget must make WIS save'),
      }));
    });

    it('should handle save failure — effects remain and log is added', async () => {
      setupFull();
      const promptId = 'save-fail-test';
      createSaveListener.mockReturnValue({ promptId });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      dispatchSaveResult(promptId, false);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'save_result',
        targetName: 'EnemyTarget',
        success: false,
        description: expect.stringContaining('failed'),
      }));
    });

    it('should handle save success — remove effects and clear target', async () => {
      setupFull();
      const promptId = 'save-success-test';
      createSaveListener.mockReturnValue({ promptId });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      dispatchSaveResult(promptId, true);
      await Promise.resolve();

      // Verify targetEffects was set to empty array (no clairvoyant_combatant effects remain)
      const effectCalls = vi.mocked(setRuntimeValue).mock.calls.filter(
        call => call[1] === 'targetEffects'
      );
      const lastEffectCall = effectCalls[effectCalls.length - 1];
      expect(lastEffectCall).toBeDefined();
      expect(lastEffectCall[2]).toEqual([]);

      // Active target should be cleared
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestWarlock',
        'clairvoyantCombatantTarget',
        null,
        campaignName,
      );

      // Verify activeBuffs was set to empty array (no clairvoyant_combatant buffs remain)
      const buffCalls = vi.mocked(setRuntimeValue).mock.calls.filter(
        call => call[1] === 'activeBuffs'
      );
      const lastBuffCall = buffCalls[buffCalls.length - 1];
      expect(lastBuffCall).toBeDefined();
      expect(lastBuffCall[2]).toEqual([]);

      // Log entry for save success
      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'save_result',
        targetName: 'EnemyTarget',
        success: true,
        description: expect.stringContaining('succeeded'),
      }));
    });

    it('should remove event listener after save result', async () => {
      setupFull();
      const promptId = 'remove-listener-test';
      createSaveListener.mockReturnValue({ promptId });
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      dispatchSaveResult(promptId, false);

      expect(removeEventListenerSpy).toHaveBeenCalledWith('save-result', expect.any(Function));
      removeEventListenerSpy.mockRestore();
    });

    it('should ignore save-result events with mismatched promptId', async () => {
      setupFull();
      createSaveListener.mockReturnValue({ promptId: 'real-prompt' });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      dispatchSaveResult('wrong-prompt', false);

      // Should not have logged a save_result for the wrong prompt
      expect(addEntry).not.toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({ type: 'save_result' }),
      );
    });

    it('should handle save success when targetEffects is null', async () => {
      getRuntimeValue.mockImplementation((playerName, key, _campaign) => {
        if (key === 'clairvoyantCombatantTarget') return null;
        if (key === 'clairvoyantCombatantUses') return 0;
        if (key === 'targetEffects' && playerName === campaignName) return null;
        if (key === 'activeBuffs') return [];
        return null;
      });
      getTargetFromAttacker.mockReturnValue({ name: 'EnemyTarget' });
      buildSaveDc.mockReturnValue(15);
      const promptId = 'null-effects-success';
      createSaveListener.mockReturnValue({ promptId });
      getCombatContext.mockResolvedValue({ creatures: [{ name: 'EnemyTarget' }] });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      dispatchSaveResult(promptId, true);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestWarlock',
        'clairvoyantCombatantTarget',
        null,
        campaignName,
      );
    });

    it('should handle save success when activeBuffs is null', async () => {
      getRuntimeValue.mockImplementation((playerName, key, _campaign) => {
        if (key === 'clairvoyantCombatantTarget') return null;
        if (key === 'clairvoyantCombatantUses') return 0;
        if (key === 'targetEffects' && playerName === campaignName) return [];
        if (key === 'activeBuffs') return null;
        return null;
      });
      getTargetFromAttacker.mockReturnValue({ name: 'EnemyTarget' });
      buildSaveDc.mockReturnValue(15);
      const promptId = 'null-buffs-success';
      createSaveListener.mockReturnValue({ promptId });
      getCombatContext.mockResolvedValue({ creatures: [{ name: 'EnemyTarget' }] });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      dispatchSaveResult(promptId, true);
      await Promise.resolve();

      const buffCalls = vi.mocked(setRuntimeValue).mock.calls.filter(
        call => call[1] === 'activeBuffs'
      );
      const lastBuffCall = buffCalls[buffCalls.length - 1];
      expect(lastBuffCall).toBeDefined();
      expect(lastBuffCall[2]).toEqual([]);
    });

    it('should handle save success when activeBuffs is non-array', async () => {
      getRuntimeValue.mockImplementation((playerName, key, _campaign) => {
        if (key === 'clairvoyantCombatantTarget') return null;
        if (key === 'clairvoyantCombatantUses') return 0;
        if (key === 'targetEffects' && playerName === campaignName) return [];
        if (key === 'activeBuffs') return 'not-an-array';
        return null;
      });
      getTargetFromAttacker.mockReturnValue({ name: 'EnemyTarget' });
      buildSaveDc.mockReturnValue(15);
      const promptId = 'nonarray-buffs-success';
      createSaveListener.mockReturnValue({ promptId });
      getCombatContext.mockResolvedValue({ creatures: [{ name: 'EnemyTarget' }] });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      dispatchSaveResult(promptId, true);
      await Promise.resolve();

      const buffCalls = vi.mocked(setRuntimeValue).mock.calls.filter(
        call => call[1] === 'activeBuffs'
      );
      const lastBuffCall = buffCalls[buffCalls.length - 1];
      expect(lastBuffCall).toBeDefined();
      expect(lastBuffCall[2]).toEqual([]);
    });
  });

  describe('popup response', () => {
    function setupFull() {
      getRuntimeValue.mockImplementation((playerName, key, _campaign) => {
        if (key === 'clairvoyantCombatantTarget') return null;
        if (key === 'clairvoyantCombatantUses') return 0;
        if (key === 'targetEffects' && playerName === campaignName) return [];
        if (key === 'activeBuffs') return [];
        return null;
      });
      getTargetFromAttacker.mockReturnValue({ name: 'EnemyTarget' });
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({ promptId: 'clairvoyant-popup' });
      getCombatContext.mockResolvedValue({ creatures: [{ name: 'EnemyTarget' }] });
    }

    it('should return popup with correct structure', async () => {
      setupFull();
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Clairvoyant Combatant');
      expect(result.payload.targetName).toBe('EnemyTarget');
      expect(result.payload.saveType).toBe('WIS');
      expect(result.payload.saveDc).toBe(15);
      expect(result.payload.automation).toEqual(expect.objectContaining({
        type: 'clairvoyant_combatant',
        saveType: 'WIS',
        saveDc: 15,
        uses: 1,
      }));
    });

    it('should include target name in description', async () => {
      setupFull();
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('EnemyTarget');
    });

    it('should include save type and DC in description', async () => {
      setupFull();
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('WIS');
      expect(result.payload.description).toContain('DC 15');
    });

    it('should mention advantage/disadvantage in description', async () => {
      setupFull();
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('Disadvantage');
      expect(result.payload.description).toContain('Advantage');
    });

    it('should show remaining uses in description', async () => {
      setupFull();
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('0 / 1');
    });

    it('should show correct remaining uses when uses were restored via pact magic', async () => {
      getRuntimeValue.mockImplementation((playerName, key) => {
        if (key === 'clairvoyantCombatantTarget') return null;
        if (key === 'clairvoyantCombatantUses') return 1;
        if (key === 'warlockPactMagic') return 2;
        return null;
      });

      const result = await handle(makeAction({ pactMagicRecharge: true }), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('0 / 1');
    });

    it('should use custom feature name in popup', async () => {
      setupFull();
      const result = await handle(
        { name: 'My Clairvoyance', automation: { type: 'clairvoyant_combatant', saveType: 'WIS', saveDc: 15, uses: 1 } },
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.payload.name).toBe('My Clairvoyance');
      expect(result.payload.description).toContain('My Clairvoyance');
    });
  });

  describe('getCombatContext null handling', () => {
    it('should return info popup when getCombatContext returns null', async () => {
      getRuntimeValue.mockImplementation((playerName, key) => {
        if (key === 'clairvoyantCombatantTarget') return null;
        if (key === 'clairvoyantCombatantUses') return 0;
        return null;
      });
      getCombatContext.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No target selected');
    });
  });
});
