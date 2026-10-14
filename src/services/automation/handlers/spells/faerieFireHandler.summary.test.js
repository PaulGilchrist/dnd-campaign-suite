import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './faerieFireHandler.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as combatData from '../../../encounters/combatData.js';
import * as concentrationService from '../../../combat/concentration/concentrationService.js';
import * as damageRollback from '../../common/damageRollback.js';

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

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
  storeSpellLastAttack: vi.fn(),
  addTargetResult: vi.fn(),
}));

vi.mock('../../../ui/storage.js', () => ({
  default: { get: vi.fn(), set: vi.fn(), getProperty: vi.fn(), setProperty: vi.fn() },
}));

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
    level: 5,
    proficiency: 3,
    abilities: [{ name: 'Charisma', bonus: 3 }],
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Faerie Fire',
    automation: { type: 'faerie_fire', saveType: 'DEX', saveDc: 15, ...automation },
  };
}

const baseCombatContext = {
  creatures: [
    { name: 'Goblin', type: 'monster' },
    { name: 'Orc', type: 'monster' },
    { name: 'TestCaster', gridX: 5, gridY: 10 },
  ],
  players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
  placedItems: [],
};

function mockGetRuntimeValue(dispatch) {
  runtimeState.getRuntimeValue.mockImplementation((playerName, key, _cName) => dispatch(playerName, key, _cName));
}

function makeSaveListener(promiseResult, promptId) {
  return { promptId: promptId || 'faerie-prompt', promise: Promise.resolve(promiseResult) };
}

function setupFailedSaveMock() {
  damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
  savePrompt.buildSaveDc.mockReturnValue(15);
  mockGetRuntimeValue((playerName, key) => {
    if (key === 'targetEffects') return [];
    if (key === 'activeBuffs') return [];
    if (key === 'activeConditions') return [];
    return null;
  });
  savePrompt.createSaveListener.mockReturnValue(makeSaveListener({ success: false }));
}



