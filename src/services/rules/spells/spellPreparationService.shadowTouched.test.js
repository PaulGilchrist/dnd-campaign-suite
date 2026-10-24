// @maintained-by-ai
// FT-070 Shadow Touched FEAT lane — the REAL perSpellTracking span: selection-time
// spell set, live `_Shadow_Magic_<Spell>_freeCastCount` latch keys, consume/pay/refund
// ledgers. CLA-308 naming convention (shadowArts sibling owns `_Shadow_Arts_`).
//
// IDENTITY (verbatim, ratified #1520, cited from the shadowArts lane :11-12):
//   'NOT here — Shadow Touched FEAT (FT-070): free_spell + perSpellTracking:true,
//    prefix _Shadow_Magic_/_Shadow_Touched_, gate row #8, owned by shadowTouched.test.js'
// TWO-PREFIX RESOLUTION (grep evidence, this lane):
//   The latch prefix is derived from entry.name (spellPreparationService.js :20/:78/:423
//   `_${entry.name.replace(/\s+/g, '_')}_<Spell>_freeCastCount`). The live builder
//   addShadowTouchedFreeCasts (rules.js :350) names the entry 'Shadow Magic' — the 2024
//   SUB-FEATURE name (feats.json:2524 benefit.name; Tasha's 2014 called it 'Magic', 2024
//   renamed it 'Shadow Magic' — that renaming IS the two-prefix mystery). `_Shadow_Touched_`
//   appears ONLY where an entry is built straight from disk with name = FEAT name
//   (isFreeCastAuthorized.test.js gate-row #8 fixture, perSpellKey('Shadow_Touched', ...)).
//   OFF-LANE bytes appear in ASSERTIONS/ledgers ZERO times (exact-of-N ledgers + OFF_LANE
//   regex guard below); the literals here exist ONLY in the verbatim #1520/#1513
//   citations this header is required to carry (cross-channel purity, both directions
//   vs the shadowArts lane's inverse pin #1520).
//   FEAT CENSUS: 'Shadow Touched' exists in 2024 feats.json only (index 'shadow-touched');
//   5e feats.json census = absent (pinned in the identity test — FT-070 is 2024-only data).
//
// FT-070 BUG IDENTITY (git 4e77ce64d 'fix(FT-070): Shadow Touched: Invisibility
// free-cast inert (slot always consumed)'): the pre-fix entry listed only the chosen
// spell AND a shared feature counter let either spell steal the other's free cast.
// Cannot-regress distinguishing bytes: (a) Invisibility — the DISK-pinned half — is
// authorized and consumed on its OWN latch; (b) spending one spell never spends the
// other. RAW text (disk): 'Once you cast either spell in this way, you can't cast
// that spell in this way again until you finish a Long Rest' — per-spell, once each.
//
// LEDGER DISCIPLINE (#1513 fold-map assigns 'spent/fresh/independent -> shadowTouched
// (YOU)'; verbatim #1513 gate row #8 'automation scans — explicit FALSE halts whole
// scan (perSpellTracking spent), read-before-verdict ledger pinned' — the halt row
// itself is owned by spellPreparationService.isFreeCastAuthorized.test.js:392, NOT
// re-pinned here):
//   - authorization is a READ-ONLY channel: shadow reads byte-exact, writes [] always.
//   - consume writes count-1 -> 0 (spent byte); null = fresh (re-armed to NULL by
//     restRules-longRest.test.js:296-297 — store-faithful REAL null, never undefined,
//     #1517). Fresh is `stored != null ? Number(stored) : (usesMax ?? uses ?? 1)`.
//   - refusal rows keep READ-happens-WRITE-silent distinct (#1515).
//   - rollback arm verbatim #1512: 'stored != null && stored < usesMax (usesMax ??
//     uses ?? 1) — null no-refund sibling-pinned'; T5/T6 '0->1 + fresh-null kept
//     separate' — refund (0->1) and no-refund (null / at-max) stay separate rows.
//   - ARITY: every latch read is arity-3 [player,key,campaign] and every write
//     arity-4 [player,key,value,campaign] — census home spellPreparationService
//     .resource-flow.test.js:427-428 (thrice-quoted canon, cited not re-grown).
//
// FIXTURES: disk-derived, drift-throw at load (#1509-#1520 eleven-lane canonical form;
// fabrication-ban fifty-three, #1520 near-copy catch: retype-free derivation only).
// The live entry mirrors rules.js:351-358 stAutomationEntry field-by-field, with
// name/type/spell-half/recharge/perSpellTracking pulled from the disk row — NOT retyped.
// Chosen-spell half ('False Life', 1st-level Necromancy) is the RUNTIME selection
// (playerStats.shadowTouchedSpell, rules.js:343; builder output byte-pinned by
// rules.getPlayerStats.test.js:563-572, cited not duplicated). The disk-pinned half is
// '["Invisibility"]' verbatim (#1515). No 'Test Feature'/'PerSpell Feature' fakes here —
// generic single-spell shape rows are owned by the uncovered.* siblings.
//
// OWNERSHIP FOLD (do-not-duplicate map, all sibling-owned): gate #8 halt +
// '_Shadow_Touched_' disk-name fixture -> isFreeCastAuthorized.test.js:392;
// builder selection bytes -> rules.getPlayerStats.test.js:533-572; long-rest re-arm
// to null -> restRules-longRest.test.js:296-314; generic slot-pay 3->2 + arity census
// -> resource-flow.test.js; phantasmal/shadowArts passives -> their lanes;
// incrementFreeCastResource.test.js:62 delegates 'FT-070 perSpellTracking rollback
// (real disk row)' TO THIS FILE (rollback rows below). Removed original row
// 'non-holder cast consumes a slot normally' = channel-generic payment, byte-owned by
// resource-flow.test.js B-pay rows — in-file removal, cross-file untouched.
//
// QUIRK SCANS: golden unguarded-deref guard form #1518 — addEntry mock returns
// Promise.resolve({}) so the service's unguarded `.catch` never derefs undefined
// (console spy: 0 errSpy hits needed, no swallow possible); pass-through-spread-only
// assertions: 0 (every row asserts latch/slot/log behavior); vacuous self-compute: 0
// (latch keys in ledgers are literals, disk name-equality pins drift BOTH directions);
// :0-swallow: 0; dead twins 1:1 disk-vs-code #1519 form: fixture half-set maps
// disk ['Invisibility'] <-> code [chosen,'Invisibility'] 1:1; case trails exact both
// prefixes ('Shadow Magic' not 'Shadow magic'); chokepoint inline-dup const-idiom:
// FREE_CAST_CONSUME/RESTORE_OPS shared scan (:445) not re-walked, behavior pinned at
// seam; invocationCallOrder: in-cast-order pinned on consume ledgers; NO-CLOCK:
// seam counts only (calls.length + exact tuples), timestamp is the single unavoidable
// non-deterministic field (expect.any(Number) x2, quantified: weak matchers = 2,
// both timestamps; expect.anything() = 0).
//
// KILL MATRIX (analytic, #1361 canon — never git): perSpellTrackingDecision
// null-fallback drop -> fresh rows die; count>0 drop -> spent rows die;
// per-spell key shared-key swap -> read-ledger exactness dies; scan-order
// perSpell-before-recharge swap (:110/:114) -> arity-3 read bytes vs arity-2
// featureFreeCastCount read die; consume perSpell arm drop -> recharge fallthrough
// writes wrong key, ledger diff; restore `stored != null` drop -> null-refund row dies
// (writes 0->1 on fresh); `< usesMax` clamp drop -> max-clamp row dies (writes 1->2);
// logPerSpell note spell-name slot swap -> byte note dies; name 'Shadow Magic' ->
// 'Shadow Touched' rename at builder -> prefix byte dies in every ledger here.
//
// SECURITY: no kiro-injection (#1446) encountered; this lane self-authored.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(),
  getRuntimeValue: vi.fn(),
}));

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

