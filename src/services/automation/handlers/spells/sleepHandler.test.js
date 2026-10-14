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

vi.mock('../../common/damageRollback.js', () => ({
  storeSpellLastAttack: vi.fn(),
  addTargetResult: vi.fn(),
}));

vi.mock('../../../rules/features/sleepService.js', () => ({
  isSleepImmune: vi.fn(() => Promise.resolve(false)),
  stageSleepTargets: vi.fn(() => Promise.resolve([])),
}));

import { handle } from './sleepHandler.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { addEntry } from '../../../ui/logService.js';
import { storeSpellLastAttack, addTargetResult } from '../../common/damageRollback.js';
import { isSleepImmune, stageSleepTargets } from '../../../rules/features/sleepService.js';

const campaignName = 'test-campaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Intelligence', bonus: 5 }],
    spellAbilities: { saveDc: 17 },
    ...overrides,
  };
}

function makeAction(automation = {}, metaCtx = undefined) {
  return {
    name: 'Sleep',
    automation: { type: 'sleep', saveType: 'WIS', saveDc: 'spell_save_dc', ...automation },
    ...(metaCtx ? { metaCtx } : {}),
  };
}

const baseCombatContext = {
  creatures: [
    { name: 'Thug 1', type: 'npc', monsterType: 'Humanoid', currentHp: 32, maxHp: 32, saveBonuses: { wis: 0 } },
    { name: 'Zombie 1', type: 'npc', monsterType: 'Undead', currentHp: 22, maxHp: 22, saveBonuses: { wis: 0 } },
    { name: 'TestCaster', type: 'player', gridX: 5, gridY: 10 },
  ],
  players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
  placedItems: [],
};

function npcRollFail() {
  vi.spyOn(Math, 'random').mockReturnValue(0);
}

function npcRollSuccess() {
  vi.spyOn(Math, 'random').mockReturnValue(0.999);
}

