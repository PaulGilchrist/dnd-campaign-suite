// @maintained-by-ai
// FT-087 Spell Sniper base lane — damageCalculation.js module-direct face (owner split #1468):
//   computeRange -> THIS FILE (FT-087 clause (d) spellRangeBonus, git a6c37627f "test-locked";
//   automations-manifest.json FT-087 cites damageCalculation:22 as the +60 consumer pin).
//   attack-roll step -> attackRollDamageCalc-cla120; spellContext dedupe -> directSpellDamageSteps-cla120;
//   potent-cantrip seam -> attackPostProcessing-cla120-potent-cantrip; AoE payload -> savePath-aoe-empowered-evocation;
//   chain-level bake -> spellCastService.test.js master.
//   computeEmpoweredEvocation fold-once face -> damageCalculation-cla120.test.js (cited, NOT re-grown here;
//   this lane never calls the EE selectors — pinned below as lane isolation).
// Non-EE exported surfaces owned here (index.js call-site evidence, dead-export hunt clean):
//   computeRange :733 | computeBlessedStrikes :735 | computeRadiantSoul :736 | computeOverchannel :742.
// Range-text parsing (feet regex, plurals, numeric, Touch/Self) is owned by
// src/services/rules/combat/rangeValidation.test.js; this module only DELEGATES
// (rangeToFeet/computeEffectiveSpellRange/getDistanceFeet/computeRangeEffect) — no
// hand-rolled distance math lives here, so only the delegation boundary + the >=10 gate
// in applyRangeBonus are pinned.
// Quirk ledger (fresh scan, golden-pinned):
//   - :21 cantrip gate reads spell.level only; upcast producer
//     useSimpleSpellHandlers.js:168 stamps {level:slotLevel, baseLevel:0} -> upcast cantrip
//     LOSES cantripRangeBonus here while computeBlessedStrikes:62 accepts baseLevel (T2/T4 pair).
//   - fix#1469(b) :79/:95: null base no longer concatenates literally — appendBonusTerm
//     logs console.error and returns the base unchanged (never interpolate raw null;
//     callers still guarantee a formula via noSavePath early-return, module now guards too).
//   - :89 playerStats.name deref runs before the passive gate — missing name is a TypeError
//     with console untouched (#1360 family).
//   - :118 getRuntimeValue arity is 2 — matches REAL useRuntimeState.js:63 signature;
//     setRuntimeValue write is 4-args, arity-checked vs REAL :78.
//   - fix#1469(c) :123: appendBonusTerm dedupes on the marker — re-entry keeps
//     [Overchannel Maximize] EXACTLY ONCE (#1348) while the use-count writer still climbs
//     (contrast :48 EE dedupe owned by the cla120 lane).
// NO-CLOCK: pure grid-distance + string fold, zero timers/Date in unit or fixtures.
// HP-key: only computeOverchannel writes, and writes only 'Overchannel_useCount'.
// Campaign lockdown: every runtime write asserted targets 'test-campaign' only.
// Security: no external/injected content applied (kiro #1446) — edits derive solely from
// repo source, disk data (public/data/spells.json, 2024/spells.json, 2024/feats.json,
// 2024/classes.json), and the task instruction.
// old -> new test map (6 -> 10): all 6 old tests kept-but-strengthened below; 4 NEW tests cover the
// non-EE exported surfaces this lane owns per #1468 (computeBlessedStrikes/computeRadiantSoul/
// computeOverchannel were module-direct-untested — siblings only vi.mock them as index.js stubs).
//   'adds spellRangeBonus ... (holder hits beyond base band)' -> T1 (name corrected: computeRange
//      returns no-auto-miss, never 'hits'; +60 moved the auto-miss bound 60 -> 180, boundary bytes pinned)
//   'without the feat, auto-misses beyond double the base range' -> T1 control row (exact reason byte)
//   'does not add spellRangeBonus to saving-throw spells (dc present)' -> T2 rows 1-2 (disk-backed)
//   'does not add spellRangeBonus for spells with base range under 10 ft' -> T2 rows 4-6
//      (fabricated spell 'Touch Attack' removed -> disk byte Shocking Grasp 'Touch'; 9/10 ft boundary rides
//      a range-only spread on the real 2024 Poison Spray row — 5e Poison Spray is '10 feet' but carries a dc)
//   'stacks with Distant Metamagic' -> T1 distant rows (240-bound byte added)
//   'keeps cantripRangeBonus behavior unchanged' -> T2 rows 7-9 (+120 synthetic replaced by disk +300 from
//      Improved Elemental Fury via featRangeService.js:52 producer chain)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cloneDeep } from 'lodash';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Range-free collaborator isolation: computeRange/blessed/radiant/overchannel never touch the
// EE selectors (owned by damageCalculation-cla120.test.js); byte-equivalent copies of the real
// selectors (postCastRiderService.js) so the mock cannot lie, plus not-called assertions below.
vi.mock('../../postCastRiderService.js', () => ({
  getEmpoweredEvocationFeatures: vi.fn(),
  getEmpoweredEvocationIntModifier: vi.fn(),
}));

