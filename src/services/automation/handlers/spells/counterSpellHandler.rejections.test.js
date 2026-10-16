import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── QUAD seam map — counterSpellHandler.js ─────────────────────────────
// Subject is LIVE: automation/index.js imports `handle` (l.201) and registers
// it as `reaction_counterspell` in the dispatch table (l.525); the dispatcher
// catches handler rejections (index.js l.745).
//
// THIS FILE (#1894) — REJECTION / ERROR lane:
//   • every addEntry rejection is swallowed via .catch(console.error) and
//     the flow continues (trigger log, failed-save success:false branch,
//     successful-save branch)
//   • service failures (getCombatContext / findLastAttack rejects,
//     createSaveListener throw) REJECT handle by contract — only addEntry
//     is swallowed — and never arm the save-result listener
//   • rollbackSpellEffects rejection propagates out of handleSaveResult and
//     leaves the listener armed (pinned current contract; logged to #1896)
//   • getRuntimeValue null/undefined/negative slot-refund guards
//   Save-result exact shapes, rollback args, broadcast payload and promptId
//   guard stay canonical in #1893 (handleResults). Spell Breaker refund
//   content lives in #1895. No game timers — captured-listener awaits only.
// ─────────────────────────────────────────────────────────────────────────

// ── Mocks BEFORE imports ───────────────────────────────────────────────

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(),
  getRuntimeValue: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
  findLastAttack: vi.fn(),
  rollbackSpellEffects: vi.fn(),
}));

// ── Imports ──────────────────────────────────────────────────────────────

import { handle } from './counterSpellHandler.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { addEntry } from '../../../ui/logService.js';
import { setRuntimeValue, getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { findLastAttack, rollbackSpellEffects } from '../../common/damageRollback.js';

// ── Helpers ──────────────────────────────────────────────────────────────

const campaignName = 'test-campaign';
const PROMPT_ID = 'rejections-prompt';
const SLOT_KEY = 'spell_slots_level_3';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Charisma', bonus: 3 }],
    ...overrides,
  };
}

function makeSpellBreakerStats() {
  return makePlayerStats({
    automation: {
      passives: [
        { type: 'spell_breaker', slotRetentionSpells: ['Counterspell'] },
      ],
    },
  });
}

function makeAction(automation = {}) {
  return {
    name: 'Counterspell',
    automation: {
      type: 'counterspell',
      saveType: 'CON',
      ...automation,
    },
  };
}

