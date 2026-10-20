// @maintained-by-ai
// MA-0020 framework lane (Aboleth "Dominate Mind (2/Day)", #976 exemplar):
// owns ALL generic ability-save N/Day machinery — the rest of the family
// cites here and holds only its ticket rows.
//
// PRESERVED-CITED-BY:
//  - banshee MA-0352 (#1080): '(1/Day)' real-row suffix-strip leg,
//    unlimited→null decoy, no-burn guard shape cite the mechanisms pinned here;
//  - dretch MA-0633 (#1081): no-suffix verbatim store key and the consumer
//    spend-cycle shape cite here;
//  - vrock MA-1674: legacy uses-STRING → Number()=NaN → gate null incident —
//    the NaN coercion/gate legs live here (folded up per #1080 adjudication;
//    vrock's ticket :54-82 cycle was the model for the spend cycle below);
//  - succubus MA-1546 / imp queued lanes: consume monsterAbilitySaveUsesGate
//    on their own rows; arithmetic cited here;
//  - MonsterCardModal.ability-save-uses.test.jsx: cite-skips gate arithmetic
//    and refusal wording to this file (line refs stale after this rewrite).
//
// Faces pinned here (strongest versions): suffix-strip ladder it.each;
// maxUses coercion census (#959 — ?? precedence/fallback/zero-preserved,
// Number() leg, honest NaN); gate ladder truth-table incl reach-branch
// clamp (#903/#936/#1035) and honest unlimited/NaN/≤0 → null; refusal log +
// popup canonical shape pinned ONCE exact (#829); spend increment exact
// store tuple campaign-keyed (#932/#1019), use derived from the gate —
// gate-reads-what-spend-wrote contract (#1080); double-spend guard exact
// with zero burn (#949/#1026/#1028); store FAITHFUL keyed per monster and
// per ability (#1019). No wall-clock: resets are dawn/seam-adjacent text
// only; Date.now() lives in log timestamps, never asserted (#app).
//
// old→new: old "keys the counter off…" → strip ladder + store-key + census;
// old "reports remaining 2/1/exhausted" → gate truth table (superset);
// old "unlimited rows → null" → gate table null legs (superset);
// old refusal log + popup → single exact-shape test (was regex, now toBe);
// old spend / double-spend → gate-derived spend cycle + guard test
// (exact campaign-keyed setRV tuple, was unasserted; refusal bytes now the
// shared #829 pin, console guard noise now pinned);
// old duration-note pair → duration it.each.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  MONSTER_SPELL_USES_KEY,
  abilitySaveUseKey,
  abilitySaveMaxUses,
  monsterAbilitySaveUsesGate,
  buildAbilitySaveRefusalLog,
  buildAbilitySaveRefusalPopup,
  spendMonsterAbilityUse,
  extractConditionDurationNote,
} from './monsterAbilityUses.js';

// Real on-disk aboleth row — no transcription (#977); MA-0020 ground truth (#993).
const monsters = JSON.parse(readFileSync(resolve(__dirname, '../../../public/data/monsters.json'), 'utf8'));
const dominate = monsters.find(m => m.name === 'Aboleth').actions.find(a => a.name === 'Dominate Mind (2/Day)');

const REFUSAL_DESC = 'Aboleth 1 has already used Dominate Mind today (2/Day) — Dominate Mind refused. Uses reset at dawn; GM-enforced for monsters.';

function makeDeps(store) {
  const reads = [];
  const writes = [];
  const logs = [];
  const deps = {
    getRuntimeValue: (name, key) => { reads.push([name, key]); return store[`${name}.${key}`] ?? null; },
    setRuntimeValue: (name, key, value, campaignName) => { writes.push([name, key, value, campaignName]); store[`${name}.${key}`] = value; return Promise.resolve(); },
    addEntry: (campaignName, entry) => { logs.push([campaignName, entry]); return Promise.resolve(); },
  };
  return { deps, reads, writes, logs };
}

afterEach(() => vi.restoreAllMocks());

describe('MA-0020 use-key strip ladder + store key', () => {
  it.each([
    ['Dominate Mind (2/Day)', 'Dominate Mind', 'aboleth ground-truth row (#993)'],
    ['Deathly Wail (1/Day)', 'Deathly Wail', "banshee's real '(1/Day)' suffix — cited here #1080"],
    ['Fetid Cloud', 'Fetid Cloud', 'no-suffix rows pass through verbatim (dretch shape, #1081)'],
    ['Charm (1/Day Each)', 'Charm', 'the (N/Day Each) regex branch the ladder supports'],
    ['Web (Recharge 5–6)', 'Web (Recharge 5–6)', 'ladder is /Day-anchored only — recharge parentheticals survive'],
  ])('abilitySaveUseKey(%s) → %s — %s', (name, expected) => {
    expect(abilitySaveUseKey({ name })).toBe(expected);
  });

  it('reuses the MA-0005 monsterSpellUses runtime map — no third map', () => {
    expect(MONSTER_SPELL_USES_KEY).toBe('monsterSpellUses');
  });
});

