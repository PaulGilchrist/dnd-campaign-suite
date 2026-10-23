// @maintained-by-ai
// SPELL MASTERY PAYMENT lane — CLA-323 (Wizard 'Spell Mastery', lv18; the root-cause fix was
// "higher-level casts consume no spell slot (free-upcast leak)" — commit e30e441a4). Which
// EFFECTIVE cast levels ride free (chosen names at their EXACT lowest level, UNLIMITED, no
// stamp) and which PAY (every higher level, cast-level slot key) — the whole lane lives in the
// gate twins + payment ledger below.
//
// LIVE BOUNDARY (verbatim, split ratified 2026-10-21):
//   #1522 verbatim: 'Mastery lv1/2 (name+level exact, UNLIMITED, no stamp) =
//     spellMasteryPayment.test.js FULL ownership' — plus its absorbed CLA-323 cross-row pair,
//     BOTH bytes verified live HERE this pass:
//       'does NOT authorize the lv1 mastery spell upcast to lv2'           -> gate row (below)
//       'lv1 mastery spell upcast to lv2 expends spell_slots_level_2 only' -> pay-pair row
//   #1513 oracle verbatim (:19-21): '#3  masteryOrSavantFreeCast  SpellMastery lv1/lv2 EXACT
//     name+level; [...] [upcast gates owned by cla312/cla323 siblings]' — the gate #3 row is
//     folded OUT of the oracle to this lane; the oracle keeps only the lv1/lv2 base ALLOW arms
//     ('Magic Missile'@1, 'Shield'@2, lowercase deny, 3-arg campaign-tier arity — cited, never
//     re-grown here). #1522 owns Signature lv3 latch; #1517 owns the generic consumeBaseSlot/
//     consumeUpcastSlot pay/deny ladder (:718-726/:765-789) and the #1516 :720/:767 read-vs-write
//     arity pin — UNIFIED (reads now carry campaignName too); mirrored on our rows, never re-pinned here.
//
// DISK LAW (readFileSync + drift-throw at load — disk text is law #1365; fabrication-ban):
// public/data/2024/classes.json Wizard .class_levels[level 18].features 'Spell Mastery'
// (automation.type 'spell_mastery'): "Choose a level 1 and a level 2 spell in your spellbook
// that have a casting time of an action. You always have those spells prepared, and you can
// cast them at their lowest level without expending a spell slot. To cast either spell at a
// higher level, you must expend a spell slot."  FREE set = chosen name+lowest level, UNLIMITED
// (law carries NO once-per-day latch and NO cantrip clause); PAID set = every effective level
// above base ('must expend a spell slot' — the upcast-pays pair above is the ticket edge).
// Chosen fixtures are REAL 2024 spells.json rows meeting the law's action clause byte-for-byte:
// Thunderwave lv1 'Action' V/S and Shatter lv2 'Action' V/S/M (level + casting_time +
// components asserted at load). lv18 slot bank (4/3/3/3/3/1/1/1/1) is disk spellcasting bytes.
// Selection store SpellMastery_level1/2 holds chosen spell-NAME strings — producer
// spellMasteryHandler.js:124-125 writes, :101-102 clears to REAL null (null-selection deny
// pinned below; store answers REAL absent->null, useRuntimeState.js:74 #1517 form).
// RULESET CENSUS: 5e public/data/classes.json Wizard lv18 carries the SAME 'Spell Mastery' row
// with the same automation.type — producer exists both rulesets, so no producer-absence denial
// row (#1520 form) applies; the consumer gate (:166-170) is ruleset-agnostic on these keys.
// Caster fixture documented-lite: 'DivinationWizard' carried over from the original lane; lv20
// hand-typed stats replaced by disk lv18 max bank; no spellAbilities.spells array — the
// spellbook reads (:278/:543/:237) optional-chain to undefined on every row here.
//
// UNLIMITED LEDGER PROOF (#1519 canon): same-spell casts on ONE live store -> ZERO setRuntimeValue
// writes TOTAL — mastery free casts write NOTHING (no _used stamp — the signature contrast #1522:
// Signature lv3 stamps SignatureSpells_<Spell>_used once-per-rest; Mastery has name/level gate
// ONLY, unlimited, nothing consumed). Free-path slot census (stronger form #1519 'ladder never
// consulted'): ZERO spell_slots_level_* READS on any free cast; ZERO addEntry rows; NO-CLOCK —
// zero timers in this file, disk mastery row carries zero 'recharge' bytes (asserted at load;
// unlimited needs no re-arm), timestamps never inspected.
//
// QUIRK SCANS (quantified): vacuous self-compute 0 — the gate twin arms :169/:170 are
//   observably-distinct (#1348): 'Thunderwave'@2 false and 'Shatter'@1 false kill the classic
//   name-check-drop and spellLevel-drop twins in both directions; a non-matching spell at a
//   matching level ('Magic Missile'@1) kills bare-level mutants. freeCastAuthorized is a LIVE
//   isFreeCastAuthorized call on the SAME store prepareSpellCast consumes (no canned booleans
//   #1521 live-read-backed). :0-swallow quantified: consumeUpcastSlot :723 banked-0 DENY on the
//   paid arm writes nothing (#1522 DENY form; generic ladder owned by #1517, not duplicated) and
//   the denial never claws back the lv1/lv2 free entitlement (mastery-specific survival row).
//   falsy-map: selection REAL-null (handler clear byte) denies where stored-name allows.
//   Case: gate :169-:170 is === case-exact; case trails pinned by oracle #1513 :332 on the
//   same service bytes — cited, not re-grown. invocationCallOrder: gate reads precede verdict on
//   every row (every read ledger is inspected per cast). Golden unguarded-deref #1518: the
//   mastery lane (:166-:170) derefs only strings and store reads — no entry.name builder hazard;
//   console untouched every row. Dead twins quantified: disk has exactly ONE Wizard
//   'Spell Mastery' row per ruleset (asserted); FREE_CAST_ENTRY_TYPES (:9) EXCLUDES
//   'spell_mastery', so the actions/bonusActions/specialActions scans stay dark on these rows
//   (automation skeleton ships empty arrays; the exact-of-0 write ledger proves it).
//   Purity every row: input spell + metaCtx snapshots unchanged; modifiedSpell is a fresh copy.
//   Arity mirror (resource-flow.js :720/:767 home #1517/#1516): paid-key READ tuples arrive
//   arity-2, WRITE tuples arity-4 — byte-pinned on the pay row, hazard reported there, not fixed.
//
// KILL MATRIX (declared analytic — never git-checkout mutants):
//   :169 drop name check           | 'Magic Missile'@1 allow-arm flips true -> gate row fails
//   :169 drop spellLevel===1      | 'Thunderwave'@2 gate false-byte flips -> gate + pay rows fail
//   :170 drop name check          | 'Thunderwave'@2 rides :170 true -> gate + pay census fails
//   :170 drop spellLevel===2      | 'Shatter'@1 false-byte flips -> gate row fails
//   stamp added on free cast      | UNLIMITED row exact-of-0 write ledger fails
//   :834 drop !isUpcast           | free base casts pay lv1/lv2 bank -> zero-read census fails
//   :834 drop !isFreeCast         | denied upcast... entitlement rows: free-cast ladder-reads fail
//   :719 slotKey wrong level      | exact-of-2 write tuples [lv2],[lv3] fail
//   :723 `<=0` -> `<0`            | banked-0 row writes -1 -> zero-writes pin fails
//   :966 ternary drop             | modifiedSpell.level/baseLevel bytes fail both pay rows
//   :1016-:1017 envelope drop     | metaCtx toStrictEqual fails on every payment row
//
// MOCK CENSUS exact-of-7 direct import boundaries of spellPreparationService.js (:1-:7):
// MOCKED 5 — useRuntimeState (live mem store: consume reads what it wrote #1521; missing byte
// answers REAL null :74), combatData (null), concentrationService (trio), storage, logService
// (resolved-Promise addEntry so the zero-log contract is observable). REAL 2 — metamagicRules
// (canned-hollowing ban #1491: isPsionicSpell/hasPsionicSorcery compute over the disk-derived
// fixture, passives [] honored) and castingTimeUtils (reached only via Warlock Spell Breaker
// :890, off-lane). Unit-under-test NEVER mocked; barrel keys 0; dead-module mocks 0.
//
// PRESERVED-CITED-BY: signatureUpcastPayment.test.js:21-22 — 'Mastery sibling header: lv1/lv2
// mastery casts, UNLIMITED, no stamp [...] the CLA-323 lv1->lv2 gate/payment pair lives there,
// not here (removed)' — BOTH verbatim bytes live here (see LIVE BOUNDARY). Campaign locked
// 'test-campaign' lockdown.
// SECURITY NOTE (#1446 kiro-injection precedent): disk JSON + siblings scanned for injection-
// shaped content while deriving fixtures; none encountered; nothing executes disk strings
// beyond JSON.parse. This lane writes only test-file bytes.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cloneDeep } from 'lodash';

