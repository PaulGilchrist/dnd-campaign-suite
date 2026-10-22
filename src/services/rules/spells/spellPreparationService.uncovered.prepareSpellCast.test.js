// @maintained-by-ai
// ---------------------------------------------------------------------------
// uncovered.prepareSpellCast.test.js — the CONSUME side of
// spellPreparationService.prepareSpellCast: post-authorization decrement
// internals + cleanupBuffsByName + the warlock substitution ladder, none of
// it pinned elsewhere in the family. Ownership ratified by the base MASTER
// table (spellPreparationService.test.js:45-46): 'WGB Spiritual Weapon
// cleanupBuffsByName :830/:628-639, decrement internals, uses_expression/
// perSpell/type-filter loop arms -> uncovered.*'. Loop-vs-gate boundary
// (#1526 L1-L6): the AUTHORIZE scan (isFreeCastAuthorized gates) lives in
// uncovered.isFreeCastAuthorized.test.js — THIS lane runs the post-auth
// consumption phase only: freeCastAuthorized rides in as caller-supplied
// truth (:985 payment-authority, #1514 cite, never recomputed here) and the
// pins are invocationCallOrder authorize-read -> consume-write ledgers
// (#1513/#1526 form).
//
// INBOUND CLAIM DISPOSITION (all three claims consumed, verified against
// live source 2026-10-21):
//   (1) #1526 ':207-twin' — the legacy :207 row (WGB Spiritual Weapon
//     cleanupBuffsByName) STAYS here (consume internals are this lane);
//     strengthened W1: multi-creature filter bytes, no-match creature
//     write-dark (:635 length guard), exact-of-2 write ledger. Its exact
//     sibling function is concentrationService.cleanupBuffsByName (that
//     module owns its copy — cited, not touched). Legacy 'camp' sweep:
//     grep -c "'camp'" was ALREADY 0 at audit time — every tuple was
//     'test-campaign'; the fabrication half of the sweep RAN: the four
//     invented feature names ('Level Feature'/'Spell Feature'/'PerSpell
//     Feature'/'Recharge Feature') retired to REAL disk rows — Magic
//     Initiate 'Level 1 Spell' (feats.json verbatim + the two documented
//     cla229 derived bytes, #1520 derived-only form, mirroring the
//     uncovered.increment sibling :25-27) and the REAL runtime-freeze row
//     public/campaigns/test-campaign/HexWarlock.json computedStats.
//     specialActions 'Level 1 Spell [Instance 1]' consumed VERBATIM — plus
//     disk Favored Enemy (classes2024), disk WGB, disk spells everywhere
//     (drift-throw at import, fifty-nine-streak fabrication ban honored).
//   (2) #1526 correction, recorded here per instruction: the CROSS-FILE
//     DEDUP MAP at incrementFreeCastResource.test.js:64 claiming
//     'consume-side per-spell rows -> uncovered.isFreeCastAuthorized.test
//     .js' is STALE — consume-side per-spell rows verifiably live in THIS
//     lane and shadowTouched.test.js (FT-070 consume: 'Shadow Magic free
//     cast ... exact-of-2 latch writes' — pinned THERE on real disk bytes,
//     cited, never re-grown; adjustPerSpellCounter :421-432 consume face
//     belongs to shadowTouched). This lane therefore does NOT re-pin
//     perSpellTracking automation-action consumes; it pins the SHARED
//     counter, recharge, case-trail filter, special-flag and guard arms
//     that shadowTouched's row shape cannot reach.
//   (3) #1524 :491-496 quirk RESIDENCE verdict — READ live source 2026-10-21,
//     FIXED #1527 2026-10-22: consumeSpecialFreeCastFlags read
//     '_Favored_Enemy_freeCastCount' and wrote favoredEnemyUses THE COUNT IT JUST
//     READ (no minus one) — a vacuous self-copy byte, pinned honestly here as Q1
//     until the fix landed. The consumed quirk's pin is OWNED here — FLIPPED to
//     the decrement-lands ledger (Q1): armed latch 2 stamps byte 1, store-bytes
//     MOVING off the read-count; plus the #1348 decrement table Q1b (3->2,
//     1->lawful-spent-0 fix#90, 0->LOUD refuse exact-of-1 console, zero writes,
//     negative impossible). Latch read-exactly-twice, latch write-exactly-ZERO
//     (#1512 different-keys restore law preserved, cited), read-precedes-write
//     invocationCallOrder, plus the REAL disk row that keeps the loop arm inert
//     (Favored Enemy carries uses_expression WITHOUT usesMax -> gate :448 FALSE
//     arm -> the special-flag arm is the only writer).
//     Same-family cousin found + pinned honestly: the Signature arm :512-
//     515 has NO used==null gate — a second free cast RE-STAMPS
//     SignatureSpells_<Spell>_used true (X1 sequel ledger).
//   (4) #1515 fold-note verdict — the legacy :506 arcanum-decrement row
//     FOLDED into #1515 C1 (mysticArcanum.test.js :147-186 consume census):
//     READ both arms — consume arcanum arm (:553-561: membership + lv6-9
//     gate + ?? 1 auto-arm + count>0 drain) is observably IDENTICAL to
//     what C1 already pins byte-exactly with full write census (row
//     [Eyebite,6,{l6:1,l7:1}] -> [[l6,0]]) and the ??1/count>0 deny
//     halves. Nothing remains distinct — row DELETED, cited only.
//
// CONSUME-ARM LEDGER (every arm of the post-auth consumption phase -> row):
//   consumeBaseSlot warlock arm :771-783 + getWarlockSlotLevel ladder
//     :641-652 (resource-flow :70 cedes these arms to uncovered.*) ... VA1/VA2/VA3
//   cleanupBuffsByName :628-638 (arity-3 buff reads, filter, length-guard
//     no-write) via :830 ..................................................... W1/W2
//   adjustSharedUsesCounter consume: level-match break :410-414, spent-0
//     null no-write :379, mismatch 'next' :416 ......................... D1/D2/D3
//   adjustActionFreeCastCounters type-filter :447 (case-exact) + break
//     order :450-457 ......................................................... D1/D3
//   adjustRechargeCounter consume :434-440 ................................ D3
//   consumeSpecialFreeCastFlags :489-523 (favored decrement #1527, NR :497-501,
//     Bewitching name-gate :502-504, Signature :512-516, Savant :518-522) Q1/X1/X2
//   CLA-356 telekinetic skip guard :543-544 (consume half — authorize half
//     is oracle gate #2, cited) ............................................. TK1
//
// QUIRK SCANS (consume spans, quantified):
//   vacuous self-compute/write-back: the :491-496 re-stamp was OBSERVABLE byte
//     write-back pinned in Q1 (it became a visible setRuntimeValue call —
//     pinned, not deleted, same honesty as the #1524 :802 wasted-allocation
//     family but here the waste LANDS in the store) — FIXED #1527: the arm now
//     decrements (byte = latch-1, MOVES), spent-0 refuses loud (Q1/Q1b).
//     Signature used-flag re-stamp :512-515 — X1 sequel. Loop :543 guard short-circuits the
//     whole decrement phase — TK1 zero-write census.
//   golden guard rows (#1518 form): getCombatSummary-null on concentration
//     casts (:670/:630) — REAL off-table null, returns clean, pinned by
//     dark-census in Q1/X2; the anonymous-entry crash twin is the ORACLE's
//     golden row (#1513/:1518 verbatim form) — cited, never regrown.
//   :0-swallow quantified: stored 0 -> Number(0)>0 false -> READ-happens/
//     WRITE-silent (D2); string '0' would coalesce identically via
//     featureFreeCastCount :70 Number() — analytic-only, no fabricated
//     string byte.
//   silent-undefined ?.: :543 spellAbilities?.spells?.find short-circuits
//     to undefined on EVERY row except TK1 (store-faithful: wizard rows
//     ship no .spells array) — one branch, benign, census-covered.
//   'null + N': the + accumulator lives in the RESTORE sibling :578-580 —
//     home-cited #1512/#1525; this consume lane contains no + byte.
//   store-faithful REAL-null #1517: mem mock missing byte = null (exactly
//     what real useRuntimeState.js:74 hands back); every != null / ?? gate
//     rides null, not undefined.
//   dead twins disk-vs-code census (BOTH directions #1524 map): code
//     name-gates in lane — 'Spiritual Weapon' :830 (disk 2024 lv2 row
//     live, census throw), 'Misty Step' :502 (disk lv2 live), arcanum
//     types (folded out, cite #1515); FREE_CAST_ENTRY_TYPES four-type
//     census + the six uses_expression-no-usesMax disk rows (Favored Enemy
//     among them) quantified by the uncovered.increment sibling :16-20 —
//     cited there, re-thrown locally only for the two rows consumed here.
//     Direction B: every consume arm in the ledger above has a row here.
//   case trails exact + #1526 contrast: 'Free_Spell' planted row skips the
//     :447 predicate PRE-counter-read (D3 planted-latch-dark); the
//     case-INSENSITIVE Aura-of-Vitality outlier is oracle :441 — cited.
//   chokepoint inline-dup const: FREE_CAST_ENTRY_TYPES is module-top once —
//     no inline duplicate literal in this lane's pins.
//   arity resource-flow-home: payment arity-2-read/4-write hazard pin is
//     resource-flow :427-428 (#1516) — cited; consume-side tuples below
//     record arity as-written (counter/favored/NR/bewitching/WGB reads
//     arity-2, buffs/sig/savant/per-spell reads arity-3 — literals :632/:512
//     pass campaign, :490/:497/:502 do NOT: the asymmetry is the service's,
//     pinned as-is).
//   NO-CLOCK consume-pure (declared): every consumed byte is an explicit
//     number/null/boolean; the lane mints NO Date.now() into the store on
//     any row (quickRitual's opaque stamp is FT-068's lane). addEntry is
//     ZERO-called on every row (logPerSpell belongs to the shadowTouched
//     face this lane cedes) — zero timestamps generated or compared here.
//   purity: spell + playerStats JSON-snapshot asserted on EVERY cast via
//     the cast() helper (:949/:997 spread-copy).
//
// KILL MATRIX (declared analytic, #1491 form — cp-live mutants, never git):
//   :773 drop ladder (return null always) ..... VA2 (substitution would deny)
//   :777 ternary flip ......................... VA2 (max 2 would pay 1->... store byte differs: writes would be lv3 1)
//   :778 `> 0` -> `>= 0` ..................... VA3 (would write lv_n -1)
//   :771 drop `isWarlock` .................... VA1 (double-pay: ladder would drain lv3 too — exact-of-1 census kills)
//   :649 ladder `available > 0` -> truthy ... VA3 ('0' string... stored numbers 0 -> mutant admits 0, pays 0->-1, write census kills)
//   :635 length-guard removal ................ W1 (unmatched creature writes — exact-of-2 kills)
//   :634 filter target-flip ................. W1 (buff names survive/erase — byte arrays kill)
//   :830 name arm (cast SoF instead) ........ W2 (cleanup would fire — activeBuffs-dark census kills)
//   :410 spellMatches flip ................. D1 vs D3 (grant/deny bytes: D3 no-write vs D1 write)
//   :379 count>0 -> count>=0 ............... D2 (would write -1 — exact-of-0 kills)
//   :450 break -> continue .................. D1 (trailing instance latch would drain: read+write census kills)
//   :451 next -> break ...................... D3 (instance recharge never reached — exact-of-1 kills)
//   :447 type-filter drop ................. D3 (case-trail planted latch 7->6 flips ledger)
//   :513 minus-drop (re-stamp read-count) ... Q1 (byte 2 vs landed byte 1 — THE #1527 pin, pre-fix flip)
//   :513 `> 0` -> `>= 0` ..................... Q1b latch-0 row (would write -1 — exact-of-0 + loud-refuse census kills)
//   :516 loud-refuse -> silent .......... Q1b (console-free spent-arm — refused-exactly-one pin kills)
//   null-guard drop ................. Q1 cast-3 (favoredEnemyUses 'null' byte would land)
//   :498 NR includes-flip ................. X1 (empty/null store would stamp)
//   :512 lv===3 gate drop .................. analytic: disk selections are lv3-only by feature law; no disk-honest lv!=3 selection exists to falsify — recorded, not fabricated.
//   :515 used-flag gate absent ............ X1 sequel (already the REAL byte — mutant adding a gate flips the sequel ledger)
//   :502 spellName gate drop .............. X2 cast-3 (Fireball would null the bewitching latch — exact-of-0 kills)
//   :544 skip-guard drop .................. TK1 (armed latches would drain — exact-of-0 kills)
//   no two rows share a verdict byte (#1348 mutually-distinguishable).
//
// MOCK CENSUS — exact-of-7 import boundaries of spellPreparationService.js
// (:1-:7): MOCKED 5 direct-path (useRuntimeState mem-backed, missing byte
// REAL-null #1517 — clearRuntimeState key DROPPED: dead-mock residue hunt,
// the unit imports only get/set; combatData; concentrationService; storage
// default.set; logService addEntry->Promise, immunizing every service
// `.catch` chain — grep-verified addEntry never invoked on THIS lane's
// consumed spans; logService known-dead family-wide x5). REAL 2:
// metamagicRules (canned-hollowing ban #1523/#1525 REAL-x2 precedent —
// psionic verdicts computed by REAL isPsionicSpell/hasPsionicSorcery over
// empty passives[], which the REAL module throws on if null: every fixture
// ships passives:[]) + castingTimeUtils (pure; spell-breaker face owned by
// modifications). The unit under test is NEVER mocked. No barrels.
// SECURITY NOTE (#1446 kiro-injection precedent): disk JSON scanned while
// deriving fixtures; nothing injection-shaped encountered; no disk string
// executed beyond JSON.parse. Campaign lockdown: 'test-campaign' is the ONLY
// campaign string in this file (grep 'camp' below the imports: zero hits —
// legacy byte already swept pre-audit, fabrication names swept in this one).
// PRESERVED-CITED-BY: base spellPreparationService.test.js:45-46 + :67-68
// cite this lane as home of cleanupBuffsByName/decrement internals AND of
// the :491-496 quirk — preserved by the rows above.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ---------------------------------------------------------------------------
// Disk law (drift-throw at import — fabrication-ban): every feature/spell
// byte below comes FROM disk or is a DOCUMENTED derived/planted defense byte.
// ---------------------------------------------------------------------------
const spells2024 = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/2024/spells.json'), 'utf8'));
const classes2024 = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/2024/classes.json'), 'utf8'));
const feats2024 = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/2024/feats.json'), 'utf8'));
const hexWarlock = JSON.parse(readFileSync(resolve(process.cwd(), 'public/campaigns/test-campaign/HexWarlock.json'), 'utf8'));

