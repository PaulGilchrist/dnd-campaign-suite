// @maintained-by-ai
// ---------------------------------------------------------------------------
// spellPreparationService.test.js — BASE lane (the domain root) of the
// spellPreparationService family. Face ratified VERBATIM by the resource-flow
// sibling header (#1517): 'base (.test.js cantrips/concentration/buffs/
// CLA-398 re-mark)'. The oracle sibling isFreeCastAuthorized.test.js cites
// this file twice (:54 header, :454 describe title): 'prepareSpellCast
// management owned by spellPreparationService.test.js' — that management is
// owned HERE: resolveConcentrationChange :663-694 (every arm, incl. the
// Summon Aberration exception :669, Eyebite recast :680, CLA-398 re-mark
// :682-689), isConcentrationTargetDepleted :656-661 (all four arms),
// applyNewConcentration :868-876 (targetName carry + saveDc ?? 10),
// applyConcentrationTracking :915-945 (cleanup-before-set order, Eyebite
// fresh stamp :941), trackConcentrationBuff :797-807 (buff channel + dedup
// guard :805), the Eyebite-recast no-pay arm :832, the WGB concentration
// guard :910-913, cantrip EARLY-DISPATCH into :960 (zero-payment face;
// transform byte {...spell, baseLevel:0} owned by modifications T2 — cited,
// never re-pinned) and the CLA-398/SP-068 re-mark log :926-938.
//
// MASTER OWNERSHIP TABLE (span/feature -> owning lane file; family of 16 —
// future lanes route from this table alone):
//   result envelope :948-953 + SP-005 carry :1016-1017 ...................... resource-flow
//   consumeBaseSlot/consumeUpcastSlot pay/deny ladder :718-789, falsy-upcast
//     pays base :966, free-vs-pay exclusivity :834/:851 ..................... resource-flow
//   #1516 :720/:767 arity-2 read vs arity-4 write hazard pin ................ resource-flow:427-428
//   modifiedSpell transform bytes: upcast swap :997-999, cantrip byte
//     :961, psychic :886-888, spell-breaker :890-892, phantasmal :812-825 .. modifications
//   cantrip dispatch + zero-payment (store dark) .............................. BASE (this file)
//   concentration management + buff channel + CLA-398 re-mark (span list above) BASE (this file)
//   isFreeCastAuthorized oracle scan, gate truth table, gate #9 WGB auth,
//     :985 payment-authority default-deny read-ledger, golden crash twin ...... isFreeCastAuthorized
//   CLA-234 _ritualOnly consume ................................................. ritualOnly
//   CLA-299 ritual adept auto + popup-tick faces ................................ ritualAdept
//   FT-068 Quick Ritual consume + arity-3 seam .................................. quickRitual
//   CLA-138 fey no-Concentration quirk + consume ................................ cla138-fey-reinforcements
//   CLA-130 faithful steed latch auth + consume ............................... cla130-faithful-steed
//   CLA-231 arcanum per-level counter key select .............................. mysticArcanum
//   CLA-308 shadow_arts per-spell passive channel ............................. shadowArts
//   FT-070 shadowTouched perSpellTracking feat ................................ shadowTouched
//   CLA-323 spell mastery free-at-lowest/upcast-pays .......................... spellMasteryPayment
//   CLA-312 signature lv3-free/upcast-pays .................................... signatureUpcastPayment
//   CLA-388 wild companion paid-grant consume .................................. wildCompanion
//   incrementFreeCastResource rollback producer (favored/NR/Bewitching/arcanum
//     /recharge ledgers) ........................................................ incrementFreeCastResource
//   WGB Spiritual Weapon cleanupBuffsByName :830/:628-639, decrement internals,
//     uses_expression/perSpell/type-filter loop arms ......................... uncovered.*
//
// FIXTURES (disk is law #1365, fabrication-ban): every spell input is the
// REAL public/data/2024/spells.json row, loaded at import with drift-throw
// (fifteen-lane streak; retype-free derivation — names come from the rows).
// Legacy fabrication retired here: the old lane cast 'Fireball' with a
// FABRICATED concentration:true byte (disk byte is FALSE, census below) and
// 5e 'Hex'/'Summon Aberration' rows that do not exist in spells.json.
// Concentration decisions now ride disk-honest rows. Caster is the
// non-impersonating synthetic 'Mira' (#1492, structural probe). Campaign is
// 'test-campaign' on every tuple (legacy 'camp' swept — all 15 legacy
// occurrences replaced).
//
// QUIRK SCAN verdicts (this lane's spans):
//   golden unguarded-deref guard rows: :670 cs-null (REAL off-table null,
//     pinned T4 arm B, store-faithful) and :672 creature-miss (unarmed caster
//     row) — nothing throws; the anonymous-entry crash twin lives in the
//     oracle lane (#1513/:1518 verbatim form) — cited not regrown.
//   vacuous self-compute: trackConcentrationBuff :802 builds newBuffs BEFORE
//     the :805 dedup guard returns — wasted allocation, unobservable; the
//     observable side (zero writes on dedup) is pinned in T7/T8. Report-only
//     neighbors: favored-enemy consume writes back the count it just read
//     (:491-496) — home-owned uncovered.prepareSpellCast; + accumulator
//     'null + N' forms are in the increment sibling (:580, null-guarded).
//   :0-swallow: cantrip gate :955 is strict === 0 (string '0' rides the pay
//     ladder) — quantified at load: EVERY disk row's level is typeof number.
//     Payment-side :0-gates owned resource-flow (banked-0 deny rows).
//   silent-undefined ?.: :872 ?.targetName || null — both faces run live in
//     T3 (carry vs null); :928 ?.creatures reads the live summary post-break.
//   dead twins, BOTH directions: FREE_CAST_ENTRY_TYPES (free_spell disk-hits
//     15, fey_reinforcements 1, misty_wanderer 1, dragon_companion 1) all
//     owned by named siblings; direction B — every arm inside this lane's
//     spans is exercised by a row here (kill matrix), and no name-literal
//     gate in the base spans (:669 Summon Aberration, CONCENTRATION_BUFF_
//     EFFECTS keys, CONCENTRATION re-mark names) is disk-absent (censused at
//     load). Summon Aberration's exception is a SERVICE-side hardcode against
//     a real disk concentration:true row — design, pinned honestly.
//   case trails: every name gate is case-exact disk Title Case; the only
//     case-insensitive gate in the family is Aura of Vitality (oracle :441,
//     cited). invocationCallOrder read-ledger pinned T2. arity census ->
//     home resource-flow:427-428 (cited, not re-pinned).
//   NO-CLOCK: zero timers in this lane; the only time-adjacent byte is the
//     opaque log-row timestamp emitted by the service (:937) — pinned by
//     typeof-number form in T7/T8, never generated or compared by this file.
//   purity: input spell + playerStats JSON-snapshot-checked on EVERY cast
//     via the cast() helper (:949/:997 spread-copy).
//   :985 payment-authority (:1514 cite): prepareSpellCast never recomputes
//     the oracle — freeCastAuthorized is caller-supplied truth; the WGB row
//     in T6 pins the default-deny face (armed oracle state, still pays).
//
// KILL MATRIX (declared analytic, #1491 form):
//   :669 drop spell.concentration gate .... T4-A (fireball would consult + stamp; expect consult dark)
//   :669 drop Summon Aberration guard ...... T6-r1 (breakConcentration would fire over live concentration)
//   :669 drop !isWgbSpell ................. T6-r2 (breakConcentration would fire under armed WGB)
//   :670 guard removal (cs null) ......... T4-B (TypeError; today it returns clean)
//   :673 replace-arm ternary ............ T2 (break/persist/cleanup ledger + order)
//   :678 fresh-arm ....................... T3 (all four rows)
//   :680 Eyebite recast-arm ............. T5-recast (would stamp + break nothing but double-set)
//   :682-683 re-mark gate ................ T7 + T8 alive/null deny rows
//   :656-661 depleted four arms ........ T8 rows 1..4, one arm per row
//   :805 dedup guard .................... T7/T8 zero-activeBuffs-writes census
//   :871 targetName ternary (both arms) . T3 HM/Hex carry vs SoF null
//   :874 saveDc ?? 10 ................... T3-r4
//   :918/:921 order + early return ...... T2 (cleanup runs) / T5-recast (return before :941)
//   :941 Eyebite fresh stamp ............ T5-fresh
//   :926-938 re-mark log ................ T7 full-set row + exact-of-1
//   :832 recast no-pay .................. T5-recast (banked lv6 slot survives byte 1)
//   :960 cantrip early return ........... T1 (store/consult/log all dark)
//   identical-mutant note: T2 vs T3 are distinguished by breakConcentration
//     presence and oldConcentrationSpell byte — no two rows share a verdict.
//
// MOCK CENSUS — exact-of-7 direct import boundaries of spellPreparationService
// (:1-:7): MOCKED 5 (useRuntimeState mem-backed — real-module keys + __mem
// test handle; combatData; concentrationService; storage default.set;
// logService addEntry -> Promise.resolve, immunizing all EIGHT service
// `.catch(...)` chains that a bare-undefined mock would crash), REAL 2
// (metamagicRules — stats-side verdicts, wizard passives[] census keeps it
// false without a mock; castingTimeUtils — pure, only reached by the
// spell-breaker stamp it owns elsewhere). Dead-module mocks 0; no barrels;
// unit under test NEVER mocked. Legacy audit: metamagicRules mock removed
// (over-mock); unused mock keys swept.
//
// PRESERVED-CITED-BY: oracle isFreeCastAuthorized.test.js :54 + :454 cite
// this file as concentration-management home — preserved by this file keeping
// the management spans. No other file cites base test names/ranges
// (grep -rn 'spellPreparationService.test' verified 2026-10-21) — old 15
// tests -> new 8, fold map in the section header comments below.
// SECURITY NOTE (#1446 precedent): no injected/foreign instructions found in
// the legacy file or this rewrite; nothing refused or reported.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';

