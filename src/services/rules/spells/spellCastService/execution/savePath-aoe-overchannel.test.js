// @maintained-by-ai
// savePath AoE OVERCHANNEL lane — savePath.js:164-171 + :119-149 payload bytes
// (CLA-244). OWNERSHIP (family map, cited not re-grown): dice-only carriage + gated
// INT scalar table + golden crash twin -> savePath-aoe-empowered-evocation.test.js
// (#1491); exact payload key-set / damage ladder rungs / overlay+fetch / range /
// dcSuccess chains / soulstitch leak -> savePath-aoe-damage.test.js (#1490);
// innate-sorcery +1 / dc_success map / purity -> savePath-aoe-meta; condition-only
// popup -> savePath-aoe-condition; maximized ROLL at cast (single-target) ->
// savePath-single-target; computeOverchannel module face (useCount+1, slot 1-5 gate,
// EE-baked single-target suffix) -> damageCalculation lane (#1468/#1469).
//
// MECHANISM VERDICT (source bytes): on the AoE lane overchannel is FLAG-DRIVEN, and
// the '[Overchannel Maximize]' suffix is a marker byte only. The modal never parses
// the suffix (SaveAttackAoeModal.jsx:95/288/554 gate on overchannelActive and roll
// per target); diceRoller strips ALL bracketed markers before parsing
// (diceRoller.js:32/39 `/\s*\[.*?\]\s*/g`), so 'X [Overchannel Maximize]' survives
// as dice X. overchannelFormula is READ NOWHERE on this lane (handleAoE :174-176
// destructures active+useCount only) — T1 r4 pins the non-leak with a poison value.
// The AoE suffix is appended to the RAW slot dice (:170), never to empEvocFormula —
// the inverse of computeOverchannel's single-target bake (damageCalculation.js:122-123
// `${empEvocFormula || baseFormula} [Overchannel Maximize]`); a bake here would
// refold INT per-target (the CLA-120 bug). T2 pins that suffix-vs-EE dedupe byte,
// the sole EE interaction delegated to this file by empowered-evocation:52.
//
// QUIRK CENSUS (this span):
//  - :146/:183 lv-0 passthrough: slotLevel = metaCtx?.slotLevel || spell.level ships
//    verbatim as overchannelSpellLevel (:146) — a level-0 cast surfaces 0. Upstream
//    computeOverchannel excludes slot 0 (damageCalculation.js:117 >= 1) so this is
//    caller-gated golden (documented synthetic-flag form); the consumer's `|| 1`
//    rescue twin (handleOverchannelSelfDamage.js:8, #1454/:53 bake family) is CITED,
//    not re-grown. T1 r6 pins the producer 0-byte on the REAL disk 2024 Acid Splash
//    lv0 sphere ladder row {0:'1d6'}.
//  - :145 `overchannelUseCount || 0` falsy-normalizes undefined/0 -> 0 (T1 r2);
//    useCount is incremented upstream by computeOverchannel (:120, +1), never here.
//  - :144 `!!overchannelActive` coerces 0 -> false (mutant pass-through dies r2).
//  - golden unguarded-deref: spell.dc absent TypeError lane -> owned by
//    savePath-aoe-damage:481 (#1360/#1491 exact-console-twin cited, not duplicated).
//  - NO-CLOCK: self-damage is instantaneous at the modal's confirm seam, never a
//    cast-resolution timer; payload carries strings + scalars only.
//  - fabricated-fixture census: OLD lane held FAKE rows — 'Burning Hands' {1:'3d6'}
//    hand-typed (coincidentally disk-true, now read from disk) and 'Hunger of Hadar'
//    which does NOT EXIST in public/data/spells.json (name-impersonation fraud) —
//    replaced by the REAL disk Circle of Death Necromancy row.
//
// MOCK CENSUS vs savePath.js REAL import graph (#1440 line-by-line :1-6):
//   diceRoller          bare vi.fn x2 — NEVER rolled at AoE cast resolution
//                       (picker rolls per target, #1490 keystone); canned totals
//                       removed (dead return values, hollow-mock ban #1491).
//   postCastRiderService triggerSoulstitchSpells stubbed (graph-required :20); the
//                       two EE selectors are byte-faithful copies of the REAL
//                       :207-221 incl. throw branch so the holder fixture cannot lie.
//   useRuntimeState     graph-required (damageCalculation.js:3 setRuntimeValue;
//                       spellOverlayService getRuntimeValue); pinned 0-call — the
//                       useCount write is computeOverchannel's, never savePath's.
//   damageUtils         getCombatContext -> null (real reads the combat store).
//   rangeValidation     UNMOCKED REAL leaf (rules/combat/rangeValidation.js — the
//                       old mock re-implemented rangeToFeet's regex; duplicate-logic
//                       over-mock removed per aoe-damage/EE verdicts).
//   spellOverlayService REAL leaf — null combat ctx -> overlayTargetId typeof guard
//                       returns null -> no fetch; fetch stubbed global, 0-call.
//   damageCalculation   REAL leaf (computeEmpoweredEvocation gate :34-40/:45-53).
//   savePath.js         unit under test — NEVER mocked.
// DEAD MOCKS REMOVED (#1484/85/90/91/92 family, instance #2 as verdicted by #1492):
//   logService + viciousMockeryService — savePath.js imports NEITHER (vicious
//   stamping is LOCAL :205 isViciousMockery); neither is in this span's graph.
// Campaign lockdown: 'test-campaign' only. Security (kiro #1446): no external or
// injected content applied — every byte derives from repo source, disk data, and the
// orchestrator instruction.
//
// old -> new test map (6 -> 2):
//   :116 'passes overchannel context...'          -> T1 r1 (+ dedupe regex count===1)
//   :125 '[Overchannel Maximize] suffix when..'   -> T1 r1/r3 (exact dice+suffix byte)
//   :134 'EE bonus NOT baked... int rides payload' -> REMOVED per #1491 (dup of
//      empowered-evocation T1 :245-248 + r7/r8); replaced by T2 suffix-x-EE dedupe
//      byte only (the interaction empowered-evocation:52 delegates here).
//   :144 'slot-level dice upcast overchannel'     -> T1 r3 (real Fireball 10d6@5)
//   :155 'no suffix and false flags inactive'      -> T1 r2 (+ :144/:145 falsy pins)
//   :164 'non-evocation... without empowered'      -> T1 r5 (fabricated Hunger of
//      Hadar replaced by REAL disk Circle of Death)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => undefined),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
  rollExpressionMaximized: vi.fn(),
}));

