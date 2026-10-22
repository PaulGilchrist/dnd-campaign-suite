// @maintained-by-ai
// FT-068 Quick Ritual CONSUME face — spellPreparationService.prepareSpellCast.
//
// Ritual-family lane split (who owns what, verified against disk + service spans):
//   quickRitual (THIS lane)  FT-068 Ritual Master Quick Ritual — popup opt-in
//                            spell.quickRitual === true + producer stamp
//                            spell._ritualMasterRitual === true (spellCalc2024:477-496)
//                            + holder automation ritualSpells{chosenSpells,quickRitual}
//                            + fresh counter _Ritual_Master_quickRitualUsed == null
//                            + !isUpcast  ->  slotless cast, counter stamped Date.now(),
//                            ability_use log. Gate isQuickRitualGrant :861-865,
//                            consumeQuickRitual :729-739, payment branch :836-839.
//   ritualOnly sibling (.ritualOnly.test.js)         CLA-234 _ritualOnly Nature/Animal
//                            Speaker unlimited slotless rituals — folded there, not here.
//   ritualAdept sibling (.ritualAdept.test.js)       CLA-299 wizard spellbook rituals
//                            (auto face + popup ritualCast tick, metaCtx.ritualCastUsed)
//                            — folded there, not here.
//   popup face (SpellDetailPopup.quickRitual.test.jsx) checkbox UI, disabled-after-spend.
//   re-arm face (restRules-longRest.ritualMaster.test.js) long rest writes the NULL
//                            sentinel that this lane reads as "fresh" (restRules:698).
//   producer face (spellCalc2024-ritualMaster.test.js) _ritualMasterRitual stamping.
//
// Disk census (readFileSync, drift-throw — fixture bytes below ARE these bytes):
//   2024 feats.json 'Ritual Master': General Feat, prereq level 4, benefit automation
//     {type:'ritual_spells', effect:'ritual_spells', chosenSpells:true,
//      quickRitual:true, casting_time:'passive'};  5e feats.json: NO Ritual Master
//     (2024-only lane).  2024 spells.json: 31 ritual:true total, 11 level-1 rituals,
//     Identify = lv1 ritual, casting_time '1 minute or Ritual' (Quick Ritual casts at
//     that unchanged text — this lane performs ZERO casting_time transform; any
//     level/upcast modifiedSpell transform byte-diffs belong to modifications
//     sibling .modifications.test.js T3 :227).  Eldritch Blast ritual:false.
//
// Flag map (produced vs NOT produced by this lane — real names, never invented):
//   produces: '_Ritual_Master_quickRitualUsed' runtime write, metaCtx.quickRitualUsed,
//             result.freeCastUsed, result.metaCtx.{slotConsumed,freeCastUsed} envelope,
//             ability_use log 'Ritual Master (Quick Ritual)'.
//   never produces (absence pinned by toStrictEqual key-set): metaCtx.ritualCastUsed
//             (CLA-299), _ritualOnly (CLA-234), casting_time rewrite, baseLevel
//             (non-upcast rows — modifications lane).
//
// Quirk scan verdicts: unguarded-deref in lane 0 (automation?. guarded :862);
// vacuous self-compute / byte-identical ternary in lane 0 (no ternary in
// consumeQuickRitual/isQuickRitualGrant); case trails 0 (the key '_Ritual_Master_quickRitualUsed'
// is byte-identical across producer spellCalc2024:492 read-side :863 and re-armed
// restRules:698); NO-CLOCK: the Date.now() write (:730) is an opaque sentinel token —
// gate reads only == null, tests assert typeof number, never arithmetic;
// :0-swallow twin pinned live by the counter-0 row (== null treats 0 as SPENT, the
// free-cast coalesce trap #1510 form); falsy triples covered by rows: null/undefined
// fresh-allow, 0/false/deny.
// Invocation ledger: consumeQuickRitual writes the counter BEFORE logging (:730->:731)
// so a log failure can never re-free the cast — order pinned in the allow rows.
//
// Kill-matrix (declared analytic, #1515 form; every mutant is killed by a named row):
//   quickRitual === true -> truthy        | killed by row R-yes        ('yes' granted)
//   quickRitual === true -> != null       | killed by row R-false      (false granted)
//   used == null -> !used (falsy)         | killed by row R-counter0   (0 granted)
//   used == null -> === undefined         | killed by row A-null       (null refuses)
//   drop !isUpcast                        | killed by row R-upcast     (lv2 paid)
//   drop _ritualMasterRitual check       | killed by row R-noStamp    (paid)
//   drop chosenSpells conjunct          | killed by row R-notChosen    (paid)
//   drop quickRitualHold                | killed by row R-nonholder    (paid)
//   spent-counter gate inverted/dropped | killed by row R-spent        (paid)
//   consume branch :836 removed         | killed by every A-row        (paid, no latch)
//
// Mock census (exact-of-7 module boundaries of spellPreparationService.js, grep of its
// imports): useRuntimeState, combatData, concentrationService, storage, metamagicRules,
// logService, castingTimeUtils. Six mocked; castingTimeUtils stays REAL (never mocked —
// the quick lane must hand back the disk casting_time untouched, and a REAL normalize is
// the honest witness). metamagicRules canned-false keeps the psionic gate inert for
// this lane (no psionic feature in fixture — the false is shape, not verdict). The unit
// under test (spellPreparationService.js) is NEVER mocked. combatData/concentrationService/
// storage are exercised-zero here (Identify is concentration:false on disk) and pinned
// call-count 0 in the allow rows. No barrel keys, no dead-module mocks: every mock
// target is a direct import of the unit under test.
//
// PRESERVED-CITED-BY: restRules-longRest.ritualMaster.test.js:9 names this file as the
// consume-side owner (path citation, no line ranges) — still true: consumption is pinned
// in rows A-* below.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ── Disk rows: REAL bytes, drift-throw at load (#1509-#1515 streak form) ──
const feats2024 = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/2024/feats.json'), 'utf8'));
const diskFeat = feats2024.find(f => f.name === 'Ritual Master');
if (!diskFeat || diskFeat.type !== 'General Feat' || diskFeat.prerequisites?.level !== 4) {
  throw new Error('quickRitual-lane disk drift: 2024 feats.json Ritual Master header row changed — re-read the feat and update this lane');
}
const diskAuto = diskFeat.benefits?.find(b => b.type === 'spell')?.automation;
if (!diskAuto || diskAuto.type !== 'ritual_spells' || diskAuto.effect !== 'ritual_spells'
  || diskAuto.chosenSpells !== true || diskAuto.quickRitual !== true || diskAuto.casting_time !== 'passive') {
  throw new Error('quickRitual-lane disk drift: Ritual Master spell-benefit automation bytes changed — the runtime passive below mirrors passive.js:136-147 coercion, re-verify');
}
if (readFileSync(resolve(process.cwd(), 'public/data/feats.json'), 'utf8').includes('Ritual Master')) {
  throw new Error('quickRitual-lane census drift: Ritual Master appeared in 5e feats.json (FT-068 is a 2024-only feat) — re-verify lane split');
}
const spells2024 = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/2024/spells.json'), 'utf8'));
const diskIdentify = spells2024.find(s => s.name === 'Identify');
for (const [k, v] of Object.entries({
  level: 1, ritual: true, casting_time: '1 minute or Ritual', range: 'Touch',
  components: ['V', 'S', 'M'], concentration: false, duration: 'Instantaneous',
})) {
  if (JSON.stringify(diskIdentify?.[k]) !== JSON.stringify(v)) {
    throw new Error(`quickRitual-lane disk drift: 2024 spells.json 'Identify'.${k} changed (${JSON.stringify(diskIdentify?.[k])} !== ${JSON.stringify(v)}) — re-read the row and update this lane`);
  }
}
// Ritual-tag census: the feat picks level-1 Ritual-tagged spells; 31 rituals / 11 at
// lv1 on disk today, and a non-ritual blast row proves the census is discriminative.
if (spells2024.filter(s => s.ritual === true).length !== 31
  || spells2024.filter(s => s.level === 1 && s.ritual === true).length !== 11
  || spells2024.find(s => s.name === 'Eldritch Blast')?.ritual !== false) {
  throw new Error('quickRitual-lane census drift: 2024 spells.json ritual-flag census changed (31 total / 11 lv1, Eldritch Blast ritual:false) — re-verify the census pins');
}

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
  addEntry: vi.fn(() => Promise.resolve({})),
}));

