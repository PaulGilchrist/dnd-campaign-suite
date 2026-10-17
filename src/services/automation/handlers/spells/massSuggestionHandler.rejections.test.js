// @maintained-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── PAIR seam map — massSuggestionHandler.js ─────────────────────────────
// Subject is LIVE: automation/index.js imports `handle` (l.241) and registers
// it as `mass_suggestion` in the dispatch table (l.575); the dispatcher
// catches handler rejections (index.js l.742-748). Also reached via
// massSuggestionService.js → executeAutomation and automationRouter.js
// ('mass_suggestion' area list).
//
// THIS FILE — REJECTIONS lane of the massSuggestion pair; #1931
// (massSuggestionHandler.test.js) owns happy orchestration (prompt counts,
// maxTargets, charmed dedupe, summary aggregation, heighten disadvantage).
//
// THIS FILE pins:
//   • every addEntry call site (ability_use / save_result / condition)
//     rejects → swallowed via .catch with the EXACT console prefix
//     '[massSuggestion] Error:', flow continues, and core side effects
//     (setRuntimeValue charmed, addExpiration, addTargetResult ledger) still
//     land — full-string popup pins prove the loop completed
//   • thrown deps REJECT handle by contract — only addEntry is swallowed:
//     buildSaveDc / getCombatContext / storeSpellLastAttack /
//     createSaveListener throws and a rejected save promise all propagate
//     to the dispatcher, each with a no-side-effect / abort-point guard
//   • addTargetResult rejects abort its leg AFTER the charmed runtime write
//     on the failure path (asymmetric pinned contract — the rollback ledger
//     failing does not roll back the applied condition)
//   • refusal popup variant (creatures: []) never arms store/log/save
//   • rollback payload exact shapes incl. the roll/total ?? 0 defaults
// No savePrompt teardown pins: prompts are entirely behind the mocked
// createSaveListener seam. No game timers — resolved/rejected promise stubs
// awaited inline only.
// ─────────────────────────────────────────────────────────────────────────

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
  storeSpellLastAttack: vi.fn(),
  addTargetResult: vi.fn(() => Promise.resolve()),
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

// ── Imports ────────────────────────────────────────────────────

import { handle } from './massSuggestionHandler.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { addEntry } from '../../../ui/logService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { storeSpellLastAttack, addTargetResult } from '../../common/damageRollback.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'test-campaign';
const LOG_PREFIX = '[massSuggestion] Error:';
const PROMPT_PREFIX = 'ms-';
const TARGETS = ['Goblin', 'Orc', 'Bugbear', 'Kobold'];

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
    level: 15,
    proficiency: 6,
    abilities: [{ name: 'Charisma', bonus: 5 }],
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Mass Suggestion',
    automation: {
      type: 'mass_suggestion',
      saveType: 'WIS',
      saveDc: 'spell_save_dc',
      range: '60 feet',
      duration: '24 hours',
      maxTargets: 12,
      ...automation,
    },
  };
}

const baseCombatContext = {
  creatures: [
    ...TARGETS.map(name => ({ name, type: 'monster', currentHp: 5, maxHp: 7 })),
    { name: 'TestCaster', gridX: 5, gridY: 10 },
  ],
  players: [
    { name: 'TestCaster', gridX: 5, gridY: 10 },
  ],
  placedItems: [],
};

// Per-target promptIds let ability_use rejections be keyed exactly (that
// entry has no targetName field — promptId is its only target identity).
// saveOutcomeByTarget maps targetName → boolean (default false = charmed).
function stubSaves(saveOutcomeByTarget = {}) {
  createSaveListener.mockImplementation((_campaign, config) => ({
    promptId: `${PROMPT_PREFIX}${config.targetName}`,
    promise: Promise.resolve({ success: saveOutcomeByTarget[config.targetName] === true }),
  }));
}

// Reject only the entries matching predicate — the exact call-site key, not
// a positional ordinal that silently moves when targets/log order changes.
function rejectLogsMatching(predicate, err) {
  addEntry.mockImplementation((_campaign, entry) =>
    predicate(entry) ? Promise.reject(err) : Promise.resolve());
}

const logCallsOfType = type => addEntry.mock.calls.filter(call => call[1]?.type === type);

function charmedWrites() {
  return setRuntimeValue.mock.calls.filter(
    call => call[1] === 'activeConditions' && call[2].includes('charmed'),
  );
}

// Full-string own-composition pin of the handler's summary template.
function expectedSummary(affected, saved) {
  const results = affected.map(t => `${t} is Charmed by Mass Suggestion.`);
  return affected.length > 0
    ? `Mass Suggestion affects ${affected.length} creature(s). ${results.join(' ')} ${saved} creature(s) saved. Affected creatures are Charmed and pursue the suggested activity. The spell ends for a target if TestCaster or allies deal damage to it.`
    : `No creatures affected by Mass Suggestion. ${saved} creature(s) saved.`;
}

// ── Tests ──────────────────────────────────────────────────────