vi.mock('../../postCastRiderService.js', () => ({
  triggerSoulstitchSpells: vi.fn(() => Promise.resolve([])),
  // BYTE-FAITHFUL copies of postCastRiderService.js:207-221 — the real gate runs
  // against the fixture; canned []/0 selectors would vacuate the school gates.
  getEmpoweredEvocationFeatures: vi.fn((playerStats) => {
    const rawPassives = playerStats.automation?.passives;
    if (rawPassives == null) {
      console.error('[postCastRiderService] Missing array:', rawPassives);
      throw new Error('Expected array, got ' + rawPassives);
    }
    const passives = rawPassives;
    return passives.filter(p => p.type === 'empowered_evocation');
  }),
  getEmpoweredEvocationIntModifier: vi.fn((playerStats) => {
    const intAbility = playerStats.abilities.find(a => a.name === 'Intelligence');
    return intAbility?.bonus || 0;
  }),
}));

vi.mock('../../../combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(() => null),
}));

const { handleSavePath } = await import('./savePath.js');
const { rollExpression, rollExpressionMaximized } = await import('../../../../dice/diceRoller.js');
const { getCombatContext } = await import('../../../combat/damageUtils.js');
const { setRuntimeValue } = await import('../../../../../hooks/runtime/useRuntimeState.js');
const rider = await import('../../postCastRiderService.js');

const readDisk = (p) => JSON.parse(readFileSync(join(process.cwd(), p), 'utf8'));
const spellByName = (list, name) => {
  const sp = list.find((s) => s.name === name);
  if (!sp) throw new Error(`disk row missing: ${name}`);
  return sp;
};
// Generic deep walk (5e subclasses[].class_levels[].features vs 2024 majors[].features).
const findFeature = (node, name, type) => {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const n of node) { const hit = findFeature(n, name, type); if (hit) return hit; }
    return null;
  }
  if (node.name === name && node.automation?.type === type) return node;
  for (const key of Object.keys(node)) {
    const hit = findFeature(node[key], name, type);
    if (hit) return hit;
  }
  return null;
};

