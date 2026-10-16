// @maintained-by-ai
/**
 * imprisonment PAIR lane 2/2 (handle orchestration) — partner: imprisonmentHandler.helpers.test.js.
 *
 * Per the helpers-lane PAIR SEAM MAP: that lane owns isImprisonmentBlocked's
 * direct-pin canon + getImprisonmentEffects' 2-arg store-read quirk; the
 * isCreatureTrappedInImprisonment describe was REMOVED there as a dead-export
 * flag (not re-added here — handle never calls it; removal is expiration
 * cleanup L107-109 + removable badge). THIS lane owns handle() orchestration
 * and, through it, the private units:
 *   · dispatchSaveResult L46-69  — NPC auto-roll dispatch: sendSaveResult arg
 *        mapping (bonus→saveBonus) + window 'save-result' CustomEvent exact detail,
 *        and the player-target no-dispatch guard (never double-resolve a player prompt).
 *   · rollNpcImprisonmentSave L71-79 — rollSaveForCreature(creature,'WIS',dc,
 *        false,false) exact args + combat-creature identity pass-through.
 *   · applyImprisonmentEffect L81-140 — te WRITER lane: exact-shape te pin,
 *        replace-own/preserve-others filter, 3-arg campaignName pass-through read
 *        (distinct from the helpers lane's 2-arg getImprisonmentEffects read),
 *        expiration exact entry, full-string log composition, ?? 0 roll fallbacks.
 *
 * HONEST VERIFICATIONS (source read 2026-10-16):
 *  - "No concentration for minimization?" — verified by ABSENCE: this handler
 *    implements NO concentration machinery for ANY prison type (no concentration
 *    field on the te, no helper calls); prisonType is a display string from
 *    auto.options?.[0] || 'Slumber' (L83) and duration is the static string
 *    'Until dispelled' (L94), cleared via addExpiration cleanup + removable badge.
 *  - abilities-ARRAY prod-bug (holdMonster #1924 pattern): clean at THIS source —
 *    handle consumes playerStats ONLY for .name and delegates DC to buildSaveDc
 *    (mocked), so no abilities-shape coupling; fixture trimmed to consumed shape.
 *  - DEAD-BRANCH FLAG (owner sign-off): rollNpcImprisonmentSave's fallback branch
 *    L73-78 (rollD20 ×2, advantage-max, bonus 0) is UNREACHABLE through the only
 *    production entry point — handle null-guards targetCreature at L176-185 before
 *    the lone call site L220, and index.js registers handle only (L259/L591).
 *    Deleting it would also orphan the rollD20 import L9. The rollD20 mock below
 *    is kept purely as isolation for the dead branch, NOT as a behavior pin.
 *
 * Seam upgrade vs prior file: targetResolver is now mocked DIRECTLY. Previously
 * it ran unmocked and the suite pinned resolveTarget's internals
 * (getTargetFromAttacker) through damageUtils — foreign-lane coupling with zero
 * pins on handle's own resolveTarget(campaignName, casterName) call args.
 *
 * Turn-based: no timers; log-rejection resilience flushed via vi.waitFor only.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../common/targetResolver.js', () => ({
  resolveTarget: vi.fn(),
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

// Isolation only: the rollD20 consumer branch (rollNpcImprisonmentSave L73-78)
// is unreachable via handle — see DEAD-BRANCH FLAG in the header.
vi.mock('../../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(() => 10),
}));

import { handle } from './imprisonmentHandler.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { storeSpellLastAttack, addTargetResult } from '../../common/damageRollback.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { rollSaveForCreature } from '../../../rules/combat/applyDamage.js';
import { sendSaveResult } from '../../../combat/conditions/savePromptService.js';

const campaignName = 'test-campaign';

// handle consumes playerStats ONLY for .name (DC comes from buildSaveDc mock) —
// fixture carries the consumed shape, overrides MERGE.
function makePlayerStats(overrides = {}) {
  return { name: 'TestCaster', ...overrides };
}

function makeAction(overrides = {}) {
  return {
    name: 'Imprisonment',
    automation: { type: 'imprisonment', saveType: 'WIS', saveDc: 15 },
    ...overrides,
  };
}

// Drives the happy corridor; returns the combat creature object so identity
// (toBe) can be pinned downstream. Target is a player by default — the NPC
// auto-roll lane is opted into explicitly with isNpc=true.
function setupBaseMocks(saveResult = { success: true, roll: 12, total: 14, bonus: 2 }, isNpc = false) {
  const creature = {
    name: 'Goblin',
    type: isNpc ? 'npc' : 'player',
    saveBonuses: { WIS: 2 },
    currentHp: 15,
    maxHp: 30,
  };
  getCombatContext.mockResolvedValue({ creatures: [creature] });
  resolveTarget.mockResolvedValue({ target: creature });
  buildSaveDc.mockReturnValue(15);
  createSaveListener.mockReturnValue({
    promptId: 'test-prompt-id',
    promise: Promise.resolve(saveResult),
  });
  return creature;
}

function addEntryCalls(match) {
  return vi.mocked(addEntry).mock.calls.filter(call => match(call[1]));
}

describe('imprisonmentHandler.handle (live: index.js L591 automation.imprisonment — sole production entry)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // mockClear keeps mockReturnValue/mockImplementation — restore store default
    // and log-resolve explicitly so seeded stores never leak across tests.
    getRuntimeValue.mockReturnValue([]);
    addEntry.mockResolvedValue(undefined);
  });

  describe('DC build + prompt/rollback registration (L144-203)', () => {
    it('builds DC from automation+playerStats, resolves target by (campaign, caster), and registers WIS prompt + spell-last-attack with exact shapes', async () => {
      const stats = makePlayerStats();
      const action = makeAction();
      setupBaseMocks({ success: true, roll: 12, total: 14, bonus: 2 }, false);
      buildSaveDc.mockReturnValue(18);

      const result = await handle(action, stats, campaignName, null);

      expect(getCombatContext).toHaveBeenCalledTimes(1);
      expect(getCombatContext).toHaveBeenCalledWith(campaignName);
      expect(buildSaveDc).toHaveBeenCalledTimes(1);
      expect(buildSaveDc).toHaveBeenCalledWith(action.automation, stats);
      expect(resolveTarget).toHaveBeenCalledTimes(1);
      expect(resolveTarget).toHaveBeenCalledWith(campaignName, 'TestCaster');
      expect(storeSpellLastAttack).toHaveBeenCalledTimes(1);
      expect(storeSpellLastAttack).toHaveBeenCalledWith(campaignName, {
        casterName: 'TestCaster',
        spellName: 'Imprisonment',
        saveType: 'WIS',
        saveDc: 18,
        attackScope: 'single',
      });
      // Exact prompt registration shape: dcSuccess 'none' (no effect even on low rolls),
      // default disadvantage:false.
      expect(createSaveListener).toHaveBeenCalledTimes(1);
      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveType: 'WIS',
        saveDc: 18,
        dcSuccess: 'none',
        disadvantage: false,
      });
      expect(result.payload.description).toBe('Goblin succeeded on WIS save against Imprisonment.');
    });

    it('metamagic Heightened flips the exact prompt shape to disadvantage:true', async () => {
      setupBaseMocks({ success: true, roll: 12, total: 14, bonus: 2 });

      await handle(makeAction({ metaCtx: { metamagicHeighten: true } }), makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveType: 'WIS',
        saveDc: 15,
        dcSuccess: 'none',
        disadvantage: true,
      });
    });
  });

  describe('no-effect guards (L147-185)', () => {
    it('empty combat: full-string popup, short-circuits BEFORE target resolution or prompt creation', async () => {
      getCombatContext.mockResolvedValue({ creatures: [] });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Imprisonment',
          description: 'No creatures in combat. Imprisonment has no effect.',
        },
      });
      expect(resolveTarget).not.toHaveBeenCalled();
      expect(createSaveListener).not.toHaveBeenCalled();
      expect(storeSpellLastAttack).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
    });

    it.each([
      ['null resolveTarget result', null],
      ['resolveTarget result without a target', { target: undefined, cs: { creatures: [] } }],
    ])('%s: full-string popup, nothing registered or written', async (_label, resolved) => {
      getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin', type: 'npc' }] });
      resolveTarget.mockResolvedValue(resolved);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toBe('No target selected. Imprisonment has no effect.');
      expect(storeSpellLastAttack).not.toHaveBeenCalled();
      expect(createSaveListener).not.toHaveBeenCalled();
      expect(rollSaveForCreature).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('resolved target missing from combat roster: full-string popup quoting the target name, prompt never opens', async () => {
      getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin', type: 'npc' }] });
      resolveTarget.mockResolvedValue({ target: { name: 'Ghost', type: 'npc' } });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toBe('Target "Ghost" not found in combat. Imprisonment has no effect.');
      expect(storeSpellLastAttack).not.toHaveBeenCalled();
      expect(createSaveListener).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('cast log (L205-211)', () => {
    it('logs exactly one ability_use with full composed string + linked promptId', async () => {
      setupBaseMocks({ success: true, roll: 12, total: 14, bonus: 2 });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const calls = addEntryCalls(e => e?.type === 'ability_use');
      expect(calls).toHaveLength(1);
      expect(calls[0][1]).toEqual({
        type: 'ability_use',
        characterName: 'TestCaster',
        abilityName: 'Imprisonment',
        description: 'TestCaster casts Imprisonment on Goblin! Goblin must make a WIS save (DC 15) or be imprisoned.',
        promptId: 'test-prompt-id',
      });
    });
  });

  describe('NPC auto-roll lane (rollNpcImprisonmentSave L71-79 → dispatchSaveResult L46-69)', () => {
    it('NPC target: rolls via rollSaveForCreature once with the exact identity creature and (WIS, dc, no disadvantage, no advantage)', async () => {
      const creature = setupBaseMocks({ success: false, roll: 5, total: 7, bonus: 2 }, true);
      rollSaveForCreature.mockReturnValue({ success: false, roll: 5, total: 7, bonus: 2, rawRolls: [5] });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(rollSaveForCreature).toHaveBeenCalledTimes(1);
      expect(rollSaveForCreature.mock.calls[0][0]).toBe(creature);
      expect(rollSaveForCreature).toHaveBeenCalledWith(creature, 'WIS', 15, false, false);
    });

    it('dispatches the AUTO-ROLL result (not the listener result): bonus→saveBonus mapping + exact window save-result detail', async () => {
      setupBaseMocks({ success: false, roll: 11, total: 13, bonus: 9 }, true);
      // Deliberately distinct from the listener-resolve values so the pin
      // proves dispatch consumed rollNpcImprisonmentSave's result (L220-221).
      rollSaveForCreature.mockReturnValue({ success: false, roll: 5, total: 7, bonus: 2, rawRolls: [5, 9] });

      const events = [];
      const listener = e => events.push(e);
      window.addEventListener('save-result', listener);
      try {
        await handle(makeAction(), makePlayerStats(), campaignName, null);
      } finally {
        window.removeEventListener('save-result', listener);
      }

      expect(sendSaveResult).toHaveBeenCalledTimes(1);
      expect(sendSaveResult).toHaveBeenCalledWith(campaignName, 'Goblin', {
        promptId: 'test-prompt-id',
        success: false,
        roll: 5,
        total: 7,
        saveBonus: 2,
        rawRolls: [5, 9],
      });
      expect(events).toHaveLength(1);
      expect(events[0].detail).toEqual({
        promptId: 'test-prompt-id',
        targetName: 'Goblin',
        saveType: 'WIS',
        saveDc: 15,
        success: false,
        roll: 5,
        total: 7,
        saveBonus: 2,
        rawRolls: [5, 9],
      });
    });

    it('player target: never auto-rolls and never dispatches a save-result (player answers the prompt; no double-resolve)', async () => {
      setupBaseMocks({ success: false, roll: 5, total: 7, bonus: 2 }, false);

      let fired = 0;
      const listener = () => { fired += 1; };
      window.addEventListener('save-result', listener);
      try {
        await handle(makeAction(), makePlayerStats(), campaignName, null);
      } finally {
        window.removeEventListener('save-result', listener);
      }

      expect(rollSaveForCreature).not.toHaveBeenCalled();
      expect(sendSaveResult).not.toHaveBeenCalled();
      expect(fired).toBe(0);
    });
  });

  describe('save success path (L226-254)', () => {
    it('records exact success result, logs full-string save_result, and applies NOTHING (no te, no expiration)', async () => {
      setupBaseMocks({ success: true, roll: 12, total: 14, bonus: 2 });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Imprisonment',
          description: 'Goblin succeeded on WIS save against Imprisonment.',
        },
      });
      expect(addTargetResult).toHaveBeenCalledTimes(1);
      expect(addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveResult: 'success',
        roll: 12,
        total: 14,
        conditions: [],
        appliedDamage: 0,
      });
      const saveLogs = addEntryCalls(e => e?.rollType === 'save-imprisonment');
      expect(saveLogs).toHaveLength(1);
      expect(saveLogs[0][1]).toEqual({
        type: 'save_result',
        characterName: 'TestCaster',
        rollType: 'save-imprisonment',
        targetName: 'Goblin',
        saveDc: 15,
        saveType: 'WIS',
        success: true,
        description: 'Goblin succeeded on WIS save against Imprisonment.',
      });
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(addExpiration).not.toHaveBeenCalled();
      expect(addEntryCalls(e => e?.type === 'condition')).toHaveLength(0);
    });

    it('save result missing roll/total falls back to roll 0 / total 0 in the recorded result', async () => {
      setupBaseMocks({ success: true });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveResult: 'success',
        roll: 0,
        total: 0,
        conditions: [],
        appliedDamage: 0,
      });
    });
  });

  describe('save failure — applyImprisonmentEffect (L81-140, te writer lane)', () => {
    it('reads campaign:targetEffects with exact 3-arg campaignName pass-through and writes the exact te shape once', async () => {
      setupBaseMocks({ success: false, roll: 5, total: 7, bonus: 2 });

      const result = await handle(makeAction({ automation: { type: 'imprisonment', saveType: 'WIS', saveDc: 15, options: ['Burial'] } }), makePlayerStats(), campaignName, null);

      // Distinct from the helpers lane's 2-arg getImprisonmentEffects read:
      // the writer reads WITH campaignName pass-through (L85).
      expect(getRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', campaignName);
      expect(setRuntimeValue).toHaveBeenCalledTimes(1);
      expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [{
        effect: 'imprisonment',
        target: 'Goblin',
        source: 'TestCaster',
        prisonType: 'Burial',
        duration: 'Until dispelled',
      }], campaignName);

      const written = setRuntimeValue.mock.calls[0][2][0];
      expect(Object.prototype.hasOwnProperty.call(written, 'concentration')).toBe(false);

      expect(result.payload.description).toBe('Goblin failed WIS save and is imprisoned (Burial).');
    });

    it('replaces only the caster\'s own imprisonment te and preserves other casters, other targets, and unrelated effects', async () => {
      const seed = [
        { effect: 'imprisonment', target: 'Goblin', source: 'TestCaster', prisonType: 'Slumber', duration: 'Until dispelled' },
        { effect: 'imprisonment', target: 'Goblin', source: 'RivalArchmage', prisonType: 'Chaining', duration: 'Until dispelled' },
        { effect: 'imprisonment', target: 'Ogre', source: 'TestCaster', prisonType: 'Slumber', duration: 'Until dispelled' },
        { effect: 'sanctuary', target: 'Goblin', source: 'TestCaster' },
      ];
      getRuntimeValue.mockImplementation((key, subKey) =>
        key === 'campaign' && subKey === 'targetEffects' ? seed : []);
      setupBaseMocks({ success: false, roll: 5, total: 7, bonus: 2 });

      await handle(makeAction({ automation: { type: 'imprisonment', saveType: 'WIS', saveDc: 15, options: ['Minimization'] } }), makePlayerStats(), campaignName, null);

      const [, , written] = setRuntimeValue.mock.calls[0];
      // Exact replacement array: 3 survivors (own stale te gone) + fresh te appended.
      expect(written).toEqual([
        seed[1],
        seed[2],
        seed[3],
        { effect: 'imprisonment', target: 'Goblin', source: 'TestCaster', prisonType: 'Minimization', duration: 'Until dispelled' },
      ]);
    });

    it('records exact failure result; missing roll/total fall back to 0', async () => {
      setupBaseMocks({ success: false, roll: 5, total: 7, bonus: 2 });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addTargetResult).toHaveBeenCalledTimes(1);
      expect(addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveResult: 'failure',
        roll: 5,
        total: 7,
        conditions: [],
        appliedDamage: 0,
      });
    });

    it('falls back to roll 0 / total 0 when the failed save result omits them', async () => {
      setupBaseMocks({ success: false });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveResult: 'failure',
        roll: 0,
        total: 0,
        conditions: [],
        appliedDamage: 0,
      });
    });

    it('registers the badge-removal expiration as one exact remove_target_effect entry', async () => {
      setupBaseMocks({ success: false, roll: 5, total: 7, bonus: 2 });

      await handle(makeAction({ automation: { type: 'imprisonment', saveType: 'WIS', saveDc: 15, options: ['Burial'] } }), makePlayerStats(), campaignName, null);

      expect(addExpiration).toHaveBeenCalledTimes(1);
      expect(addExpiration).toHaveBeenCalledWith({
        attackerName: 'TestCaster',
        targetName: 'Goblin',
        effects: [
          { type: 'remove_target_effect', effectKey: 'imprisonment', target: 'Goblin', source: 'TestCaster' },
        ],
        campaignName,
      });
    });

    it('logs exact save_result and condition entries with full composed strings', async () => {
      setupBaseMocks({ success: false, roll: 5, total: 7, bonus: 2 });

      await handle(makeAction({ automation: { type: 'imprisonment', saveType: 'WIS', saveDc: 15, options: ['Burial'] } }), makePlayerStats(), campaignName, null);

      const saveLogs = addEntryCalls(e => e?.rollType === 'save-imprisonment');
      expect(saveLogs).toHaveLength(1);
      expect(saveLogs[0][1]).toEqual({
        type: 'save_result',
        characterName: 'TestCaster',
        rollType: 'save-imprisonment',
        targetName: 'Goblin',
        saveDc: 15,
        saveType: 'WIS',
        success: false,
        description: 'Goblin failed WIS save against Imprisonment and is imprisoned (Burial).',
      });

      const condLogs = addEntryCalls(e => e?.type === 'condition');
      expect(condLogs).toHaveLength(1);
      expect(condLogs[0][1]).toEqual({
        type: 'condition',
        action: 'applied',
        characterName: 'Goblin',
        condition: 'Imprisoned',
        reason: 'Imprisonment',
        note: 'Goblin is imprisoned (Burial) by Imprisonment.',
        timestamp: expect.any(Number),
      });
    });

    it.each([
      ['no options', undefined, 'Slumber'],
      ['empty options', [], 'Slumber'],
      ['Minimization first', ['Minimization'], 'Minimization'],
      ['only the first option wins', ['Chaining', 'Hedged Prison'], 'Chaining'],
    ])('prisonType = auto.options?.[0] || \'Slumber\' — %s → %s (display-only; no per-type behavior)', async (_label, options, expectedType) => {
      setupBaseMocks({ success: false, roll: 3, total: 5, bonus: 2 });

      const action = makeAction();
      if (options !== undefined) action.automation.options = options;

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.description).toBe(`Goblin failed WIS save and is imprisoned (${expectedType}).`);
      const written = setRuntimeValue.mock.calls[0][2];
      expect(written[written.length - 1].prisonType).toBe(expectedType);
    });
  });

  describe('log rejection resilience (catch guards L120/L130/L211/L244)', () => {
    it('failure path with every log rejecting: handle still resolves the popup, still writes te + expiration, and logs exactly 3 caught errors', async () => {
      setupBaseMocks({ success: false, roll: 5, total: 7, bonus: 2 });
      addEntry.mockImplementation(() => Promise.reject(new Error('log error')));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      try {
        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.payload.description).toBe('Goblin failed WIS save and is imprisoned (Slumber).');
        expect(setRuntimeValue).toHaveBeenCalledTimes(1);
        expect(addExpiration).toHaveBeenCalledTimes(1);
        // ability_use (L211) + save_result (L120) + condition (L130) — every guard live.
        await vi.waitFor(() => expect(consoleSpy).toHaveBeenCalledTimes(3));
        consoleSpy.mock.calls.forEach(call => {
          expect(call[0]).toBe('[imprisonment] Error:');
          expect(call[1]).toBeInstanceOf(Error);
        });
      } finally {
        consoleSpy.mockRestore();
      }
    });

    it('success path with log rejecting: popup resolves and both catch guards (L211 + L244) log', async () => {
      setupBaseMocks({ success: true, roll: 12, total: 14, bonus: 2 });
      addEntry.mockImplementation(() => Promise.reject(new Error('log error')));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      try {
        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.payload.description).toBe('Goblin succeeded on WIS save against Imprisonment.');
        expect(setRuntimeValue).not.toHaveBeenCalled();
        await vi.waitFor(() => expect(consoleSpy).toHaveBeenCalledTimes(2));
      } finally {
        consoleSpy.mockRestore();
      }
    });
  });
});