describe('massSuggestionHandler — rejection/error lane', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    // mockReset (not clearAllMocks) also drains queued once-implementations
    // so a rejection queued by one test can never leak into the next.
    getCombatContext.mockReset().mockResolvedValue(baseCombatContext);
    buildSaveDc.mockReset().mockReturnValue(16);
    getRuntimeValue.mockReset().mockReturnValue([]);
    setRuntimeValue.mockReset();
    addExpiration.mockReset();
    storeSpellLastAttack.mockReset();
    addTargetResult.mockReset().mockResolvedValue(undefined);
    addEntry.mockReset().mockResolvedValue(undefined);
    createSaveListener.mockReset();
    stubSaves();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('addEntry rejection paths (swallowed + logged, flow continues)', () => {
    it('swallows the first-target ability_use rejection, logs the exact prefix, and completes every leg', async () => {
      const err = new Error('log error');
      rejectLogsMatching(
        entry => entry.type === 'ability_use' && entry.promptId === `${PROMPT_PREFIX}Goblin`,
        err,
      );

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      // Rejection caught at its own call site, console-logged exactly once
      expect(addEntry).toHaveBeenCalledTimes(8); // 4 ability_use + 4 condition
      expect(logCallsOfType('ability_use')).toHaveLength(4);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(LOG_PREFIX, err);

      // Flow completed past the failed log: rollback context stored once,
      // every remaining target charmed and expired
      expect(storeSpellLastAttack).toHaveBeenCalledWith(campaignName, {
        casterName: 'TestCaster',
        spellName: 'Mass Suggestion',
        saveType: 'WIS',
        saveDc: 16,
        attackScope: 'aoe',
      });
      expect(charmedWrites()).toHaveLength(4);
      expect(addExpiration).toHaveBeenCalledTimes(4);

      // Loop fully completed — full-string summary pin
      expect(result.payload.description).toBe(expectedSummary(TARGETS, 0));
    });

    it('swallows an Orc save_result rejection without corrupting the rollback ledger', async () => {
      const err = new Error('save result error');
      stubSaves({ Orc: true, Kobold: true }); // Goblin, Bugbear fail
      rejectLogsMatching(
        entry => entry.type === 'save_result' && entry.targetName === 'Orc',
        err,
      );

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledTimes(8); // 4 ability_use + 4 save_result
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(LOG_PREFIX, err);

      // Every target still recorded in the rollback ledger, correct legs
      expect(addTargetResult).toHaveBeenCalledTimes(4);
      const recorded = addTargetResult.mock.calls.map(call => call[1]);
      expect(recorded.filter(r => r.saveResult === 'success')).toHaveLength(2);
      expect(recorded.filter(r => r.saveResult === 'failure')).toHaveLength(2);
      // Saved targets never touched the condition store; the two failed
      // targets each got their charmed write
      expect(charmedWrites()).toHaveLength(2);
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        ['charmed'],
        campaignName,
      );
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Bugbear',
        'activeConditions',
        ['charmed'],
        campaignName,
      );
      expect(addExpiration).toHaveBeenCalledTimes(2);

      expect(result.payload.description).toBe(expectedSummary(['Goblin', 'Bugbear'], 2));
    });

    it('swallows a Goblin condition-log rejection and still writes charmed + expiration', async () => {
      const err = new Error('condition log error');
      rejectLogsMatching(
        entry => entry.type === 'condition' && entry.characterName === 'Goblin',
        err,
      );

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(logCallsOfType('condition')).toHaveLength(4); // all attempted
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(LOG_PREFIX, err);

      // Core logic is NOT gated on the log: exact charmed write + expiration
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        ['charmed'],
        campaignName,
      );
      expect(addExpiration).toHaveBeenCalledWith({
        attackerName: 'TestCaster',
        targetName: 'Goblin',
        effects: [{ type: 'charmed', condition: 'charmed' }],
        campaignName,
      });
      expect(charmedWrites()).toHaveLength(4);

      expect(result.payload.description).toBe(expectedSummary(TARGETS, 0));
    });

    it('survives every addEntry rejecting across mixed saves — 8 logs logged, ledger intact', async () => {
      const err = new Error('log error');
      stubSaves({ Orc: true, Kobold: true }); // Goblin, Bugbear charmed
      addEntry.mockRejectedValue(err); // ALL logs reject

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledTimes(8);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(8);
      expect(consoleErrorSpy).toHaveBeenCalledWith(LOG_PREFIX, err);

      // Log failures must not corrupt combat state
      expect(charmedWrites()).toHaveLength(2);
      expect(addExpiration).toHaveBeenCalledTimes(2);
      expect(addTargetResult).toHaveBeenCalledTimes(4);

      expect(result.payload.description).toBe(expectedSummary(['Goblin', 'Bugbear'], 2));
    });
  });

  describe('thrown deps (rejections propagate by contract)', () => {
    // Only addEntry is swallowed — everything else must reach the dispatcher
    // (index.js l.742-748) so it can surface "Failed to execute".

    it('rejects when buildSaveDc throws — nothing after the DC read executes', async () => {
      buildSaveDc.mockImplementationOnce(() => {
        throw new Error('dc failed');
      });

      await expect(handle(makeAction(), makePlayerStats(), campaignName, null))
        .rejects.toThrow('dc failed');

      expect(getCombatContext).not.toHaveBeenCalled();
      expect(storeSpellLastAttack).not.toHaveBeenCalled();
      expect(createSaveListener).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
    });

    it('rejects when getCombatContext rejects — rollback store and prompts never armed', async () => {
      getCombatContext.mockRejectedValueOnce(new Error('context unavailable'));

      await expect(handle(makeAction(), makePlayerStats(), campaignName, null))
        .rejects.toThrow('context unavailable');

      expect(buildSaveDc).toHaveBeenCalledTimes(1); // DC read precedes the await
      expect(storeSpellLastAttack).not.toHaveBeenCalled();
      expect(createSaveListener).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
    });

    it('refusal popup for an empty creatures array has zero side effects (null-context shape lives in #1931)', async () => {
      getCombatContext.mockResolvedValueOnce({ creatures: [], players: [], placedItems: [] });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Mass Suggestion',
          description: 'No creatures in combat. Mass Suggestion has no effect.',
        },
      });
      expect(storeSpellLastAttack).not.toHaveBeenCalled();
      expect(createSaveListener).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
    });

    it('rejects when storeSpellLastAttack throws — no prompt armed, nothing logged', async () => {
      storeSpellLastAttack.mockImplementationOnce(() => {
        throw new Error('rollback store failed');
      });

      await expect(handle(makeAction(), makePlayerStats(), campaignName, null))
        .rejects.toThrow('rollback store failed');

      expect(createSaveListener).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
    });

    it('rejects when createSaveListener throws — the ability_use log never posts', async () => {
      createSaveListener.mockImplementationOnce(() => {
        throw new Error('prompt failed');
      });

      await expect(handle(makeAction(), makePlayerStats(), campaignName, null))
        .rejects.toThrow('prompt failed');

      // Listener creation precedes the log inside the loop: no half-log
      expect(addEntry).not.toHaveBeenCalled();
      expect(addTargetResult).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('rejects when a save promise rejects — leg skipped, later targets never prompted', async () => {
      const err = new Error('save prompt rejected');
      createSaveListener.mockImplementation((_campaign, config) => ({
        promptId: `${PROMPT_PREFIX}${config.targetName}`,
        promise: config.targetName === 'Goblin'
          ? Promise.reject(err)
          : Promise.resolve({ success: false }),
      }));

      await expect(handle(makeAction(), makePlayerStats(), campaignName, null))
        .rejects.toThrow('save prompt rejected');

      // ability_use DID post (fire-and-forget, resolved); the leg did not run
      expect(addEntry).toHaveBeenCalledTimes(1);
      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'ability_use',
        promptId: `${PROMPT_PREFIX}Goblin`,
      }));
      expect(addTargetResult).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
      // Loop aborted — Orc/Bugbear/Kobold never got a prompt
      expect(createSaveListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('addTargetResult rejections (rollback aborts, runtime writes already landed)', () => {
    it('failure leg: aborts AFTER the charmed runtime write — pinned asymmetric contract', async () => {
      const err = new Error('rollback failed');
      addTargetResult.mockRejectedValueOnce(err); // Goblin's failure leg

      await expect(handle(makeAction(), makePlayerStats(), campaignName, null))
        .rejects.toThrow('rollback failed');

      // charmed was written BEFORE the ledger write (massSuggestionHandler
      // l.31-36): a ledger failure does NOT roll back the applied condition.
      // Pinned current contract — flagged if reviewers want atomic rollback.
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        ['charmed'],
        campaignName,
      );
      // Aborted before the condition log and expiration for Goblin...
      expect(logCallsOfType('condition')).toHaveLength(0);
      expect(addExpiration).not.toHaveBeenCalled();
      // ...and the loop aborted — no further targets prompted
      expect(createSaveListener).toHaveBeenCalledTimes(1);
      // Only the (resolved) ability_use log exists
      expect(addEntry).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('success leg: aborts before the save_result log — nothing was ever charmed', async () => {
      const err = new Error('rollback failed');
      stubSaves({ Goblin: true }); // Goblin succeeds first; aborts there
      addTargetResult.mockRejectedValueOnce(err);

      await expect(handle(makeAction(), makePlayerStats(), campaignName, null))
        .rejects.toThrow('rollback failed');

      expect(logCallsOfType('save_result')).toHaveLength(0);
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(addExpiration).not.toHaveBeenCalled();
      expect(createSaveListener).toHaveBeenCalledTimes(1);
      expect(addEntry).toHaveBeenCalledTimes(1); // Goblin's ability_use only
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('rollback payload exact shapes (damageRollback lane)', () => {
    it('failure leg records the exact failure entry with roll/total defaulting to 0', async () => {
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveResult: 'failure',
        roll: 0,
        total: 0,
        conditions: ['charmed'],
        appliedDamage: 0,
      });
    });

    it('success leg records the exact success entry with empty conditions and 0 roll/total', async () => {
      stubSaves({ Goblin: true });

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
});