function diskRow(name) {
  const row = spells2024.find(s => s.name === name);
  if (!row) throw new Error(`uncovered.prepareSpellCast disk drift: '${name}' no longer exists in public/data/2024/spells.json`);
  return row;
}

const DISK = {
  spiritualWeapon: diskRow('Spiritual Weapon'),
  shieldOfFaith: diskRow('Shield of Faith'),
  huntersMark: diskRow("Hunter's Mark"),
  mistyStep: diskRow('Misty Step'),
  detectThoughts: diskRow('Detect Thoughts'),
  burningHands: diskRow('Burning Hands'),
  fireball: diskRow('Fireball'),
  telekinesis: diskRow('Telekinesis'),
  bless: diskRow('Bless'),
};

// [level, concentration] bytes this lane's behavior keys on (#1365 re-throw).
const DISK_BYTES = {
  'Spiritual Weapon': [2, true],
  'Shield of Faith': [1, true],
  "Hunter's Mark": [1, true],
  'Misty Step': [2, false],
  'Detect Thoughts': [2, true],
  'Burning Hands': [1, false],
  'Fireball': [3, false],
  'Telekinesis': [5, true],
  'Bless': [1, true],
};
for (const [name, [level, concentration]] of Object.entries(DISK_BYTES)) {
  const row = Object.values(DISK).find(s => s.name === name);
  if (row.level !== level || row.concentration !== concentration) {
    throw new Error(`uncovered.prepareSpellCast disk drift: '${name}' byte changed (${JSON.stringify({ level: row.level, concentration: row.concentration })} !== ${JSON.stringify([level, concentration])}) — re-read spells.json and update this lane`);
  }
}

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

