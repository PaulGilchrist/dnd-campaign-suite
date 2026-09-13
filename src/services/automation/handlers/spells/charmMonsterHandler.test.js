// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../automation/common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../../automation/common/damageRollback.js', () => ({
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

import { handle } from './charmMonsterHandler.js';
import { buildSaveDc, createSaveListener } from '../../../automation/common/savePrompt.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { sendSaveResult } from '../../../combat/conditions/savePromptService.js';
import { rollSaveForCreature } from '../../../rules/combat/applyDamage.js';

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
    name: 'Charm Monster',
    automation: { type: 'charm_monster', saveType: 'WIS', saveDc: 15, ...automation },
    targetName: 'Goblin',
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

describe('charmMonsterHandler.handle', () => {
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
        name: 'Charm Monster',
        automation: { type: 'charm_monster', saveType: 'WIS', saveDc: 15 },
      };

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No target selected');
    });

    it('returns popup when combat context has no creatures', async () => {
      getCombatContext.mockResolvedValue({ creatures: [] });

      const action = {
        name: 'Charm Monster',
        automation: { type: 'charm_monster', saveType: 'WIS', saveDc: 15, targetName: 'Goblin' },
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
        abilityName: 'Charm Monster',
        description: expect.stringContaining('TestCaster casts Charm Monster on Goblin'),
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
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'OtherCreature', type: 'player' },
        ],
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(sendSaveResult).not.toHaveBeenCalled();
    });

    it('handles addEntry rejection on success path', async () => {
      setupBaseMocks({ success: true });
      addEntry.mockReturnValue(Promise.reject(new Error('log error')));

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalled();
    });

    it('handles addEntry rejection on condition path', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);
      addEntry.mockReturnValue(Promise.reject(new Error('log error')));

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalled();
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
        rollType: 'save-charm-monster',
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
      expect(result.payload.name).toBe('Charm Monster');
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
        reason: 'Charm Monster spell',
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
        rollType: 'save-charm-monster',
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

      const result = await handle({ name: 'Charm Monster' }, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(buildSaveDc).toHaveBeenCalledWith({}, makePlayerStats());
    });

    it('uses action.name in popup payload', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);

      const result = await handle({ name: 'My Charm Monster', automation: { type: 'charm_monster' } }, makePlayerStats(), campaignName, null);

      expect(result.payload.name).toBe('My Charm Monster');
    });

    it('uses custom playerStats name in descriptions', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);

      const ps = makePlayerStats({ name: 'WizardX' });
      const result = await handle(makeAction(), ps, campaignName, null);

      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Charm Monster');

      // The ability_use log entry should contain the custom caster name
      const abilityEntries = addEntry.mock.calls.filter(call => call[1].type === 'ability_use');
      expect(abilityEntries.length).toBe(1);
      expect(abilityEntries[0][1].characterName).toBe('WizardX');
    });

    it('uses charmMonsterTargets from metaCtx for multi-target', async () => {
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({
        promptId: 'test-prompt-id',
        promise: Promise.resolve({ success: false }),
      });
      getRuntimeValue.mockReturnValue([]);
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Goblin', type: 'npc' },
          { name: 'Orc', type: 'npc' },
        ],
      });

      const action = {
        name: 'Charm Monster',
        automation: { type: 'charm_monster', saveType: 'WIS', saveDc: 15 },
        metaCtx: {
          charmMonsterTargets: ['Goblin', 'Orc'],
        },
      };

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('2 creature(s) charmed');
      expect(result.payload.description).toContain('Goblin');
      expect(result.payload.description).toContain('Orc');
      expect(createSaveListener).toHaveBeenCalledTimes(2);
      expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({ targetName: 'Goblin' }));
      expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({ targetName: 'Orc' }));
    });

    it('uses charmMonsterAdvantages from metaCtx per-target', async () => {
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({
        promptId: 'test-prompt-id',
        promise: Promise.resolve({ success: false }),
      });
      getRuntimeValue.mockReturnValue([]);
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Goblin', type: 'npc' },
        ],
      });

      const action = {
        name: 'Charm Monster',
        automation: { type: 'charm_monster', saveType: 'WIS', saveDc: 15 },
        metaCtx: {
          charmMonsterTargets: ['Goblin'],
          charmMonsterAdvantages: { Goblin: true },
        },
      };

      await handle(action, makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        advantage: true,
      }));
    });

    it('uses metamagicHeighten to set disadvantage', async () => {
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({
        promptId: 'test-prompt-id',
        promise: Promise.resolve({ success: false }),
      });
      getRuntimeValue.mockReturnValue([]);
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Goblin', type: 'npc' },
        ],
      });

      const action = {
        name: 'Charm Monster',
        automation: { type: 'charm_monster', saveType: 'WIS', saveDc: 15 },
        targetName: 'Goblin',
        metaCtx: {
          metamagicHeighten: true,
        },
      };

      await handle(action, makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        disadvantage: true,
      }));
    });

    it('returns summary with no creatures charmed when all save successfully', async () => {
      setupBaseMocks({ success: true });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('No creatures charmed');
      expect(result.payload.description).toContain('saved');
    });
  });
});