vi.mock('./metamagicRules.js', () => ({
  isPsionicSpell: vi.fn(() => false),
  hasPsionicSorcery: vi.fn(() => false),
}));

import { prepareSpellCast } from './spellPreparationService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../../services/encounters/combatData.js';
import { breakConcentration, addConcentration, cleanupConcentrationEffects } from '../../../services/combat/concentration/concentrationService.js';
import { addEntry } from '../../../services/ui/logService.js';

const CAMPAIGN = 'test-campaign';
const HOLDER = 'Elowen';   // holder wizard
const NONHOLDER = 'Bryn';  // non-holder wizard (no Ritual Master feat)
const COUNTER = '_Ritual_Master_quickRitualUsed';

// automation.ritualSpells row = passive.js 'ritual_spells' builder output (:136-147):
// name from the feat benefit, casting_time 'passive', booleans !!-coerced,
// spellCastingAbility threaded by featBuffService from the feat ASI (inert here).
const ritualMasterPassive = {
  type: 'passive_rule',
  name: 'Ritual Spells',
  effect: 'ritual_spells',
  casting_time: 'passive',
  chosenSpells: true,
  quickRitual: true,
  spellCastingAbility: 'Intelligence',
  hasAutomation: true,
};

function wizardStats(name, { passive = ritualMasterPassive, slots = {} } = {}) {
  return {
    name,
    class: { name: 'Wizard' },
    level: 4,
    proficiency: 2,
    abilities: [{ name: 'Intelligence', bonus: 3 }],
    spellAbilities: {
      spellCastingAbility: 'Intelligence',
      saveDc: 13,
      spell_slots_level_1: 1,
      spell_slots_level_2: 1,
      ...slots,
    },
    automation: {
      actions: [], bonusActions: [], specialActions: [], passives: [],
      ritualSpells: passive ? [passive] : [],
    },
  };
}