// ── Disk rows: REAL bytes, drift-throw at load (#1509-#1522 streak form) ──
const classes2024 = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/2024/classes.json'), 'utf8'));
const classes5e = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/classes.json'), 'utf8'));
const spells2024 = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/2024/spells.json'), 'utf8'));

const wizard24 = classes2024.find(c => c.name === 'Wizard');
const wizard5e = classes5e.find(c => c.name === 'Wizard');
const masteryLv18 = wizard24.class_levels.find(l => l.level === 18);
const masteryFeature = masteryLv18.features.find(f => f.name === 'Spell Mastery');
if (!masteryFeature || masteryFeature.automation?.type !== 'spell_mastery') {
  throw new Error('disk drift: 2024 Wizard lv18 Spell Mastery row missing');
}
if (wizard24.class_levels.filter(l => (l.features || []).some(f => f.name === 'Spell Mastery')).length !== 1) {
  throw new Error('disk drift: more than one 2024 Wizard Spell Mastery row — re-scan dead twins');
}
if (JSON.stringify(masteryFeature).includes('recharge')) {
  throw new Error('disk drift: recharge byte appeared on Spell Mastery — UNLIMITED law changed');
}
for (const clause of [
  'Choose a level 1 and a level 2 spell in your spellbook that have a casting time of an action',
  'cast them at their lowest level without expending a spell slot',
  'To cast either spell at a higher level, you must expend a spell slot',
]) {
  if (!masteryFeature.description.includes(clause)) {
    throw new Error(`CLA-323 disk law drifted: missing '${clause}'`);
  }
}
// 5e census: same feature both rulesets -> no producer-absence denial row (#1520 form).
if (!wizard5e.class_levels.find(l => l.level === 18)?.features?.some(f => f.name === 'Spell Mastery' && f.automation?.type === 'spell_mastery')) {
  throw new Error('disk drift: 5e Wizard lv18 Spell Mastery row missing — re-check producer-absence census');
}
const lv18Bank = cloneDeep(
  Object.fromEntries(Object.entries(masteryLv18.spellcasting).filter(([k]) => /^spell_slots_level_\d+$/.test(k))));
