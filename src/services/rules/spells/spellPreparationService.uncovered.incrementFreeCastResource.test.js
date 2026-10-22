// @maintained-by-ai
// ---------------------------------------------------------------------------
// uncovered.incrementFreeCastResource.test.js — uses_expression SHARED-BRANCH
// loop arms, RESTORE (rollback) side only. Routed by the MASTER table (base
// header: "uses_expression/perSpell/type-filter loop arms -> uncovered.*") and
// the maintained cross-file dedup map (incrementFreeCastResource.test.js:57-59):
// owns level-match +1, at-cap no-write, featureLevel-mismatch continue,
// spell-mismatch fallthrough. Producer ledgers (favored/NR/Bewitching/arcanum/
// recharge) and the featureLevel-null spell-match POSITIVE face live in #1512 —
// fey disk row :288-292 is that face's live pin (cited, never re-pinned; here
// only its negative fallthrough arm is pinned). #1512 incoming cite honored:
// "Removed T3 uses_expression :117 — byte-equivalent covered by
// uncovered.incrementFreeCastResource.test.js:77" — :77 below is that live
// level-match refund face, preserved.
// DISK CENSUS (readFileSync at import, both rulesets, FREE_CAST_ENTRY_TYPES):
// 18 rows total; usable uses_expression (text AND usesMax): EXACTLY 1 — Fey
// Reinforcements (2024/classes.json, uses_expression:'1'+usesMax:1, live in
// #1512); SIX rows carry uses_expression WITHOUT usesMax -> gate false-arm,
// rollback-inert (Favored Enemy, Star Map, Contact Patron, Misty Wanderer,
// Detect Thoughts, 'Level 1 Spell' — #1512 pins the Detect Thoughts shape);
// NO disk row anywhere has spell /level \d+/ — and no builder produces one
// (automationInfoBuilder/spell.js copies auto.spell verbatim): the
// featureLevel!==null arm of parseFeatureSpellLevel is DEFENSIVE, pinned with
// the cla229 baked-row precedent (rules.cla229-usesMax.test.js:34 "exactly the
// shape buildAttackInfo froze"): real disk row 'Level 1 Spell' + TWO documented
// derived bytes only (#1520 derived-only): spell:'' -> 'level 1' (the defensive
// shape) and usesMax absent -> 2 (cla229 post-evaluate shape). Trailing row is
// the verbatim REAL runtime bytes frozen in public/campaigns/test-campaign/
// HexWarlock.json specialActions ('Level 1 Spell [Instance 1]', magic initiate
// collector). Paladin's Smite (real disk, uses:1 long_rest) gets its FIRST live
// rollback pin here — #1512 pins steed/fey only.
// QUIRKS pinned: Number()-vs-parseInt split — stored '1' refunds to NUMBER 2,
// falsy text '' coalesces to 0 and refunds to 1 (:0 no-swallow, distinct ARM
// from #1512's steed-0 recharge row), 'two' -> NaN -> strict count<max DENIES;
// cap source is usesMax NOT uses (seed 1 -> writes 2 kills the uses-as-max and
// the recharge-precedence mutants — the recharge arm's !uses_expression block
// and its uses-arity max are both falsified by that single byte); explicit-null
// /absent coalesce ?? usesMax -> full -> no refund (#1512 contract parity);
// over-cap corrupt store stays stuck (strict <). Reads are arity-2, no
// campaign arg (#1516 — home resource-flow:427-428, pinned once here).
// NO-CLOCK: rollback seam only (rollbackSpellSlot, #1512 header); rest re-arm
// is the LR batch null (restRules lanes). Purity: playerStats JSON snapshot
// asserted on EVERY row (cast helper). Campaign 'test-campaign' on every tuple.
// MOCK CENSUS — exact-of-7 imports (:1-:7): MOCKED 5 direct-path boundaries
// (useRuntimeState get/set only — clearRuntimeState never called; combatData,
// concentrationService, storage, logService: grep-verified never invoked on the
// incrementFreeCastResource call graph — import-side-effect isolation only,
// logService known-dead family-wide); REAL 2 (metamagicRules +
// castingTimeUtils — pure collaborators, never-mock-the-unit rule;
// canned-hollowing ban #1491/#1523 precedent).
// KILL MATRIX (analytic, #1491): gate uses_expression&&usesMax true T1/false
// T3-r2-real-disk-pass; spellMatches level arm T1 vs next T3-r1; spellMatches
// name arm positive cited-#1512/negative T3-r2; ops.shared count<max TRUE all
// T1 rows, FALSE T2 rows (numeric/string/corrupt/null/absent forms); 'break'
// at matched no-write vs continue: T2 trailing planted 0 stays 0; 'next' ->
// T3-r1 trailing refunds 1; fallthrough -> T3-r2 paladin refunds 1; next-vs-
// fallthrough observably identical at the :454 re-check (analytic-only). Each
// row's write byte unique (#1348).
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';

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
vi.mock('../../../services/ui/storage.js', () => ({ default: { set: vi.fn() } }));
vi.mock('../../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve({})) }));

import { incrementFreeCastResource } from './spellPreparationService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

const PLAYER = 'TestWizard';
const CAMPAIGN = 'test-campaign';
const CLS2024 = 'public/data/2024/classes.json';
const FEATS2024 = 'public/data/2024/feats.json';

// #1512 loader verbatim: real disk features, drift-throw, no fabricated bytes.
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

const feyEntry = diskFeature(CLS2024,
  a => a.type === 'fey_reinforcements' && a.spell === 'Summon Fey' && a.usesMax === 1);
const paladinEntry = diskFeature(CLS2024,
  a => a.type === 'free_spell' && a.spell === 'Divine Smite' && a.uses === 1 && a.recharge === 'long_rest');
const level1Disk = diskFeature(FEATS2024,
  a => a.type === 'free_spell' && a.spell === '' && a.uses === 1 && a.uses_expression === '1' && a.recharge === 'long_rest');

// Import-time census guards (disk is law: throws if the census claims above drift).
(() => {
  const FREE_TYPES = ['free_spell', 'fey_reinforcements', 'misty_wanderer', 'dragon_companion'];
  let rows = 0; let usable = 0; let levelText = 0;
  for (const file of ['public/data/classes.json', 'public/data/feats.json', CLS2024, FEATS2024]) {
    const walk = (o) => {
      if (!o || typeof o !== 'object') return;
      if (Array.isArray(o)) { o.forEach(walk); return; }
      const autos = o.automation ? (Array.isArray(o.automation) ? o.automation : [o.automation]) : [];
      for (const a of autos) {
        if (!FREE_TYPES.includes(a.type)) continue;
        rows += 1;
        if (a.uses_expression && a.usesMax) usable += 1;
        if (/level \d+/.test(String(Array.isArray(a.spell) ? a.spell[0] : a.spell || ''))) levelText += 1;
      }
      Object.values(o).forEach(walk);
    };
    walk(JSON.parse(readFileSync(file, 'utf8')));
  }
  const spellNames = new Set((JSON.parse(readFileSync('public/data/2024/spells.json', 'utf8'))).map(s => s.name));
  for (const n of ['Burning Hands', 'Divine Smite', 'Summon Fey']) {
    if (!spellNames.has(n)) throw new Error(`disk drift: ${n} not a real spells.json row`);
  }
  if (rows !== 18 || usable !== 1 || levelText !== 0) {
    throw new Error(`census drift: rows=${rows} usable=${usable} levelText=${levelText} — re-route this lane`);
  }
})();

// STRUCTURAL defensive-shape rows (see header census): derived-only bytes.
const LEVEL_KEY = '_Level_1_Spell_freeCastCount';
const structLevelEntry = { ...level1Disk, spell: 'level 1', usesMax: 2 };
const TRAIL_KEY = '_Level_1_Spell_[Instance_1]_freeCastCount';
const trailingInstanceEntry = { type: 'free_spell', spell: 'Burning Hands', name: 'Level 1 Spell [Instance 1]', uses: 1, recharge: 'long_rest' };
const PALADIN_KEY = "_Paladin's_Smite_freeCastCount";

// key-in-map seed (#1512): explicit null stays distinct from absent inbound.
function seed(store) {
  getRuntimeValue.mockImplementation((_player, key) => (key in store ? store[key] : undefined));
}

function makePlayerStats(entries) {
  return {
    name: PLAYER,
    class: { name: 'Wizard' },
    spellAbilities: {},
    automation: { actions: entries, bonusActions: [], specialActions: [], passives: [] },
  };
}

function cast(spellName, spellLevel, entries, store) {
  vi.clearAllMocks();
  seed(store || {});
  const stats = makePlayerStats(entries);
  const snapshot = JSON.stringify(stats);
  incrementFreeCastResource(PLAYER, spellName, spellLevel, stats, CAMPAIGN);
  expect(JSON.stringify(stats)).toBe(snapshot);
  return stats;
}

describe('incrementFreeCastResource — uses_expression loop arms (generic rollback faces)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seed({});
  });

  it('increments freeCastCount when featureLevel matches and count < usesMax — cap source usesMax not uses, Number() coercion, :0 no-swallow, NaN text denied', () => {
    // [stored, written]: 1->2 anchor byte (uses:1 on disk would cap at 1 — the
    // write of 2 kills uses-as-max AND recharge precedence); '1'->2 Number-coerce
    // to NUMBER; ''->1 falsy-text refunds as zero; 0->1 no :0-swallow.
    for (const [stored, next] of [[1, 2], ['1', 2], ['', 1], [0, 1]]) {
      cast('Burning Hands', 1, [structLevelEntry], { [LEVEL_KEY]: stored });
      expect(setRuntimeValue.mock.calls).toEqual([[PLAYER, LEVEL_KEY, next, CAMPAIGN]]);
      expect(getRuntimeValue).toHaveBeenCalledWith(PLAYER, LEVEL_KEY); // arity-2 read (#1516 home-cited)
    }
    // NaN family: strict count<max denies junk text (and breaks before trailing).
    cast('Burning Hands', 1, [structLevelEntry, trailingInstanceEntry], { [LEVEL_KEY]: 'two', [TRAIL_KEY]: 0 });
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('count<max FALSE arm (T2 kill anchor): at-cap numeric/string/corrupt-over-cap, explicit-null/absent coalesce to full and deny; matched-entry breaks even denying — planted trailing 0 survives', () => {
    for (const stored of [2, '2', 5, null]) {
      cast('Burning Hands', 1, [structLevelEntry], { [LEVEL_KEY]: stored });
      expect(setRuntimeValue).not.toHaveBeenCalled();
    }
    cast('Burning Hands', 1, [structLevelEntry], {}); // absent -> ?? usesMax -> full
    // 'break' vs continue: trailing entry WOULD refund 0->1 if the scan reached it.
    cast('Burning Hands', 1, [structLevelEntry, trailingInstanceEntry], { [LEVEL_KEY]: 2, [TRAIL_KEY]: 0 });
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it("loop continue arms: featureLevel-mismatch returns next (counter never read; trailing real builder-shaped row refunds 0->1), null-text spell-mismatch falls through to real-disk Paladin's Smite first live rollback pin", () => {
    cast('Burning Hands', 5, [structLevelEntry, trailingInstanceEntry], { [TRAIL_KEY]: 0 });
    expect(setRuntimeValue.mock.calls).toEqual([[PLAYER, TRAIL_KEY, 1, CAMPAIGN]]);
    expect(getRuntimeValue).not.toHaveBeenCalledWith(PLAYER, LEVEL_KEY); // 'next' short-circuits before the read
    // fey gate engaged with null-text spell mismatch -> fallthrough -> miss -> scan
    // continues to the REAL Paladin's Smite disk row (first live rollback, unique byte).
    cast('Divine Smite', 2, [feyEntry, paladinEntry], { [PALADIN_KEY]: 0 });
    expect(setRuntimeValue.mock.calls).toEqual([[PLAYER, PALADIN_KEY, 1, CAMPAIGN]]);
  });
});
