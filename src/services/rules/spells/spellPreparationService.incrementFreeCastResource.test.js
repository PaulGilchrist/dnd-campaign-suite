// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';

// ---------------------------------------------------------------------------
// incrementFreeCastResource — the cast-cancel RESTORE lane (rollback twin of
// decrementFreeCastResource). Live boundary: production caller is
// rollbackSpellSlot (src/hooks/combat/useConfirmableFlow.js:39) for
// FREE_CAST_SPELLS names on a cancelled/skipped confirm — NOT a rest route.
// There is no clock here: the function is purely event-driven (no-timers).
// Rest re-arm authority is the LONG_REST_RESOURCES explicit-null batch
// (src/services/rules/effects/restRules-constants.js:179-244; cla138 keys
// at :194 '_Fey_Reinforcements_freeCastCount' / :197
// '_Fey_Reinforcements_noConcentration'; favored at :211/:224).
//
// NULL-vs-NUMBER-vs-ABSENT CONTRACT (loop integrity vs #1510 consumer
// `?? uses` reads): every read in this lane coalesces null and absent
// IDENTICALLY (`?? fallback` / `!= null`), so a rollback run against a
// latch the LR batch already nulled is a no-op — it can never over-fill.
// Observable write bytes per lane (REAL-run, pinned below):
//   counter latches  -> number only (count + 1, clamped < max)
//   arcanum lv-key   -> number 1 only, cap 1, absent/null -> no write
//   NR / Bewitching  -> explicit null (+ used flag)
//   used-flag lanes  -> boolean false only
//   favored enemy    -> read '_Favored_Enemy_freeCastCount', WRITE DIFFERENT
//                       key 'favoredEnemyUses' = Number+1, UNCAPPED, writes
//                       even from 0 (:0-writes), skips only null/absent
//
// RECHARGE-KIND CENSUS (real disk, both rulesets, types free_spell/
// fey_reinforcements/misty_wanderer/dragon_companion; incrementFreeCastResource
// NEVER matches a recharge STRING — `entry.recharge` is a boolean gate, live
// only inside adjustRechargeCounter (`uses != null && !uses_expression`)):
//   'long_rest' (13 rows)   -> LIVE numeric+1 via recharge arm when uses is a
//                              number (Faithful Steed, Paladin's Smite uses:1);
//                              LIVE via shared arm when uses_expression+usesMax
//                              (Fey Reinforcements usesMax:1); INERT when
//                              uses_expression truthy blocks the recharge arm and
//                              usesMax is absent (feats.json Detect Thoughts,
//                              Contact Patron) or uses absent (Misty Wanderer)
//   'short_or_long_rest'    -> no distinct arm; War God's Blessing (uses absent)
//                              rollback-inert — buff-flag lane re-arms it
//   <absent> (4 rows)       -> recharge gate false; Wild Companion/Mantle of
//                              Majesty/Star Map/Telekinetic Master — flag/buff lanes
//   no dawn/level/none      -> no such values exist on disk; no string-matching
//                              arms in code (dead twins: none in either direction)
// Blocked-arm inert latches re-arm ONLY via the LR batch null (restRules-
// constants.js :186-244) — pinned live/inert per shape in the disk table below.
//
// FREE_CAST_ENTRY_TYPES vs disk: all 4 code types ('free_spell',
// 'fey_reinforcements', 'misty_wanderer', 'dragon_companion') have live
// disk rows; no disk type outside the list. perSpellTracking disk rows:
// feats.json Shadow Magic + Fey Magic (restore lane pinned with REAL bytes
// by spellPreparationService.shadowTouched.test.js — not re-pinned here).
//
// CROSS-FILE DEDUP MAP (this lane's siblings, verified by grep of
// incrementFreeCastResource call sites — those pins are NOT duplicated here):
//   uncovered.incrementFreeCastResource.test.js -> uses_expression shared
//     branch: level-match +1, at-cap no-write, featureLevel-null spell
//     match, featureLevel-mismatch continue, recharge-with-uses_expression
//   shadowArts.test.js -> restorePerSpellFreeCastCounter 0->1 + fresh-null
//     no-refund (phantasmal_creatures uses the SAME function/prefix shape)
//   shadowTouched.test.js -> FT-070 perSpellTracking rollback (real disk row)
//   mysticArcanum.test.js -> per-level key selection (lv7 vs lv6)
//   uncovered.isFreeCastAuthorized.test.js -> consume-side per-spell rows
//
// MOCK COMPLETENESS (exact-of-7 census): spellPreparationService.js imports
// exactly 7 modules: useRuntimeState, combatData, concentrationService,
// storage, metamagicRules, logService, castingTimeUtils. 6 are mocked below
// (the state/log/combat boundary); castingTimeUtils is a pure string util
// and runs REAL (never mock the unit-under-test's pure collaborators).
// getRuntimeValue/setRuntimeValue are the only exports this lane reads/writes.
// Campaign lockdown: 'test-campaign'.
// ---------------------------------------------------------------------------

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => {
  const setRuntimeValue = vi.fn();
  const getRuntimeValue = vi.fn();
  return { setRuntimeValue, getRuntimeValue };
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
  addEntry: vi.fn(),
}));

