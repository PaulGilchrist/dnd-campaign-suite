// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── PAIR seam map — massSuggestionHandler.js ─────────────────────────────
// Subject is LIVE (verified this lane): automation/index.js imports `handle`
// (l.241) and registers it as `mass_suggestion` in the dispatch table
// (l.575); the dispatcher awaits it inside try/catch (l.742-748) so handler
// rejections surface as 'Failed to execute' popups. Also reached via
// automationRouter.js ('mass_suggestion' area list, l.190), modalSpells.js
// pay-at-confirm action builder (l.50), massSuggestionService.js
// → executeAutomation, and useSpellMetamagicGates.js (l.127) gate.
//
// THIS FILE — HAPPY-PATH orchestration lane of the massSuggestion pair;
// massSuggestionHandler.rejections.test.js owns the rejection/error lane.
//
// THIS FILE pins (canon):
//   • area enumeration: caster excluded by name, first-N slice, DEFAULT cap
//     of 12 exercised with 13 candidates (the real || 12 branch, not a
//     vacuous 4-under-cap re-run of the limit test)
//   • per-target WIS prompt configs as EXACT strict call-tables, including
//     the heightenTarget disadvantage table
//   • charmed runtime writes canon: fresh ['charmed'], dedupe-by-move-to-end
//     (filter-then-append semantics), case-insensitive replace, non-array
//     stored-value guard; addExpiration registration as a strict table
//   • own-composition full-string pins of the LOG lane (ability_use,
//     save_result incl. its characterName-caster quirk, condition note) —
//     the companion owns the SUMMARY full-string, so every summary pin here
//     stays toContain to avoid double-owning the template
//   • storeSpellLastAttack aoe header exact payload, called once and BEFORE
//     the first prompt arms
//   • popup envelope exact keys with a partial-description matcher
//   • null-context refusal shape (companion explicitly defers it here; it
//     owns the creatures:[] refusal instead)
//   • action.name verbatim propagation + no-automation-object default flow
//
// EXACT-SHAPE OWNERSHIP SPLIT (recorded decision): the charmed write and
// addExpiration exact shapes are CANON HERE on their happy path; the
// companion's identical shape pins are landing evidence on rejection paths
// ("the write still happened despite the failed log"), not shape ownership.
// The summary template is the mirror image: full-string there, toContain
// here.
// Concentration note: the subject never writes a concentration store — its
// duration lane is addExpiration; pinned here as the registration canon.
// No game timers: prompt stubs are inline-resolved promises, awaited only;
// Date.now() inside the condition log is pinned expect.any(Number).
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

