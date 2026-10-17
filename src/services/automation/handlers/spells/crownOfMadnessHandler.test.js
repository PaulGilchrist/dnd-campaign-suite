// @maintained-by-ai
// Crown of Madness cast lane — canonical home for crownOfMadnessHandler.handle.
// Live path (grep-verified 2026-10-16): spellCastService triggerSpells.js:255 'crown of madness'
// → crownOfMadnessService.triggerCrownOfMadness → executeHandler → automation/index.js:549
// `crown_of_madness: handleCrownOfMadness`.
//
// Seam map (recorded 2026-10-16, verified at source):
// - rollNpcSave DELEGATION is pinned here at crownOfMadnessHandler.js:182 (alongside
//   dominateHandler.js:174). rollNpcSave internals (2d20 keep-low, no-creature fallback)
//   are canon in the charm pair #1884/#1885 (seam map in charmSpellUtils.aura-immunity.test.js).
// - This handler does NOT consume handleCharmSpell — it owns a distinct single-target lane:
//   legacy activeConditions charmed write with NO aura-immunity gate and NO activeConditionMeta
//   (differs from charmSpellUtils.applyCharmFailure by design), plus its own concentration +
//   combatSummary storage persist (storage.set + 'combat-summary-updated' event) that the
//   charm lane does not do. All pinned below as own composition.
// - No turn-start logic lives here: the 'on each of its turns' enforcement is GM
//   adjudication carried in the note/popup text; the crown_of_madness te
//   (targetEffectDefinitions.js:753) is a manual GM-registry entry owned by
//   targetEffectDefinitions.test.js. This handler produces no targetEffect.
// - NPC dispatch arity is honest: the crown lane forwards (creature, dc, advantage) only —
//   Heightened disadvantage rides the player prompt leg (createSaveListener), not the NPC auto-roll.
// Seam notes:
// - buildSaveDc is stubbed to 16 (≠ automation.saveDc 15) so every downstream pin proves the
//   DC source is buildSaveDc, not action.automation.saveDc.
// - storeSpellLastAttack fires BEFORE resolveTarget and unconditionally (pinned).
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

vi.mock('../../../combat/conditions/savePromptService.js', () => ({
  sendSaveResult: vi.fn(),
}));

vi.mock('./charmSpellUtils.js', () => ({
  rollNpcSave: vi.fn(),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
}));

const combatSummaryRef = { creatures: [] };
vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => combatSummaryRef),
}));

vi.mock('../../../ui/storage.js', () => ({
  __esModule: true,
  default: {
    set: vi.fn(),
  },
}));

import { handle } from './crownOfMadnessHandler.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { sendSaveResult } from '../../../combat/conditions/savePromptService.js';
import { rollNpcSave } from './charmSpellUtils.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import { storeSpellLastAttack, addTargetResult } from '../../common/damageRollback.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import storage from '../../../ui/storage.js';

const campaignName = 'TestCampaign';
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

// MERGE-style helper: automation/metaCtx overrides splice into the shell, not replace it.
function makeAction(automationOverrides = {}, rest = {}) {
  return {
    name: 'Crown of Madness',
    automation: { type: 'crown_of_madness', saveType: 'WIS', saveDc: 15, ...automationOverrides },
    ...rest,
  };
}

function setupBaseMocks(saveResult = { success: true }) {
  resolveTarget.mockResolvedValue({
    target: { name: 'Goblin', type: 'player' },
    cs: { creatures: [{ name: 'Goblin', type: 'player', saveBonuses: { WIS: 2 } }] },
  });
  createSaveListener.mockReturnValue({
    promptId: 'test-prompt-id',
    promise: Promise.resolve(saveResult),
  });
}

function setupNpcMocks(saveResult = { success: false }) {
  const goblin = { name: 'Goblin', type: 'npc', saveBonuses: { WIS: 2 } };
  resolveTarget.mockResolvedValue({ target: goblin, cs: { creatures: [goblin] } });
  createSaveListener.mockReturnValue({
    promptId: 'test-prompt-id',
    promise: Promise.resolve(saveResult),
  });
  rollNpcSave.mockReturnValue({ roll: 8, total: 10, bonus: 2, success: false, rawRolls: [8, 12] });
  return goblin;
}