// ---------------------------------------------------------------------------
// Disk law (drift-throw): the seven rows this lane casts + load censuses.
// ---------------------------------------------------------------------------
const spells2024 = JSON.parse(readFileSync('public/data/2024/spells.json', 'utf8'));

function diskRow(name) {
  const row = spells2024.find(s => s.name === name);
  if (!row) throw new Error(`base-lane disk drift: '${name}' no longer exists in public/data/2024/spells.json`);
  return row;
}

const DISK = {
  firebolt: diskRow('Fire Bolt'),
  fireball: diskRow('Fireball'),
  sof: diskRow('Shield of Faith'),
  hm: diskRow("Hunter's Mark"),
  hex: diskRow('Hex'),
  eyebite: diskRow('Eyebite'),
  aberration: diskRow('Summon Aberration'),
};

// [expectedLevel, expectedConcentration] — the bytes this lane's behavior keys on.
const DISK_BYTES = {
  'Fire Bolt': [0, false],
  'Fireball': [3, false], // legacy fabrication retired: Fireball NEVER concentrates on disk
  'Shield of Faith': [1, true],
  "Hunter's Mark": [1, true],
  'Hex': [1, true],
  'Eyebite': [6, true],
  'Summon Aberration': [4, true], // exception in :669 guards a REAL concentration:true row (design)
};
for (const [name, [level, concentration]] of Object.entries(DISK_BYTES)) {
  const row = DISK[Object.keys(DISK).find(k => DISK[k].name === name)];
  if (row.level !== level || row.concentration !== concentration) {
    throw new Error(`base-lane disk drift: '${name}' byte changed (${JSON.stringify({ level: row.level, concentration: row.concentration })} !== ${JSON.stringify({ level, concentration })}) — re-read spells.json and update this lane`);
  }
}
// :0-swallow quantifier census: every disk level is numeric, so the strict === 0 gate never swallows a string.
const nonNumericLevel = spells2024.find(s => typeof s.level !== 'number');
if (nonNumericLevel) throw new Error(`base-lane disk drift: ${nonNumericLevel.name}.level is not a number — strict cantrip gate :955 would mis-dispatch`);