// Shallow-merges automation overrides onto the real spell defaults (top-level
// action fields are overridden via object spread at the call site) — the
// merge is intentional so each test varies exactly one knob.
function makeAction(automation = {}, name = 'Mass Suggestion') {
  return {
    name,
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

// Per-target promptIds keep ability_use pins keyed by target identity.
// saveOutcomeByTarget maps targetName → boolean (default false = fails).
function stubSaves(saveOutcomeByTarget = {}) {
  createSaveListener.mockImplementation((_campaign, config) => ({
    promptId: `${PROMPT_PREFIX}${config.targetName}`,
    promise: Promise.resolve({ success: saveOutcomeByTarget[config.targetName] === true }),
  }));
}

const allTargets = outcome => Object.fromEntries(TARGETS.map(t => [t, outcome]));

const logCallsOfType = type => addEntry.mock.calls.filter(call => call[1]?.type === type);

const promptTargets = () => createSaveListener.mock.calls.map(call => call[1].targetName);

const conditionTargets = () => logCallsOfType('condition').map(call => call[1].characterName);

function charmedWrites() {
  return setRuntimeValue.mock.calls.filter(
    call => call[1] === 'activeConditions' && call[2].includes('charmed'),
  );
}

const expirationTable = targetNames => targetNames.map(targetName => [{
  attackerName: 'TestCaster',
  targetName,
  effects: [{ type: 'charmed', condition: 'charmed' }],
  campaignName,
}]);

// ── Tests ──────────────────────────────────────────────────────

describe('massSuggestionHandler — happy-path orchestration lane', () => {
  beforeEach(() => {
    // mockReset (not clearAllMocks) drains queued implementations so a stub
    // from one test can never leak into the next; every dep is then
    // re-stubbed to the happy-path default (all saves FAIL, full context).
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
  });

  describe('area enumeration', () => {
    it('prompts every non-caster creature exactly once, in combat order', async () => {
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledTimes(4);
      expect(promptTargets()).toEqual(TARGETS);
    });

    it('caps at automation.maxTargets, keeping the first N in enumeration order', async () => {
      await handle(makeAction({ maxTargets: 2 }), makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledTimes(2);
      expect(promptTargets()).toEqual(['Goblin', 'Orc']);
    });

    it('defaults the cap to 12 with 13 candidates — real || 12 branch, first 12 prompted', async () => {
      const thirteen = Array.from({ length: 13 }, (_, i) => ({
        name: `Mob${i + 1}`,
        type: 'monster',
        currentHp: 5,
        maxHp: 7,
      }));
      getCombatContext.mockResolvedValueOnce({
        creatures: [...thirteen, { name: 'TestCaster', gridX: 5, gridY: 10 }],
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
        placedItems: [],
      });

      await handle(makeAction({ maxTargets: undefined }), makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledTimes(12);
      expect(promptTargets()).toEqual(thirteen.slice(0, 12).map(c => c.name));
    });

    it('a caster-only table prompts nothing, writes nothing, yet still arms the rollback header', async () => {
      getCombatContext.mockResolvedValueOnce({
        creatures: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
        placedItems: [],
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      // Passes the creatures.length guard but the caster filter empties the
      // target list: the header lands (it precedes enumeration), saves do not.
      expect(createSaveListener).not.toHaveBeenCalled();
      expect(charmedWrites()).toHaveLength(0);
      expect(addExpiration).not.toHaveBeenCalled();
      expect(addTargetResult).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
      expect(storeSpellLastAttack).toHaveBeenCalledTimes(1);
      expect(result.payload.description).toContain('No creatures affected');
      expect(result.payload.description).toContain('0 creature(s) saved');
    });
  });

  describe('per-target save prompts', () => {
    it('arms each prompt with the exact WIS config as a strict call-table', async () => {
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(createSaveListener.mock.calls).toEqual(TARGETS.map(targetName => [
        campaignName,
        {
          targetName,
          saveType: 'WIS',
          saveDc: 16,
          dcSuccess: 'none',
          disadvantage: false,
          condition: 'charmed',
        },
      ]));
    });

    it('heightenTarget flips disadvantage ONLY on the matched target — strict table', async () => {
      const action = makeAction();
      action.metaCtx = { heightenTarget: 'Goblin' };

      await handle(action, makePlayerStats(), campaignName, null);

      const expected = [true, false, false, false];
      expect(createSaveListener.mock.calls.map(call => call[1].disadvantage))
        .toEqual(expected);
      // exact-key guard: the table above is over full configs too
      expect(createSaveListener.mock.calls).toEqual(TARGETS.map((targetName, i) => [
        campaignName,
        {
          targetName,
          saveType: 'WIS',
          saveDc: 16,
          dcSuccess: 'none',
          disadvantage: expected[i],
          condition: 'charmed',
        },
      ]));
    });

    it('logs an exact ability_use entry per target wired to that target prompt promptId', async () => {
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const abilityLogs = logCallsOfType('ability_use');
      expect(abilityLogs).toHaveLength(4);
      expect(abilityLogs.map(call => call[1].promptId))
        .toEqual(TARGETS.map(t => `${PROMPT_PREFIX}${t}`));
      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestCaster',
        abilityName: 'Mass Suggestion',
        description: 'TestCaster casts Mass Suggestion! Goblin must make a WIS save (DC 16) or become Charmed.',
        promptId: `${PROMPT_PREFIX}Goblin`,
      });
    });
  });

  describe('failed-save leg — charmed canon', () => {
    it('writes fresh charmed, registers expiration per target, logs the exact condition note', async () => {
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        ['charmed'],
        campaignName,
      );
      expect(charmedWrites()).toHaveLength(4);
      // Expiration is the subject duration lane (no concentration store write
      // exists on this handler) — registration strict table over all targets.
      expect(addExpiration.mock.calls).toEqual(expirationTable(TARGETS));

      const conditionLogs = logCallsOfType('condition');
      expect(conditionLogs).toHaveLength(4);
      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: 'Goblin',
        condition: 'Charmed',
        reason: 'Mass Suggestion spell',
        note: 'Goblin is Charmed by Mass Suggestion and pursues the suggested course of activity. The spell ends if TestCaster or allies deal damage to the target.',
        timestamp: expect.any(Number),
      });
    });

    it('dedupes a stored charmed by moving it to the end — filter-then-append', async () => {
      getRuntimeValue.mockReturnValue(['charmed', 'frightened']);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        ['frightened', 'charmed'],
        campaignName,
      );
      // every target took the same shape: other conditions preserved, exactly
      // one lowercase charmed at the tail
      charmedWrites().forEach(([, , conditions]) => {
        expect(conditions).toEqual(['frightened', 'charmed']);
      });
    });

    it('replaces a capitalized stored Charmed case-insensitively with lowercase charmed', async () => {
      getRuntimeValue.mockReturnValue(['Charmed', 'frightened']);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        ['frightened', 'charmed'],
        campaignName,
      );
    });

    it('degrades a non-array stored value to a clean single-charmed write', async () => {
      getRuntimeValue.mockReturnValue('charmed');

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        ['charmed'],
        campaignName,
      );
    });
  });

  describe('saved-save leg', () => {
    it('all saves: zero condition writes, zero expirations, all-success ledger, exact save_result log', async () => {
      stubSaves(allTargets(true));

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(addExpiration).not.toHaveBeenCalled();

      // Ledger payload shapes belong to the rejections lane; here only the
      // happy-path leg routing is pinned.
      expect(addTargetResult).toHaveBeenCalledTimes(4);
      expect(addTargetResult.mock.calls.map(call => call[1].saveResult))
        .toEqual(TARGETS.map(() => 'success'));

      const saveLogs = logCallsOfType('save_result');
      expect(saveLogs).toHaveLength(4);
      // pinned quirk: characterName is the CASTER, target lives in targetName
      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'save_result',
        characterName: 'TestCaster',
        rollType: 'save-mass-suggestion',
        targetName: 'Goblin',
        saveDc: 16,
        saveType: 'WIS',
        success: true,
        description: 'Goblin succeeded on WIS save against Mass Suggestion.',
      });
    });
  });

  describe('mixed saves — legs split per outcome', () => {
    it('failed targets charm, saved targets log saves — counts and lanes stay honest', async () => {
      stubSaves({ Orc: true, Kobold: true }); // Goblin, Bugbear fail

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(charmedWrites().map(call => call[0])).toEqual(['Goblin', 'Bugbear']);
      expect(addExpiration.mock.calls).toEqual(expirationTable(['Goblin', 'Bugbear']));
      expect(conditionTargets()).toEqual(['Goblin', 'Bugbear']);
      expect(logCallsOfType('save_result').map(call => call[1].targetName))
        .toEqual(['Orc', 'Kobold']);
      expect(addEntry).toHaveBeenCalledTimes(8); // 4 ability_use + 2 + 2

      // summary aggregation, lighter pins — the full string is owned by the
      // rejections lane's expectedSummary
      expect(result.payload.description).toContain('Mass Suggestion affects 2');
      expect(result.payload.description).toContain('2 creature(s) saved');
    });
  });

  describe('rollback header', () => {
    it('stores the exact aoe last-attack header once, before the first prompt arms', async () => {
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(storeSpellLastAttack).toHaveBeenCalledTimes(1);
      expect(storeSpellLastAttack).toHaveBeenCalledWith(campaignName, {
        casterName: 'TestCaster',
        spellName: 'Mass Suggestion',
        saveType: 'WIS',
        saveDc: 16,
        attackScope: 'aoe',
      });
      expect(storeSpellLastAttack.mock.invocationCallOrder[0])
        .toBeLessThan(createSaveListener.mock.invocationCallOrder[0]);
    });
  });

  describe('popup composition & caller contract', () => {
    it('returns the automation_info envelope as exact keys, description matched loosely', async () => {
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      // popup composition canon: exact envelope keys; the summary TEMPLATE
      // full-string is the rejections lane's, so description stays partial.
      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Mass Suggestion',
          description: expect.stringContaining('Mass Suggestion affects 4'),
        },
      });
      expect(result.payload.description).toContain('Charmed');
    });

    it('refuses a null combat context with the exact refusal popup and zero side effects', async () => {
      getCombatContext.mockResolvedValueOnce(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      // null-context shape lives here (the rejections lane owns the
      // creatures:[] refusal variant).
      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Mass Suggestion',
          description: 'No creatures in combat. Mass Suggestion has no effect.',
        },
      });
      expect(buildSaveDc).toHaveBeenCalledTimes(1); // DC read precedes the guard
      expect(storeSpellLastAttack).not.toHaveBeenCalled();
      expect(createSaveListener).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(addExpiration).not.toHaveBeenCalled();
    });

    it('propagates action.name verbatim into popup, ability log and rollback header — prose stays literal', async () => {
      const action = { ...makeAction(), name: 'My Mass Suggestion' };

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.name).toBe('My Mass Suggestion');
      expect(storeSpellLastAttack).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        spellName: 'My Mass Suggestion',
      }));
      // pinned quirk: abilityName tracks action.name, but the description
      // prose is a literal 'Mass Suggestion' template
      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'ability_use',
        abilityName: 'My Mass Suggestion',
        description: 'TestCaster casts Mass Suggestion! Goblin must make a WIS save (DC 16) or become Charmed.',
      }));
    });

    it('runs the WIS/16 default flow for an action with no automation object', async () => {
      const ps = makePlayerStats();

      await handle({ name: 'Mass Suggestion' }, ps, campaignName, null);

      expect(buildSaveDc).toHaveBeenCalledWith({}, ps);
      expect(createSaveListener).toHaveBeenCalledTimes(4);
      // hardcoded WIS survives an empty automation bag
      expect(createSaveListener.mock.calls).toEqual(TARGETS.map(targetName => [
        campaignName,
        {
          targetName,
          saveType: 'WIS',
          saveDc: 16,
          dcSuccess: 'none',
          disadvantage: false,
          condition: 'charmed',
        },
      ]));
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        ['charmed'],
        campaignName,
      );
    });
  });
});
