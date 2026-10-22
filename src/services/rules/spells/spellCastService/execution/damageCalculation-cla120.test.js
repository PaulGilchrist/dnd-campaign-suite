// @maintained-by-ai
// CLA-120 lane — damageCalculation.js:45 computeEmpoweredEvocation is the SINGLE OWNER
// of the cast-resolution INT fold (git 9f4a06ba6: "INT modifier added TWICE per damage
// roll"). Cannot-regress (#1443 kill-matrix discipline): fresh formulas bake exactly one
// " + N [Empowered Evocation]"; pre-baked formulas pass through UNCHANGED, dedupe keyed
// on the MARKER string, never on the value (foreign-baked '+ 5' survives a caster INT 3).
//
// Bake-vs-roll level-source determination (#1454 index.js:53 vs noSavePath.js:13 pair,
// pinned by position, owned upstream in spellCastService.execute.test.js):
//   index.js:53   resolveSpellDamageWithTypes(spell, spell.level || 1) — cantrip bakes
//                 the LEVEL-1 tier (legacy ladder: 1d10) via resolveLegacyFormula;
//   noSavePath:13 resolveSpellDamageAtLevel(spell, playerStats.level) — cantrip scales
//                 with CASTER level (level 5 rolls 2d10).
// This lane is LEVEL-SOURCE AGNOSTIC: computeEmpoweredEvocation takes an already-resolved
// formula string, never touches a damage ladder, and appends the flat adder. Both sides
// of the '2d10-roll-vs-1d10-bake' pair must therefore fold to identical arithmetic — T2
// pins it on REAL disk bytes from BOTH rulesets so the upstream divergence is visible
// here as identical-output, never silently repaired in the fold.
//
// Family split (CLA-120 INT fold), other seams owned there — not duplicated here:
//   attackRollDamageCalc-cla120-empowered-evocation.test.js   attack-roll step (rollBaseDamage)
//   directSpellDamageSteps-cla120-empowered-evocation.test.js spellContext pre-baked [EE] dedupe
//   attackPostProcessing-cla120-potent-cantrip.test.js         potent-cantrip miss-half fold seam
//   savePath-aoe-empowered-evocation.test.js                   AoE save one-roll-per-cast payload
//   spellCastService.test.js:366 (master, #1462)               chain-level '2d10 + 3 [EE]' bake
//
// Cited-by preservation (#1462 fold-map): this file keeps its path and its single-fold
// owner title asserted verbatim in T1.
// old -> new test map (5 -> 4):
//   'folds +INT exactly once onto a cantrip formula'          -> T2 (disk ladders both rulesets)
//   'folds +INT exactly once onto a leveled spell formula'    -> T1 (disk Hellish Rebuke, master parity byte)
//   'is idempotent: [EE] formula returned unchanged'           -> T1 (+ marker-vs-value row)
//   'non-evocation school gate stays zero'                     -> T3 row (school fixed: fabricated
//      'Necromancy' replaced by disk byte 'Conjuration' — fixture-fraud fix #1462 GOLD)
//   'zero INT modifier -> no term'                             -> T3 row (negative-INT row
//      MOVED out of the deny table by fix#1468(a): the clamp is gone — see T4 signed fold)
// old fabricated fixtures replaced with disk bytes: FIRE_BOLT damage.formula (no such key on
// disk) and FIREBALL hard '8d6' -> programmatic public/data{,/2024}/spells.json ladder reads.
// Mock completeness: vi.mock of useRuntimeState.js REMOVED — computeEmpoweredEvocation never
// writes (setRuntimeValue belongs to computeOverchannel, overchannel lane) and the real module
// is a side-effect-free Map store; postCastRiderService mock impls are byte-equivalent copies
// of the real selectors so the collaborator cannot lie about the holder fixture.
// NO-CLOCK: pure string fold — no timers, no Date in unit or lane pin below.
// HP-key: N/A — this lane performs zero runtime writes.
// Security: no external/injected content applied (kiro #1446) — edits derive solely from
// repo source, disk data, and the task instruction.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../postCastRiderService.js', () => ({
  getEmpoweredEvocationFeatures: vi.fn(),
  getEmpoweredEvocationIntModifier: vi.fn(),
}));