// Magic Initiate (feats.json): verbatim disk automation {type:'free_spell',
// spell:'', uses:1, uses_expression:'1', recharge:'long_rest', action:'action'}.
const magicInitiateDisk = diskFeature(feats2024,
  (o, autos) => o.name === 'Level 1 Spell' && autos.some(a => a.type === 'free_spell' && a.spell === '' && a.uses === 1 && a.uses_expression === '1' && a.recharge === 'long_rest'),
  "Magic Initiate 'Level 1 Spell' uses_expression disk row");

// Favored Enemy (classes2024 Ranger): the disk row whose uses_expression text
// carries NO usesMax -> gate :448 FALSE arm -> loop consume inert; the
// :490-496 special-flag self-copy is the ONLY writer this cast performs.
diskFeature(classes2024,
  (o, autos) => o.name === 'Favored Enemy' && autos.some(a => a.type === 'free_spell' && a.spell === "Hunter's Mark" && a.uses_expression === 'favored_enemy_min_1' && a.uses === undefined && a.usesMax === undefined),
  'Ranger Favored Enemy uses_expression-no-usesMax disk row');

// War God's Blessing (classes2024 Cleric): REAL array-spell free_spell row.
const wgbDisk = diskFeature(classes2024,
  (o, autos) => autos.some(a => a.type === 'free_spell' && JSON.stringify(a.spell) === '["Shield of Faith","Spiritual Weapon"]'),
  'War Gods Blessing array-spell free_spell disk row');

