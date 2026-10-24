// @maintained-by-ai
// CLA-308 regression (git 649b48918 "fix(CLA-308): Shadow Arts inert — no castable row"):
// Shadow Arts (2024 Warrior of Shadow lv3 Monk) free-cast authorization, per-spell
// once-per-Long-Rest consumption and rollback in spellPreparationService.
//
// IDENTITY SPLIT — two shadow families, never cross-polluted:
//   OWNED HERE: Shadow Arts MONK SUBCLASS (CLA-308) — automation PASSIVE type
//     'shadow_arts', counter prefix '_Shadow_Arts_<Spell>_freeCastCount', helpers
//     perSpellFreeCastAvailable(:136)/consumePerSpellFreeCastCounter(:346)/
//     restorePerSpellFreeCastCounter(:365), FREE_CAST_CHECKS gate row #7.
//   NOT HERE: Shadow Touched FEAT (FT-070) — free_spell entry with
//     perSpellTracking:true, prefix '_Shadow_Magic_' (shadowTouched sibling),
//     gate row #8 via scanFreeCastEntries. Per-spellTracking consume/restore
//     semantics owned by spellPreparationService.incrementFreeCastResource.test.js
//     (#1512) whose :60 cites this file back: "shadowArts.test.js ->
//     restorePerSpellFreeCastCounter 0->1 + fresh-null" — both rows kept below (T5/T6).
//   Oracle census (spellPreparationService.isFreeCastAuthorized.test.js:28, VERBATIM):
//     "#7  shadow_arts same shape, Shadow_Arts prefix  [shadowArts sibling owns]"
//     — the gate-table scan order is folded-out there; the shadowArts decision rows
//     live here. Also cited-by (by file name, pins hold): automationShadowArts.
//     route.test.js:19-20, spellCalc2024-shadow-arts.test.js:12-13,
//     passWithoutTraceService.test.js:13-14 (pins '_Shadow_Arts_Pass_Without_
//     Trace_freeCastCount' spelling — see spell-name census below).
//
// DISK ROWS (readFileSync drift-throw, #1509-#1519 streak; fixtures are disk bytes):
//   2024 classes.json[5]/majors[1]/features[0] 'Shadow Arts' lv3, .automation =
//     {type:'shadow_arts', casting_time:'passive', freeCastSpells:['Darkness',
//     'Darkvision','Pass Without Trace','Silence'], usesMax:1, recharge:'long_rest',
//     saveAbility:'WIS'} — passive.name stamped by the producer (rules.js shape,
//     same convention as shadowTouched.test.js:264).
//   COUNTED VERDICT (#1519 uses-word census): disk feature text "Each of these
//     spells can be cast in this way once per Long Rest" + usesMax:1 -> COUNTED
//     one-per-spell channel. Latch key bytes '_Shadow_Arts_<Spell>_freeCastCount'
//     (spell name with spaces -> underscores), exact-of-1 per spell. Re-arm to
//     null is restRules-longRest.shadowArts.test.js's seam (no clock here, no
//     rounds — counter only moves at cast/rollback seams).
//   NO-KI VERDICT: this service never touches ki. 5e classes.json[5]/subclasses[1]
//     'Shadow' text is ki-based ("spend 2 ki points to cast darkness, darkvision,
//     pass without trace, or silence" — lowercase names) and carries NO shadow_arts
//     automation row -> the lane is 2024-only; a 5e sheet has no passive and is
//     denied at the guard (T2 row 3). ki bookkeeping lives outside this lane.
//   CASE TRAIL (#1457/#1519 idiom): the freeCastSpells gate is `.includes(spellName)`
//     — case-EXACT against Title-case disk bytes. The 5e lowercase list names
//     ('darkness') are pinned denied in T2.
//
// QUIRK SCAN (report-only):
//   - PER_SPELL_CAST_GRANTS.Shadow_Arts.buildNote (:342) is arity-1 while the
//     consume site passes (spellName, count-1) (:360) — remaining arg silently
//     ignored (1:2 quantified, intentional: usesMax=1 means "spent", never "N
//     remaining" wording; phantasmal twin uses it — its lane owns that note).
//   - getRuntimeValue real store returns NULL (not undefined) for absent keys
//     (useRuntimeState.js:74) — mock canned null here (store-mock faithfulness
//     #1517); fresh-null => usesMax fallback at :141 is the exercised byte.
//   - consume guard `if (count <= 0) return` (:352): a 0-stored counter never
//     underflows to -1 and logs nothing (T4 second row).
//   - The free-cast stamps (_shadowArtsFreeCast, spellCastingAbility 'WIS') are
//     PRODUCED by spellCalc2024.js:456 stampShadowArtsFreeCasts and consumed by
//     SpellDetailPopup.jsx:289 — this lane only carries them through unchanged on
//     modifiedSpell (pinned by full toStrictEqual in T3, no re-derivation).
//   - Arity census home is spellPreparationService.resource-flow.test.js:427-428
//     (#1517-19, cited not duplicated). Call tuples below are asserted complete.
//
// MOCK-COMPLETENESS CENSUS (#1440 exact-of-N): the service imports 7 modules;
// 6 are mocked below (useRuntimeState, combatData, concentrationService, storage,
// logService, metamagicRules); castingTimeUtils.js is left REAL (pure string util,
// no side effects). Direct-path imports only — no barrel residue. Unit under test
// never mocked. No canned hollowing: every mock returns falsy-not-configured so
// foreign lane reads are observable as zero-writes in the censuses.
//
// CAMPAIGN: 'test-campaign' (lockdown-compliant; store + log fully mocked — no network).
//
// KILL MATRIX (analytic — mutants that must die, no runs needed to state):
//   perSpellFreeCastAvailable: drop usesMax fallback :141 -> NaN>0 false -> T1 fresh dies;
//   drop campaignName from read :140 -> read-census tuple arity mismatch -> T1 dies;
//   case-fold the includes gate -> T2 lowercase row flips -> dies;
//   drop gate entirely -> Fireball reads null->1>0 authorize -> T2 row 1 dies;
//   consume write (not count-1) or wrong prefix -> T3 write-census dies;
//   consume guard <=0 removed -> T4 second cast writes -1 + logs -> dies;
//   grants map swapped (Shadow note vs Phantasmal note) -> T3 payload dies;
//   freeCastUsed/metaCtx stamp dropped :842-843 -> T3 result toStrictEqual dies;
//   restore stored!=null guard flipped -> T6 null over-refund write -> dies;
//   restore <usesMax flipped -> T5 no-write census dies;
//   spell slot consulted anywhere in the lane -> T1/T2 auth read-census and
//   T3/T4 write-census (zero 'spell_slots_level_' touches) die.
// Phantasmal_Creatures prefix mutants die in the phantasmal lane, not here.
//
// OLD->NEW MAP (all 10 prior tests folded, none dropped silently):
//   old#1 fresh-all-four + old#2 spent-refuse + old#3 per-spell-independence +
//   old#6 campaign-passthrough -> T1; old#4 non-list-deny + old#5 no-passive-
//   control -> T2; old#7 consume/log/no-slot -> T3; old#8 Silence-independent +
//   (new) underflow guard row -> T4; old#9 restore-0->1 -> T5 (cited row);
//   old#10 fresh-null-no-refund -> T6 (cited row). old#DC-test (172-186) REMOVED:
//   vacuous self-compute — saveDc 18 was asserted against its own fixture literal
//   and modifiedSpell.spellCastingAbility was a spread pass-through; its only real
//   byte (stamp carry) is now pinned by T3's full modifiedSpell toStrictEqual.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('./metamagicRules.js', () => ({
  isPsionicSpell: vi.fn(() => false),
  hasPsionicSorcery: vi.fn(() => false),
}));

