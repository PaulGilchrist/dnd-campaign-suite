// @maintained-by-ai
// CLA-120 AoE payload lane — savePath.js:152-171 (fix git 9f4a06ba6, cited verbatim:
// 'CLA-120 = Empowered Evocation: INT modifier added TWICE per damage roll (duplicate
// folds + per-target AoE fold)'; #1468 delegation table: 'AoE payload ->
// savePath-aoe-empowered-evocation'). SAVEPATH'S CONTRACT AT THIS SEAM: ship dice-only
// payload.damage + the gated scalar empoweredEvocationIntMod; the INT adder is NEVER
// baked into the shared formula (the picker rolls per target — a baked adder would
// fold once per target, the ORIGINAL bug) and NEVER rides alongside a marker-bearing
// formula (savePath.js:156 `empEvocFormula !== damageExpression` is the carrier gate —
// T2 pre-baked rows kill it). Fold-ONCE-per-target semantics live downstream: modal
// foldEmpoweredEvocationOnce (SaveAttackAoeModal.jsx:562-565, 'only the cast-stamped
// first target folds the adder') owns the per-target loop + stamp (:568-571) — pinned
// by SaveAttackAoeModal.cla120-empowered-evocation.test.jsx, NOT re-grown here; this
// file owns WHICH BYTES leave cast resolution.
//
// HALVING-vs-FOLD ORDER DETERMINATION (mod-then-half, ship-shape; modal source quotes):
//   SaveAttackAoeModal.jsx:180-184 `foldEmpoweredEvocationOnce(resolvedDamage,
//   empoweredEvocationIntMod, ...)` -> `rollDamageFormula(targetDamageFormula, ...)`
//   -> `const rawDamage = damageRoll?.total` -> :188 `computeDamageAfterEvasion(
//   rawDamage, success, dcSuccess, ...)`: the INT adder is folded into the formula
//   BEFORE the roll, so it sits INSIDE rawDamage and dcSuccess:'half' floors the
//   MODIFIED total. 'half then mod' would require the mod applied after :188 — it is
//   not. Matches RAW (halving applies to the total), so no 🔴. dcSuccess:'half'
//   keystone rides THIS popup (:140; condition popup :97 has none — #1490 asymmetry).
//
// NEGATIVE-MOD CLAMP VERDICT: clamped to 0, twice — damageCalculation.js:39
// `empEvocIntMod > 0` (gate; #1468 :39 🔴 family, same deviation pinned at the fold
// unit by damageCalculation-cla120.test.js:173 — cited, not re-grown) and savePath
// .js:156 re-guards `empEvocIntMod > 0` before the scalar ever rides the payload.
// A negative INT NEVER ships as a negative adder. T2 rows pin the shipped bytes.
//
// Quirk census (this span):
//  - :0-swallow/dice-value: the EE presence gate reads spell.damage the OBJECT
//    (damageCalculation.js:39), never the dice VALUE — ladder {3:'0'} still rides
//    intMod 5 next to payload damage '0' (T2 QUIRK row, shipped byte pinned).
//  - implicit-undefined-vs-explicit-null: empoweredEvocationIntMod is ALWAYS a
//    number on this popup (5 or 0, :157 ternary arms) — 'empowered:null' rows are
//    impossible; typeof pinned in T1 (#1488 family).
//  - golden crash twin: automation.passives absent reaches the REAL selector's
//    throw+console.error branch (postCastRiderService.js:207-215 byte-faithful mock)
//    — propagates out of handleSavePath uncaught (:19-26 try/catch wraps only
//    soulstitch), console byte pinned T3 (:1360/#1490 caller-gated-dead-twin form).
//  - chokepoint economics (#1357/58): the fold unit is evaluated ONCE per cast at
//    :168/:155 (hoisted before popup build :196) — NOT per target; exact call
//    counts + invocationCallOrder pinned T1.
//  - NO-CLOCK: payload carries strings + scalars only; duration rides only the
//    condition popup (savePath-aoe-damage.test.js:128-136 exact key-set owner).
//
// Family split (cited, not duplicated): exact payload key-set / ladder / overlay+
// fetch / dc-success chains / soulstitch-leak -> savePath-aoe-damage.test.js (#1489);
// innate-sorcery +1 & dc_success value map -> savePath-aoe-meta; [Overchannel
// Maximize] suffix x EE -> savePath-aoe-overchannel:134; condition-only popup ->
// savePath-aoe-condition; fold-unit bake/dedupe/deny-table -> damageCalculation-
// cla120.test.js (#1468); per-target stamp fold -> SaveAttackAoeModal.cla120.
//
// Mock census vs savePath.js REAL import graph (#1440 line-by-line):
//   diceRoller            bare vi.fn x2 — NEVER rolled on the AoE lane; accidental
//                         cast-time rolls die on not.toHaveBeenCalled (sibling canon
//                         savePath-aoe-damage.test.js:6-8,42-45). canned-total mocks
//                         REMOVED (dead return values on this path).
//   postCastRiderService  triggerSoulstitchSpells stubbed (graph-required, :20-26);
//                         the two EE selectors are BYTE-FAITHFUL COPIES of the real
//                         :207-221 (incl. throw branch) so the collaborator cannot lie
//                         about the holder fixture — canned []/0 mocks REMOVED: they
//                         made every gate in damageCalculation.js:34-40 vacuous.
//   useRuntimeState       graph-required mock (damageCalculation.js:3 setRuntimeValue,
//                         spellOverlayService getRuntimeValue); spies pinned 0-call —
//                         cast resolution writes no stamp (modal :568 owns it).
//   damageUtils           getCombatContext -> null (real reads the combat store).
//   rangeValidation       UNMOCKED REAL leaf (rules/combat/rangeValidation.js — the
//                         old mock re-implemented rangeToFeet's regex: duplicate-logic
//                         over-mock, removed per savePath-aoe-damage:14-17 verdict).
//   spellOverlayService   REAL leaf — null combat context -> overlayTargetId typeof
//                         guard (:12-15) -> no fetch; fetch stubbed as sentinel, 0-call.
//   savePath.js           unit under test — NEVER mocked.
// DEAD MOCKS REMOVED (dead-module-mock hunt #1484/85): logService (addEntry is not
// in this span's import graph — savePath.js imports it NOWHERE; the modal lane owns
// logging), rangeValidation hand-rolled regex, canned dice totals, canned EE
// selectors, fabricated 'Stinking Cloud' 8d6 ladder (disk Stinking Cloud carries NO
// damage ladder — that row routes to aoeCondition, not this popup; replaced by the
// REAL disk Circle of Death Necromancy row).
// Campaign lockdown: 'test-campaign' only. Security (kiro #1446): no external/
// injected content applied — edits derive solely from repo source, disk data, and
// the task instruction.
//
// old -> new test map (3 -> 3):
//   'evocation AoE: payload damage stays dice-only...'  -> T1 (disk bytes + counts +
//      order + purity + dcSuccess keystone + typeof pin)
//   'non-evocation AoE (school gate)...'                -> T2 r2 (fabricated fixture
//      replaced by disk Circle of Death)
//   'zero INT modifier -> int mod 0'                    -> T2 r3 (+ new r1,r4-r10)
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
  // BYTE-FAITHFUL copies of postCastRiderService.js:207-221 — real gate logic runs
  // against the fixture; a canned mock cannot make the deny table vacuous.
  getEmpoweredEvocationFeatures: vi.fn((playerStats) => {
    const rawPassives = playerStats.automation?.passives;
    if (rawPassives == null) {
      console.error('[postCastRiderService] Missing array:', rawPassives);
      throw new Error('Expected array, got ' + rawPassives);
    }
    return rawPassives.filter(p => p.type === 'empowered_evocation');
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

// Disk rows — REAL bytes, programmatic reads (#1365), no fabricated ladders.
const spells5e = readDisk('public/data/spells.json');
const spells2024 = readDisk('public/data/2024/spells.json');
const FIREBALL_5E = spellByName(spells5e, 'Fireball');
const FIREBALL_2024 = spellByName(spells2024, 'Fireball');
const CIRCLE_5E = spellByName(spells5e, 'Circle of Death');
const BURNING_5E = spellByName(spells5e, 'Burning Hands');

// Generic deep walk (5e subclasses[].class_levels[].features vs 2024 majors[].features)
// — cla120-lane canon shape; the EE passive is the REAL disk automation row.
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
const EE_PASSIVE = { name: findEE(readDisk('public/data/classes.json')).name, type: 'empowered_evocation' };

function evoker(intBonus = 5, withFeature = true) {
  return {
    name: 'TestEvoker',
    abilities: [{ name: 'Intelligence', bonus: intBonus }],
    automation: { passives: withFeature ? [EE_PASSIVE] : [] },
  };
}

function makeArgs(overrides = {}) {
  return {
    spell: FIREBALL_5E,
    fullSpell: FIREBALL_5E,
    metaCtx: {},
    playerStats: evoker(),
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

const fetchSpy = vi.fn(() => Promise.resolve({ ok: false, json: () => Promise.resolve({ overlays: [] }) }));

/* KILL MATRIX (this lane; fold-unit M-table lives in damageCalculation-cla120) */
/* K1  school gate, lowercase-normalized (damageCalculation.js:37-38)   -> T1, T2-r2 */
/* K2  feature gate hasEmpoweredEvoc (:35-36; selector short-circuit —  */
/*     INT selector never called when feature absent, :36 ternary)       -> T2-r1     */
/* K3  INT>0 gate (:39) — 0 and negative both clamp                       -> T2-r3,r4  */
/* K4  spell.damage presence gate reads the OBJECT not the dice value    -> T2-r5,r6  */
/* K5  carrier dedupe: marker-bearing formula => intMod must NOT ride     */
/*     (savePath.js:156 `!== damageExpression` — the exact anti-double-    */
/*     fold line of the ORIGINAL per-target-bake bug)                      -> T2-r7,r8  */
/* K6  payload scalar always a number, never null/undefined (:157)       -> T1         */
/* K7  dice-only damage byte + separate int key (fix commit body)        -> T1, T2     */
/* K8  fold unit evaluated ONCE per cast, hoisted before popup build      */
/*     (:168/:155; invocationCallOrder combat ctx before fold)           -> T1         */
/* K9  no stamp / no runtime write at cast resolution (modal :568 owns)   -> T1         */
/* K10 dice never rolled at cast time — picker rolls per target          -> T1, T2     */
/* K11 golden crash twin: passives-absent holder rejects with the real                     */
/*     selector Error + console byte, uncaught by the soulstitch try/catch -> T3        */
/* K12 disk shape normalization on EE allow rows (2024 shape-key, cone)   -> T2-r9,r10  */

describe('savePath AoE payload — CLA-120 Empowered Evocation one-roll-per-cast carriage (dice-only damage + gated INT scalar)', () => {
  let consoleSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    getCombatContext.mockReturnValue(null);
    vi.stubGlobal('fetch', fetchSpy);
    // disk-drift alarms — every byte pinned below must still match disk.
    expect(FIREBALL_5E.damage.damage_at_slot_level['3']).toBe('8d6');
    expect(FIREBALL_2024.damage.damage_at_slot_level['3']).toBe('8d6');
    expect(FIREBALL_2024.area_of_effect.shape).toBe('sphere');
    expect(CIRCLE_5E.school).toBe('Necromancy');
    expect(CIRCLE_5E.damage.damage_at_slot_level['6']).toBe('8d6');
    expect(BURNING_5E.damage.damage_at_slot_level['1']).toBe('3d6');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('EE evoker + disk Fireball: dice-only damage byte with the INT scalar on its own key, folded once-per-cast (not per-target), rolled and stamped downstream only', async () => {
    expect(handleSavePath).toHaveLength(1); // arity pin (#1488 form)
    const args = makeArgs();
    const p1 = (await handleSavePath(args)).automationPopup;

    expect(p1.modalName).toBe('saveAttackAoe');
    expect(p1.payload.damage).toBe(FIREBALL_5E.damage.damage_at_slot_level['3']); // disk byte '8d6', by reference
    expect(p1.payload.damage).not.toContain('[Empowered Evocation]'); // K7 — the CLA-120 core: no per-target bake
    expect(p1.payload.empoweredEvocationIntMod).toBe(5);
    expect(typeof p1.payload.empoweredEvocationIntMod).toBe('number'); // K6 — never null/undefined
    expect(p1.payload.dcSuccess).toBe('half'); // keystone adjacent to the mod (#1489; order verdict in header)
    expect(p1.payload.saveType).toBe('DEX'); // disk UPPERCASE byte (#1489 gold)
    expect(p1.payload.radiantSoulChaMod).toBe(0); // no radiant_soul passive — gate short-circuits
    expect(p1.payload.playerStats).toBe(args.playerStats); // identity by reference

    // K8 chokepoint economics: ONE gate evaluation per cast, hoisted before the
    // popup — feature selector first, INT selector second (short-circuit order).
    expect(rider.getEmpoweredEvocationFeatures.mock.calls).toEqual([[args.playerStats]]);
    expect(rider.getEmpoweredEvocationIntModifier.mock.calls).toEqual([[args.playerStats]]);
    expect(rider.getEmpoweredEvocationFeatures.mock.calls[0]).toHaveLength(1); // arity vs REAL
    expect(rider.getEmpoweredEvocationFeatures.mock.invocationCallOrder[0]).toBeLessThan(rider.getEmpoweredEvocationIntModifier.mock.invocationCallOrder[0]);
    expect(getCombatContext.mock.invocationCallOrder[0]).toBeLessThan(rider.getEmpoweredEvocationFeatures.mock.invocationCallOrder[0]); // combat ctx before fold

    // K9/K10 + collaborator tuples: nothing rolls, nothing writes, no network.
    expect(rollExpression).not.toHaveBeenCalled();
    expect(rollExpressionMaximized).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled(); // pendingEmpoweredEvocationTarget stamp owned by modal :568-571
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(rider.triggerSoulstitchSpells.mock.calls).toEqual([[FIREBALL_5E, {}, args.playerStats, 'test-campaign', null]]);
    expect(consoleSpy).not.toHaveBeenCalled();

    // Purity: a second identical cast ships a FRESH popup object (#1490 by-reference
    // canon) carrying byte-identical primitives, and still exactly ONE fold-unit
    // evaluation per cast (2 total across 2 casts — never N-per-target).
    const p2 = (await handleSavePath(makeArgs())).automationPopup;
    expect(p2).not.toBe(p1);
    expect(p2.payload.damage).toBe(p1.payload.damage);
    expect(p2.payload.empoweredEvocationIntMod).toBe(p1.payload.empoweredEvocationIntMod);
    expect(rider.getEmpoweredEvocationFeatures).toHaveBeenCalledTimes(2);
    expect(rider.getEmpoweredEvocationIntModifier).toHaveBeenCalledTimes(2);
  });

  it('gate/carrier deny+allow table — exact (damage byte, INT scalar) pairs, and the CLA-120 invariant intMod>0 XOR marker-in-damage never coexists', async () => {
    const rows = [
      { label: 'r1 feature-absent wizard (dead twin reachable): passives [] — INT selector never even called (:36 short-circuit)',
        args: makeArgs({ playerStats: evoker(5, false) }),
        damage: '8d6', intMod: 0, intCalls: 0 },
      { label: 'r2 school gate on REAL disk row (Circle of Death, Necromancy, CON, 8d6@6)',
        args: makeArgs({ spell: CIRCLE_5E, fullSpell: CIRCLE_5E, effectiveDamageType: 'Necrotic', spellSaveDc: 19 }),
        damage: '8d6', intMod: 0, intCalls: 1 },
      { label: 'r3 INT modifier 0',
        args: makeArgs({ playerStats: evoker(0) }),
        damage: '8d6', intMod: 0, intCalls: 1 },
      { label: 'r4 NEGATIVE INT -5: selector byte returns -5 (-5 || 0), BOTH gates clamp — payload scalar never negative (verdict in header)',
        args: makeArgs({ playerStats: evoker(-5) }),
        damage: '8d6', intMod: 0, intCalls: 1 },
      { label: 'r5 no damage ladder: damage-object gate passes, fold skips null formula (damageCalculation-cla120:137-138 caller-guard twin), payload falls to :169 default',
        args: makeArgs({ spell: { ...FIREBALL_5E, damage: { damage_type: 'Fire' } }, fullSpell: { ...FIREBALL_5E, damage: { damage_type: 'Fire' } } }),
        damage: '0', intMod: 0, intCalls: 1 },
      { label: 'r6 QUIRK zero-dice ladder {3:"0"}: presence gate reads the OBJECT not the value — INT 5 rides next to dice byte "0" (shipped byte pinned)',
        args: makeArgs({ fullSpell: { ...FIREBALL_5E, damage: { damage_type: 'Fire', damage_at_slot_level: { 3: '0' } } } }),
        damage: '0', intMod: 5, intCalls: 1 },
      { label: 'r7 PRE-BAKED ladder (original bug shape): marker byte passthrough, intMod FORCED 0 by the :156 !== dedupe — modal can never double-fold',
        args: makeArgs({ fullSpell: { ...FIREBALL_5E, damage: { damage_type: 'Fire', damage_at_slot_level: { 3: '8d6 + 5 [Empowered Evocation]' } } } }),
        damage: '8d6 + 5 [Empowered Evocation]', intMod: 0, intCalls: 1 },
      { label: 'r8 pre-baked FOREIGN value "+ 3" with caster INT 5: dedupe keys on the MARKER, not the value',
        args: makeArgs({ fullSpell: { ...FIREBALL_5E, damage: { damage_type: 'Fire', damage_at_slot_level: { 3: '8d6 + 3 [Empowered Evocation]' } } } }),
        damage: '8d6 + 3 [Empowered Evocation]', intMod: 0, intCalls: 1 },
      { label: 'r9 REAL disk 2024 Fireball (shape-key row): identical fold bytes both rulesets (EE automation parity pinned by damageCalculation-cla120:102, cited)',
        args: makeArgs({ spell: FIREBALL_2024, fullSpell: FIREBALL_2024 }),
        damage: '8d6', intMod: 5, intCalls: 1 },
      { label: 'r10 REAL disk Burning Hands lv1 cone: slotLevel fallback byte 3d6 + INT scalar rides',
        args: makeArgs({ spell: BURNING_5E, fullSpell: BURNING_5E }),
        damage: '3d6', intMod: 5, intCalls: 1 },
    ];

    for (const row of rows) {
      rider.getEmpoweredEvocationFeatures.mockClear();
      rider.getEmpoweredEvocationIntModifier.mockClear();
      const popup = (await handleSavePath(row.args)).automationPopup;
      const { damage, empoweredEvocationIntMod: intMod } = popup.payload;

      expect(popup.modalName, row.label).toBe('saveAttackAoe');
      expect(damage, row.label).toBe(row.damage);
      expect(intMod, row.label).toBe(row.intMod);
      // CLA-120 INVARIANT: a marker inside damage and a rideable int scalar must
      // NEVER coexist — one of the two folds is always dead (XOR, per row).
      expect(damage.includes('[Empowered Evocation]') && intMod > 0, row.label).toBe(false);
      expect(rider.getEmpoweredEvocationFeatures, row.label).toHaveBeenCalledTimes(1); // ONE gate eval per cast
      expect(rider.getEmpoweredEvocationFeatures.mock.calls[0], row.label).toHaveLength(1);
      expect(rider.getEmpoweredEvocationIntModifier, row.label).toHaveBeenCalledTimes(row.intCalls);
      expect(rollExpression, row.label).not.toHaveBeenCalled();
      rider.triggerSoulstitchSpells.mockClear();
    }
    expect(consoleSpy).not.toHaveBeenCalled(); // every gate above is silent
  });

  it('golden crash twin: playerStats without automation rejects with the REAL selector byte — soulstitch try/catch (savePath.js:19-26) does not swallow it, console.error fired once with the exact tuple', async () => {
    const args = makeArgs({ playerStats: { name: 'TestEvoker', abilities: [{ name: 'Intelligence', bonus: 5 }] } });

    await expect(handleSavePath(args)).rejects.toThrow('Expected array, got undefined');
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy.mock.calls[0]).toEqual(['[postCastRiderService] Missing array:', undefined]);
    expect(rollExpression).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
