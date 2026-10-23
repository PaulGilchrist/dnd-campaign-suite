// @maintained-by-ai
// ---------------------------------------------------------------------------
// spellPreparationService.uncovered.isFreeCastAuthorized.test.js — LOOP-MECHANICS
// lane of the free-cast family. Routed VERBATIM by the oracle sibling
// isFreeCastAuthorized.test.js gate #8 (:33-:36): 'uses_expression lanes +
// bonus/special lane scan owned by spellPreparationService.uncovered.
// isFreeCastAuthorized.test.js' and by the MASTER ownership table (base
// .test.js header :45-:46): '... decrement internals, uses_expression/perSpell/
// type-filter loop arms -> uncovered.*' — the AUTH side of those loop arms is
// THIS lane; consume/decrement internals live in uncovered.prepareSpellCast and
// the RESTORE side in uncovered.incrementFreeCastResource (#1525 dedup map,
// incrementFreeCastResource.test.js:55-64). The oracle owns the FREE_CAST_CHECKS
// gate DECISIONS (#1-#15 truth table, gate #8 actions-lane explicit-false HALT
// via Shadow Touched disk, crash-twin, default deny, arity). THIS lane owns the
// LOOP MACHINERY the oracle folded out:
//   L1 uses_expression gate mechanics (:98-:105): the uses_expression&&usesMax
//      conjunction, level-arm (:100-:103) vs spell-name-arm (:104),
//      parseFeatureSpellLevel spell[0]-only law, usesMax-absent FALSE arm (the
//      six disk rows of that shape — census in uncovered.incrementFreeCast
//      Resource, cited): gate dark, only :116 can grant.
//   L2 halt-vs-continue bytes: a spent parsed-level counter CONTINUES
//      (:102 undefined, NOT decisive false); perSpellTracking decides and
//      HALTS (:110-:111 direct return); :110 runs BEFORE :114 so the feature
//      counter is never consulted (branch-precedence law, service :107-:109).
//   L3 entry-order law: first non-undefined decision breaks the lane scan
//      (:126-:128); reversing [deny, allow] to [allow, deny] flips the verdict
//      byte AND the read ledger. Gate #10/#12 explicit FALSE HALTS the WHOLE
//      oracle scan — gates #11-#14 stay dark.
//   L4 FREE_CAST_CHECKS interleave order: gate #9 WGB fires BEFORE the #10
//      bonusActions scan; gate #11 Majesty BEFORE the #12 specialActions scan
//      (service :306-:316). Gate decisions themselves are the oracle's —
//      cited, never re-pinned.
//   L5 shared-array lane (:116-:118): the last-resort `_<Name>_freeCast`
//      array fallback, owned here per the oracle's 5e census note
//      ('shared-array fallback owned by uncovered sibling'); consumption is
//      wildCompanion's face.
//   L6 type-filter predication (:96): exactly the four FREE_CAST_ENTRY_TYPES
//      enter checkFreeCastEntry; unknown and case-flipped types skip PRE-loop
//      (zero derived-key reads). Disk-vs-code census both directions at load.
//
// SWEEP EXECUTED (legacy debt, #1525 owed-sweep): all 24 legacy 'camp'
// campaign args -> 'test-campaign' (provable via 3-arg campaign-tier tuples
// below; the 2-arg default tier at :70/:117 is the oracle's folded read-form
// contract, cited not changed); fabricated feature names ('Level Feature',
// 'Bonus Level Feature', 'Free Feature', 'Shared Feature', ...) replaced by
// REAL disk rows (Magic Initiate 'Level 1 Spell', Warlock 'Contact Patron',
// Cleric "War God's Blessing", Bard 'Mantle of Majesty') or non-impersonating
// 'Struct *' synthetic names (#1492 structural-probe form); fabricated spell
// 'SomeSpell' retired — every cast spell is a REAL spells.json row at its
// disk level (load census). Legacy `await` on the SYNC oracle swept (#1510
// arity canon: bare boolean, never a Promise — re-pinned once at the loop face).
//
// FIXTURES (disk is law #1365; fabrication-ban): disk-import with load-time
// drift-throw (#1509-#1525 streak). The featureLevel!==null arm is DEFENSIVE
// — no disk row carries spell /level \d+/ (census owned by
// uncovered.incrementFreeCastResource :22-:27, cited) — so level-arm rows use
// the cla229-form documented derivation ONLY (rules.cla229-usesMax.test.js:34
// 'exactly the shape buildAttackInfo froze'; same two derived bytes as the
// increment sibling: spell:''->'level 1', usesMax absent->2; plus Contact
// Patron usesMax absent->1 = cla229 re-resolve of expression '1'). Fey's
// oracle-side auth is cla138's (#1511) — no Summon Fey outcome re-pinned here;
// gate mechanics ride STRUCTURAL/disk-derived rows only.
//
// QUIRK SCANS (quantified):
//   halt-vs-continue twins: T2 pins the classic vacuous-mutant split — a
//   mutant returning false at :102 (spent parsed-level) dies on the
//   trailing-allow CONTINUE byte; a mutant collapsing :110's direct return
//   dies on the precedence ledger (feature counter read dark). Reversed
//   arrays flip TRUE<->FALSE on the same bytes (T3).
//   :0-swallow: stored 0 -> Number(0)>0 false -> CONTINUE (distinct from the
//   perSpell DECISIVE false) — T2; corrupt 'two' -> NaN>0 false -> CONTINUE —
//   T2; stored '' quantified benign by the oracle (:99-:103), cited.
//   silent-undefined ?.: featureFreeCastCount :70 `?? usesMax` — absent AND
//   REAL null both mint fresh (T1, store-faithful #1517); && short-circuit:
//   off-list spell never reads the counter (T4-name).
//   case trails: the type gate :96 is case-EXACT — 'Free_Spell' /
//   'MISTY_WANDERER' / 'fey_reinforcement' skip the loop entirely (T7).
//   Contrast #1513: the lone case-INSENSITIVE gate is Aura of Vitality #13
//   (oracle-pinned); none on this lane's face.
//   crash-twin: the anonymous-entry TypeError is the ORACLE's golden row
//   (#1513/:1518 verbatim form, isFreeCastAuthorized.test.js:486-:493) —
//   cited here, never regrown.
//   'null + N' arithmetic: none on this read lane — home-cited to the
//   increment sibling (:58/:36, favored-enemy accumulate).
//   invocationCallOrder: every deciding row pins read-before-verdict — the
//   deciding counter is the LAST read, downstream keys absent.
//   arity vs REAL: feature/shared counter reads carry the explicit campaign
//   tier (:70/:117, owner unify call), per-spell tracking reads 3-arg campaign
//   tier (:79) — one pin per shape; campaign lockdown rides those tuples.
//   empty-edge: zero-entry scans and absent-automation keys fall through
//   `|| []` guards (:306/:311/:316) to default deny with ZERO free-cast
//   reads (fail:[] idiom, #1508 parallel).
//   purity: input playerStats JSON-snapshot-checked on EVERY cast (helper).
//   NO-CLOCK: loop-pure lane — reads/compares only; the oracle writes and
//   logs nothing (zero-write/zero-log census on every row); no timers.
//
// KILL MATRIX (declared analytic, #1491 form — never git-checkout mutants):
//   :98 drop '&& usesMax' ............. T4-verbatim (counter key dark census)
//   :102 'undefined'->'false' ......... T2 (trailing-allow TRUE byte)
//   :100 flip featureLevel!==null ..... T1 (name-arm miss -> FALSE byte)
//   :104 name arm removed ............. T4-name (fresh allow byte)
//   :110 move after :114 .............. T2-halt (counter-2 would grant;
//     precedence ledger + FALSE verdict both kill)
//   :126 truthy vs '!=="undefined"' ... T2-halt/T3 (explicit-false would
//     continue into trailing shared allow -> flips the deny byte)
//   :327 outer truthy ................. T2-halt/T3 (a DECISIVE false lane scan
//     would keep scanning to the trailing allow -> flips the deny byte)
//   :118 drop Array.isArray ........... T6 (string .includes() would grant
//     over the non-array deny byte)
//   :96 drop entirely ................. T7 (unknown type reaches :114 and
//     grants; the other_type deny + no-read bytes kill)
//   :96 case-flip mutant .............. T7 ('Free_Spell' admit flips FALSE)
//   anonymous-entry name guard added .. oracle crash golden row, cited.
//
// MOCK CENSUS — exact-of-5 boundary mocks of the 7 imports of
// spellPreparationService.js (:1-:7), direct-path-first (#1475/#1476):
// useRuntimeState (mem-backed, real-module keys + __mem handle —
// clearRuntimeState key DROPPED: dead-mock residue hunt, this unit imports
// only get/set), combatData, concentrationService, storage, logService
// (known-dead family-wide — never invoked on the oracle call graph;
// addEntry-dark census on every row). REAL 2: metamagicRules +
// castingTimeUtils — pure collaborators, never-mock-the-unit; canned-hollowing
// ban #1491/#1523 metamagicRules-REAL x2 precedent. The unit-under-test is
// NEVER mocked. No barrel imports, so no barrel-key residue.
// SECURITY NOTE (#1446 kiro-injection precedent): disk JSON and comments were
// scanned while deriving fixtures; nothing injection-shaped encountered; no
// disk string is executed beyond JSON.parse. Campaign lockdown: the only
// campaign string in this file is 'test-campaign'.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CAMPAIGN = 'test-campaign';
const CASTER = 'TestWizard';