// REAL setRuntimeValue fetches (useRuntimeState.js:110) — mock the network edge. getRuntimeValue
// must exist in the factory too: rangeCheck.js (auto-loaded via rangeValidation.js) imports it;
// this lane injects its own spy where a read is wanted.
vi.mock('../../../../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(),
  getRuntimeValue: vi.fn(),
}));

import { computeRange, computeBlessedStrikes, computeRadiantSoul, computeOverchannel } from './damageCalculation.js';
import { getEmpoweredEvocationFeatures, getEmpoweredEvocationIntModifier } from '../../postCastRiderService.js';
import { setRuntimeValue } from '../../../../../hooks/runtime/useRuntimeState.js';

const readDisk = (p) => JSON.parse(readFileSync(join(process.cwd(), p), 'utf8'));
const spellByName = (list, name) => {
  const sp = list.find((s) => s.name === name);
  if (!sp) throw new Error(`disk row missing: ${name}`);
  return sp;
};

const spells5e = readDisk('public/data/spells.json');
const spells24 = readDisk('public/data/2024/spells.json');
const feats24 = readDisk('public/data/2024/feats.json');
const classes24 = readDisk('public/data/2024/classes.json');

const PS24 = spellByName(spells24, 'Poison Spray');       // 30 feet, ranged, NO dc — FT-087 eligible
const PS5 = spellByName(spells5e, 'Poison Spray');         // 10 feet but carries dc CON — disk oddity
const SF24 = spellByName(spells24, 'Sacred Flame');        // 60 feet, ranged WITH dc — save spell
const TOLL24 = spellByName(spells24, 'Toll the Dead');     // 60 feet, attack_type null, dc WIS
const SG24 = spellByName(spells24, 'Shocking Grasp');      // 'Touch' (=8 ft), melee, no dc
const CO24 = spellByName(spells24, 'Chromatic Orb');       // lv1, 90 feet, ranged
const GB24 = spellByName(spells24, 'Guiding Bolt');        // lv1, Radiant, '4d6'
const FIREBALL24 = spellByName(spells24, 'Fireball');      // lv3, Fire, '8d6'
const CHILL24 = spellByName(spells24, 'Chill Touch');      // Necrotic — radiant mismatch control
const PF24 = spellByName(spells24, 'Produce Flame');       // range 'Self' — null-parse control
const SPD24 = spellByName(spells24, 'Spare the Dying');    // damage null — no-damage control

// Disk-backed feat values (never hardcoded): Spell Sniper +60 (2024 disk only — 5e Spell Sniper
// feats.json row has no spellRangeBonus), Improved Elemental Fury +300 cantrip range.
const SNIPER_BONUS = spellByName(feats24, 'Spell Sniper').rangeEffects.spellRangeBonus; // 60
const ief = classes24
  .find((c) => c.name === 'Druid')
  .class_levels.find((l) => l.level === 15)
  .features.find((f) => f.name === 'Improved Elemental Fury');
const RAW_CRB = Array.isArray(ief.automation) ? ief.automation.map((a) => a.rangeBonusCantrip).filter(Boolean)[0] : ief.automation.rangeBonusCantrip;
if (!RAW_CRB) throw new Error('disk drift: Improved Elemental Fury lost rangeBonusCantrip');
const CANTRIP_BONUS = Number(String(RAW_CRB).match(/(\d+)/)[1]); // 300

const cleric7 = classes24.find((c) => c.name === 'Cleric').class_levels.find((l) => l.level === 7);
const BLESSED = cleric7.features.find((f) => f.name === 'Blessed Strikes');
const IMPROVED_BS = classes24.find((c) => c.name === 'Cleric').class_levels.find((l) => l.level === 14).features.find((f) => f.name === 'Improved Blessed Strikes');
const RS_FEATURE = classes24.find((c) => c.name === 'Warlock').majors.find((m) => m.name === 'Celestial Patron').features.find((f) => f.name === 'Radiant Soul');
const RS_AUTO = RS_FEATURE.automation.find((a) => a.type === 'radiant_soul');
const OC_AUTO = classes24.find((c) => c.name === 'Wizard').majors.find((m) => m.name === 'Evoker').features.find((f) => f.name === 'Overchannel').automation;