// ---------------------------------------------------------------------------
// Mocks — exact-of-5-of-7 census (see header). Unit under test never mocked.
// ---------------------------------------------------------------------------
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => {
  const mem = new Map();
  return {
    getRuntimeValue: vi.fn((_name, key) => (mem.has(key) ? mem.get(key) : undefined)),
    setRuntimeValue: vi.fn((_name, key, value) => { mem.set(key, value); }),
    clearRuntimeState: vi.fn(() => mem.clear()),
    __mem: mem,
  };
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

import { prepareSpellCast } from './spellPreparationService.js';
import { getRuntimeValue, setRuntimeValue, __mem } from '../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../../services/encounters/combatData.js';
import { breakConcentration, addConcentration, cleanupConcentrationEffects } from '../../../services/combat/concentration/concentrationService.js';
import * as storageService from '../../../services/ui/storage.js';
import { addEntry } from '../../../services/ui/logService.js';

const CAMPAIGN = 'test-campaign';
const CASTER = 'Mira'; // non-impersonating synthetic caster (#1492, structural probe)

function wizardStats({ slots = {} } = {}) {
  return {
    name: CASTER,
    class: { name: 'Wizard' },
    abilities: [{ name: 'Intelligence', bonus: 4 }],
    proficiency: 3,
    spellAbilities: { spellCastingAbility: 'Intelligence', toHit: 8, saveDc: 17, modifier: 4, ...slots },
    automation: { actions: [], bonusActions: [], specialActions: [], passives: [] },
    hitPoints: 45,
  };
}

const csOf = (...creatures) => ({ creatures });
const casterRow = (overrides = {}) => ({ name: CASTER, concentration: null, ...overrides });

function resetLane() {
  vi.clearAllMocks();
  __mem.clear();
  getCombatSummary.mockReturnValue(null);
}

// Every row: purity guard on both inputs (service spreads copies, never mutates).
async function cast(spell, playerStats, options = {}) {
  const spellBefore = JSON.stringify(spell);
  const statsBefore = JSON.stringify(playerStats);
  const result = await prepareSpellCast(spell, {}, { playerName: CASTER, playerStats, campaignName: CAMPAIGN, ...options });
  expect(JSON.stringify(spell), 'input spell purity').toBe(spellBefore);
  expect(JSON.stringify(playerStats), 'playerStats purity').toBe(statsBefore);
  return result;
}

describe('prepareSpellCast — base lane: cantrip dispatch', () => {
  beforeEach(resetLane);

  it('T1: level-0 dispatch hits the :960 early return — banked slots, combat data, concentration services and log are ALL dark (transform byte owned by modifications T2)', async () => {
    __mem.set('spell_slots_level_3', 2);
    getCombatSummary.mockReturnValue(csOf(casterRow({ concentration: { spell: 'Hex', dc: 15 } })));
    const result = await cast(DISK.firebolt, wizardStats({ slots: { spell_slots_level_3: 2 } }));

    expect(result.slotConsumed).toBe(false);
    expect(result.freeCastUsed).toBe(false);
    expect(result.metaCtx).toStrictEqual({}); // concentration stamps are NEVER written pre-:960 — dispatch-face proof
    expect(result.modifiedSpell.baseLevel).toBe(0);
    expect(result.modifiedSpell).not.toBe(DISK.firebolt);
    expect(getRuntimeValue).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(getCombatSummary).not.toHaveBeenCalled();
    expect(breakConcentration).not.toHaveBeenCalled();
    expect(addConcentration).not.toHaveBeenCalled();
    expect(cleanupConcentrationEffects).not.toHaveBeenCalled();
    expect(storageService.default.set).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
    expect(__mem.get('spell_slots_level_3')).toBe(2);
  });
});

describe('prepareSpellCast — concentration management (oracle :54/:454 cede this span to this lane)', () => {
  beforeEach(resetLane);

  it('T2: replace-arm — breaks the old mark, persists, cleans up, sets the new one in read-ledger order; exact-of-2 write ledger (slot pay + buff row)', async () => {
    __mem.set('spell_slots_level_1', 2);
    const cs = csOf(casterRow({ concentration: { spell: DISK.sof.name, dc: 15 } }));
    getCombatSummary.mockReturnValue(cs);

    const result = await cast(DISK.hm, wizardStats({ slots: { spell_slots_level_1: 2 } }));

    expect(result.metaCtx.oldConcentrationSpell).toBe(DISK.sof.name);
    expect(result.metaCtx.shouldSetConcentration).toBe(true);
    expect(breakConcentration).toHaveBeenCalledTimes(1);
    expect(breakConcentration).toHaveBeenCalledWith(cs, CASTER);
    expect(cleanupConcentrationEffects).toHaveBeenCalledTimes(1);
    expect(cleanupConcentrationEffects).toHaveBeenCalledWith(CASTER, DISK.sof.name, CAMPAIGN);
    expect(addConcentration).toHaveBeenCalledTimes(1);
    expect(addConcentration).toHaveBeenCalledWith(cs, CASTER, DISK.hm.name, 17, null);
    // quirk pinned honestly: the summary persists TWICE per replace (break-persist :676 + set-persist :875).
    expect(storageService.default.set).toHaveBeenCalledTimes(2);
    expect(storageService.default.set).toHaveBeenCalledWith('combatSummary', cs, CAMPAIGN);
    // invocationCallOrder read-ledger (#1513 form): consult -> break -> persist -> cleanup -> re-consult -> set -> persist.
    const o = fn => fn.mock.invocationCallOrder;
    expect(o(getCombatSummary)[0]).toBeLessThan(o(breakConcentration)[0]);
    expect(o(breakConcentration)[0]).toBeLessThan(o(storageService.default.set)[0]);
    expect(o(storageService.default.set)[0]).toBeLessThan(o(cleanupConcentrationEffects)[0]);
    expect(o(getCombatSummary)[1]).toBeLessThan(o(addConcentration)[0]);
    expect(o(addConcentration)[0]).toBeLessThan(o(storageService.default.set)[1]);
    expect(setRuntimeValue.mock.calls).toEqual([
      [CASTER, 'spell_slots_level_1', 1, CAMPAIGN],
      [CASTER, 'activeBuffs', [{ name: DISK.hm.name, effect: 'hunters_mark_concentration', duration: 'concentration' }], CAMPAIGN],
    ]);
  });

  it('T3: fresh-arm table (:678/:871-874/:797-807) — targetName carried for Hunter\'s Mark/Hex only, saveDc ?? 10 fallback, untracked spell writes no buff row, no break/cleanup on a fresh caster', async () => {
    const rows = [
      { spell: DISK.hm, targetName: 'Goblin1', dropSaveDc: false, expectDc: 17, expectTarget: 'Goblin1', buffEffect: 'hunters_mark_concentration' },
      { spell: DISK.hex, targetName: 'Goblin2', dropSaveDc: false, expectDc: 17, expectTarget: 'Goblin2', buffEffect: 'hex_concentration' },
      { spell: DISK.sof, targetName: 'Goblin1', dropSaveDc: false, expectDc: 17, expectTarget: null, buffEffect: null },
      { spell: DISK.hm, targetName: null, dropSaveDc: true, expectDc: 10, expectTarget: null, buffEffect: 'hunters_mark_concentration' },
    ];
    for (const row of rows) {
      resetLane();
      __mem.set('spell_slots_level_1', 1);
      const stats = wizardStats({ slots: { spell_slots_level_1: 1 } });
      if (row.dropSaveDc) delete stats.spellAbilities.saveDc;
      const cs = csOf(casterRow({ targetName: row.targetName }));
      getCombatSummary.mockReturnValue(cs);

      const result = await cast(row.spell, stats);

      expect(result.metaCtx.shouldSetConcentration).toBe(true);
      expect(result.metaCtx.oldConcentrationSpell).toBeNull();
      expect(breakConcentration).not.toHaveBeenCalled();
      expect(cleanupConcentrationEffects).not.toHaveBeenCalled();
      expect(addConcentration).toHaveBeenCalledTimes(1);
      expect(addConcentration).toHaveBeenCalledWith(cs, CASTER, row.spell.name, row.expectDc, row.expectTarget);
      const slotWrite = [CASTER, 'spell_slots_level_1', 0, CAMPAIGN];
      expect(setRuntimeValue.mock.calls).toEqual(row.buffEffect
        ? [slotWrite, [CASTER, 'activeBuffs', [{ name: row.spell.name, effect: row.buffEffect, duration: 'concentration' }], CAMPAIGN]]
        : [slotWrite]);
    }
  });

  it('T4: guard arms — a non-concentration cast never consults combat data (:669 FALSE), and an off-table null summary sets nothing but still pays (:670)', async () => {
    __mem.set('spell_slots_level_3', 2);
    getCombatSummary.mockReturnValue(csOf(casterRow({ concentration: { spell: DISK.hex.name, dc: 15 } })));
    const fireball = await cast(DISK.fireball, wizardStats({ slots: { spell_slots_level_3: 2 } }));

    expect(fireball.metaCtx.shouldSetConcentration).toBe(false);
    expect(fireball.slotConsumed).toBe(true);
    expect(getCombatSummary).not.toHaveBeenCalled();
    expect(breakConcentration).not.toHaveBeenCalled();
    expect(addConcentration).not.toHaveBeenCalled();
    expect(cleanupConcentrationEffects).not.toHaveBeenCalled();
    expect(storageService.default.set).not.toHaveBeenCalled();
    expect(setRuntimeValue.mock.calls).toEqual([[CASTER, 'spell_slots_level_3', 1, CAMPAIGN]]);

    // arm B: store-faithful REAL null (live getCombatSummary returns null off-combat).
    resetLane();
    __mem.set('spell_slots_level_1', 1);
    const sof = await cast(DISK.sof, wizardStats({ slots: { spell_slots_level_1: 1 } }));

    expect(getCombatSummary).toHaveBeenCalledTimes(1);
    expect(sof.metaCtx.shouldSetConcentration).toBe(false);
    expect(sof.metaCtx.oldConcentrationSpell).toBeNull();
    expect(breakConcentration).not.toHaveBeenCalled();
    expect(addConcentration).not.toHaveBeenCalled();
    expect(cleanupConcentrationEffects).not.toHaveBeenCalled();
    expect(storageService.default.set).not.toHaveBeenCalled();
    expect(sof.slotConsumed).toBe(true);
    expect(setRuntimeValue.mock.calls).toEqual([[CASTER, 'spell_slots_level_1', 0, CAMPAIGN]]);
  });

  it('T5: Eyebite — fresh cast stamps concentration + the eyebite_concentration row (:678/:941); same-name recast breaks nothing, pays nothing, writes nothing (:680/:832/:921)', async () => {
    __mem.set('spell_slots_level_6', 2);
    const stats = wizardStats({ slots: { spell_slots_level_6: 2 } });
    const cs = csOf(casterRow());
    getCombatSummary.mockReturnValue(cs);

    const fresh = await cast(DISK.eyebite, stats);
    expect(fresh.metaCtx.shouldSetConcentration).toBe(true);
    expect(fresh.slotConsumed).toBe(true);
    expect(addConcentration).toHaveBeenCalledTimes(1);
    expect(addConcentration).toHaveBeenCalledWith(cs, CASTER, DISK.eyebite.name, 17, null);
    expect(setRuntimeValue.mock.calls).toEqual([
      [CASTER, 'spell_slots_level_6', 1, CAMPAIGN],
      [CASTER, 'activeBuffs', [{ name: DISK.eyebite.name, effect: 'eyebite_concentration', duration: 'concentration' }], CAMPAIGN],
    ]);

    // recast while already concentrating on Eyebite itself: free, inert, zero writes.
    vi.clearAllMocks(); // mockClear keeps implementations; only call ledgers reset for the delta census
    getCombatSummary.mockReturnValue(csOf(casterRow({ concentration: { spell: DISK.eyebite.name, dc: 17 } })));

    const recast = await cast(DISK.eyebite, stats);
    expect(recast.metaCtx.shouldSetConcentration).toBe(false);
    expect(recast.metaCtx.oldConcentrationSpell).toBeNull();
    expect(recast.slotConsumed).toBe(false);
    expect(breakConcentration).not.toHaveBeenCalled();
    expect(addConcentration).not.toHaveBeenCalled();
    expect(cleanupConcentrationEffects).not.toHaveBeenCalled();
    expect(storageService.default.set).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled(); // :832 no-pay + :921 return before :941 — buff never stacks on recast
    expect(addEntry).not.toHaveBeenCalled();
    expect(__mem.get('spell_slots_level_6')).toBe(1); // banked lv6 slot survives the free recast
  });

  it('T6: exceptions table — Summon Aberration (:669 name guard) and War God\'s Blessing casts (:910-913 !isWgbSpell guard) never break an existing concentration yet still pay their slot (:985 payment-authority default-deny face)', async () => {
    const rows = [
      { spell: DISK.aberration, arm: 'Summon Aberration name guard', seed: 1 },
      { spell: DISK.sof, arm: 'WGB active flag guard', seed: 2 },
    ];
    for (const row of rows) {
      resetLane();
      if (row.spell === DISK.sof) __mem.set('_War_Gods_Blessing_active', true); // oracle gate #9 would ALLOW — prepare never recomputes it (:985)
      __mem.set(`spell_slots_level_${row.spell.level}`, row.seed);
      const cs = csOf(casterRow({ concentration: { spell: DISK.hex.name, dc: 15 } }));
      getCombatSummary.mockReturnValue(cs);

      const result = await cast(row.spell, wizardStats({ slots: { [`spell_slots_level_${row.spell.level}`]: row.seed } }));

      expect(result.metaCtx.oldConcentrationSpell).toBeNull();
      expect(result.metaCtx.shouldSetConcentration).toBe(false);
      expect(breakConcentration).not.toHaveBeenCalled();
      expect(addConcentration).not.toHaveBeenCalled();
      expect(cleanupConcentrationEffects).not.toHaveBeenCalled();
      expect(storageService.default.set).not.toHaveBeenCalled();
      expect(result.freeCastUsed).toBe(false); // armed oracle state in the store is NOT authoritative unless the caller passes freeCastAuthorized
      expect(result.slotConsumed).toBe(true); // the exception skips concentration handling, not payment
      expect(setRuntimeValue.mock.calls).toEqual([[CASTER, `spell_slots_level_${row.spell.level}`, row.seed - 1, CAMPAIGN]]);
    }
  });
});

describe('prepareSpellCast — CLA-398/SP-068 Hunter\'s Mark re-mark', () => {
  beforeEach(resetLane);

  it('T7: post-kill recast MOVES the mark to the re-armed target — no break, no purge, addConcentration once, exact-of-1 log row (full-set + opaque timestamp), zero activeBuffs writes (:805 dedup guard)', async () => {
    __mem.set('spell_slots_level_1', 2);
    __mem.set('activeBuffs', [{ name: DISK.hm.name, effect: 'hunters_mark_concentration', duration: 'concentration' }]);
    const cs = csOf(
      casterRow({ concentration: { spell: DISK.hm.name, dc: 17, target: 'Zombie 1' }, targetName: 'Bandit 1' }),
      { name: 'Zombie 1', currentHp: 0 },
      { name: 'Bandit 1', currentHp: 11 },
    );
    getCombatSummary.mockReturnValue(cs);

    const result = await cast(DISK.hm, wizardStats({ slots: { spell_slots_level_1: 2 } }));

    expect(result.metaCtx.shouldSetConcentration).toBe(true);
    expect(result.metaCtx.oldConcentrationSpell).toBeNull(); // null = the mark MOVES without a concentration break
    expect(breakConcentration).not.toHaveBeenCalled();
    expect(cleanupConcentrationEffects).not.toHaveBeenCalled();
    expect(addConcentration).toHaveBeenCalledTimes(1);
    expect(addConcentration).toHaveBeenCalledWith(cs, CASTER, DISK.hm.name, 17, 'Bandit 1');
    expect(storageService.default.set).toHaveBeenCalledTimes(1);

    expect(addEntry).toHaveBeenCalledTimes(1);
    const [logCampaign, logRow] = addEntry.mock.calls[0];
    expect(logCampaign).toBe(CAMPAIGN);
    const { timestamp, ...row } = logRow;
    expect(typeof timestamp).toBe('number'); // opaque seam byte — no clock semantics
    expect(row).toStrictEqual({
      type: 'automation',
      automationType: 'hunters_mark_remarked',
      characterName: CASTER,
      spellName: DISK.hm.name,
      targetName: 'Bandit 1',
      description: `Concentration moved — ${DISK.hm.name} re-marked on Bandit 1.`,
    });

    // exact-of-1 write ledger: only the lv1 slot pay lands; the tracked buff row survives un-stacked.
    expect(setRuntimeValue.mock.calls).toEqual([[CASTER, 'spell_slots_level_1', 1, CAMPAIGN]]);
    expect(__mem.get('activeBuffs')).toHaveLength(1);
  });

  it('T8: isConcentrationTargetDepleted table (:656-661, one arm per row) — absent target and currentHitPoints:0 MOVE the mark; living target and null tracked target are inert; every row is zero-write', async () => {
    const rows = [
      { label: 'tracked target absent from summary', concentration: { spell: DISK.hm.name, dc: 17, target: 'Goblin 9' }, extra: null, moved: true },
      { label: 'currentHitPoints fallback byte 0', concentration: { spell: DISK.hm.name, dc: 17, target: 'Zombie 1' }, extra: { name: 'Zombie 1', currentHitPoints: 0 }, moved: true },
      { label: 'target alive (currentHp 8) — recast inert', concentration: { spell: DISK.hm.name, dc: 17, target: 'Zombie 1' }, extra: { name: 'Zombie 1', currentHp: 8 }, moved: false },
      { label: 'null tracked target is never depleted (armed targetName alone does not move)', concentration: { spell: DISK.hm.name, dc: 17, target: null }, extra: { name: 'Bandit 1', currentHp: 11 }, moved: false },
    ];
    for (const row of rows) {
      resetLane();
      // banked-0 + pre-tracked buff: EVERY row must be zero-write; verdicts are service-call ledgers only.
      __mem.set('spell_slots_level_1', 0);
      __mem.set('activeBuffs', [{ name: DISK.hm.name, effect: 'hunters_mark_concentration', duration: 'concentration' }]);
      const cs = csOf(
        casterRow({ concentration: row.concentration, targetName: 'Bandit 1' }),
        ...(row.extra ? [row.extra] : []),
      );
      getCombatSummary.mockReturnValue(cs);

      const result = await cast(DISK.hm, wizardStats({ slots: { spell_slots_level_1: 0 } }));

      expect(result.slotConsumed, row.label).toBe(false); // banked 0 honored (payment-gate home #1517, incidental census)
      expect(setRuntimeValue, row.label).not.toHaveBeenCalled();
      expect(breakConcentration, row.label).not.toHaveBeenCalled();
      expect(cleanupConcentrationEffects, row.label).not.toHaveBeenCalled();
      expect(result.metaCtx.oldConcentrationSpell, row.label).toBeNull();
      expect(result.metaCtx.shouldSetConcentration, row.label).toBe(row.moved);
      if (row.moved) {
        expect(addConcentration).toHaveBeenCalledTimes(1);
        expect(addConcentration).toHaveBeenCalledWith(cs, CASTER, DISK.hm.name, 17, 'Bandit 1');
        expect(storageService.default.set).toHaveBeenCalledTimes(1);
        expect(storageService.default.set).toHaveBeenCalledWith('combatSummary', cs, CAMPAIGN);
        expect(addEntry).toHaveBeenCalledTimes(1);
        expect(addEntry.mock.calls[0][1].targetName).toBe('Bandit 1');
      } else {
        expect(addConcentration).not.toHaveBeenCalled();
        expect(storageService.default.set).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
      }
    }
  });
});