describe('MA-0020 abilitySaveMaxUses coercion census (#959)', () => {
  it.each([
    ['maxUses wins over uses', { maxUses: 2, uses: 1 }, 2],
    ['?? falls back to uses when maxUses absent', { uses: 2 }, 2],
    ['?? preserves authored 0 (|| would wrongly fall through to uses)', { maxUses: 0, uses: 2 }, 0],
    ['numeric-string coerced by Number()', { maxUses: '2' }, 2],
    ['unlimited rows → null', {}, null],
    ['absent action → null', undefined, null],
  ])('%s', (_title, action, expected) => {
    expect(abilitySaveMaxUses(action)).toBe(expected);
  });

  it('honest NaN leg: legacy uses-STRING stays NaN here — the gate nulls it below', () => {
    expect(Number.isNaN(abilitySaveMaxUses({ uses: '1/Day' }))).toBe(true);
  });
});

describe('MA-0020 gate ladder truth-table', () => {
  it.each([
    ['fresh — nothing stored', dominate, {}, { useKey: 'Dominate Mind', maxUses: 2, used: 0, remaining: 2, exhausted: false }],
    ['part-spent', dominate, { 'Dominate Mind': 1 }, { useKey: 'Dominate Mind', maxUses: 2, used: 1, remaining: 1, exhausted: false }],
    ['exhausted at max', dominate, { 'Dominate Mind': 2 }, { useKey: 'Dominate Mind', maxUses: 2, used: 2, remaining: 0, exhausted: true }],
    ['over-spent clamps remaining to 0, stays exhausted (Math.max reach-branch #1035)', dominate, { 'Dominate Mind': 3 }, { useKey: 'Dominate Mind', maxUses: 2, used: 3, remaining: 0, exhausted: true }],
    ['numeric-string store value coerced', dominate, { 'Dominate Mind': '1' }, { useKey: 'Dominate Mind', maxUses: 2, used: 1, remaining: 1, exhausted: false }],
    ['garbage store value counts as 0 — fresh fires', dominate, { 'Dominate Mind': 'garbage' }, { useKey: 'Dominate Mind', maxUses: 2, used: 0, remaining: 2, exhausted: false }],
    ['unrelated store keys ignored', dominate, { 'Other': 5 }, { useKey: 'Dominate Mind', maxUses: 2, used: 0, remaining: 2, exhausted: false }],
    ['storedUses undefined — fresh fires', dominate, undefined, { useKey: 'Dominate Mind', maxUses: 2, used: 0, remaining: 2, exhausted: false }],
  ])('%s', (_title, action, stored, expected) => {
    expect(monsterAbilitySaveUsesGate(action, stored)).toEqual(expected);
  });

  it.each([
    ['unlimited row (no authored uses) → null — honest unlimited', { name: 'Tentacle', save_dc: 14 }],
    ['legacy NaN uses-string → null (vrock MA-1674 incident class)', { name: 'Stunning Scream', uses: '1/Day' }],
    ['maxUses ≤ 0 → null — no 0/Day rows authored; ≤0 is unmanaged like unlimited', { name: 'Fake', maxUses: 0 }],
  ])('%s', (_title, action) => {
    expect(monsterAbilitySaveUsesGate(action, {})).toBeNull();
    expect(monsterAbilitySaveUsesGate(action, { 'Dominate Mind': 9 })).toBeNull();
  });
});

describe('MA-0020 refusal notice canonical shape — pinned ONCE (#829)', () => {
  it('refusal log: automation type dominate_mind_refused (space→underscore slug) with zero-spend wording, exact bytes', () => {
    const entry = buildAbilitySaveRefusalLog({ monsterName: 'Aboleth 1', useKey: 'Dominate Mind', maxUses: 2 });
    expect(entry.type).toBe('automation');
    expect(entry.automationType).toBe('dominate_mind_refused');
    expect(entry.characterName).toBe('Aboleth 1');
    expect(entry.abilityName).toBe('Dominate Mind');
    expect(entry.description).toBe(REFUSAL_DESC);
  });

  it('refusal popup: mc-prerequisite-refusal block promising no save rolled and nothing spent, exact bytes', () => {
    expect(buildAbilitySaveRefusalPopup({ monsterName: 'Aboleth 1', useKey: 'Dominate Mind', maxUses: 2 })).toBe(
      '<div class="mc-prerequisite-refusal"><h3>Uses Exhausted</h3><p>Aboleth 1 has already used Dominate Mind today (2/Day). No save rolled, nothing spent. Uses reset at dawn (GM-enforced for monsters).</p></div>'
    );
  });
});

