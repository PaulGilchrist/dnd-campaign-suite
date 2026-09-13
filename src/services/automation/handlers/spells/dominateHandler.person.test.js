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

vi.mock('../../common/damageRollback.js', () => ({
  storeSpellLastAttack: vi.fn(),
  addTargetResult: vi.fn(() => Promise.resolve()),
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

vi.mock('../../../rules/combat/applyDamage.js', () => ({
  rollSaveForCreature: vi.fn(),
}));

vi.mock('../../../combat/conditions/savePromptService.js', () => ({
  sendSaveResult: vi.fn(),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(() => 10),
}));

import { handle } from './dominateHandler.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { rollSaveForCreature } from '../../../rules/combat/applyDamage.js';
import { sendSaveResult } from '../../../combat/conditions/savePromptService.js';
import { rollD20 } from '../../../dice/diceRoller.js';
import { storeSpellLastAttack } from '../../common/damageRollback.js';
import { addTargetResult } from '../../common/damageRollback.js';

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
    name: 'Dominate Person',
    automation: { type: 'dominate_person', saveType: 'WIS', saveDc: 15, ...automation },
  };
}

function setupBaseMocks(saveResult = { success: true }, isNpc = false) {
  resolveTarget.mockResolvedValue({
    target: { name: 'Goblin', type: isNpc ? 'npc' : 'player' },
    cs: {
      creatures: [
        { name: 'Goblin', type: isNpc ? 'npc' : 'player', saveBonuses: { WIS: 2 } },
      ],
    },
  });
  buildSaveDc.mockReturnValue(15);
  createSaveListener.mockReturnValue({
    promptId: 'test-prompt-id',
    promise: Promise.resolve(saveResult),
  });
}

describe('dominateHandler.handle (Dominate Person)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('target resolution', () => {
    it('returns popup when no target is selected', async () => {
      resolveTarget.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No target selected');
    });

    it('returns popup when target resolves to empty target object', async () => {
      resolveTarget.mockResolvedValue({ target: null });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No target selected');
    });

    it('passes advantage from automation config to createSaveListener', async () => {
      setupBaseMocks();

      await handle(makeAction({ advantage: true }), makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        attackerName: 'TestCaster',
        saveType: 'WIS',
        saveDc: 15,
        dcSuccess: 'none',
        advantage: true,
        disadvantage: false,
        condition: 'charmed',
      });
    });

    it('passes disadvantage when metamagicHeighten is set on action', async () => {
      resolveTarget.mockResolvedValue({
        target: { name: 'Goblin', type: 'player' },
        cs: { creatures: [] },
      });
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({
        promptId: 'test-prompt-id',
        promise: Promise.resolve({ success: true }),
      });

      const action = {
        name: 'Dominate Person',
        automation: { type: 'dominate_person', saveType: 'WIS', saveDc: 15 },
        metaCtx: { metamagicHeighten: true },
      };

      await handle(action, makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        disadvantage: true,
      }));
    });
  });

  describe('successful save', () => {
    it('returns popup and logs save_result with success=true', async () => {
      setupBaseMocks({ success: true });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('succeeded on WIS save');
      expect(result.payload.description).toContain('Goblin');
      expect(result.payload.description).toContain('DC 15');

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'save_result',
        targetName: 'Goblin',
        success: true,
        rollType: 'save-dominate-person',
        saveDc: 15,
        saveType: 'WIS',
      }));

      expect(addExpiration).not.toHaveBeenCalled();
    });

    it('calls addTargetResult with success details', async () => {
      setupBaseMocks({ success: true, roll: 18, total: 20, bonus: 2 });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveResult: 'success',
        roll: 18,
        total: 20,
        conditions: [],
        appliedDamage: 0,
      });
    });

    it('handles saveResult with missing roll/total using nullish coalescing', async () => {
      setupBaseMocks({ success: true });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addTargetResult).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        roll: 0,
        total: 0,
      }));
    });

    it('logs catch block error when addEntry rejects on success path', async () => {
      setupBaseMocks({ success: true });
      addEntry.mockRejectedValue(new Error('log failure'));

      const consoleSpy = vi.spyOn(console, 'error');

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(consoleSpy).toHaveBeenCalledWith('[Dominate Person] Error:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('failed save', () => {
    it('applies charmed condition and registers dominated expiration', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        expect.arrayContaining(['charmed']),
        campaignName,
      );

      expect(addExpiration).toHaveBeenCalledWith({ attackerName: 'TestCaster', targetName: 'Goblin', effects: expect.arrayContaining([{ type: 'dominated', condition: 'charmed' }]), campaignName });

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'save_result',
        targetName: 'Goblin',
        success: false,
        rollType: 'save-dominate-person',
        saveDc: 15,
        saveType: 'WIS',
      }));

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'condition',
        action: 'applied',
        characterName: 'Goblin',
        condition: 'Charmed',
        reason: 'Dominate Person spell',
      }));
    });

    it('deduplicates charmed when already present', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue(['charmed']);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        ['charmed'],
        campaignName,
      );
    });

    it('filters out charmed and adds it back when mixed with other conditions', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue(['frightened', 'charmed', 'poisoned']);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        ['frightened', 'poisoned', 'charmed'],
        campaignName,
      );
    });

    it('handles non-array storedConditions by defaulting to empty array', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue('not-an-array');

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        ['charmed'],
        campaignName,
      );
    });

    it('handles undefined getRuntimeValue by defaulting to empty array', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue(undefined);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        ['charmed'],
        campaignName,
      );
    });

    it('returns popup with failure details', async () => {
      setupBaseMocks({ success: false, roll: 5, total: 7, bonus: 2 });
      getRuntimeValue.mockReturnValue([]);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('failed WIS save');
      expect(result.payload.description).toContain('DC 15');
      expect(result.payload.description).toContain('is Charmed');
    });

    it('calls addTargetResult with failure details', async () => {
      setupBaseMocks({ success: false, roll: 3, total: 5, bonus: 2 });
      getRuntimeValue.mockReturnValue([]);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveResult: 'failure',
        roll: 3,
        total: 5,
        conditions: ['charmed'],
        appliedDamage: 0,
      });
    });

    it('logs catch block errors when addEntry rejects on failed save', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);
      addEntry.mockRejectedValue(new Error('log failure'));

      const consoleSpy = vi.spyOn(console, 'error');

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      // Should have 3 console.error calls (condition, save_result, and original ability_use)
      expect(consoleSpy).toHaveBeenCalledTimes(3);
      expect(consoleSpy).toHaveBeenCalledWith('[Dominate Person] Error:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('NPC handling', () => {
    it('calls dispatchSaveResult via sendSaveResult + window event for NPC targets', async () => {
      const windowSpy = vi.spyOn(globalThis.window, 'dispatchEvent');

      resolveTarget.mockResolvedValue({
        target: { name: 'Goblin', type: 'npc' },
        cs: {
          creatures: [
            { name: 'Goblin', type: 'npc', saveBonuses: { WIS: 2 } },
          ],
        },
      });
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({
        promptId: 'npc-prompt-id',
        promise: Promise.resolve({ success: false }),
      });
      getRuntimeValue.mockReturnValue([]);
      rollSaveForCreature.mockReturnValue({
        roll: 8,
        total: 10,
        bonus: 2,
        success: false,
        rawRolls: [8],
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(rollSaveForCreature).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Goblin' }),
        'WIS',
        15,
        false,
        false,
      );

      expect(sendSaveResult).toHaveBeenCalledWith(campaignName, 'Goblin', {
        promptId: 'npc-prompt-id',
        success: false,
        roll: 8,
        total: 10,
        saveBonus: 2,
        rawRolls: [8],
      });

      expect(windowSpy).toHaveBeenCalledWith(expect.any(CustomEvent));
      const customEvent = windowSpy.mock.calls[0][0];
      expect(customEvent.type).toBe('save-result');
      expect(customEvent.detail.targetName).toBe('Goblin');
      expect(customEvent.detail.saveType).toBe('WIS');

      windowSpy.mockRestore();
    });

    it('uses fallback rollD20 when creature not found in cs.creatures for NPC', async () => {
      const windowSpy = vi.spyOn(globalThis.window, 'dispatchEvent');

      resolveTarget.mockResolvedValue({
        target: { name: 'Goblin', type: 'npc' },
        cs: {
          creatures: [],
        },
      });
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({
        promptId: 'npc-prompt-id',
        promise: Promise.resolve({ success: false }),
      });
      getRuntimeValue.mockReturnValue([]);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(rollD20).toHaveBeenCalledTimes(2);

      expect(sendSaveResult).toHaveBeenCalledWith(campaignName, 'Goblin', expect.objectContaining({
        saveBonus: 0,
      }));

      windowSpy.mockRestore();
    });

    it('uses advantage in fallback rollD20 for NPC without creature', async () => {
      resolveTarget.mockResolvedValue({
        target: { name: 'Goblin', type: 'npc' },
        cs: {
          creatures: [],
        },
      });
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({
        promptId: 'npc-prompt-id',
        promise: Promise.resolve({ success: false }),
      });
      getRuntimeValue.mockReturnValue([]);

      rollD20.mockReturnValueOnce(3).mockReturnValueOnce(7);

      await handle(makeAction({ advantage: true }), makePlayerStats(), campaignName, null);

      // With advantage, should use max(3, 7) = 7
      expect(rollD20).toHaveBeenCalledTimes(2);
      // verify the save result used the higher roll
      expect(sendSaveResult).toHaveBeenCalledWith(campaignName, 'Goblin', expect.objectContaining({
        total: 7,
      }));

      rollD20.mockRestore();
    });
  });

  describe('storeSpellLastAttack', () => {
    it('stores spell attack info with WIS save details', async () => {
      setupBaseMocks({ success: true });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(storeSpellLastAttack).toHaveBeenCalledWith(campaignName, {
        casterName: 'TestCaster',
        spellName: 'Dominate Person',
        saveType: 'WIS',
        saveDc: 15,
        attackScope: 'single',
      });
    });
  });

  describe('edge cases', () => {
    it('handles missing automation property by defaulting to empty object', async () => {
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin', type: 'player' } });
      buildSaveDc.mockReturnValue(10);
      createSaveListener.mockReturnValue({
        promptId: 'test-prompt-id',
        promise: Promise.resolve({ success: false }),
      });
      getRuntimeValue.mockReturnValue([]);

      const result = await handle({ name: 'Dominate Person' }, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(buildSaveDc).toHaveBeenCalledWith({}, makePlayerStats());
    });

    it('logs ability_use entry with advantage text', async () => {
      setupBaseMocks({ success: true });

      await handle(makeAction({ advantage: true }), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'ability_use',
        description: expect.stringContaining('with Advantage'),
      }));
    });

    it('logs ability_use entry without advantage text when not set', async () => {
      setupBaseMocks({ success: true });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'ability_use',
        description: expect.stringContaining('DC 15'),
      }));
      expect(addEntry.mock.calls[0][1].description).not.toContain('with Advantage');
    });
  });
});
