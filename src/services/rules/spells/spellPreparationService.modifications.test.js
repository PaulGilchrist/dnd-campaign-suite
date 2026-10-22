// @maintained-by-ai
// spellPreparationService.modifications.test.js — the modifiedSpell TRANSFORM face:
// exactly what prepareSpellCast hands back to callers as "the spell to actually cast".
// Byte-fidelity lane: every row pins input-bytes -> output-bytes -> disk-authority.
//
// Transform table (spellPreparationService.js prepareSpellCast, real spans):
//   :949/:997-999  envelope/upcast swap   {...spell} | {...spell, level, baseLevel}
//   :960-964       cantrip short-circuit {...spell, baseLevel:0} + EARLY return
//   :1004-1008     CLA-138 drop           concentration:false, duration:'1 minute',
//                                          _noConcentrationChoice  -> owned by cla138 sibling, NOT here
//   :886-888       Psychic Spells stamp   +_psychicSpellsOverride:true
//   :890-892       Spell Breaker swap     casting_time '1 action'/'Action' -> '1 bonus action'
//   :812-825       Phantasmal stamp       school:'Illusion', +_phantasmalCreatures,
//                                          +_phantasmalHalvesHp (!! coercion), list append
//   :346-363       per-spell counter      _Phantasmal_Creatures_<Spell>_freeCastCount (1->0)
//
// Clone-vs-shared verdict (pinned live in T1): FRESH OUTER, SHARED INNER — the service
// builds a new object per cast ({ ...spell }) and never mutates the caller's input;
// nested values (damage{}) are carried by reference. Pass-through honesty: a no-modifier
// cast returns a COPY (not.toBe) with byte-identical keys (toStrictEqual), never the
// same object — #1479 freshness-vs-identity resolution.
//
// Internal flags this lane touches: _psychicSpellsOverride (add-only), _phantasmalCreatures,
// _phantasmalHalvesHp, baseLevel (level-swap provenance). Flags NOT produced here:
// _noConcentrationChoice (cla138), _ritualOnly (ritualOnly), _Faithful_Steed_freeCastCount
// (cla130), _deferChooserSlotPayment (chooser lanes) — absence of the cla138 stamp on the
// concentration-recast row is pinned below (#1511 quirk-cannot-leak-onto-paid form).
//
// extraOptions (#1509 cross-check): grep 'extraOptions' spellPreparationService.js -> 0 hits.
// VERDICT: this producer lane never consumes or stamps extraOptions; validation ignores it.
//
// Mock census (exact-of-7 module boundaries of the unit-under-test, grep of its imports):
// useRuntimeState, combatData, concentrationService, storage, metamagicRules, logService,
// castingTimeUtils. 6 mocked; castingTimeUtils stays REAL (its normalize gate is live on
// the Spell Breaker row — disk stores 2024 casting_time as 'Action'). storage/logService
// are mocked but unasserted here: they are required so the concentration-set and
// ritual-log paths never touch the DOM/log disk from this lane. The unit-under-test
// (spellPreparationService.js) is NEVER mocked. No transitive over-mocks.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ── Disk rows: REAL bytes, drift-throw at load (#1509-#1513 streak form) ──
const classes2024 = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/2024/classes.json'), 'utf8'));
const diskPsychic = classes2024.find(c => c.name === 'Warlock')
  ?.majors?.find(m => m.name === 'Great Old One Patron')?.features?.find(f => f.name === 'Psychic Spells');
if (!diskPsychic || diskPsychic.automation?.type !== 'psychic_spells' || diskPsychic.automation?.damageType !== 'Psychic') {
  throw new Error('modifications-lane disk drift: 2024 classes.json Warlock/Great Old One Psychic Spells row changed — re-read /majors/2/features/automation and update this lane');
}
const diskSpellBreaker = classes2024.find(c => c.name === 'Wizard')
  ?.majors?.find(m => m.name === 'Abjurer')?.features?.find(f => f.name === 'Spell Breaker');