const spells5e = readDisk('public/data/spells.json');
const spells2024 = readDisk('public/data/2024/spells.json');
const BURNING_5E = spellByName(spells5e, 'Burning Hands');
const FIREBALL_5E = spellByName(spells5e, 'Fireball');
const CIRCLE_5E = spellByName(spells5e, 'Circle of Death');
const ACID_SPLASH_2024 = spellByName(spells2024, 'Acid Splash');

// REAL disk automation rows (#1365): Overchannel lv14 in BOTH rulesets, EE for T2.
const OVERCHANNEL_5E = findFeature(readDisk('public/data/classes.json'), 'Overchannel', 'overchannel');
const OVERCHANNEL_2024 = findFeature(readDisk('public/data/2024/classes.json'), 'Overchannel', 'overchannel');
const EE_5E = findFeature(readDisk('public/data/classes.json'), 'Empowered Evocation', 'empowered_evocation');

function wizard(passives) {
  return {
    name: 'TestEvoker',
    abilities: [{ name: 'Intelligence', bonus: 5 }],
    automation: { passives },
  };
}

function makeArgs(overrides = {}) {
  return {
    spell: BURNING_5E,
    fullSpell: BURNING_5E,
    metaCtx: {},
    playerStats: wizard([{ name: OVERCHANNEL_5E.name, type: 'overchannel' }]),
    campaignName: 'test-campaign',
    mapName: null,
    getRuntimeValue: vi.fn(() => undefined),
    innateSorceryActive: false,
    effectiveDamageType: 'Fire',
    spellSaveDc: 18,
    overchannelActive: false,
    overchannelUseCount: 0,
    hasInvisible: false,
    ...overrides,
  };
}

/* KILL MATRIX (this lane) */
/* M1 ternary inverted at :170 (suffix baked while inactive)      -> T1 r2 exact   */
/* M2 suffix dropped while active at :170                          -> T1 r1 exact   */
/* M3 suffix byte mutated (case/spacing/brackets)                  -> T1 r1 toBe +  */
/*    diceRoller strip-residue equality ('X [Overchannel Maximize]' parses as X)    */
/* M4 double-append (suffix x2)                                    -> T1 r1 count===1   */
/* M5 overchannelSpellLevel <- spell.level instead of slotLevel    -> T1 r3 (5 vs 3)*/
/* M6 :145 `|| 0` default dropped (undefined leaks on payload)     -> T1 r2         */
/* M7 :144 `!!` coercion dropped (0 passes through)                 -> T1 r2         */
/* M8 EE adder baked into suffixed AoE dice (CLA-120 regression)   -> T2 exact byte  */
/* M9 overchannelFormula leaks into payload.damage                  -> T1 r4 poison  */
/* M10 rolls fire at cast resolution (picker owns per-target rolls) -> T1/T2 0-call  */
/* M11 useCount write at cast (computeOverchannel owns it)           -> T1 0-call    */
/* M12 gate flip sends AoE into single-target lane                   -> modalName +   */
/*     absent rollDamage/getTargetInfo fixture keys crash on contact                */