if (lv18Bank.spell_slots_level_1 !== 4 || lv18Bank.spell_slots_level_2 !== 3 || lv18Bank.spell_slots_level_3 !== 3) {
  throw new Error('disk drift: lv18 spellcasting bank changed');
}
const diskThunderwave = spells2024.find(s => s.name === 'Thunderwave');
const diskShatter = spells2024.find(s => s.name === 'Shatter');
if (!diskThunderwave || diskThunderwave.level !== 1 || diskThunderwave.casting_time !== 'Action'
  || JSON.stringify(diskThunderwave.components) !== '["V","S"]') {
  throw new Error('disk drift: Thunderwave lv1 action/components bytes changed');
}
if (!diskShatter || diskShatter.level !== 2 || diskShatter.casting_time !== 'Action'
  || JSON.stringify(diskShatter.components) !== '["V","S","M"]') {
  throw new Error('disk drift: Shatter lv2 action/components bytes changed');
}

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => {
  const setRuntimeValue = vi.fn();
  const getRuntimeValue = vi.fn(() => null);
  const clearRuntimeState = vi.fn();
  return { setRuntimeValue, getRuntimeValue, clearRuntimeState };
});

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
}));

vi.mock('../../../services/combat/concentration/concentrationService.js', () => ({
  breakConcentration: vi.fn(),
  addConcentration: vi.fn(),
  cleanupConcentrationEffects: vi.fn(),
}));

