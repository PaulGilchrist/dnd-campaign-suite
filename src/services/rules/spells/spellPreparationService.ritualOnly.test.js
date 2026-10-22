// @maintained-by-ai
// CLA-234 regression — spellPreparationService._ritualOnly CONSUME lane (2024 Barbarian,
// Path of the Wild Heart: Nature Speaker / Animal Speaker unlimited slotless rituals).
//
// Reported-bug identity (git 493a84d34, VERBATIM):
//   "fix(CLA-234): Nature Speaker ritual cast — Commune with Nature consumed a slot and
//    used Intelligence; added ritual-only free-cast path with Wisdom override"
// Pre-fix defect: the stamped rows fell to the :851 base-payment ladder — slot charged,
// panel Intelligence used. First-hit form per #1515.
//
// LIVE BOUNDARY — ritual-family split (cited VERBATIM from sibling headers, disk 2026-10-21):
//   #1518 ritualAdept.test.js table:19-20
//     'ritualOnly sibling  | CLA-234 Nature/Animal Speaker unlimited slotless |'
//     '                        spell._ritualOnly                                 (.ritualOnly.test.js)'
//   #1518 ritualAdept.test.js:89
//     '(_ritualOnly branch :745 mutant -> ritualOnly sibling kills, scoped out here)'
//   #1518 ritualAdept MINE: CLA-299 auto+tick ritualCast/ritualCastUsed
//     (:292/:754/:758/:844-850/:253 — never touched here)
//   #1516 quickRitual.test.js:13-14
//     'ritualOnly sibling (.ritualOnly.test.js)         CLA-234 _ritualOnly Nature/Animal'
//     'Speaker unlimited slotless rituals — folded there, not here.'
//   #1516 FT-068 quickRitual/_Ritual_Master_quickRitualUsed + counter ledger theirs
//     (:836-839/:729-739 — never produced here, absence pinned by T3 total census)
//   #1513 oracle isFreeCastAuthorized.test.js:16-17
//     '#2  _ritualOnly/_telekineticMasterFreeCast spell-entry stamp -> true; false->CONTINUE'
//     '[ritualOnly sibling owns _ritualOnly bytes; #2 TK face owned here — cited by'
//   #1517 resource-flow.test.js:427-428 = payment arity pin-home (reads arity-2 /
//     writes arity-4) and the unstamped payment-ladder home — cited, ladder NOT regrown;
//     this file pins only the ONE stamp-distinguishability payment row (T4).
//
// CHANNEL CONTRACT (producer -> consume -> payment-skip):
//   PRODUCER: stampWildHeartRituals (spellCalc2024.js:429-449) stamps the three granted
//   rows casting_time:'Ritual' + _ritualOnly:true + _ritualFeature:<feature> +
//   spellCastingAbility:<major.spell_casting_ability> BEFORE the slot-level filter
//   (keepSpellRow :741-745 exempts _ritualOnly rows with no slot at their level).
//   Producer output owned by spellCalc2024-wildheart-rituals.test.js; popup UI face owned
//   by SpellDetailPopup.ritualCast.test.jsx (caller: SpellDetailPopup.jsx:7 imports
//   isFreeCastAuthorized and passes its truth into prepareSpellCast as freeCastAuthorized).
//   CONSUME (this lane): FREE_CAST_CHECKS #2 :277-280 — stamp true -> authorized (scan
//   stops); stamp false/absent -> undefined CONTINUE, scan continues (tri-state semantics
//   #1513), default-false -> normal payment home #1517. Payment seam consumeSpellResource
//   :840 free-branch runs BEFORE the :851 base-slot ladder -> consumeFreeCast :741:
//   decrementFreeCastResource :539 has NO _ritualOnly counter arm (unlimited) + the
//   :745-753 ritual ability_use log.
//
// UNLIMITED RAW -> LEDGER SILENCE (#1518 census form): the feature text carries no
// once-per-day limit ("but only as Rituals" — no uses word, disk-pinned below), so a
// stamped cast must be TOTAL-write-silent: across two stamped casts (T3) setRuntimeValue
// callCount === 0 — no spell_slots_*, no *_freeCastCount, no ritualCastUsed (#1518),
// no _Ritual_Master_quickRitualUsed (#1516), no naturalRecovery flags — and the ledger is
// NEVER READ at ^spell_slots_level_ (the payment ladder is not consulted, not merely
// declined). Counters exist only in the other lanes, cited above.
//
// Disk evidence (imported JSON, drift-throw — fixture bytes ARE these bytes;
// fabrication-ban fifty-one, existence-census-first):
//   2024/classes.json Barbarian subclass 'Path of the Wild Heart', spell_casting_ability
//   'Wisdom'; feature rows VERBATIM: Nature Speaker lv10 "You can cast the Commune with
//   Nature spell but only as a Ritual. Wisdom is your spellcasting ability for it." /
//   Animal Speaker lv3 "You can cast the Beast Sense and Speak with Animals spells but
//   only as Rituals. Wisdom is your spellcasting ability for them."
//   2024/spells.json: Commune with Nature lv5 ct '1 minute or Ritual' ritual:true
//   conc:false; Beast Sense lv2 ct 'Action or Ritual' ritual:true conc:true; Speak with
//   Animals lv1 ct 'Action or Ritual' ritual:true conc:false — the #1518 casting_time
//   divergence catch: 2024 disk keeps the '... or Ritual' suffix; ONLY the producer stamp
//   rewrites casting_time to bare 'Ritual'. Control rows: Animal Friendship lv1 'Action'
//   ritual:false conc:false; Healing Word lv1 'Bonus Action' ritual:false conc:false.
//   Case trail (documented, never trodden): the 5e spells.json row is 'Commune With
//   Nature' (capital W, ct '1 minute') — the stamp producer is spellCalc2024-only, so
//   this lane runs 2024 bytes; 5e rows are never fabricated here.
//
// Mock-completeness (exact-of-N #1440): the service imports 7 modules; EXACTLY 6 mocked
// — all stateful/IO: useRuntimeState, combatData, concentrationService, storage
// (namespace, concentration-break path only), metamagicRules, logService. REAL (1/7):
// shared/castingTimeUtils.normalizeCastingTime — pure, Spell Breaker lane only, never a
// clock/DOM here. Direct-path mocks, no barrel residue (#1475/76/#1505); the unit under
// test is never mocked; the producer runs REAL disk, no canned hollow mocks (#1491).
//
// Quirk scan verdicts:
//   unguarded-deref golden row: T2 — removing the ?. at :278 surfaces the TypeError
//     (#1360/#1513 twin); console.error spy stays untouched (#1518 form).
//   vacuous ternary :749 `spell._ritualFeature || 'Ritual Casting'`: fallback arm
//     unreachable from the producer (all three disk rows carry _ritualFeature); testing
//     it would require fabricating a stamped-row-without-feature — banned; the live arm
//     is pinned by abilityName strict-equal in T3. Dead-twin quantified: 0 real rows
//     reach the fallback.
//   :0-swallow quantified: cantrip-ritual census — none of the five rows used here is
//     level 0 (all pinned lv1+ on disk); CLA-234 grants no level-0 ritual. Nothing to
//     pin, nothing silently skipped.
//   silent-undefined ?. quantified: the single CONTINUE at :279 is rule-bounded by
//     oracle #1513; here stamped-vs-unstamped observables are pinned (T1 vs T4).
//   'null + N': not applicable — this lane owns ZERO counters; ledger silence is the
//     assertion instead (T3).
//   dead twins both directions: disk grants exactly 3 ritual-only rows (classes.json
//     major.spells census below) and the producer stamp map has exactly 3 entries
//     (spellCalc2024.js:435-439) — 1:1, no orphan arms; :745 true arm pinned by disk
//     rows, :745 false arm -> :754/:758 ritualAdept, scoped OUT per #1518 :89.
//   case trails: 0 in-lane (2024 bytes only; the 5e capital-W trail is documented above).
//   chokepoint inline-dup (#1357/58): every _ritualOnly fixture byte is authored once,
//     in stampedRow() below (SERVICE_NOTE idiom, #1518).
//   invocationCallOrder (#1513/#1517): T3 pins the two ritual logs in cast order
//     [Nature Speaker, Animal Speaker] — consume stamps per-cast at :745, never retro.
//   arity census: #1517 pin-home resource-flow.test.js:427-428 — cited (twice-quoted
//   #1517/:1518), NOT duplicated.
//   purity: every consume row deep-compares its spell + stats inputs after the call.
//
// FALSIES (#1352) disposition: stamp true pinned (T1/T3); false and absent are
// observably IDENTICAL by design here (both CONTINUE per #1513, both pay normally —
// T4 pins both faces in one row); non-boolean truthy cannot originate from the
// producer (literal `= true` at spellCalc2024:443).
//
// KILL MATRIX (declared analytic #1515/:1517/:1518 form; no live cp-backup mutants ran):
//   delete FREE_CAST_CHECKS #2 :277-280        -> T1 stamped-true asserts fail
//   flip stamp truth at :279 (stamped<->unst)  -> T1 both directions fail; T4 free instead of paid
//   reorder :840 free-branch after :851 ladder -> T3 slot-read/write silence fails, slotConsumed true
//   add any once-per-day counter at :741-763   -> T3 setRuntimeValue total-silence fails
//   flip/remove :745 if                          -> T3 ritual logs vanish AND T5 stamps them onto a non-ritual free cast
//   drop :749 _ritualFeature read              -> T3 abilityName strict-equal fails ('Ritual Casting')
//   edit :751 note literal                     -> T3 note strict-equal fails
//   drop ?. at :278                             -> T2 TypeError fails, console spy trips
//
// Campaign lockdown: 'test-campaign' everywhere ('camp' catch class ×2 recent — none here).
// Old file: 8 tests -> 5. Removed folds: repeat-authorize row (T1 is pure + write-silent),
// Speak-with-Animals-false assert (fixture-absence artifact, not a lane deny — the disk row
// IS stamped and T1 now proves it true), split zero-slot/has-slot consume rows (T3 runs the
// strictly stronger has-slot-available store face; zero-slot needs no lookup — ladder never
// consulted), non-ritual authorize-negative row folded into T1's deny side.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cloneDeep } from 'lodash';
import spells2024 from '../../../../public/data/2024/spells.json';
import classes2024 from '../../../../public/data/2024/classes.json';