import { computeEmpoweredEvocation } from './damageCalculation.js';
import { getEmpoweredEvocationFeatures, getEmpoweredEvocationIntModifier } from '../../postCastRiderService.js';
import { canRollExpression } from '../../../../dice/diceRoller.js'; // READ-ONLY parser proof (#1468/#1469)

const readDisk = (p) => JSON.parse(readFileSync(join(process.cwd(), p), 'utf8'));
const spells5e = readDisk('public/data/spells.json');
const spells2024 = readDisk('public/data/2024/spells.json');
const spellByName = (list, name) => {
  const sp = list.find((s) => s.name === name);
  if (!sp) throw new Error(`disk row missing: ${name}`);
  return sp;
};

// Generic deep walk: 5e nests the feature at subclasses[].class_levels[].features,
// 2024 at majors[].features (disk-probed paths) — descend every key.
const findEE = (node) => {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const hit = findEE(n);
      if (hit) return hit;
    }
    return null;
  }
  if (node.name === 'Empowered Evocation' && node.automation?.type === 'empowered_evocation') return node;
  for (const key of Object.keys(node)) {
    const hit = findEE(node[key]);
    if (hit) return hit;
  }
  return null;
};

const FB5 = spellByName(spells5e, 'Fire Bolt');
const FB24 = spellByName(spells2024, 'Fire Bolt');
const HR5 = spellByName(spells5e, 'Hellish Rebuke');
const LIGHT = spellByName(spells5e, 'Light');
const PS5 = spellByName(spells5e, 'Poison Spray');
const ee5 = findEE(readDisk('public/data/classes.json'));
const ee24 = findEE(readDisk('public/data/2024/classes.json'));

// Runtime passive row flattened from the disk automation block (master execute.test.js:469 shape).
const EE_PASSIVE = { name: ee5.name, ...ee5.automation };
const HOLDER = { name: 'TestEvoker', abilities: [{ name: 'Intelligence', bonus: 5 }], automation: { passives: [EE_PASSIVE] } };
const NO_FEATURE_HOLDER = { name: 'PlainWizard', abilities: [{ name: 'Intelligence', bonus: 5 }] };