import { isFreeCastAuthorized, prepareSpellCast, incrementFreeCastResource } from './spellPreparationService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../services/ui/logService.js';

const CAMPAIGN = 'test-campaign';
const CASTER = 'Disciplined_Monk';

// ---- disk bytes (drift-throw if the rows move) -------------------------------------
const classes2024 = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/2024/classes.json'), 'utf8'));
const spellsDisk = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/spells.json'), 'utf8'));

const shadowFeature = classes2024[5].majors[1].features.find(f => f.name === 'Shadow Arts');
if (!shadowFeature || shadowFeature.automation?.type !== 'shadow_arts') {
  throw new Error('disk drift: 2024 classes.json[5]/majors[1] Shadow Arts shadow_arts automation row absent');
}
if (shadowFeature.level !== 3 || shadowFeature.automation.usesMax !== 1 || shadowFeature.automation.recharge !== 'long_rest' || shadowFeature.automation.saveAbility !== 'WIS') {
  throw new Error('disk drift: Shadow Arts lv/usesMax/recharge/saveAbility bytes changed — re-read classes.json');
}
const SHADOW_ARTS_SPELLS = shadowFeature.automation.freeCastSpells;
if (JSON.stringify(SHADOW_ARTS_SPELLS) !== JSON.stringify(['Darkness', 'Darkvision', 'Pass Without Trace', 'Silence'])) {
  throw new Error(`disk drift: Shadow Arts freeCastSpells census changed: ${JSON.stringify(SHADOW_ARTS_SPELLS)}`);
}
const shadowPassive = { ...shadowFeature.automation, name: shadowFeature.name };

