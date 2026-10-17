// @maintained-by-ai
// #1901 dominateHandler.beast — canonical home for dominateHandler.handle internals.
// FIRST of the dominate TRIO (#1901 beast / #1902 monster / #1903 person, back-to-back),
// and the trio is ONE spell-name-driven module, NOT charm-shell-style (#1883) config
// wrappers: automation/index.js:551-553 maps dominate_beast/monster/person all to the
// same handleDominate — there is no per-spell config table. Every spell-flavored string
// derives from action.name inside the handler: rollType `save-${name.toLowerCase()
// .replace(/\s+/g,'-')}`, condition reason `${name} spell`, console prefix `[${name}] Error:`.
//
// Trio seam map (recorded 2026-10-16, verified at source):
// - THIS file (#1901, Dominate Beast lane) owns dominateHandler.js handle() internals as
//   own composition: cast seam (buildSaveDc, storeSpellLastAttack BEFORE resolveTarget and
//   unconditional, exact no-target popup, createSaveListener exact keys incl. the
//   metaCtx.metamagicHeighten→disadvantage transport at dominateHandler.js:154), success
//   leg recordDominateSuccess (popup + save_result log + addTargetResult ledger, ?? 0
//   defaults), failed leg applyDominateCharm (legacy activeConditions charmed write with
//   case-fold dedup/preserve, ZERO activeConditionMeta writes — differs from
//   charmSpellUtils.applyCharmFailure by design, pinned via setRuntimeValue call count),
//   the dominate-distinct expiration effects:[{type:'dominated'}] latch (dominateHandler is
//   the ONLY writer of 'dominated' expirations — applyDamage.js:1057), full-string
//   telepathic-link/command-issue note + popup, and the [Dominate Beast] log-rejection catches.
// - rollNpcSave DELEGATION is pinned here at dominateHandler.js:174 through the REAL
//   charmSpellUtils (its rollSaveForCreature/rollD20 deps remock under it). rollNpcSave
//   internals (creature passthrough arg order, 2d20 keep-high/keep-low, no-creature
//   fallback) are canon in the charm pair #1884/#1885 (see the seam map at
//   charmSpellUtils.aura-immunity.test.js:24, which assigns dominate consumers their own
//   delegation-only lane). Siblings therefore never re-run fallback internals here.
// - Downstream 'dominated' consumers live OUTSIDE this file: damage-triggered repeat saves
//   + domination end are applyDamage.findDomination/handleDominateRepeatSave
//   (applyDamage.js:1059/:1091, own lane); turn-bound command enforcement is GM
//   adjudication carried in the note/popup text — no turn/initiative seam lives in this
//   handler, and the command spell itself is commandHandler's own lane.
// - Sibling lanes (#1902 monster / #1903 person): spell-name variants ONLY — derived
//   rollType 'save-dominate-monster'/'save-dominate-person', reason strings, own-name
//   popup/log full-strings. The internals canonized above must NOT be re-run there; trim
//   toward that when processing the siblings. Service-side beast gating (Beast-type check,
//   injury-advantage roll, slot refund) is dominateBeastService.test.js; monster/person
//   trigger hop additionally carries checkCompelledDuelAttackExpiry (triggerSpells.js:292/:305)
//   — service lanes, not this handler lane.
//
// Beast caller liveness (grep-verified 2026-10-16): triggerSpells.js:50/:277
// handleDominateBeast → dominateBeastService.triggerDominateBeast (builds
// automation.type 'dominate_beast', advantage from target-not-full-health) →
// executeHandler → automation/index.js:551 `dominate_beast: handleDominate`.
// Seam notes:
// - buildSaveDc stubbed to 16 (≠ automation.saveDc 15) so every DC pin proves the source
//   is buildSaveDc, not action.automation.saveDc.
// - makeAction MERGES automation overrides into the shell (never replaces).
// - Turn-based: all writes are cast-time only; no timers, no wall-clock decay.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
import { sendSaveResult } from '../../../combat/conditions/savePromptService.js';
import { rollSaveForCreature } from '../../../rules/combat/applyDamage.js';
import { storeSpellLastAttack, addTargetResult } from '../../common/damageRollback.js';

const campaignName = 'test-campaign';
// 16 ≠ automation.saveDc 15 → pins that DC flows from buildSaveDc.
const DC = 16;

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Charisma', bonus: 3 }],
    ...overrides,
  };
}

