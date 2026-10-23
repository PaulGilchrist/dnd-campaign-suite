// @maintained-by-ai
// ---------------------------------------------------------------------------
// spellPreparationService.uncovered.typeFiltering.test.js — the type-filter
// SKIP FACE of the free-cast family. Routed VERBATIM by #1526
// (uncovered.isFreeCastAuthorized.test.js): 'type-filter skip-face lives in
// the dedicated uncovered.typeFiltering sibling (read ITS old suite per
// #1525) — I re-minted only the complementary FOUR-ADMIT + case-trail
// predication there, NOT its skips'. #1526's L6 rows are the ADMIT face
// (:96 admits exactly the four FREE_CAST_ENTRY_TYPES; its bad-loop rows are
// single-entry default-denies, specialActions only, un-planted stores).
// THIS lane pins the SKIP complement: types NOT in FREE_CAST_ENTRY_TYPES
// (:9/:12) or the passive scan lists (:225 via :296/:304) are skipped
// PRE-LOOP — loop CONTINUES (a skip is not a deny), trailing admitted rows
// still decide, and every skipped row's derived keys stay dark even when its
// counters are PLANTED LIVE. The zero-read ledger IS the discriminator
// (#1526 form): admit-mutants at :96/:12/:225 flip verdict bytes or read
// planted keys that the real gate never mints.
//
// SWEEP EXECUTED (#1526 owed-sweep): legacy bare short-form campaign args ->
// 'test-campaign' (grep-proves zero bare camp args below); legacy fabricated
// feature-name fixtures retired -> non-impersonating 'Struct *' synthetic
// names (#1492/#1526/#1527 three-lane streak) + REAL disk-type bytes as skip
// fodder ('misty_escape', disk-live 1 row, adjacent-by-bytes to admitted
// 'misty_wanderer'); cast spells are REAL spell-rows at disk levels (Fireball
// lv3 / Darkness lv2 in both rulesets — census form #1526, re-thrown at load
// here); metamagicRules mock retired -> REAL (#1523/#1525/#1527 canned-
// hollowing-ban x3 precedent); clearRuntimeState dead-mock residue dropped
// (this unit imports only get/setRuntimeValue). Old-suite triplet of
// 'skips non-free_spell types in {actions|bonusActions|specialActions} loop'
// = dead twins quantified: byte-identical except the container name
// — consolidated into per-container rows of ONE test each face.
//
// THREE-WAY TYPE TAXONOMY Venn (#1519/#1524 canonical forms, readFileSync
// drift-throw; censuses CITED — #1525: '18 rows total; usable uses_expression
// (text AND usesMax): EXACTLY 1'; #1526: 'all four FREE_CAST_ENTRY_TYPES
// disk-live' — only skip-table MEMBERSHIP is re-derived at load here):
//   ADMITTED (:96 scan set, extracted from service bytes, never retyped
//   #1362): free_spell / fey_reinforcements / misty_wanderer /
//   dragon_companion — all disk-live (load throw); admit-face rows live in
//   #1526 T7, never regrown here.
//   CODE-LITERAL, other oracle channels: 'phantasmal_creatures' /
//   'shadow_arts' (passives-list filters :225 via :296/:304 — extracted at
//   load); NO_CONCENTRATION_CHOICE_TYPES (:29, consume-graph -> cla138/
//   #1527), 'wild_companion' resourceCost (:471 consume -> #1527/
//   wildCompanion), 'psychic_spells'/'spell_breaker' (:880-:881 stamp lane
//   -> #1527) — CITED, not this lane's invocation graph.
//   DISK-PRESENT / scan-unadmitted: ~189 distinct disk types outside the
//   four admits skip :96 BY DESIGN — free-cast-adjacent ones
//   (spell_mastery, signature_spells, natural_recovery, bewitching_magic,
//   ritual_spells) are owned via runtime-KEY channels (gates #1/#3, oracle
//   #1513-pinned), the rest are attack/rider/passive pipelines outside the
//   free-cast oracle. No unowned free-cast channel found — the reported
//   ⚠ set is EMPTY; :110/:114/:116 arms for known-shape rows on skipped
//   types are code-armed-disk-absent-per-type = defensive, quantified by
//   the planted-store zero-read ledger below.
//
// QUIRK SCANS: golden guard-row #1518 console-untouched (no console spies);
// vacuous-self-compute hunt: filter arms OBSERVABLY differ — admitted rows
// proceed WITH reads (deciding read tuple pinned), skipped rows DENY/C
// ontINUE with ZERO derived reads (per-arm dark-key census: :98/:110/:114/
// :116 keys + passive :136/:138 keys all never minted); :0-swallow: N/A on
// this lane (counters never reached), the empty-entries fail:[] edge is
// #1526's last test — cited not regrown; silent-undefined ?.: absent counters
// would coalesce to usesMax IF reached — they are NOT reached (ledger);
// REAL-null store-faithful #1517 pinned on the passive channel (null and
// live both dark); 'null + N': none on this read lane — home-cited to the
// increment sibling (:58/:36 favored-enemy accumulate, #1512); case trails =
// THIS home lane: three near-miss casings ('Free_Spell', 'MISTY_WANDERER',
// 'fey_reinforcement') skipped pre-loop in MIXED lists + admitted EXACT
// byte still decides after them — CONTRAST oracle #13, the lone case-
// INsensitive channel (Aura of Vitality :208 toLowerCase, oracle-pinned;
// dark here: no cast spells 'aura of vitality'); invocationCallOrder: gate
// #1's two latch probes are ALWAYS the first reads — before any entry scan
// (pre-loop-check-before-first-read); arity vs REAL (#1517 home
// resource-flow): deciding counter reads are 2-arg default tier (:70/:117),
// every campaign-tier read carries CAMPAIGN as arg[2] (quantified census in
// the cast helper); dead twins retired (old suite x3 -> consolidated);
// purity: stats JSON-snapshot asserted EVERY cast; NO-CLOCK: filter-pure
// lane — reads/compares only, zero setRuntimeValue, zero addEntry, no timers.
//
// KILL MATRIX (declared analytic, #1491 form — never git-checkout mutants):
//   :96/:12 drop entirely ............... T1/T2/T3 (skipped rows reach
//     :110/:114/:116 with PLANTED live counters -> verdict flips and the
//     planted keys appear in the ledger — both bytes die)
//   :12 case-insensitive mutant ......... T1 ('Free_Spell','fey_reinforcement'
//     planted grants fire first, deciding-read tuple flips), T2
//     ('MISTY_WANDERER' planted 5 -> TRUE vs real FALSE)
//   :12 admit-all mutant ................ T2/T3 (planted live rows deny-byte
//     FALSE flips TRUE)
//   :225 case-insensitive find mutant ... T4 ('Shadow_Arts' planted counter
//     and REAL-null both flip FALSE->TRUE; ledger mints
//     '_Shadow_Arts_Darkness_freeCastCount')
//   :225 drop passive filters ........... T4 (same ledger bytes via gates
//     #6/#7)
//   :306/:311/:316 container drop ....... T1/T2/T3 (each container's trailing
//     admit TRUE byte dies if its scan is dropped)
//   :128 truthy-vs-!=='undefined' ....... #1526 T2/T3 — cited, not regrown
//   :98/:110/:114/:116 arm internals .... #1526 L1-L5 — cited, not regrown
//
// MOCK CENSUS — exact-of-5 boundary mocks of the 7 imports of
// spellPreparationService.js (:1-:7), direct-path-first (#1475/#1476/#1505):
// useRuntimeState (mem-backed + __mem handle), combatData,
// concentrationService, storage, logService (known-dead family-wide x5 —
// never invoked on the oracle call graph; zero-log census EVERY row). REAL 2:
// metamagicRules + castingTimeUtils (pure collaborators — canned-hollowing
// ban, REAL x3 precedent; the unit-under-test is NEVER mocked). No barrel
// imports -> no barrel-key residue. Dead-module-mock hunt: clearRuntimeState
// retired (legacy residue — never imported by this unit).
// SECURITY NOTE (#1446 kiro-injection precedent): disk JSON and service
// source were scanned while deriving fixtures; nothing injection-shaped
// encountered; disk/source strings feed JSON.parse and a membership regex
// only, never eval. Campaign lockdown: 'test-campaign' is the only campaign
// string in this file.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CAMPAIGN = 'test-campaign';
const CASTER = 'TestWizard';