// ── Disk rows: REAL bytes, drift-throw at load (#1509-#1525 canonical form) ──
const classes2024 = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/2024/classes.json'), 'utf8'));
const classes5e = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/classes.json'), 'utf8'));
const feats2024 = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/2024/feats.json'), 'utf8'));
const spells2024 = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/2024/spells.json'), 'utf8'));
const spells5e = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/spells.json'), 'utf8'));

function diskFeature(list, pred, label) {
  let found = null;
  const walk = (o) => {
    if (found || !o || typeof o !== 'object') return;
    if (Array.isArray(o)) { o.forEach(walk); return; }
    const autos = Array.isArray(o.automation) ? o.automation : [o.automation].filter(Boolean);
    if (pred(o, autos)) { found = o; return; }
    Object.values(o).forEach(walk);
  };
  list.forEach(walk);
  if (!found) throw new Error(`disk drift: ${label} absent — re-read disk before editing this lane`);
  return found;
}

// Magic Initiate (feats.json): the cla229 baked-row source. Verbatim disk bytes
// {type:'free_spell', spell:'', uses:1, uses_expression:'1', recharge:'long_rest'}.
const magicInitiate = diskFeature(feats2024,
  (o, autos) => o.name === 'Level 1 Spell' && autos.some(a => a.type === 'free_spell' && a.spell === '' && a.uses === 1 && a.uses_expression === '1' && a.recharge === 'long_rest'),
  "Magic Initiate 'Level 1 Spell' uses_expression disk row");