function diskSpell(name) {
  const row = spellsDisk.find(s => s.name === name);
  if (!row) throw new Error(`disk drift: spells.json '${name}' row absent`);
  return row;
}
// spellCalc2024.js:456 producer stamps (carry-only here — T3 pins the pass-through).
function stampedSpell(name) {
  return { ...diskSpell(name), spellCastingAbility: shadowFeature.automation.saveAbility, _shadowArtsFreeCast: true };
}

function makeShadowArtsStats({ withPassive = true } = {}) {
  return {
    name: CASTER,
    rules: '2024',
    level: 17,
    proficiency: 6,
    class: { name: 'Monk', major: { name: 'Warrior of Shadow' } },
    abilities: [{ name: 'Wisdom', bonus: 4 }],
    spellAbilities: {
      spellCastingAbility: 'Wisdom',
      modifier: 4,
      saveDc: 18, // 8 + proficiency 6 + WIS 4 — sheet-side bytes; this lane never computes it.
      spells: SHADOW_ARTS_SPELLS.map(name => ({ ...diskSpell(name), prepared: 'Always', spellCastingAbility: 'WIS', _shadowArtsFreeCast: true })),
    },
    automation: {
      actions: [],
      bonusActions: [],
      specialActions: [],
      passives: withPassive ? [shadowPassive] : [],
    },
  };
}

const shadowReads = () => getRuntimeValue.mock.calls.filter(c => String(c[1]).startsWith('_Shadow_Arts_'));
const slotReads = () => getRuntimeValue.mock.calls.filter(c => String(c[1]).startsWith('spell_slots_level_'));
const slotWrites = () => setRuntimeValue.mock.calls.filter(c => String(c[1]).startsWith('spell_slots_level_'));

// Seed a spent counter; every absent key reads back null, never undefined
// (real store semantics, useRuntimeState.js:74).
function seedRuntime(map) {
  getRuntimeValue.mockImplementation((_characterKey, key) => (key in map ? map[key] : null));
}

beforeEach(() => {
  vi.clearAllMocks();
  getRuntimeValue.mockReturnValue(null);
});

