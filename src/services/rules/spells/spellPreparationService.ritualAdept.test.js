// @maintained-by-ai
// CLA-299 regression: spellPreparationService Ritual Adept lane (2024 Wizard lv1).
//
// Reported-bug identity (git 5d4cbafc9, VERBATIM):
//   "fix(CLA-299): Ritual Adept (Wizard class feature): ritual cast consumes a spell
//    slot; no slotless cast-as-ritual channel"
// Pre-fix defect: every wizard ritual fell straight to consumeBaseSlot — the :851
// base-payment catch class; no authorization channel (:292), no popup-tick payment
// branch (:844), no ritual resolution log (:253) existed. First-hit form per #1515.
// Disk feature row (public/data/2024/classes.json, VERBATIM, drift-checked below):
//   "You can cast any spell as a Ritual if that spell has the Ritual tag and the
//    spell is in your spellbook. You needn't have the spell prepared, but you must
//    read from the book to cast a spell in this way." (level 1, automation.effect
//    'ritual_spells'; a class_feature on the Wizard — NOT a feat, no feat row exists)
//
// LIVE BOUNDARY — ritual-family split (#1516 table, VERBATIM rows):
//   ritualAdept sibling | CLA-299 wizard spellbook rituals (auto + popup tick) |
//                         spell.ritualCast, metaCtx.ritualCastUsed        <- THIS FILE
//   ritualOnly sibling  | CLA-234 Nature/Animal Speaker unlimited slotless |
//                         spell._ritualOnly                                 (.ritualOnly.test.js)
//   quickRitual FT-068 = yours-before                 (.quickRitual.test.js, marker + header)
// Service spans owned here: isWizardRitualAdeptSpell :235-240 (grant check: rules
// '2024' + class 'Wizard' + spellbook membership + ritual byte + base level),
// isSpellbookUnprepared :242-245 (prepared bytes '' vs 'Prepared' vs 'Always' —
// builder stamp spellCalc2024:844 isWizard ? 'Prepared' : 'Always'), FREE_CAST_CHECKS
// #5 :292, ritualCast STAMP consume :754 / auto-log :758 (else-if exclusivity — the
// popup-ticked auto face rides :754 and logs EXACTLY once), payment seam :844-850
// (popup tick: spell.ritualCast === true strict + !isUpcast -> metaCtx.ritualCastUsed),
// unticked fall-through to :851 byte-identical slot pay.
// Owned by others, NOT duplicated: _ritualOnly/_ritualFeature bytes (ritualOnly
// sibling), quickRitual/_ritualMasterRitual bytes + counter ledger (quickRitual
// sibling), popup checkbox/banner UI + ritualCast payload producer + available-ritual
// popup counts (SpellDetailPopup.ritualAdept.test.jsx — producer stamps the boolean;
// this lane consumes only), concentration/buffs (base suite, CLA-398 :229), zero-slot
// honest denial + :0-modifiedSpell build (modifications.test.js :209/:222), payment
// arity census {reads: arity-2, writes: arity-4, quick-lane :863 arity-3} — pin-home
// #1517 = resource-flow.test.js :428, cited not duplicated.
//
// Mock-completeness census (exact-of-N, #1440): the service imports 7 modules; EXACTLY
// 6 are mocked — all stateful/IO: useRuntimeState, combatData, concentrationService,
// storage (namespace, applyNewConcentration only), metamagicRules, logService. REAL
// (1/7): shared/castingTimeUtils.normalizeCastingTime — pure text normalization, only
// touched by the Spell Breaker lane (never here, never a clock/DOM). No barrel imports;
// direct-path mocks throughout (no barrel-key residue). No module under test is mocked.
//
// Fixture integrity (readFileSync drift-throw, seven-lane streak #1509-1517): the
// Identify/Detect Magic/Sleep spellbook rows below ARE public/data/2024/spells.json
// bytes (level, casting_time TEXT, ritual flag, concentration, components — every byte,
// checked at load) and classes.json carries the Ritual Adept row. 2024 disk census:
// 31 ritual:true rows, 11 lv1 (#1516 census style). 5e disk pins why 5e is a separate
// lane: 5e Identify casting_time is '1 minute' (no 'or Ritual'). Campaign lockdown:
// every call uses 'test-campaign'. Caster spellbook state: Identify UNPREPARED,
// Detect Magic PREPARED, Sleep in-book non-ritual; lv1 max 4 / lv2 max 3.
//
// Quirk scan (byte evidence on the live spans):
//   - vacuous self-compute FOUND :239 `Number(spellLevel ?? entry.level) ===
//     Number(entry.level)` — omitted spellLevel is self-equal-true by construction;
//     its documented semantics (fallback = base level, authorized) is pinned, live,
//     in the upcast-gate test rather than left unguarded.
//   - unguarded-deref guards :236/:243/:278/:862 are live and proven by the
//     missing-spellAbilities row (#1360/#1513 anonymous-entry guard twin form).
//   - chokepoint inline-dup: all three ritual-log call sites (:757/:761/:848) route
//     through the single consumeRitualAdeptCast(:253) note literal — pinned once here
//     via SERVICE_NOTE, reused, not retyped per branch (#1357/58).
//   - :0-swallow / dead-twins / 'null + N': consumeBaseSlot false-at-0 is the
//     modifications lane's pin-home; the ritual channel has NO counter accumulator
//     (unlimited RAW — absence of any _freeCastCount/_Ritual_Master_* write is
//     asserted as total ledger silence instead). ritualCast strictness is `=== true`
//     (:754/:844) — producer is the popup boolean, no non-boolean quirk test.
//   - campaign-arity histogram: every read (runtimeSelectionFreeCast :156/:159,
//     activeBuffFreeCast :201 included) now carries the explicit campaign tier
//     (owner unify call); full census lives in resource-flow :428.
//   - invocationCallOrder ledger (#1513 payment-before-log form): slotless faces
//     assert ZERO setRuntimeValue calls of ANY kind — nothing reads, nothing pays,
//     only the log ships.
//
// Kill matrix (analytic declaration, #1515/:1517 form — each mutant flips a named row):
//   drop rules!=='2024' or class check (:236)      -> gate-denials row flips
//   drop ritual!==true (:238)                        -> non-ritual-denial row flips
//   drop base-level equality (:239)                 -> upcast-deny row flips
//   drop spellbook find / membership (:237)         -> gate-denials row flips
//   widen prepared!== byte set (:244)               -> prepared-bytes row flips
//   remove FREE_CAST_CHECKS #5 (:292)               -> auto-authorize row flips
//   remove tick payment branch (:844)               -> ticked-face pays a slot
//   drop !isUpcast (:844) / reorder :834 earlier    -> upcast-tick rides ritual
//   make :758 non-exclusive (drop else-if)          -> auto+ticked logs TWICE
//   drop consumeRitualAdeptCast (:757/:761/:848)    -> ritual log rows flip
//   break the note literal (:259)                   -> SERVICE_NOTE strict-equal flips
//   (_ritualOnly branch :745 mutant -> ritualOnly sibling kills, scoped out here)
//
// PRESERVED-CITED-BY (ownership citations from siblings, behavior kept intact):
//   SpellDetailPopup.ritualAdept.test.jsx :6/:21/:213 — "service guard branches
//   (non-Wizard, missing ritual tag, spell absent from the spellbook, missing
//   spellAbilities)" + 5e denial + Always-prepared: still covered by rows below.
//   SpellDetailPopup.rageRestriction.test.jsx :11/:190 — CLA-299 channel exists.
//   spellPreparationService.quickRitual.test.js :15-16 — this file owns
//   metaCtx.ritualCastUsed (pinned exact-key-set below).
//   spellPreparationService.isFreeCastAuthorized.test.js :25 — "[ritualAdept sibling
//   owns CLA-299 face]" for dispatcher check #5.
// Old->new range map: old 1-2 -> new #1 | old 3 -> new #2 | old 4 -> new #3 |
// old 5 -> new #4 | old 6,7,8 -> new #5 | old 9 -> new #6 | old 10,11 -> new #7 |
// old 12 -> new #8 | old 13 -> new #9 | old 14 -> new #10. 14 -> 10 tests.
//
// SECURITY NOTE: no kiro-injection encountered in this lane's spans (#1446 precedent —
// none found; mine is stated clean).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';