describe('faerieFireHandler.handle - summary & edge cases', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('summary generation', () => {
    it('should generate summary with affected creatures info', async () => {
      setupFailedSaveMock();

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('2 creature(s)');
      expect(result.payload.description).toContain('is outlined');
      expect(result.payload.description).toContain('Dim Light');
      expect(result.payload.description).toContain('10-foot radius');
    });

    it('should generate summary when no creatures affected (all saved)', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(20);
      savePrompt.createSaveListener.mockReturnValue(makeSaveListener({ success: true }));

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('No creatures affected');
      expect(result.payload.description).toContain('2 creature(s) saved');
    });

    it('should include immune count in summary when some are immune', async () => {
      const combatWithImmune = {
        ...baseCombatContext,
        creatures: [
          { name: 'IronGolem', type: 'monster', weaknessesAndResistivities: { immunities: ['DEX'] } },
          { name: 'Goblin', type: 'monster' },
          { name: 'TestCaster', gridX: 5, gridY: 10 },
        ],
      };
      damageUtils.getCombatContext.mockResolvedValue(combatWithImmune);
      savePrompt.buildSaveDc.mockReturnValue(14);
      savePrompt.createSaveListener.mockReturnValue(makeSaveListener({ success: false }));
      mockGetRuntimeValue((playerName, key) => {
        if (key === 'targetEffects') return [];
        if (key === 'activeBuffs') return [];
        if (key === 'activeConditions') return [];
        return null;
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('1 creature(s) immune');
      expect(result.payload.description).toContain('1 creature(s)');
    });

    it('should omit immune count from summary when none are immune', async () => {
      setupFailedSaveMock();

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      // The summary text always mentions "immune to the Invisible condition" as a feature description
      // but should not contain the "X creature(s) immune" count phrase
      expect(result.payload.description).not.toContain('creature(s) immune');
    });

    it('should include individual target results in summary', async () => {
      setupFailedSaveMock();

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('Goblin is outlined');
    });

    it('should return popup type with automation_info payload', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      savePrompt.createSaveListener.mockReturnValue(makeSaveListener({ success: false }));
      mockGetRuntimeValue((playerName, key) => {
        if (key === 'targetEffects') return [];
        if (key === 'activeBuffs') return [];
        if (key === 'activeConditions') return [];
        return null;
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Faerie Fire');
    });
  });

  describe('edge cases', () => {
    it('should handle all targets being the caster', async () => {
      const onlyPlayerCombat = {
        creatures: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
        placedItems: [],
      };
      damageUtils.getCombatContext.mockResolvedValue(onlyPlayerCombat);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
      expect(result.payload.description).toContain('No creatures selected');
    });

    it('should handle empty automation object with default DC', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(10);
      savePrompt.createSaveListener.mockReturnValue(makeSaveListener({ success: true }));

      const result = await handle({ name: 'Faerie Fire', automation: {} }, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(savePrompt.buildSaveDc).toHaveBeenCalled();
    });

    it('should handle playerStats with no proficiency', async () => {
      const ps = makePlayerStats({ proficiency: 0, abilities: [] });
      const action = makeAction();

      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(10);
      savePrompt.createSaveListener.mockReturnValue(makeSaveListener({ success: false }));
      mockGetRuntimeValue((playerName, key) => {
        if (key === 'targetEffects') return [];
        if (key === 'activeBuffs') return [];
        if (key === 'activeConditions') return [];
        return null;
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(savePrompt.buildSaveDc).toHaveBeenCalledWith(action.automation, ps);
    });

    it('should handle getRuntimeValue returning null for targetEffects', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      runtimeState.getRuntimeValue.mockImplementation((playerName, key) => {
        if (key === 'targetEffects') return null;
        if (key === 'activeBuffs') return null;
        if (key === 'activeConditions') return null;
        return null;
      });
      savePrompt.createSaveListener.mockReturnValue(makeSaveListener({ success: false }));

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'campaign',
        'targetEffects',
        expect.arrayContaining([
          expect.objectContaining({
            target: 'Goblin',
            effect: 'faerie_fire',
          }),
        ]),
        campaignName,
      );
    });

    it('should handle getRuntimeValue returning null for activeBuffs', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      runtimeState.getRuntimeValue.mockImplementation((playerName, key) => {
        if (key === 'targetEffects') return [];
        if (key === 'activeBuffs') return null;
        if (key === 'activeConditions') return null;
        return null;
      });
      savePrompt.createSaveListener.mockReturnValue(makeSaveListener({ success: false }));

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeBuffs',
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Faerie Fire',
          }),
        ]),
        campaignName,
      );
    });

    it('should handle getRuntimeValue returning null for activeConditions', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      runtimeState.getRuntimeValue.mockImplementation((playerName, key) => {
        if (key === 'targetEffects') return [];
        if (key === 'activeBuffs') return [];
        if (key === 'activeConditions') return null;
        return null;
      });
      savePrompt.createSaveListener.mockReturnValue(makeSaveListener({ success: false }));

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      // Should not call setRuntimeValue for activeConditions when invisible is absent and value was null
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        expect.any(Array),
        campaignName,
      );
    });

    it('should handle save result with undefined roll and total', async () => {
      setupFailedSaveMock();
      savePrompt.createSaveListener.mockReturnValue(makeSaveListener({ success: false, roll: undefined, total: undefined }));

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(damageRollback.addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveResult: 'failure',
        roll: 0,
        total: 0,
        conditions: ['faerie_fire'],
        appliedDamage: 0,
      });
    });

    it('should handle save result with explicit roll and total', async () => {
      setupFailedSaveMock();
      savePrompt.createSaveListener.mockReturnValue(makeSaveListener({ success: false, roll: 12, total: 17 }));

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(damageRollback.addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveResult: 'failure',
        roll: 12,
        total: 17,
        conditions: ['faerie_fire'],
        appliedDamage: 0,
      });
    });

    it('should compute concentration DC from proficiency when spellAbilities.saveDc is missing', async () => {
      const summary = { creatures: [{ name: 'TestCaster' }, { name: 'Goblin' }] };
      combatData.getCombatSummary.mockReturnValue(summary);
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      savePrompt.createSaveListener.mockReturnValue(makeSaveListener({ success: true }));

      const playerStats = makePlayerStats({ spellAbilities: undefined });
      await handle(makeAction(), playerStats, campaignName, null);

      expect(concentrationService.addConcentration).toHaveBeenCalledWith(
        summary,
        'TestCaster',
        'Faerie Fire',
        11,
      );
    });

    it('should exercise addEntry .catch() error handler for immune creature', async () => {
      const { addEntry } = await import('../../../ui/logService.js');
      addEntry.mockRejectedValue(new Error('log error'));

      const combatWithImmune = {
        ...baseCombatContext,
        creatures: [
          { name: 'IronGolem', type: 'monster', weaknessesAndResistivities: { immunities: ['DEX'] } },
          { name: 'TestCaster', gridX: 5, gridY: 10 },
        ],
      };
      damageUtils.getCombatContext.mockResolvedValue(combatWithImmune);
      savePrompt.buildSaveDc.mockReturnValue(15);
      savePrompt.createSaveListener.mockReturnValue(makeSaveListener({ success: false }));

      const consoleSpy = vi.spyOn(console, 'error').mockReturnValue();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(consoleSpy).toHaveBeenCalledWith('[faerieFire] Error:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    it('should exercise addEntry .catch() error handler for ability_use log', async () => {
      const { addEntry } = await import('../../../ui/logService.js');
      addEntry.mockRejectedValue(new Error('log error'));

      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      runtimeState.getRuntimeValue.mockImplementation((playerName, key) => {
        if (key === 'targetEffects') return [];
        if (key === 'activeBuffs') return [];
        if (key === 'activeConditions') return [];
        return null;
      });
      savePrompt.createSaveListener.mockReturnValue(makeSaveListener({ success: false }));

      const consoleSpy = vi.spyOn(console, 'error').mockReturnValue();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(consoleSpy).toHaveBeenCalledWith('[faerieFire] Error:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    it('should exercise addEntry .catch() error handler for save_result on success', async () => {
      const { addEntry } = await import('../../../ui/logService.js');
      addEntry.mockRejectedValue(new Error('log error'));

      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(20);
      runtimeState.getRuntimeValue.mockImplementation((playerName, key) => {
        if (key === 'targetEffects') return [];
        if (key === 'activeBuffs') return [];
        if (key === 'activeConditions') return [];
        return null;
      });
      savePrompt.createSaveListener.mockReturnValue(makeSaveListener({ success: true }));

      const consoleSpy = vi.spyOn(console, 'error').mockReturnValue();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(consoleSpy).toHaveBeenCalledWith('[faerieFire] Error:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    it('should exercise addEntry .catch() error handler for invisible condition removal', async () => {
      const { addEntry } = await import('../../../ui/logService.js');
      addEntry.mockRejectedValue(new Error('log error'));

      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      runtimeState.getRuntimeValue.mockImplementation((playerName, key) => {
        if (key === 'targetEffects') return [];
        if (key === 'activeBuffs') return [];
        if (key === 'activeConditions') return ['invisible'];
        return null;
      });
      savePrompt.createSaveListener.mockReturnValue(makeSaveListener({ success: false }));

      const consoleSpy = vi.spyOn(console, 'error').mockReturnValue();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(consoleSpy).toHaveBeenCalledWith('[faerieFire] Error:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    it('should exercise addEntry .catch() error handler for condition applied log', async () => {
      const { addEntry } = await import('../../../ui/logService.js');
      addEntry.mockRejectedValue(new Error('log error'));

      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      runtimeState.getRuntimeValue.mockImplementation((playerName, key) => {
        if (key === 'targetEffects') return [];
        if (key === 'activeBuffs') return [];
        if (key === 'activeConditions') return [];
        return null;
      });
      savePrompt.createSaveListener.mockReturnValue(makeSaveListener({ success: false }));

      const consoleSpy = vi.spyOn(console, 'error').mockReturnValue();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(consoleSpy).toHaveBeenCalledWith('[faerieFire] Error:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    it('should exercise addEntry .catch() error handler for save_result on failure', async () => {
      const { addEntry } = await import('../../../ui/logService.js');
      addEntry.mockRejectedValue(new Error('log error'));

      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      runtimeState.getRuntimeValue.mockImplementation((playerName, key) => {
        if (key === 'targetEffects') return [];
        if (key === 'activeBuffs') return [];
        if (key === 'activeConditions') return [];
        return null;
      });
      savePrompt.createSaveListener.mockReturnValue(makeSaveListener({ success: false }));

      const consoleSpy = vi.spyOn(console, 'error').mockReturnValue();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(consoleSpy).toHaveBeenCalledWith('[faerieFire] Error:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    it('should use empty object when automation is falsy', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(10);
      savePrompt.createSaveListener.mockReturnValue(makeSaveListener({ success: true }));

      const result = await handle({ name: 'Faerie Fire', automation: null }, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(savePrompt.buildSaveDc).toHaveBeenCalledWith({}, makePlayerStats());
    });

    it('should use empty array fallback when targetEffects is not an array', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      runtimeState.getRuntimeValue.mockImplementation((playerName, key) => {
        if (key === 'targetEffects') return 'not-an-array';
        if (key === 'activeBuffs') return [];
        if (key === 'activeConditions') return [];
        return null;
      });
      savePrompt.createSaveListener.mockReturnValue(makeSaveListener({ success: false }));

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'campaign',
        'targetEffects',
        expect.arrayContaining([
          expect.objectContaining({
            target: 'Goblin',
            effect: 'faerie_fire',
          }),
        ]),
        campaignName,
      );
    });

    it('should use empty array fallback when activeConditions is not an array', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      runtimeState.getRuntimeValue.mockImplementation((playerName, key) => {
        if (key === 'targetEffects') return [];
        if (key === 'activeBuffs') return [];
        if (key === 'activeConditions') return 'not-an-array';
        return null;
      });
      savePrompt.createSaveListener.mockReturnValue(makeSaveListener({ success: false }));

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        expect.any(Array),
        campaignName,
      );
    });

    it('should process creature with non-DEX immunities array normally', async () => {
      const combatWithOtherImmunities = {
        ...baseCombatContext,
        creatures: [
          { name: 'Goblin', type: 'monster', weaknessesAndResistivities: { immunities: ['fire'] } },
          { name: 'TestCaster', gridX: 5, gridY: 10 },
        ],
      };
      damageUtils.getCombatContext.mockResolvedValue(combatWithOtherImmunities);
      savePrompt.buildSaveDc.mockReturnValue(14);
      runtimeState.getRuntimeValue.mockImplementation((playerName, key) => {
        if (key === 'targetEffects') return [];
        if (key === 'activeBuffs') return [];
        if (key === 'activeConditions') return [];
        return null;
      });
      savePrompt.createSaveListener.mockReturnValue(makeSaveListener({ success: false }));

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(savePrompt.createSaveListener).toHaveBeenCalledTimes(1);
      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({ targetName: 'Goblin' }),
      );
    });

    it('should use proficiency fallback of 2 when proficiency is 0 for concentration DC', async () => {
      const summary = { creatures: [{ name: 'TestCaster' }, { name: 'Goblin' }] };
      combatData.getCombatSummary.mockReturnValue(summary);
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      savePrompt.createSaveListener.mockReturnValue(makeSaveListener({ success: true }));

      const playerStats = makePlayerStats({ spellAbilities: undefined, proficiency: 0 });
      await handle(makeAction(), playerStats, campaignName, null);

      expect(concentrationService.addConcentration).toHaveBeenCalledWith(
        summary,
        'TestCaster',
        'Faerie Fire',
        10,
      );
    });
  });
});