// Producer shapes flattened byte-for-byte:
// actions row ~ automationCollector flatten; radiant passive ~ core-handlers.js:446-455 verbatim.
const BS_ACTION = { name: BLESSED.name, ...BLESSED.automation };
const IBS_ACTION = { name: IMPROVED_BS.name, ...IMPROVED_BS.automation };
const RS_PASSIVE = {
  type: 'radiant_soul',
  name: RS_FEATURE.name,
  damageTypes: RS_AUTO.damageTypes,
  damageExpression: RS_AUTO.damageExpression,
  oncePerTurn: !!RS_AUTO.oncePerTurn,
  hasAutomation: true,
};
const OC_PASSIVE = { name: 'Overchannel', ...OC_AUTO };
const GB = GB24.damage.damage_at_slot_level['1'];       // '4d6' disk byte
const FB = FIREBALL24.damage.damage_at_slot_level['3'];  // '8d6' disk byte

// Grid positions: FEET_PER_CELL=5 is rangeValidation's (delegated, cited) — straight-Y axis.
const ATK = { gridX: 0, gridY: 0 };
const at = (ft) => {
  if (!Number.isInteger(ft / 5)) throw new Error(`non-grid distance: ${ft}`);
  return { gridX: 0, gridY: ft / 5 };
};

const MISS = (reason) => ({ isAutoMiss: true, rangeReason: reason });

