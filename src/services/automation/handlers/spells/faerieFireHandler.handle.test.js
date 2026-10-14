import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './faerieFireHandler.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
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

vi.mock('../../common/damageRollback.js', () => ({
  storeSpellLastAttack: vi.fn(),
  addTargetResult: vi.fn(),
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

function makeSaveListener(promiseResult, promptId) {
  return { promptId: promptId || 'faerie-prompt', promise: Promise.resolve(promiseResult) };
}

function mockGetRuntimeValue(dispatch) {
  runtimeState.getRuntimeValue.mockImplementation((playerName, key, _cName) => dispatch(playerName, key, _cName));
}

describe('faerieFireHandler.handle', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('combat context validation', () => {
    it('should return popup when no combat context exists', async () => {
      damageUtils.getCombatContext.mockResolvedValue(null);
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No creatures in combat');
      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
    });

    it('should return popup when combat context has no creatures', async () => {
      damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No creatures in combat');
      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
    });

    it('should return popup when combat context has no creatures property', async () => {
      damageUtils.getCombatContext.mockResolvedValue({});
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No creatures in combat');
    });
  });

  describe('target processing', () => {
    it('should skip the caster itself from targets', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(14);
      savePrompt.createSaveListener.mockReturnValue(makeSaveListener({ success: true }));

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(savePrompt.createSaveListener).toHaveBeenCalledTimes(2);
    });

    it('should return early when all creatures are the caster', async () => {
      const onlyPlayerCombat = {
        creatures: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
        placedItems: [],
      };
      damageUtils.getCombatContext.mockResolvedValue(onlyPlayerCombat);
      savePrompt.createSaveListener.mockReturnValue(makeSaveListener({ success: true }));

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
      expect(result.payload.description).toContain('No creatures selected');
    });

    it('should report all targets saving successfully', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(20);
      savePrompt.createSaveListener.mockReturnValue(makeSaveListener({ success: true }));

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('2 creature(s) saved');
    });

    it('should report both affected and saved creatures in summary', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(14);
      mockGetRuntimeValue((playerName, key) => {
        if (key === 'targetEffects') return [];
        if (key === 'activeBuffs') return [];
        if (key === 'activeConditions') return [];
        return null;
      });

      let callCount = 0;
      savePrompt.createSaveListener.mockImplementation(() => {
        callCount++;
        return makeSaveListener({ success: callCount > 1 });
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('Faerie Fire affects 1 creature(s)');
      expect(result.payload.description).toContain('1 creature(s) saved');
    });

    it('should skip creatures with DEX immunity', async () => {
      const combatWithImmune = {
        ...baseCombatContext,
        creatures: [
          { name: 'Goblin', type: 'monster' },
          { name: 'IronGolem', type: 'monster', weaknessesAndResistivities: { immunities: ['DEX'] } },
          { name: 'TestCaster', gridX: 5, gridY: 10 },
        ],
      };
      damageUtils.getCombatContext.mockResolvedValue(combatWithImmune);
      savePrompt.buildSaveDc.mockReturnValue(14);
      savePrompt.createSaveListener.mockReturnValue(makeSaveListener({ success: false }));

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(savePrompt.createSaveListener).toHaveBeenCalledTimes(1);
      expect(result.payload.description).toContain('1 creature(s) immune');
    });

    it('should skip creatures with lowercase dex immunity', async () => {
      const combatWithImmune = {
        ...baseCombatContext,
        creatures: [
          { name: 'Goblin', type: 'monster' },
          { name: 'IronGolem', type: 'monster', weaknessesAndResistivities: { immunities: ['dex'] } },
          { name: 'TestCaster', gridX: 5, gridY: 10 },
        ],
      };
      damageUtils.getCombatContext.mockResolvedValue(combatWithImmune);
      savePrompt.buildSaveDc.mockReturnValue(14);
      savePrompt.createSaveListener.mockReturnValue(makeSaveListener({ success: false }));

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(savePrompt.createSaveListener).toHaveBeenCalledTimes(1);
      expect(result.payload.description).toContain('1 creature(s) immune');
    });

    it('should skip creatures with Dexterity immunity variant', async () => {
      const combatWithImmune = {
        ...baseCombatContext,
        creatures: [
          { name: 'Goblin', type: 'monster' },
          { name: 'IronGolem', type: 'monster', weaknessesAndResistivities: { immunities: ['Dexterity'] } },
          { name: 'TestCaster', gridX: 5, gridY: 10 },
        ],
      };
      damageUtils.getCombatContext.mockResolvedValue(combatWithImmune);
      savePrompt.buildSaveDc.mockReturnValue(14);
      savePrompt.createSaveListener.mockReturnValue(makeSaveListener({ success: false }));

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(savePrompt.createSaveListener).toHaveBeenCalledTimes(1);
      expect(result.payload.description).toContain('1 creature(s) immune');
    });

    it('should filter targets when metaCtx.targets is provided', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(14);
      savePrompt.createSaveListener.mockReturnValue(makeSaveListener({ success: false }));
      mockGetRuntimeValue((playerName, key) => {
        if (key === 'targetEffects') return [];
        if (key === 'activeBuffs') return [];
        if (key === 'activeConditions') return [];
        return null;
      });

      const action = { ...makeAction(), metaCtx: { targets: ['Goblin'] } };
      await handle(action, makePlayerStats(), campaignName, null);

      expect(savePrompt.createSaveListener).toHaveBeenCalledTimes(1);
      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({ targetName: 'Goblin' }),
      );
    });

    it('should return early when selected targets are empty after filtering', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(14);

      const action = { ...makeAction(), metaCtx: { targets: [] } };
      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
      expect(result.payload.description).toContain('No creatures selected');
    });

    it('should exclude caster from selected targets', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(14);
      savePrompt.createSaveListener.mockReturnValue(makeSaveListener({ success: true }));

      const action = { ...makeAction(), metaCtx: { targets: ['TestCaster', 'Goblin'] } };
      await handle(action, makePlayerStats(), campaignName, null);

      expect(savePrompt.createSaveListener).toHaveBeenCalledTimes(1);
      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({ targetName: 'Goblin' }),
      );
    });

    it('should apply disadvantage when metaCtx.heightenTarget matches', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(14);
      savePrompt.createSaveListener.mockReturnValue(makeSaveListener({ success: false }));
      mockGetRuntimeValue((playerName, key) => {
        if (key === 'targetEffects') return [];
        if (key === 'activeBuffs') return [];
        if (key === 'activeConditions') return [];
        return null;
      });

      const action = { ...makeAction(), metaCtx: { heightenTarget: 'Goblin' } };
      await handle(action, makePlayerStats(), campaignName, null);

      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({ targetName: 'Goblin', disadvantage: true }),
      );
      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({ targetName: 'Orc', disadvantage: false }),
      );
    });
  });

  describe('spell attack tracking', () => {
    it('should call storeSpellLastAttack with correct params', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      savePrompt.createSaveListener.mockReturnValue(makeSaveListener({ success: true }));

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(damageRollback.storeSpellLastAttack).toHaveBeenCalledWith(campaignName, {
        casterName: 'TestCaster',
        spellName: 'Faerie Fire',
        saveType: 'DEX',
        saveDc: 15,
        attackScope: 'aoe',
      });
    });
  });
});