describe('sleepHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    isSleepImmune.mockResolvedValue(false);
    buildSaveDc.mockReturnValue(17);
  });

  describe('combat context validation', () => {
    it('returns popup when no combat context exists', async () => {
      getCombatContext.mockResolvedValue(null);
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No creatures in combat');
    });

    it('returns popup when combat context has no creatures', async () => {
      getCombatContext.mockResolvedValue({ creatures: [] });
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.payload.description).toContain('No creatures in combat');
    });

    it('returns popup when selected targets resolve to none valid', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      const result = await handle(makeAction({}, { selectedTargets: ['TestCaster'] }), makePlayerStats(), campaignName, null);
      expect(result.payload.description).toContain('No valid targets selected');
    });
  });

  describe('target selection', () => {
    it('skips the caster and processes the other creatures', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      npcRollSuccess();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const loggedTargets = addEntry.mock.calls
        .map(c => c[1])
        .filter(e => e && e.type === 'save_result')
        .map(e => e.targetName);
      expect(loggedTargets).toEqual(['Thug 1', 'Zombie 1']);
    });

    it('restricts processing to metaCtx.selectedTargets when provided', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      npcRollSuccess();

      await handle(makeAction({}, { selectedTargets: ['Thug 1'] }), makePlayerStats(), campaignName, null);

      expect(createSaveListener).not.toHaveBeenCalled();
      const loggedTargets = addEntry.mock.calls
        .map(c => c[1])
        .filter(e => e && e.type === 'save_result')
        .map(e => e.targetName);
      expect(loggedTargets).toEqual(['Thug 1']);
    });

    it('prefers metaCtx.spellSaveDc over buildSaveDc', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      npcRollSuccess();

      await handle(makeAction({}, { spellSaveDc: 19 }), makePlayerStats(), campaignName, null);

      const castLog = addEntry.mock.calls.map(c => c[1]).find(e => e && e.type === 'ability_use');
      expect(castLog.description).toContain('DC 19');
    });
  });

  describe('immunity gate', () => {
    it('auto-succeeds immune creatures without rolling or staging', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      npcRollFail();
      isSleepImmune.mockImplementation(async (_cn, creature) => creature.name === 'Zombie 1');

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      const autoLog = addEntry.mock.calls
        .map(c => c[1])
        .find(e => e && e.type === 'save_result' && e.targetName === 'Zombie 1');
      expect(autoLog.success).toBe(true);
      expect(autoLog.description).toContain('automatically succeeds');

      expect(stageSleepTargets).toHaveBeenCalledTimes(1);
      expect(stageSleepTargets.mock.calls[0][2]).toEqual(['Thug 1']);
      expect(result.payload.description).toContain('1 auto-succeeded');
    });

    it('consults isSleepImmune with characters for player targets', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Elf', type: 'player' },
          { name: 'TestCaster', type: 'player' },
        ],
      });
      isSleepImmune.mockResolvedValue(true);
      const characters = [{ name: 'Elf', computedStats: { name: 'Elf' } }];

      await handle(makeAction(), makePlayerStats(), campaignName, null, characters);

      expect(isSleepImmune).toHaveBeenCalledWith(campaignName, expect.objectContaining({ name: 'Elf' }), characters);
      expect(createSaveListener).not.toHaveBeenCalled();
    });
  });

  describe('npc saves', () => {
    it('auto-rolls a WIS save for NPCs and logs the result', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      npcRollFail();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(createSaveListener).not.toHaveBeenCalled();
      const failLog = addEntry.mock.calls
        .map(c => c[1])
        .find(e => e && e.type === 'save_result' && e.targetName === 'Thug 1');
      expect(failLog.success).toBe(false);
      expect(failLog.saveType).toBe('WIS');
      expect(failLog.saveDc).toBe(17);
    });

    it('applies no staging when every target saves', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      npcRollSuccess();

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(stageSleepTargets).not.toHaveBeenCalled();
      expect(result.payload.description).toContain('0 Incapacitated');
    });

    it('stages failed saves with the real DC and logs Incapacitated per target', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Thug 1', type: 'npc', monsterType: 'Humanoid', saveBonuses: { wis: 0 } },
          { name: 'TestCaster', type: 'player' },
        ],
      });
      npcRollFail();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(stageSleepTargets).toHaveBeenCalledWith(campaignName, 'TestCaster', ['Thug 1'], 17);

      const condLog = addEntry.mock.calls
        .map(c => c[1])
        .find(e => e && e.type === 'condition' && e.action === 'applied');
      expect(condLog).toMatchObject({ characterName: 'Thug 1', condition: 'Incapacitated' });
      expect(condLog.note).toContain('end of its next turn');

      expect(addTargetResult).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        targetName: 'Thug 1',
        saveResult: 'failure',
        conditions: ['incapacitated'],
      }));
    });
  });

  describe('player saves', () => {
    it('prompts player targets and stages them on a failed prompt save', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'PlayerB', type: 'player', saveBonuses: { wis: 2 } },
          { name: 'TestCaster', type: 'player' },
        ],
      });
      createSaveListener.mockReturnValue({
        promptId: 'sleep-prompt',
        promise: Promise.resolve({ success: false, roll: 4, saveBonus: 2, total: 6 }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        targetName: 'PlayerB',
        saveType: 'WIS',
        saveDc: 17,
      }));
      expect(stageSleepTargets).toHaveBeenCalledWith(campaignName, 'TestCaster', ['PlayerB'], 17);

      const failLog = addEntry.mock.calls
        .map(c => c[1])
        .find(e => e && e.type === 'save_result');
      expect(failLog).toMatchObject({ targetName: 'PlayerB', success: false, roll: 4, total: 6 });
    });

    it('applies heighten disadvantage to the chosen player target', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'PlayerB', type: 'player' },
          { name: 'TestCaster', type: 'player' },
        ],
      });
      createSaveListener.mockReturnValue({
        promptId: 'sleep-heighten',
        promise: Promise.resolve({ success: true, roll: 20, saveBonus: 2, total: 22 }),
      });

      await handle(makeAction({}, { heightenTarget: 'PlayerB' }), makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({ disadvantage: true }));
    });
  });

  describe('popup payload', () => {
    it('returns automation_info with a cast summary', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      npcRollFail();
      isSleepImmune.mockImplementation(async (_cn, creature) => creature.name === 'Zombie 1');

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Sleep');
      expect(result.payload.description).toContain('DC 17');
      expect(result.payload.description).toContain('1 Incapacitated');
      expect(result.payload.description).toContain('1 succeeded');
    });

    it('logs the cast once with the target count', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      npcRollSuccess();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const castLogs = addEntry.mock.calls
        .map(c => c[1])
        .filter(e => e && e.type === 'ability_use' && e.characterName === 'TestCaster' && !e.promptId);
      expect(castLogs).toHaveLength(1);
      expect(castLogs[0].description).toContain('casts Sleep');
      expect(castLogs[0].description).toContain('2 target(s)');
    });

    it('records last attack scope as aoe', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      npcRollSuccess();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(storeSpellLastAttack).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        casterName: 'TestCaster',
        spellName: 'Sleep',
        saveType: 'WIS',
        saveDc: 17,
        attackScope: 'aoe',
      }));
    });
  });

  describe('edge cases', () => {
    it('returns popup when every creature is the caster', async () => {
      getCombatContext.mockResolvedValue({ creatures: [{ name: 'TestCaster', type: 'player' }] });
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.payload.description).toContain('No valid targets selected');
    });

    it('falls back to buildSaveDc when metaCtx.spellSaveDc is absent', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      npcRollSuccess();
      buildSaveDc.mockReturnValue(13);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(buildSaveDc).toHaveBeenCalled();
      const castLog = addEntry.mock.calls.map(c => c[1]).find(e => e && e.type === 'ability_use');
      expect(castLog.description).toContain('DC 13');
    });

    it('tolerates addEntry rejections during logging', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      npcRollFail();
      addEntry.mockRejectedValue(new Error('log offline'));

      await expect(handle(makeAction(), makePlayerStats(), campaignName, null)).resolves.toMatchObject({
        type: 'popup',
      });
    });

    it('uses action.name in logs when the spell is renamed', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Thug 1', type: 'npc', monsterType: 'Humanoid' },
          { name: 'TestCaster', type: 'player' },
        ],
      });
      npcRollFail();

      await handle({ ...makeAction(), name: 'Magical Slumber' }, makePlayerStats(), campaignName, null);

      const castLog = addEntry.mock.calls.map(c => c[1]).find(e => e && e.type === 'ability_use');
      expect(castLog.abilityName).toBe('Magical Slumber');
      expect(castLog.description).toContain('Magical Slumber');
    });
  });
});