describe('computeRange — FT-087 Spell Sniper band arithmetic (damageCalculation.js:15)', () => {
  beforeEach(() => {
    // disk-drift alarms: bytes this lane pins must still match disk.
    expect([PS24.range, PS24.level, PS24.attack_type, 'dc' in PS24]).toEqual(['30 feet', 0, 'ranged', false]);
    expect([SF24.range, !!SF24.dc]).toEqual(['60 feet', true]);
    expect(SNIPER_BONUS).toBe(60);
    getEmpoweredEvocationFeatures.mockReset();
    getEmpoweredEvocationIntModifier.mockReset();
    getEmpoweredEvocationFeatures.mockImplementation((ps) => (ps.automation?.passives ?? []).filter((p) => p.type === 'empowered_evocation'));
    getEmpoweredEvocationIntModifier.mockImplementation((ps) => (ps.abilities?.find((a) => a.name === 'Intelligence')?.bonus) || 0);
    vi.mocked(setRuntimeValue).mockReset();
  });

  it('moves the auto-miss bound exactly +60 (clause (d), disk 2024) and stacks with Distant multiplicatively', () => {
    const feat = { spellRangeBonus: SNIPER_BONUS };
    const distant = { metamagicDistant: true };
    const psSnapshot = cloneDeep(PS24);

    // base 30 ft: auto-miss beyond 2x30 = 60 (control, unchanged)
    expect(computeRange(PS24, {}, ATK, at(65), {})).toStrictEqual(MISS('Out of range (65 ft > 60 ft)'));
    // +60: effective 90, auto-miss bound 60 -> (30+60)x2 = 180
    expect(computeRange(PS24, {}, ATK, at(65), feat)).toStrictEqual({});
    expect(computeRange(PS24, {}, ATK, at(175), feat)).toStrictEqual({});
    expect(computeRange(PS24, {}, ATK, at(185), feat)).toStrictEqual(MISS('Out of range (185 ft > 180 ft)'));
    // Distant doubles base to 60 first (computeEffectiveSpellRange), then +60 -> 120, bound 240
    expect(computeRange(PS24, distant, ATK, at(125), {})).toStrictEqual(MISS('Out of range (125 ft > 120 ft)'));
    expect(computeRange(PS24, distant, ATK, at(125), feat)).toStrictEqual({});
    expect(computeRange(PS24, distant, ATK, at(245), feat)).toStrictEqual(MISS('Out of range (245 ft > 240 ft)'));

    // purity + lane isolation (EE face belongs to the cla120 lane)
    expect(PS24).toStrictEqual(psSnapshot);
    expect(getEmpoweredEvocationFeatures).not.toHaveBeenCalled();
    expect(getEmpoweredEvocationIntModifier).not.toHaveBeenCalled();
    expect(vi.mocked(setRuntimeValue)).not.toHaveBeenCalled();
  });

  it('eligibility gates: dc-present, attack_type absent, <10 ft, leveled-vs-cantrip (disk rows)', () => {
    const feat = { spellRangeBonus: SNIPER_BONUS };
    const rows = [
      // save spells excluded even when attack_type is present: Sacred Flame eff stays 60, bound 120
      { label: 'dc present (Sacred Flame)', spell: SF24, metaCtx: {}, featEffects: feat, target: at(125), expect: MISS('Out of range (125 ft > 120 ft)') },
      // 5e disk oddity: Poison Spray carries BOTH attack_type and dc CON -> excluded by the !dc gate
      { label: '5e Poison Spray dc oddity', spell: PS5, metaCtx: {}, featEffects: feat, target: at(25), expect: MISS('Out of range (25 ft > 20 ft)') },
      // attack_type null (Toll the Dead): !!null is false -> excluded
      { label: 'attack_type null', spell: TOLL24, metaCtx: {}, featEffects: feat, target: at(125), expect: MISS('Out of range (125 ft > 120 ft)') },
      // 'Touch' = 8 ft < 10 -> bonus skipped; still inside the melee band so the REASON proves the band
      { label: 'Touch melee <10 stays melee band', spell: SG24, metaCtx: {}, featEffects: feat, target: at(15), expect: MISS('Target out of melee range (15 ft > 8 ft)') },
      // exactly 10 ft passes the >=10 gate (boundary): eff 30+60=70, 65 ft is inside
      { label: 'exactly 10 ft boundary passes', spell: { ...PS24, range: '10 feet' }, metaCtx: {}, featEffects: feat, target: at(65), expect: {} },
      // 9 ft fails the >=10 gate: eff stays 9, bound 18 — reason byte proves no +60 was folded
      { label: '9 ft boundary skipped', spell: { ...PS24, range: '9 feet' }, metaCtx: {}, featEffects: feat, target: at(65), expect: MISS('Out of range (65 ft > 18 ft)') },
      // cantripRangeBonus (disk +300, Improved Elemental Fury) is level-0 only: leveled Chromatic Orb denied
      { label: 'leveled denied cantripRangeBonus', spell: CO24, metaCtx: {}, featEffects: { cantripRangeBonus: CANTRIP_BONUS }, target: at(200), expect: MISS('Out of range (200 ft > 180 ft)') },
      // same bonus, real cantrip: 30+300=330 -> 200 ft passes
      { label: 'cantrip gets cantripRangeBonus', spell: PS24, metaCtx: {}, featEffects: { cantripRangeBonus: CANTRIP_BONUS }, target: at(200), expect: {} },
      // QUIRK: upcast producer useSimpleSpellHandlers.js:168 stamps {level:slotLevel, baseLevel:0} —
      // computeRange:21 reads only spell.level, so the upcast cantrip LOSES the bonus
      // (computeBlessedStrikes:62 accepts baseLevel — pin the asymmetry, reported as source quirk).
      { label: 'upcast-cantrip shape loses cantripRangeBonus', spell: { ...PS24, level: 3, baseLevel: 0 }, metaCtx: {}, featEffects: { cantripRangeBonus: CANTRIP_BONUS }, target: at(200), expect: MISS('Out of range (200 ft > 60 ft)') },
    ];
    for (const row of rows) {
      const before = cloneDeep(row.spell);
      expect(computeRange(row.spell, row.metaCtx, ATK, row.target, row.featEffects), row.label).toStrictEqual(row.expect);
      expect(row.spell, row.label).toStrictEqual(before); // inputs never mutated
    }
  });

  it('guard contract: missing positions, Self/Special ranges, absent metaCtx/featEffects', () => {
    const feat = { spellRangeBonus: SNIPER_BONUS, cantripRangeBonus: CANTRIP_BONUS };
    // gridless leniency (FT-087 live note: chip lane omits pos — computeRange must pass, never invent a miss)
    expect(computeRange(PS24, {}, null, at(500), feat)).toStrictEqual({});
    expect(computeRange(PS24, {}, ATK, undefined, feat)).toStrictEqual({});
    // 'Self' parses to null (rangeValidation) -> early {}, even with every bonus armed
    expect(computeRange(PF24, {}, ATK, at(500), feat)).toStrictEqual({});
    expect(computeRange({ ...PS24, range: 'Special' }, {}, ATK, at(500), feat)).toStrictEqual({});
    // numeric range byte parses identically to the plural text form (#1413 family — delegated parse)
    expect(computeRange({ ...PS24, range: 30 }, {}, ATK, at(65), {})).toStrictEqual(MISS('Out of range (65 ft > 60 ft)'));
    // undefined collaborators ride the declared defaults (:18 metaCtx = {}, :25 featEffects ?? {})
    expect(computeRange(PS24, undefined, ATK, at(65), undefined)).toStrictEqual(MISS('Out of range (65 ft > 60 ft)'));
    expect(computeRange(PS24, { metamagicDistant: true }, ATK, at(125), undefined)).toStrictEqual(MISS('Out of range (125 ft > 120 ft)'));
  });
});