vi.mock('../../../services/ui/storage.js', () => ({
  default: { set: vi.fn() },
}));

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve({})),
}));

import { prepareSpellCast, isFreeCastAuthorized } from './spellPreparationService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../services/ui/logService.js';

const CASTER = 'DivinationWizard';
const CAMPAIGN = 'test-campaign';
const LADDER = /^spell_slots_level_\d+$/;

function makeStats() {
  return {
    name: CASTER,
    level: 18,
    rules: '2024',
    class: { name: wizard24.name },
    spellAbilities: { spellCastingAbility: 'Intelligence', ...cloneDeep(lv18Bank) },
    automation: { actions: [], bonusActions: [], specialActions: [], passives: [] },
  };
}

// Live mem store (store-faithful #1521): consume reads exactly what it wrote; missing byte
// answers REAL null (useRuntimeState.js:74). Selection seed mirrors the producer bytes
// spellMasteryHandler.js:124-125 (chosen spell-NAME strings).
function liveRuntime(initial = {}) {
  const store = {
    SpellMastery_level1: diskThunderwave.name,
    SpellMastery_level2: diskShatter.name,
    ...cloneDeep(lv18Bank),
    ...initial,
  };
  getRuntimeValue.mockImplementation((_name, key) => (key in store ? store[key] : null));
  setRuntimeValue.mockImplementation((_name, key, value) => { store[key] = value; });
  return store;
}

// Caller-faithful effective-level gate (gateLevel = cast level, useCustomHandlers.js:19-20).
const gate = (spellName, effectiveLevel) =>
  isFreeCastAuthorized(CASTER, spellName, effectiveLevel, makeStats(), CAMPAIGN);

const payWrites = () => setRuntimeValue.mock.calls.filter(c => LADDER.test(String(c[1])));
const payReads = () => getRuntimeValue.mock.calls.filter(c => LADDER.test(String(c[1])));