// Spell = the REAL 2024 disk Identify row plus exactly the popup payload stamps the
// service reads (SpellDetailPopup.jsx:387 carries quickRitual/ritualCast booleans;
// spellCalc2024:492 stamps _ritualMasterRitual + prepared:'Always' on chosen rows).
function popupSpell(spellPatches = {}) {
  return {
    ...diskIdentify,
    prepared: 'Always',
    spellCastingAbility: 'Intelligence',
    _ritualMasterRitual: true,
    quickRitual: true,
    ritualCast: false,
    ...spellPatches,
  };
}

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

beforeEach(() => {
  vi.clearAllMocks();
  getRuntimeValue.mockReturnValue(undefined);
});

describe('FT-068 Quick Ritual — prepareSpellCast consume face', () => {
  // A-rows: all five grant conjuncts true -> slotless cast, counter written once with
  // the Date.now() sentinel (opaque token, no clock arithmetic), exact log, byte-pure
  // modifiedSpell. The counter's fresh sentinel arrives BOTH shapes the store can hand
  // back: undefined (never used) and null (long-rest re-arm, restRules:698).
  it.each([
    ['A-undefined (never used)', undefined],
    ['A-null (long-rest re-arm byte)', null],
  ])('%s: fresh counter arms the slotless quick ritual, consuming the latch once', async (_label, counterValue) => {
    const stats = wizardStats(HOLDER);
    const spell = popupSpell();
    const frozen = JSON.parse(JSON.stringify(spell)); // byte snapshot (no undefined-valued keys in this row)
    getRuntimeValue.mockImplementation((_name, key) =>
      key === COUNTER ? counterValue : undefined);

    const result = await cast(spell, stats);

    expect(result.freeCastUsed).toBe(true);
    expect(result.slotConsumed).toBe(false);
    expect(result.metaCtx).toStrictEqual({
      oldConcentrationSpell: null,
      shouldSetConcentration: false,
      quickRitualUsed: true,
      slotConsumed: false,
      freeCastUsed: true,
    });
    // Quick = regular casting time, disk text untouched, zero new stamps, fresh copy.
    expect(result.modifiedSpell).not.toBe(spell);
    expect(result.modifiedSpell).toStrictEqual(spell);
    expect(result.modifiedSpell.casting_time).toBe('1 minute or Ritual');
    expect(spell).toStrictEqual(frozen); // input immutability, every row
    // Store writes exact-of-1: the latch only — no slot spent even though slots exist.
    expect(setRuntimeValue.mock.calls).toEqual([[HOLDER, COUNTER, expect.any(Number), CAMPAIGN]]);
    expect(Number.isInteger(setRuntimeValue.mock.calls[0][2])).toBe(true);
    expect(getRuntimeValue).toHaveBeenCalledWith(HOLDER, COUNTER, CAMPAIGN);
    // Log exact-of-1, campaign-locked, note bytes verbatim from consumeQuickRitual:736.
    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, {
      type: 'ability_use',
      characterName: HOLDER,
      abilityName: 'Ritual Master (Quick Ritual)',
      spellName: 'Identify',
      note: 'Quick Ritual: cast Identify using its regular casting time — no spell slot consumed. You can\'t use Quick Ritual again until you finish a Long Rest.',
      timestamp: expect.any(Number),
    });
    // Ledger: counter write precedes the log (:730 -> :731).
    expect(setRuntimeValue.mock.invocationCallOrder[0])
      .toBeLessThan(addEntry.mock.invocationCallOrder[0]);
    // Identify is concentration:false on disk — the concentration face stays dark.
    expect(getCombatSummary).toHaveBeenCalledTimes(0);
    expect(breakConcentration).toHaveBeenCalledTimes(0);
    expect(addConcentration).toHaveBeenCalledTimes(0);
    expect(cleanupConcentrationEffects).toHaveBeenCalledTimes(0);
  });

  // R-rows: each row breaks exactly ONE grant conjunct (or one sentinel byte) — the
  // cast must fall through to normal slot payment, never touch the latch, and never
  // emit the Quick Ritual log. metaCtx full-set toStrictEqual doubles as the
  // quickRitualUsed ABSENCE pin (no fabricated key).
  it.each([
    { label: 'R-spent: counter holds a Date.now() token', seed: { [COUNTER]: 1730000000000 }, pay: ['spell_slots_level_1', 0] },
    { label: 'R-counter0: 0 is not null — == null reads SPENT (:0-swallow twin)', seed: { [COUNTER]: 0 }, pay: ['spell_slots_level_1', 0] },
    { label: 'R-false: checkbox unticked (popup always sends a boolean)', spell: { quickRitual: false }, seed: {}, pay: ['spell_slots_level_1', 0] },
    { label: 'R-missing: non-popup caller never sets quickRitual', spell: { quickRitual: undefined }, seed: {}, pay: ['spell_slots_level_1', 0] },
    { label: 'R-yes: truthy-but-not-true is refused by === true', spell: { quickRitual: 'yes' }, seed: {}, pay: ['spell_slots_level_1', 0] },
    { label: 'R-noStamp: quickRitual ticked without the _ritualMasterRitual producer stamp', spell: { _ritualMasterRitual: undefined }, seed: {}, pay: ['spell_slots_level_1', 0] },
    { label: 'R-notChosen: grant entry without chosenSpells is not the Ritual Master row', seed: {}, passive: { ...ritualMasterPassive, chosenSpells: false }, pay: ['spell_slots_level_1', 0] },
    { label: 'R-upcast: upcast rides no quick ritual — pays the higher slot', seed: {}, opts: { isUpcast: true, upcastLevel: 2 }, pay: ['spell_slots_level_2', 0] },
  ])('$label: refused — normal slot payment applies, latch untouched, no quick log', async ({ spell = {}, seed, passive, opts = {}, pay }) => {
    const stats = wizardStats(HOLDER, passive ? { passive } : {});
    getRuntimeValue.mockImplementation((_name, key) => seed[key]);

    const result = await cast(popupSpell(spell), stats, opts);

    expect(result.freeCastUsed).toBe(false);
    expect(result.slotConsumed).toBe(true);
    expect(result.metaCtx).toStrictEqual({
      oldConcentrationSpell: null,
      shouldSetConcentration: false,
      slotConsumed: true,
      freeCastUsed: false,
    });
    // Store writes exact-of-1: the slot only — the latch is never stamped.
    expect(setRuntimeValue.mock.calls).toEqual([[HOLDER, pay[0], pay[1], CAMPAIGN]]);
    expect(addEntry).toHaveBeenCalledTimes(0);
  });

  it('R-nonholder: Bryn (same spell bytes, no feat) pays her own slot — grant gate is stats-side', async () => {
    const stats = wizardStats(NONHOLDER, { passive: null });
    const result = await cast(popupSpell(), stats);

    expect(result.freeCastUsed).toBe(false);
    expect(result.slotConsumed).toBe(true);
    expect(setRuntimeValue.mock.calls).toEqual([[NONHOLDER, 'spell_slots_level_1', 0, CAMPAIGN]]);
    expect(addEntry).toHaveBeenCalledTimes(0);
  });

  it('the consume seam stays an arity-3 call: (spell, metaCtx, options)', () => {
    expect(prepareSpellCast.length).toBe(3);
  });
});
