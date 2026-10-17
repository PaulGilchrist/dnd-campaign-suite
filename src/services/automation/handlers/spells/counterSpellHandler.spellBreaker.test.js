// @maintained-by-ai
// ── QUAD seam map — counterSpellHandler.js ─────────────────────────────
// Subject is LIVE: automation/index.js imports `handle` (l.201) and registers
// it as `reaction_counterspell` in the dispatch table (l.525).
//
// THIS FILE (#1895) — SPELL BREAKER lane (War Magic): refund/spend economy
// plus the CLA-322 reaction-spent round latch.
//   • refund keyed by the ACTUAL cast slot level (upcast-safe): level,
//     isUpcast+upcastLevel, and the no-spell-data default
//   • refund log is the lane's own composition — abilityName 'Spell Breaker',
//     full description string, exactly one ledger write per resolution
//     (one-shot listener disarms; duplicate save-result never double-refunds)
//   • 5e regression gate: no refund without the spell_breaker passive, nor
//     when slotRetentionSpells omits Counterspell
//   • CLA-322 latch lifecycle: refuses a second same-round trigger (returns
//     the paid slot at the refused cast level; nothing for a refused free
//     cast), stamps on a fresh round, re-arms when the round advances —
//     turn-based round counter at initiative seams, never a clock
// Not re-pinned here (owned elsewhere): save_result shapes, rollback args,
// 'counterspell-save-result' broadcast and promptId guard stay canonical in
// #1893 (handleResults); addEntry rejections and getRuntimeValue
// null/undefined/negative slot guards live in #1894 (rejections); handle()
// validation, spell detection and the prompt popup stay in #1896 (main).
// HANDOFF honoured — the three #1893 Spell Breaker tests removed there are
// superseded by the exact-named trio below. No game timers — captured
// listener awaits only.
// ─────────────────────────────────────────────────────────────────────────
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(() => 17),
  createSaveListener: vi.fn(() => ({ promptId: 'sb-prompt-1' })),
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

import { handle } from './counterSpellHandler.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { createSaveListener } from '../../common/savePrompt.js';
import { addEntry } from '../../../ui/logService.js';
import { findLastAttack, rollbackSpellEffects } from '../../common/damageRollback.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

const campaignName = 'test-campaign';
const LATCH_KEY = '_Counterspell_usedRound';
const SPELL_BREAKER = {
  type: 'spell_breaker',
  name: 'Spell Breaker',
  slotRetentionSpells: ['Counterspell', 'Dispel Magic'],
};

function makePlayerStats(overrides = {}) {
  const { automation, ...rest } = overrides;
  return {
    name: 'TestCaster',
    level: 20,
    proficiency: 6,
    abilities: [{ name: 'Intelligence', bonus: 3 }],
    // `automation` REPLACES wholesale (not merged) by design — regression
    // gates pass { passives: [] } to strip Spell Breaker from the base.
    automation: automation ?? { passives: [SPELL_BREAKER] },
    ...rest,
  };
}

function makeAction(overrides = {}) {
  const { automation = {}, spell = {}, ...rest } = overrides;
  return {
    name: 'Counterspell',
    // nested automation/spell overrides MERGE; callers keep untouched fields
    automation: { type: 'reaction_counterspell', saveType: 'CON', ...automation },
    spell: { name: 'Counterspell', level: 3, ...spell },
    ...rest,
  };
}

function armHappyPath(overrides = {}) {
  getCombatContext.mockResolvedValue({
    round: overrides.round ?? 1,
    creatures: [
      { name: 'Gazer 1', type: 'monster', currentHp: 7, maxHp: 7 },
      { name: 'TestCaster' },
    ],
  });
  rollbackSpellEffects.mockResolvedValue({ logDescription: null });
  findLastAttack.mockResolvedValue({
    attackEvent: { attackerName: 'Gazer 1', attackName: '3. Frost Ray', saveType: 'Dexterity' },
  });
  getRuntimeValue.mockImplementation((name, key) => {
    if (key === LATCH_KEY) return overrides.usedRound ?? null;
    if (key && key.startsWith('spell_slots_level_')) return overrides.slots ?? 2;
    return null;
  });
}

// Run handle() and capture the window 'save-result' listener. Awaiting
// savedCallback drives handleSaveResult end-to-end — no setTimeout flushes,
// no timer races (CLA-322 latch is a round counter, never a clock).
async function armListener(action, playerStats) {
  const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
  const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
  const result = await handle(action, playerStats, campaignName, null);
  const savedCallback = addEventListenerSpy.mock.calls.find(
    call => call[0] === 'save-result'
  )[1];
  return { result, savedCallback, addEventListenerSpy, removeEventListenerSpy };
}