import { isFreeCastAuthorized, incrementFreeCastResource, prepareSpellCast } from './spellPreparationService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../services/ui/logService.js';

// ── Disk rows: REAL bytes, drift-throw at load (#1509 canonical form) ──
const feats2024 = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/2024/feats.json'), 'utf8'));
const feats5e = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/feats.json'), 'utf8'));
const spells2024 = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/2024/spells.json'), 'utf8'));

const stFeat = feats2024.find(f => f.name === 'Shadow Touched');
if (!stFeat) throw new Error('disk drift: Shadow Touched row absent from 2024 feats.json');
const stBenefit = stFeat.benefits.find(b => b.automation?.perSpellTracking === true);
if (!stBenefit || stBenefit.name !== 'Shadow Magic') throw new Error("disk drift: Shadow Touched perSpellTracking benefit is no longer named 'Shadow Magic' (latch prefix source)");
const ST_AUTO = stBenefit.automation;
if (ST_AUTO.type !== 'free_spell' || JSON.stringify(ST_AUTO.spell) !== '["Invisibility"]' || ST_AUTO.recharge !== 'long_rest') {
  throw new Error('disk drift: Shadow Touched automation no longer {free_spell, ["Invisibility"], long_rest}');
}
const diskSpell = (name) => {
  const s = spells2024.find(x => x.name === name);
  if (!s) throw new Error(`disk drift: ${name} absent from 2024 spells.json`);
  return s;
};
const DISK_INVIS = diskSpell('Invisibility');
const DISK_FALSE_LIFE = diskSpell('False Life');