// REAL runtime-freeze automation entry, consumed VERBATIM (not retyped):
// public/campaigns/test-campaign/HexWarlock.json computedStats.specialActions
// 'Level 1 Spell [Instance 1]' {spell:'Burning Hands', uses:1, recharge:'long_rest'}.
const instanceRow = (hexWarlock.computedStats?.specialActions || [])
  .map(e => e.automation)
  .find(a => a?.type === 'free_spell' && a.name === 'Level 1 Spell [Instance 1]' && a.spell === 'Burning Hands' && a.uses === 1 && a.recharge === 'long_rest');
if (!instanceRow) throw new Error('campaign-runtime drift: HexWarlock.json no longer freezes the Level 1 Spell [Instance 1] free_spell row — re-read before editing this lane');
if (wgbDisk.name !== "War God's Blessing") throw new Error('disk drift: WGB feature renamed — re-read classes2024');

// ---------------------------------------------------------------------------
// Mocks — exact-of-5-of-7 census (see header). Unit under test NEVER mocked.
// mem missing byte = null (REAL useRuntimeState.js:74, #1517 store-faithful).
// ---------------------------------------------------------------------------
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => {
  const mem = new Map();
  return {
    getRuntimeValue: vi.fn((name, key) => (mem.has(`${name}|${key}`) ? mem.get(`${name}|${key}`) : null)),
    setRuntimeValue: vi.fn((name, key, value) => { mem.set(`${name}|${key}`, value); }),
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

vi.mock('../../../services/ui/storage.js', () => ({ default: { set: vi.fn() } }));

vi.mock('../../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve({})) }));

import { prepareSpellCast } from './spellPreparationService.js';
import { getRuntimeValue, setRuntimeValue, __mem } from '../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../../services/encounters/combatData.js';
import { breakConcentration, addConcentration, cleanupConcentrationEffects } from '../../../services/combat/concentration/concentrationService.js';
import { addEntry } from '../../../services/ui/logService.js';

const CAMPAIGN = 'test-campaign';
const TW = 'TestWizard';
const WARLOCK = 'TestWarlock';

function wizardStats(overrides = {}) {
  return {
    name: TW,
    class: { name: 'Wizard' },
    abilities: [{ name: 'Intelligence', bonus: 5 }],
    proficiency: 4,
    hitPoints: 100,
    ...overrides,
    spellAbilities: { spellCastingAbility: 'Intelligence', toHit: 9, saveDc: 17, modifier: 5, ...(overrides.spellAbilities || {}) },
    automation: { actions: [], bonusActions: [], specialActions: [], passives: [], ...(overrides.automation || {}) },
  };
}

// Builder slot-max bytes spell_slots_level_N (spellCalc.js:114 shape, #1362).
function warlockStats(slots = {}) {
  return {
    name: WARLOCK,
    class: { name: 'Warlock' },
    abilities: [{ name: 'Charisma', bonus: 4 }],
    proficiency: 2,
    spellAbilities: { spellCastingAbility: 'Charisma', toHit: 6, saveDc: 14, modifier: 4, ...slots },
    automation: { actions: [], bonusActions: [], specialActions: [], passives: [] },
    hitPoints: 78,
  };
}

const seed = (obj, who = TW) => { for (const [k, v] of Object.entries(obj)) __mem.set(`${who}|${k}`, v); };
const readsOf = (key) => getRuntimeValue.mock.calls.filter(c => c[1] === key);
const slotReads = () => getRuntimeValue.mock.calls.filter(c => /^spell_slots_level_\d+$/.test(String(c[1]))).map(c => c[1]);
function freshStore(obj, who = TW) {
  vi.clearAllMocks();
  __mem.clear();
  seed(obj, who);
  getCombatSummary.mockReturnValue(null);
}

// Purity guard on BOTH inputs, every cast (service spreads copies :949/:997).
async function cast(spell, playerStats, options = {}) {
  const spellBefore = JSON.stringify(spell);
  const statsBefore = JSON.stringify(playerStats);
  const result = await prepareSpellCast(spell, {}, { playerName: playerStats.name, playerStats, campaignName: CAMPAIGN, ...options });
  expect(JSON.stringify(spell), 'input spell purity').toBe(spellBefore);
  expect(JSON.stringify(playerStats), 'playerStats purity').toBe(statsBefore);
  return result;
}

// ---------------------------------------------------------------------------
// WGB Spiritual Weapon cleanup — cleanupBuffsByName residence (#1526 :207
// twin KEPT + strengthened; name-map is the disk WGB row's own array bytes).
// ---------------------------------------------------------------------------

describe('prepareSpellCast — WGB Spiritual Weapon cleanupBuffsByName :628-638/:830 (home lane)', () => {
  it('W1: clears Shield of Faith by NAME across creatures — matched creatures get exact-of-2 filtered writes (arity-4), unmatched creature write-dark (:635), no slot paid, concentration services dark under the base-owned :910-913 WGB guard', async () => {
    freshStore({ _War_Gods_Blessing_active: true });
    seed({ activeBuffs: [{ name: DISK.shieldOfFaith.name }, { name: DISK.bless.name }] });
    seed({ activeBuffs: [{ name: DISK.shieldOfFaith.name }] }, 'Rival');
    seed({ activeBuffs: [{ name: DISK.bless.name }] }, 'Bystander');
    getCombatSummary.mockReturnValue({
      creatures: [
        { name: TW, concentration: null },
        { name: 'Rival', concentration: null },
        { name: 'Bystander', concentration: null },
      ],
    });

    const result = await cast(DISK.spiritualWeapon, wizardStats());

    expect(result.slotConsumed).toBe(false);
    expect(result.freeCastUsed).toBe(false);
    expect(setRuntimeValue.mock.calls).toEqual([
      [TW, 'activeBuffs', [{ name: DISK.bless.name }], CAMPAIGN],
      ['Rival', 'activeBuffs', [], CAMPAIGN],
    ]);
    // buff reads are the arity-3 tier the service writes (:632 passes campaign):
    expect(readsOf('activeBuffs')).toEqual([
      [TW, 'activeBuffs', CAMPAIGN],
      ['Rival', 'activeBuffs', CAMPAIGN],
      ['Bystander', 'activeBuffs', CAMPAIGN],
    ]);
    expect(slotReads()).toEqual([]);
    expect(breakConcentration).not.toHaveBeenCalled();
    expect(addConcentration).not.toHaveBeenCalled();
    expect(cleanupConcentrationEffects).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
    expect(result.metaCtx).toStrictEqual({ oldConcentrationSpell: null, shouldSetConcentration: false, slotConsumed: false, freeCastUsed: false }); // SP-005 carry (census home resource-flow)
  });

  it('W2: WGB-armed Shield of Faith cast runs the :830 name-arm FALSE half — zero activeBuffs writes anywhere, pays its lv1 base slot exact-of-1', async () => {
    freshStore({ _War_Gods_Blessing_active: true, spell_slots_level_1: 1 });
    seed({ activeBuffs: [{ name: DISK.shieldOfFaith.name }] });
    getCombatSummary.mockReturnValue({ creatures: [{ name: TW, concentration: null }] });

    const result = await cast(DISK.shieldOfFaith, wizardStats());

    expect(result.slotConsumed).toBe(true);
    expect(setRuntimeValue.mock.calls).toEqual([[TW, 'spell_slots_level_1', 0, CAMPAIGN]]);
    expect(readsOf('activeBuffs')).toEqual([]);
    expect(addConcentration).not.toHaveBeenCalled(); // WGB concentration-guard cede cited in W1
    expect(addEntry).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Warlock substitution ladder — consumeBaseSlot :771-783 + getWarlockSlot
// Level :641-652, ceded to uncovered.* by resource-flow :70/:8.
// ---------------------------------------------------------------------------

describe('prepareSpellCast — Warlock substitution ladder :641-652/:771-783 (resource-flow-ceded arms)', () => {
  // lv2 cast rides disk-honest Misty Step (2024 lv2, concentration:false —
  // census throw at import; free of concentration side-channels on this ladder).
  it('VA1: matching-level slot available pays BASE — ladder never enters (:771 false arm), exact-of-1 spell_slots read', async () => {
    freshStore({ spell_slots_level_2: 1 }, WARLOCK);
    const result = await cast(DISK.mistyStep, warlockStats({ spell_slots_level_2: 2, spell_slots_level_3: 2 }));
    expect(result.slotConsumed).toBe(true);
    expect(result.freeCastUsed).toBe(false);
    expect(slotReads()).toEqual(['spell_slots_level_2']);
    expect(setRuntimeValue.mock.calls).toEqual([[WARLOCK, 'spell_slots_level_2', 0, CAMPAIGN]]);
  });

  it('VA2: base spent 0, ladder scans lv2->lv3 and pays lv3 — exact read order [lv2,lv2,lv3,lv3], exact-of-1 write lv3 1->0, lv2 never written', async () => {
    freshStore({ spell_slots_level_2: 0, spell_slots_level_3: 1 }, WARLOCK);
    const result = await cast(DISK.mistyStep, warlockStats({ spell_slots_level_2: 2, spell_slots_level_3: 2 }));
    expect(result.slotConsumed).toBe(true);
    expect(slotReads()).toEqual(['spell_slots_level_2', 'spell_slots_level_2', 'spell_slots_level_3', 'spell_slots_level_3']);
    expect(setRuntimeValue.mock.calls).toEqual([[WARLOCK, 'spell_slots_level_3', 0, CAMPAIGN]]);
  });

  it('VA3: every rung stored-0 or absent (REAL-null -> max-fallback 0) — ladder exhausts lv2..lv9, DENIES with zero writes (#1522 no phantom payment)', async () => {
    freshStore({ spell_slots_level_2: 0, spell_slots_level_3: 0 }, WARLOCK);
    const result = await cast(DISK.mistyStep, warlockStats({ spell_slots_level_2: 2, spell_slots_level_3: 2 }));
    expect(result.slotConsumed).toBe(false);
    expect(slotReads()).toEqual(['spell_slots_level_2', 'spell_slots_level_2', 'spell_slots_level_3', 'spell_slots_level_4', 'spell_slots_level_5', 'spell_slots_level_6', 'spell_slots_level_7', 'spell_slots_level_8', 'spell_slots_level_9']);
    expect(setRuntimeValue.mock.calls).toEqual([]);
    expect(result.metaCtx).toStrictEqual({ oldConcentrationSpell: null, shouldSetConcentration: false, slotConsumed: false, freeCastUsed: false });
  });
});

// ---------------------------------------------------------------------------
// Post-authorization consumption loop — adjustActionFreeCastCounters
// :445-459 (shared counter / recharge / type-filter / break-order arms).
// The authorize scan (L1-L6) is uncovered.isFreeCastAuthorized's (#1526).
// ---------------------------------------------------------------------------

describe('prepareSpellCast — consume loop arms :445-459 (post-auth, cla229-documented fixtures)', () => {
  // Magic Initiate disk row + the TWO documented derived bytes only
  // (#1520 derived-only, mirroring uncovered.increment :25-27):
  // spell:'' -> 'level 1' (the defensive parse shape, no disk row carries
  // /level \d+/ — census there), usesMax absent -> 2 (cla229 post-evaluate
  // shape, rules.cla229-usesMax.test.js:34). Builder merges the feature
  // name onto the automation entry (uncovered.increment :100 form) — the
  // latch-key source.
  const miEntry = { name: magicInitiateDisk.name, ...magicInitiateDisk.automation };
  const miLevel1 = { ...miEntry, spell: 'level 1', usesMax: 2 };
  const MI_LATCH = '_Level_1_Spell_freeCastCount';
  const INST_LATCH = '_Level_1_Spell_[Instance_1]_freeCastCount';

  it('D1: shared level-match consumes 2->1, break law holds (trailing verbatim HexWarlock latch read-dark :450), second cast reads the STORED byte 1->0 (store-faithful sequel, exact-of-2 ledger)', async () => {
    const stats = wizardStats({
      automation: { actions: [miLevel1, { ...instanceRow }], bonusActions: [], specialActions: [], passives: [] },
    });
    freshStore({ [MI_LATCH]: 2, [INST_LATCH]: 5 });

    const r1 = await cast(DISK.burningHands, stats, { freeCastAuthorized: true });
    const r2 = await cast(DISK.burningHands, stats, { freeCastAuthorized: true });

    expect([r1.freeCastUsed, r1.slotConsumed, r2.freeCastUsed, r2.slotConsumed]).toEqual([true, false, true, false]);
    expect(setRuntimeValue.mock.calls).toEqual([
      [TW, MI_LATCH, 1, CAMPAIGN],
      [TW, MI_LATCH, 0, CAMPAIGN],
    ]);
    expect(readsOf(INST_LATCH)).toEqual([]); // never reached — :450 break
    expect(addEntry).not.toHaveBeenCalled(); // per-spell log channel is shadowTouched's (#1526 correction, header)
    expect(r1.metaCtx.freeCastUsed).toBe(true); // :843 metaCtx stamp
    expect(r2.metaCtx.slotConsumed).toBe(false);
  });

  it('D2: spent-0 REFUSES WITH READ (#1515 distinction canon) — counter consulted, byte 0 honored (:379 null), exact-of-0 write ledger, freeCastUsed stays caller-truth', async () => {
    const stats = wizardStats({ automation: { actions: [miLevel1], bonusActions: [], specialActions: [], passives: [] } });
    freshStore({ [MI_LATCH]: 0 });

    const result = await cast(DISK.burningHands, stats, { freeCastAuthorized: true });

    expect(result.freeCastUsed).toBe(true); // :840/:842 — payment authority is caller-supplied (:985, #1514 cite)
    expect(readsOf(MI_LATCH)).toEqual([[TW, MI_LATCH]]); // arity-2 tier, READ happened
    expect(setRuntimeValue.mock.calls).toEqual([]);
    expect(__mem.get(`${TW}|${MI_LATCH}`)).toBe(0); // spent byte un-touched
  });

  it('D3: featureLevel-mismatch CONTINUES (:416/:451) past a planted case-trail type that the :447 case-EXACT filter admits NOTHING — the verbatim HexWarlock recharge row alone consumes 1->0', async () => {
    const mismatch = { ...miEntry, spell: 'level 2', usesMax: 2 };
    const plantedCase = { type: 'Free_Spell', name: 'Planted Case-Trail Bait', spell: DISK.burningHands.name, uses: 1, recharge: 'long_rest' };
    const stats = wizardStats({ automation: { actions: [mismatch, plantedCase, { ...instanceRow }], bonusActions: [], specialActions: [], passives: [] } });
    freshStore({ [MI_LATCH]: 5, _Planted_Case_Trail_Bait_freeCastCount: 7 });

    const result = await cast(DISK.burningHands, stats, { freeCastAuthorized: true });

    expect(result.freeCastUsed).toBe(true);
    expect(setRuntimeValue.mock.calls).toEqual([[TW, INST_LATCH, 0, CAMPAIGN]]); // exact-of-1
    expect(readsOf(MI_LATCH)).toEqual([]); // :451 continue — mismatched parsed level never touches the latch
    expect(readsOf('_Planted_Case_Trail_Bait_freeCastCount')).toEqual([]); // :447 case-exact filter, pre-loop skip
    expect(readsOf(INST_LATCH)).toEqual([[TW, INST_LATCH]]); // :437 arity-2, fresh ?? uses=1 -> consume to 0
  });
});

// ---------------------------------------------------------------------------
// consumeSpecialFreeCastFlags :489-523 — named-feature flag consumes,
// incl. the Favored Enemy consume leg (#1527 FIXED: decrement lands —
// formerly the :491-496 vacuous self-copy quirk, Q1-pinned honest pre-fix)
// and the Signature re-stamp cousin.
// ---------------------------------------------------------------------------

describe('prepareSpellCast — consumeSpecialFreeCastFlags :489-523 ledgers', () => {
  it('Q1 (#1527 FIXED, was the #1524 quirk home): Favored Enemy disk row consumed on a Hunter\'s Mark free cast — the consume-side DECREMENT LANDS: armed latch byte 2 stamps favoredEnemyUses 1 (pre-fix vacuous self-copy stamped the read-count 2 twice); two casts read the latch arity-2 exactly twice, latch written EXACTLY ZERO (different-keys ledger is the #1512 restore-lane law, cited not grown); reads precede writes (#1513 form); a null store writes nothing (null-guard arm)', async () => {
    const favoredActions = [{ ...diskFeature(classes2024,
      (o, autos) => o.name === 'Favored Enemy' && autos.some(a => a.spell === "Hunter's Mark"),
      'Favored Enemy automation for consume residence').automation }];
    const stats = wizardStats({ automation: { actions: favoredActions, bonusActions: [], specialActions: [], passives: [] } });

    // casts 1+2 against ONE armed latch byte 2 (_Favored_Enemy_freeCastCount
    // is producer-seeded via the arm modal / LR re-arm restRules-longRest.js:733
    // null -> armed byte): every consume stamps latch-1 — the ledger MOVES.
    // The stamped byte repeats across casts only because the consume never
    // drains the latch itself (#1512 open different-keys lane); the REAL store
    // short-circuits the identical sequel write (useRuntimeState.js:96 valuesEqual).
    freshStore({ _Favored_Enemy_freeCastCount: 2 });
    const r1 = await cast(DISK.huntersMark, stats, { freeCastAuthorized: true });
    const r2 = await cast(DISK.huntersMark, stats, { freeCastAuthorized: true });
    expect([r1.freeCastUsed, r2.freeCastUsed]).toEqual([true, true]);
    expect(setRuntimeValue.mock.calls).toEqual([
      [TW, 'favoredEnemyUses', 1, CAMPAIGN], // decrement landed (1 === read-1, NOT the re-stamp's 2)
      [TW, 'favoredEnemyUses', 1, CAMPAIGN],
    ]);
    expect(__mem.get(`${TW}|favoredEnemyUses`)).toBe(1); // store-bytes MOVED off the read-count
    expect(readsOf('_Favored_Enemy_freeCastCount')).toEqual([[TW, '_Favored_Enemy_freeCastCount'], [TW, '_Favored_Enemy_freeCastCount']]); // arity-2 literal read
    expect(readsOf('favoredEnemyUses')).toEqual([]); // latch is the count source; the uses key is WRITE-only here
    expect(getRuntimeValue.mock.invocationCallOrder[0]).toBeLessThan(setRuntimeValue.mock.invocationCallOrder[0]); // read-ledger -> consume-write order
    expect(readsOf('activeBuffs')).toEqual([]); // loop-inert disk shape: gate :448 false (usesMax absent, census at load)

    // deny half — REAL-null missing byte (#1517): null-guard short-circuits.
    freshStore({});
    const r3 = await cast(DISK.huntersMark, stats, { freeCastAuthorized: true });
    expect(r3.freeCastUsed).toBe(true);
    expect(setRuntimeValue.mock.calls).toEqual([]);
    expect(getCombatSummary).toHaveBeenCalledWith(CAMPAIGN); // concentration consult: cs-null golden guard (crash twin oracle #1513/#1518, cited)
  });

  it('Q1b (#1348 decrement table, #1527): latch 3 writes 2, latch 1 writes LAWFUL spent-0 (fix#90 zero-is-data, never -1), latch 0 no-op consumption REFUSES LOUD with ZERO writes (negative impossible; the pre-fix :493 `>= 0` arm silently stamped byte 0)', async () => {
    const favoredActions = [{ ...diskFeature(classes2024,
      (o, autos) => o.name === 'Favored Enemy' && autos.some(a => a.spell === "Hunter's Mark"),
      'Favored Enemy automation for consume residence').automation }];
    const stats = wizardStats({ automation: { actions: favoredActions, bonusActions: [], specialActions: [], passives: [] } });

    for (const [latch, stamped] of [[3, 2], [1, 0]]) {
      freshStore({ _Favored_Enemy_freeCastCount: latch });
      const result = await cast(DISK.huntersMark, stats, { freeCastAuthorized: true });
      expect(result.freeCastUsed).toBe(true);
      expect(setRuntimeValue.mock.calls).toEqual([[TW, 'favoredEnemyUses', stamped, CAMPAIGN]]); // exact-of-1, byte = latch-1
      expect(__mem.get(`${TW}|favoredEnemyUses`)).toBe(stamped);
    }

    // already-spent latch: loud refusal, zero writes, no negative byte anywhere.
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    freshStore({ _Favored_Enemy_freeCastCount: 0, favoredEnemyUses: 0 }); // ledger holds lawful spent-0 (fix#90)
    const r0 = await cast(DISK.huntersMark, stats, { freeCastAuthorized: true });
    expect(r0.freeCastUsed).toBe(true); // payment authority is caller-supplied truth (#1514)
    expect(setRuntimeValue.mock.calls).toEqual([]); // pre-fix wrote byte 0 here (CAPTURE-A0) — now REFUSED
    expect(__mem.get(`${TW}|favoredEnemyUses`)).toBe(0); // lawful spent byte UNTOUCHED
    const refused = errSpy.mock.calls.filter(c => String(c[0]).includes('Favored Enemy free-cast consume refused'));
    expect(refused.length).toBe(1); // refusals EXACTLY-one, never silent
    expect(refused[0][1]).toEqual({ playerName: TW, favoredEnemyCount: 0, spellName: DISK.huntersMark.name });
    errSpy.mockRestore();
  });

  it('X1: Natural Recovery [spellName] grant (:497-501, NaturalRecoveryModal.jsx:29 bytes) consumed to null + used-flag true, alongside the Signature lv3 stamp (:512-515, spellCalc2024.js:661 selection) — exact-of-3 flag-arm order; SEQUEL cast exposes the Signature used-flag RE-STAMP quirk (no used==null gate), NR stays gated (:498 null fall-through, exact-of-1)', async () => {
    const stats = wizardStats();
    freshStore({ naturalRecoveryFreeCast: [DISK.fireball.name], SignatureSpells_selection: [DISK.fireball.name] });

    const r1 = await cast(DISK.fireball, stats, { freeCastAuthorized: true });
    expect(r1.freeCastUsed).toBe(true);
    expect(setRuntimeValue.mock.calls).toEqual([
      [TW, 'naturalRecoveryFreeCast', null, CAMPAIGN],
      [TW, 'naturalRecoveryFreeCastUsed', true, CAMPAIGN],
      [TW, 'SignatureSpells_Fireball_used', true, CAMPAIGN],
    ]);

    const r2 = await cast(DISK.fireball, stats, { freeCastAuthorized: true });
    expect(r2.freeCastUsed).toBe(true);
    expect(setRuntimeValue.mock.calls).toEqual([ // cumulative exact-of-4: cast1's three + the SEQUEL re-stamp
      [TW, 'naturalRecoveryFreeCast', null, CAMPAIGN],
      [TW, 'naturalRecoveryFreeCastUsed', true, CAMPAIGN],
      [TW, 'SignatureSpells_Fireball_used', true, CAMPAIGN],
      [TW, 'SignatureSpells_Fireball_used', true, CAMPAIGN],
    ]);
    expect(__mem.get(`${TW}|naturalRecoveryFreeCast`)).toBeNull(); // NR stays spent (single-use byte honored)
  });

  it('X2: Bewitching Magic latch consumes ONLY on the case-exact name Misty Step (:502) — armed+match nulls it exact-of-1; a foreign name with an armed latch writes NOTHING (READ-happens/WRITE-silent #1515); Divination Savant stamps its real lv2 Divination disk row (:518-522)', async () => {
    const stats = wizardStats();
    freshStore({ _Bewitching_Magic_freeCast: true });
    const r1 = await cast(DISK.mistyStep, stats, { freeCastAuthorized: true });
    expect(r1.freeCastUsed).toBe(true);
    expect(setRuntimeValue.mock.calls).toEqual([[TW, '_Bewitching_Magic_freeCast', null, CAMPAIGN]]);

    freshStore({ _Divination_Savant_selection: [DISK.detectThoughts.name] });
    const r2 = await cast(DISK.detectThoughts, stats, { freeCastAuthorized: true });
    expect(r2.freeCastUsed).toBe(true);
    expect(setRuntimeValue.mock.calls).toEqual([[TW, '_Divination_Savant_Detect_Thoughts_used', true, CAMPAIGN]]);
    expect(readsOf('_Bewitching_Magic_freeCast')).toEqual([[TW, '_Bewitching_Magic_freeCast']]); // arity-2 read happened, latch absent -> no write

    freshStore({ _Bewitching_Magic_freeCast: true });
    const r3 = await cast(DISK.fireball, stats, { freeCastAuthorized: true });
    expect(r3.freeCastUsed).toBe(true);
    expect(setRuntimeValue.mock.calls).toEqual([]); // foreign name — :502 exact-name gate denies
    expect(readsOf('_Bewitching_Magic_freeCast')).toEqual([[TW, '_Bewitching_Magic_freeCast']]);
  });

  it('TK1 (CLA-356 :543-544 consume half, authorize half oracle gate #2 cited): a _telekineticMasterFreeCast-stamped Telekinesis cast skips the ENTIRE decrement phase — armed instance latch, favored latch and NR grant ALL survive an authorized free cast, exact-of-0 write ledger', async () => {
    const stats = wizardStats({
      spellAbilities: { spellCastingAbility: 'Intelligence', toHit: 9, saveDc: 17, modifier: 5, spells: [{ name: 'Telekinesis', level: 5, _telekineticMasterFreeCast: true }] },
      automation: { actions: [{ ...instanceRow }], bonusActions: [], specialActions: [], passives: [] },
    });
    freshStore({ '_Level_1_Spell_[Instance_1]_freeCastCount': 1, _Favored_Enemy_freeCastCount: 3, naturalRecoveryFreeCast: [DISK.telekinesis.name] });

    const result = await cast(DISK.telekinesis, stats, { freeCastAuthorized: true });

    expect(result.freeCastUsed).toBe(true);
    expect(result.slotConsumed).toBe(false);
    expect(setRuntimeValue.mock.calls).toEqual([]); // guard :544 returns BEFORE phantasmal/shadow/arcanum/loop/flags
    expect(readsOf('_Level_1_Spell_[Instance_1]_freeCastCount')).toEqual([]);
    expect(readsOf('_Favored_Enemy_freeCastCount')).toEqual([]);
    expect(readsOf('naturalRecoveryFreeCast')).toEqual([]);
    expect(__mem.get(`${TW}|_Favored_Enemy_freeCastCount`)).toBe(3);
    expect(addEntry).not.toHaveBeenCalled();
    // concentration face: cs-null golden guard (disk lv5 concentration:true)
    expect(getCombatSummary).toHaveBeenCalledTimes(1);
    expect(addConcentration).not.toHaveBeenCalled();
  });
});