// ---------------------------------------------------------------------------
// Static mocks — exact-of-6 (see census): every stateful/IO import of the
// service; the pure castingTimeUtils import stays REAL.
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
// Imports after mocks — the unit under test is NOT mocked
// ---------------------------------------------------------------------------

import { isFreeCastAuthorized, prepareSpellCast } from './spellPreparationService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../services/ui/logService.js';

// ---------------------------------------------------------------------------
// Disk fixtures — REAL bytes, drift-throw at load (never retyped by hand)
// ---------------------------------------------------------------------------

const WIZARD = 'DivinationWizard';
const CAMPAIGN = 'test-campaign';
// Chokepoint literal reused from spellPreparationService.js:259 (#1357/58) —
// the popup's BOOK_NOTE is the component lane's own string, not this one.
const SERVICE_NOTE = 'Ritual Adept: cast Identify as a Ritual — read from your spellbook, +10 minutes casting time, no spell slot consumed.';

function diskSpell(path, name) {
  const spells = JSON.parse(readFileSync(path, 'utf8'));
  const list = Array.isArray(spells) ? spells : spells.spells;
  const row = list.find(s => s && s.name === name);
  if (!row) throw new Error(`fixture drift: '${name}' absent from ${path}`);
  return row;
}

function diskRitualCensus(path) {
  const list = JSON.parse(readFileSync(path, 'utf8'));
  const spells = Array.isArray(list) ? list : list.spells;
  const rituals = spells.filter(s => s && s.ritual);
  return { rituals: rituals.length, lv1: rituals.filter(s => s.level === 1).length };
}