const CAMPAIGN = 'test-campaign';
const PLAYER = 'HexWarlock';

// LIVE latch bytes — the FT-070 channel. Literal-pinned (case trails exact); the
// disk<->code name equality in the identity test catches drift BOTH directions.
const LATCH_INVIS = '_Shadow_Magic_Invisibility_freeCastCount';
const LATCH_CHOSEN = '_Shadow_Magic_False_Life_freeCastCount';
// Cross-channel purity regex (this lane must never mint Arts/Touched-prefix bytes):
const OFF_LANE = /^_Shadow_(Arts|Touched)_/;

// Live automation shape produced by rules.js addShadowTouchedFreeCasts (:341-367):
// disk-pinned half + runtime-selected half, name = 2024 sub-feature name from disk.
function liveShadowMagicEntry(chosen) {
  return {
    type: ST_AUTO.type,
    spell: [...new Set([chosen, ...ST_AUTO.spell])],
    name: stBenefit.name,
    uses: 1,
    recharge: ST_AUTO.recharge,
    perSpellTracking: true,
  };
}

function makeStats({ holder = true, chosen = 'False Life' } = {}) {
  const entry = liveShadowMagicEntry(chosen);
  return {
    name: PLAYER,
    class: { name: 'Sorcerer' },
    abilities: [{ name: 'Charisma', bonus: 3 }],
    proficiency: 5,
    spellAbilities: {
      spellCastingAbility: 'Charisma',
      spell_slots_level_1: 4,
      spell_slots_level_2: 3,
    },
    automation: { actions: [], bonusActions: [], specialActions: holder ? [entry] : [], passives: [] },
  };
}

// Read-backed live store: mock writes become readable (real-store fidelity — the
// consume/rollback seam READS what it last WROTE; a static map would lie after cast 1).
function liveRuntime(seed = {}) {
  const store = new Map(Object.entries(seed));
  getRuntimeValue.mockImplementation((_name, key) => store.get(key));
  setRuntimeValue.mockImplementation((_name, key, value) => store.set(key, value));
  return store;
}

const shadowReads = () => getRuntimeValue.mock.calls.filter(c => String(c[1]).startsWith('_Shadow_'));
const shadowWrites = () => setRuntimeValue.mock.calls.filter(c => String(c[1]).startsWith('_Shadow_'));
const R = (key) => [PLAYER, key, CAMPAIGN];
const W = (key, value) => [PLAYER, key, value, CAMPAIGN];

beforeEach(() => vi.clearAllMocks());

describe('FT-070 Shadow Touched — disk identity + two-prefix resolution (#1520)', () => {
  it('feat is 2024-only; latch prefix comes from sub-feature name Shadow Magic (not feat name); disk pins tracked half ["Invisibility"] (#1515)', () => {
    expect(stFeat.name).toBe('Shadow Touched');
    expect(stFeat.index).toBe('shadow-touched');
    expect(feats5e.some(f => f.name === 'Shadow Touched')).toBe(false);
    // Exact-of-N automation tuple, full key set — the disk row verbatim:
    expect(ST_AUTO).toEqual({ type: 'free_spell', spell: ['Invisibility'], perSpellTracking: true, recharge: 'long_rest', casting_time: '1 action' });
    // Dead-twin 1:1 map (#1519): live entry = disk half + selection half; builder mirror of rules.js:351:
    expect(liveShadowMagicEntry(DISK_FALSE_LIFE.name)).toEqual({
      type: 'free_spell', spell: ['False Life', 'Invisibility'], name: 'Shadow Magic', uses: 1, recharge: 'long_rest', perSpellTracking: true,
    });
    // Dual-ruleset spell bytes (level decides the paid-slot key downstream):
    expect([DISK_INVIS.level, DISK_INVIS.concentration]).toEqual([2, true]);
    expect([DISK_FALSE_LIFE.level, DISK_FALSE_LIFE.school]).toEqual([1, 'Necromancy']);
    // Authorization is SYNCHRONOUS arity-5 (no await — bare boolean):
    liveRuntime();
    const decision = isFreeCastAuthorized(PLAYER, 'Invisibility', DISK_INVIS.level, makeStats(), CAMPAIGN);
    expect(decision).toBe(true);
    expect(decision instanceof Promise).toBe(false);
  });
});