vi.mock('./metamagicRules.js', () => ({
  isPsionicSpell: vi.fn(() => false),
  hasPsionicSorcery: vi.fn(() => false),
}));

import { incrementFreeCastResource } from './spellPreparationService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

const PLAYER = 'TestWizard';
const CAMPAIGN = 'test-campaign';

// Runtime-state fake: `key in map` keeps explicit-null distinct from absent
// on the way IN (both reach the source's `??`/`!= null` arms as the same
// coalesce — the observable difference is only in the persisted write byte).
function seed(stored) {
  getRuntimeValue.mockImplementation((_player, key) => (key in stored ? stored[key] : undefined));
}

function makePlayerStats(overrides = {}) {
  return {
    name: PLAYER,
    class: { name: 'Wizard' },
    spellAbilities: {},
    automation: { actions: [], bonusActions: [], specialActions: [], passives: [] },
    ...overrides,
  };
}

// Real-disk fixture loader: returns the FEATURE owning a matching automation
// row; the runtime entry idiom is { name: feature.name, ...automation }
// (automation rows carry no name — stamping site precedes this lane).
// Drift (row renamed/re-typed) throws rather than fabricating bytes.
function diskFeature(file, autoPred) {
  const data = JSON.parse(readFileSync(file, 'utf8'));
  let found = null;
  const walk = (o) => {
    if (found || !o || typeof o !== 'object') return;
    if (Array.isArray(o)) { o.forEach(walk); return; }
    if (o.automation && autoPred(o.automation)) { found = o; return; }
    Object.values(o).forEach(walk);
  };
  walk(data);
  if (!found) throw new Error(`disk drift: no matching automation row in ${file}`);
  return { name: found.name, ...JSON.parse(JSON.stringify(found.automation)) };
}

const CLS2024 = 'public/data/2024/classes.json';
const FEATS2024 = 'public/data/2024/feats.json';
// Long Rest uses:1 row — recharge arm LIVE (uses numeric, no uses_expression)
const steedEntry = diskFeature(CLS2024,
  a => a.type === 'free_spell' && a.spell === 'Find Steed' && a.uses === 1 && a.recharge === 'long_rest');
// uses_expression:"1" + usesMax:1 — shared arm LIVE; cla138 LATCH rollback twin
const feyEntry = diskFeature(CLS2024,
  a => a.type === 'fey_reinforcements' && a.spell === 'Summon Fey' && a.usesMax === 1);