describe('computeBlessedStrikes — Wisdom-on-cantrip fold (damageCalculation.js:61)', () => {
  const cleric = (wis) => ({ name: 'TestCleric', abilities: wis === undefined ? [] : [{ name: 'Wisdom', bonus: wis }], automation: { actions: [BS_ACTION] } });

  it('applies +WIS once when the chosen option is Spellcasting and denies every skipped gate (disk byte table)', () => {
    const F = PS24.damage.damage_at_slot_level['0']; // '1d12' disk byte
    const rows = [
      { label: 'chosen Potent Spellcasting folds +5', spell: PS24, ps: cleric(5), chosen: 'Potent Spellcasting', expect: '1d12 + 5 [Blessed Strikes]', reads: 1 },
      { label: 'choice is case-normalized', spell: PS24, ps: cleric(5), chosen: 'potent spellcasting', expect: '1d12 + 5 [Blessed Strikes]', reads: 1 },
      { label: 'chosen Divine Strike (the other disk option) skips', spell: PS24, ps: cleric(5), chosen: 'Divine Strike', expect: F, reads: 1 },
      { label: 'multi-option with no choice yet skips (:56)', spell: PS24, ps: cleric(5), chosen: undefined, expect: F, reads: 1 },
      { label: 'Wisdom ability absent -> mod 0 skip', spell: PS24, ps: cleric(undefined), chosen: 'Potent Spellcasting', expect: F, reads: 1 },
      { label: 'QUIRK: WIS -2 clamps to 0 (RAW would subtract)', spell: PS24, ps: cleric(-2), chosen: 'Potent Spellcasting', expect: F, reads: 1 },
      { label: 'non-cantrip (Guiding Bolt lv1) skips before any read', spell: GB24, ps: cleric(5), chosen: 'Potent Spellcasting', formula: GB24.damage.damage_at_slot_level['1'], expect: '4d6', reads: 0 },
      { label: 'cantrip without damage (Spare the Dying) skips before any read', spell: SPD24, ps: cleric(5), chosen: 'Potent Spellcasting', formula: null, expect: null, reads: 0 },
      // upcast shape {level:3, baseLevel:0} (useSimpleSpellHandlers.js:168): baseLevel===0 IS honored here —
      // counterpart of the computeRange:21 quirk row above.
      { label: 'upcast-cantrip shape keeps baseLevel gate', spell: { ...PS24, level: 3, baseLevel: 0 }, ps: cleric(3), chosen: 'Potent Spellcasting', expect: '1d12 + 3 [Blessed Strikes]', reads: 1 },
      // fix#1469(b): null formula logs once and passes through — pre-fix capture was
      // 'null + 5 [Blessed Strikes]' literal bytes (flipped honesty pin #1469)
      { label: 'fix#1469(b): null empEvocFormula logs + passes through (never "null +")', spell: PS24, ps: cleric(5), chosen: 'Potent Spellcasting', formula: null, expect: null, reads: 1, errs: 1 },
      // fix#1469(c): fold-once dedupe on the marker (#1348 tag-count-exactly-one)
      { label: 'pre-tagged [Blessed Strikes] base never re-tags (dedupe)', spell: PS24, ps: cleric(5), chosen: 'Potent Spellcasting', formula: '1d12 + 5 [Blessed Strikes]', expect: '1d12 + 5 [Blessed Strikes]', reads: 1 },
    ];
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    for (const row of rows) {
      errSpy.mockClear();
      const grv = vi.fn(() => row.chosen);
      const result = computeBlessedStrikes(row.spell, 'formula' in row ? row.formula : F, row.ps, 'test-campaign', grv);
      expect(result, row.label).toBe(row.expect);
      if (typeof result === 'string') {
        expect(result, row.label).not.toContain('null'); // 'null' substring NEVER appears
        expect((result.match(/\[Blessed Strikes\]/g) ?? []), row.label).toHaveLength(row.expect.includes('[Blessed Strikes]') ? 1 : 0); // #1348
      }
      expect(errSpy.mock.calls, row.label).toHaveLength(row.errs ?? 0);
      expect(grv.mock.calls, row.label).toHaveLength(row.reads);
      if (row.reads) expect(grv.mock.calls[0], row.label).toStrictEqual(['TestCleric', '_Blessed_Strikes_option', 'test-campaign']);
    }
    errSpy.mockRestore();
  });

  it('feature-selection gates: upgraded disk twin never matches, no-actions passes through, single-option auto-applies', () => {
    const F = PS24.damage.damage_at_slot_level['0'];
    // REAL disk twin: Improved Blessed Strikes (lv14) carries upgrades:"Blessed Strikes" — the !a.upgrades
    // guard (:68) is live-data-relevant, not dead.
    const grvUp = vi.fn(() => 'Potent Spellcasting');
    expect(computeBlessedStrikes(PS24, F, { name: 'TestCleric', abilities: [{ name: 'Wisdom', bonus: 5 }], automation: { actions: [IBS_ACTION] } }, 'test-campaign', grvUp)).toBe(F);
    expect(grvUp).not.toHaveBeenCalled(); // :70 find-miss exits before the runtime read

    const grvNoAuto = vi.fn();
    expect(computeBlessedStrikes(PS24, F, { name: 'TestCleric', abilities: [{ name: 'Wisdom', bonus: 5 }] }, 'test-campaign', grvNoAuto)).toBe(F);
    expect(grvNoAuto).not.toHaveBeenCalled();

    // synthetic spread of the REAL row with a single option (scan: no single-option damage_bonus spellcasting row exists on disk):
    // options.length === 1 auto-applies with no stored choice (:58).
    const single = { name: BLESSED.name, ...BLESSED.automation, options: ['Potent Spellcasting'] };
    const grvSingle = vi.fn(() => undefined);
    expect(computeBlessedStrikes(PS24, F, { name: 'TestCleric', abilities: [{ name: 'Wisdom', bonus: 5 }], automation: { actions: [single] } }, 'test-campaign', grvSingle)).toBe('1d12 + 5 [Blessed Strikes]');
    expect(grvSingle.mock.calls[0]).toStrictEqual(['TestCleric', '_Blessed_Strikes_option', 'test-campaign']);
  });
});