describe('FT-070 Shadow Touched — isFreeCastAuthorized fresh/spent/independent (#1513 fold)', () => {
  it('authorizes a fresh free cast of BOTH halves (chosen + disk-pinned Invisibility) — read-only channel, zero writes', () => {
    liveRuntime(); // null-absent = fresh
    expect(isFreeCastAuthorized(PLAYER, 'False Life', 1, makeStats(), CAMPAIGN)).toBe(true);
    expect(isFreeCastAuthorized(PLAYER, 'Invisibility', DISK_INVIS.level, makeStats(), CAMPAIGN)).toBe(true);
    expect(shadowReads()).toEqual([R(LATCH_CHOSEN), R(LATCH_INVIS)]); // arity-3 tier
    expect(setRuntimeValue.mock.calls).toEqual([]); // authorization NEVER latches
  });

  it('keeps counters independent: Invisibility stays authorized while the chosen spell is spent — reads only its own key', () => {
    liveRuntime({ [LATCH_CHOSEN]: 0 }); // chosen spent (consume byte 0)
    expect(isFreeCastAuthorized(PLAYER, 'Invisibility', DISK_INVIS.level, makeStats(), CAMPAIGN)).toBe(true);
    expect(shadowReads()).toEqual([R(LATCH_INVIS)]); // chosen latch never peeked
  });

  it('refuses each half once ITS OWN counter is spent — READ-happens, WRITE-silent (#1515)', () => {
    const stats = makeStats();
    liveRuntime({ [LATCH_INVIS]: 0, [LATCH_CHOSEN]: 0 });
    expect(isFreeCastAuthorized(PLAYER, 'Invisibility', DISK_INVIS.level, stats, CAMPAIGN)).toBe(false);
    expect(isFreeCastAuthorized(PLAYER, 'False Life', 1, stats, CAMPAIGN)).toBe(false);
    expect(shadowReads()).toEqual([R(LATCH_INVIS), R(LATCH_CHOSEN)]);
    expect(setRuntimeValue.mock.calls).toEqual([]); // refusal never writes
  });

  it('denies unlisted spells and non-holders — per-spell latch never minted for them', () => {
    liveRuntime();
    expect(isFreeCastAuthorized(PLAYER, 'Shield', 1, makeStats(), CAMPAIGN)).toBe(false);
    expect(isFreeCastAuthorized(PLAYER, 'Invisibility', DISK_INVIS.level, makeStats({ holder: false }), CAMPAIGN)).toBe(false);
    expect(shadowReads()).toEqual([]); // scan exits without touching a latch byte
    expect(setRuntimeValue.mock.calls).toEqual([]);
  });
});

