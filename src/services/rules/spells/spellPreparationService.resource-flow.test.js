// @maintained-by-ai
// RESOURCE-FLOW lane — generic slot/SP payment ledger of spellPreparationService.prepareSpellCast.
//
// Lane split vs the 8 maintained siblings (headers+test names read from disk 2026-10-21):
//   cla130 latch-auth/consume #1510 · cla138 fey #1511 · increment rollback-producer #1512
//   oracle isFreeCastAuthorized truth-table #1513 · modifications 7-transforms #1514
//   arcanum keys #1515 · quickRitual FT-068 #1516 · base (.test.js cantrips/concentration/
//   buffs/CLA-398 re-mark) + uncovered.* (warlock substitution, WGB cleanup, decrement
//   internals). Residuals UNIQUE to this lane, owned here:
//     (1) consumeBaseSlot :765-789 / consumeUpcastSlot :718-726 payment ladder
//         (stored-number pay, stored-0 deny, real-store-null fallback-to-max, deny zero-writes);
//     (2) falsy-upcastLevel pays BASE (:966 ternary false-arm -> :834 `effectiveSpellLevel
//         !== spell.level` gate false -> base branch) — payment-side; byte-side is mods T3;
//     (3) Psionic Sorcery SP ledger :698-716 incl. CLA-271 exact-of-1-write no-double-charge
//         (git c4b9e8a17) and cost-at-effective-level ladder (:701 `currentSP - effectiveSpellLevel`);
//     (4) payment-vs-free generic exclusivity (:834/:851 `!isFreeCast`/free-branch-first gates);
//     (5) SP-005 envelope carry :1016-1017 (metaCtx.slotConsumed/freeCastUsed full-set,
//         both directions) on non-feature spells;
//     (6) #1516 campaign-arity hazard pin (see below) — this file is its pinned home.
//
// #1516 VERBATIM: 'spellPreparationService.js:767 and :720-721 consumeBaseSlot/consumeUpcastSlot
// read slots via getRuntimeValue(playerName, slotKey) without campaignName (writes do pass it).
// Cross-campaign read hazard; OWNED BY RESOURCE-FLOW LANE — reported, not pinned here' —
// NOW PINNED HERE, NOT FIXED. Runtime census (test 5): EVERY read targeting a payment key
// (^spell_slots_level_N|sorceryPoints) arrives arity-2 ([player,key]); EVERY write to the same
// keys arrives arity-4 ([player,key,value,campaign]). Honest witness note: the REAL
// useRuntimeState.js:63 getRuntimeValue declares only (characterKey, propertyName) and its
// missing byte is null (:74) — so today the arity gap is cosmetic (a 3-arg read at :863 lands
// in the same campaign-agnostic per-character Map), but the shape asymmetry read2-vs-write4 is
// the reported hazard; a store-side fix flips these tuples and MUST update this pin deliberately.
// Arity census quantified: payment keys 3 reads @len2 / 3 writes @len4; full-run read arity
// histogram {2:6, 3:3} (the three len-3 reads are all :863 '_Ritual_Master_quickRitualUsed' —
// the read-side is itself asymmetric within the service). Pre-existing pattern form (#1512/#1513).
//
// Disk rows (readFileSync, drift-throw — fabrication-ban): fixture spells ARE the real rows.
//   5e spells.json Fireball lv3 concentration:false ritual:false casting_time '1 action';
//   2024 spells.json Fireball lv3, casting_time 'Action' (both rulesets pay identically — row
//   twin proves it); Arms of Hadar 2024-only lv1 (census: ABSENT from 5e spells.json — if it
//   appears, re-verify), concentration:false, V/S, Instantaneous, Conjuration.
//   Psionic source: 2024 classes.json Sorcerer majors[0] 'Aberrant Sorcery' feature
//   'Psionic Sorcery' lv6 automation {type:'psionic_sorcery', psionic_spells:[11 spells incl.
//   Arms of Hadar, excl. Fireball discriminative]}. The runtime passive below mirrors the REAL
//   builder automationInfoBuilder/psionic.js:17-23 output byte-shape. metamagicRules stays REAL
//   (canned-mock-hollowing ban #1491: psionic verdicts here are computed by the real
//   isPsionicSpell/hasPsionicSorcery over the disk-derived list, not canned).
//   Slot keys spell_slots_level_N are builder bytes spellCalc.js:114 / spellCalc2024.js:90
//   (#1362 never-retype); 'sorceryPoints' trackedResources.js:7/:120, written by
//   ShortRestModal.jsx:67 / useMetamagic.js:10, read here :699. metaCtx input {} is a real
//   caller byte (MassSuggestionModal.jsx:20, useCustomHandlers.js:21).
//
// Fixtures: lightweight-by-design caster stats (#1472 lineage) — only the spellAbilities MAX
// face (:768/:721 fallback reads) and automation skeleton (actions/bonusActions/specialActions/
// passives) the payment lane touches; toHit/saveDc untouched by this lane, omitted.
// Campaign locked 'test-campaign' (fixed the old 'camp' bytes — same catch as #1514).
//
// Quirk scan verdicts:
//   unguarded-deref: 0 in lane — spellAbilities `&&`-guarded (:721/:768), availableSlots
//     `!= null` ternary (:722/:769), SP `Number(... ?? 0)` (:699); console.error spy 0 calls,
//     every row.
//   vacuous self-compute ternary: 0 — :966 both arms live (U-falsy rows hit spell.level arm,
//     U-pay rows hit upcastLevel arm); :722/:769 both arms live (pay vs fallback rows).
//   silent-undefined ?.: :862 automation?.ritualSpells, :880-881 passives?.some, :897 — every
//     row ships defined arrays; no ?. ever short-circuits to undefined here.
//   :0-swallow: gates `availableSlots <= 0` honor stored 0 (B-zero/U-zero deny rows; kills the
//     `|| maxSlots` mutant); SP strict `<` boundary paid by exact-cost row (writes byte 0).
//   'null + N': 0 — no + accumulator in the payment span; decrements are `- 1` (:701/:724/:785)
//     guarded by the null ternaries/Number() above. The + accumulator lives next door in the
//     increment sibling lane (#1512).
//   dead twins: :834 upcast-gate vs :851 base-gate — both arms exercised (U-* vs B-* rows);
//     base/upcast fallback ternary twins both arms exercised. Warlock ladder :771-783, WGB
//     :830-831, Eyebite :832, quick :836-839, adept :844-850 owned by named siblings (census
//     in the split above) — never exercised here, zero fabricated writes toward them pinned by
//     exact-of-N write censuses.
//   case trails: 'spell_slots_level_N' and 'sorceryPoints' byte-identical builder/producer/
//     consumer (grep of the cited lines; no 'Slot'/'SP' variants in lane).
//   NO-CLOCK: zero timers; the only Date.now() is the opaque :713 log timestamp (typeof pin).
//     Seam persistence: payment writes land in the store synchronously per call; a second cast
//     against the SAME store reads the written byte (exact-cost row sequel). 'test-campaign'
//     lockdown on every tuple.
//   Purity: input spell + playerStats JSON-snapshot equality, every row (:949/:997 spread-copy).
//
// Kill-matrix (declared analytic, #1515 form — every mutant named, killed by a row label):
//   :769/:722 `!= null` -> truthy        | B-zero & U-zero (stored 0 would fall back & pay)
//   :769/:722 `!= null` -> `!== undefined` | B-null/U-null (real store hands back null; would deny)
//   :787/:723 `<= 0` -> `< 0`            | B-zero & U-zero (would pay at -1)
//   :785 base key -> upcast key         | U-pay (writes lv5 exact-of-1; lv3 census dark)
//   :834 drop `effectiveSpellLevel !== spell.level` | U-falsy-undefined/0/null (would pay lv5)
//   :834 drop `!isFreeCast`             | X-free-upcast (would pay lv5; expect zero writes)
//   :851 drop `!_psionicUsed`          | PS-pay/PS-upcast/PS-exact (CLA-271 double-charge —
//                                       |   exact-of-1 sorceryPoints write census kills it)
//   :700 `<` -> `<=`                    | PS-exact (cost==balance would refuse)
//   :701 spell.level -> effective swap | PS-upcast (would pay 1 not 3)
//   :966 ternary drop                   | U-falsy rows (key would become spell_slots_level_undefined)
//   :986 drop `!isFreeCast`            | PS-free (would write SP)
//   :986 drop `usePsionicPayment`      | PS-optout (would read+write SP)
//   :840 free branch removed           | free-generic (would pay slot)
//   branch order :851 before :840      | free-generic + X-free-upcast (would pay slot)
//   :1016-1017 envelope drop           | full metaCtx toStrictEqual on EVERY row
//
// Mock census (exact-of-7 direct import boundaries of spellPreparationService.js):
//   MOCKED 5: useRuntimeState (mem-backed, real missing-byte null :74), combatData,
//   concentrationService, storage, logService(addEntry->Promise). REAL 2: metamagicRules
//   (verdicts must be real — psionic lane owns them), castingTimeUtils (never called on these
//   rows; absence pinned by console-clean + dark-censuses). Dead-module mocks 0; barrel keys 0
//   (all vi.mock targets are direct paths of the unit under test); the unit under test is
//   NEVER mocked.
//
// PRESERVED-CITED-BY: NONE inbound — grep -rln 'resource-flow' across src/ shows no other file
// cites this path (verified 2026-10-21). Old 11 tests folded 1:1+ into the rows below; no
// cross-file removals executed.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ── Disk rows: REAL bytes, drift-throw at load (#1509-#1516 streak form) ──
const spells5e = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/spells.json'), 'utf8'));
const spells2024 = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/2024/spells.json'), 'utf8'));
const classes2024 = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/2024/classes.json'), 'utf8'));

