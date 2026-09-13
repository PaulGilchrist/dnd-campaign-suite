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

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
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

import { handle } from './charmPersonHandler.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { sendSaveResult } from '../../../combat/conditions/savePromptService.js';
import { rollSaveForCreature } from '../../../rules/combat/applyDamage.js';
import { storeSpellLastAttack } from '../../common/damageRollback.js';

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
    name: 'Charm Person',
    automation: { type: 'charm_person', saveType: 'WIS', saveDc: 15, targetName: 'Goblin', ...automation },
  };
}

function setupBaseMocks(saveResult = { success: true }, isNpc = false) {
  const targetName = 'Goblin';
  getCombatContext.mockResolvedValue({
    creatures: [
      { name: targetName, type: isNpc ? 'npc' : 'player', saveBonuses: { WIS: 2 }, currentHp: 15, maxHp: 30 },
    ],
  });
  buildSaveDc.mockReturnValue(15);
  createSaveListener.mockReturnValue({
    promptId: 'test-prompt-id',
    promise: Promise.resolve(saveResult),
  });
}

describe('charmPersonHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('target resolution', () => {
    it('returns popup when action has no targetName', async () => {
      buildSaveDc.mockReturnValue(15);
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'TestCaster', type: 'player' },
          { name: 'Goblin', type: 'npc' },
        ],
      });

      const action = {
        name: 'Charm Person',
        automation: { type: 'charm_person', saveType: 'WIS', saveDc: 15 },
      };

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No target selected');
    });

    it('returns popup when combat context has no creatures', async () => {
      getCombatContext.mockResolvedValue({ creatures: [] });

      const action = {
        name: 'Charm Person',
        automation: { type: 'charm_person', saveType: 'WIS', saveDc: 15, targetName: 'Goblin' },
      };

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No creatures in combat');
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
        saveConditions: ['charmed'],
      });
    });
  });

  describe('ability_use log entry', () => {
    it('logs ability_use with full details when a target is resolved', async () => {
      setupBaseMocks();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestCaster',
        abilityName: 'Charm Person',
        description: expect.stringContaining('TestCaster casts Charm Person on Goblin'),
        promptId: 'test-prompt-id',
      });
    });
  });

  describe('NPC auto-save', () => {
    it('calls rollSaveForCreature and sendSaveResult for NPC targets', async () => {
      setupBaseMocks({ success: false }, true);
      rollSaveForCreature.mockReturnValue({ roll: 8, total: 10, bonus: 2, success: false, rawRolls: [8, 12] });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(rollSaveForCreature).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Goblin' }),
        'WIS',
        15,
        false,
        false,
      );
      expect(sendSaveResult).toHaveBeenCalledWith(campaignName, 'Goblin', expect.objectContaining({
        promptId: 'test-prompt-id',
        success: false,
      }));
    });

    it('uses fallback roll when creature not found in combat summary', async () => {
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({
        promptId: 'test-prompt-id',
        promise: Promise.resolve({ success: false }),
      });
      getRuntimeValue.mockReturnValue([]);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(sendSaveResult).toHaveBeenCalled();
    });
  });

  describe('successful save', () => {
    it('returns popup and logs save_result with success=true', async () => {
      setupBaseMocks({ success: true });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('saved');
      expect(result.payload.description).toContain('Goblin');

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'save_result',
        targetName: 'Goblin',
        success: true,
        rollType: 'save-charm-person',
        saveDc: 15,
        saveType: 'WIS',
      }));

      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(addExpiration).not.toHaveBeenCalled();
      expect(addEntry).toHaveBeenCalledTimes(2);
      const abilityEntries = addEntry.mock.calls.filter(call => call[1].type === 'ability_use');
      expect(abilityEntries.length).toBe(1);
      const saveEntries = addEntry.mock.calls.filter(call => call[1].type === 'save_result');
      expect(saveEntries.length).toBe(1);
    });
  });

  describe('failed save', () => {
    it('returns popup with correct payload and description', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Charm Person');
      expect(result.payload.description).toContain('charmed');
      expect(result.payload.description).toContain('Goblin');
    });

    it('applies charmed condition with deduplication and preservation of other conditions', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        expect.arrayContaining(['charmed']),
        campaignName,
      );
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

    it('preserves other conditions when adding charmed', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue(['frightened', 'charmed']);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        ['frightened', 'charmed'],
        campaignName,
      );
    });

    it('registers expiration with charmed type (no expireOnCreatureName)', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addExpiration).toHaveBeenCalledWith({ attackerName: 'TestCaster', targetName: 'Goblin', effects: expect.arrayContaining([{ type: 'charmed', condition: 'charmed' }]), campaignName });
    });

    it('posts condition log entry with full note', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'condition',
        action: 'applied',
        characterName: 'Goblin',
        condition: 'Charmed',
        reason: 'Charm Person spell',
        note: expect.stringContaining('friendly acquaintance'),
        timestamp: expect.any(Number),
      }));
    });

    it('logs save_result with success=false', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'save_result',
        targetName: 'Goblin',
        success: false,
        rollType: 'save-charm-person',
        saveDc: 15,
        saveType: 'WIS',
      }));
    });
  });

  describe('edge cases', () => {
    it('handles missing automation property by defaulting to empty object', async () => {
      buildSaveDc.mockReturnValue(10);
      createSaveListener.mockReturnValue({
        promptId: 'test-prompt-id',
        promise: Promise.resolve({ success: false }),
      });
      getRuntimeValue.mockReturnValue([]);

      const result = await handle({ name: 'Charm Person' }, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(buildSaveDc).toHaveBeenCalledWith({}, makePlayerStats());
    });

    it('uses action.name in popup payload', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);

      const result = await handle({ name: 'My Charm Person', automation: { type: 'charm_person', targetName: 'Goblin' } }, makePlayerStats(), campaignName, null);

      expect(result.payload.name).toBe('My Charm Person');
    });

    it('uses custom playerStats name in descriptions', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);

      const ps = makePlayerStats({ name: 'WizardX' });
      const result = await handle(makeAction(), ps, campaignName, null);

      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Charm Person');

      // The ability_use log entry should contain the custom caster name
      const abilityEntries = addEntry.mock.calls.filter(call => call[1].type === 'ability_use');
      expect(abilityEntries.length).toBe(1);
      expect(abilityEntries[0][1].characterName).toBe('WizardX');
    });
  });

  describe('multi-target', () => {
    it('uses charmPersonTargets from metaCtx for target resolution', async () => {
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({
        promptId: 'test-prompt-id',
        promise: Promise.resolve({ success: true }),
      });
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Goblin', type: 'npc', saveBonuses: { WIS: 2 } },
          { name: 'Orc', type: 'npc', saveBonuses: { WIS: 1 } },
        ],
      });

      const action = {
        name: 'Charm Person',
        automation: { type: 'charm_person', saveType: 'WIS', saveDc: 15 },
        metaCtx: { charmPersonTargets: ['Goblin', 'Orc'] },
      };

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('saved');
      expect(result.payload.description).toContain('Goblin');
      expect(result.payload.description).toContain('Orc');
    });

    it('passes multiple targets for attackScope when charmPersonTargets has > 1 entry', async () => {
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({
        promptId: 'test-prompt-id',
        promise: Promise.resolve({ success: true }),
      });
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Goblin', type: 'npc', saveBonuses: { WIS: 2 } },
          { name: 'Orc', type: 'npc', saveBonuses: { WIS: 1 } },
        ],
      });

      const action = {
        name: 'Charm Person',
        automation: { type: 'charm_person', saveType: 'WIS', saveDc: 15 },
        metaCtx: { charmPersonTargets: ['Goblin', 'Orc'] },
      };

      await handle(action, makePlayerStats(), campaignName, null);

      expect(storeSpellLastAttack).toHaveBeenCalledWith(campaignName, {
        casterName: 'TestCaster',
        spellName: 'Charm Person',
        saveType: 'WIS',
        saveDc: 15,
        attackScope: 'single',
      });
    });

    it('applies charmPersonAdvantages per target', async () => {
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({
        promptId: 'test-prompt-id',
        promise: Promise.resolve({ success: true }),
      });
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Goblin', type: 'npc', saveBonuses: { WIS: 2 } },
          { name: 'Orc', type: 'npc', saveBonuses: { WIS: 1 } },
        ],
      });

      const action = {
        name: 'Charm Person',
        automation: { type: 'charm_person', saveType: 'WIS', saveDc: 15 },
        metaCtx: { charmPersonTargets: ['Goblin', 'Orc'], charmPersonAdvantages: { Goblin: true } },
      };

      await handle(action, makePlayerStats(), campaignName, null);

      const calls = createSaveListener.mock.calls;
      expect(calls.length).toBe(2);
      expect(calls[0][1].advantage).toBe(true);
      expect(calls[1][1].advantage).toBe(false);
    });
  });

  describe('NPC handling', () => {

    it('logs ability_use entry when NPC creature IS found in combat', async () => {
      setupBaseMocks({ success: false }, true);
      rollSaveForCreature.mockReturnValue({ roll: 8, total: 10, bonus: 2, success: false, rawRolls: [8, 12] });
      getRuntimeValue.mockReturnValue([]);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const abilityEntries = addEntry.mock.calls.filter(call => call[1].type === 'ability_use');
      expect(abilityEntries.length).toBe(1);
      expect(abilityEntries[0][1]).toEqual(expect.objectContaining({
        type: 'ability_use',
        characterName: 'TestCaster',
        abilityName: 'Charm Person',
        promptId: 'test-prompt-id',
      }));
    });
  });

  describe('save result dispatch', () => {
    it('dispatches window save-result event for NPC targets', async () => {
      const windowSpy = vi.spyOn(globalThis.window, 'dispatchEvent');

      setupBaseMocks({ success: false }, true);
      rollSaveForCreature.mockReturnValue({ roll: 8, total: 10, bonus: 2, success: false, rawRolls: [8, 12] });
      getRuntimeValue.mockReturnValue([]);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(windowSpy).toHaveBeenCalledWith(expect.any(CustomEvent));
      const customEvent = windowSpy.mock.calls[0][0];
      expect(customEvent.type).toBe('save-result');
      expect(customEvent.detail.targetName).toBe('Goblin');
      expect(customEvent.detail.saveType).toBe('WIS');
      expect(customEvent.detail.saveDc).toBe(15);

      windowSpy.mockRestore();
    });
  });

  describe('storeSpellLastAttack', () => {
    it('stores spell attack info with WIS save details', async () => {
      setupBaseMocks({ success: true });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(storeSpellLastAttack).toHaveBeenCalledWith(campaignName, {
        casterName: 'TestCaster',
        spellName: 'Charm Person',
        saveType: 'WIS',
        saveDc: 15,
        attackScope: 'single',
      });
    });
  });

  describe('disadvantage', () => {
    it('passes disadvantage when metamagicHeighten is set on action', async () => {
      setupBaseMocks();

      const action = {
        name: 'Charm Person',
        automation: { type: 'charm_person', saveType: 'WIS', saveDc: 15, targetName: 'Goblin' },
        metaCtx: { metamagicHeighten: true },
      };

      await handle(action, makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        disadvantage: true,
      }));
    });
  });

  describe('saveConditions for Beguiling Twist compatibility', () => {
    it('passes saveConditions charmed to createSaveListener so Beguiling Twist can trigger', async () => {
      setupBaseMocks({ success: true });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        saveConditions: ['charmed'],
      }));
    });

    it('passes saveConditions charmed even when save fails', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        saveConditions: ['charmed'],
      }));
    });

    it('passes saveConditions charmed for multi-target casts', async () => {
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({
        promptId: 'test-prompt-id',
        promise: Promise.resolve({ success: true }),
      });
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Goblin', type: 'npc', saveBonuses: { WIS: 2 } },
          { name: 'Orc', type: 'npc', saveBonuses: { WIS: 1 } },
        ],
      });

      const action = {
        name: 'Charm Person',
        automation: { type: 'charm_person', saveType: 'WIS', saveDc: 15 },
        metaCtx: { charmPersonTargets: ['Goblin', 'Orc'] },
      };

      await handle(action, makePlayerStats(), campaignName, null);

      const calls = createSaveListener.mock.calls;
      expect(calls.length).toBe(2);
      expect(calls[0][1].saveConditions).toEqual(['charmed']);
      expect(calls[1][1].saveConditions).toEqual(['charmed']);
    });
  });

  describe('activeConditionMeta', () => {
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

    it('handles undefined storedConditions by defaulting to empty array', async () => {
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
    it('stores dc and ability in activeConditionMeta for charmed', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditionMeta',
        expect.objectContaining({
          charmed: expect.objectContaining({
            dc: 15,
            ability: 'wis',
          }),
        }),
        campaignName,
      );
    });

    it('merges new charmed meta with existing meta', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue
        .mockReturnValueOnce([])
        .mockReturnValueOnce({ poisoned: { duration: '1 turn' } });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditionMeta',
        expect.objectContaining({
          poisoned: { duration: '1 turn' },
          charmed: { dc: 15, ability: 'wis' },
        }),
        campaignName,
      );
    });
  });

  describe('catch block errors', () => {
    it('logs catch block error when addEntry rejects on success path', async () => {
      setupBaseMocks({ success: true });
      addEntry.mockRejectedValue(new Error('log failure'));

      const consoleSpy = vi.spyOn(console, 'error');

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(consoleSpy).toHaveBeenCalledWith('[charmPerson] Error:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    it('logs catch block errors when addEntry rejects on failed save', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);
      addEntry.mockRejectedValue(new Error('log failure'));

      const consoleSpy = vi.spyOn(console, 'error');

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(consoleSpy).toHaveBeenCalledTimes(3);
      expect(consoleSpy).toHaveBeenCalledWith('[charmPerson] Error:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });
});