describe('isFreeCastAuthorized — gate #7 shadow_arts per-spell counters', () => {
  it('decision table: fresh null = usesMax for all four grants; a spent 0 refuses its own spell only', () => {
    const stats = makeShadowArtsStats();
    for (const spellName of SHADOW_ARTS_SPELLS) {
      expect(isFreeCastAuthorized(CASTER, spellName, 2, stats, CAMPAIGN), spellName).toBe(true);
    }
    // Read census: exactly one campaign-scoped, case-exact key read per spell,
    // in disk order, and never a spell-slot read.
    expect(shadowReads()).toEqual([
      [CASTER, '_Shadow_Arts_Darkness_freeCastCount', CAMPAIGN],
      [CASTER, '_Shadow_Arts_Darkvision_freeCastCount', CAMPAIGN],
      [CASTER, '_Shadow_Arts_Pass_Without_Trace_freeCastCount', CAMPAIGN],
      [CASTER, '_Shadow_Arts_Silence_freeCastCount', CAMPAIGN],
    ]);
    expect(slotReads()).toEqual([]);

    // CLA-308 bug identity: counters are PER SPELL. Darkness spent must not
    // shadow-block the fresh spells, and the spent row must halt at its own key.
    vi.clearAllMocks();
    seedRuntime({ '_Shadow_Arts_Darkness_freeCastCount': 0 });
    expect(isFreeCastAuthorized(CASTER, 'Darkness', 2, stats, CAMPAIGN)).toBe(false);
    expect(shadowReads()).toEqual([[CASTER, '_Shadow_Arts_Darkness_freeCastCount', CAMPAIGN]]);
    expect(isFreeCastAuthorized(CASTER, 'Silence', 2, stats, CAMPAIGN)).toBe(true);
    expect(shadowReads()[shadowReads().length - 1]).toEqual([CASTER, '_Shadow_Arts_Silence_freeCastCount', CAMPAIGN]);
  });

  it('denies everything off the Title-case disk grant: other spells, lowercase case-trail, and no shadow_arts passive', () => {
    const stats = makeShadowArtsStats();
    expect(isFreeCastAuthorized(CASTER, 'Fireball', 3, stats, CAMPAIGN)).toBe(false);
    // Case trail #1457/#1519: gate is case-exact includes(); the 5e ki-text
    // subclass lists these names lowercase — a lowercase cast is NOT a grant and
    // never even reaches a counter read (full-set census below).
    seedRuntime({});
    expect(isFreeCastAuthorized(CASTER, 'darkness', 2, stats, CAMPAIGN)).toBe(false);
    // Producer-absence control (5e sheet reality): no passive -> guard denies
    // before any counter read.
    expect(isFreeCastAuthorized(CASTER, 'Darkness', 2, makeShadowArtsStats({ withPassive: false }), CAMPAIGN)).toBe(false);
    expect(shadowReads()).toEqual([]);
    expect(slotReads()).toEqual([]);
  });
});