function saveSlotCalls() {
  return setRuntimeValue.mock.calls.filter(
    call => String(call[1]).startsWith('spell_slots_level_')
  );
}

function spellBreakerLogs() {
  return addEntry.mock.calls.filter(call => call[1]?.abilityName === 'Spell Breaker');
}

describe('counterSpellHandler — Spell Breaker refund + latch (CLA-322)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createSaveListener.mockImplementation(() => ({ promptId: 'sb-prompt-1' }));
  });

  it('refunds at the actual cast slot level and logs Spell Breaker when the save succeeds', async () => {
    armHappyPath({ slots: 2 });

    const action = makeAction({ spell: { level: 5 } });
    const { savedCallback, addEventListenerSpy, removeEventListenerSpy } =
      await armListener(action, makePlayerStats());

    await savedCallback({ detail: { promptId: 'sb-prompt-1', success: true } });

    // Upcast refund: the level-5 charge is returned, not a level-3 charge
    expect(setRuntimeValue).toHaveBeenCalledWith('TestCaster', 'spell_slots_level_5', 3, campaignName);
    // Spend economy: exactly one ledger write per resolution
    expect(saveSlotCalls()).toHaveLength(1);

    // Refund log is this lane's own composition — full string, house rule:
    // every automation logs, naming Spell Breaker.
    const logs = spellBreakerLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0][0]).toBe(campaignName);
    expect(logs[0][1]).toEqual({
      type: 'ability_use',
      characterName: 'TestCaster',
      abilityName: 'Spell Breaker',
      description: `Spell Breaker: Counterspell failed to counter '3. Frost Ray' — spell slot level 5 refunded.`,
    });

    // One-shot listener disarmed after resolving; a duplicate save-result
    // dispatch must never double-refund the slot.
    expect(removeEventListenerSpy).toHaveBeenCalledWith('save-result', savedCallback);
    window.dispatchEvent(new CustomEvent('save-result', {
      detail: { promptId: 'sb-prompt-1', success: true },
    }));
    expect(saveSlotCalls()).toHaveLength(1);
    expect(spellBreakerLogs()).toHaveLength(1);

    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  it('refunds base level 3 when no upcast info is present', async () => {
    armHappyPath({ slots: 1 });

    const { savedCallback, addEventListenerSpy, removeEventListenerSpy } =
      await armListener(makeAction(), makePlayerStats());
    await savedCallback({ detail: { promptId: 'sb-prompt-1', success: true } });

    expect(setRuntimeValue).toHaveBeenCalledWith('TestCaster', 'spell_slots_level_3', 2, campaignName);
    expect(saveSlotCalls()).toHaveLength(1);

    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  // castLevel derivation table (refund call site): (isUpcast && upcastLevel)
  // || spell.level || 3 — pins the first and last branches.
  it.each([
    ['isUpcast + upcastLevel 7 beats base level', { level: 3, isUpcast: true, upcastLevel: 7 }, 7,
      `Spell Breaker: Counterspell failed to counter '3. Frost Ray' — spell slot level 7 refunded.`],
    ['no spell metadata on the action', 'DELETE', 3,
      `Spell Breaker: Counterspell failed to counter '3. Frost Ray' — spell slot level 3 refunded.`],
  ])('keys the refund to the actual cast slot (%s)', async (_label, spell, level, description) => {
    armHappyPath({ slots: 0 });

    const action = makeAction(spell === 'DELETE' ? {} : { spell });
    if (spell === 'DELETE') delete action.spell;

    const { savedCallback, addEventListenerSpy, removeEventListenerSpy } =
      await armListener(action, makePlayerStats());
    await savedCallback({ detail: { promptId: 'sb-prompt-1', success: true } });

    expect(setRuntimeValue).toHaveBeenCalledWith('TestCaster', `spell_slots_level_${level}`, 1, campaignName);
    expect(saveSlotCalls()).toHaveLength(1);
    expect(spellBreakerLogs()).toHaveLength(1);
    expect(spellBreakerLogs()[0][1].description).toBe(description);

    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  it('does not refund when the attacker fails the save (counterspell succeeded)', async () => {
    armHappyPath();

    const { savedCallback, addEventListenerSpy, removeEventListenerSpy } =
      await armListener(makeAction(), makePlayerStats());
    await savedCallback({ detail: { promptId: 'sb-prompt-1', success: false } });

    // Failed save = counterspell worked = the spent slot stays spent
    expect(saveSlotCalls()).toHaveLength(0);
    expect(spellBreakerLogs()).toHaveLength(0);
    expect(setRuntimeValue).not.toHaveBeenCalledWith(
      'TestCaster', expect.stringMatching(/^spell_slots_level_\d+$/), expect.any(Number), campaignName);

    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  it('does not refund without the Spell Breaker passive (5e regression gate)', async () => {
    armHappyPath();

    const { savedCallback, addEventListenerSpy, removeEventListenerSpy } =
      await armListener(makeAction(), makePlayerStats({ automation: { passives: [] } }));
    await savedCallback({ detail: { promptId: 'sb-prompt-1', success: true } });

    expect(saveSlotCalls()).toHaveLength(0);
    expect(spellBreakerLogs()).toHaveLength(0);

    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  // Gate matches TWO ways: passive type AND slotRetentionSpells membership.
  it.each([
    ['spell_breaker that omits Counterspell from slotRetentionSpells',
      [{ type: 'spell_breaker', name: 'Spell Breaker', slotRetentionSpells: ['Dispel Magic'] }]],
    ['a same-retention passive of a different type',
      [{ type: 'war_magic', name: 'War Magic', slotRetentionSpells: ['Counterspell'] }]],
  ])('does not refund for %s', async (_label, passives) => {
    armHappyPath();

    const { savedCallback, addEventListenerSpy, removeEventListenerSpy } =
      await armListener(makeAction(), makePlayerStats({ automation: { passives } }));
    await savedCallback({ detail: { promptId: 'sb-prompt-1', success: true } });

    expect(saveSlotCalls()).toHaveLength(0);
    expect(spellBreakerLogs()).toHaveLength(0);

    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  it('refuses a second trigger in the same round (reaction-spent latch) and returns the paid slot', async () => {
    armHappyPath({ usedRound: 1 });

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe(
      `Counterspell — Reaction already used this round. Spell slot level 3 returned.`);
    // Refusal is side-effect-free apart from the slot return: no save
    // prompt, no logs, and the latch stamp stays put.
    expect(result.payload.description).toContain('level 3 returned');
    expect(createSaveListener).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
    expect(setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(setRuntimeValue).toHaveBeenCalledWith('TestCaster', 'spell_slots_level_3', 3, campaignName);
    expect(getRuntimeValue).toHaveBeenCalledWith('TestCaster', LATCH_KEY, campaignName);
  });

  it('returns the upcast-level slot on a refused second trigger, not base level 3', async () => {
    armHappyPath({ usedRound: 2, round: 2, slots: 1 });

    const action = makeAction({ spell: { level: 3, isUpcast: true, upcastLevel: 7 } });
    const result = await handle(action, makePlayerStats(), campaignName, null);

    expect(result.payload.description).toBe(
      `Counterspell — Reaction already used this round. Spell slot level 7 returned.`);
    expect(setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(setRuntimeValue).toHaveBeenCalledWith('TestCaster', 'spell_slots_level_7', 2, campaignName);
    expect(createSaveListener).not.toHaveBeenCalled();
  });

  it('does not return a slot for a refused free cast', async () => {
    armHappyPath({ usedRound: 1 });

    const action = makeAction({ spell: { freeCastAuthorized: true } });
    const result = await handle(action, makePlayerStats(), campaignName, null);

    // Refused, but nothing was paid — the ledger must stay untouched
    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Reaction already used this round');
    expect(saveSlotCalls()).toHaveLength(0);
    expect(setRuntimeValue).not.toHaveBeenCalledWith(
      'TestCaster', LATCH_KEY, expect.any(Number), campaignName);
    expect(createSaveListener).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('stamps the reaction-spent latch when triggered in a fresh round', async () => {
    armHappyPath({ usedRound: null, round: 4 });

    const { result, savedCallback, addEventListenerSpy, removeEventListenerSpy } =
      await armListener(makeAction(), makePlayerStats());

    expect(setRuntimeValue).toHaveBeenCalledWith('TestCaster', LATCH_KEY, 4, campaignName);
    expect(createSaveListener).toHaveBeenCalled();
    // Fresh trigger pays no refund — ledger untouched, popup is the prompt
    expect(result.type).toBe('popup');
    expect(saveSlotCalls()).toHaveLength(0);

    // Unresolved save — de-arm so the listener can't fire into the next test
    window.removeEventListener('save-result', savedCallback);
    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  it('re-arms when the round advances past the stamped round (turn-based latch, never a clock)', async () => {
    armHappyPath({ usedRound: 3, round: 4 });

    const { savedCallback, addEventListenerSpy, removeEventListenerSpy } =
      await armListener(makeAction(), makePlayerStats());

    // Round 3 spent does not refuse round 4: latch re-stamped to current,
    // new CON save prompt armed
    expect(setRuntimeValue).toHaveBeenCalledWith('TestCaster', LATCH_KEY, 4, campaignName);
    expect(createSaveListener).toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalledWith(
      'TestCaster', LATCH_KEY, 3, campaignName);

    // Unresolved save — de-arm so the listener can't fire into the next test
    window.removeEventListener('save-result', savedCallback);
    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });
});