const diskFB5e = spells5e.find(s => s.name === 'Fireball');
const diskFB24 = spells2024.find(s => s.name === 'Fireball');
const diskAoH24 = spells2024.find(s => s.name === 'Arms of Hadar');
if (!diskFB5e || !diskFB24 || !diskAoH24 || spells5e.some(s => s.name === 'Arms of Hadar')) {
  throw new Error('resource-flow-lane disk drift: Fireball missing from a ruleset, or Arms of Hadar appeared in 5e spells.json (2024-only here) — re-verify the fixture');
}
for (const [row, label, expectBytes] of [
  [diskFB5e, '5e Fireball', { level: 3, concentration: false, ritual: false, casting_time: '1 action', components: ['V', 'S', 'M'], school: 'Evocation' }],
  [diskFB24, '2024 Fireball', { level: 3, concentration: false, ritual: false, casting_time: 'Action', components: ['V', 'S', 'M'], school: 'Evocation' }],
  [diskAoH24, '2024 Arms of Hadar', { level: 1, concentration: false, ritual: false, casting_time: 'Action', components: ['V', 'S'], duration: 'Instantaneous', school: 'Conjuration' }],
]) {
  for (const [k, v] of Object.entries(expectBytes)) {
    if (JSON.stringify(row[k]) !== JSON.stringify(v)) {
      throw new Error(`resource-flow-lane disk drift: ${label}.${k} changed (${JSON.stringify(row[k])} !== ${JSON.stringify(v)}) — re-read the row and update this lane`);
    }
  }
}
const psionicFeature = classes2024.find(c => c.name === 'Sorcerer')
  ?.majors?.find(m => m.name === 'Aberrant Sorcery')
  ?.features?.find(f => f.name === 'Psionic Sorcery');