const DISK2024 = 'public/data/2024/spells.json';
const diskIdentify = diskSpell(DISK2024, 'Identify');
const diskDetectMagic = diskSpell(DISK2024, 'Detect Magic');
const diskSleep = diskSpell(DISK2024, 'Sleep');

// Census checks (#1516 form): 2024 spells.json = 31 ritual:true rows, 11 lv1.
const census2024 = diskRitualCensus(DISK2024);
if (census2024.rituals !== 31 || census2024.lv1 !== 11) {
  throw new Error(`disk census drift: 2024 spells.json ${census2024.rituals} ritual rows / ${census2024.lv1} lv1 — update lane docs`);
}
// 5e census pin: 5e Identify stays casting_time '1 minute' (no 'or Ritual') —
// the text difference is why the CLA-299 channel is 2024-only on disk too.
if (diskSpell('public/data/spells.json', 'Identify').casting_time !== '1 minute') {
  throw new Error('disk census drift: 5e Identify casting_time changed');
}
// Ritual Adept grant row: Wizard lv1 class_feature (NOT in feats.json — no feat row
// exists in either ruleset, confirmed by disk scan).
const ritualAdeptRow = (function findFeature(node) {
  if (Array.isArray(node)) { for (const v of node) { const hit = findFeature(v); if (hit) return hit; } return null; }
  if (node && typeof node === 'object') {
    if (node.name === 'Ritual Adept') return node;
    for (const v of Object.values(node)) { const hit = findFeature(v); if (hit) return hit; }
  }
  return null;
})(JSON.parse(readFileSync('public/data/2024/classes.json', 'utf8')));
if (!ritualAdeptRow || ritualAdeptRow.level !== 1 || ritualAdeptRow.automation?.effect !== 'ritual_spells') {
  throw new Error('disk drift: 2024 classes.json Ritual Adept row changed shape');
}

// Spellbook entries = disk bytes + the builder's prepared byte (spellCalc2024:844
// wizard branch stamps 'Prepared'; absence '' = known-not-prepared).
function bookEntry(diskRow, prepared) {
  return {
    name: diskRow.name,
    level: diskRow.level,
    casting_time: diskRow.casting_time,
    ritual: diskRow.ritual,
    concentration: diskRow.concentration,
    components: diskRow.components,
    prepared,
  };
}