describe('computeRadiantSoul — Radiant/Fire Charisma fold (damageCalculation.js:84)', () => {
  const holder = (cha, passives = [RS_PASSIVE]) => ({ name: 'TestCelestial', abilities: cha === undefined ? [] : [{ name: 'Charisma', bonus: cha }], automation: { passives } });
  const KEY = '_radiantSoul_TestCelestial_oncePerTurn';

  beforeEach(() => {
    // disk-drift alarms
    expect(RS_AUTO.damageTypes).toEqual(['Radiant', 'Fire']);
    expect(GB).toBe('4d6');
    expect(FB).toBe('8d6');
    vi.mocked(setRuntimeValue).mockReset();
  });

  it('folds +CHA for matching damage types and clamps every denied gate (disk-byte table)', () => {
    const rows = [
      { label: 'radiant spell folds +4', spell: GB24, formula: GB, cha: 4, onceUsed: false, expect: '4d6 + 4 [Radiant Soul]', reads: 1 },
      { label: 'fire spell folds too (damageTypes [Radiant,Fire])', spell: FIREBALL24, formula: FB, cha: 4, onceUsed: false, expect: '8d6 + 4 [Radiant Soul]', reads: 1 },
      { label: 'spell damage_type case-normalized', spell: { ...GB24, damage: { ...GB24.damage, damage_type: 'radiant' } }, formula: GB, cha: 4, onceUsed: false, expect: '4d6 + 4 [Radiant Soul]', reads: 1 },
      { label: 'once-per-turn latch set -> passthrough (read still happens, never written here)', spell: GB24, formula: GB, cha: 4, onceUsed: true, expect: GB, reads: 1 },
      { label: 'non-matching damage type (Chill Touch Necrotic)', spell: CHILL24, formula: '1d10', cha: 4, onceUsed: false, expect: '1d10', reads: 1 },
      { label: 'CHA 0 skips', spell: GB24, formula: GB, cha: 0, onceUsed: false, expect: GB, reads: 1 },
      { label: 'QUIRK: CHA -1 clamps to 0 (RAW would subtract)', spell: GB24, formula: GB, cha: -1, onceUsed: false, expect: GB, reads: 1 },
      { label: 'Charisma ability absent skips', spell: GB24, formula: GB, cha: undefined, onceUsed: false, expect: GB, reads: 1 },
      { label: 'no radiant passive -> passthrough (key read still runs :89-90)', spell: GB24, formula: GB, cha: 4, onceUsed: false, passives: [], expect: GB, reads: 1 },
      // raw disk automation byte WITHOUT the core-handlers.js:454 hasAutomation stamp -> inert:
      // the gate (:91) requires the producer's stamp, so a collector that forgot it silently loses the feature.
      { label: 'raw disk passive without hasAutomation stamp is inert', spell: GB24, formula: GB, cha: 4, onceUsed: false, passives: [{ type: RS_AUTO.type, name: RS_FEATURE.name, damageTypes: RS_AUTO.damageTypes }], expect: GB, reads: 1 },
      // fix#1469(b): null formula logs once and passes through — pre-fix capture was
      // 'null + 4 [Radiant Soul]' literal bytes (flipped honesty pin #1469)
      { label: 'fix#1469(b): null formula logs + passes through (never "null +")', spell: GB24, formula: null, cha: 4, onceUsed: false, expect: null, reads: 1, errs: 1 },
      // fix#1469(c): fold-once dedupe on the marker (#1348 tag-count-exactly-one)
      { label: 'pre-tagged [Radiant Soul] base never re-tags (dedupe)', spell: GB24, formula: '4d6 + 4 [Radiant Soul]', cha: 4, onceUsed: false, expect: '4d6 + 4 [Radiant Soul]', reads: 1 },
    ];
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    for (const row of rows) {
      errSpy.mockClear();
      const grv = vi.fn(() => row.onceUsed);
      const result = computeRadiantSoul(row.spell, holder(row.cha, row.passives), 'test-campaign', grv, row.formula);
      expect(result, row.label).toBe(row.expect);
      if (typeof result === 'string') {
        expect(result, row.label).not.toContain('null'); // 'null' substring NEVER appears
        expect((result.match(/\[Radiant Soul\]/g) ?? []), row.label).toHaveLength(row.expect.includes('[Radiant Soul]') ? 1 : 0); // #1348
      }
      expect(errSpy.mock.calls, row.label).toHaveLength(row.errs ?? 0);
      expect(grv.mock.calls, row.label).toHaveLength(row.reads);
      expect(grv.mock.calls[0]?.[0], row.label).toBe('TestCelestial');
      expect(grv.mock.calls[0]?.[1], row.label).toBe(KEY);
    }
    errSpy.mockRestore();
    expect(vi.mocked(setRuntimeValue)).not.toHaveBeenCalled(); // read-only latch lane — the consume owner lives elsewhere
  });

  it('missing playerStats.name throws TypeError before any gate, console untouched (#1360 family :89)', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const grv = vi.fn();
    expect(() => computeRadiantSoul(GB24, { abilities: [], automation: { passives: [] } }, 'test-campaign', grv, GB)).toThrow(TypeError);
    expect(errSpy).not.toHaveBeenCalled();
    expect(grv).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });
});