describe('CLA-323 — Spell Mastery (Wizard lv18) payment: free at lowest level UNLIMITED, paid above', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(null);
  });

  it('gate twins name+level exact: allows chosen lv1@1 and lv2@2; does NOT authorize the lv1 mastery spell upcast to lv2 (nor lv2 upcast to lv3); cross-name, non-chosen and REAL-null selections deny', () => {
    liveRuntime();
    expect(gate('Thunderwave', 1)).toBe(true);   // :169 exact name+level allow arm
    expect(gate('Shatter', 2)).toBe(true);       // :170 exact name+level allow arm
    expect(gate('Thunderwave', 2)).toBe(false);  // #1522 verbatim: does NOT authorize the lv1 mastery spell upcast to lv2
    expect(gate('Thunderwave', 3)).toBe(false);  // higher still denies (:169 level arm only)
    expect(gate('Shatter', 3)).toBe(false);      // lv2 mastery spell upcast to lv3 denies
    expect(gate('Shatter', 1)).toBe(false);      // cross arm: lv2 name at lv1 kills :170-name-drop AND :169-level-drop twins (#1348)
    expect(gate('Magic Missile', 1)).toBe(false); // non-chosen spell at a mastery level: name gate is decisive
    liveRuntime({ SpellMastery_level1: null, SpellMastery_level2: null }); // handler clear byte :101-102
    expect(gate('Thunderwave', 1)).toBe(false);  // REAL-null selection denies (#1517 store-faithful)
  });

  it('base casts are FREE and UNLIMITED on one live store: three casts write NOTHING total — no stamp, no counter, ladder never consulted', async () => {
    const stats = makeStats();
    const store = liveRuntime();
    const spell = { ...diskThunderwave };
    const spellSh = { ...diskShatter };
    const metaCtxIn = {};

    const opts = (spellName, effectiveLevel) => ({
      playerName: CASTER,
      playerStats: stats,
      campaignName: CAMPAIGN,
      isUpcast: false,
      freeCastAuthorized: gate(spellName, effectiveLevel), // LIVE gate re-reads the store each cast
    });

    const r1 = await prepareSpellCast(spell, metaCtxIn, opts('Thunderwave', 1));
    const r2 = await prepareSpellCast(spell, {}, opts('Thunderwave', 1)); // same spell again — still free
    const r3 = await prepareSpellCast(spellSh, {}, opts('Shatter', 2));

    for (const r of [r1, r2, r3]) {
      expect(r.freeCastUsed).toBe(true);
      expect(r.slotConsumed).toBe(false);
    }
    // UNLIMITED ledger (#1519): free casts write NOTHING — the no-stamp contrast vs the
    // Signature latch (#1522). Exact-of-0 across all three casts, no mid-test mock clear.
    expect(setRuntimeValue).toHaveBeenCalledTimes(0);
    expect(payWrites()).toEqual([]);
    // stronger-form census (#1519): the payment ladder is NEVER READ on a free cast.
    expect(payReads()).toEqual([]);
    expect(addEntry).toHaveBeenCalledTimes(0); // no log row, no clock
    // store untouched: banks and selections byte-intact
    expect(store.spell_slots_level_1).toBe(4);
    expect(store.spell_slots_level_2).toBe(3);
    expect(store.SpellMastery_level1).toBe('Thunderwave');
    expect(store.SpellMastery_level2).toBe('Shatter');
    // purity + fresh-copy + envelope every direction
    expect(r1.modifiedSpell).not.toBe(spell);
    expect('baseLevel' in r1.modifiedSpell).toBe(false); // base cast: no level-change stamp
    expect(spell.level).toBe(1);
    expect(spellSh.level).toBe(2);
    expect(metaCtxIn).toStrictEqual({});
    expect(r3.metaCtx).toStrictEqual({ oldConcentrationSpell: null, shouldSetConcentration: false, slotConsumed: false, freeCastUsed: true });
  });

  it('upcast-pays pair (#1522 verbatim): lv1 mastery spell upcast to lv2 expends spell_slots_level_2 only, lv2 mastery spell upcast to lv3 expends spell_slots_level_3 only', async () => {
    const stats = makeStats();
    const store = liveRuntime();
    const bankLv2 = lv18Bank.spell_slots_level_2;
    const bankLv3 = lv18Bank.spell_slots_level_3;

    const auth1 = gate('Thunderwave', 2);
    expect(auth1).toBe(false); // gate row byte: upcast is NOT free — it pays
    const r1 = await prepareSpellCast({ ...diskThunderwave }, {}, {
      playerName: CASTER, playerStats: stats, campaignName: CAMPAIGN,
      isUpcast: true, upcastLevel: 2, freeCastAuthorized: auth1,
    });

    const auth2 = gate('Shatter', 3);
    expect(auth2).toBe(false);
    const r2 = await prepareSpellCast({ ...diskShatter }, {}, {
      playerName: CASTER, playerStats: stats, campaignName: CAMPAIGN,
      isUpcast: true, upcastLevel: 3, freeCastAuthorized: auth2,
    });

    // full write ledger exact-of-2: each upcast pays its CAST-level key once, in sequence;
    // spell_slots_level_1 (the free lane's bank) is never in the ledger.
    expect(setRuntimeValue.mock.calls).toStrictEqual([
      [CASTER, 'spell_slots_level_2', bankLv2 - 1, CAMPAIGN],
      [CASTER, 'spell_slots_level_3', bankLv3 - 1, CAMPAIGN],
    ]);
    expect(store.spell_slots_level_2).toBe(bankLv2 - 1);
    expect(store.spell_slots_level_3).toBe(bankLv3 - 1);
    expect(store.spell_slots_level_1).toBe(4);
    expect(store.SpellMastery_level1).toBe('Thunderwave'); // payment never burns the selection
    // arity mirror (pin home resource-flow #1517/#1516, cited not re-pinned): reads and writes both carry the explicit tier (unified)
    expect(payReads()).toEqual([
      [CASTER, 'spell_slots_level_2', CAMPAIGN],
      [CASTER, 'spell_slots_level_3', CAMPAIGN],
    ]);
    expect(r1.slotConsumed).toBe(true);
    expect(r1.freeCastUsed).toBe(false);
    expect(r1.modifiedSpell.level).toBe(2);
    expect(r1.modifiedSpell.baseLevel).toBe(1);
    expect(r2.slotConsumed).toBe(true);
    expect(r2.freeCastUsed).toBe(false);
    expect(r2.modifiedSpell.level).toBe(3);
    expect(r2.modifiedSpell.baseLevel).toBe(2);
    expect(r1.metaCtx).toStrictEqual({ oldConcentrationSpell: null, shouldSetConcentration: false, slotConsumed: true, freeCastUsed: false });
    expect(r2.metaCtx).toStrictEqual({ oldConcentrationSpell: null, shouldSetConcentration: false, slotConsumed: true, freeCastUsed: false });
  });

  it('banked-0 paid upcast: refuse writes NOTHING (#1522 DENY form) and never claws back the UNLIMITED free entitlement', async () => {
    const stats = makeStats();
    const store = liveRuntime({ spell_slots_level_2: 0 });

    const auth = gate('Thunderwave', 2);
    expect(auth).toBe(false);
    const r = await prepareSpellCast({ ...diskThunderwave }, {}, {
      playerName: CASTER, playerStats: stats, campaignName: CAMPAIGN,
      isUpcast: true, upcastLevel: 2, freeCastAuthorized: auth,
    });

    expect(r.slotConsumed).toBe(false);
    expect(r.freeCastUsed).toBe(false);
    expect(setRuntimeValue).toHaveBeenCalledTimes(0); // :723 <=0 deny — never writes -1
    expect(store.spell_slots_level_2).toBe(0);
    expect(r.metaCtx).toStrictEqual({ oldConcentrationSpell: null, shouldSetConcentration: false, slotConsumed: false, freeCastUsed: false }); // SP-005 carries the refusal truth

    // mastery-specific survival: a refused PAID upcast taxes nothing in the FREE lane —
    // unlike a Signature once-per-rest spend, there was never anything to burn (#1522).
    expect(gate('Thunderwave', 1)).toBe(true);
    const r2 = await prepareSpellCast({ ...diskThunderwave }, {}, {
      playerName: CASTER, playerStats: stats, campaignName: CAMPAIGN,
      isUpcast: false, freeCastAuthorized: gate('Thunderwave', 1),
    });
    expect(r2.freeCastUsed).toBe(true);
    expect(r2.slotConsumed).toBe(false);
    expect(setRuntimeValue).toHaveBeenCalledTimes(0); // still exact-of-0 across deny + free
    expect(store.spell_slots_level_1).toBe(4);
  });
});
