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
//   favored enemy    -> fix#341(b): SYMMETRIC CHANNEL — read AND write
//                       'favoredEnemyUses', capped at the disk Ranger class_levels
//                       'favored_enemy' column (Math.max(1, column) — the UI ceiling);
//                       at-cap/null/absent write NOTHING; a non-finite byte refuses LOUD
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

// Bewitching Magic runtime passive form (passiveCollector output): the 2024 disk feature's
// automation is an ARRAY [{type:'bewitching_magic', casting_time:'passive'}] — the SAME
// store key '_Bewitching_Magic_freeCast' the Bewitching consume/rollback ledgers gate on
// (postCastRiderService.js:239-247 filters playerStats.automation.passives by type).
// Disk drift throws rather than fabricating bytes (lane streak form).
function bewitchingPassive() {
  const data = JSON.parse(readFileSync(CLS2024, 'utf8'));
  let automation = null;
  const walk = (o) => {
    if (automation || !o || typeof o !== 'object') return;
    if (Array.isArray(o)) { o.forEach(walk); return; }
    if (o.name === 'Bewitching Magic') {
      automation = [].concat(o.automation || []).find(a => a && a.type === 'bewitching_magic') || null;
      return;
    }
    Object.values(o).forEach(walk);
  };
  walk(data);
  if (!automation) throw new Error('disk drift: 2024 Bewitching Magic automation row missing — #1512 rollback feature-gate depends on it');
  return { name: 'Bewitching Magic', ...JSON.parse(JSON.stringify(automation)) };
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
      // read tier: the arcanum counter now carries the explicit campaign arg (family unification)
      expect(getRuntimeValue).toHaveBeenCalledWith(PLAYER, key, CAMPAIGN);
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

  // fix#341(b) (#337S ':629-637' row) FLIP — was: 'reads _Favored_Enemy_freeCastCount,
  // writes DIFFERENT key favoredEnemyUses UNCAPPED'. The restore lane now reads AND
  // writes the SAME structure — the 'favoredEnemyUses' ledger (symmetric channel,
  // #1520 law) — capped at the disk grant. Disk law BY-NAME, public/data/2024/classes.json
  // Ranger lv1 'Favored Enemy': "You can cast it twice without expending a spell slot,
  // and you regain all expended uses when you finish a Long Rest" + automation
  // uses_expression:'favored_enemy_min_1'. The numeric cap is the Ranger class_levels
  // 'favored_enemy' column, loaded live (drift-throw) — lv1: 2 (ladder 2/3/4/5/6).
  it('Favored Enemy restore fix#341(b): symmetric channel — reads AND writes favoredEnemyUses, capped at the disk column; latch never touched by this lane; null/absent skip; NaN refuses loud', () => {
    const ranger = JSON.parse(readFileSync(CLS2024, 'utf8')).find(c => c.name === 'Ranger');
    const lv1 = ranger.class_levels.find(cl => cl.level === 1);
    if (lv1.favored_enemy !== 2) throw new Error(`disk drift: 2024 Ranger lv1 favored_enemy changed (${lv1.favored_enemy}) — re-read classes.json`);
    const stats = makePlayerStats({ class: { name: 'Ranger', class_levels: ranger.class_levels }, level: 1 });
    // write rows: below-cap refunds +1, exact bytes; at-cap writes NOTHING (FREE_CAST_RESTORE_OPS.shared :409 clamp mirror)
    const writes = [
      [0, 1, 'spent-0 (consume stamp) refunds to exactly 1'],
      [1, 2, 'one below the disk cap refunds to exactly the cap'],
    ];
    for (const [stored, next] of writes) {
      vi.clearAllMocks(); seed({ favoredEnemyUses: stored });
      incrementFreeCastResource(PLAYER, 'Hunter\'s Mark', 1, stats, CAMPAIGN);
      expect(setRuntimeValue.mock.calls).toEqual([[PLAYER, 'favoredEnemyUses', next, CAMPAIGN]]); // SAME key it read
      expect(getRuntimeValue).toHaveBeenCalledWith(PLAYER, 'favoredEnemyUses', CAMPAIGN); // symmetric-channel READ
      expect(getRuntimeValue.mock.calls.filter(c => c[1] === '_Favored_Enemy_freeCastCount')).toEqual([]); // latch dark: the adjust twin owns it
    }
    // at-cap and past-cap: zero writes — cancels can no longer mint uses the disk never granted
    for (const stored of [2, 5]) {
      vi.clearAllMocks(); seed({ favoredEnemyUses: stored });
      incrementFreeCastResource(PLAYER, 'Hunter\'s Mark', 1, stats, CAMPAIGN);
      expect(setRuntimeValue).not.toHaveBeenCalled(); // capped (pre-fix UNCAPPED quirk retired)
    }
    // null/absent (LR re-arm byte / never-consumed): restore-merge face — nothing to refund
    for (const skipped of [null, undefined]) {
      vi.clearAllMocks(); seed({ favoredEnemyUses: skipped });
      incrementFreeCastResource(PLAYER, 'Hunter\'s Mark', 1, stats, CAMPAIGN);
      expect(setRuntimeValue).not.toHaveBeenCalled();
    }
    // corrupt byte: LOUD refusal, zero writes (no-fallbacks law)
    vi.clearAllMocks(); seed({ favoredEnemyUses: 'two' });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    incrementFreeCastResource(PLAYER, 'Hunter\'s Mark', 1, stats, CAMPAIGN);
    expect(setRuntimeValue).not.toHaveBeenCalled();
    const refused = errSpy.mock.calls.filter(c => String(c[0]).includes('Favored Enemy restore refused'));
    expect(refused.length).toBe(1); // exact-of-1, never silent
    errSpy.mockRestore();
    // symmetric-channel proof (restore-then-read-sees-restored): feed the byte the
    // restore WROTE back as the next READ of the SAME key — the second refund climbs
    // from it (0 -> 1 -> 2, then capped): the lane consumes its own writes.
    vi.clearAllMocks();
    seed({ favoredEnemyUses: 0 });
    incrementFreeCastResource(PLAYER, 'Hunter\'s Mark', 1, stats, CAMPAIGN);
    const written = setRuntimeValue.mock.calls[0][2];
    expect(written).toBe(1);
    const store2 = { favoredEnemyUses: written }; // the REAL store persists the write
    getRuntimeValue.mockImplementation((_p, key) => (key in store2 ? store2[key] : undefined));
    vi.clearAllMocks();
    incrementFreeCastResource(PLAYER, 'Hunter\'s Mark', 1, stats, CAMPAIGN);
    expect(setRuntimeValue.mock.calls).toEqual([[PLAYER, 'favoredEnemyUses', 2, CAMPAIGN]]); // read of the RESTORED byte drives the next refund
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

  it('Bewitching rollback #1512 FIXED: cancelled free-cast RESTORES the armed latch — consumed-null re-arms TRUE (pre-fix byte: no write, arm permanently spent); intact arm never nulled (pre-fix byte: null-drop); false/wrong-spell/featureless inert', () => {
    const bewitchStats = makePlayerStats({ automation: { actions: [], bonusActions: [], specialActions: [], passives: [bewitchingPassive()] } });
    // consumed-null (consume :502-504 already nulled) + cancel -> re-arm TRUE:
    seed({ '_Bewitching_Magic_freeCast': null });
    incrementFreeCastResource(PLAYER, 'Misty Step', 2, bewitchStats, CAMPAIGN);
    expect(setRuntimeValue.mock.calls).toEqual([[PLAYER, '_Bewitching_Magic_freeCast', true, CAMPAIGN]]);
    // absent-store parity (REAL useRuntimeState answers null for missing keys):
    vi.clearAllMocks(); seed({});
    incrementFreeCastResource(PLAYER, 'Misty Step', 2, bewitchStats, CAMPAIGN);
    expect(setRuntimeValue.mock.calls).toEqual([[PLAYER, '_Bewitching_Magic_freeCast', true, CAMPAIGN]]);
    // cancel-before-consume: the arm is still TRUE — rollback leaves it byte-intact
    // (pre-fix this row wrote explicit null, erasing the feature state entirely):
    vi.clearAllMocks(); seed({ '_Bewitching_Magic_freeCast': true });
    incrementFreeCastResource(PLAYER, 'Misty Step', 2, bewitchStats, CAMPAIGN);
    expect(setRuntimeValue).not.toHaveBeenCalled();
    // explicit false (sheet-disarmed byte, != null strict) stays disarmed — rollback never revives:
    vi.clearAllMocks(); seed({ '_Bewitching_Magic_freeCast': false });
    incrementFreeCastResource(PLAYER, 'Misty Step', 2, bewitchStats, CAMPAIGN);
    expect(setRuntimeValue).not.toHaveBeenCalled();
    // wrong-spell gate:
    vi.clearAllMocks(); seed({ '_Bewitching_Magic_freeCast': null });
    incrementFreeCastResource(PLAYER, 'Thunderous Smite', 2, bewitchStats, CAMPAIGN);
    expect(setRuntimeValue).not.toHaveBeenCalled();
    // featureless caster: rollback never fabricates an arm it cannot verify:
    vi.clearAllMocks(); seed({ '_Bewitching_Magic_freeCast': null });
    incrementFreeCastResource(PLAYER, 'Misty Step', 2, makePlayerStats(), CAMPAIGN);
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('used-flag rollbacks: Signature Spells restore is LEVEL-FREE #1512 FIXED (pre-fix quirk: hardcoded spellLevel===3, lv5/7/9 cancelled casts never restored) — restore-merge refunds CONSUMED latches only; Divination Savant unchanged', () => {
    const stats = makePlayerStats();
    // consumed latch (consume :512-516 stamped true) at the paid lv3 — restored to false:
    seed({ 'SignatureSpells_selection': ['Teleportation Circle'], 'SignatureSpells_Teleportation_Circle_used': true });
    incrementFreeCastResource(PLAYER, 'Teleportation Circle', 3, stats, CAMPAIGN);
    expect(setRuntimeValue.mock.calls).toEqual([[PLAYER, 'SignatureSpells_Teleportation_Circle_used', false, CAMPAIGN]]);
    // lv5/7/9 cancels of a CONSUMED signature latch now restore (pre-fix bytes: zero writes):
    for (const lv of [5, 7, 9]) {
      vi.clearAllMocks();
      seed({ 'SignatureSpells_selection': ['Teleportation Circle'], 'SignatureSpells_Teleportation_Circle_used': true });
      incrementFreeCastResource(PLAYER, 'Teleportation Circle', lv, stats, CAMPAIGN);
      expect(setRuntimeValue.mock.calls).toEqual([[PLAYER, 'SignatureSpells_Teleportation_Circle_used', false, CAMPAIGN]]);
    }
    // fresh latches (null = LR-batch re-arm byte / false / absent): zero writes —
    // the restore-merge guard (fix#27 family) refunds only what consume actually stamped:
    for (const fresh of [null, false, undefined]) {
      vi.clearAllMocks();
      seed({ 'SignatureSpells_selection': ['Teleportation Circle'], 'SignatureSpells_Teleportation_Circle_used': fresh });
      incrementFreeCastResource(PLAYER, 'Teleportation Circle', 3, stats, CAMPAIGN);
      expect(setRuntimeValue).not.toHaveBeenCalled();
    }
    // off-list spell never touches a consumed foreign latch:
    vi.clearAllMocks();
    seed({ 'SignatureSpells_selection': ['Teleportation Circle'], 'SignatureSpells_Counterspell_used': true });
    incrementFreeCastResource(PLAYER, 'Counterspell', 3, stats, CAMPAIGN);
    expect(setRuntimeValue).not.toHaveBeenCalled();

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