describe('crownOfMadnessHandler.handle', () => {
  let windowEvents;
  beforeEach(() => {
    vi.clearAllMocks();
    buildSaveDc.mockReturnValue(DC);
    getCombatSummary.mockReturnValue(combatSummaryRef);
    // Capture dispatched CustomEvents (save-result dispatch + combat-summary-updated).
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
    it('no target: unconditional rollback before resolveTarget, exact no-effect popup, no prompt', async () => {
      resolveTarget.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(storeSpellLastAttack).toHaveBeenCalledWith(campaignName, {
        casterName: 'TestCaster',
        spellName: 'Crown of Madness',
        saveType: 'WIS',
        saveDc: DC,
        attackScope: 'single',
      });
      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Crown of Madness',
          description: 'No target selected. Crown of Madness has no effect.',
        },
      });
      expect(createSaveListener).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
    });

    it('opens WIS prompt with exact args, DC from buildSaveDc, mapName ignored, full-string cast log', async () => {
      setupBaseMocks();

      await handle(makeAction(), makePlayerStats(), campaignName, 'some-map');

      expect(buildSaveDc).toHaveBeenCalledWith({ type: 'crown_of_madness', saveType: 'WIS', saveDc: 15 }, expect.any(Object));
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
        abilityName: 'Crown of Madness',
        description: 'TestCaster casts Crown of Madness on Goblin! Goblin must make a WIS save (DC 16) or become Charmed.',
        promptId: 'test-prompt-id',
      });
    });

    it('advantage and Heightened Spell transport ride the prompt and cast log', async () => {
      setupBaseMocks();

      await handle(makeAction({ advantage: true }), makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({ advantage: true, disadvantage: false }));
      const advLog = addEntry.mock.calls.find(call => call[1]?.type === 'ability_use');
      expect(advLog[1].description).toBe('TestCaster casts Crown of Madness on Goblin! Goblin must make a WIS save (DC 16) with Advantage or become Charmed.');

      setupBaseMocks();

      await handle(makeAction({}, { metaCtx: { metamagicHeighten: true } }), makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenLastCalledWith(campaignName, expect.objectContaining({ advantage: false, disadvantage: true }));
    });

    it('missing automation defaults to {} at the buildSaveDc seam', async () => {
      setupBaseMocks({ success: false });

      const result = await handle({ name: 'Crown of Madness' }, makePlayerStats(), campaignName, null);

      expect(buildSaveDc).toHaveBeenCalledWith({}, expect.any(Object));
      expect(result.type).toBe('popup');
    });
  });

  describe('NPC auto-save (rollNpcSave delegation — internals owned by pair #1884/#1885)', () => {
    it('delegates to charmSpellUtils.rollNpcSave(creature, dc, advantage) and dispatches its result byte-identical', async () => {
      const goblin = setupNpcMocks();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(rollNpcSave).toHaveBeenCalledWith(goblin, DC, false);
      expect(sendSaveResult).toHaveBeenCalledWith(campaignName, 'Goblin', {
        promptId: 'test-prompt-id',
        success: false,
        roll: 8,
        total: 10,
        saveBonus: 2,
        rawRolls: [8, 12],
      });
      const saved = windowEvents.filter(e => e.type === 'save-result').map(e => e.detail);
      expect(saved).toEqual([{
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

    it('advantage is forwarded; missing creature forwards undefined; player targets never delegate', async () => {
      const goblin = setupNpcMocks();

      await handle(makeAction({ advantage: true }), makePlayerStats(), campaignName, null);

      expect(rollNpcSave).toHaveBeenCalledWith(goblin, DC, true);

      resolveTarget.mockResolvedValue({ target: { name: 'Goblin', type: 'npc' }, cs: { creatures: [] } });
      rollNpcSave.mockReturnValue({ roll: 10, total: 10, bonus: 0, success: false, rawRolls: [10, 10] });

      await handle(makeAction({ advantage: true }), makePlayerStats(), campaignName, null);

      expect(rollNpcSave).toHaveBeenLastCalledWith(undefined, DC, true);

      setupBaseMocks();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(rollNpcSave).toHaveBeenCalledTimes(2);
    });
  });

  describe('successful save', () => {
    it('exact popup + save_result log + rollback ledger; zero condition/expiration/concentration writes', async () => {
      setupBaseMocks({ success: true, roll: 12, total: 17 });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Crown of Madness',
          description: 'Goblin succeeded on WIS save against Crown of Madness.',
        },
      });
      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'save_result',
        characterName: 'TestCaster',
        rollType: 'save-crown-of-madness',
        targetName: 'Goblin',
        saveDc: DC,
        saveType: 'WIS',
        success: true,
        description: 'Goblin succeeded on WIS save against Crown of Madness.',
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
      expect(addConcentration).not.toHaveBeenCalled();
      expect(storage.set).not.toHaveBeenCalled();

      // Second cast without roll metadata: ?? 0 defaults pin the rollback ledger shape.
      setupBaseMocks({ success: true });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addTargetResult).toHaveBeenLastCalledWith(campaignName, expect.objectContaining({ roll: 0, total: 0 }));
    });
  });

  describe('failed save (own composition)', () => {
    it('ledger + condition log + popup, full strings; roll/total default to 0', async () => {
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
        reason: 'Crown of Madness spell',
        note: 'Goblin is Charmed by TestCaster. On each of its turns, Goblin must use its action to make a melee attack against a creature chosen by TestCaster before moving.',
        timestamp: expect.any(Number),
      });
      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'save_result',
        success: false,
        description: 'Goblin failed WIS save and is Charmed by Crown of Madness.',
      }));
      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Crown of Madness',
          description: 'Goblin failed WIS save and is Charmed by Crown of Madness. On each of its turns, Goblin must use its action to make a melee attack against a creature chosen by TestCaster before moving.',
        },
      });

      setupBaseMocks({ success: false, total: 7 });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addTargetResult).toHaveBeenLastCalledWith(campaignName, expect.objectContaining({ roll: 0, total: 7 }));
    });

    it('charms with case-insensitive dedup, preserving other conditions', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue(['frightened', 'Charmed']);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(getRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', campaignName);
      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', ['frightened', 'charmed'], campaignName);
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

    it('persists expiration latch + concentration + combatSummary write-back and event', async () => {
      setupBaseMocks({ success: false });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addExpiration).toHaveBeenCalledWith({
        attackerName: 'TestCaster',
        targetName: 'Goblin',
        effects: [{ type: 'charmed', condition: 'charmed' }],
        campaignName,
      });
      expect(addConcentration).toHaveBeenCalledWith(combatSummaryRef, 'TestCaster', 'Crown of Madness', 12);
      expect(storage.set).toHaveBeenCalledWith('combatSummary', combatSummaryRef, campaignName);
      expect(windowEvents.filter(e => e.type === 'combat-summary-updated')).toHaveLength(1);
    });

    it.each([
      { spellAbilities: { saveDc: 17 }, proficiency: 4, expected: 17 },
      { proficiency: 4, expected: 12 },
      { proficiency: undefined, expected: 10 },
    ])('concentration DC own formula: $expected', async ({ spellAbilities, proficiency, expected }) => {
      setupBaseMocks({ success: false });

      await handle(makeAction(), makePlayerStats({ spellAbilities, proficiency }), campaignName, null);

      expect(addConcentration).toHaveBeenCalledWith(combatSummaryRef, 'TestCaster', 'Crown of Madness', expected);
    });

    it('null combatSummary: skips concentration and persist, charm still lands', async () => {
      setupBaseMocks({ success: false });
      getCombatSummary.mockReturnValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addConcentration).not.toHaveBeenCalled();
      expect(storage.set).not.toHaveBeenCalled();
      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', ['charmed'], campaignName);
      expect(result.payload.description).toContain('Charmed');
    });
  });

  describe('error handlers (log rejections never break the cast)', () => {
    it('ability_use cast-log rejection is caught and logged once; cast proceeds', async () => {
      setupBaseMocks({ success: false });
      addEntry.mockRejectedValueOnce(new Error('log failure'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      await vi.waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('[crownOfMadness] Error:', expect.any(Error));
      });
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(result.payload.description).toContain('Goblin');
      consoleSpy.mockRestore();
    });

    it('save_result rejection on the failed leg is caught; condition write and popup intact', async () => {
      setupBaseMocks({ success: false });
      addEntry.mockImplementation((campaign, entry) => (
        entry.type === 'save_result' ? Promise.reject(new Error('log failure')) : Promise.resolve()
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