// uses:1 AND uses_expression:"1" — BOTH counter arms mutually blocked (dead twin)
const detectThoughtsEntry = diskFeature(FEATS2024,
  a => a.type === 'free_spell' && a.spell === 'Detect Thoughts' && a.uses === 1 && a.uses_expression === '1');
// short_or_long_rest row with uses ABSENT — every counter arm skipped
const warGodsEntry = diskFeature(CLS2024,
  a => a.type === 'free_spell' && a.recharge === 'short_or_long_rest'
    && Array.isArray(a.spell) && a.spell.includes('Shield of Faith'));

function statsWith(...entries) {
  return makePlayerStats({ automation: { actions: entries, bonusActions: [], specialActions: [], passives: [] } });
}

beforeEach(() => {
  vi.clearAllMocks();
  seed({});
});

describe('incrementFreeCastResource — restore lane (rollback twin of the #1510/#1511 deplete side)', () => {

  it('Mystic Arcanum ledger: caps at 1, coalesces explicit-null/absent LR batch to full, gates level 6..9 and membership', () => {
    const stats = makePlayerStats({ class: { name: 'Warlock', arcanums: ['Finger of Death', 'Power Word Kill'] } });
    // write rows: spent latch (0) restores to exactly 1; level boundary 9 inclusive
    const writes = [
      ['Finger of Death', 7, { mysticArcanumLevel7: 0 }, ['mysticArcanumLevel7', 1]],
      ['Power Word Kill', 9, { mysticArcanumLevel9: 0 }, ['mysticArcanumLevel9', 1]],
    ];
    for (const [spell, lv, store, [key, val]] of writes) {
      vi.clearAllMocks(); seed(store);
      incrementFreeCastResource(PLAYER, spell, lv, stats, CAMPAIGN);
      expect(setRuntimeValue.mock.calls).toEqual([[PLAYER, key, val, CAMPAIGN]]);
      // read tier: the arcanum counter is read WITHOUT the campaign arg (pre-existing pattern)
      expect(getRuntimeValue).toHaveBeenCalledWith(PLAYER, key);
    }
    // no-write rows: at-cap clamp, explicit null, absent, level gate both ends, non-member
    const inert = [
      ['Finger of Death', 7, { mysticArcanumLevel7: 1 }, 'at cap 1'],
      ['Finger of Death', 7, { mysticArcanumLevel7: null }, 'LR-batch explicit null -> ?? 1 -> full'],
      ['Finger of Death', 7, {}, 'absent -> ?? 1 -> full'],
      ['Finger of Death', 5, { mysticArcanumLevel5: 0 }, 'level below arcanum gate'],
      ['Finger of Death', 10, { mysticArcanumLevel10: 0 }, 'level above arcanum gate'],
      ['Fireball', 7, { mysticArcanumLevel7: 0 }, 'spell not an arcanum'],
    ];
    for (const [spell, lv, store] of inert) {
      vi.clearAllMocks(); seed(store);
      incrementFreeCastResource(PLAYER, spell, lv, stats, CAMPAIGN);
      expect(setRuntimeValue).not.toHaveBeenCalled();
    }
  });

  it('Favored Enemy ledger: reads _Favored_Enemy_freeCastCount, writes DIFFERENT key favoredEnemyUses uncapped, writes from 0, skips only null/absent', () => {
    const stats = makePlayerStats();
    const ledgers = [
      [2, 3, 'counts past 2 — no usesMax clamp exists on this lane'],
      [0, 1, ':0-writes (0 >= 0 arm) — no zero-swallow'],
      [9, 10, 'uncapped quirk pinned: rollback can exceed any nominal max'],
    ];
    for (const [stored, next] of ledgers) {
      vi.clearAllMocks(); seed({ _Favored_Enemy_freeCastCount: stored });
      incrementFreeCastResource(PLAYER, 'Hunter\'s Mark', 1, stats, CAMPAIGN);
      expect(setRuntimeValue.mock.calls).toEqual([[PLAYER, 'favoredEnemyUses', next, CAMPAIGN]]);
      expect(getRuntimeValue).toHaveBeenCalledWith(PLAYER, '_Favored_Enemy_freeCastCount');
    }
    for (const skipped of [null, undefined]) {
      vi.clearAllMocks(); seed({ _Favored_Enemy_freeCastCount: skipped });
      incrementFreeCastResource(PLAYER, 'Hunter\'s Mark', 1, stats, CAMPAIGN);
      expect(setRuntimeValue).not.toHaveBeenCalled();
    }
  });

  it('Natural Recovery re-arm: exact two-write tuple (explicit null + boolean false); miss/null/empty store inert', () => {
    const stats = makePlayerStats();
    seed({ naturalRecoveryFreeCast: ['Fireball'] });
    incrementFreeCastResource(PLAYER, 'Fireball', 3, stats, CAMPAIGN);
    // consume writes [null, TRUE] — rollback is byte-distinguishable ONLY by `false`:
    expect(setRuntimeValue.mock.calls).toEqual([
      [PLAYER, 'naturalRecoveryFreeCast', null, CAMPAIGN],
      [PLAYER, 'naturalRecoveryFreeCastUsed', false, CAMPAIGN],
    ]);
    for (const store of [
      { naturalRecoveryFreeCast: ['Shield'] }, // spell miss
      { naturalRecoveryFreeCast: null },       // already spent/consumed-null
      { naturalRecoveryFreeCast: [] },         // empty selection
      {},                                      // absent
    ]) {
      vi.clearAllMocks(); seed(store);
      incrementFreeCastResource(PLAYER, 'Fireball', 3, stats, CAMPAIGN);
      expect(setRuntimeValue).not.toHaveBeenCalled();
    }
  });

  it('Bewitching Magic rollback: armed(true)+Misty Step writes explicit null; falsy triple and wrong-spell gate inert', () => {
    const stats = makePlayerStats();
    seed({ '_Bewitching_Magic_freeCast': true });
    incrementFreeCastResource(PLAYER, 'Misty Step', 2, stats, CAMPAIGN);
    // quirk pinned verbatim: rollback DROPS the arm (writes null, not true) —
    // after a consume already nulled it, the truthy gate reads false and this
    // lane writes nothing at all (rollback cannot resurrect a consumed arm).
    expect(setRuntimeValue.mock.calls).toEqual([[PLAYER, '_Bewitching_Magic_freeCast', null, CAMPAIGN]]);
    for (const armed of [false, null, undefined]) {
      vi.clearAllMocks(); seed({ '_Bewitching_Magic_freeCast': armed });
      incrementFreeCastResource(PLAYER, 'Misty Step', 2, stats, CAMPAIGN);
      expect(setRuntimeValue).not.toHaveBeenCalled();
    }
    vi.clearAllMocks(); seed({ '_Bewitching_Magic_freeCast': true });
    incrementFreeCastResource(PLAYER, 'Thunderous Smite', 2, stats, CAMPAIGN);
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('used-flag rollbacks: Signature Spells gated spellLevel === 3 (5/7/9 selections inert), Divination Savant ungated by level — both write exactly false', () => {
    const stats = makePlayerStats();
    seed({ 'SignatureSpells_selection': ['Teleportation Circle'] });
    incrementFreeCastResource(PLAYER, 'Teleportation Circle', 3, stats, CAMPAIGN);
    expect(setRuntimeValue.mock.calls).toEqual([[PLAYER, 'SignatureSpells_Teleportation_Circle_used', false, CAMPAIGN]]);
    vi.clearAllMocks();
    incrementFreeCastResource(PLAYER, 'Teleportation Circle', 5, stats, CAMPAIGN);
    expect(setRuntimeValue).not.toHaveBeenCalled(); // hardcoded === 3 quirk: upcast rollback inert

    seed({ '_Divination_Savant_selection': ['Warding Bond'] });
    incrementFreeCastResource(PLAYER, 'Warding Bond', 2, stats, CAMPAIGN);
    expect(setRuntimeValue.mock.calls).toEqual([[PLAYER, '_Divination_Savant_Warding_Bond_used', false, CAMPAIGN]]);
    vi.clearAllMocks(); seed({ '_Divination_Savant_selection': ['Warding Bond'] });
    incrementFreeCastResource(PLAYER, 'Leomund\'s Secret Chest', 2, stats, CAMPAIGN);
    expect(setRuntimeValue).not.toHaveBeenCalled(); // spell-miss gate
  });

  it('recharge-kind rollback table (REAL disk rows, drift-throw): live arms restore number+1 clamped, blocked/inert arm shapes write nothing, unengaged store is zero-write', () => {
    // Faithful Steed (long_rest, uses:1): recharge arm LIVE — spent 0 restores
    // to exactly 1 (clamped at usesMax=entry.uses)...
    seed({ '_Faithful_Steed_freeCastCount': 0 });
    incrementFreeCastResource(PLAYER, 'Find Steed', 5, statsWith(steedEntry), CAMPAIGN);
    expect(setRuntimeValue.mock.calls).toEqual([[PLAYER, '_Faithful_Steed_freeCastCount', 1, CAMPAIGN]]);
    // ...and idempotent against the LR batch explicit null (?? uses=1 -> clamped):
    vi.clearAllMocks(); seed({ '_Faithful_Steed_freeCastCount': null });
    incrementFreeCastResource(PLAYER, 'Find Steed', 5, statsWith(steedEntry), CAMPAIGN);
    expect(setRuntimeValue).not.toHaveBeenCalled();
    // Fey Reinforcements (cla138, uses_expression:"1"+usesMax:1): shared arm LIVE —
    // the rollback twin of the cla138 consume side (cla138 has zero increment calls):
    vi.clearAllMocks(); seed({ '_Fey_Reinforcements_freeCastCount': 0 });
    incrementFreeCastResource(PLAYER, 'Summon Fey', 6, statsWith(feyEntry), CAMPAIGN);
    expect(setRuntimeValue.mock.calls).toEqual([[PLAYER, '_Fey_Reinforcements_freeCastCount', 1, CAMPAIGN]]);
    // Detect Thoughts feat: uses:1 AND uses_expression truthy AND no usesMax —
    // shared arm needs usesMax, recharge arm needs !uses_expression: BOTH blocked.
    // The LR batch latch (restRules-constants.js:244) is the sole re-arm authority;
    // rollback cannot revive a spent numeric latch here (dead-twin quantified):
    vi.clearAllMocks(); seed({ '_Detect_Thoughts_freeCastCount': 0 });
    incrementFreeCastResource(PLAYER, 'Detect Thoughts', 2, statsWith(detectThoughtsEntry), CAMPAIGN);
    expect(setRuntimeValue).not.toHaveBeenCalled();
    // War God's Blessing (short_or_long_rest, uses ABSENT): recharge string is
    // never value-matched; with uses absent every counter arm skips (buff-flag lane):
    vi.clearAllMocks(); seed({ "_War_Gods_Blessing_freeCastCount": 0 });
    incrementFreeCastResource(PLAYER, 'Shield of Faith', 1, statsWith(warGodsEntry), CAMPAIGN);
    expect(setRuntimeValue).not.toHaveBeenCalled();
    // Fully unengaged character: all stores absent -> zero writes (?. inert).
    vi.clearAllMocks(); seed({});
    incrementFreeCastResource(PLAYER, 'Fireball', 3, makePlayerStats(), CAMPAIGN);
    expect(setRuntimeValue).not.toHaveBeenCalled();
    // arity pin vs REAL runtime signature (playerName, spellName, spellLevel, playerStats, campaignName)
    expect(incrementFreeCastResource.length).toBe(5);
  });
});