// ---------------------------------------------------------------------------
// Static mocks — exact-of-6 IO imports of spellPreparationService (header census)
// ---------------------------------------------------------------------------

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => {
  const setRuntimeValue = vi.fn();
  const getRuntimeValue = vi.fn(() => undefined);
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
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('./metamagicRules.js', () => ({
  isPsionicSpell: vi.fn(() => false),
  hasPsionicSorcery: vi.fn(() => false),
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { isFreeCastAuthorized, prepareSpellCast } from './spellPreparationService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../services/ui/logService.js';

// ---------------------------------------------------------------------------
// Disk loaders — drift-throw, fabrication-ban. Fixture rows ARE disk rows.
// ---------------------------------------------------------------------------

const CAMPAIGN = 'test-campaign';
const CASTER = 'DraconicDragon'; // ledger identity shared with SpellDetailPopup.ritualCast.test.jsx

function diskSpell(name, { level, castingTime, ritual, concentration }) {
  const row = spells2024.find(s => s.name === name);
  if (!row) throw new Error(`disk drift: '${name}' absent from public/data/2024/spells.json`);
  if (row.level !== level || row.casting_time !== castingTime || row.ritual !== ritual || row.concentration !== concentration) {
    throw new Error(`disk drift on '${name}': ${JSON.stringify({ level: row.level, casting_time: row.casting_time, ritual: row.ritual, concentration: row.concentration })}`);
  }
  return row;
}

const COMMUNE = diskSpell('Commune with Nature', { level: 5, castingTime: '1 minute or Ritual', ritual: true, concentration: false });
const BEAST_SENSE = diskSpell('Beast Sense', { level: 2, castingTime: 'Action or Ritual', ritual: true, concentration: true });
const SPEAK_ANIMALS = diskSpell('Speak with Animals', { level: 1, castingTime: 'Action or Ritual', ritual: true, concentration: false });
const ANIMAL_FRIENDSHIP = diskSpell('Animal Friendship', { level: 1, castingTime: 'Action', ritual: false, concentration: false });
const HEALING_WORD = diskSpell('Healing Word', { level: 1, castingTime: 'Bonus Action', ritual: false, concentration: false });

function findSubclass(node) {
  if (Array.isArray(node)) return node.map(findSubclass).find(Boolean) || null;
  if (node && typeof node === 'object') {
    if (node.name === 'Path of the Wild Heart' && Array.isArray(node.features)) return node;
    return Object.values(node).map(findSubclass).find(Boolean) || null;
  }
  return null;
}

const WILD_HEART = findSubclass(classes2024);
if (!WILD_HEART) throw new Error('disk drift: Path of the Wild Heart absent from public/data/2024/classes.json');
if (WILD_HEART.spell_casting_ability !== 'Wisdom') throw new Error(`disk drift: major spell_casting_ability ${JSON.stringify(WILD_HEART.spell_casting_ability)}`);
const wildHeartFeature = name => WILD_HEART.features.find(f => f.name === name);
const NATURE_SPEAKER = wildHeartFeature('Nature Speaker');
const ANIMAL_SPEAKER = wildHeartFeature('Animal Speaker');
if (!NATURE_SPEAKER || NATURE_SPEAKER.level !== 10 || NATURE_SPEAKER.description !== 'You can cast the Commune with Nature spell but only as a Ritual. Wisdom is your spellcasting ability for it.') {
  throw new Error('disk drift on Nature Speaker row');
}
if (!ANIMAL_SPEAKER || ANIMAL_SPEAKER.level !== 3 || ANIMAL_SPEAKER.description !== 'You can cast the Beast Sense and Speak with Animals spells but only as Rituals. Wisdom is your spellcasting ability for them.') {
  throw new Error('disk drift on Animal Speaker row');
}
// major.spells census: exactly the 3 granted rows, matching the producer stamp map.
if (JSON.stringify(WILD_HEART.spells) !== JSON.stringify([{ name: 'Speak with Animals', level: 1 }, { name: 'Beast Sense', level: 2 }, { name: 'Commune with Nature', level: 10 }])) {
  throw new Error('disk drift on major.spells census');
}

// SERVICE_NOTE (chokepoint, #1518 idiom): the ONLY authoring site of stamped fixture
// bytes in this file; mirrors stampWildHeartRituals output (spellCalc2024.js:429-449,
// producer-pinned by spellCalc2024-wildheart-rituals.test.js).
const RITUAL_FEATURE_BY_SPELL = {
  'Commune with Nature': 'Nature Speaker',
  'Beast Sense': 'Animal Speaker',
  'Speak with Animals': 'Animal Speaker',
};
function stampedRow(base) {
  return { ...base, casting_time: 'Ritual', _ritualOnly: true, _ritualFeature: RITUAL_FEATURE_BY_SPELL[base.name], spellCastingAbility: WILD_HEART.spell_casting_ability };
}

// lv13 Barbarian; panel spellCastingAbility 'Intelligence' reproduces the reported-bug
// caster (git 493a84d34 "used Intelligence") — stamped rows carry Wisdom per disk, and
// the free-cast lane never reads the panel. No spell_slots_* keys in stats: the 2024
// Wild Heart slotless face; the RUNTIME LEDGER (mocked store) owns availability below.
function makeWildHeartStats({ stamped = true } = {}) {
  return {
    name: CASTER,
    level: 13,
    class: { name: 'Barbarian' },
    spellAbilities: {
      spellCastingAbility: 'Intelligence',
      spells: [stamped ? stampedRow(COMMUNE) : { ...COMMUNE },
        stamped ? stampedRow(BEAST_SENSE) : { ...BEAST_SENSE },
        stamped ? stampedRow(SPEAK_ANIMALS) : { ...SPEAK_ANIMALS },
        { ...ANIMAL_FRIENDSHIP }],
    },
    automation: { actions: [], bonusActions: [], specialActions: [], passives: [] },
  };
}

const runtimeLedger = available => (...args) => (args[1] === available ? 1 : undefined);
const slotReads = () => getRuntimeValue.mock.calls.filter(([, key]) => /^spell_slots_level_/.test(String(key)));
const slotWrites = () => setRuntimeValue.mock.calls.filter(([, key]) => /^spell_slots_level_/.test(String(key)));
const abilityUseLogs = () => addEntry.mock.calls.map(c => c[1]).filter(e => e && e.type === 'ability_use');

describe('spellPreparationService — CLA-234 _ritualOnly consume lane (Nature/Animal Speaker unlimited slotless)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockImplementation(() => undefined);
  });

  describe('isFreeCastAuthorized — check #2 :277-280 (stamp opens the slotless gate)', () => {
    it('authorizes all three stamped rows on a zero-slot caster and denies the unstamped one — read-only, write-silent', () => {
      const stats = makeWildHeartStats();
      expect(isFreeCastAuthorized(CASTER, 'Commune with Nature', 5, stats, CAMPAIGN)).toBe(true);
      expect(isFreeCastAuthorized(CASTER, 'Beast Sense', 2, stats, CAMPAIGN)).toBe(true);
      expect(isFreeCastAuthorized(CASTER, 'Speak with Animals', 1, stats, CAMPAIGN)).toBe(true);
      expect(isFreeCastAuthorized(CASTER, 'Animal Friendship', 1, stats, CAMPAIGN)).toBe(false);
      // authorization is PURE — repeat is identical (unlimited has nothing to exhaust)
      expect(isFreeCastAuthorized(CASTER, 'Commune with Nature', 5, stats, CAMPAIGN)).toBe(true);
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
    });

    it('golden guard row: stats without spellAbilities authorize nothing, throw nothing, log nothing (:278 ?. chain)', () => {
      const spy = vi.spyOn(console, 'error');
      const stats = { name: 'PanellessCaster', automation: {} };
      let decision;
      expect(() => { decision = isFreeCastAuthorized('PanellessCaster', 'Commune with Nature', 5, stats, CAMPAIGN); }).not.toThrow();
      expect(decision).toBe(false);
      expect(spy).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe('prepareSpellCast — consume path (:840 free-branch before the :851 ladder)', () => {
    it('casts TWICE with slots available in the ledger: zero slot reads, ZERO runtime writes total, two exact Speaker logs in cast order — unlimited, slotless', async () => {
      const stats = makeWildHeartStats();
      const commune = stats.spellAbilities.spells[0];
      const beast = stats.spellAbilities.spells[1];
      const before = cloneDeep({ commune, beast, stats });
      // ledger says a lv5 slot IS available — the pre-fix bug ate it (git 493a84d34)
      getRuntimeValue.mockImplementation(runtimeLedger('spell_slots_level_5'));

      expect(isFreeCastAuthorized(CASTER, 'Commune with Nature', 5, stats, CAMPAIGN)).toBe(true);
      const r1 = await prepareSpellCast(commune, {}, { playerName: CASTER, playerStats: stats, campaignName: CAMPAIGN, isUpcast: false, freeCastAuthorized: true });
      expect(isFreeCastAuthorized(CASTER, 'Beast Sense', 2, stats, CAMPAIGN)).toBe(true);
      const r2 = await prepareSpellCast(beast, {}, { playerName: CASTER, playerStats: stats, campaignName: CAMPAIGN, isUpcast: false, freeCastAuthorized: true });

      expect(r1.freeCastUsed).toBe(true);
      expect(r1.slotConsumed).toBe(false);
      expect(r2.freeCastUsed).toBe(true);
      expect(r2.slotConsumed).toBe(false);
      // exact result/metaCtx key-sets — no ritualCastUsed (#1518), no quickRitualUsed (#1516)
      expect(Object.keys(r1.metaCtx).sort()).toStrictEqual(['freeCastUsed', 'oldConcentrationSpell', 'shouldSetConcentration', 'slotConsumed']);
      expect(r1.metaCtx).toStrictEqual({ oldConcentrationSpell: null, shouldSetConcentration: false, freeCastUsed: true, slotConsumed: false });
      // payment ladder NEVER consulted, not merely declined
      expect(slotReads()).toHaveLength(0);
      // UNLIMITED RAW -> TOTAL ledger silence across both casts
      expect(setRuntimeValue).not.toHaveBeenCalled();
      // invocationCallOrder: one ritual log per cast, in cast order, per feature byte
      expect(addEntry.mock.calls).toHaveLength(2);
      expect(addEntry.mock.calls.map(c => c[0])).toStrictEqual([CAMPAIGN, CAMPAIGN]);
      expect(addEntry.mock.calls[0][1]).toStrictEqual({ type: 'ability_use', characterName: CASTER, abilityName: 'Nature Speaker', spellName: 'Commune with Nature', note: 'Cast Commune with Nature as a Ritual — no spell slot consumed.', timestamp: expect.any(Number) });
      expect(addEntry.mock.calls[1][1]).toStrictEqual({ type: 'ability_use', characterName: CASTER, abilityName: 'Animal Speaker', spellName: 'Beast Sense', note: 'Cast Beast Sense as a Ritual — no spell slot consumed.', timestamp: expect.any(Number) });
      // purity: inputs untouched; modifiedSpell is an exact stamped copy (no fabricated keys)
      expect({ commune, beast, stats }).toStrictEqual(before);
      expect(r1.modifiedSpell).toStrictEqual(commune);
    });

    it('unstamped faces (absent AND false, #1352 collapses identically) fall through to the normal lv5 payment — one write tuple each, no ritual log (ladder home #1517, cited not regrown)', async () => {
      const stats = makeWildHeartStats({ stamped: false });
      const unstamped = { ...COMMUNE };
      const falseStamp = { ...COMMUNE, _ritualOnly: false };
      const before = cloneDeep({ unstamped, falseStamp, stats });
      getRuntimeValue.mockImplementation(runtimeLedger('spell_slots_level_5'));

      expect(isFreeCastAuthorized(CASTER, 'Commune with Nature', 5, stats, CAMPAIGN)).toBe(false);
      const r1 = await prepareSpellCast(unstamped, {}, { playerName: CASTER, playerStats: stats, campaignName: CAMPAIGN, isUpcast: false, freeCastAuthorized: false });
      const r2 = await prepareSpellCast(falseStamp, {}, { playerName: CASTER, playerStats: stats, campaignName: CAMPAIGN, isUpcast: false, freeCastAuthorized: false });

      expect({ paid1: r1.slotConsumed, free1: r1.freeCastUsed, paid2: r2.slotConsumed, free2: r2.freeCastUsed }).toStrictEqual({ paid1: true, free1: false, paid2: true, free2: false });
      expect(slotWrites()).toStrictEqual([[CASTER, 'spell_slots_level_5', 0, CAMPAIGN], [CASTER, 'spell_slots_level_5', 0, CAMPAIGN]]);
      expect(abilityUseLogs()).toHaveLength(0);
      expect({ unstamped, falseStamp, stats }).toStrictEqual(before);
    });

    it('a non-ritual FREE cast (granted via check #1 naturalRecovery, not the stamp) consumes its own counter and never trips the :745 ritual arm — mutually distinguishable from the stamped cast (T3)', async () => {
      const stats = makeWildHeartStats();
      const spell = { ...HEALING_WORD };
      getRuntimeValue.mockImplementation((...args) => (args[1] === 'naturalRecoveryFreeCast' ? ['Healing Word'] : undefined));

      expect(isFreeCastAuthorized(CASTER, 'Healing Word', 1, stats, CAMPAIGN)).toBe(true);
      const r = await prepareSpellCast(spell, {}, { playerName: CASTER, playerStats: stats, campaignName: CAMPAIGN, isUpcast: false, freeCastAuthorized: true });

      expect({ freeCastUsed: r.freeCastUsed, slotConsumed: r.slotConsumed }).toStrictEqual({ freeCastUsed: true, slotConsumed: false });
      // arms of :745 observably differ: THIS lane writes its grant counter (no ledger silence)
      expect(setRuntimeValue.mock.calls).toStrictEqual([[CASTER, 'naturalRecoveryFreeCast', null, CAMPAIGN], [CASTER, 'naturalRecoveryFreeCastUsed', true, CAMPAIGN]]);
      expect(slotWrites()).toHaveLength(0);
      // ...and emits NO Speaker/ritual ability_use row (kills the ':745 always-on' mutant)
      expect(abilityUseLogs()).toHaveLength(0);
      expect(spell).toStrictEqual({ ...HEALING_WORD });
    });
  });
});