const PSIONIC_LIST = ['Arms of Hadar', 'Calm Emotions', 'Detect Thoughts', 'Dissonant Whispers', 'Mind Sliver',
  'Hunger of Hadar', 'Sending', "Evard's Black Tentacles", 'Summon Aberration', "Rary's Telepathic Bond", 'Telekinesis'];
if (!psionicFeature || psionicFeature.level !== 6
  || psionicFeature.automation?.type !== 'psionic_sorcery'
  || JSON.stringify(psionicFeature.automation.psionic_spells) !== JSON.stringify(PSIONIC_LIST)) {
  throw new Error('resource-flow-lane disk drift: 2024 Sorcerer Aberrant "Psionic Sorcery" lv6 automation row changed — re-read classes.json and update the passive + discriminance census');
}

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => {
  // Campaign-agnostic per-character Maps — the REAL store shape (useRuntimeState.js:72-75):
  // getRuntimeValue is declared arity-2 and its missing byte is NULL, not undefined.
  const stores = new Map();
  const storeFor = (characterKey) => {
    if (!stores.has(characterKey)) stores.set(characterKey, new Map());
    return stores.get(characterKey);
  };
  const setRuntimeValue = vi.fn((characterKey, propertyName, value) => { storeFor(characterKey).set(propertyName, value); });
  const getRuntimeValue = vi.fn((characterKey, propertyName) => {
    const store = stores.get(characterKey);
    return store && store.has(propertyName) ? store.get(propertyName) : null;
  });
  const clearRuntimeState = vi.fn(() => stores.clear());
  return { setRuntimeValue, getRuntimeValue, clearRuntimeState, __stores: stores };
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

import { prepareSpellCast } from './spellPreparationService.js';
import { getRuntimeValue, setRuntimeValue, __stores as stores } from '../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../../services/encounters/combatData.js';
import { breakConcentration, addConcentration, cleanupConcentrationEffects } from '../../../services/combat/concentration/concentrationService.js';
import { addEntry } from '../../../services/ui/logService.js';

const CAMPAIGN = 'test-campaign';
const WIZARD = 'Bryn';     // 5e wizard — generic slot payment face
const SORCERER = 'Elowen'; // 2024 Aberrant Mind — SP payment face

const seed = (name, pairs) => Object.entries(pairs).forEach(([k, v]) => {
  if (!stores.has(name)) stores.set(name, new Map());
  stores.get(name).set(k, v);
});

// spellAbilities carries ONLY the max face consumeBaseSlot:768 / consumeUpcastSlot:721 read.
function casterStats(name, { rules, cls, ability, passives = [], max = {} }) {
  return {
    name,
    rules,
    class: { name: cls },
    abilities: [{ name: ability, bonus: 3 }],
    proficiency: 2,
    spellAbilities: { spellCastingAbility: ability, ...max },
    automation: { actions: [], bonusActions: [], specialActions: [], passives },
  };
}
const wizardMax = { spell_slots_level_3: 4 };
// Passive = automationInfoBuilder/psionic.js:17-23 coercion of the disk feature above.
const psionicSorceryPassive = {
  type: 'psionic_sorcery',
  name: psionicFeature.name,
  psionicSpells: psionicFeature.automation.psionic_spells,
  hasAutomation: true,
};

function cast(spell, stats, options = {}) {
  return prepareSpellCast(spell, {}, {
    playerName: stats.name,
    playerStats: stats,
    campaignName: CAMPAIGN,
    isUpcast: false,
    freeCastAuthorized: false,
    ...options,
  });
}

const payWrites = () => setRuntimeValue.mock.calls.filter(c => /^spell_slots_level_\d+$/.test(String(c[1])) || c[1] === 'sorceryPoints');

let errSpy;
beforeEach(() => {
  vi.clearAllMocks();
  stores.clear();
  errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('prepareSpellCast — slot payment ledger (consumeBaseSlot/consumeUpcastSlot ladder)', () => {
  // pays = the exact [key, afterValue] the ledger must write once; null = zero writes (deny).
  it.each([
    { label: 'B-pay-5e: stored 3 of max 4 pays 2 (golden write tuple arity-4)', spell: diskFB5e, bank: { spell_slots_level_3: 3 }, opts: {}, pays: ['spell_slots_level_3', 2] },
    { label: 'B-pay-2024: the twin disk row pays identically (dual-ruleset byte)', spell: diskFB24, bank: { spell_slots_level_3: 3 }, opts: {}, pays: ['spell_slots_level_3', 2] },
    { label: 'B-zero: stored 0 is HONORED, not fallback-triggered (max 4 present -> deny, zero writes)', spell: diskFB5e, bank: { spell_slots_level_3: 0 }, opts: {}, pays: null },
    { label: 'B-null: real-store missing byte is null (:74) -> fallback max 4 pays 3', spell: diskFB5e, bank: {}, opts: {}, pays: ['spell_slots_level_3', 3] },
    { label: 'B-never: no store byte AND no max face -> 0 -> deny, zero writes', spell: diskFB5e, max: {}, bank: {}, opts: {}, pays: null },
    { label: 'U-pay: upcast lv5 pays spell_slots_level_5 2->1, lv3 dark', spell: diskFB5e, bank: { spell_slots_level_5: 2 }, opts: { isUpcast: true, upcastLevel: 5 }, pays: ['spell_slots_level_5', 1] },
    { label: 'U-zero: lv5 stored 0 -> DENY, never downgrades to the live lv3 slot', spell: diskFB5e, bank: { spell_slots_level_5: 0, spell_slots_level_3: 3 }, opts: { isUpcast: true, upcastLevel: 5 }, pays: null },
    { label: 'U-null: lv5 absent -> fallback max lv5 2 pays 1', spell: diskFB5e, max: { spell_slots_level_5: 2 }, bank: {}, opts: { isUpcast: true, upcastLevel: 5 }, pays: ['spell_slots_level_5', 1] },
    { label: 'U-falsy-undefined: isUpcast without upcastLevel pays BASE lv3 (:966 ternary false-arm)', spell: diskFB5e, bank: { spell_slots_level_3: 3, spell_slots_level_5: 2 }, opts: { isUpcast: true, upcastLevel: undefined }, pays: ['spell_slots_level_3', 2] },
    { label: 'U-falsy-zero: upcastLevel 0 falsy pays BASE lv3', spell: diskFB5e, bank: { spell_slots_level_3: 3, spell_slots_level_5: 2 }, opts: { isUpcast: true, upcastLevel: 0 }, pays: ['spell_slots_level_3', 2] },
    { label: 'U-falsy-null: upcastLevel null falsy pays BASE lv3 (falsy triple)', spell: diskFB5e, bank: { spell_slots_level_3: 3, spell_slots_level_5: 2 }, opts: { isUpcast: true, upcastLevel: null }, pays: ['spell_slots_level_3', 2] },
    { label: 'X-free-upcast: authorized free upcast rides no slot (:834 !isFreeCast gate)', spell: diskFB5e, bank: { spell_slots_level_5: 2 }, opts: { isUpcast: true, upcastLevel: 5, freeCastAuthorized: true }, pays: null, free: true },
  ])('$label', async ({ spell, bank, max = wizardMax, opts, pays, free = false }) => {
    const stats = casterStats(WIZARD, { rules: spell === diskFB24 ? '2024' : '5e', cls: 'Wizard', ability: 'Intelligence', max });
    seed(WIZARD, bank);
    const spellFrozen = JSON.stringify(spell);
    const statsFrozen = JSON.stringify(stats);

    const result = await cast(spell, stats, opts);

    expect(result.slotConsumed).toBe(pays !== null);
    expect(result.freeCastUsed).toBe(free);
    // SP-005 envelope (:1016-1017), full-set both directions, no fabricated keys.
    expect(result.metaCtx).toStrictEqual({
      oldConcentrationSpell: null,
      shouldSetConcentration: false,
      slotConsumed: pays !== null,
      freeCastUsed: free,
    });
    // Write ledger: exact-of-N over ALL runtime writes, campaign-locked, arity-4.
    expect(setRuntimeValue.mock.calls).toEqual(pays === null ? [] : [[WIZARD, pays[0], pays[1], CAMPAIGN]]);
    // Purity: neither input spell nor stats ever mutated.
    expect(JSON.stringify(spell)).toBe(spellFrozen);
    expect(JSON.stringify(stats)).toBe(statsFrozen);
    // Fireball is concentration:false + non-warlock on disk: concentration/warlock faces dark.
    expect(getCombatSummary).toHaveBeenCalledTimes(0);
    expect(breakConcentration).toHaveBeenCalledTimes(0);
    expect(addConcentration).toHaveBeenCalledTimes(0);
    expect(cleanupConcentrationEffects).toHaveBeenCalledTimes(0);
    expect(addEntry).toHaveBeenCalledTimes(0);
    expect(errSpy).toHaveBeenCalledTimes(0);
  });
});

describe('prepareSpellCast — generic free-path never touches spell slots', () => {
  it('authorized free cast with 3 slots banked: zero writes, zero slot reads, no log', async () => {
    const stats = casterStats(WIZARD, { rules: '5e', cls: 'Wizard', ability: 'Intelligence', max: wizardMax });
    seed(WIZARD, { spell_slots_level_3: 3 });
    const spellFrozen = JSON.stringify(diskFB5e);

    const result = await cast(diskFB5e, stats, { freeCastAuthorized: true });

    expect(result.freeCastUsed).toBe(true);
    expect(result.slotConsumed).toBe(false);
    expect(result.metaCtx).toStrictEqual({
      oldConcentrationSpell: null,
      shouldSetConcentration: false,
      slotConsumed: false,
      freeCastUsed: true,
    });
    // consumeFreeCast found no free resource row (empty actions) -> the whole lane is write-silent.
    expect(setRuntimeValue.mock.calls).toEqual([]);
    // The base-slot read NEVER happens — consumeBaseSlot is unreachable behind the free branch.
    expect(getRuntimeValue.mock.calls.filter(c => /^spell_slots_level_/.test(String(c[1])))).toEqual([]);
    expect(addEntry).toHaveBeenCalledTimes(0);
    expect(JSON.stringify(diskFB5e)).toBe(spellFrozen);
    expect(errSpy).toHaveBeenCalledTimes(0);
  });
});

describe('prepareSpellCast — Psionic Sorcery SP payment (REAL metamagicRules verdicts, CLA-271)', () => {
  it.each([
    { label: 'PS-pay: lv1 pays 1 SP of 5, exact-of-1 write, slot banked but untouched', sp: 5, opts: { usePsionicPayment: true }, level: 1, after: 4 },
    { label: 'PS-upcast: lv1 cast at lv3 costs 3 (:701 effective level, not spell.level)', sp: 5, opts: { usePsionicPayment: true, isUpcast: true, upcastLevel: 3 }, level: 3, after: 2 },
  ])('$label', async ({ sp, opts, level, after }) => {
    const stats = casterStats(SORCERER, { rules: '2024', cls: 'Sorcerer', ability: 'Charisma', passives: [psionicSorceryPassive], max: { spell_slots_level_1: 2, spell_slots_level_3: 4 } });
    seed(SORCERER, { sorceryPoints: sp, spell_slots_level_1: 2, spell_slots_level_3: 4 });
    const spellFrozen = JSON.stringify(diskAoH24);

    const result = await cast(diskAoH24, stats, opts);

    expect(result.slotConsumed).toBe(false);
    expect(result.freeCastUsed).toBe(false);
    expect(result.metaCtx).toStrictEqual({
      oldConcentrationSpell: null,
      shouldSetConcentration: false,
      psionicSorcery: 'sorceryPoints',
      psionicCost: level,
      _psionicUsed: true,
      slotConsumed: false,
      freeCastUsed: false,
    });
    // CLA-271 (git c4b9e8a17): exactly ONE write — the SP. The slot branch (:851) must stay shut.
    expect(setRuntimeValue.mock.calls).toEqual([[SORCERER, 'sorceryPoints', after, CAMPAIGN]]);
    expect(payWrites()).toHaveLength(1);
    // Payment-before-log ledger (:701 -> :705): a failed log can never hide a spent SP.
    expect(setRuntimeValue.mock.invocationCallOrder[0]).toBeLessThan(addEntry.mock.invocationCallOrder[0]);
    // Log: full entry, byte-exact note (:712), timestamp opaque (#1516 sentinel form).
    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, {
      type: 'psionic_sorcery',
      characterName: SORCERER,
      spellName: 'Arms of Hadar',
      spellLevel: level,
      sorceryPointsSpent: level,
      componentsWaived: ['V', 'S'],
      note: 'Cast without Verbal or Somatic components. No Material components unless consumed or have cost.',
      timestamp: expect.any(Number),
    });
    expect(Number.isInteger(addEntry.mock.calls[0][1].timestamp)).toBe(true);
    expect(JSON.stringify(diskAoH24)).toBe(spellFrozen);
    expect(errSpy).toHaveBeenCalledTimes(0);
  });

  it('PS-exact-cost: SP == cost is SUFFICIENT (strict <), pays to byte 0; the sequel cast reads the 0 and pays its slot', async () => {
    const stats = casterStats(SORCERER, { rules: '2024', cls: 'Sorcerer', ability: 'Charisma', passives: [psionicSorceryPassive], max: { spell_slots_level_1: 2 } });
    seed(SORCERER, { sorceryPoints: 1, spell_slots_level_1: 2 });

    const paid = await cast(diskAoH24, stats, { usePsionicPayment: true });
    expect(paid.slotConsumed).toBe(false);
    // Zero is a real stored byte, written verbatim (:701).
    expect(setRuntimeValue.mock.calls).toEqual([[SORCERER, 'sorceryPoints', 0, CAMPAIGN]]);

    // Seam: the sequel reads the store-written 0 (no fallback resurrection) -> SP refuses, slot pays.
    const sequel = await cast(diskAoH24, stats, { usePsionicPayment: true });
    expect(sequel.slotConsumed).toBe(true);
    expect(sequel.metaCtx._psionicUsed).toBeUndefined();
    expect(setRuntimeValue.mock.calls).toEqual([
      [SORCERER, 'sorceryPoints', 0, CAMPAIGN],
      [SORCERER, 'spell_slots_level_1', 1, CAMPAIGN],
    ]);
    expect(errSpy).toHaveBeenCalledTimes(0);
  });
});

describe('prepareSpellCast — Psionic payment refusals fall through to the slot lane', () => {
  it.each([
    { label: 'PS-insufficient-zero: stored 0 SP < cost 1 -> no SP write, slot pays 2->1', spSeed: { sorceryPoints: 0 }, opts: { usePsionicPayment: true }, readNever: false, pay: ['spell_slots_level_1', 2, 1] },
    { label: 'PS-absent: real-store null ?? 0 -> deny, slot pays (no resurrection of missing SP)', spSeed: {}, opts: { usePsionicPayment: true }, readNever: false, pay: ['spell_slots_level_1', 2, 1] },
    { label: 'PS-optout: fresh 5 SP but no usePsionicPayment flag -> sorceryPoints never READ (:986 && gate)', spSeed: { sorceryPoints: 5 }, opts: {}, readNever: true, pay: ['spell_slots_level_1', 2, 1] },
    { label: 'PS-offlist: Fireball is NOT on the disk psionic list — REAL predicate denies, SP never READ', spell: diskFB24, spSeed: { sorceryPoints: 5 }, opts: { usePsionicPayment: true }, readNever: true, pay: ['spell_slots_level_3', 4, 3] },
  ])('$label', async ({ spell = diskAoH24, spSeed, opts, readNever, pay }) => {
    const stats = casterStats(SORCERER, { rules: '2024', cls: 'Sorcerer', ability: 'Charisma', passives: [psionicSorceryPassive], max: { spell_slots_level_1: 2, spell_slots_level_3: 4 } });
    seed(SORCERER, { ...spSeed, [pay[0]]: pay[1] });

    const result = await cast(spell, stats, opts);

    expect(result.slotConsumed).toBe(true);
    expect(result.metaCtx).toStrictEqual({
      oldConcentrationSpell: null,
      shouldSetConcentration: false,
      slotConsumed: true,
      freeCastUsed: false,
    });
    // Full write ledger: the slot only — SP never written; no psionic_sorcery log.
    expect(setRuntimeValue.mock.calls).toEqual([[SORCERER, pay[0], pay[2], CAMPAIGN]]);
    expect(addEntry).toHaveBeenCalledTimes(0);
    if (readNever) {
      expect(getRuntimeValue.mock.calls.filter(c => c[1] === 'sorceryPoints')).toEqual([]);
    }
    expect(errSpy).toHaveBeenCalledTimes(0);
  });

  it('PS-free-exclusive: authorized free cast outranks SP payment — zero writes on every ledger', async () => {
    const stats = casterStats(SORCERER, { rules: '2024', cls: 'Sorcerer', ability: 'Charisma', passives: [psionicSorceryPassive], max: { spell_slots_level_1: 2 } });
    seed(SORCERER, { sorceryPoints: 5, spell_slots_level_1: 2 });

    const result = await cast(diskAoH24, stats, { usePsionicPayment: true, freeCastAuthorized: true });

    expect(result.freeCastUsed).toBe(true);
    expect(result.slotConsumed).toBe(false);
    expect(result.metaCtx).toStrictEqual({
      oldConcentrationSpell: null,
      shouldSetConcentration: false,
      slotConsumed: false,
      freeCastUsed: true,
    });
    expect(setRuntimeValue.mock.calls).toEqual([]);
    expect(getRuntimeValue.mock.calls.filter(c => c[1] === 'sorceryPoints')).toEqual([]);
    expect(addEntry).toHaveBeenCalledTimes(0);
    expect(errSpy).toHaveBeenCalledTimes(0);
  });
});

describe('prepareSpellCast — #1516 campaign-arity hazard pin (reads 2-arg vs writes 4-arg)', () => {
  it('census across base-pay + upcast-pay + SP-pay: every payment-key read is arity-2, every write arity-4; the only arity-3 reads are the quick-lane :863', async () => {
    const wiz = casterStats(WIZARD, { rules: '5e', cls: 'Wizard', ability: 'Intelligence', max: { ...wizardMax, spell_slots_level_5: 2 } });
    const sor = casterStats(SORCERER, { rules: '2024', cls: 'Sorcerer', ability: 'Charisma', passives: [psionicSorceryPassive], max: { spell_slots_level_1: 2 } });
    seed(WIZARD, { spell_slots_level_3: 3, spell_slots_level_5: 2 });
    seed(SORCERER, { sorceryPoints: 5, spell_slots_level_1: 2 });

    await cast(diskFB5e, wiz);
    await cast(diskFB5e, wiz, { isUpcast: true, upcastLevel: 5 });
    await cast(diskAoH24, sor, { usePsionicPayment: true });

    const isPayKey = (k) => /^spell_slots_level_\d+$/.test(String(k)) || k === 'sorceryPoints';
    // Hazard shape, byte-exactly: read tuples carry NO campaignName (len 2), write tuples do (len 4).
    const payReads = getRuntimeValue.mock.calls.filter(c => isPayKey(c[1]));
    expect(payReads).toEqual([
      [WIZARD, 'spell_slots_level_3'],
      [WIZARD, 'spell_slots_level_5'],
      [SORCERER, 'sorceryPoints'],
    ]);
    expect(payReads.map(r => r.length)).toEqual([2, 2, 2]);
    expect(setRuntimeValue.mock.calls).toEqual([
      [WIZARD, 'spell_slots_level_3', 2, CAMPAIGN],
      [WIZARD, 'spell_slots_level_5', 1, CAMPAIGN],
      [SORCERER, 'sorceryPoints', 4, CAMPAIGN],
    ]);
    expect(setRuntimeValue.mock.calls.map(w => [w.length, w[3]])).toEqual([[4, CAMPAIGN], [4, CAMPAIGN], [4, CAMPAIGN]]);
    // Full read-arity histogram of the three paid casts: 6 reads @len2 (3x WGB :911 + 3 payment),
    // 3 reads @len3 (all quick-lane :863 — the read-side asymmetry lives in the service itself).
    const histogram = getRuntimeValue.mock.calls.reduce((acc, c) => { acc[c.length] = (acc[c.length] || 0) + 1; return acc; }, {});
    expect(histogram).toEqual({ 2: 6, 3: 3 });
    expect(getRuntimeValue.mock.calls.filter(c => c.length === 3)).toEqual([
      [WIZARD, '_Ritual_Master_quickRitualUsed', CAMPAIGN],
      [WIZARD, '_Ritual_Master_quickRitualUsed', CAMPAIGN],
      [SORCERER, '_Ritual_Master_quickRitualUsed', CAMPAIGN],
    ]);
    expect(errSpy).toHaveBeenCalledTimes(0);
  });
});