const identifyUnprepared = bookEntry(diskIdentify, '');
const identifyPrepared = bookEntry(diskIdentify, 'Prepared');
const detectMagicPrepared = bookEntry(diskDetectMagic, 'Prepared');
const sleepEntry = bookEntry(diskSleep, '');
// Find Familiar: a REAL lv1 disk ritual kept OUT of the caster's book — the
// membership-negative (fails exactly the spellbook-membership byte).
const findFamiliarLv1OnDisk = diskSpell(DISK2024, 'Find Familiar');
if (findFamiliarLv1OnDisk.level !== 1 || findFamiliarLv1OnDisk.ritual !== true) {
  throw new Error('disk drift: Find Familiar is no longer a lv1 ritual');
}

function makeWizardStats({ rules = '2024', className = 'Wizard', spells = [identifyUnprepared, detectMagicPrepared, sleepEntry] } = {}) {
  return {
    name: WIZARD,
    level: 20,
    rules,
    proficiency: 6,
    class: { name: className, spell_casting_ability: 'Intelligence' },
    abilities: [{ name: 'Intelligence', bonus: 7 }],
    spellAbilities: {
      spellCastingAbility: 'Intelligence',
      toHit: 13,
      saveDc: 21,
      modifier: 7,
      spell_slots_level_1: 4,
      spell_slots_level_2: 3,
      spells,
    },
    automation: { actions: [], bonusActions: [], specialActions: [], passives: [] },
  };
}

const slots = (key, value) => (_n, k) => (k === key ? value : undefined);
const ritualLogs = () => addEntry.mock.calls.map(c => c[1]).filter(e => e.abilityName === 'Ritual Casting');

