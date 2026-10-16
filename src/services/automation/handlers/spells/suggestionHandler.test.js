// # suggestionHandler — Suggestion (SP-113): single-target WIS save, dcSuccess 'none', Charmed
// on fail, damage-break ender. NOT a delegation shell — unlike the charmMonster/charmPerson pair
// (#1883, 11-line shells over charmSpellUtils; #1884/#1885 own those utils' internals), this
// module imports NO charmSpellUtils (grep-verified 2026-10-16): it is its own canonical home, so
// full inline pins stay. massSuggestion (pair closed earlier, 14/18) is a DISTINCT module — its
// multi-target orchestration and rejections lanes are not mirrored here by assumption.
//
// Caller liveness (grep-verified 2026-10-16): automation/index.js:242 imports handle as
// handleSuggestion → HANDLER_MAP suggestion: handleSuggestion (index.js:576) → executeHandler
// (index.js:702) dynamic dispatch. Spell rows ship in BOTH rulesets (public/data/spells.json +
// public/data/2024/spells.json, index 'suggestion') — one shared handler, dual-ruleset by design.
// Manifest SP-113 verified 2026-10-09 (host run: 'no save' data-wrong, WIS dc_success:none;
// charmed write + expiry stamp + damage-break consumers live).
//
// Rollback ledger (previously mocked-but-unasserted — folded in, house pattern per animalFriendship
// /banishment lanes): storeSpellLastAttack fires BEFORE the target guard, so the ledger is stamped
// even on a targetless attempt; addTargetResult pins exact success/failure ledger payloads with
// conditions [] vs ['charmed'] — the ledger/condition coherence seam.
//
// DC provenance decoy: automation.saveDc is 15 in every fixture but the handler takes its dc ONLY
// from buildSaveDc (mocked 17) — every downstream saveDc pin reads 17, proving provenance.
//
// Duration honesty: retired test names claimed 'default 24 hour' / '8 hour when auto.duration' —
// the handler passes NO duration anywhere and never reads auto.duration (no-timers policy: >=1 min
// is combat-scoped; the clock lives in expirations.js downstream, cleared at initiative/rest seams).
// The strict addExpiration table below pins that absence; the auto.duration decoy is deleted.
//
// Trim map (29 → 18, folded or provably subsumed):
// - no-target null vs missing-name legs → one test, same !targetName guard, + prompt-not-raised guard
// - mapName-ignored deleted: assertion byte-identical to the resolveTarget args pin; _mapName is
//   an underscore-unused param
// - preserve-conditions leg folded into dedupe: ['CHARMED','frightened'] → ['frightened','charmed']
//   already pins filter + preserve + append-order
// - auto.duration '8 hour' twin deleted (identical assertion, dead input)
// - getRuntimeValue undefined / non-array legs → one test (single Array.isArray guard; the L87
//   `|| []` is subsumed by L88)
// - metamagic falsy + missing-metaCtx legs already strictly pinned by the default createSaveListener
//   table (disadvantage:false) → only the heightened-true leg stays
// - custom-name ability_use + custom-name popup → one test (abilityName/spellName dynamic, prose literal)
// - 4 blanket addEntry-rejection tests with >=1 asserts → one per path with EXACT console.error counts
//   (success: ability_use + save_result = 2; failure: + condition = 3) and flow-continues guards
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

import { handle } from './suggestionHandler.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { storeSpellLastAttack, addTargetResult } from '../../common/damageRollback.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';

const campaignName = 'test-campaign';

// buildSaveDc returns 17 while fixtures carry automation.saveDc 15 — the decoy that proves every
// downstream dc is buildSaveDc-derived.
function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Charisma', bonus: 3 }],
    ...overrides,
  };
}

// Lane convention: merges top-level AND automation overrides.
function makeAction(overrides = {}) {
  return {
    name: 'Suggestion',
    ...overrides,
    automation: { type: 'suggestion', saveType: 'WIS', saveDc: 15, ...overrides.automation },
  };
}

function setupBaseMocks(saveResult = { success: true }) {
  resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
  buildSaveDc.mockReturnValue(17);
  createSaveListener.mockReturnValue({
    promptId: 'test-prompt-id',
    promise: Promise.resolve(saveResult),
  });
}