describe('savePath AoE overchannel — [Overchannel Maximize] suffix bytes + flag trio on saveAttackAoe (marker-only, flag-driven, rolled per target downstream)', () => {
  let consoleSpy;
  const fetchSpy = vi.fn(() => Promise.resolve({ ok: false, json: () => Promise.resolve({ overlays: [] }) }));

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    getCombatContext.mockReturnValue(null);
    vi.stubGlobal('fetch', fetchSpy);
    // disk-drift alarms — every pinned byte must still match disk.
    expect(OVERCHANNEL_5E.level).toBe(14);
    expect(OVERCHANNEL_2024.level).toBe(14);
    expect(OVERCHANNEL_5E.automation.type).toBe(OVERCHANNEL_2024.automation.type); // 'overchannel' both rulesets
    expect(BURNING_5E.damage.damage_at_slot_level['1']).toBe('3d6');
    expect(FIREBALL_5E.damage.damage_at_slot_level['5']).toBe('10d6');
    expect(CIRCLE_5E.school).toBe('Necromancy');
    expect(CIRCLE_5E.damage.damage_at_slot_level['6']).toBe('8d6');
    expect(ACID_SPLASH_2024.level).toBe(0);
    expect(ACID_SPLASH_2024.damage.damage_at_slot_level['0']).toBe('1d6');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('appends the exact [Overchannel Maximize] marker to raw slot dice when active and ships the verbatim flag trio (upcast slot byte, non-evocation passthrough, lv0 golden, formula poison, falsy-normalized inactive), never rolling, writing, or fetching at cast resolution', async () => {
    expect(handleSavePath).toHaveLength(1); // arity pin (#1488 form)
    const rows = [
      { label: 'r1 active lv1 cone: dice+suffix exact, single suffix, no EE bytes',
        args: makeArgs({ overchannelActive: true, overchannelUseCount: 1 }),
        damage: '3d6 [Overchannel Maximize]', active: true, useCount: 1, spellLevel: 1, intMod: 0, intCalls: 0 },
      { label: 'r2 inactive: raw dice, !! coerces 0->false (:144), useCount ||0 normalizes undefined->0 (:145)',
        args: makeArgs({ overchannelActive: 0, overchannelUseCount: undefined }),
        damage: '3d6', active: false, useCount: 0, spellLevel: 1, intMod: 0, intCalls: 0 },
      { label: 'r3 upcast Fireball slot 5: suffix rides SLOT dice 10d6, spellLevel byte 5 != spell.level 3 (M5)',
        args: makeArgs({ spell: FIREBALL_5E, fullSpell: FIREBALL_5E, metaCtx: { slotLevel: 5 }, overchannelActive: true, overchannelUseCount: 2 }),
        damage: '10d6 [Overchannel Maximize]', active: true, useCount: 2, spellLevel: 5, intMod: 0, intCalls: 0 },
      { label: 'r4 overchannelFormula read nowhere on the AoE lane: poison formula never surfaces in payload.damage',
        args: makeArgs({ overchannelActive: true, overchannelUseCount: 1, overchannelFormula: '99d99 [Overchannel Maximize]' }),
        damage: '3d6 [Overchannel Maximize]', active: true, useCount: 1, spellLevel: 1, intMod: 0, intCalls: 0 },
      { label: 'r5 REAL disk Circle of Death (Necromancy, EE holder): school gate is EE-only — suffix still appends 8d6@6, intMod 0',
        args: makeArgs({ spell: CIRCLE_5E, fullSpell: CIRCLE_5E, metaCtx: { slotLevel: 6 }, effectiveDamageType: 'Necrotic', playerStats: wizard([{ name: OVERCHANNEL_5E.name, type: 'overchannel' }, { name: EE_5E.name, type: 'empowered_evocation' }]), overchannelActive: true, overchannelUseCount: 1 }),
        damage: '8d6 [Overchannel Maximize]', active: true, useCount: 1, spellLevel: 6, intMod: 0, intCalls: 1 },
      { label: 'r6 lv0 golden (caller-gated): REAL disk 2024 Acid Splash — spellLevel 0 ships verbatim at :146/:183; upstream lv>=1 gate damageCalculation.js:117 + consumer ||1 rescue handleOverchannelSelfDamage.js:8 cited, not re-grown',
        args: makeArgs({ spell: ACID_SPLASH_2024, fullSpell: ACID_SPLASH_2024, effectiveDamageType: 'Acid', overchannelActive: true, overchannelUseCount: 1 }),
        damage: '1d6 [Overchannel Maximize]', active: true, useCount: 1, spellLevel: 0, intMod: 0, intCalls: 0 },
    ];

    for (const row of rows) {
      const popup = (await handleSavePath(row.args)).automationPopup;

      expect(popup.modalName, row.label).toBe('saveAttackAoe'); // M12: single-target lane absent from fixture crashes on contact
      expect(popup.payload.damage, row.label).toBe(row.damage); // M1-M3, M9
      expect(popup.payload.overchannelActive, row.label).toBe(row.active); // M7
      expect(popup.payload.overchannelUseCount, row.label).toBe(row.useCount); // M6
      expect(popup.payload.overchannelSpellLevel, row.label).toBe(row.spellLevel); // M5
      expect(popup.payload.empoweredEvocationIntMod, row.label).toBe(row.intMod);
      expect((popup.payload.damage.match(/\[Overchannel Maximize\]/g) || []).length, row.label).toBe(row.active ? 1 : 0); // M4
      expect(popup.payload.damage, row.label).not.toContain('[Empowered Evocation]'); // M8: no EE bake at this seam
      if (row.active) {
        // M3 residue pin: diceRoller strips bracket markers — the dice prefix alone survives.
        expect(popup.payload.damage.replace(/\s*\[.*?\]\s*/g, '').trim(), row.label).toBe(row.damage.split(' [')[0]);
        expect(popup.payload.damage, row.label).not.toContain('99d99'); // M9 poison
      }

      // Collaborator census, every row: nothing rolls, nothing writes, no network,
      // one soulstitch tuple, one school-gate eval, zero INT selector calls unless an
      // EE holder rides past the feature gate (damageCalculation.js:36 ternary).
      expect(rollExpression, row.label).not.toHaveBeenCalled(); // M10
      expect(rollExpressionMaximized, row.label).not.toHaveBeenCalled(); // M10
      expect(setRuntimeValue, row.label).not.toHaveBeenCalled(); // M11 — useCount write is computeOverchannel's (:124)
      expect(fetchSpy, row.label).not.toHaveBeenCalled();
      expect(rider.triggerSoulstitchSpells.mock.calls, row.label).toEqual([[row.args.fullSpell, row.args.metaCtx, row.args.playerStats, 'test-campaign', null]]); // exact tuple vs REAL arity 5 (:20)
      expect(rider.getEmpoweredEvocationFeatures, row.label).toHaveBeenCalledTimes(1); // one school-gate eval per cast, hoisted before popup build (:168)
      expect(rider.getEmpoweredEvocationIntModifier, row.label).toHaveBeenCalledTimes(row.intCalls);
      rider.triggerSoulstitchSpells.mockClear();
      rider.getEmpoweredEvocationFeatures.mockClear();
      rider.getEmpoweredEvocationIntModifier.mockClear();
    }
    expect(consoleSpy).not.toHaveBeenCalled(); // every gate above is silent
  });

  // Sole EE interaction delegated here by empowered-evocation:52. Dice-only carriage
  // and the gated-scalar table are OWNED by savePath-aoe-empowered-evocation.test.js
  // (T1 :245-248, deny rows r7/r8) — cited per #1491, NOT re-grown. This pins only
  // that with overchannel ACTIVE on an EE holder the adder stays out of the suffixed
  // shared formula (the picker rolls per target; a bake would refold per target).
  it('suffix-vs-EE dedupe byte: EE holder + active ships exactly 3d6 [Overchannel Maximize] — the INT adder NEVER bakes before the marker (inverse of computeOverchannel single-target bake, damageCalculation.js:122-123 cited)', async () => {
    const args = makeArgs({
      playerStats: wizard([{ name: OVERCHANNEL_5E.name, type: 'overchannel' }, { name: EE_5E.name, type: 'empowered_evocation' }]),
      overchannelActive: true,
      overchannelUseCount: 1,
    });

    const popup = (await handleSavePath(args)).automationPopup;

    expect(popup.payload.damage).toBe('3d6 [Overchannel Maximize]'); // M2/M8 — no '+ 5', no EE marker
    expect(popup.payload.damage).not.toContain('+'); // the adder rides only as its own scalar
    expect(popup.payload.empoweredEvocationIntMod).toBe(5);
    expect(rider.getEmpoweredEvocationFeatures.mock.calls).toEqual([[args.playerStats]]); // full tuple vs REAL arity
    expect(rider.getEmpoweredEvocationFeatures.mock.calls[0]).toHaveLength(1);
    expect(rider.getEmpoweredEvocationIntModifier.mock.calls).toEqual([[args.playerStats]]);
    expect(rollExpressionMaximized).not.toHaveBeenCalled(); // maximization is the modal's, per target
    expect(consoleSpy).not.toHaveBeenCalled();
  });
});
