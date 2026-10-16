// @maintained-by-ai
/**
 * banishment QUINTET lane #1872 — handle() core loop (banishmentHandler.js L229-319):
 *  - no-creatures popup short-circuit L234-243 (null and empty-creatures combat contexts);
 *  - no-target popup leg of resolveBanishmentTargets L171-183 (resolveTarget null/nameless
 *        result — the resolveTarget SUCCESS leg and the metaCtx/targetName precedence chain
 *        are owned exactly by banishmentHandler.edge-cases.test.js);
 *  - single-target loop legs L294-304: save-success (exact save_result + addTargetResult
 *        payloads, no banish-branch writes) and save-failure (exact save_result/condition
 *        logs, loop-order of the three runtime writes);
 *  - multi-target loop via metaCtx.banishmentTargets: per-target prompt/log/roll counts,
 *        exact rollSaveForCreature creature-object pins, per-target log full-string pins,
 *        and loop-order of addExpiration/setRuntimeValue targets;
 *  - resilience: a rejected addEntry (ability_use) must not break the loop (caught at L288).
 *
 * NOT re-pinned here (owned exactly by banishmentHandler.edge-cases.test.js per the seam
 * map in its header): createSaveListener options, storeSpellLastAttack payload, dispatchSaveResult
 * field mapping, NPC/player auto-roll dispatch gate contents, banishFailingTarget condition/meta/
 * targetEffects write contents L83-118, exact-ordered addExpiration effects payload L130-134,
 * PERMANENT_BANISHMENT_TYPES table, summary ternary full strings L307-309, and the proven-dead
 * rollD20 fallback (never re-tested). This lane asserts loop SHAPE (counts, target order,
 * branch selection) and its own save_result/addTargetResult compositions only.
 *
 * Mock set mirrors the handler's imports exactly — getTargetFromAttacker dropped: the handler
 * imports only getCombatContext from damageUtils.js (L6).
 *
 * Turn-based: 'Concentration, up to 1 minute' is a latch string cleared at concentration/
 * initiative seams, never a clock; no timers in this file.
 */
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

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
}));

vi.mock('../../common/targetResolver.js', () => ({
  resolveTarget: vi.fn(),
}));

import { handle } from './banishmentHandler.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { rollSaveForCreature } from '../../../rules/combat/applyDamage.js';
import { storeSpellLastAttack, addTargetResult } from '../../common/damageRollback.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { campaignName, makePlayerStats } from './banishmentHandler.test-utils.js';

const DC = 15;

const goblinPlayer = {
  name: 'Goblin', type: 'player', saveBonuses: { CHA: 2 }, currentHp: 15, maxHp: 30,
};
const goblinNpc = {
  name: 'Goblin', type: 'npc', saveBonuses: { CHA: 2 }, currentHp: 15, maxHp: 30,
};
const orcNpc = {
  name: 'Orc', type: 'npc', saveBonuses: { CHA: 1 }, currentHp: 25, maxHp: 40,
};

// MERGES automation overrides (does not replace the block wholesale).
function makeBanishmentAction({ automation: automationOverrides, ...rest } = {}) {
  return {
    name: 'Banishment',
    ...rest,
    automation: { type: 'banishment', saveType: 'CHA', saveDc: DC, ...automationOverrides },
  };
}

// Exact-key router over `${key}:${subKey}`; overrides replace their exact key only.
function runtimeRouter(overrides = {}) {
  const routes = {
    'campaign:targetEffects': [],
    'Goblin:activeConditions': [],
    'Goblin:activeConditionMeta': {},
    'Orc:activeConditions': [],
    'Orc:activeConditionMeta': {},
    ...overrides,
  };
  return (key, subKey) => routes[`${key}:${subKey}`];
}

function successfulListener(promptId) {
  return {
    promptId,
    promise: Promise.resolve({ success: true, roll: 12, total: 14, bonus: 2 }),
  };
}

function failedListener(promptId) {
  return {
    promptId,
    promise: Promise.resolve({ success: false, roll: 5, total: 7, bonus: 2 }),
  };
}

function logEntries(type) {
  return vi.mocked(addEntry).mock.calls.filter(call => call[1]?.type === type);
}

function saveResultLog(targetName) {
  const call = vi.mocked(addEntry).mock.calls.find(
    c => c[1]?.type === 'save_result' && c[1]?.targetName === targetName,
  );
  return call?.[1];
}