describe('spellPreparationService — Ritual Adept wizard spellbook rituals (CLA-299)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(undefined);
  });

  describe('isFreeCastAuthorized — the #5 auto channel + its guard bytes', () => {
    it('auto-authorizes the UNPREPARED spellbook ritual at base level — unlimited, never consulting a spell-slot key', () => {
      // Zero banked slots in the store: authorization must not care (RAW unlimited).
      getRuntimeValue.mockImplementation(slots('spell_slots_level_1', 0));
      const stats = makeWizardStats();
      expect(isFreeCastAuthorized(WIZARD, 'Identify', 1, stats, CAMPAIGN)).toBe(true);
      // Unlimited: no uses counter exists on the feature — a second scan decides true.
      expect(isFreeCastAuthorized(WIZARD, 'Identify', 1, stats, CAMPAIGN)).toBe(true);
      // Ledger silence: no spell_slots_level_* key was ever READ.
      expect(getRuntimeValue.mock.calls.filter(c => String(c[1]).startsWith('spell_slots_level_'))).toHaveLength(0);
    });

    it('denies the auto channel for prepared bytes "Prepared" and "Always" (the tick lane owns them)', () => {
      // prepared-byte triple on one spell: '' -> auto authorized (see row above);
      // 'Prepared' and 'Always' -> slot-payment / opt-in lane, never auto (:244).
      const preparedStats = makeWizardStats({ spells: [identifyPrepared] });
      expect(isFreeCastAuthorized(WIZARD, 'Identify', 1, preparedStats, CAMPAIGN)).toBe(false);
      const alwaysStats = makeWizardStats({ spells: [bookEntry(diskIdentify, 'Always')] });
      expect(isFreeCastAuthorized(WIZARD, 'Identify', 1, alwaysStats, CAMPAIGN)).toBe(false);
    });

    it('denies an in-book NON-ritual spell (Sleep — disk ritual:false byte)', () => {
      expect(isFreeCastAuthorized(WIZARD, 'Sleep', 1, makeWizardStats(), CAMPAIGN)).toBe(false);
    });

    it('denies an UPCAST above the ritual base level; an omitted spellLevel falls back to base (the :239 ?? semantics)', () => {
      const stats = makeWizardStats();
      expect(isFreeCastAuthorized(WIZARD, 'Identify', 2, stats, CAMPAIGN)).toBe(false);
      // Pinned vacuous-fallback (see quirk scan): undefined -> entry.level -> true.
      expect(isFreeCastAuthorized(WIZARD, 'Identify', undefined, stats, CAMPAIGN)).toBe(true);
    });

    it('denies outside the grant: 5e ruleset byte, non-Wizard class byte, ritual absent from the spellbook', () => {
      // Each input fails EXACTLY ONE gate byte (mutually distinguishable #1348):
      expect(isFreeCastAuthorized(WIZARD, 'Identify', 1, makeWizardStats({ rules: '5e' }), CAMPAIGN)).toBe(false);
      expect(isFreeCastAuthorized(WIZARD, 'Identify', 1, makeWizardStats({ className: 'Sorcerer' }), CAMPAIGN)).toBe(false);
      // Find Familiar is a real lv1 disk ritual but NOT in this caster's book.
      expect(isFreeCastAuthorized(WIZARD, 'Find Familiar', 1, makeWizardStats(), CAMPAIGN)).toBe(false);
    });

    it('returns false without throwing when spellAbilities is missing (guarded :236/:243/:278)', () => {
      const stats = { name: 'Someone', rules: '2024', class: { name: 'Wizard' }, automation: {} };
      expect(() => isFreeCastAuthorized('Someone', 'Identify', 1, stats, CAMPAIGN)).not.toThrow();
      expect(isFreeCastAuthorized('Someone', 'Identify', 1, stats, CAMPAIGN)).toBe(false);
    });
  });

  describe('prepareSpellCast — payment seam faces (auto / ticked / upcast-ticked / unticked)', () => {
    it('auto face: slotless over banked slots with total ledger silence, exact ritual log, and the popup-ticked auto face logs exactly once (:754/:758 exclusivity)', async () => {
      getRuntimeValue.mockImplementation(slots('spell_slots_level_1', 4));
      const stats = makeWizardStats();

      const result = await prepareSpellCast(identifyUnprepared, {}, {
        playerName: WIZARD, playerStats: stats, campaignName: CAMPAIGN,
        isUpcast: false, freeCastAuthorized: true,
      });

      expect(result).toStrictEqual({
        modifiedSpell: identifyUnprepared,
        metaCtx: {
          oldConcentrationSpell: null,
          shouldSetConcentration: false,
          freeCastUsed: true,
          slotConsumed: false,
        },
        slotConsumed: false,
        freeCastUsed: true,
      });
      expect(result.modifiedSpell).not.toBe(identifyUnprepared); // fresh copy
      expect(identifyUnprepared).toStrictEqual(bookEntry(diskIdentify, '')); // purity
      expect(setRuntimeValue).not.toHaveBeenCalled(); // nothing paid, no counter stamped
      expect(ritualLogs()).toHaveLength(1);
      expect(ritualLogs()[0]).toStrictEqual({
        type: 'ability_use',
        characterName: WIZARD,
        abilityName: 'Ritual Casting',
        spellName: 'Identify',
        note: SERVICE_NOTE,
        timestamp: expect.any(Number),
      });

      // Popup-ticked auto face (unprepared + ritualCast:true, popup sends both bytes):
      // consumeFreeCast :754 catches it and :758 must NOT re-fire — ONE ritual log,
      // and metaCtx gains NO ritualCastUsed (that stamp belongs to the prepared tick).
      vi.clearAllMocks();
      getRuntimeValue.mockImplementation(slots('spell_slots_level_1', 4));
      const tickedAuto = await prepareSpellCast({ ...identifyUnprepared, ritualCast: true }, {}, {
        playerName: WIZARD, playerStats: stats, campaignName: CAMPAIGN,
        isUpcast: false, freeCastAuthorized: true,
      });
      expect(tickedAuto.freeCastUsed).toBe(true);
      expect(tickedAuto.metaCtx.ritualCastUsed).toBeUndefined();
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(addEntry).toHaveBeenCalledTimes(1);
      expect(ritualLogs()).toHaveLength(1);
    });

    it('ticked face: PREPARED spellbook ritual + spell.ritualCast pays NO slot, stamps metaCtx.ritualCastUsed, logs the ritual', async () => {
      getRuntimeValue.mockImplementation(slots('spell_slots_level_1', 3));
      const stats = makeWizardStats();
      const spell = { ...identifyPrepared, ritualCast: true };

      const result = await prepareSpellCast(spell, {}, {
        playerName: WIZARD, playerStats: stats, campaignName: CAMPAIGN,
        isUpcast: false, freeCastAuthorized: false,
      });

      expect(result).toStrictEqual({
        modifiedSpell: spell,
        metaCtx: {
          oldConcentrationSpell: null,
          shouldSetConcentration: false,
          ritualCastUsed: true,
          freeCastUsed: true,
          slotConsumed: false,
        },
        slotConsumed: false,
        freeCastUsed: true,
      });
      expect(result.modifiedSpell).not.toBe(spell); // fresh copy
      expect(spell).toStrictEqual({ ...identifyPrepared, ritualCast: true }); // purity
      expect(setRuntimeValue).not.toHaveBeenCalled(); // FT-068 popup-payment: nothing spent
      expect(ritualLogs()).toHaveLength(1);
      expect(ritualLogs()[0]).toStrictEqual({
        type: 'ability_use',
        characterName: WIZARD,
        abilityName: 'Ritual Casting',
        spellName: 'Identify',
        note: SERVICE_NOTE,
        timestamp: expect.any(Number),
      });
    });

    it('UPCAST + tick does NOT ride the ritual channel — the lv2 slot is paid before the tick branch, no ritual stamp or log', async () => {
      getRuntimeValue.mockImplementation(slots('spell_slots_level_2', 1));
      const stats = makeWizardStats();
      const spell = { ...identifyPrepared, ritualCast: true };

      const result = await prepareSpellCast(spell, {}, {
        playerName: WIZARD, playerStats: stats, campaignName: CAMPAIGN,
        isUpcast: true, upcastLevel: 2, freeCastAuthorized: false,
      });

      expect(result.slotConsumed).toBe(true);
      expect(result.freeCastUsed).toBe(false);
      expect(result.metaCtx.ritualCastUsed).toBeUndefined();
      expect(result.metaCtx).toStrictEqual({
        oldConcentrationSpell: null,
        shouldSetConcentration: false,
        slotConsumed: true,
        freeCastUsed: false,
      });
      expect(setRuntimeValue).toHaveBeenCalledTimes(1); // rituals cast at base only (:834)
      expect(setRuntimeValue).toHaveBeenCalledWith(WIZARD, 'spell_slots_level_2', 0, CAMPAIGN);
      expect(ritualLogs()).toHaveLength(0);
    });

    it('unticked prepared cast pays its base slot byte-identically — ritual channel fully absent (cannot-regress pin)', async () => {
      getRuntimeValue.mockImplementation(slots('spell_slots_level_1', 3));
      const stats = makeWizardStats();

      const result = await prepareSpellCast(identifyPrepared, {}, {
        playerName: WIZARD, playerStats: stats, campaignName: CAMPAIGN,
        isUpcast: false, freeCastAuthorized: false,
      });

      expect(result.slotConsumed).toBe(true);
      expect(result.freeCastUsed).toBe(false);
      expect(result.metaCtx).toStrictEqual({
        oldConcentrationSpell: null,
        shouldSetConcentration: false,
        slotConsumed: true,
        freeCastUsed: false,
      });
      expect(setRuntimeValue).toHaveBeenCalledTimes(1);
      expect(setRuntimeValue).toHaveBeenCalledWith(WIZARD, 'spell_slots_level_1', 2, CAMPAIGN);
      expect(ritualLogs()).toHaveLength(0);
      expect(addEntry).not.toHaveBeenCalled();
    });
  });
});