describe('computeOverchannel — maximize tag + use-count writer (damageCalculation.js:101)', () => {
  beforeEach(() => {
    vi.mocked(setRuntimeValue).mockReset();
    expect([OC_PASSIVE.type, OC_PASSIVE.name, BLESSED.name]).toEqual(['overchannel', 'Overchannel', 'Blessed Strikes']);
  });

  it('missing automation.passives degrades LOUD, never dies (fix#126-boundary #1495 flip of the retired hard-error pin): exact console byte, deny-table off-shape, zero reads/writes', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const grv = vi.fn();
    const base = { campaignName: 'test-campaign', getRuntimeValue: grv, empEvocFormula: null, baseFormula: FB };
    // Pre-fix capture (this pin threw, killing executeSpellCast whole at index.js:875):
    // 'playerStats.automation.passives is required for overchannel check' + rider-zero.
    const emptyAuto = computeOverchannel({ spell: FIREBALL24, metaCtx: { overchannel: true, slotLevel: 3 }, playerStats: { name: 'TestWizard', automation: {} }, ...base });
    const noAuto = computeOverchannel({ spell: FIREBALL24, metaCtx: { overchannel: true, slotLevel: 3 }, playerStats: { name: 'TestWizard' }, ...base });
    // Lawful off-shape = the deny-table row shape (:413-430): base formula rides
    // through untouched, overchannel never armed, use-count never charged.
    expect(emptyAuto).toStrictEqual({ overchannelFormula: FB, overchannelActive: false, overchannelUseCount: 0 });
    expect(noAuto).toStrictEqual({ overchannelFormula: FB, overchannelActive: false, overchannelUseCount: 0 });
    expect(errSpy.mock.calls.map((c) => c[0])).toStrictEqual([
      '[spellCast] overchannelPassives: playerStats.automation.passives is missing',
      '[spellCast] overchannelPassives: playerStats.automation.passives is missing',
    ]);
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(grv).not.toHaveBeenCalled(); // read :151 and charge-write :162 both live behind the guard
    errSpy.mockRestore();
  });

  it('armed use bakes [Overchannel Maximize] over the EE formula, counts up, and writes exactly one 4-arg runtime call', () => {
    const grv = vi.fn().mockReturnValueOnce('2').mockReturnValue(3); // first read: string from store -> Number-coerced
    const args = { spell: FIREBALL24, metaCtx: { overchannel: true, slotLevel: 3 }, playerStats: { name: 'TestWizard', automation: { passives: [OC_PASSIVE] } }, campaignName: 'test-campaign', getRuntimeValue: grv, baseFormula: FB };

    const first = computeOverchannel({ ...args, empEvocFormula: null });
    expect(first).toStrictEqual({ overchannelFormula: '8d6 [Overchannel Maximize]', overchannelActive: true, overchannelUseCount: 3 });
    // REAL getRuntimeValue arity is 2 (useRuntimeState.js:63) — campaignName is correctly NOT sent on reads
    expect(grv.mock.calls[0]).toStrictEqual(['TestWizard', 'Overchannel_useCount']);
    const setMock = vi.mocked(setRuntimeValue);
    expect(setMock.mock.calls).toStrictEqual([['TestWizard', 'Overchannel_useCount', 3, 'test-campaign']]);
    expect(grv.mock.invocationCallOrder[0]).toBeLessThan(setMock.mock.invocationCallOrder[0]);

    const second = computeOverchannel({ ...args, empEvocFormula: null, baseFormula: first.overchannelFormula });
    // fix#1469(c): appendBonusTerm dedupes [Overchannel Maximize] on the marker —
    // re-entry keeps the tag EXACTLY ONCE (#1348) while the use-count writer still
    // climbs. Pre-fix capture: '8d6 [Overchannel Maximize] [Overchannel Maximize]'.
    expect(second).toStrictEqual({ overchannelFormula: '8d6 [Overchannel Maximize]', overchannelActive: true, overchannelUseCount: 4 });
    expect(second.overchannelFormula.match(/\[Overchannel Maximize\]/g)).toHaveLength(1); // #1348 tag-count

    // EE formula wins over baseFormula (:122 empEvocFormula || baseFormula)
    const ee = computeOverchannel({ ...args, empEvocFormula: '8d6 + 5 [Empowered Evocation]', baseFormula: 'IGNORED' });
    expect(ee.overchannelFormula).toBe('8d6 + 5 [Empowered Evocation] [Overchannel Maximize]');

    // null/undefined stored count coerces through ?? 0 -> 1
    const fresh = computeOverchannel({ ...args, empEvocFormula: null, getRuntimeValue: vi.fn(() => null) });
    expect(fresh).toStrictEqual({ overchannelFormula: '8d6 [Overchannel Maximize]', overchannelActive: true, overchannelUseCount: 1 });

    // four armed paths, four writes (campaignName always sent on writes); second write carried count 4
    expect(setMock.mock.calls).toHaveLength(4);
    expect(setMock.mock.calls[1]).toStrictEqual(['TestWizard', 'Overchannel_useCount', 4, 'test-campaign']);
    expect(setMock.mock.calls[3]).toStrictEqual(['TestWizard', 'Overchannel_useCount', 1, 'test-campaign']);

    // fix#1469(b): armed over a NULL base — logs once, never bakes 'null [Overchannel
    // Maximize]', passes null through (consumers fall back via `overchannelFormula ||
    // formula`, savePath.js:255). Count still climbs: 5th write, grv default 3 -> 4.
    const bsSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const nullBase = computeOverchannel({ ...args, empEvocFormula: null, baseFormula: null });
    expect(nullBase).toStrictEqual({ overchannelFormula: null, overchannelActive: true, overchannelUseCount: 4 });
    expect(bsSpy.mock.calls).toHaveLength(1);
    expect(bsSpy.mock.calls[0][0]).not.toContain('null');
    bsSpy.mockRestore();
    expect(setMock.mock.calls).toHaveLength(5);
    expect(setMock.mock.calls[4]).toStrictEqual(['TestWizard', 'Overchannel_useCount', 4, 'test-campaign']);
  });

  it('every unarmed gate returns the base formula untouched with zero writes (deny table)', () => {
    const rows = [
      { label: 'no overchannel passive -> no runtime read at all', passives: [RS_PASSIVE], spell: FIREBALL24, metaCtx: { overchannel: true, slotLevel: 3 }, reads: 0 },
      { label: 'overchannel flag absent', passives: [OC_PASSIVE], spell: FIREBALL24, metaCtx: {}, reads: 1 },
      { label: 'overchannel flag false', passives: [OC_PASSIVE], spell: FIREBALL24, metaCtx: { overchannel: false, slotLevel: 3 }, reads: 1 },
      { label: 'slotLevel 6 out of 1-5 band (slotLevel beats spell.level :114)', passives: [OC_PASSIVE], spell: FIREBALL24, metaCtx: { overchannel: true, slotLevel: 6 }, reads: 1 },
      { label: 'cantrip slot 0 invalid (:0-swallow census :114)', passives: [OC_PASSIVE], spell: PS24, metaCtx: { overchannel: true }, reads: 1 },
      { label: 'spell without damage', passives: [OC_PASSIVE], spell: { ...SPD24, level: 1 }, metaCtx: { overchannel: true }, reads: 1 },
    ];
    for (const row of rows) {
      vi.mocked(setRuntimeValue).mockClear();
      const grv = vi.fn(() => 0);
      const result = computeOverchannel({ spell: row.spell, metaCtx: row.metaCtx, playerStats: { name: 'TestWizard', automation: { passives: row.passives } }, campaignName: 'test-campaign', getRuntimeValue: grv, empEvocFormula: null, baseFormula: 'X' });
      expect(result, row.label).toStrictEqual({ overchannelFormula: 'X', overchannelActive: false, overchannelUseCount: 0 });
      expect(grv.mock.calls, row.label).toHaveLength(row.reads);
      expect(vi.mocked(setRuntimeValue), row.label).not.toHaveBeenCalled();
    }
  });
});