function setupRejectingAddEntry() {
  addEntry.mockImplementation(() => Promise.reject(new Error('log error')));
}

function spyConsoleError() {
  return vi.spyOn(console, 'error').mockImplementation(() => {});
}

describe('suggestionHandler.handle', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('target resolution and pre-save side effects', () => {
    it('returns honest popup without raising a save prompt when no target name resolves', async () => {
      // Both legs of the !targetName guard: null targetInfo and target-without-name.
      resolveTarget.mockResolvedValueOnce(null);
      const first = await handle(makeAction(), makePlayerStats(), campaignName, null);
      resolveTarget.mockResolvedValueOnce({ target: {} });
      const second = await handle(makeAction(), makePlayerStats(), campaignName, null);

      for (const result of [first, second]) {
        expect(result).toEqual({
          type: 'popup',
          payload: {
            type: 'automation_info',
            name: 'Suggestion',
            description: 'No target selected. Suggestion has no effect.',
          },
        });
      }
      expect(createSaveListener).not.toHaveBeenCalled();
      // Ledger honesty: the attempt is still stamped before the guard (rollback lane).
      expect(storeSpellLastAttack).toHaveBeenCalledTimes(2);
    });

    it('reads the target via resolveTarget and stamps the rollback ledger with the WIS single-target payload', async () => {
      setupBaseMocks();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(resolveTarget).toHaveBeenCalledWith(campaignName, 'TestCaster');
      expect(storeSpellLastAttack).toHaveBeenCalledWith(campaignName, {
        casterName: 'TestCaster',
        spellName: 'Suggestion',
        saveType: 'WIS',
        saveDc: 17,
        attackScope: 'single',
      });
    });

    it('raises the save prompt with the exact contract (dc from buildSaveDc, dcSuccess none, condition charmed)', async () => {
      setupBaseMocks();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveType: 'WIS',
        saveDc: 17,
        dcSuccess: 'none',
        disadvantage: false,
        condition: 'charmed',
      });
    });
  });

  describe('logging and naming', () => {
    it('logs ability_use with exact shape and verbatim description', async () => {
      setupBaseMocks();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestCaster',
        abilityName: 'Suggestion',
        description: 'TestCaster casts Suggestion on Goblin! Goblin must make a WIS save (DC 17) or become Charmed.',
        promptId: 'test-prompt-id',
      });
    });

    it('tracks action.name in abilityName/spellName/popup name while prose and ledger spell-name-free text stay literal', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);

      const ps = makePlayerStats({ name: 'WizardX' });
      const result = await handle(makeAction({ name: 'My Suggestion' }), ps, campaignName, null);

      expect(storeSpellLastAttack).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        spellName: 'My Suggestion',
      }));
      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'ability_use',
        characterName: 'WizardX',
        abilityName: 'My Suggestion',
        description: 'WizardX casts Suggestion on Goblin! Goblin must make a WIS save (DC 17) or become Charmed.',
      }));
      expect(result.payload.name).toBe('My Suggestion');
      expect(result.payload.description).toBe(
        'Goblin failed WIS save and is Charmed by Suggestion. The Charmed target pursues the suggested course of activity. The spell ends if WizardX or allies deal damage to the target.'
      );
    });
  });

  describe('successful save', () => {
    it('returns the verbatim success popup', async () => {
      setupBaseMocks({ success: true });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Suggestion',
          description: 'Goblin succeeded on WIS save against Suggestion.',
        },
      });
    });

    it('writes the success rollback ledger and save_result entry exactly (missing roll/total default to 0)', async () => {
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
      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'save_result',
        characterName: 'TestCaster',
        rollType: 'save-suggestion',
        targetName: 'Goblin',
        saveDc: 17,
        saveType: 'WIS',
        success: true,
        description: 'Goblin succeeded on WIS save against Suggestion.',
      });
    });

    it('does not write conditions or expiration on success', async () => {
      setupBaseMocks({ success: true });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(addExpiration).not.toHaveBeenCalled();
      const types = addEntry.mock.calls.map(call => call[1].type);
      expect(types).toEqual(['ability_use', 'save_result']);
    });
  });

  describe('failed save', () => {
    it('writes charmed onto the target through the runtime store (fresh and dedupe/preserve legs)', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(getRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', campaignName);
      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', ['charmed'], campaignName);

      // Uppercase 'CHARMED' filtered case-insensitively; 'frightened' preserved; append order held.
      getRuntimeValue.mockReturnValue(['CHARMED', 'frightened']);
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenLastCalledWith('Goblin', 'activeConditions', ['frightened', 'charmed'], campaignName);
    });

    it('registers expiration with the strict effect table and NO duration (combat-scoped clock lives downstream)', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addExpiration).toHaveBeenCalledWith({
        attackerName: 'TestCaster',
        targetName: 'Goblin',
        effects: [{ type: 'charmed', condition: 'charmed' }],
        campaignName,
      });
    });

    it('posts the condition log with verbatim damage-break note', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: 'Goblin',
        condition: 'Charmed',
        reason: 'Suggestion spell',
        note: 'Goblin is Charmed by Suggestion and pursues the suggested course of activity. The spell ends if TestCaster or allies deal damage to the target.',
        timestamp: expect.any(Number),
      });
    });

    it('writes the failure rollback ledger and save_result entry exactly', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveResult: 'failure',
        roll: 0,
        total: 0,
        conditions: ['charmed'],
        appliedDamage: 0,
      });
      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'save_result',
        characterName: 'TestCaster',
        rollType: 'save-suggestion',
        targetName: 'Goblin',
        saveDc: 17,
        saveType: 'WIS',
        success: false,
        description: 'Goblin failed WIS save against Suggestion and is Charmed.',
      });
    });

    it('returns the verbatim failure popup', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Suggestion',
          description: 'Goblin failed WIS save and is Charmed by Suggestion. The Charmed target pursues the suggested course of activity. The spell ends if TestCaster or allies deal damage to the target.',
        },
      });
    });
  });

  describe('log rejections never break the flow', () => {
    it('on success path, every addEntry rejection is caught and logged (2 legs) and the popup still returns', async () => {
      const consoleSpy = spyConsoleError();
      setupRejectingAddEntry();
      setupBaseMocks({ success: true });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      // ability_use + save_result both reject → exactly 2 caught errors.
      expect(consoleSpy).toHaveBeenCalledTimes(2);
      expect(consoleSpy).toHaveBeenCalledWith('[suggestion] Error:', expect.any(Error));
      expect(result.payload.description).toBe('Goblin succeeded on WIS save against Suggestion.');
      consoleSpy.mockRestore();
    });

    it('on failure path, every addEntry rejection is caught and logged (3 legs) and the charmed write still lands', async () => {
      const consoleSpy = spyConsoleError();
      setupRejectingAddEntry();
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      // ability_use + condition + save_result all reject → exactly 3 caught errors.
      expect(consoleSpy).toHaveBeenCalledTimes(3);
      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', ['charmed'], campaignName);
      expect(addExpiration).toHaveBeenCalledTimes(1);
      expect(result.payload.description).toContain('Charmed by Suggestion');
      consoleSpy.mockRestore();
    });
  });

  describe('edge cases', () => {
    it('defaults missing automation to {} into buildSaveDc', async () => {
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      buildSaveDc.mockReturnValue(10);
      createSaveListener.mockReturnValue({
        promptId: 'test-prompt-id',
        promise: Promise.resolve({ success: false }),
      });
      getRuntimeValue.mockReturnValue([]);

      const ps = makePlayerStats();
      const result = await handle({ name: 'Suggestion' }, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(buildSaveDc).toHaveBeenCalledWith({}, ps);
    });

    it('defaults non-array stored conditions to empty (undefined and junk legs)', async () => {
      setupBaseMocks({ success: false });

      getRuntimeValue.mockReturnValue(undefined);
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(setRuntimeValue).toHaveBeenLastCalledWith('Goblin', 'activeConditions', ['charmed'], campaignName);

      getRuntimeValue.mockReturnValue('not-an-array');
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(setRuntimeValue).toHaveBeenLastCalledWith('Goblin', 'activeConditions', ['charmed'], campaignName);
    });

    it('heightened spell forces disadvantage on the save prompt', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);

      await handle(makeAction({ metaCtx: { metamagicHeighten: true } }), makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        disadvantage: true,
      }));
    });
  });
});
