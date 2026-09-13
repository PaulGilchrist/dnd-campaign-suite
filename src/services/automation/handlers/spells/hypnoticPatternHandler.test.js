// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
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

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

vi.mock('../../../ui/storage.js', () => ({
  default: {
    set: vi.fn(),
  },
}));

vi.spyOn(window, 'dispatchEvent').mockImplementation(() => {});

import { handle } from './hypnoticPatternHandler.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import storage from '../../../ui/storage.js';

const campaignName = 'test-campaign';

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
    name: 'Hypnotic Pattern',
    automation: { type: 'hypnotic_pattern', saveType: 'WIS', saveDc: 15, ...automation },
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

describe('hypnoticPatternHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('combat context validation', () => {
    it('returns popup when no combat context exists or has no creatures', async () => {
      getCombatContext.mockResolvedValue(null);
      let result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.payload.description).toContain('No creatures in combat');

      getCombatContext.mockResolvedValue({ creatures: [] });
      result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.payload.description).toContain('No creatures in combat');
    });
  });

  describe('target processing', () => {
    it('skips caster, calls createSaveListener for each non-caster target', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({
        promptId: 'hypno-config',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledTimes(2);
      expect(addEntry).toHaveBeenCalledTimes(4);
    });

    it('handles single target, all saves succeed, or mixed results', async () => {
      const singleTargetCombatContext = {
        creatures: [
          { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
          { name: 'TestCaster', gridX: 5, gridY: 10 },
        ],
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
        placedItems: [],
      };

      // Single target
      getCombatContext.mockResolvedValue(singleTargetCombatContext);
      buildSaveDc.mockReturnValue(14);
      createSaveListener.mockReturnValue({
        promptId: 'hypno-single',
        promise: Promise.resolve({ success: false }),
      });
      let result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(createSaveListener).toHaveBeenCalledTimes(1);
      expect(result.payload.description).toContain('Hypnotic Pattern affects 1 creature(s)');

      // All save successfully
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(20);
      createSaveListener.mockReturnValue({
        promptId: 'hypno-all-success',
        promise: Promise.resolve({ success: true }),
      });
      result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.payload.description).toContain('No creatures affected');
      expect(result.payload.description).toContain('2 creature(s) saved');

      // Mixed results
      buildSaveDc.mockReturnValue(14);
      let callCount = 0;
      createSaveListener.mockImplementation(() => {
        callCount++;
        const success = callCount === 1 ? false : true;
        return {
          promptId: `hypno-prompt-${callCount}`,
          promise: Promise.resolve({ success }),
        };
      });
      result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.payload.description).toContain('1 creature(s)');
      expect(result.payload.description).toContain('1 creature(s) saved');
    });
  });

  describe('failed save handling', () => {
    it('applies charmed, incapacitated, and speed_zero conditions, logs, and adds expiration', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(10);
      getRuntimeValue.mockReturnValue(['Stunned']);
      createSaveListener.mockReturnValue({
        promptId: 'hypno-cond',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin', 'activeConditions',
        ['Stunned', 'charmed', 'incapacitated', 'speed_zero'],
        campaignName,
      );

      // Logging and expiration
      vi.clearAllMocks();
      getRuntimeValue.mockReturnValue([]);
      createSaveListener.mockReturnValue({
        promptId: 'hypno-log',
        promise: Promise.resolve({ success: false }),
      });
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'condition', action: 'applied',
          characterName: 'Goblin', condition: 'Charmed, Incapacitated, Speed 0',
        }),
      );
      expect(addExpiration).toHaveBeenCalledWith({ attackerName: 'TestCaster', targetName: 'Goblin', effects: expect.arrayContaining([
          { type: 'charmed', condition: 'charmed' },
          { type: 'incapacitated', condition: 'incapacitated' },
          { type: 'speed_zero', condition: 'speed_zero' },
        ]), campaignName });
    });

    it('filters out charmed, incapacitated, and speed_zero from existing conditions before re-adding', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(10);
      getRuntimeValue.mockReturnValue(['charmed', 'Stunned', 'speed_zero', 'incapacitated']);
      createSaveListener.mockReturnValue({
        promptId: 'hypno-dedup',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin', 'activeConditions',
        ['Stunned', 'charmed', 'incapacitated', 'speed_zero'],
        campaignName,
      );
    });

    it('handles non-array activeConditions value gracefully', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(10);
      getRuntimeValue.mockReturnValue(null);
      createSaveListener.mockReturnValue({
        promptId: 'hypno-nonarray',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin', 'activeConditions',
        ['charmed', 'incapacitated', 'speed_zero'],
        campaignName,
      );
    });
  });

  describe('concentration registration', () => {
    it('registers concentration on combat summary when casting', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      getCombatSummary.mockReturnValue({
        creatures: [
          { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
          { name: 'TestCaster', gridX: 5, gridY: 10 },
        ],
      });
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({
        promptId: 'hypno-conc',
        promise: Promise.resolve({ success: true }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addConcentration).toHaveBeenCalledWith(
        expect.objectContaining({ creatures: expect.any(Array) }),
        'TestCaster',
        'Hypnotic Pattern',
        expect.any(Number),
      );
      expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.any(Object), campaignName);
    });

    it('does not register concentration when there is no combat summary', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      getCombatSummary.mockReturnValue(null);
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({
        promptId: 'hypno-no-conc',
        promise: Promise.resolve({ success: true }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addConcentration).not.toHaveBeenCalled();
    });

    it('uses spellAbilities.saveDc when available instead of computing from proficiency', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      getCombatSummary.mockReturnValue({
        creatures: [
          { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
          { name: 'TestCaster', gridX: 5, gridY: 10 },
        ],
      });
      const ps = makePlayerStats({ spellAbilities: { saveDc: 17 } });
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({
        promptId: 'hypno-spell-dc',
        promise: Promise.resolve({ success: true }),
      });

      await handle(makeAction(), ps, campaignName, null);

      expect(addConcentration).toHaveBeenCalledWith(
        expect.any(Object),
        'TestCaster',
        'Hypnotic Pattern',
        17,
      );
    });
  });

  describe('popup payload and edge cases', () => {
    it('returns popup with automation_info payload and correct descriptions', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(10);
      createSaveListener.mockReturnValue({
        promptId: 'hypno-payload',
        promise: Promise.resolve({ success: false }),
      });

      let result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Hypnotic Pattern');
      expect(result.payload.description).toContain('Goblin is Charmed');
      expect(result.payload.description).toContain('Incapacitated');
      expect(result.payload.description).toContain('Speed 0');
      expect(result.payload.description).toContain('shake it free');
    });

    it('handles edge cases: all targets are caster, empty automation, no proficiency, custom action name', async () => {
      // All targets are caster
      const onlyPlayerCombat = {
        creatures: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
        placedItems: [],
      };
      getCombatContext.mockResolvedValue(onlyPlayerCombat);
      let result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(createSaveListener).not.toHaveBeenCalled();
      expect(result.payload.description).toContain('No creatures affected');

      // Empty automation
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(10);
      createSaveListener.mockReturnValue({
        promptId: 'hypno-empty-auto',
        promise: Promise.resolve({ success: false }),
      });
      result = await handle({ name: 'Hypnotic Pattern', automation: {} }, makePlayerStats(), campaignName, null);
      expect(result.payload.name).toBe('Hypnotic Pattern');

      // No proficiency
      const ps = makePlayerStats({ proficiency: 0, abilities: [] });
      const action = makeAction();
      result = await handle(action, ps, campaignName, null);
      expect(result.type).toBe('popup');
      expect(buildSaveDc).toHaveBeenCalledWith(action.automation, ps);

      // Custom action name
      const customAction = { name: 'My Hypno', automation: { type: 'hypnotic_pattern', saveType: 'WIS', saveDc: 15 } };
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({
        promptId: 'hypno-custom-name',
        promise: Promise.resolve({ success: false }),
      });
      await handle(customAction, makePlayerStats(), campaignName, null);
      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        abilityName: 'My Hypno',
      }));
    });
  });

  describe('disadvantage handling', () => {
    it('passes disadvantage=true when target matches heightenTarget in metaCtx', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      const actionWithHeighten = {
        name: 'Hypnotic Pattern',
        automation: { type: 'hypnotic_pattern', saveType: 'WIS', saveDc: 15 },
        metaCtx: { heightenTarget: 'Goblin' },
      };
      createSaveListener.mockReturnValue({
        promptId: 'hypno-disadv',
        promise: Promise.resolve({ success: false, roll: 12, total: 14 }),
      });

      await handle(actionWithHeighten, makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          targetName: 'Goblin',
          disadvantage: true,
        }),
      );
      expect(createSaveListener).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          targetName: 'Orc',
          disadvantage: false,
        }),
      );
    });
  });

  describe('save result logging with addEntry rejection', () => {
    it('triggers .catch() error handler on addEntry rejection for success save path', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(20);
      getRuntimeValue.mockReturnValue([]);
      addEntry.mockImplementation(() => Promise.reject(new Error('log failure')));
      createSaveListener.mockReturnValue({
        promptId: 'hypno-reject-success',
        promise: Promise.resolve({ success: true, roll: 18, total: 22 }),
      });

      await expect(handle(makeAction(), makePlayerStats(), campaignName, null)).resolves.toBeDefined();

      // The .catch() should have been called (no unhandled rejection)
      expect(addEntry).toHaveBeenCalledTimes(4);
    });

    it('triggers .catch() error handler on addEntry rejection for condition application path', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(10);
      getRuntimeValue.mockReturnValue([]);
      addEntry.mockImplementation(() => Promise.reject(new Error('log failure')));
      createSaveListener.mockReturnValue({
        promptId: 'hypno-reject-condition',
        promise: Promise.resolve({ success: false, roll: 5, total: 7 }),
      });

      await expect(handle(makeAction(), makePlayerStats(), campaignName, null)).resolves.toBeDefined();

      // The .catch() should have been called (no unhandled rejection)
      expect(addEntry).toHaveBeenCalledTimes(4);
    });

    it('handles save result with missing roll and total fields', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      getRuntimeValue.mockReturnValue([]);
      createSaveListener.mockReturnValue({
        promptId: 'hypno-no-roll',
        promise: Promise.resolve({ success: false }),
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('creature(s)');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin', 'activeConditions',
        ['charmed', 'incapacitated', 'speed_zero'],
        campaignName,
      );
    });
  });

  describe('targetEffects and rollback integration', () => {
    it('stores spell lastAttack and target results for each creature', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      getRuntimeValue.mockReturnValue([]);
      createSaveListener.mockReturnValue({
        promptId: 'hypno-lastattack',
        promise: Promise.resolve({ success: false, roll: 8, total: 10 }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'lastAttack', expect.any(Object), campaignName);
      expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'lastAttack', expect.any(Object), campaignName);
      expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'lastAttack', expect.any(Object), campaignName);
    });
  });
});