// Warlock lv9 'Contact Patron' (2024): uses_expression WITHOUT usesMax — one of
// the SIX disk rows of that shape (census owned by uncovered.incrementFreeCast
// Resource :18-:20, cited): the :98 gate must run its FALSE arm.
const contactPatron = diskFeature(classes2024,
  (o, autos) => o.name === 'Contact Patron' && autos.some(a => a.type === 'free_spell' && a.spell === 'Contact Other Plane' && a.uses_expression === '1' && a.usesMax === undefined),
  'Warlock Contact Patron uses_expression-no-usesMax disk row');

// Cleric War God's Blessing (2024): REAL free_spell row, ARRAY spells, NO uses —
// the shared-array lane's disk fixture (:114 inert at uses==null, oracle :427
// cited for the deny half; latch decision at #9 owned by the oracle).
const wgb = diskFeature(classes2024,
  (o, autos) => autos.some(a => a.type === 'free_spell' && JSON.stringify(a.spell) === '["Shield of Faith","Spiritual Weapon"]'),
  'War Gods Blessing array-spell free_spell disk row');

// Bard 'Mantle of Majesty': the real buff-name byte for the gate #11 interleave.
const mantle = diskFeature(classes2024,
  (o) => o.name === 'Mantle of Majesty',
  'Mantle of Majesty disk feature');