describe('banishmentHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockImplementation(runtimeRouter());
    getCombatContext.mockResolvedValue({ creatures: [goblinPlayer] });
    buildSaveDc.mockReturnValue(DC);
  });

  describe('no-creatures popup short-circuit (L234-243)', () => {
    it.each([
      ['null combat context', null],
      ['empty creatures array', { creatures: [] }],
    ])('returns exact popup and touches nothing else for %s', async (_label, context) => {
      getCombatContext.mockResolvedValue(context);

      const action = makeBanishmentAction({ automation: { targetName: 'Goblin' } });
      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(getCombatContext).toHaveBeenCalledWith(campaignName);
      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Banishment',
          description: 'No creatures in combat. Banishment has no effect.',
        },
      });
      expect(resolveTarget).not.toHaveBeenCalled();
      expect(storeSpellLastAttack).not.toHaveBeenCalled();
      expect(createSaveListener).not.toHaveBeenCalled();
      expect(addConcentration).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
    });
  });

  describe('no-target popup (resolveTarget null leg L171-183)', () => {
    it.each([
      ['undefined result', undefined],
      ['result without a target name', { target: {} }],
    ])('returns exact popup, no side effects, when resolveTarget yields %s', async (_label, resolved) => {
      resolveTarget.mockResolvedValue(resolved);

      const action = makeBanishmentAction();
      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(resolveTarget).toHaveBeenCalledWith(campaignName, 'TestCaster');
      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Banishment',
          description: 'No target selected. Banishment has no effect.',
        },
      });
      expect(storeSpellLastAttack).not.toHaveBeenCalled();
      expect(createSaveListener).not.toHaveBeenCalled();
      expect(addConcentration).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
    });
  });

  describe('single-target loop', () => {
    it('save success: exact saved-leg logs, no banish-branch writes, concentration latches', async () => {
      createSaveListener.mockReturnValue(successfulListener('prompt-s'));

      const action = makeBanishmentAction({ automation: { targetName: 'Goblin' } });
      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Banishment');
      expect(result.payload.description).toContain('1 creature(s) saved: Goblin');

      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestCaster',
        abilityName: 'Banishment',
        description: 'TestCaster casts Banishment on Goblin! Goblin must make a CHA save (DC 15) or be banished.',
        promptId: 'prompt-s',
      });
      expect(saveResultLog('Goblin')).toEqual({
        type: 'save_result',
        characterName: 'TestCaster',
        rollType: 'save-banishment',
        targetName: 'Goblin',
        saveDc: DC,
        saveType: 'CHA',
        success: true,
        description: 'Goblin succeeded on CHA save against Banishment.',
      });
      expect(addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveResult: 'success',
        roll: 12,
        total: 14,
        conditions: [],
        appliedDamage: 0,
      });

      // Banish branch must not run:
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(addExpiration).not.toHaveBeenCalled();
      expect(logEntries('condition')).toHaveLength(0);
      // Concentration latches the caster exactly once even on a full save:
      expect(addConcentration).toHaveBeenCalledTimes(1);
    });

    it('save failure via player prompt: banish-branch logs and write order, no auto-roll', async () => {
      createSaveListener.mockReturnValue(failedListener('prompt-f'));

      const action = makeBanishmentAction({ automation: { targetName: 'Goblin' } });
      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('1 creature(s) banished: Goblin');

      // Player target: the NPC auto-roll dispatch must not fire (gate owned by edge lane,
      // shape-only here — this file once mislabeled this scenario as an NPC auto-roll).
      expect(rollSaveForCreature).not.toHaveBeenCalled();

      expect(saveResultLog('Goblin')).toEqual({
        type: 'save_result',
        characterName: 'TestCaster',
        rollType: 'save-banishment',
        targetName: 'Goblin',
        saveDc: DC,
        saveType: 'CHA',
        success: false,
        description: 'Goblin failed CHA save against Banishment and is banished.',
      });
      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: 'Goblin',
        condition: 'Incapacitated',
        reason: 'Banishment',
        note: 'Goblin is Incapacitated by Banishment (banished to demiplane).',
        timestamp: expect.any(Number),
      });
      expect(addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveResult: 'failure',
        roll: 5,
        total: 7,
        conditions: ['incapacitated'],
        appliedDamage: 0,
      });

      // Loop SHAPE only — payload contents are pinned exactly by the edge-cases lane:
      const targetWrites = vi.mocked(setRuntimeValue).mock.calls
        .filter(c => c[0] === 'Goblin')
        .map(c => c[1]);
      expect(targetWrites).toEqual(['activeConditions', 'activeConditionMeta']);
      const campaignWrites = vi.mocked(setRuntimeValue).mock.calls
        .filter(c => c[0] === 'campaign' && c[1] === 'targetEffects');
      expect(campaignWrites).toHaveLength(1);

      expect(addExpiration).toHaveBeenCalledTimes(1);
      const expirationArg = vi.mocked(addExpiration).mock.calls[0][0];
      expect(expirationArg.attackerName).toBe('TestCaster');
      expect(expirationArg.targetName).toBe('Goblin');
      expect(expirationArg.campaignName).toBe(campaignName);
    });
  });

  describe('multi-target loop via metaCtx.banishmentTargets', () => {
    beforeEach(() => {
      getCombatContext.mockResolvedValue({ creatures: [goblinNpc, orcNpc] });
    });

    it('mixed outcomes: per-target prompts, exact NPC rolls, ordered branch logs', async () => {
      let callCount = 0;
      createSaveListener.mockImplementation(() => {
        callCount++;
        return callCount === 1
          ? failedListener('prompt-1')
          : successfulListener('prompt-2');
      });
      rollSaveForCreature
        .mockReturnValueOnce({ success: false, roll: 3, total: 5, bonus: 2, rawRolls: [3] })
        .mockReturnValueOnce({ success: true, roll: 15, total: 16, bonus: 1, rawRolls: [15] });

      const action = makeBanishmentAction({ metaCtx: { banishmentTargets: ['Goblin', 'Orc'] } });
      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('1 creature(s) banished: Goblin');
      expect(result.payload.description).toContain('1 creature(s) saved: Orc');

      // One save prompt per target, in target order:
      expect(createSaveListener).toHaveBeenCalledTimes(2);
      expect(createSaveListener.mock.calls.map(c => c[1].targetName)).toEqual(['Goblin', 'Orc']);

      // Both NPC targets auto-roll against the shared DC (exact creature objects):
      expect(rollSaveForCreature).toHaveBeenCalledTimes(2);
      expect(rollSaveForCreature).toHaveBeenCalledWith(goblinNpc, 'CHA', DC, false, false);
      expect(rollSaveForCreature).toHaveBeenCalledWith(orcNpc, 'CHA', DC, false, false);

      // One ability_use log per target, each naming its own target:
      const abilityUse = logEntries('ability_use');
      expect(abilityUse).toHaveLength(2);
      expect(abilityUse[0][1]).toEqual({
        type: 'ability_use',
        characterName: 'TestCaster',
        abilityName: 'Banishment',
        description: 'TestCaster casts Banishment on Goblin! Goblin must make a CHA save (DC 15) or be banished.',
        promptId: 'prompt-1',
      });
      expect(abilityUse[1][1]).toEqual({
        type: 'ability_use',
        characterName: 'TestCaster',
        abilityName: 'Banishment',
        description: 'TestCaster casts Banishment on Orc! Orc must make a CHA save (DC 15) or be banished.',
        promptId: 'prompt-2',
      });

      // One save_result per target, branch per listener outcome:
      expect(saveResultLog('Goblin').success).toBe(false);
      expect(saveResultLog('Goblin').description).toBe('Goblin failed CHA save against Banishment and is banished.');
      expect(saveResultLog('Orc').success).toBe(true);
      expect(saveResultLog('Orc').description).toBe('Orc succeeded on CHA save against Banishment.');

      // Banish branch ran for Goblin only:
      expect(logEntries('condition')).toHaveLength(1);
      expect(logEntries('condition')[0][1].characterName).toBe('Goblin');

      // Loop order — expiration effects payload contents owned by the edge-cases lane:
      expect(addExpiration).toHaveBeenCalledTimes(1);
      expect(vi.mocked(addExpiration).mock.calls[0][0].targetName).toBe('Goblin');
      const activeConditionWrites = vi.mocked(setRuntimeValue).mock.calls
        .filter(c => c[1] === 'activeConditions');
      expect(activeConditionWrites.map(c => c[0])).toEqual(['Goblin']);

      // One rollback store per cast (attackScope stays 'single' even multi-target —
      // payload contents owned by the edge-cases lane):
      expect(storeSpellLastAttack).toHaveBeenCalledTimes(1);
    });

    it('all targets fail: two banish legs, two expirations in target order', async () => {
      createSaveListener.mockImplementation((campaign, opts) => ({
        promptId: `prompt-${opts.targetName}`,
        promise: Promise.resolve({ success: false, roll: 2, total: 4, bonus: 2 }),
      }));
      rollSaveForCreature.mockReturnValue({ success: false, roll: 2, total: 4, bonus: 2, rawRolls: [2] });

      const action = makeBanishmentAction({ metaCtx: { banishmentTargets: ['Goblin', 'Orc'] } });
      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('2 creature(s) banished: Goblin, Orc');

      expect(addExpiration).toHaveBeenCalledTimes(2);
      expect(vi.mocked(addExpiration).mock.calls.map(c => c[0].targetName)).toEqual(['Goblin', 'Orc']);

      // Banish-branch writes run once per target, in order:
      const activeConditionWrites = vi.mocked(setRuntimeValue).mock.calls
        .filter(c => c[1] === 'activeConditions');
      expect(activeConditionWrites.map(c => c[0])).toEqual(['Goblin', 'Orc']);
      expect(logEntries('condition')).toHaveLength(2);

      const saveResults = vi.mocked(addTargetResult).mock.calls.map(c => c[1].saveResult);
      expect(saveResults).toEqual(['failure', 'failure']);
    });
  });

  describe('log failure resilience', () => {
    it('a rejected ability_use log does not break the loop or the banish leg', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        // Reject only the first addEntry (the ability_use cast log); later logs resolve.
        addEntry.mockRejectedValueOnce(new Error('log down'));
        createSaveListener.mockReturnValue(failedListener('prompt-x'));

        const action = makeBanishmentAction({ automation: { targetName: 'Goblin' } });
        const result = await handle(action, makePlayerStats(), campaignName, null);

        expect(result.payload.description).toContain('1 creature(s) banished: Goblin');
        expect(createSaveListener).toHaveBeenCalledTimes(1);
        expect(addExpiration).toHaveBeenCalledTimes(1);
        // The caught rejection is reported, not swallowed silently:
        await vi.waitFor(() => expect(errorSpy).toHaveBeenCalled());
      } finally {
        errorSpy.mockRestore();
      }
    });
  });
});