if (!diskSpellBreaker || diskSpellBreaker.automation?.type !== 'passive_rule'
  || diskSpellBreaker.automation?.effect !== 'spell_breaker'
  || !diskSpellBreaker.automation?.bonusActionSpells?.includes('Dispel Magic')) {
  throw new Error('modifications-lane disk drift: 2024 classes.json Wizard/Abjurer Spell Breaker row changed — the runtime passive below mirrors automationCollector.js:51-59, re-verify both');
}
const diskPhantasmal = classes2024.find(c => c.name === 'Wizard')
  ?.majors?.find(m => m.name === 'Illusionist')?.features?.find(f => f.name === 'Phantasmal Creatures');
if (!diskPhantasmal || diskPhantasmal.automation?.type !== 'phantasmal_creatures'
  || JSON.stringify(diskPhantasmal.automation?.freeCastSpells) !== JSON.stringify(['Summon Beast', 'Summon Fey'])
  || diskPhantasmal.automation?.usesMax !== 1 || diskPhantasmal.automation?.recharge !== 'long_rest'
  || diskPhantasmal.automation?.halvesHp !== true) {
  throw new Error('modifications-lane disk drift: 2024 classes.json Wizard/Illusionist Phantasmal Creatures row changed — re-read the automation row and update this lane');
}
// 5e census: all three triggers are 2024-only feature rows (#1512 existence-census-first).
if (/psychic_spells|phantasmal_creatures|spell_breaker/.test(readFileSync(resolve(process.cwd(), 'public/data/classes.json'), 'utf8'))) {
  throw new Error('modifications-lane census drift: psychic_spells/phantasmal_creatures/spell_breaker appeared in 5e classes.json (2024-only triggers) — re-verify this lane');
}
const spells2024 = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/2024/spells.json'), 'utf8'));
const spells5e = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/spells.json'), 'utf8'));
function diskSpell(list, name, pins) {
  const row = list.find(s => s.name === name);
  for (const [k, v] of Object.entries(pins)) {
    if (JSON.stringify(row?.[k]) !== JSON.stringify(v)) {
      throw new Error(`modifications-lane disk drift: spells.json '${name}'.${k} changed (${JSON.stringify(row?.[k])} !== ${JSON.stringify(v)}) — re-read the row and update this lane`);
    }
  }
  return row;
}
const diskFireball = diskSpell(spells5e, 'Fireball', { level: 3, casting_time: '1 action', school: 'Evocation', concentration: false });
const diskEB = diskSpell(spells2024, 'Eldritch Blast', { level: 0, casting_time: 'Action', school: 'Evocation' }); // REAL cantrip level — #1510 :0-swallow face
const diskWhispers = diskSpell(spells2024, 'Dissonant Whispers', { level: 1, casting_time: 'Action', school: 'Enchantment', concentration: false });
const diskDispel = diskSpell(spells2024, 'Dispel Magic', { level: 3, casting_time: 'Action', school: 'Abjuration', concentration: false }); // lone-case trail: 2024 stores 'Action'
const diskBeast = diskSpell(spells2024, 'Summon Beast', { level: 2, casting_time: 'Action', school: 'Conjuration', concentration: true, duration: 'Concentration, up to 1 hour' });
const diskFey = diskSpell(spells2024, 'Summon Fey', { level: 4, casting_time: 'Action', school: 'Conjuration', concentration: true, duration: 'Concentration, up to 1 hour' });
const diskSpiritualWeapon = diskSpell(spells2024, 'Spiritual Weapon', { level: 2, casting_time: 'Bonus Action', school: 'Evocation', concentration: true });

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => {
  const mem = new Map();
  const ck = (name, key) => `${name}::${key}`; // player-scoped: faithful store shape (no cross-caster leaks)
  const setRuntimeValue = vi.fn((name, key, value) => { mem.set(ck(name, key), value); });
  const getRuntimeValue = vi.fn((name, key) => (mem.has(ck(name, key)) ? mem.get(ck(name, key)) : undefined));
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

vi.mock('./metamagicRules.js', () => ({
  isPsionicSpell: vi.fn(() => false),
  hasPsionicSorcery: vi.fn(() => false),
}));

import { prepareSpellCast } from './spellPreparationService.js';
import { setRuntimeValue, getRuntimeValue, __mem as mem } from '../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../../services/encounters/combatData.js';
import { breakConcentration, addConcentration, cleanupConcentrationEffects } from '../../../services/combat/concentration/concentrationService.js';
import { addEntry } from '../../../services/ui/logService.js';

const CAMPAIGN = 'test-campaign'; // lockdown canon: never a production campaign name
const WIZARD = 'TestWizard';
const WARLOCK = 'TestWarlock';
// REAL stamp bytes, never retyped by hand (grep of the producer):
const PHANTASMAL_LIST = '_phantasmalCreatures_list';
const PHANTASMAL_BEAST_COUNTER = '_Phantasmal_Creatures_Summon_Beast_freeCastCount';

// Disk-derived fixtures: JSON-clone per call so each cast sees fresh bytes (purity-checkable).
const freshSpell = disk => JSON.parse(JSON.stringify(disk));
// Player-scoped seeding helper mirroring the mock's store key shape `${name}::${key}`.
const seed = (who, key, val) => mem.set(`${who}::${key}`, val);
const psychPassive = () => JSON.parse(JSON.stringify(diskPsychic.automation));
const phantasmalPassive = () => JSON.parse(JSON.stringify(diskPhantasmal.automation));
// Spell Breaker runtime form = automationCollector.js:51-59 conversion of the disk row,
// mirrored exactly (disk 'passive_rule'+'effect' becomes the collector's typed passive).
const spellBreakerPassive = () => ({
  type: 'spell_breaker',
  name: diskSpellBreaker.name,
  spellLevel: diskSpellBreaker.automation.spellLevel || 1,
  alwaysPreparedSpells: diskSpellBreaker.automation.alwaysPreparedSpells || [],
  bonusActionSpells: diskSpellBreaker.automation.bonusActionSpells || [],
  dispelAbilityCheckBonus: diskSpellBreaker.automation.dispelAbilityCheckBonus || '',
  slotRetentionSpells: diskSpellBreaker.automation.slotRetentionSpells || [],
});
function makePlayerStats({ name = WIZARD, className = 'Wizard', passives = [] } = {}) {
  return {
    name,
    class: { name: className },
    abilities: [{ name: 'Intelligence', bonus: 5 }],
    proficiency: 4,
    spellAbilities: { spellCastingAbility: 'Intelligence', toHit: 9, saveDc: 17, modifier: 5 },
    automation: { actions: [], bonusActions: [], specialActions: [], passives },
    hitPoints: 100,
  };
}

// Kill matrix (ANALYTIC declaration — mutants enumerated, killed by live assertion rows;
// no git-checkout mutation runs were performed):
//  drop cantrip early return / stamp leaks onto cantrip            -> T2
//  remove baseLevel stamp (cantrip + upcast)                       -> T2, T3
//  widen psychic gate (drop class / opt-in / damage checks)        -> T4b, T4c, T2
//  retype _psychicSpellsOverride key                               -> T4a full-object toStrictEqual
//  drop normalizeCastingTime on Spell Breaker ('Action' miss)      -> T5a
//  widen Spell Breaker to any spell                               -> T5b
//  un-guard already-bonus casting_time (double-swap shape)          -> T5c idempotence + census
//  drop school swap / halvesHp !! coercion / stamp keys             -> T6a, T6b
//  mutate caller's spell in place instead of copy                   -> T1, T6 purity
//  invert Bestial/Fey ternary, drop copy-before-mutating, drop
//    campaignName on the list read (CLA-252), re-append duplicate   -> T7
//  mis-write counter byte, drop spent-0 guard, null-fresh coalesce,
//    falsify the log note                                           -> T8
//  same-name concentration recast wrongly breaks/sets               -> T9
//  _noConcentrationChoice leaks onto a paid recast                  -> T9 absence pin

describe('prepareSpellCast — modifiedSpell transform face (byte diffs, stamps, purity)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mem.clear();
    getCombatSummary.mockReturnValue(null);
  });

  it('T1: no modifier applies — fresh outer copy with shared inner bytes, zero fabricated stamps, golden no-automation cast', async () => {
    expect(prepareSpellCast.length).toBe(3); // arity vs REAL (spell, metaCtx, opts)
    const spell = freshSpell(diskFireball);
    const snapshot = JSON.parse(JSON.stringify(spell));
    seed(WIZARD, 'spell_slots_level_3', 3);
    const metaCtx = { slotLevel: 3 };

    const result = await prepareSpellCast(spell, metaCtx, { playerName: WIZARD, playerStats: makePlayerStats(), campaignName: CAMPAIGN });

    expect(result.modifiedSpell).toStrictEqual(snapshot);           // byte-faithful, stamped keys ONLY (none here)
    expect(result.modifiedSpell).not.toBe(spell);                   // fresh outer
    expect(result.modifiedSpell.damage).toBe(spell.damage);         // shared inner (clone-vs-mutate verdict)
    expect(spell).toStrictEqual(snapshot);                           // input purity
    expect(result.metaCtx).toStrictEqual({ slotLevel: 3, oldConcentrationSpell: null, shouldSetConcentration: false, slotConsumed: true, freeCastUsed: false });
    expect(setRuntimeValue.mock.calls).toEqual([[WIZARD, 'spell_slots_level_3', 2, CAMPAIGN]]); // full write census: slot pay only
    expect(getRuntimeValue).toHaveBeenCalledWith(WIZARD, '_War_Gods_Blessing_active'); // quirk: 2-arg read, campaignName NOT plumbed
    expect(addEntry).not.toHaveBeenCalled();

    // golden unguarded-deref row (#1360 form): automation absent entirely — plain copy, slotless refusal, no crash
    const bare = freshSpell(diskFireball);
    const r2 = await prepareSpellCast(bare, {}, { playerName: 'BareWizard', playerStats: { name: 'BareWizard', class: { name: 'Wizard' } }, campaignName: CAMPAIGN });
    expect(r2.modifiedSpell).toStrictEqual(bare);
    expect(r2.slotConsumed).toBe(false); // no spellAbilities, no store slots -> 0 available, honest false (no :0 swallow of the stamp: build still ships)
  });

  it('T2: cantrip short-circuit (:0-swallow) — {...spell, baseLevel:0} early return; psychic stamp NEVER reaches a level-0 cast', async () => {
    const spell = freshSpell(diskEB); // REAL disk level 0 — the old fixture's level:1 was fabricated
    const playerStats = makePlayerStats({ name: WARLOCK, className: 'Warlock', passives: [psychPassive()] });

    const result = await prepareSpellCast(spell, { slotLevel: 0 }, {
      playerName: WARLOCK, playerStats, campaignName: CAMPAIGN, usePsychicDamage: true,
    });

    expect(result.modifiedSpell).toStrictEqual({ ...spell, baseLevel: 0 }); // exact key-set: +baseLevel ONLY
    expect(result.metaCtx).toStrictEqual({ slotLevel: 0 });                   // early-return envelope: no shouldSetConcentration/slotConsumed/freeCastUsed keys
    expect(result.slotConsumed).toBe(false);
    expect(result.freeCastUsed).toBe(false);
    expect(setRuntimeValue).not.toHaveBeenCalled();                            // zero writes before the stamp lane is ever reached
  });

  it('T3: upcast level swap — level:5 + baseLevel:3 byte diff; falsy upcast edges ship byte-identical input', async () => {
    const spell = freshSpell(diskFireball);
    seed(WIZARD, 'spell_slots_level_5', 2);

    const up = await prepareSpellCast(spell, { slotLevel: 5 }, {
      playerName: WIZARD, playerStats: makePlayerStats(), campaignName: CAMPAIGN, isUpcast: true, upcastLevel: 5,
    });
    expect(up.modifiedSpell).toStrictEqual({ ...spell, level: 5, baseLevel: 3 }); // two-key diff, nothing else
    expect(setRuntimeValue.mock.calls).toEqual([[WIZARD, 'spell_slots_level_5', 1, CAMPAIGN]]); // pays at the CAST level

    // falsy triple on the `isUpcast && upcastLevel` guard: undefined and level-equal both NO-OP
    const noLevel = await prepareSpellCast(spell, { slotLevel: 3 }, {
      playerName: WIZARD, playerStats: makePlayerStats(), campaignName: CAMPAIGN, isUpcast: true,
    });
    expect(noLevel.modifiedSpell).toStrictEqual(spell);        // isUpcast:true yet no baseLevel — quantified guard quirk
    const sameLevel = await prepareSpellCast(spell, { slotLevel: 3 }, {
      playerName: WIZARD, playerStats: makePlayerStats(), campaignName: CAMPAIGN, isUpcast: true, upcastLevel: 3,
    });
    expect(sameLevel.modifiedSpell).toStrictEqual(spell);
    expect(spell).toStrictEqual(freshSpell(diskFireball));     // three casts, caller bytes untouched
  });

  it('T4: Psychic Spells stamp adds _psychicSpellsOverride ONLY; opt-out and non-Warlock deny', async () => {
    const spell = freshSpell(diskWhispers); // lv1 Enchantment, Psychic damage on disk — inside the passive's spellSchools
    const warlockStats = makePlayerStats({ name: WARLOCK, className: 'Warlock', passives: [psychPassive()] });
    seed(WARLOCK, 'spell_slots_level_1', 2);

    const on = await prepareSpellCast(spell, { slotLevel: 1 }, {
      playerName: WARLOCK, playerStats: warlockStats, campaignName: CAMPAIGN, usePsychicDamage: true,
    });
    expect(on.modifiedSpell).toStrictEqual({ ...spell, _psychicSpellsOverride: true }); // full byte-pin of the override set

    const off = await prepareSpellCast(spell, { slotLevel: 1 }, {
      playerName: WARLOCK, playerStats: warlockStats, campaignName: CAMPAIGN,
    });
    expect(off.modifiedSpell).toStrictEqual(spell); // opt-in gate: absent flag never stamps

    // class gate — synthetic combo (disk puts the passive on Warlock only) to isolate the Warlock check
    const wizardStats = makePlayerStats({ passives: [psychPassive()] });
    seed(WIZARD, 'spell_slots_level_1', 2);
    const wrongClass = await prepareSpellCast(spell, { slotLevel: 1 }, {
      playerName: WIZARD, playerStats: wizardStats, campaignName: CAMPAIGN, usePsychicDamage: true,
    });
    expect(wrongClass.modifiedSpell).toStrictEqual(spell);
    // producer-side finding: the disk passive is school-gated (enchantment/illusion) but this
    // stamp arm checks class+passive+damage+opt-in only — school is NOT enforced producer-side.
  });

  it('T5: Spell Breaker swaps Action Dispel Magic to 1 bonus action (case-normalized disk byte); off-spell deny; idempotent under re-transform', async () => {
    const passives = [spellBreakerPassive()];
    const dispel = freshSpell(diskDispel);

    const first = await prepareSpellCast(dispel, { slotLevel: 3 }, {
      playerName: WIZARD, playerStats: makePlayerStats({ passives }), campaignName: CAMPAIGN,
    });
    expect(first.modifiedSpell).toStrictEqual({ ...dispel, casting_time: '1 bonus action' }); // single-key diff; disk 'Action' normalized through REAL castingTimeUtils

    const fb = freshSpell(diskFireball);
    const fireball = await prepareSpellCast(fb, { slotLevel: 3 }, {
      playerName: WIZARD, playerStats: makePlayerStats({ passives }), campaignName: CAMPAIGN,
    });
    expect(fireball.modifiedSpell).toStrictEqual(fb); // name gate: nothing else swaps

    // idempotence: feeding the transformed spell back in must yield byte-identical output, no extra writes
    vi.clearAllMocks();
    seed(WIZARD, 'spell_slots_level_3', 3);
    const second = await prepareSpellCast(first.modifiedSpell, { slotLevel: 3 }, {
      playerName: WIZARD, playerStats: makePlayerStats({ passives }), campaignName: CAMPAIGN,
    });
    expect(second.modifiedSpell).toStrictEqual(first.modifiedSpell); // transform twice === transform once
    expect(second.modifiedSpell.casting_time).toBe('1 bonus action');
    expect(dispel).toStrictEqual(freshSpell(diskDispel)); // input never mutated
  });

  it('T6: Phantasmal free cast stamps school + flags with pure bytes; halvesHp is !!-coerced, never omitted', async () => {
    const spell = freshSpell(diskBeast);
    const snapshot = JSON.parse(JSON.stringify(spell));
    seed(WIZARD, PHANTASMAL_BEAST_COUNTER, 0); // pre-spent: keeps the ledger silent for this byte row

    const result = await prepareSpellCast(spell, { slotLevel: 2 }, {
      playerName: WIZARD, playerStats: makePlayerStats({ passives: [phantasmalPassive()] }), campaignName: CAMPAIGN, freeCastAuthorized: true,
    });
    expect(result.modifiedSpell).toStrictEqual({ ...snapshot, school: 'Illusion', _phantasmalCreatures: true, _phantasmalHalvesHp: true }); // 3-key diff: Conjuration -> Illusion + 2 stamps
    expect(result.modifiedSpell.duration).toBe('Concentration, up to 1 hour'); // duration text is carried, never arithmetic-on-text
    expect(spell).toStrictEqual(snapshot); // input purity: the stamp mutates the copy only
    expect(setRuntimeValue.mock.calls.every(c => !String(c[1]).startsWith('spell_slots_'))).toBe(true); // free lane pays nothing

    // halvesHp falsy arm: !!coerces to FALSE (key present) — never undefined
    const lenient = JSON.parse(JSON.stringify(diskPhantasmal.automation));
    lenient.halvesHp = false;
    const r2 = await prepareSpellCast(spell, { slotLevel: 2 }, {
      playerName: WIZARD, playerStats: makePlayerStats({ passives: [lenient] }), campaignName: CAMPAIGN, freeCastAuthorized: true,
    });
    expect(r2.modifiedSpell._phantasmalHalvesHp).toBe(false);
    expect(r2.modifiedSpell._phantasmalCreatures).toBe(true);
    expect(r2.freeCastUsed).toBe(true);
  });

  it('T7: summoned-creature ledger — ternary both arms append exact bytes, campaign-scoped read, dedup arm never re-writes', async () => {
    // fresh store: Summon Beast -> Bestial Spirit (copy-append, new reference)
    seed(WIZARD, PHANTASMAL_BEAST_COUNTER, 0);
    await prepareSpellCast(freshSpell(diskBeast), { slotLevel: 2 }, {
      playerName: WIZARD, playerStats: makePlayerStats({ passives: [phantasmalPassive()] }), campaignName: CAMPAIGN, freeCastAuthorized: true,
    });
    expect(getRuntimeValue).toHaveBeenCalledWith(WIZARD, PHANTASMAL_LIST, CAMPAIGN); // CLA-252 campaign passthrough on the read
    expect(setRuntimeValue.mock.calls).toEqual([[WIZARD, PHANTASMAL_LIST, ['Bestial Spirit'], CAMPAIGN]]); // full-array byte, not arrayContaining

    // seeded store: Summon Fey appends onto a COPY — written array is a new ref, list grows to both spirits
    vi.clearAllMocks();
    const seeded = ['Bestial Spirit'];
    seed(WIZARD, PHANTASMAL_LIST, seeded);
    seed(WIZARD, '_Phantasmal_Creatures_Summon_Fey_freeCastCount', 0); // pre-spent: keeps the counter ledger silent for this list row
    await prepareSpellCast(freshSpell(diskFey), { slotLevel: 4 }, {
      playerName: WIZARD, playerStats: makePlayerStats({ passives: [phantasmalPassive()] }), campaignName: CAMPAIGN, freeCastAuthorized: true,
    });
    expect(setRuntimeValue.mock.calls).toEqual([[WIZARD, PHANTASMAL_LIST, ['Bestial Spirit', 'Fey Spirit'], CAMPAIGN]]);
    expect(setRuntimeValue.mock.calls[0][2]).not.toBe(seeded); // copy-before-mutating (store short-circuits identical refs)

    // dedup guard: already-listed creature writes NOTHING
    vi.clearAllMocks();
    await prepareSpellCast(freshSpell(diskBeast), { slotLevel: 2 }, {
      playerName: WIZARD, playerStats: makePlayerStats({ passives: [phantasmalPassive()] }), campaignName: CAMPAIGN, freeCastAuthorized: true,
    });
    expect(setRuntimeValue).not.toHaveBeenCalled();

    // membership gate: freeCastAuthorized:true but Fireball is not a freeCastSpell -> plain bytes.
    // QUANTIFIED QUIRK (producer-side, pinned live): the authorization PARAM is PAYMENT-authoritative —
    // an off-list 'authorized' cast pays NOTHING (no slot write) yet reports freeCastUsed:true.
    // Upstream (FREE_CAST_CHECKS) is the real membership gate; preparation trusts the caller's flag.
    vi.clearAllMocks();
    seed(WIZARD, 'spell_slots_level_3', 2);
    const plain = freshSpell(diskFireball);
    const paid = await prepareSpellCast(plain, { slotLevel: 3 }, {
      playerName: WIZARD, playerStats: makePlayerStats({ passives: [phantasmalPassive()] }), campaignName: CAMPAIGN, freeCastAuthorized: true,
    });
    expect(paid.modifiedSpell).toStrictEqual(plain); // school stays Evocation; no phantasmal keys (kills old 'non-summon' + 'does-not-mark' rows)
    expect(setRuntimeValue).not.toHaveBeenCalled(); // zero write census — slot AND counter both untouched
    expect(paid.slotConsumed).toBe(false);
    expect(paid.freeCastUsed).toBe(true);

    // unauthorized control: same caster/spell pays its slot, stamps nothing
    vi.clearAllMocks();
    const unpaid = await prepareSpellCast(plain, { slotLevel: 3 }, {
      playerName: WIZARD, playerStats: makePlayerStats({ passives: [phantasmalPassive()] }), campaignName: CAMPAIGN, freeCastAuthorized: false,
    });
    expect(unpaid.modifiedSpell).toStrictEqual(plain);
    expect(setRuntimeValue.mock.calls).toEqual([[WIZARD, 'spell_slots_level_3', 1, CAMPAIGN]]); // pays its slot, touches no feature key
    expect(unpaid.slotConsumed).toBe(true);
    expect(unpaid.freeCastUsed).toBe(false);
  });

  it('T8: per-spell free-cast counter consumes 1->fresh with the exact log note; spent-0 guard stays silent; null is the same fresh byte', async () => {
    const stats = makePlayerStats({ passives: [phantasmalPassive()] });
    seed(WIZARD, PHANTASMAL_LIST, ['Bestial Spirit']); // keep list ledger silent (dedup arm)
    // absent counter: stored undefined -> count = usesMax(1) from the disk passive -> writes 0
    const result = await prepareSpellCast(freshSpell(diskBeast), { slotLevel: 2 }, {
      playerName: WIZARD, playerStats: stats, campaignName: CAMPAIGN, freeCastAuthorized: true,
    });
    expect(result.freeCastUsed).toBe(true);
    expect(result.metaCtx.freeCastUsed).toBe(true);
    expect(setRuntimeValue.mock.calls).toEqual([[WIZARD, PHANTASMAL_BEAST_COUNTER, 0, CAMPAIGN]]); // full census: counter only, no slot write
    const [logCampaign, entry] = addEntry.mock.calls[0];
    expect(logCampaign).toBe(CAMPAIGN);
    const { timestamp, ...rest } = entry;
    expect(Number.isInteger(timestamp) && timestamp > 0).toBe(true);
    expect(rest).toStrictEqual({
      type: 'ability_use',
      characterName: WIZARD,
      abilityName: 'Phantasmal Creatures', // disk passive has no .name -> PER_SPELL_CAST_GRANTS fallback byte (identical to the feature name)
      spellName: 'Summon Beast',
      note: 'Phantasmal Creatures free cast of Summon Beast — spectral, half HP, no spell slot consumed. 0 free casts of Summon Beast remaining until your next Long Rest.', // plural at 0: remaining === 1 ? '' : 's'
    });

    // spent arm: stored 0 -> count <= 0 early return: zero writes, zero logs
    vi.clearAllMocks();
    seed(WIZARD, PHANTASMAL_BEAST_COUNTER, 0);
    const spent = await prepareSpellCast(freshSpell(diskBeast), { slotLevel: 2 }, {
      playerName: WIZARD, playerStats: stats, campaignName: CAMPAIGN, freeCastAuthorized: true,
    });
    expect(spent.freeCastUsed).toBe(true); // caller gate stays authoritative for the cast itself
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();

    // null is the same fresh byte as absent (stored != null coalesce, #1512 form)
    vi.clearAllMocks();
    seed(WIZARD, PHANTASMAL_BEAST_COUNTER, null);
    await prepareSpellCast(freshSpell(diskBeast), { slotLevel: 2 }, {
      playerName: WIZARD, playerStats: stats, campaignName: CAMPAIGN, freeCastAuthorized: true,
    });
    expect(setRuntimeValue.mock.calls).toEqual([[WIZARD, PHANTASMAL_BEAST_COUNTER, 0, CAMPAIGN]]);
  });

  it('T9: same-name concentration recast is inert — no break, no set, byte-pure spell, no cla138 stamp leak onto the paid cast', async () => {
    const cs = { creatures: [{ name: WIZARD, concentration: { spell: 'Spiritual Weapon', dc: 10 } }] };
    getCombatSummary.mockReturnValue(cs);
    seed(WIZARD, 'spell_slots_level_2', 1);
    const spell = freshSpell(diskSpiritualWeapon);

    const result = await prepareSpellCast(spell, { slotLevel: 2 }, {
      playerName: WIZARD, playerStats: makePlayerStats(), campaignName: CAMPAIGN,
    });

    expect(breakConcentration).not.toHaveBeenCalled();
    expect(addConcentration).not.toHaveBeenCalled();
    expect(cleanupConcentrationEffects).not.toHaveBeenCalled();
    expect(result.metaCtx).toStrictEqual({ slotLevel: 2, oldConcentrationSpell: null, shouldSetConcentration: false, slotConsumed: true, freeCastUsed: false });
    expect(result.modifiedSpell).toStrictEqual(spell);  // recast pays: concentration/duration bytes untouched
    expect(result.modifiedSpell).not.toBe(spell);       // and still ships a fresh copy
    expect('_noConcentrationChoice' in result.modifiedSpell).toBe(false); // cla138 quirk cannot leak onto a paid cast
  });
});