describe('prepareSpellCast — CLA-308 free-cast consumption ledger', () => {
  it('casts stamped Darkness slotlessly: writes its counter 1->0 exactly once, logs the exact grant row, touches no slot', async () => {
    const spell = stampedSpell('Darkness');
    const result = await prepareSpellCast(spell, {}, {
      playerName: CASTER,
      playerStats: makeShadowArtsStats(),
      campaignName: CAMPAIGN,
      isUpcast: false,
      freeCastAuthorized: true,
    });

    expect(result).toStrictEqual({
      modifiedSpell: spell, // full byte-for-byte carry (WIS stamp + _shadowArtsFreeCast survive)
      metaCtx: { oldConcentrationSpell: null, shouldSetConcentration: false, slotConsumed: false, freeCastUsed: true },
      slotConsumed: false,
      freeCastUsed: true,
    });
    expect(result.modifiedSpell).not.toBe(spell); // fresh object, input untouched

    // Write census: the ONLY ledger write in the whole cast is this counter to 0.
    expect(setRuntimeValue.mock.calls).toEqual([[CASTER, '_Shadow_Arts_Darkness_freeCastCount', 0, CAMPAIGN]]);
    expect(slotWrites()).toEqual([]);

    // Log census: exactly one ability_use row, payload exact (timestamp is the
    // permitted benign stamp).
    expect(addEntry).toHaveBeenCalledTimes(1);
    const [campaign, payload] = addEntry.mock.calls[0];
    expect(campaign).toBe(CAMPAIGN);
    const { timestamp, ...rest } = payload;
    expect(typeof timestamp).toBe('number');
    expect(rest).toStrictEqual({
      type: 'ability_use',
      characterName: CASTER,
      abilityName: 'Shadow Arts',
      spellName: 'Darkness',
      note: 'Shadow Arts free cast of Darkness — no spell slot consumed. Darkness is spent until your next Long Rest.',
    });
  });

  it('per-spell consume independence and spent-counter underflow guard', async () => {
    seedRuntime({ '_Shadow_Arts_Darkness_freeCastCount': 0 });
    const ctx = {
      playerName: CASTER,
      playerStats: makeShadowArtsStats(),
      campaignName: CAMPAIGN,
      isUpcast: false,
      freeCastAuthorized: true,
    };
    const silence = await prepareSpellCast(stampedSpell('Silence'), {}, ctx);
    expect(silence.freeCastUsed).toBe(true);
    expect(setRuntimeValue.mock.calls).toEqual([[CASTER, '_Shadow_Arts_Silence_freeCastCount', 0, CAMPAIGN]]);
    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(addEntry.mock.calls[0][1].spellName).toBe('Silence');

    // Already-spent Darkness cast (caller-lied authorization): fix#341(a) — the lie is
    // REFUTED LOUD at the intersection seam (perSpellFreeCastAvailable :136-142 reads
    // the spent 0 and denies); the cast pays normally (dry lv2 bank -> honest unpaid),
    // consume never underflows to -1 and never logs.
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const spentAgain = await prepareSpellCast(stampedSpell('Darkness'), {}, ctx);
    expect(spentAgain.freeCastUsed).toBe(false); // was true on the caller's word alone — FLIPPED
    expect(spentAgain.slotConsumed).toBe(false); // lv2 bank unseeded -> nothing to pay with
    expect(setRuntimeValue).toHaveBeenCalledTimes(1); // still only the Silence write
    expect(addEntry).toHaveBeenCalledTimes(1); // only the Silence row
    expect(slotWrites()).toEqual([]);
    const refuted = errSpy.mock.calls.filter(c => String(c[0]).includes('freeCastAuthorized flag REFUTED'));
    expect(refuted.length).toBe(1); // exact-of-1, never silent
    expect(refuted[0][1]).toEqual({ playerName: CASTER, spellName: 'Darkness', spellLevel: 2 });
    errSpy.mockRestore();
  });
});

describe('incrementFreeCastResource — CLA-308 rollback (cited by incrementFreeCastResource.test.js:60)', () => {
  it('restores a spent 0 counter back to usesMax 1 and writes nothing else', () => {
    seedRuntime({ '_Shadow_Arts_Darkness_freeCastCount': 0 });
    incrementFreeCastResource(CASTER, 'Darkness', 2, makeShadowArtsStats(), CAMPAIGN);
    expect(setRuntimeValue.mock.calls).toEqual([[CASTER, '_Shadow_Arts_Darkness_freeCastCount', 1, CAMPAIGN]]);
    expect(addEntry).not.toHaveBeenCalled(); // restore never logs (FREE_CAST_RESTORE_OPS.logPerSpell null)
  });

  it('rollback is inert for a fresh null counter and for spells off the grant list', () => {
    const stats = makeShadowArtsStats();
    incrementFreeCastResource(CASTER, 'Darkness', 2, stats, CAMPAIGN); // null = fresh: no over-refund
    seedRuntime({ '_Shadow_Arts_Darkness_freeCastCount': 0 });
    incrementFreeCastResource(CASTER, 'Fireball', 3, stats, CAMPAIGN); // non-grant spell
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });
});