function makeCombatContext(overrides = {}) {
  return {
    round: 1,
    creatures: [
      { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
      { name: 'Orc', type: 'monster', currentHp: 15, maxHp: 22 },
      { name: 'TestCaster', gridX: 5, gridY: 10 },
    ],
    players: [
      { name: 'TestCaster', gridX: 5, gridY: 10 },
    ],
    placedItems: [],
    ...overrides,
  };
}

function makeLastAttack(overrides = {}) {
  const { attackEvent: attackEventOverrides = {}, ...rest } = overrides;
  return {
    attackEvent: {
      attackerName: 'Goblin',
      targetName: 'TestCaster',
      damageFormula: '3d6',
      damageName: 'Fire Bolt',
      attackName: 'Fire Bolt',
      saveType: null,
      primaryDamage: 9,
      secondaryDamage: 0,
      affectedTargets: ['TestCaster'],
      statusEffects: null,
      // attackEvent overrides MERGE (caller keeps untouched identity fields)
      ...attackEventOverrides,
    },
    attackerName: 'Goblin',
    targetName: 'TestCaster',
    primaryDamage: 9,
    secondaryDamage: 0,
    totalDamage: 9,
    damageTypes: ['Fire'],
    ...rest,
  };
}

// Run handle() and return spies + the captured window 'save-result'
// listener. Awaiting savedCallback awaits handleSaveResult end-to-end —
// no setTimeout flushes, no timer races.
async function armListener(action, playerStats) {
  const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
  const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
  await handle(action, playerStats, campaignName, null);
  const savedCallback = addEventListenerSpy.mock.calls.find(
    call => call[0] === 'save-result'
  )[1];
  return { savedCallback, addEventListenerSpy, removeEventListenerSpy };
}

function saveSlotCalls() {
  return setRuntimeValue.mock.calls.filter(
    call => String(call[1]).startsWith('spell_slots_level_')
  );
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('counterSpellHandler.rejections', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    // mockReset (not clearAllMocks) also drains queued once-implementations
    // so a rejection queued by one test can never leak into the next.
    getCombatContext.mockReset().mockResolvedValue(makeCombatContext());
    findLastAttack.mockReset().mockResolvedValue(makeLastAttack());
    buildSaveDc.mockReset().mockReturnValue(15);
    createSaveListener.mockReset().mockReturnValue({ promptId: PROMPT_ID });
    rollbackSpellEffects.mockReset().mockResolvedValue({
      targetsHealed: 0,
      conditionsRemoved: [],
      effectsRemoved: 0,
      damageHealed: 0,
      logDescription: '',
    });
    addEntry.mockReset().mockResolvedValue(undefined);
    setRuntimeValue.mockReset();
    getRuntimeValue.mockReset();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('addEntry rejection paths (swallowed + logged)', () => {
    it('swallows the initial ability_use rejection, logs it, and still arms the save listener', async () => {
      const err = new Error('db error');
      addEntry.mockRejectedValueOnce(err); // first call = trigger log

      const { savedCallback, addEventListenerSpy, removeEventListenerSpy } =
        await armListener(makeAction(), makePlayerStats());

      // Log attempted once, rejection caught at its own call site
      expect(addEntry).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith('[counterSpell] Error:', err);

      // Flow continued past the failed log — CON save prompt is armed
      const saveResultCalls = addEventListenerSpy.mock.calls.filter(
        call => call[0] === 'save-result'
      );
      expect(saveResultCalls).toHaveLength(1);

      // Unresolved by contract — de-arm so it can't fire into the next test
      expect(removeEventListenerSpy).not.toHaveBeenCalledWith('save-result', savedCallback);
      window.removeEventListener('save-result', savedCallback);
      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });

    it.each([
      ['failed save (counterspell succeeds)', false],
      ['successful save (counterspell fails)', true],
    ])('swallows every addEntry rejection on %s and still finishes the branch', async (_label, success) => {
      const err = new Error('db error');
      addEntry.mockImplementation(() => Promise.reject(err));

      const { savedCallback, addEventListenerSpy, removeEventListenerSpy } =
        await armListener(makeAction(), makePlayerStats());

      // handleSaveResult resolves despite every log rejecting
      await expect(savedCallback({
        detail: { promptId: PROMPT_ID, success },
      })).resolves.toBeUndefined();

      // Trigger log + save_result log both attempted, both console.error'd
      expect(addEntry).toHaveBeenCalledTimes(2);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
      expect(consoleErrorSpy).toHaveBeenCalledWith('[counterSpell] Error:', err);

      // Log failures must not corrupt the combat side effects
      expect(rollbackSpellEffects).toHaveBeenCalledTimes(success ? 0 : 1);

      // One-shot listener cleanup runs even through the rejected logs
      expect(removeEventListenerSpy).toHaveBeenCalledWith('save-result', savedCallback);

      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });
  });

  describe('service failures (rejections propagate by contract)', () => {
    it('rejects when getCombatContext rejects — nothing logged, no listener armed', async () => {
      getCombatContext.mockRejectedValueOnce(new Error('context unavailable'));
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      // Dispatcher (index.js l.745) is the catcher — handler must not swallow
      await expect(handle(makeAction(), makePlayerStats(), campaignName, null))
        .rejects.toThrow('context unavailable');

      expect(findLastAttack).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
      expect(addEventListenerSpy.mock.calls.filter(call => call[0] === 'save-result')).toHaveLength(0);
      addEventListenerSpy.mockRestore();
    });

    it('rejects when findLastAttack rejects — nothing logged, no listener armed', async () => {
      findLastAttack.mockRejectedValueOnce(new Error('log read failed'));
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      await expect(handle(makeAction(), makePlayerStats(), campaignName, null))
        .rejects.toThrow('log read failed');

      expect(findLastAttack).toHaveBeenCalledWith(campaignName);
      expect(addEntry).not.toHaveBeenCalled();
      expect(addEventListenerSpy.mock.calls.filter(call => call[0] === 'save-result')).toHaveLength(0);
      addEventListenerSpy.mockRestore();
    });

    it('rejects when createSaveListener throws — save prompt precedes every log', async () => {
      createSaveListener.mockImplementationOnce(() => {
        throw new Error('prompt failed');
      });
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      await expect(handle(makeAction(), makePlayerStats(), campaignName, null))
        .rejects.toThrow('prompt failed');

      expect(addEntry).not.toHaveBeenCalled();
      expect(addEventListenerSpy.mock.calls.filter(call => call[0] === 'save-result')).toHaveLength(0);
      addEventListenerSpy.mockRestore();
    });

    it('propagates a rollbackSpellEffects rejection and leaves the listener armed (current contract)', async () => {
      rollbackSpellEffects.mockRejectedValueOnce(new Error('rollback failed'));

      const { savedCallback, addEventListenerSpy, removeEventListenerSpy } =
        await armListener(makeAction(), makePlayerStats());

      // Rollback runs BEFORE the failed-save logs — its rejection aborts
      // the branch (pinned current behavior; flagged for #1896 review)
      await expect(savedCallback({
        detail: { promptId: PROMPT_ID, success: false },
      })).rejects.toThrow('rollback failed');

      // Aborted before the save_result log; only the trigger log exists
      expect(addEntry).toHaveBeenCalledTimes(1);
      expect(addEntry.mock.calls.filter(call => call[1]?.type === 'save_result')).toHaveLength(0);

      // Abort skips the one-shot cleanup — listener stays armed
      expect(removeEventListenerSpy).not.toHaveBeenCalledWith('save-result', savedCallback);

      window.removeEventListener('save-result', savedCallback); // de-arm for hygiene
      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });
  });

  describe('spell slot refund guards (getRuntimeValue)', () => {
    // Keyed implementation: the slot read gets the hostile value, the
    // reaction-latch read stays clean so the guard under test is isolated.
    function stubSlotRead(value) {
      getRuntimeValue.mockImplementation((_name, key) =>
        key === SLOT_KEY ? value : undefined
      );
    }

    it.each([
      ['null', null],
      ['undefined', undefined],
      ['a negative number', -1],
    ])('does not write %s + 1 to the slot ledger when the stored count is %s', async (_label, badValue) => {
      stubSlotRead(badValue);

      const { savedCallback, addEventListenerSpy, removeEventListenerSpy } =
        await armListener(makeAction(), makeSpellBreakerStats());

      await savedCallback({ detail: { promptId: PROMPT_ID, success: true } });

      // Guard actually consulted the exact slot key
      expect(getRuntimeValue).toHaveBeenCalledWith('TestCaster', SLOT_KEY);
      // Bad reading must never reach the ledger
      expect(saveSlotCalls()).toHaveLength(0);
      expect(setRuntimeValue).not.toHaveBeenCalledWith('TestCaster', SLOT_KEY, expect.any(Number), campaignName);

      // Success branch completed — one-shot listener disarmed itself
      expect(removeEventListenerSpy).toHaveBeenCalledWith('save-result', savedCallback);

      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });

    it('writes the refund when the stored count sits on the guard boundary (0) — guard pin is not vacuous', async () => {
      stubSlotRead(0); // 0 is legal: `currentSlots != null && currentSlots >= 0`

      const { savedCallback, addEventListenerSpy, removeEventListenerSpy } =
        await armListener(makeAction(), makeSpellBreakerStats());

      await savedCallback({ detail: { promptId: PROMPT_ID, success: true } });

      expect(setRuntimeValue).toHaveBeenCalledWith('TestCaster', SLOT_KEY, 1, campaignName);

      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });
  });
});