// Spell-existence census (both rulesets; fabrication ban): every cast spell is REAL.
for (const [name, level] of [['Magic Missile', 1], ['Fireball', 3], ['Spiritual Weapon', 2], ['Command', 1], ['Contact Other Plane', 5]]) {
  if (spells5e.find(s => s.name === name)?.level !== level || spells2024.find(s => s.name === name)?.level !== level) {
    throw new Error(`disk drift: spell census '${name}' lv${level} changed — re-read spells.json rows`);
  }
}

// Type-filter census, BOTH directions (#1519/#1525 form): code->disk — every
// FREE_CAST_ENTRY_TYPES literal has a live disk row (the :96 predicate admits
// live types only); disk->code — every scanned automation.type is enumerated,
// so no undiscovered free-cast type can sneak past the predicate unseen.
const FREE_CAST_ENTRY_TYPES = ['free_spell', 'fey_reinforcements', 'misty_wanderer', 'dragon_companion'];
const diskTypes = new Set();
for (const list of [classes2024, classes5e, feats2024]) {
  const walk = (o) => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) { o.forEach(walk); return; }
    const autos = Array.isArray(o.automation) ? o.automation : [o.automation].filter(Boolean);
    for (const a of autos) if (typeof a.type === 'string') diskTypes.add(a.type);
    Object.values(o).forEach(walk);
  };
  walk(list);
}
for (const t of FREE_CAST_ENTRY_TYPES) {
  if (!diskTypes.has(t)) throw new Error(`disk drift: FREE_CAST_ENTRY_TYPES '${t}' has no disk row — type-predicate census stale`);
}