describe('MA-0020 spend at prompt-confirm — gate-reads-what-spend-wrote cycle (#1080)', () => {
  it('2/Day cycle: use derived from the gate; spends write the exact campaign-keyed store tuple (#932/#1019) and log ability_use; gate re-read sees exhaustion', async () => {
    const store = {};
    const { deps, reads, writes, logs } = makeDeps(store);
    const fresh = monsterAbilitySaveUsesGate(dominate, store[`Aboleth 1.${MONSTER_SPELL_USES_KEY}`]);
    const use = { useKey: fresh.useKey, maxUses: fresh.maxUses, actionName: dominate.name };

    const remaining1 = await spendMonsterAbilityUse({ monsterName: 'Aboleth 1', use, targetName: 'AberrantSorcerer', campaignName: 'test-campaign', deps });
    expect(remaining1).toBe(1);
    expect(reads).toContainEqual(['Aboleth 1', MONSTER_SPELL_USES_KEY]); // spend reads the same key the gate reads
    expect(writes[0]).toEqual(['Aboleth 1', MONSTER_SPELL_USES_KEY, { 'Dominate Mind': 1 }, 'test-campaign']);
    expect(store['Aboleth 1.monsterSpellUses']).toEqual({ 'Dominate Mind': 1 });
    expect(logs).toHaveLength(1);
    expect(logs[0][0]).toBe('test-campaign');
    expect(logs[0][1].type).toBe('ability_use');
    expect(logs[0][1].abilityName).toBe('Dominate Mind (2/Day)');
    expect(logs[0][1].description).toBe('Aboleth 1 uses Dominate Mind on AberrantSorcerer — 1 use spent, 1 left today (resets at dawn, GM-enforced for monsters).');

    const remaining2 = await spendMonsterAbilityUse({ monsterName: 'Aboleth 1', use, targetName: 'Other', campaignName: 'test-campaign', deps });
    expect(remaining2).toBe(0);
    expect(store['Aboleth 1.monsterSpellUses']).toEqual({ 'Dominate Mind': 2 });

    const spent = monsterAbilitySaveUsesGate(dominate, store['Aboleth 1.monsterSpellUses']); // gate reads what spend wrote
    expect(spent).toMatchObject({ useKey: 'Dominate Mind', remaining: 0, exhausted: true });
  });

  it('double-spend guard at max (#949): returns null, refuses with exact #829 bytes, zero burn — store and log counts unchanged (#1026/#1028)', async () => {
    const store = { 'Aboleth 1.monsterSpellUses': { 'Dominate Mind': 2 } };
    const { deps, writes, logs } = makeDeps(store);
    const use = { useKey: 'Dominate Mind', maxUses: 2, actionName: 'Dominate Mind (2/Day)' };
    const guard = vi.spyOn(console, 'error');

    const dup = await spendMonsterAbilityUse({ monsterName: 'Aboleth 1', use, targetName: 'AberrantSorcerer', campaignName: 'test-campaign', deps });

    expect(dup).toBeNull();
    expect(writes).toHaveLength(0); // zero burn (#1026)
    expect(store['Aboleth 1.monsterSpellUses']).toEqual({ 'Dominate Mind': 2 }); // byte-for-byte unchanged
    expect(guard).toHaveBeenCalledTimes(1); // guard stays loud
    const refusal = logs.find(([, e]) => e.automationType === 'dominate_mind_refused');
    expect(refusal[1].description).toBe(REFUSAL_DESC); // refusal produced by the guard, never hand-built
    expect(logs.filter(([, e]) => e.type === 'ability_use')).toHaveLength(0);
  });

  it('store FAITHFUL keyed (#1019): per-monster and per-ability counters spend independently', async () => {
    const store = {};
    const { deps } = makeDeps(store);
    const useDominate = { useKey: 'Dominate Mind', maxUses: 2, actionName: 'Dominate Mind (2/Day)' };

    const b1 = await spendMonsterAbilityUse({ monsterName: 'Aboleth 1', use: useDominate, campaignName: 'test-campaign', deps });
    const b2 = await spendMonsterAbilityUse({ monsterName: 'Aboleth 2', use: useDominate, campaignName: 'test-campaign', deps });
    expect(b1).toBe(1);
    expect(b2).toBe(1);
    expect(store['Aboleth 1.monsterSpellUses']).toEqual({ 'Dominate Mind': 1 });
    expect(store['Aboleth 2.monsterSpellUses']).toEqual({ 'Dominate Mind': 1 });
    expect(monsterAbilitySaveUsesGate(dominate, store['Aboleth 2.monsterSpellUses'])).toMatchObject({ used: 1, exhausted: false });
    expect(store['Aboleth 1.monsterSpellUses']['Other']).toBeUndefined(); // no key bleed across abilities
  });
});

describe('MA-0020 duration note (CLA-325 advisory)', () => {
  it.each([
    ['aboleth until-clause extracted, GM-enforced tagged', dominate.save_effect, 'until the aboleth dies or is on a different plane of existence from the target (GM-enforced)'],
    ['clause terminates at the period (dretch on-disk text)', 'Failure: be poisoned until the start of its next turn.', 'until the start of its next turn (GM-enforced)'],
    ['no until-clause → null', 'Failure: 10 (3d6) Psychic damage. Success: Half damage.', null],
    ['absent effect → null', null, null],
  ])('%s', (_title, saveEffect, expected) => {
    expect(extractConditionDurationNote(saveEffect)).toBe(expected);
  });
});