describe('FT-070 Shadow Touched — prepareSpellCast consumption', () => {
  it('free-casts BOTH halves in cast order: exact-of-2 latch writes (1->0 each), zero slot writes, two exact log rows (#1520)', async () => {
    const stats = makeStats();
    liveRuntime();
    const r1 = await prepareSpellCast(DISK_INVIS, {}, {
      playerName: PLAYER, playerStats: stats, campaignName: CAMPAIGN,
      freeCastAuthorized: isFreeCastAuthorized(PLAYER, 'Invisibility', DISK_INVIS.level, stats, CAMPAIGN),
    });
    const r2 = await prepareSpellCast(DISK_FALSE_LIFE, {}, {
      playerName: PLAYER, playerStats: stats, campaignName: CAMPAIGN,
      freeCastAuthorized: isFreeCastAuthorized(PLAYER, 'False Life', 1, stats, CAMPAIGN),
    });
    expect([r1.freeCastUsed, r1.slotConsumed, r2.freeCastUsed, r2.slotConsumed]).toEqual([true, false, true, false]);
    // Full write ledger, in-cast-order (invocationCallOrder): spend each spell's OWN latch exactly once.
    expect(setRuntimeValue.mock.calls).toEqual([W(LATCH_INVIS, 0), W(LATCH_CHOSEN, 0)]); // arity-4, spent byte 0
    // Reads: auth-gate + in-lane LIST re-query (#341(a)) + consume of invis, then the
    // same triple of chosen — no cross-channel bytes, ever:
    expect(shadowReads()).toEqual([R(LATCH_INVIS), R(LATCH_INVIS), R(LATCH_INVIS), R(LATCH_CHOSEN), R(LATCH_CHOSEN), R(LATCH_CHOSEN)]);
    expect(setRuntimeValue.mock.calls.filter(c => OFF_LANE.test(String(c[1])))).toEqual([]);
    expect(addEntry.mock.calls).toEqual([
      [CAMPAIGN, { type: 'ability_use', characterName: PLAYER, abilityName: 'Shadow Magic', spellName: 'Invisibility', note: 'Shadow Magic free cast of Invisibility — no spell slot consumed. Invisibility is spent this way until your next Long Rest.', timestamp: expect.any(Number) }],
      [CAMPAIGN, { type: 'ability_use', characterName: PLAYER, abilityName: 'Shadow Magic', spellName: 'False Life', note: 'Shadow Magic free cast of False Life — no spell slot consumed. False Life is spent this way until your next Long Rest.', timestamp: expect.any(Number) }],
    ]);
  });

  it('spent half stays castable — pays its own slot (3->2), latch untouched: one verdict read upstream, zero writes downstream', async () => {
    const stats = makeStats();
    liveRuntime({ [LATCH_INVIS]: 0, 'spell_slots_level_2': 3 });
    const authorized = isFreeCastAuthorized(PLAYER, 'Invisibility', DISK_INVIS.level, stats, CAMPAIGN);
    expect(authorized).toBe(false);
    expect(shadowReads()).toEqual([R(LATCH_INVIS)]); // READ-happens
    expect(setRuntimeValue.mock.calls).toEqual([]); // WRITE-silent at refusal
    const result = await prepareSpellCast(DISK_INVIS, {}, {
      playerName: PLAYER, playerStats: stats, campaignName: CAMPAIGN, freeCastAuthorized: authorized,
    });
    expect([result.freeCastUsed, result.slotConsumed]).toEqual([false, true]);
    expect(setRuntimeValue.mock.calls).toEqual([W('spell_slots_level_2', 2)]); // exact-of-1, full ledger
    expect(shadowReads()).toHaveLength(2); // caller gate + the #341(a) in-lane LIST re-query — the PAID cast still verifies, writes stay slot-only
  });
});

describe('FT-070 Shadow Touched — incrementFreeCastResource rollback (#1512 arm)', () => {
  it('refunds only the rolled-back spell: spent 0 -> 1, fresh sibling (REAL null, #1517) no-refund, exact-of-N ledgers', () => {
    liveRuntime({ [LATCH_INVIS]: 0, [LATCH_CHOSEN]: null }); // null = freshly re-armed by long rest
    incrementFreeCastResource(PLAYER, 'Invisibility', DISK_INVIS.level, makeStats(), CAMPAIGN);
    expect(shadowReads()).toEqual([R(LATCH_INVIS)]);
    expect(shadowWrites()).toEqual([W(LATCH_INVIS, 1)]);
    expect(setRuntimeValue.mock.calls).toEqual([W(LATCH_INVIS, 1)]); // no slot touch, no sibling write
  });

  it('no-refund boundaries — fresh-null and at-max both keep READ-happens-WRITE-silent', () => {
    const stats = makeStats();
    liveRuntime({ [LATCH_INVIS]: null }); // REAL null, not undefined (#1517 store-faithful)
    incrementFreeCastResource(PLAYER, 'Invisibility', DISK_INVIS.level, stats, CAMPAIGN);
    expect(shadowReads()).toEqual([R(LATCH_INVIS)]); // arm evaluated: stored != null
    expect(shadowWrites()).toEqual([]); // null no-refund (#1512 sibling-pinned inverse)
    getRuntimeValue.mockClear();
    liveRuntime({ [LATCH_INVIS]: 1 }); // already at usesMax (usesMax ?? uses ?? 1 = 1)
    incrementFreeCastResource(PLAYER, 'Invisibility', DISK_INVIS.level, stats, CAMPAIGN);
    expect(shadowReads()).toEqual([R(LATCH_INVIS)]);
    expect(shadowWrites()).toEqual([]); // < usesMax clamp holds — never bumps past max
  });
});
