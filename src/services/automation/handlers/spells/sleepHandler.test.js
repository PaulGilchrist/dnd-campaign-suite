/**
 * sleepHandler.test.js — FAMILY QUAD seam map (Sleep / shake-awake family, queue #1957–#1959)
 *
 *   #1957 sleepShakeHandler.confirm.test.js          sleepShakeHandler.js handleConfirm() — 4-arg + targetName; shake-awake confirm seam
 *   #1958 sleepShakeHandler.target-selection.test.js sleepShakeHandler.js handle()       — 4-arg; range/target selection for waking others
 *   #1959 sleepShakeHandler.test.js (main)           sleepShakeHandler.js handle()       — core shake resolution (wakes sleep_staged targets)
 *   #THIS sleepHandler.test.js (main)                sleepHandler.js       handle()       — 5-arg (action, playerStats, campaignName, mapName, characters);
 *                                                                                             dispatch key 'sleep' (automation/index.js:532), live via sleepService.triggerSleep ← SleepModal.jsx
 *
 * Own lane: 2024-ruleset Sleep spell. Per-target WIS save → fail stages 'sleep_staged'
 * targetEffect + Incapacitated via stageSleepTargets (sleepService owns the turn-end repeat-save
 * ladder that escalates to Unconscious — foreign). Immune creatures (undead/construct,
 * non-sleepers, exhaustion-immune) auto-succeed via isSleepImmune.
 *
 * NOTES (honest, pinned where own):
 * - The 5e HP-pool ascending selection (10/20/30/40/50 by slot) is RETired for this module:
 *   this handler implements the 2024 save-or-incapacitate rules only (docs/automations-manifest.json
 *   §6048 expectedBehavior). No ascending-HP code exists here or in sleepService — do not pin it.
 * - Wake-on-disturb (damage/shake) is the sibling domain: damage-wake hook lives in
 *   sleepService.wakeSleepOnDamage, shake-awake in sleepShakeHandler — foreign lanes, noted not pinned.
 *   hypnosis/confusion closed siblings share the wake-on-disturb pattern but are distinct modules.
 * - No minutes×N legacy here (#1906 family): staged duration is turn-seam + combat-scoped
 *   (unconsciousRounds default 10 = MA-0068 spec in sleepService — foreign); no wall-clock timers.
 * - Arity fixed in this lane: handle() is 5-param; every call below passes 5 args.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

// Math.random = 0 → roll 1; 0.999 → roll 20 (floor-boundary of the inline NPC roll)
function npcRollFail() {
  vi.spyOn(Math, 'random').mockReturnValue(0);
}

function npcRollSuccess() {
  vi.spyOn(Math, 'random').mockReturnValue(0.999);
}

function loggedEntries(type) {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e && e.type === type);
}

describe('sleepHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isSleepImmune.mockResolvedValue(false);
    buildSaveDc.mockReturnValue(17);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('early returns (no side effects)', () => {
    it('returns popup when no combat context exists, touching nothing', async () => {
      getCombatContext.mockResolvedValue(null);
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null, []);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Sleep',
          description: 'No creatures in combat. Sleep has no effect.',
        },
      });
      expect(addEntry).not.toHaveBeenCalled();
      expect(storeSpellLastAttack).not.toHaveBeenCalled();
      expect(createSaveListener).not.toHaveBeenCalled();
      expect(stageSleepTargets).not.toHaveBeenCalled();
    });

    it('returns popup when combat context has no creatures', async () => {
      getCombatContext.mockResolvedValue({ creatures: [] });
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null, []);
      expect(result.payload.description).toBe('No creatures in combat. Sleep has no effect.');
      expect(addEntry).not.toHaveBeenCalled();
    });

    it('returns popup when selected targets resolve to none valid', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      const result = await handle(makeAction({}, { selectedTargets: ['TestCaster'] }), makePlayerStats(), campaignName, null, []);
      expect(result.payload.description).toBe('No valid targets selected.');
      // The popup-only lanes must not have stored rollback state either.
      expect(storeSpellLastAttack).not.toHaveBeenCalled();
    });

    it('returns popup when every creature is the caster', async () => {
      getCombatContext.mockResolvedValue({ creatures: [{ name: 'TestCaster', type: 'player' }] });
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null, []);
      expect(result.payload.description).toBe('No valid targets selected.');
    });
  });

  describe('target selection', () => {
    it('skips the caster and processes the other creatures in encounter order', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      npcRollSuccess();

      await handle(makeAction(), makePlayerStats(), campaignName, null, []);

      expect(loggedEntries('save_result').map(e => e.targetName)).toEqual(['Thug 1', 'Zombie 1']);
    });

    it('restricts processing to metaCtx.selectedTargets when provided', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      npcRollSuccess();

      await handle(makeAction({}, { selectedTargets: ['Thug 1'] }), makePlayerStats(), campaignName, null, []);

      expect(createSaveListener).not.toHaveBeenCalled();
      expect(loggedEntries('save_result').map(e => e.targetName)).toEqual(['Thug 1']);
    });

    it('prefers metaCtx.spellSaveDc over buildSaveDc', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      npcRollSuccess();

      await handle(makeAction({}, { spellSaveDc: 19 }), makePlayerStats(), campaignName, null, []);

      const castLog = loggedEntries('ability_use')[0];
      expect(castLog.description).toBe('TestCaster casts Sleep! 2 target(s) must make a WIS save (DC 19) or become Incapacitated until the end of their next turn.');
      expect(buildSaveDc).not.toHaveBeenCalled();
    });
  });

  describe('immunity gate', () => {
    it('auto-succeeds immune creatures with the exact rollback shape, no roll, no prompt', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      npcRollFail();
      isSleepImmune.mockImplementation(async (_cn, creature) => creature.name === 'Zombie 1');

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null, []);

      const autoLog = loggedEntries('save_result').find(e => e.targetName === 'Zombie 1');
      expect(autoLog).toMatchObject({
        type: 'save_result',
        characterName: 'TestCaster',
        rollType: 'save-sleep',
        saveDc: 17,
        saveType: 'WIS',
        success: true,
      });
      expect(autoLog.description).toBe("Zombie 1 automatically succeeds on the save against Sleep (doesn't sleep or is immune to Exhaustion).");
      expect(autoLog).not.toHaveProperty('roll');

      expect(addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName: 'Zombie 1',
        saveResult: 'success',
        roll: null,
        total: null,
        conditions: [],
        appliedDamage: 0,
      });

      // Only Thug 1 staged; the immune target is excluded.
      expect(stageSleepTargets).toHaveBeenCalledTimes(1);
      expect(stageSleepTargets).toHaveBeenCalledWith(campaignName, 'TestCaster', ['Thug 1'], 17);
      expect(result.payload.description).toBe('Sleep (DC 17): 1 Incapacitated until end of next turn, 1 succeeded (1 auto-succeeded).');
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

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null, characters);

      expect(isSleepImmune).toHaveBeenCalledWith(campaignName, expect.objectContaining({ name: 'Elf' }), characters);
      expect(createSaveListener).not.toHaveBeenCalled();
      expect(stageSleepTargets).not.toHaveBeenCalled();
      expect(result.payload.description).toBe('Sleep (DC 17): 0 Incapacitated until end of next turn, 1 succeeded (1 auto-succeeded).');
    });
  });

  describe('npc saves (inline auto-roll)', () => {
    it('auto-rolls a WIS save for NPCs and logs the exact fail shape', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Thug 1', type: 'npc', monsterType: 'Humanoid', saveBonuses: { wis: 0 } },
          { name: 'TestCaster', type: 'player' },
        ],
      });
      npcRollFail(); // roll 1 + 0 = 1 < 17

      await handle(makeAction(), makePlayerStats(), campaignName, null, []);

      expect(createSaveListener).not.toHaveBeenCalled();
      const failLog = loggedEntries('save_result').find(e => e.targetName === 'Thug 1');
      expect(failLog).toMatchObject({
        success: false,
        roll: 1,
        total: 1,
        saveBonus: 0,
        saveType: 'WIS',
        saveDc: 17,
      });
      expect(failLog.description).toBe('Thug 1 failed its WIS save (DC 17) against Sleep.');
    });

    it('honours the NPC WIS save bonus at the exact DC boundary', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Veteran', type: 'npc', monsterType: 'Humanoid', saveBonuses: { wis: 16 } },
          { name: 'TestCaster', type: 'player' },
        ],
      });
      npcRollSuccess(); // roll 20 + 16 = 36 >= 17

      await handle(makeAction(), makePlayerStats(), campaignName, null, []);

      const saveLog = loggedEntries('save_result')[0];
      expect(saveLog).toMatchObject({ targetName: 'Veteran', success: true, roll: 20, saveBonus: 16, total: 36 });
      expect(saveLog.description).toBe('Veteran succeeded on its WIS save (DC 17) against Sleep.');
      expect(addTargetResult).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        targetName: 'Veteran',
        saveResult: 'success',
        conditions: [],
        appliedDamage: 0,
      }));
    });

    it('applies no staging and reports 0 auto-succeeded suffix when every target saves', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      isSleepImmune.mockImplementation(async (_cn, creature) => creature.name === 'Zombie 1');
      npcRollSuccess();

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null, []);

      expect(stageSleepTargets).not.toHaveBeenCalled();
      // Suffix present only via the one immune target; the no-auto-success form is pinned next.
      expect(result.payload.description).toBe('Sleep (DC 17): 0 Incapacitated until end of next turn, 2 succeeded (1 auto-succeeded).');
    });

    it('omits the auto-succeeded suffix when no immunity auto-success occurred', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      npcRollSuccess();

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null, []);

      expect(stageSleepTargets).not.toHaveBeenCalled();
      expect(result.payload.description).toBe('Sleep (DC 17): 0 Incapacitated until end of next turn, 2 succeeded.');
    });

    it('stages the failed non-immune target in one call with the real DC and logs Incapacitated per target', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      isSleepImmune.mockImplementation(async (_cn, creature) => creature.name === 'Zombie 1');
      npcRollFail(); // both non-immune rolls fail

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null, []);

      expect(stageSleepTargets).toHaveBeenCalledTimes(1);
      expect(stageSleepTargets).toHaveBeenCalledWith(campaignName, 'TestCaster', ['Thug 1'], 17);

      const condLogs = loggedEntries('condition').filter(e => e.action === 'applied');
      expect(condLogs.map(e => e.characterName)).toEqual(['Thug 1']);
      expect(condLogs[0]).toMatchObject({ condition: 'Incapacitated', reason: 'Sleep spell', sourceName: 'TestCaster' });
      expect(condLogs[0].note).toBe('Thug 1 falls Incapacitated until the end of its next turn, when it repeats the WIS save (DC 17).');

      expect(addTargetResult).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        targetName: 'Thug 1',
        saveResult: 'failure',
        roll: 1,
        total: 1,
        conditions: ['incapacitated'],
        appliedDamage: 0,
      }));
      expect(result.payload.description).toBe('Sleep (DC 17): 1 Incapacitated until end of next turn, 1 succeeded (1 auto-succeeded).');
    });
  });

  describe('player saves (indefinite prompt, no timer)', () => {
    it('prompts player targets with the exact listener shape and stages them on a failed prompt save', async () => {
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

      await handle(makeAction(), makePlayerStats(), campaignName, null, []);

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'PlayerB',
        saveType: 'WIS',
        saveDc: 17,
        dcSuccess: 'none',
        disadvantage: false,
        sourceName: 'TestCaster',
        condition: 'Sleep',
      });

      const promptLog = loggedEntries('ability_use').find(e => e.promptId === 'sleep-prompt');
      expect(promptLog.description).toBe('TestCaster casts Sleep! PlayerB must make a WIS save (DC 17) or become Incapacitated.');

      expect(stageSleepTargets).toHaveBeenCalledWith(campaignName, 'TestCaster', ['PlayerB'], 17);

      const failLog = loggedEntries('save_result')[0];
      expect(failLog).toMatchObject({ targetName: 'PlayerB', success: false, roll: 4, total: 6, saveBonus: 2 });
      expect(failLog.description).toBe('PlayerB failed its WIS save (DC 17) against Sleep.');
    });

    it('applies heighten disadvantage to the chosen player target only', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'PlayerB', type: 'player' },
          { name: 'PlayerC', type: 'player' },
          { name: 'TestCaster', type: 'player' },
        ],
      });
      createSaveListener.mockImplementation((_cn, cfg) => ({
        promptId: `sleep-${cfg.targetName}`,
        promise: Promise.resolve({ success: true, roll: 20, saveBonus: 2, total: 22 }),
      }));

      await handle(makeAction({}, { heightenTarget: 'PlayerB' }), makePlayerStats(), campaignName, null, []);

      const configs = createSaveListener.mock.calls.map(c => c[1]);
      expect(configs.find(c => c.targetName === 'PlayerB').disadvantage).toBe(true);
      expect(configs.find(c => c.targetName === 'PlayerC').disadvantage).toBe(false);
    });
  });

  describe('cast bookkeeping', () => {
    it('logs the cast once with the target count, after the rollback store', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      npcRollSuccess();

      await handle(makeAction(), makePlayerStats(), campaignName, null, []);

      expect(storeSpellLastAttack).toHaveBeenCalledWith(campaignName, {
        casterName: 'TestCaster',
        spellName: 'Sleep',
        saveType: 'WIS',
        saveDc: 17,
        attackScope: 'aoe',
      });

      const castLogs = loggedEntries('ability_use').filter(e => e.characterName === 'TestCaster' && !e.promptId);
      expect(castLogs).toHaveLength(1);
      expect(castLogs[0].description).toBe('TestCaster casts Sleep! 2 target(s) must make a WIS save (DC 17) or become Incapacitated until the end of their next turn.');

      // Rollback state is stored before the cast is announced on the log.
      expect(storeSpellLastAttack.mock.invocationCallOrder[0])
        .toBeLessThan(addEntry.mock.invocationCallOrder[0]);
    });

    it('falls back to buildSaveDc when metaCtx.spellSaveDc is absent', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      npcRollSuccess();
      buildSaveDc.mockReturnValue(13);

      await handle(makeAction(), makePlayerStats(), campaignName, null, []);

      expect(buildSaveDc).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ name: 'TestCaster' }));
      const castLog = loggedEntries('ability_use')[0];
      expect(castLog.description).toContain('DC 13');
    });
  });

  describe('resilience and naming', () => {
    it('tolerates addEntry rejections during logging', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      npcRollFail();
      addEntry.mockRejectedValue(new Error('log offline'));

      await expect(handle(makeAction(), makePlayerStats(), campaignName, null, [])).resolves.toMatchObject({
        type: 'popup',
        payload: { description: 'Sleep (DC 17): 2 Incapacitated until end of next turn, 0 succeeded.' },
      });
    });

    it('uses action.name throughout when the spell is renamed', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Thug 1', type: 'npc', monsterType: 'Humanoid' },
          { name: 'TestCaster', type: 'player' },
        ],
      });
      npcRollFail();

      const result = await handle({ ...makeAction(), name: 'Magical Slumber' }, makePlayerStats(), campaignName, null, []);

      const castLog = loggedEntries('ability_use')[0];
      expect(castLog.abilityName).toBe('Magical Slumber');
      expect(castLog.description).toBe('TestCaster casts Magical Slumber! 1 target(s) must make a WIS save (DC 17) or become Incapacitated until the end of their next turn.');
      const saveLog = loggedEntries('save_result')[0];
      expect(saveLog.description).toBe('Thug 1 failed its WIS save (DC 17) against Magical Slumber.');
      expect(result.payload.name).toBe('Magical Slumber');
      expect(result.payload.description).toBe('Magical Slumber (DC 17): 1 Incapacitated until end of next turn, 0 succeeded.');
    });
  });
});