// ── Chokepoint extraction (#1362): the skip-table is READ from the service
// bytes at load, never retyped here — drift-throw if the source shape moves. ──
const SERVICE_SRC = readFileSync(resolve(process.cwd(), 'src/services/rules/spells/spellPreparationService.js'), 'utf8');
const freeCastConst = SERVICE_SRC.match(/const FREE_CAST_ENTRY_TYPES = \[([^\]]+)\]/);
if (!freeCastConst) throw new Error('drift: FREE_CAST_ENTRY_TYPES literal moved in the service — re-read :9 before editing this lane');
const FREE_CAST_ENTRY_TYPES = freeCastConst[1].split(',').map(s => s.trim().replace(/['"]/g, ''));
const passiveTypes = [...SERVICE_SRC.matchAll(/findAutomationPassive\(playerStats, '([^']+)'\)/g)].map(m => m[1]);
if (FREE_CAST_ENTRY_TYPES.length !== 4 || passiveTypes.length < 2) {
  throw new Error(`drift: skip-table membership changed (admits=${FREE_CAST_ENTRY_TYPES.length}, passive-literals=${passiveTypes.length}) — re-census before editing`);
}

// ── Disk rows: REAL bytes, drift-throw at load (#1509-#1527 streak) ──
const classes2024 = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/2024/classes.json'), 'utf8'));
const classes5e = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/classes.json'), 'utf8'));
const feats2024 = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/2024/feats.json'), 'utf8'));
const spells5e = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/spells.json'), 'utf8'));
const spells2024 = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/2024/spells.json'), 'utf8'));

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
// code->disk: every admitted type is disk-live (membership set only — the
// full counts are #1525/:18 and #1526's, cited above, never re-pinned).
for (const t of FREE_CAST_ENTRY_TYPES) {
  if (!diskTypes.has(t)) throw new Error(`disk drift: admitted type '${t}' has no disk row — skip-table census stale`);
}
// disk->code: 'misty_escape' is this lane's disk-live skip fodder — a REAL
// un-admitted byte adjacent-by-bytes to admitted 'misty_wanderer'. If disk
// ever retires it, the census must be re-read, not silently re-fabricated.
if (!diskTypes.has('misty_escape')) throw new Error("disk drift: skip-fodder type 'misty_escape' vanished from disk — re-census");
// Spell-existence census (fabrication ban): every cast spell is disk-REAL at
// its cast level (the two-both-rulesets form #1526 :185-:189 already owns).
for (const [name, level] of [['Fireball', 3], ['Darkness', 2]]) {
  if (spells5e.find(s => s.name === name)?.level !== level || spells2024.find(s => s.name === name)?.level !== level) {
    throw new Error(`disk drift: spell census '${name}' lv${level} changed — re-read spells.json rows`);
  }
}

// ── Mock census: exact-of-5 boundary mocks (metamagicRules REAL — #1523/
// #1525/#1527 canned-hollowing ban precedent; unit-under-test never mocked) ──
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
import { addEntry } from '../../../services/ui/logService.js';

beforeEach(() => {
  vi.clearAllMocks(); // mock-clear only — the filter oracle itself is REAL and never mocked
  mem.clear();
  addEntry.mockReturnValue(Promise.resolve({}));
});

// The oracle is READ-ONLY: every row runs the zero-write / zero-log / purity
// census (#1526 cast-helper form) and returns the verdict byte + this cast's
// read ledger. Campaign-lockdown census: every read with >2 args carries
// CAMPAIGN as arg[2] (#1517 arity vs REAL).
function cast(listName, entries, spellName, spellLevel, extraAutomation = {}) {
  const stats = {
    name: CASTER,
    class: { name: 'Wizard' },
    automation: { actions: [], bonusActions: [], specialActions: [], passives: [], [listName]: entries, ...extraAutomation },
  };
  const frozen = JSON.parse(JSON.stringify(stats));
  const readsBefore = getRuntimeValue.mock.calls.length;
  const verdict = isFreeCastAuthorized(CASTER, spellName, spellLevel, stats, CAMPAIGN);
  expect(verdict instanceof Promise).toBe(false); // #1510 arity canon — bare boolean, never a Promise
  expect(setRuntimeValue).not.toHaveBeenCalled();
  expect(addEntry).not.toHaveBeenCalled();
  expect(stats).toEqual(frozen);
  const reads = getRuntimeValue.mock.calls.slice(readsBefore);
  expect(reads.every(r => r[2] === CAMPAIGN)).toBe(true); // #1520 forward-lock: EVERY read carries the explicit tier
  return { verdict, reads, keys: reads.map(r => r[1]) };
}

describe('isFreeCastAuthorized — type-filter SKIP face: un-admitted types skip PRE-loop, the scan CONTINUES, skipped keys stay dark', () => {
  // A skip is NOT a deny (:96 returns undefined -> :126 keeps scanning): the
  // three near-miss casings #1526 denied single-entry are here planted LIVE
  // in every arm shape (:98/:110/:114/:116) INSIDE mixed lists across all
  // three loop containers — if :96 admitted them they would GRANT first. The
  // real code mints none of their keys; the trailing exact-case admit row
  // decides. Admit-faces and halt-vs-continue gate mechanics: #1526 L1-L6,
  // cited, never regrown.
  const skipsFor = () => [
    // unknown type, live generic :114 recharge shape
    { type: 'other_type', name: 'Struct Skip Recharge', spell: 'Fireball', uses: 1, recharge: true },
    // near-miss casing 1 ('Free_Spell'), live :110 per-spell-tracker shape
    { type: 'Free_Spell', name: 'Struct Skip Tracker', spell: 'Fireball', perSpellTracking: true, usesMax: 1, uses: 1, recharge: true },
    // near-miss casing 3 ('fey_reinforcement'), live :116 shared-array shape
    { type: 'fey_reinforcement', name: 'Struct Skip Shared', spell: ['Fireball'] },
  ];
  const skipKeys = [
    '_Struct_Skip_Recharge_freeCastCount', // :114 via :70 counter key
    '_Struct_Skip_Recharge_freeCast', // :116 shared-array key
    '_Struct_Skip_Tracker_Fireball_freeCastCount', // :110 via :78 per-spell key
    '_Struct_Skip_Tracker_freeCastCount', // :114 counter for the tracker row
    '_Struct_Skip_Shared_freeCast', // :116 shared-array key (planted BELOW)
  ];
  beforeEach(() => {
    // plant EVERY skipped row's counter LIVE — the deny bytes and the
    // zero-read ledger together are the discriminator: any :96 admit/case
    // mutant reads these keys and flips the deciding read (or verdict).
    mem.set('_Struct_Skip_Recharge_freeCastCount', 3);
    mem.set('_Struct_Skip_Tracker_Fireball_freeCastCount', 1);
    mem.set('_Struct_Skip_Shared_freeCast', ['Fireball']); // :118 .includes() would grant
  });

  for (const container of ['actions', 'bonusActions', 'specialActions']) {
    it(`${container} loop: skips 'other_type'/'Free_Spell'/'fey_reinforcement' rows with PLANTED live counters (zero derived reads) and the trailing exact-case 'free_spell' admit still grants`, () => {
      const trailing = { type: 'free_spell', name: 'Struct Admit', spell: 'Fireball', uses: 1, recharge: true };
      const { verdict, reads, keys } = cast(container, [...skipsFor(), trailing], 'Fireball', 3);
      expect(verdict, container).toBe(true); // skip != deny: the scan reached the admit
      for (const k of skipKeys) expect(keys, `${container}:${k}`).not.toContain(k); // per-arm zero-read ledger: :98/:110/:114/:116 never entered for skipped rows
      expect(keys.filter(k => k.includes('Struct_Skip')), container).toEqual([]); // ledger-wide census: ZERO derived reads for skipped rows
      expect(reads[reads.length - 1], container).toEqual([CASTER, '_Struct_Admit_freeCastCount', CAMPAIGN]); // deciding read is the ADMIT's campaign-tier counter (:114 via :89/:70 — unified)
      // invocationCallOrder: gate #1's two latch probes precede every scan read
      expect(reads.slice(0, 2), container).toEqual([
        [CASTER, 'naturalRecoveryFreeCast', CAMPAIGN],
        [CASTER, '_Bewitching_Magic_freeCast', CAMPAIGN],
      ]);
    });
  }

  it("pure skip deny: lone near-miss casing 'MISTY_WANDERER' with its counter PLANTED LIVE (5) DEFAULTS FALSE and the counter stays dark — :12 is case-EXACT; CONTRAST oracle #13 (Aura of Vitality :208 toLowerCase, oracle-pinned, dark here)", () => {
    // #1526 denied this casing with an UN-planted store (fallback-driven
    // byte). Here the store is PLANTED LIVE (5): the mutant admits, reads 5,
    // and flips FALSE->TRUE; the real gate never reads it and denies.
    mem.set('_Struct_Wanderer_Near-Miss_freeCastCount', 5);
    const { verdict, keys } = cast('bonusActions', [{ type: 'MISTY_WANDERER', name: 'Struct Wanderer Near-Miss', spell: 'Fireball', uses: 1, recharge: true }], 'Fireball', 3);
    expect(verdict).toBe(false);
    expect(keys).not.toContain('_Struct_Wanderer_Near-Miss_freeCastCount'); // planted 5 never consulted — skipped BEFORE :70
    expect(mem.get('_Struct_Wanderer_Near-Miss_freeCastCount')).toBe(5); // the live store survives the scan untouched
  });

  it("disk-live UN-admitted type 'misty_escape' (REAL census byte, disk->code gap reported in header) with a live recharge counter skips the specialActions scan and denies — disk-adjacent-by-bytes to admitted 'misty_wanderer' yet :96-owned elsewhere", () => {
    mem.set('_Struct_Disk_Skip_freeCastCount', 2); // key as :70 WOULD mint it if :96 admitted the row
    const { verdict, keys } = cast('specialActions', [{ type: 'misty_escape', name: 'Struct Disk Skip', spell: 'Fireball', uses: 1, recharge: true }], 'Fireball', 3);
    expect(verdict).toBe(false); // disk-present / scan-unadmitted: skip is by design
    expect(keys).not.toContain('_Struct_Disk_Skip_freeCastCount'); // planted 2 dark — skipped before :114
    expect(mem.get('_Struct_Disk_Skip_freeCastCount')).toBe(2); // untouched by the scan
  });

  it('passive-channel skip (:225 via gates #6/#7): near-miss-cased passives with LIVE and REAL-null counters mint ZERO per-spell keys and fall through to the action lane — skip leaves a byte-identical ledger (mirror cast)', () => {
    // 'Shadow_Arts'/'PHANTASMAL_CREATURES' cross the passive literals (#304/
    // :296, extracted at load) at case only; '_Shadow_Arts_Darkness_freeCast
    // Count' is the :138 key a MATCHED passive would read (admit face:
    // shadowArts.test.js, cited never regrown).
    const nearMiss = { type: 'Shadow_Arts', name: 'Struct Passive Near-Miss', freeCastSpells: ['Darkness'], usesMax: 1 };
    const phNear = { type: 'PHANTASMAL_CREATURES', name: 'Struct Phantasmal Near-Miss', freeCastSpells: ['Darkness'], usesMax: 1 };
    const admit = { type: 'free_spell', name: 'Struct Admit', spell: 'Darkness', uses: 1, recharge: true };
    mem.set('_Shadow_Arts_Darkness_freeCastCount', 1); // live numeric — a case-insensitive/matched find() mutant grants TRUE off this byte
    const mirror = cast('actions', [admit], 'Darkness', 2); // bare passives:[] baseline
    const { verdict, keys } = cast('actions', [admit], 'Darkness', 2, { passives: [nearMiss, phNear] });
    expect(verdict).toBe(true); // skipped passives fall through; the action-lane admit grants (skip != deny)
    expect(keys).toEqual(mirror.keys); // ZERO ledger trace of the near-miss passives
    expect(keys).not.toContain('_Shadow_Arts_Darkness_freeCastCount'); // :138 never minted (find returned undefined -> :137 guard)
    mem.set('_Shadow_Arts_Darkness_freeCastCount', null); // REAL-null store-faithful #1517: an ADMITTED passive would coalesce usesMax->GRANT
    const nullStore = cast('actions', [admit], 'Darkness', 2, { passives: [nearMiss, phNear] });
    expect(nullStore.verdict).toBe(true);
    expect(nullStore.keys).toEqual(mirror.keys); // verdict and ledger identical whether the store is live or REAL-null
  });
});