describe('computeEmpoweredEvocation — CLA-120 single-fold owner', () => {
  beforeEach(() => {
    // Disk-drift alarms: bytes this lane pins must still match disk + master cites.
    expect(ee5.automation).toStrictEqual(ee24.automation);
    expect(FB5.school).toBe('Evocation');
    expect(HR5.damage.damage_at_slot_level['1']).toBe('2d10');
    vi.mocked(getEmpoweredEvocationFeatures).mockReset();
    vi.mocked(getEmpoweredEvocationIntModifier).mockReset();
    // Byte-equivalent copies of the REAL selectors (postCastRiderService.js:207-220) —
    // the mock cannot lie about what the holder fixture contains.
    vi.mocked(getEmpoweredEvocationFeatures).mockImplementation((ps) => (ps.automation?.passives ?? []).filter((p) => p.type === 'empowered_evocation'));
    vi.mocked(getEmpoweredEvocationIntModifier).mockImplementation((ps) => (ps.abilities.find((a) => a.name === 'Intelligence')?.bonus) || 0);
  });

  it('bakes the INT adder exactly once and never re-appends a marker-bearing formula (master #1462 byte parity)', () => {
    const evoker3 = { ...HOLDER, abilities: [{ name: 'Intelligence', bonus: 3 }] };
    const raw = HR5.damage.damage_at_slot_level['1']; // disk byte, leveled spell
    const baked = `${raw} + 3 [Empowered Evocation]`;
    const fresh = computeEmpoweredEvocation(evoker3, HR5, raw);
    expect(fresh).toStrictEqual({ empEvocFormula: baked, empEvocIntMod: 3 });
    expect(baked).toBe('2d10 + 3 [Empowered Evocation]'); // spellCastService.test.js:366 cite stays exact

    const again = computeEmpoweredEvocation(evoker3, HR5, fresh.empEvocFormula);
    expect(again.empEvocFormula).toBe(baked); // CLA-120 core regression: no double fold
    expect(again.empEvocFormula.match(/\[Empowered Evocation\]/g)).toHaveLength(1);

    const foreign = computeEmpoweredEvocation(evoker3, HR5, '2d10 + 5 [Empowered Evocation]');
    expect(foreign.empEvocFormula).toBe('2d10 + 5 [Empowered Evocation]'); // dedupe keys on marker, not value
    expect(foreign.empEvocIntMod).toBe(3);

    expect(fresh).not.toBe(again); // fresh result object per call
    expect(getEmpoweredEvocationFeatures).toHaveBeenCalledTimes(3);
    expect(getEmpoweredEvocationIntModifier).toHaveBeenCalledTimes(3);
    expect(getEmpoweredEvocationFeatures.mock.invocationCallOrder[0]).toBeLessThan(getEmpoweredEvocationIntModifier.mock.invocationCallOrder[0]);

    // :0-swallow census: all gates pass but a falsy formula skips only the BAKE
    // (damageCalculation.js:48) — the resolved INT survives in empEvocIntMod
    // (callers guard: savePath.js:157 checks empEvocFormula alongside it).
    expect(computeEmpoweredEvocation(HOLDER, HR5, '')).toStrictEqual({ empEvocFormula: null, empEvocIntMod: 5 });
    expect(computeEmpoweredEvocation(HOLDER, HR5, null)).toStrictEqual({ empEvocFormula: null, empEvocIntMod: 5 });
  });

  it('folds cantrip bake-vs-roll level sources identically on BOTH ruleset disk ladders (level-source agnostic, #1454 pair positioned)', () => {
    const bake5 = FB5.damage.damage_at_character_level['1']; // retired :53 lv1 bake (fix#121(e): :53 now resolves CASTERR level, matching this key's tier at CL1-4)
    const roll5 = FB5.damage.damage_at_character_level['5']; // noSavePath.js:13 side (playerStats.level 5)
    const bake24 = FB24.damage.damage_at_slot_level['0'];
    const roll24 = FB24.damage.damage_at_slot_level['5'];
    expect([bake5, roll5, bake24, roll24]).toEqual(['1d10', '2d10', '1d10', '2d10']); // disk-drift alarm

    const foldBake = computeEmpoweredEvocation(HOLDER, FB5, bake5);
    const foldRoll = computeEmpoweredEvocation(HOLDER, FB5, roll5);
    expect(foldBake).toStrictEqual({ empEvocFormula: '1d10 + 5 [Empowered Evocation]', empEvocIntMod: 5 });
    expect(foldRoll).toStrictEqual({ empEvocFormula: '2d10 + 5 [Empowered Evocation]', empEvocIntMod: 5 });
    expect(foldBake.empEvocFormula).not.toBe(foldRoll.empEvocFormula); // mutually distinguishable fixtures #1348

    const fold24Bake = computeEmpoweredEvocation(HOLDER, FB24, bake24);
    const fold24Roll = computeEmpoweredEvocation(HOLDER, FB24, roll24);
    expect(fold24Bake.empEvocFormula).toBe('1d10 + 5 [Empowered Evocation]');
    expect(fold24Roll.empEvocFormula).toBe('2d10 + 5 [Empowered Evocation]'); // ladder shape differs, fold byte-identical

    // The fold never re-resolves dice: spell.damage contents are irrelevant once the
    // presence gate passes — same formula, empty ladder, identical output.
    const noLadder = computeEmpoweredEvocation(HOLDER, { ...FB24, damage: { damage_type: 'Fire' } }, roll5);
    expect(noLadder.empEvocFormula).toBe('2d10 + 5 [Empowered Evocation]');
    expect(getEmpoweredEvocationFeatures).toHaveBeenCalledTimes(5);
  });

  it('every denied gate returns the input untouched with empEvocIntMod 0 (deny table, disk fixtures)', () => {
    const rows = [
      { label: 'no Empowered Evocation feature (INT 5 available — ternary short-circuits)', ps: NO_FEATURE_HOLDER, spell: HR5, formula: '2d10', expectFormula: '2d10', intSelectorCalls: 0 },
      { label: 'non-evocation school (disk byte: Poison Spray is Conjuration)', ps: HOLDER, spell: PS5, formula: PS5.damage.damage_at_character_level['5'], expectFormula: '2d12', intSelectorCalls: 1 },
      { label: 'evocation WITHOUT spell.damage (disk byte: Light has no damage block)', ps: HOLDER, spell: LIGHT, formula: null, expectFormula: null, intSelectorCalls: 1 },
      { label: 'school missing', ps: HOLDER, spell: { ...HR5, school: undefined }, formula: '2d10', expectFormula: '2d10', intSelectorCalls: 1 },
      { label: 'INT modifier 0', ps: { ...HOLDER, abilities: [{ name: 'Intelligence', bonus: 0 }] }, spell: HR5, formula: '2d10', expectFormula: '2d10', intSelectorCalls: 1 },
    ];
    for (const row of rows) {
      getEmpoweredEvocationFeatures.mockClear();
      getEmpoweredEvocationIntModifier.mockClear();
      const result = computeEmpoweredEvocation(row.ps, row.spell, row.formula);
      expect(result, row.label).toStrictEqual({ empEvocFormula: row.expectFormula, empEvocIntMod: 0 });
      expect(getEmpoweredEvocationFeatures, row.label).toHaveBeenCalledTimes(1);
      expect(getEmpoweredEvocationIntModifier, row.label).toHaveBeenCalledTimes(row.intSelectorCalls);
    }
  });

  it('school gate is case-normalized — lowercase and uppercase evocation both fold (disk bytes are Capitalized)', () => {
    const raw = HR5.damage.damage_at_slot_level['1'];
    expect(computeEmpoweredEvocation(HOLDER, { ...HR5, school: 'evocation' }, raw)).toStrictEqual({ empEvocFormula: '2d10 + 5 [Empowered Evocation]', empEvocIntMod: 5 });
    expect(computeEmpoweredEvocation(HOLDER, { ...HR5, school: 'EVOCATION' }, raw)).toStrictEqual({ empEvocFormula: '2d10 + 5 [Empowered Evocation]', empEvocIntMod: 5 });
    expect(getEmpoweredEvocationFeatures).toHaveBeenCalledTimes(2);
  });

  it('fix#1468(a): negative INT modifier folds SIGNED — RAW adds the negative, clamp is gone', () => {
    // RAW law: 2024/classes.json:13502 "Whenever you cast a Wizard spell from Evocation
    // school, add your Intelligence modifier to one damage roll of that spell."
    // (5e/classes.json:13454: "You can add your Intelligence modifier to one damage roll
    // of any wizard evocation spell you cast.") Modifiers are signed everywhere else in
    // the house — getEmpoweredEvocationIntModifier (postCastRiderService.js:217-220)
    // returns intAbility?.bonus verbatim. PRE-FIX captures (flipped pins): :39
    // `empEvocIntMod > 0` clamp gave INT -1 -> { empEvocFormula: '2d10', empEvocIntMod: 0 }.
    const raw = HR5.damage.damage_at_slot_level['1'];
    expect(raw).toBe('2d10'); // disk-drift alarm
    const int8 = { ...HOLDER, abilities: [{ name: 'Intelligence', bonus: -1 }] }; // INT 8 -> mod -1
    const folded = computeEmpoweredEvocation(int8, HR5, raw);
    expect(folded).toStrictEqual({ empEvocFormula: '2d10 - 1 [Empowered Evocation]', empEvocIntMod: -1 });
    expect(folded.empEvocFormula.match(/\[Empowered Evocation\]/g)).toHaveLength(1); // #1348 exactly one tag
    expect(folded.empEvocFormula).not.toContain('+-'); // diceRoller.js:46 parses ([+-]\d+) segments only

    const int6 = { ...HOLDER, abilities: [{ name: 'Intelligence', bonus: -2 }] }; // the task's -2 INT cast subtracts 2
    expect(computeEmpoweredEvocation(int6, HR5, raw)).toStrictEqual({ empEvocFormula: '2d10 - 2 [Empowered Evocation]', empEvocIntMod: -2 });

    // fold-once: re-folding the negative-baked output never re-appends (CLA-120 core, negative shape)
    expect(computeEmpoweredEvocation(int8, HR5, folded.empEvocFormula)).toStrictEqual({ empEvocFormula: '2d10 - 1 [Empowered Evocation]', empEvocIntMod: -1 });

    // parseability proof (diceRoller imported READ-ONLY, never edited): the signed byte
    // rolls; the old 'null + 5' garbage byte proves canRollExpression false (#1469(b))
    expect(canRollExpression('2d10 - 1 [Empowered Evocation]')).toBe(true);
    expect(canRollExpression('null + 5 [Blessed Strikes]')).toBe(false);

    expect(getEmpoweredEvocationFeatures).toHaveBeenCalledTimes(3); // folded, int6, re-fold
    expect(getEmpoweredEvocationIntModifier).toHaveBeenCalledTimes(3);
  });
});