// MERGE-style helper: automation overrides splice into the shell, not replace it.
function makeAction(automation = {}, rest = {}) {
  return {
    name: 'Dominate Beast',
    automation: { type: 'dominate_beast', saveType: 'WIS', saveDc: 15, ...automation },
    ...rest,
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
  createSaveListener.mockReturnValue({
    promptId: 'test-prompt-id',
    promise: Promise.resolve(saveResult),
  });
}

describe('dominateHandler.handle (Dominate Beast — trio canon)', () => {
  let windowEvents;
  beforeEach(() => {
    vi.clearAllMocks();
    buildSaveDc.mockReturnValue(DC);
    // Capture dispatched CustomEvents (save-result rides the NPC dispatch leg).
    windowEvents = [];
    vi.spyOn(window, 'dispatchEvent').mockImplementation(event => {
      windowEvents.push(event);
      return true;
    });
  });

  afterEach(() => {
    window.dispatchEvent.mockRestore();
  });

  describe('cast seam (exact keys)', () => {
    it('no target: unconditional rollback before resolveTarget, exact no-effect popup for null/empty/missing target, no prompt', async () => {
      resolveTarget.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(storeSpellLastAttack).toHaveBeenCalledWith(campaignName, {
        casterName: 'TestCaster',
        spellName: 'Dominate Beast',
        saveType: 'WIS',
        saveDc: DC,
        attackScope: 'single',
      });
      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Dominate Beast',
          description: 'No target selected. Dominate has no effect.',
        },
      });
      expect(createSaveListener).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();

      // Same guard also catches a resolved envelope with no usable name.
      for (const envelope of [{ target: null }, {}, { target: {} }]) {
        resolveTarget.mockResolvedValue(envelope);

        const empty = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(empty.payload.description).toBe('No target selected. Dominate has no effect.');
      }
      expect(createSaveListener).not.toHaveBeenCalled();
    });

    it('opens WIS prompt with exact args, DC from buildSaveDc, mapName ignored, full-string cast log', async () => {
      setupBaseMocks();

      await handle(makeAction(), makePlayerStats(), campaignName, 'some-map');

      expect(buildSaveDc).toHaveBeenCalledWith({ type: 'dominate_beast', saveType: 'WIS', saveDc: 15 }, expect.any(Object));
      expect(resolveTarget).toHaveBeenCalledWith(campaignName, 'TestCaster');
      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        attackerName: 'TestCaster',
        saveType: 'WIS',
        saveDc: DC,
        dcSuccess: 'none',
        advantage: false,
        disadvantage: false,
        condition: 'charmed',
      });
      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestCaster',
        abilityName: 'Dominate Beast',
        description: 'TestCaster casts Dominate Beast on Goblin! Goblin must make a WIS save (DC 16) or become Charmed.',
        promptId: 'test-prompt-id',
      });
    });

    it('advantage and Heightened Spell transport ride the prompt and cast log', async () => {
      setupBaseMocks();

      await handle(makeAction({ advantage: true }), makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({ advantage: true, disadvantage: false }));
      const advLog = addEntry.mock.calls.find(call => call[1]?.type === 'ability_use');
      expect(advLog[1].description).toBe('TestCaster casts Dominate Beast on Goblin! Goblin must make a WIS save (DC 16) with Advantage or become Charmed.');

      setupBaseMocks();

      await handle(makeAction({}, { metaCtx: { metamagicHeighten: true } }), makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenLastCalledWith(campaignName, expect.objectContaining({ advantage: false, disadvantage: true }));
    });

    it('missing automation defaults to {} at the buildSaveDc seam', async () => {
      setupBaseMocks({ success: false });

      const result = await handle({ name: 'Dominate Beast' }, makePlayerStats(), campaignName, null);

      expect(buildSaveDc).toHaveBeenCalledWith({}, expect.any(Object));
      expect(result.type).toBe('popup');
    });
  });

  describe('NPC auto-save (rollNpcSave delegation — internals owned by pair #1884/#1885)', () => {
    it('delegates to charmSpellUtils.rollNpcSave and dispatches its result byte-identical (sendSaveResult + save-result event)', async () => {
      rollSaveForCreature.mockReturnValue({ roll: 8, total: 10, bonus: 2, success: false, rawRolls: [8, 12] });
      setupBaseMocks({ success: false }, true);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      // Creature branch passthrough: arg order (creature, 'WIS', dc, disadvantage, advantage).
      expect(rollSaveForCreature).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Goblin', type: 'npc', saveBonuses: { WIS: 2 } }),
        'WIS',
        DC,
        false,
        false,
      );
      expect(sendSaveResult).toHaveBeenCalledWith(campaignName, 'Goblin', {
        promptId: 'test-prompt-id',
        success: false,
        roll: 8,
        total: 10,
        saveBonus: 2,
        rawRolls: [8, 12],
      });
      expect(windowEvents.filter(e => e.type === 'save-result').map(e => e.detail)).toEqual([{
        promptId: 'test-prompt-id',
        targetName: 'Goblin',
        saveType: 'WIS',
        saveDc: DC,
        success: false,
        roll: 8,
        total: 10,
        saveBonus: 2,
        rawRolls: [8, 12],
      }]);
    });

    it('advantage is forwarded on the delegation; player targets never delegate', async () => {
      rollSaveForCreature.mockReturnValue({ roll: 4, total: 6, bonus: 2, success: false, rawRolls: [4, 18] });
      setupBaseMocks({ success: false }, true);

      await handle(makeAction({ advantage: true }), makePlayerStats(), campaignName, null);

      expect(rollSaveForCreature).toHaveBeenCalledWith(expect.any(Object), 'WIS', DC, false, true);

      setupBaseMocks({ success: true });

      await handle(makeAction({ advantage: true }), makePlayerStats(), campaignName, null);

      expect(rollSaveForCreature).toHaveBeenCalledTimes(1);
      expect(sendSaveResult).toHaveBeenCalledTimes(1);
    });
  });

  describe('successful save', () => {
    it('exact popup + save_result log + rollback ledger; zero condition/expiration writes; ?? 0 defaults', async () => {
      setupBaseMocks({ success: true, roll: 12, total: 17 });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Dominate Beast',
          description: 'Goblin succeeded on WIS save (DC 16) against Dominate Beast. Roll: 12 + 0 = 17.',
        },
      });
      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'save_result',
        characterName: 'TestCaster',
        rollType: 'save-dominate-beast',
        targetName: 'Goblin',
        saveDc: DC,
        saveType: 'WIS',
        success: true,
        description: 'Goblin succeeded on WIS save against Dominate Beast.',
      });
      expect(addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveResult: 'success',
        roll: 12,
        total: 17,
        conditions: [],
        appliedDamage: 0,
      });
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(addExpiration).not.toHaveBeenCalled();
      expect(addEntry).toHaveBeenCalledTimes(2);

      // Second cast without roll metadata: ?? 0 defaults pin popup and ledger shape.
      setupBaseMocks({ success: true });

      const bare = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(bare.payload.description).toBe('Goblin succeeded on WIS save (DC 16) against Dominate Beast. Roll: 0 + 0 = 0.');
      expect(addTargetResult).toHaveBeenLastCalledWith(campaignName, expect.objectContaining({ roll: 0, total: 0 }));
    });
  });

  describe('failed save (own composition)', () => {
    it('charms with case-fold dedup and preservation; single activeConditions write, ZERO activeConditionMeta (charm-lane differs)', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue(['frightened', 'Charmed']);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(getRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', campaignName);
      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', ['frightened', 'charmed'], campaignName);
      // Dominate lane never touches activeConditionMeta (charmSpellUtils.applyCharmFailure does).
      expect(setRuntimeValue).toHaveBeenCalledTimes(1);
    });

    it('null or non-array stored conditions are replaced by a lone charmed', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue(null);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', ['charmed'], campaignName);

      getRuntimeValue.mockReturnValue('not-an-array');

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenLastCalledWith('Goblin', 'activeConditions', ['charmed'], campaignName);
    });

    it('registers the dominate-distinct dominated expiration latch exactly (sole writer, consumed by applyDamage.findDomination)', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addExpiration).toHaveBeenCalledWith({
        attackerName: 'TestCaster',
        targetName: 'Goblin',
        effects: [{ type: 'dominated', condition: 'charmed' }],
        campaignName,
      });
    });

    it('ledger + condition/save_result logs + popup, full strings; roll/total default to 0', async () => {
      setupBaseMocks({ success: false, roll: 5, total: 7 });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveResult: 'failure',
        roll: 5,
        total: 7,
        conditions: ['charmed'],
        appliedDamage: 0,
      });
      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: 'Goblin',
        condition: 'Charmed',
        reason: 'Dominate Beast spell',
        note: 'Goblin is Charmed by TestCaster and regards them as a friendly acquaintance. You have a telepathic link with the target as long as you are on the same plane of existence. You can use this link to issue commands to the target (no action required). The spell ends if TestCaster or allies deal damage to the target, or when the target takes damage and succeeds on a WIS save.',
        timestamp: expect.any(Number),
      });
      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'save_result',
        rollType: 'save-dominate-beast',
        success: false,
        description: 'Goblin failed WIS save against Dominate Beast and is Charmed.',
      }));
      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Dominate Beast',
          description: 'Goblin failed WIS save (DC 16) against Dominate Beast. Roll: 5 + 0 = 7 — Goblin is Charmed by TestCaster. You have a telepathic link with the target and can issue commands to it (no action required). The spell ends if concentration is lost, on initiative roll, short rest, or long rest.',
        },
      });

      setupBaseMocks({ success: false });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addTargetResult).toHaveBeenLastCalledWith(campaignName, expect.objectContaining({ roll: 0, total: 0 }));
    });
  });

  describe('error handlers (log rejections never break the cast)', () => {
    it('ability_use cast-log rejection is caught under the [Dominate Beast] prefix; cast proceeds', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);
      addEntry.mockImplementation((campaign, entry) => (
        entry.type === 'ability_use' ? Promise.reject(new Error('log write failed')) : Promise.resolve()
      ));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      await vi.waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('[Dominate Beast] Error:', expect.any(Error));
      });
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Goblin');
      consoleSpy.mockRestore();
    });

    it('save_result rejection on the failed leg is caught; condition write and popup intact', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);
      addEntry.mockImplementation((campaign, entry) => (
        entry.type === 'save_result' ? Promise.reject(new Error('log write failed')) : Promise.resolve()
      ));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      await vi.waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledTimes(1);
      });
      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', ['charmed'], campaignName);
      expect(result.payload.description).toContain('Charmed');
      consoleSpy.mockRestore();
    });
  });
});