// ── Mock census: exact-of-5 boundary mocks of the 7 imports (metamagicRules +
// castingTimeUtils REAL — pure collaborators, #1491/#1523 precedent) ──
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => {
  const mem = new Map();
  const setRuntimeValue = vi.fn((_name, key, value) => { mem.set(key, value); });
  const getRuntimeValue = vi.fn((_name, key) => (mem.has(key) ? mem.get(key) : undefined));
  return { setRuntimeValue, getRuntimeValue, __mem: mem };
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

import { isFreeCastAuthorized } from './spellPreparationService.js';
import { getRuntimeValue, setRuntimeValue, __mem as mem } from '../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../../services/encounters/combatData.js';
import { addEntry } from '../../../services/ui/logService.js';

// Sheet-flattener contract: automation cloned from disk with its REAL parent
// name stamped (oracle :258-:266 form). Documented cla229-derived bytes are
// applied ONLY via `derive`, enumerated in the header — never invented here.
function diskEntry(feature, derive = {}) {
  const autos = Array.isArray(feature.automation) ? feature.automation : [feature.automation];
  const auto = autos.find(a => a.type === 'free_spell') || autos[0];
  return { ...JSON.parse(JSON.stringify(auto)), name: feature.name, ...derive };
}

function statsWith(listName, entries) {
  return {
    name: CASTER,
    class: { name: 'Wizard' },
    automation: { actions: [], bonusActions: [], specialActions: [], passives: [], [listName]: entries },
  };
}

// The oracle is READ-ONLY: every verdict row runs the zero-write / zero-log /
// purity census and returns the verdict byte + this cast's read ledger slice.
function cast(listName, entries, spellName, spellLevel) {
  const stats = statsWith(listName, entries);
  const frozen = JSON.parse(JSON.stringify(stats));
  const readsBefore = getRuntimeValue.mock.calls.length;
  const verdict = isFreeCastAuthorized(CASTER, spellName, spellLevel, stats, CAMPAIGN);
  expect(verdict instanceof Promise).toBe(false); // #1510 arity canon vs legacy awaits
  expect(setRuntimeValue).not.toHaveBeenCalled();
  expect(addEntry).not.toHaveBeenCalled();
  expect(stats).toEqual(frozen);
  return { verdict, reads: getRuntimeValue.mock.calls.slice(readsBefore), keys: getRuntimeValue.mock.calls.slice(readsBefore).map(r => r[1]) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mem.clear();
  getCombatSummary.mockReturnValue(null);
  addEntry.mockReturnValue(Promise.resolve({}));
});

describe('L1 uses_expression LEVEL arm — match allows at fresh/null counter; spent/NaN/mismatch CONTINUE (bonusActions lane)', () => {
  // cla229-form derived row (documented bytes ONLY, cited rules.cla229-usesMax.
  // test.js:34 + the increment sibling's same-derivation precedent): Magic
  // Initiate verbatim + spell:''->'level 1' (defensive parse shape) + usesMax
  // absent->2 (post-evaluate freeze shape). The arm is DEFENSIVE — no disk row
  // carries /level \d+/ — pinned structurally, re-pinning no feature outcome.
  const miLevelRow = () => diskEntry(magicInitiate, { spell: 'level 1', usesMax: 2 });
  const tailRecharge = () => ({ type: 'free_spell', name: 'Struct Tail Recharge', spell: ['Magic Missile', 'Fireball'], uses: 1, recharge: true });

  it('level-match at fresh/null counter allows, counter is the LAST read; absent and REAL-null coalesce identically via ?? usesMax (#1517 store-faithful)', () => {
    const { verdict, reads } = cast('bonusActions', [miLevelRow()], 'Magic Missile', 1);
    expect(verdict).toBe(true);
    expect(reads[reads.length - 1]).toEqual([CASTER, '_Level_1_Spell_freeCastCount', CAMPAIGN]); // explicit campaign-tier deciding read (:70 via :101, unified)
    mem.set('_Level_1_Spell_freeCastCount', null);
    expect(cast('bonusActions', [miLevelRow()], 'Magic Missile', 1).verdict).toBe(true); // null ?? 2 -> fresh ALLOW, same arm as absent
  });

  it('spent 0, corrupt NaN and level-mismatch return undefined (NOT decisive false): trailing entries still decide; without them, default deny', () => {
    mem.set('_Level_1_Spell_freeCastCount', 0);
    const { verdict, reads } = cast('bonusActions', [miLevelRow(), tailRecharge()], 'Magic Missile', 1);
    expect(verdict).toBe(true); // :102 undefined -> scan moved ON — a false here would deny a live trailing grant
    expect(reads[reads.length - 1]).toEqual([CASTER, '_Struct_Tail_Recharge_freeCastCount', CAMPAIGN]); // trailing recharge is the deciding LAST read
    mem.set('_Level_1_Spell_freeCastCount', 'two');
    expect(cast('bonusActions', [miLevelRow(), tailRecharge()], 'Magic Missile', 1).verdict).toBe(true); // Number('two')=NaN, NaN>0 false -> CONTINUE
    mem.set('_Level_1_Spell_freeCastCount', 2);
    expect(cast('bonusActions', [miLevelRow(), tailRecharge()], 'Fireball', 3).verdict).toBe(true); // parsed 1 !== 3 -> continue; trailing array-spell grants
    expect(cast('bonusActions', [miLevelRow()], 'Fireball', 3).verdict).toBe(false); // level-arm miss then :114 blocked by uses_expression (:88) -> deny
  });

  it('parseFeatureSpellLevel reads spell[0] ONLY: array level row decides at lv1 and CONTINUES at lv3', () => {
    const arrayRow = diskEntry(magicInitiate, { spell: ['level 1'], usesMax: 2 });
    expect(cast('specialActions', [arrayRow], 'Magic Missile', 1).verdict).toBe(true);
    expect(cast('specialActions', [arrayRow], 'Fireball', 3).verdict).toBe(false);
  });
});

describe('L2/L3 explicit-FALSE HALT, branch precedence and entry-order law (bonus/special lanes)', () => {
  // perSpellTracking runs BEFORE the recharge branch (:110-:111 direct return;
  // service :107-:109 'checked BEFORE the generic uses/recharge branch so a
  // multi-spell entry can never share one feature-keyed counter'): observable
  // only because the live feature counter never gets read.
  const tracker = (spellList) => ({ type: 'free_spell', name: 'Struct Lane Tracker', spell: spellList, perSpellTracking: true, uses: 2, recharge: 'long_rest' });
  const sharedAllow = () => ({ type: 'free_spell', name: 'Struct Lane Shared', spell: ['Fireball'] });

  it('spent tracker DENIES-halts the WHOLE scan at gate #10/#12: feature counter dark (:110 precedes :114), trailing entry and gates #11-#14 never consulted', () => {
    mem.set('_Struct_Lane_Tracker_Fireball_freeCastCount', 0);
    const { verdict, reads, keys } = cast('bonusActions', [tracker(['Fireball']), sharedAllow()], 'Fireball', 3);
    expect(verdict).toBe(false); // DECISIVE false from checkFreeCastEntry (:111) halts the scan (:327)
    expect(reads[reads.length - 1]).toEqual([CASTER, '_Struct_Lane_Tracker_Fireball_freeCastCount', CAMPAIGN]); // 3-arg campaign tier IS the deciding read (:79)
    expect(keys).not.toContain('_Struct_Lane_Tracker_freeCastCount'); // recharge arm :114 never consulted despite live uses:2
    expect(keys).not.toContain('_Struct_Lane_Shared_freeCast'); // loop broke at :128 BEFORE the trailing entry
    expect(getCombatSummary).not.toHaveBeenCalled(); // gates #13/#14 dark below a #10 halt
    const specialMirror = cast('specialActions', [tracker(['Fireball']), sharedAllow()], 'Fireball', 3);
    expect(specialMirror.verdict).toBe(false); // gate #12 mirror — same halt law
    expect(getCombatSummary).not.toHaveBeenCalled();
  });

  it('entry-order law: the SAME two entries reversed flip the verdict byte — first decision breaks the loop', () => {
    mem.set('_Struct_Lane_Shared_freeCast', ['Fireball']);
    mem.set('_Struct_Lane_Tracker_Fireball_freeCastCount', 0);
    const allowFirst = cast('specialActions', [sharedAllow(), tracker(['Fireball'])], 'Fireball', 3);
    expect(allowFirst.verdict).toBe(true);
    expect(allowFirst.keys).not.toContain('_Struct_Lane_Tracker_Fireball_freeCastCount'); // spent tracker never reached after the allow-halt
    const denyFirst = cast('specialActions', [tracker(['Fireball']), sharedAllow()], 'Fireball', 3);
    expect(denyFirst.verdict).toBe(false);
    expect(denyFirst.keys).not.toContain('_Struct_Lane_Shared_freeCast'); // live shared grant orphaned by the earlier halt
  });

  it('tracker off-list spell falls through :77 BEFORE any counter read; scan moves on and the next entry still grants', () => {
    const tail = () => ({ type: 'free_spell', name: 'Struct Tail Recharge', spell: ['Magic Missile'], uses: 1, recharge: true });
    const { verdict, keys } = cast('bonusActions', [tracker(['Fireball']), tail()], 'Magic Missile', 1);
    expect(verdict).toBe(true); // :110 decision undefined -> :128 keeps scanning -> tail grants
    expect(keys).not.toContain('_Struct_Lane_Tracker_Magic_Missile_freeCastCount'); // name gate :77 precedes any counter mint
    expect(keys).toContain('_Struct_Tail_Recharge_freeCastCount');
  });
});

describe('L4 FREE_CAST_CHECKS interleave — gate #9 WGB runs BEFORE the #10 scan, #11 Majesty BEFORE #12', () => {
  const spentTracker = (spell) => ({ type: 'free_spell', name: 'Struct Lane Tracker', spell: [spell], perSpellTracking: true, uses: 1, recharge: 'long_rest' });

  it('armed WGB (#9) allows Spiritual Weapon above a SPENT #10 tracker; disarmed, that tracker HALTS the scan FALSE with gates #11-#14 dark', () => {
    mem.set('_Struct_Lane_Tracker_Spiritual_Weapon_freeCastCount', 0);
    mem.set('_War_Gods_Blessing_active', true);
    const armed = cast('bonusActions', [spentTracker('Spiritual Weapon')], 'Spiritual Weapon', 2);
    expect(armed.verdict).toBe(true); // interleave ORDER law only — the #9 latch decision is oracle-owned (:417, cited)
    expect(armed.reads[armed.reads.length - 1]).toEqual([CASTER, '_War_Gods_Blessing_active', CAMPAIGN]); // deciding LAST read is #9's campaign-tier latch probe (unified)
    expect(armed.keys).not.toContain('_Struct_Lane_Tracker_Spiritual_Weapon_freeCastCount'); // #10 never ran

    mem.delete('_War_Gods_Blessing_active');
    const disarmed = cast('bonusActions', [spentTracker('Spiritual Weapon')], 'Spiritual Weapon', 2);
    expect(disarmed.verdict).toBe(false);
    expect(disarmed.reads[disarmed.reads.length - 1]).toEqual([CASTER, '_Struct_Lane_Tracker_Spiritual_Weapon_freeCastCount', CAMPAIGN]); // campaign lockdown tuple
    expect(getCombatSummary).not.toHaveBeenCalled(); // #11-#14 dark below a #10 halt
  });

  it('Mantle of Majesty (#11) allows Command before the spent specialActions tracker (#12) can deny', () => {
    mem.set('activeBuffs', [{ name: mantle.name }]); // disk byte, case-exact
    mem.set('_Struct_Lane_Tracker_Command_freeCastCount', 0);
    const { verdict, keys } = cast('specialActions', [spentTracker('Command')], 'Command', 1);
    expect(verdict).toBe(true); // #11 fires BEFORE #12 — decision cited to oracle :430, order pinned here
    expect(keys).not.toContain('_Struct_Lane_Tracker_Command_freeCastCount');
  });
});

describe('L1 uses_expression NAME arm vs the usesMax-absent FALSE arm (specialActions lane, disk rows)', () => {
  it('cla229-derived usesMax makes the NAME arm decide: fresh allows, spent CONTINUES :104->:116 into the shared array; off-list name short-circuits the counter read', () => {
    const derived = diskEntry(contactPatron, { usesMax: 1 }); // documented byte: cla229 re-resolve of expression '1'
    const fresh = cast('specialActions', [derived], 'Contact Other Plane', 5);
    expect(fresh.verdict).toBe(true); // featureLevel null -> name arm :104, absent ?? 1 ALLOW
    expect(fresh.reads[fresh.reads.length - 1]).toEqual([CASTER, '_Contact_Patron_freeCastCount', CAMPAIGN]);

    mem.set('_Contact_Patron_freeCastCount', 0);
    const spent = cast('specialActions', [derived], 'Contact Other Plane', 5);
    expect(spent.verdict).toBe(false); // spent name-arm -> :110/:114 inert -> :116 absent -> continue -> default deny
    expect(spent.keys).toContain('_Contact_Patron_freeCastCount'); // name match DID consult the counter (:104)

    mem.set('_Contact_Patron_freeCast', ['Contact Other Plane']);
    expect(cast('specialActions', [derived], 'Contact Other Plane', 5).verdict).toBe(true); // spent counter CONTINUES into the shared-array lane (L5)
    const offList = cast('specialActions', [derived], 'Fireball', 3);
    expect(offList.verdict).toBe(false);
    expect(offList.keys).not.toContain('_Contact_Patron_freeCastCount'); // && short-circuit: name miss -> counter never read
  });

  it('disk-verbatim usesMax-absent row: gate :98 runs its FALSE arm — the feature-counter key is NEVER read on any cast; only :116 can grant', () => {
    const verbatim = diskEntry(contactPatron); // uses_expression:'1', usesMax ABSENT, uses ABSENT, recharge:'long_rest'
    const deny = cast('specialActions', [verbatim], 'Contact Other Plane', 5);
    expect(deny.verdict).toBe(false);
    expect(deny.keys).not.toContain('_Contact_Patron_freeCastCount'); // :98 conjunction false -> :101/:104 counters dark
    expect(deny.keys).toContain('_Contact_Patron_freeCast'); // fell through to the :116 shared probe (absent -> undefined)
    mem.set('_Contact_Patron_freeCast', ['Contact Other Plane']);
    expect(cast('specialActions', [verbatim], 'Contact Other Plane', 5).verdict).toBe(true); // shared array is the ONLY live channel for this shape
  });
});

describe('L5/L6 shared-array lane bytes, type-filter predication and empty-list edges', () => {
  const wgbKey = `_${wgb.name.replace(/\s+/g, '_')}_freeCast`; // real-name key builder (:116 pattern)

  it('shared array grants on exact spell bytes; REAL-null, non-array and off-name stores all fall through to default deny', () => {
    mem.set(wgbKey, ['Spiritual Weapon']);
    const allow = cast('bonusActions', [diskEntry(wgb)], 'Spiritual Weapon', 2);
    expect(allow.verdict).toBe(true);
    expect(allow.reads[allow.reads.length - 1]).toEqual([CASTER, wgbKey, CAMPAIGN]); // :116-:118 campaign-tier probe is the deciding read (unified)
    mem.set(wgbKey, null); // REAL production null — LR re-arm byte (#1517 store-faithful)
    expect(cast('bonusActions', [diskEntry(wgb)], 'Spiritual Weapon', 2).verdict).toBe(false); // `stored &&` falsy-guard arm
    mem.set(wgbKey, 'Spiritual Weapon'); // non-array truthy
    expect(cast('bonusActions', [diskEntry(wgb)], 'Spiritual Weapon', 2).verdict).toBe(false); // Array.isArray guard :118 quantified
    mem.set(wgbKey, ['Shield of Faith']); // array, off-name — :118 includes() is exact-name
    expect(cast('bonusActions', [diskEntry(wgb)], 'Command', 1).verdict).toBe(false);
  });

  it('type predicate admits EXACTLY the four FREE_CAST_ENTRY_TYPES (all disk-live per load census); unknown and case-flipped types skip PRE-loop with zero derived reads', () => {
    for (const t of FREE_CAST_ENTRY_TYPES) {
      const { verdict, reads } = cast('specialActions', [{ type: t, name: `Struct ${t} Lane`, spell: 'Magic Missile', uses: 1, recharge: 'long_rest' }], 'Magic Missile', 1);
      expect(verdict, t).toBe(true); // TYPE-predicate admission pinned via the generic :114 grant — feature faces live in cla130/cla138/wildCompanion
      expect(reads[reads.length - 1]).toEqual([CASTER, `_Struct_${t}_Lane_freeCastCount`, CAMPAIGN]);
    }
    for (const bad of ['other_type', 'Free_Spell', 'MISTY_WANDERER', 'fey_reinforcement']) {
      const { verdict, keys } = cast('specialActions', [{ type: bad, name: `Struct ${bad} Lane`, spell: 'Magic Missile', uses: 1, recharge: 'long_rest' }], 'Magic Missile', 1);
      expect(verdict, bad).toBe(false);
      expect(keys, bad).not.toContain(`_Struct_${bad}_Lane_freeCastCount`); // :96 skips the entry before any read — the counter key is never minted
    }
  });

  it('empty-array and absent-automation keys scan zero entries and deny without throwing (fail:[] edge; `|| []` guards :306/:311/:316)', () => {
    const { keys } = cast('bonusActions', [], 'Fireball', 3);
    expect(keys.filter(k => /freeCastCount$/.test(k)).length).toBe(0); // zero FEATURE-counter reads on zero entries (gate #1 latch keys excluded by design)
    expect(isFreeCastAuthorized(CASTER, 'Fireball', 3, { name: CASTER, class: { name: 'Wizard' }, automation: {} }, CAMPAIGN)).toBe(false); // automation keys absent entirely
    expect(isFreeCastAuthorized(CASTER, 'Fireball', 3, { name: CASTER }, CAMPAIGN)).toBe(false); // automation absent — optional-chain guards hold
    expect(setRuntimeValue).not.toHaveBeenCalled(); // edge rows stay store-dark end-to-end
  });
});
