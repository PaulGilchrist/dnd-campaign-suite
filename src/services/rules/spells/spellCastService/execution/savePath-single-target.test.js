// @maintained-by-ai
/* ------------------------------------------------------------------ */
/*  savePath.js SINGLE-TARGET lane — module-direct (#1455 lineage)    */
/*                                                                      */
/*  LINEAGE / CITE-FORWARD:                                            */
/*   - #1455 historic bake cite pair 'savePath-single-target +       */
/*     damageCalculation-cla120' owning the bake-vs-roll row          */
/*     '2d10 + 3 [Empowered Evocation]' (#1462 verbatim, master       */
/*     spellCastService.test.js:366): this file no longer re-pins    */
/*     the recipe — damageCalculation-cla120.test.js:119 owns the   */
/*     bake UNIT and the master owns the CHAIN. This file pins the  */
/*     CONSUMER face: the pre-baked formula rides handleSavePath     */
/*     byte-identical into ONE rollExpression call and lands on the */
/*     rollDamage payload UNMODIFIED — no refold, no second '+N'.   */
/*     #1493 disposition: single-target is the SHARED-ROLL consumer  */
/*     of the damageCalculation.js:122-123 bake ('correct, one       */
/*     shared roll there'), vs the AoE dice-only suffix (:170) owned */
/*     by savePath-aoe-overchannel / -empowered-evocation. Pinned   */
/*     here by the 'Empowered Evocation' occurrence count in the     */
/*     shipped formula.                                                */
/*   - #1490 cited THIS file at :248 for the soulstitch throw-catch  */
/*     face — PRESERVED (see 'soulstitch throw-catch' below; old      */
/*     :248 → new line reported in the shift map).                   */
/*   - Healing-in-save-path (#1484 genericHeal): consumed on other   */
/*     lanes (earlyReturns-genericHeal / spellCastService.healing-   */
/*     EdgeCases) — cited, not grown here. No healing arm exists in  */
/*     handleSingleTargetSave (savePath.js:245-263).                 */
/*                                                                      */
/*  FAMILY BOUNDARY (owned elsewhere, cited not re-grown):            */
/*   - condition-vs-damage gate routing table → savePath-aoe-meta     */
/*     #1492; dcSuccess:'half' keystone + overlay/fetch +             */
/*     invocationCallOrder getCombatContext<fetch canon →              */
/*     savePath-aoe-damage #1490; EE gated scalar →                  */
/*     savePath-aoe-empowered-evocation #1491; suffix × EE →         */
/*     savePath-aoe-overchannel #1493 (computeOverchannel module     */
/*     face too); hub-level full ctx / auto-miss double-roll →       */
/*     spellCastService.test.js; caller gate `spell.dc ||            */
/*     fullSpell.dc` (index.js:755, Phantasmal Killer LIVE) →        */
/*     earlyReturns lane. OWNED HERE: save-vs-no-popup N=1 dispatch, */
/*     folded-int-bake CONSUMPTION (one shared roll), targetName     */
/*     metaCtx-overwrite, dc ?? arms on the single-target context,   */
/*     innate-sorcery +1 single face, VM local-predicate stamp        */
/*     (:205), soulstitch order/tuple/thrown, roller-falsy swallow.  */
/*                                                                      */
/*  MOCK CENSUS vs savePath.js:1-6 REAL imports + damageCalculation  */
/*  transitives (line-by-line):                                       */
/*   - diceRoller → MOCKED bare vi.fn(): this lane DOES roll; each   */
/*     test installs explicit byte-faithful results                  */
/*     ({total,rolls,modifier,formula} per diceRoller.js:107/:117). */
/*     No canned default absorbs an accidental roll.                 */
/*   - postCastRiderService → MOCKED triggerSoulstitchSpells (used,  */
/*     :20) + getEmpoweredEvocationFeatures /                        */
/*     getEmpoweredEvocationIntModifier (graph-required by           */
/*     damageCalculation.js:2; never called on this lane — bare      */
/*     vi.fn would crash the import if wrongly wired).               */
/*   - rangeValidation → UNMOCKED (prior canned regex re-implement   */
/*     removed per savePath-aoe-meta precedent): pure leaf, never    */
/*     called outside handleAoE.                                     */
/*   - damageUtils → getCombatContext stubbed null: never called on  */
/*     this lane (handleAoE only); stub guards the heavy             */
/*     dataLoader/attackCalc import graph.                           */
/*   - ./damageCalculation + ../../maps/spellOverlayService → REAL   */
/*     leaves; computeEmpoweredEvocation / overlayTargetId are       */
/*     AoE-only on this lane, so inert (zero network).               */
/*   - useRuntimeState → MOCKED for transitive load-safety            */
/*     (damageCalculation.js:3 setRuntimeValue; spellOverlayService  */
/*     / rangeCheck getRuntimeValue).                                */
/*   - DEAD MOCKS REMOVED: logService, viciousMockeryService —     */
/*     verified absent from savePath.js imports AND from every       */
/*     real-loaded module in this graph. The VM trigger is a         */
/*     CONSUMER-side seam pinned by                              */
/*     handleNpcSaveDamage.viciousMockery.test.js; the cast-time     */
/*     face here is the LOCAL predicate stamp (savePath.js:205/:238) */
/*     — asserting not.toHaveBeenCalled() on an un-imported module   */
/*     was structurally vacuous (canned-mock-hollowing #1491).       */
/*                                                                      */
/*  QUIRK CENSUS (pinned): quirk: metaCtx.targetName overwrites      */
/*  getTargetInfo().name (:212 vs :215 spread); dcSuccess ?? lets an */
/*  explicit null fall through — null cannot veto (:223, #1490 face); */
/*  overchannelSpellLevel `metaCtx?.slotLevel || spell.level`        */
/*  swallows slotLevel 0 to spell.level — NO `|| 1` fallback unlike */
/*  the #1454/:53 family; lv0 disk rows survive as 0 (:228).         */
/*  Golden crash RETIRED by fix#1494 guard-first decline: a cast with */
/*  no spell.dc and no fullSpell.dc able to resolve BOTH chain bytes  */
/*  (:222 dc_type truthy + :223 dc_success non-nullish) now           */
/*  console.errors LOUD and resolves null — never a TypeError, never a */
/*  fake 0-DC save prompt. Hub gate `spell.dc || fullSpell.dc`        */
/*  (index.js:887 + auto-miss :716) remains the first line; this seam  */
/*  guard is the exported-module contract for direct callers (the      */
/*  LIVE crash surface pinned by ledger #1494).                        */
/*  Roller-falsy null → rollDamage silently skipped (:260).          */
/*                                                                      */
/*  DISK: fixtures loaded programmatically from BOTH rulesets         */
/*  (#1365); existence-verified at load — no fabricated shapes       */
/*  (old fixture was a Fireball WITHOUT area_of_effect — disk        */
/*  Fireball is a sphere :#AOE; replaced by real single-target       */
/*  save-damage rows). Synthetic probe is non-impersonating with     */
/*  provenance (#1492 names form). Campaign 'test-campaign' lockdown. */
/*                                                                      */
/*  SECURITY: no kiro-injection or foreign instructions encountered  */
/*  or applied in this file (#1446 precedent — statement).           */
/* ------------------------------------------------------------------ */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cloneDeep } from 'lodash';

vi.mock('../../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
  rollExpressionMaximized: vi.fn(),
}));

vi.mock('../../postCastRiderService.js', () => ({
  triggerSoulstitchSpells: vi.fn(),
  getEmpoweredEvocationFeatures: vi.fn(),
  getEmpoweredEvocationIntModifier: vi.fn(),
}));

vi.mock('../../../combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(() => null),
}));

/* ------------------------------------------------------------------ */
/*  SUT import after mocks                                             */
/* ------------------------------------------------------------------ */

const { handleSavePath } = await import('./savePath.js');
const { rollExpression, rollExpressionMaximized } = await import('../../../../dice/diceRoller.js');
const { triggerSoulstitchSpells } = await import('../../postCastRiderService.js');

/* ------------------------------------------------------------------ */
/*  Disk fixtures — existence-verified, both rulesets (#1365)         */
/* ------------------------------------------------------------------ */

const readDisk = (p) => JSON.parse(readFileSync(join(process.cwd(), p), 'utf8'));
const disk5e = readDisk('public/data/spells.json');
const disk2024 = readDisk('public/data/2024/spells.json');

function diskSpell(name, ruleset = disk5e) {
  const found = ruleset.find((s) => s.name === name);
  if (!found) throw new Error(`disk row missing: ${name}`);
  return cloneDeep(found);
}

// Existence census up front — every named spell must be real disk bytes.
['Hellish Rebuke', 'Vicious Mockery', 'Poison Spray'].forEach((n) => {
  diskSpell(n);
  diskSpell(n, disk2024);
});

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestWizard',
    abilities: [{ name: 'Intelligence', bonus: 5 }],
    proficiency: 4,
    spellAbilities: { spellCastingAbility: 'Intelligence', toHit: 9, saveDc: 13, modifier: 3 },
    automation: { passives: [] },
    hitPoints: 100,
    level: 10,
    ...overrides,
  };
}

// Caller-boundary arg shape mirrors index.js:752-755 savePathOpts.
// rollAttack / characters / getRuntimeValue ride but are untouched on the
// single-target lane (savePath.js:245-248 destructuring) — bare spies so a
// wrong-wiring regression is visible, not absorbed.
function makeArgs(overrides = {}) {
  const spell = overrides.spell ?? diskSpell('Hellish Rebuke');
  return {
    spell,
    fullSpell: overrides.fullSpell ?? cloneDeep(spell),
    metaCtx: { targetName: 'Goblin', slotLevel: spell.level, metamagicHeighten: false },
    playerStats: makePlayerStats(),
    campaignName: 'test-campaign',
    mapName: null,
    characters: [],
    getTargetInfo: vi.fn(async () => ({ name: 'Goblin Ambient' })),
    getRuntimeValue: vi.fn(),
    innateSorceryActive: false,
    effectiveDamageType: 'Fire',
    spellSaveDc: 13,
    overchannelFormula: null,
    overchannelActive: false,
    overchannelUseCount: 0,
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    formula: '2d10',
    hasInvisible: false,
    ...overrides,
  };
}

const rollerResult = (total, rolls, modifier, formula) => ({ total, rolls, modifier, formula });

/* ------------------------------------------------------------------ */
/*  Suite                                                              */
/* ------------------------------------------------------------------ */

describe('savePath.js — single-target save lane', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    triggerSoulstitchSpells.mockResolvedValue([]);
  });

  it('ships an N=1 full-exact rollDamage payload in cast order with no popup, and metaCtx.targetName overwrites getTargetInfo().name', async () => {
    const args = makeArgs({ metaCtx: { targetName: 'Goblin', slotLevel: 1, metamagicHeighten: false } });
    rollExpression.mockReturnValue(rollerResult(10, [1, 2, 3, 4], 0, '2d10'));

    const result = await handleSavePath(args);

    expect(result).toBeUndefined();
    // CLA-321 stamp-before-resolution: soulstitch → target lookup → roll → dispatch.
    expect(triggerSoulstitchSpells.mock.invocationCallOrder[0]).toBeLessThan(args.getTargetInfo.mock.invocationCallOrder[0]);
    expect(args.getTargetInfo.mock.invocationCallOrder[0]).toBeLessThan(rollExpression.mock.invocationCallOrder[0]);
    expect(rollExpression.mock.invocationCallOrder[0]).toBeLessThan(args.rollDamage.mock.invocationCallOrder[0]);
    expect(args.getTargetInfo).toHaveBeenCalledTimes(1);
    expect(rollExpression).toHaveBeenCalledTimes(1);
    expect(rollExpressionMaximized).not.toHaveBeenCalled();
    expect(args.rollDamage).toHaveBeenCalledTimes(1);
    expect(args.rollDamage.mock.calls[0]).toHaveLength(1);

    const payload = args.rollDamage.mock.calls[0][0];
    expect(payload).toStrictEqual({
      name: 'Hellish Rebuke',
      formula: '2d10',
      total: 10,
      rolls: [1, 2, 3, 4],
      modifier: 0,
      context: {
        targetName: 'Goblin', // :215 metaCtx spread overwrites :212 'Goblin Ambient'
        attackerName: 'TestWizard',
        soulstitchCast: false,
        slotLevel: 1, // rides via ...metaCtx
        spellSchool: 'Evocation', // CLA-037 stamp, disk school byte
        damageType: 'Fire',
        saveDc: 13,
        saveType: 'DEX', // disk uppercase GOLD byte pass-through
        dcSuccess: 'half', // disk keystone byte, ?? chain :223
        metamagicHeighten: false,
        isCantrip: false,
        overchannelActive: false,
        overchannelUseCount: 0,
        overchannelSpellLevel: 1,
        playerStats: args.playerStats,
      },
    });
    expect(payload.context.playerStats).toBe(args.playerStats);
    expect(payload.context.spellSchool).toBe(args.fullSpell.school);
  });

  it('consumes the pre-baked Empowered Evocation formula byte-identical in ONE roll — never refolded (#1455/#1462 consumer face, #1493 shared-roll contract)', async () => {
    // Row provenance: disk 5e Hellish Rebuke slot-1 '2d10' + INT 3 baked by
    // damageCalculation.js:48 → '2d10 + 3 [Empowered Evocation]' (verbatim
    // #1462 row; recipe unit pinned damageCalculation-cla120.test.js:119).
    const baked = '2d10 + 3 [Empowered Evocation]';
    const args = makeArgs({ formula: baked });
    rollExpression.mockReturnValue(rollerResult(16, [5, 5, 6], 0, baked));

    await handleSavePath(args);

    expect(rollExpression).toHaveBeenCalledTimes(1);
    expect(rollExpression).toHaveBeenCalledWith(baked);
    expect(rollExpressionMaximized).not.toHaveBeenCalled();
    expect(args.rollDamage).toHaveBeenCalledTimes(1);
    const { formula } = args.rollDamage.mock.calls[0][0];
    expect(formula).toBe(baked);
    // No refold: the adder marker appears exactly once (CLA-120 dup-fold bug shape).
    expect(formula.match(/\[Empowered Evocation\]/g)).toHaveLength(1);
  });

  it('routes overchannel to the maximized roller with the full baked suffix chain unmodified, and lv0 slotLevel survives as 0 (no ||1 fallback)', async () => {
    const ocFormula = '2d10 + 3 [Empowered Evocation] [Overchannel Maximize]';
    const args = makeArgs({
      formula: '2d10 + 3 [Empowered Evocation]',
      overchannelActive: true,
      overchannelFormula: ocFormula,
      overchannelUseCount: 2,
    });
    rollExpressionMaximized.mockReturnValue(rollerResult(21, [6, 6, 6], 3, ocFormula));

    await handleSavePath(args);

    expect(rollExpression).not.toHaveBeenCalled();
    expect(rollExpressionMaximized).toHaveBeenCalledTimes(1);
    expect(rollExpressionMaximized).toHaveBeenCalledWith(ocFormula);
    const payload = args.rollDamage.mock.calls[0][0];
    expect(payload.formula).toBe(ocFormula);
    expect(payload.total).toBe(21);
    expect(payload.rolls).toStrictEqual([6, 6, 6]);
    expect(payload.modifier).toBe(3);
    expect(payload.context.overchannelActive).toBe(true);
    expect(payload.context.overchannelUseCount).toBe(2);
    expect(payload.context.overchannelSpellLevel).toBe(1);

    // lv0 survivorship: disk Poison Spray cantrip, slotLevel 0 swallowed by
    // `metaCtx?.slotLevel || spell.level` (:228) to spell.level 0 — NOT 1.
    const spray = diskSpell('Poison Spray');
    const sprayArgs = makeArgs({
      spell: spray,
      fullSpell: cloneDeep(spray),
      metaCtx: { targetName: 'Goblin', slotLevel: 0 },
      formula: '1d12', // disk damage_at_character_level {1:'1d12'} consumer byte
      effectiveDamageType: 'Poison',
      overchannelActive: true,
      overchannelFormula: '1d12 [Overchannel Maximize]',
    });
    rollExpressionMaximized.mockReturnValue(rollerResult(12, [6, 6], 0, '1d12 [Overchannel Maximize]'));

    await handleSavePath(sprayArgs);

    const sprayCtx = sprayArgs.rollDamage.mock.calls[0][0].context;
    expect(sprayCtx.overchannelSpellLevel).toBe(0);
    expect(sprayCtx.isCantrip).toBe(true);
  });

  it('silently skips rollDamage when the roller returns falsy (:260 swallow), after soulstitch and target resolution already fired', async () => {
    const args = makeArgs();
    rollExpression.mockReturnValue(null);

    const result = await handleSavePath(args);

    expect(result).toBeUndefined();
    expect(rollExpression).toHaveBeenCalledTimes(1);
    expect(args.rollDamage).not.toHaveBeenCalled();
    expect(triggerSoulstitchSpells).toHaveBeenCalledTimes(1);
    expect(args.getTargetInfo).toHaveBeenCalledTimes(1);
  });

  it('rides the soulstitch tuple with argument identity and stamps soulstitchCast — array flag true, non-array degrades to present-false', async () => {
    const selection = ['Fireball'];
    const args = makeArgs();
    triggerSoulstitchSpells.mockResolvedValue(selection);
    rollExpression.mockReturnValue(rollerResult(10, [4, 6], 0, '2d10'));

    await handleSavePath(args);

    const call = triggerSoulstitchSpells.mock.calls[0];
    expect(call).toHaveLength(5);
    expect(call[0]).toBe(args.fullSpell);
    expect(call[1]).toBe(args.metaCtx);
    expect(call[2]).toBe(args.playerStats);
    expect(call[3]).toBe('test-campaign');
    expect(call[4]).toBe(null);
    expect(args.rollDamage.mock.calls[0][0].context.soulstitchCast).toBe(true);

    // Non-array result (CLA-321 selector-less caster): :21 Array.isArray guard
    // → [] → soulstitchCast false, KEY PRESENT (toStrictEqual vs absent).
    triggerSoulstitchSpells.mockResolvedValue(undefined);
    const args2 = makeArgs();
    rollExpression.mockReturnValue(rollerResult(10, [4, 6], 0, '2d10'));

    await handleSavePath(args2);

    expect(args2.rollDamage.mock.calls[0][0].context).toHaveProperty('soulstitchCast', false);
  });

  it('soulstitch throw-catch: logs the exact console tuple and the cast survives to exactly one rollDamage (:248 face, cited #1490 — PRESERVED)', async () => {
    const args = makeArgs();
    const err = new Error('Soulstitch failed');
    triggerSoulstitchSpells.mockRejectedValue(err);
    rollExpression.mockReturnValue(rollerResult(10, [1, 2, 3, 4], 0, '2d10'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await handleSavePath(args);

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith('[spellCast] Soulstitch Spells trigger failed:', err);
    expect(args.rollDamage).toHaveBeenCalledTimes(1);
    expect(args.rollDamage.mock.calls[0][0].context.soulstitchCast).toBe(false);
    consoleSpy.mockRestore();
  });

  it('Vicious Mockery local predicate (:205) stamps consumer-gate bytes; no other spell carries the keys', async () => {
    const vm = diskSpell('Vicious Mockery');
    const args = makeArgs({
      spell: vm,
      fullSpell: cloneDeep(vm),
      mapName: 'test-map',
      formula: '1d4', // disk damage_at_character_level {1:'1d4'}
      effectiveDamageType: 'Psychic',
      spellSaveDc: 15,
    });
    rollExpression.mockReturnValue(rollerResult(3, [3], 0, '1d4'));

    await handleSavePath(args);

    const ctx = args.rollDamage.mock.calls[0][0].context;
    expect(ctx.viciousMockerySpell).toBe(args.spell);
    expect(ctx.viciousMockeryMapName).toBe('test-map');
    expect(ctx.saveType).toBe('WIS'); // disk byte
    expect(ctx.dcSuccess).toBe('none'); // disk byte — 'none' rides verbatim, no normalization on this lane

    // Non-VM: neither key exists (merged former 'does not stamp' face).
    const args2 = makeArgs();
    rollExpression.mockReturnValue(rollerResult(10, [5, 5], 0, '2d10'));

    await handleSavePath(args2);

    const ctx2 = args2.rollDamage.mock.calls[0][0].context;
    expect(Object.keys(ctx2).filter((k) => k.startsWith('viciousMockery'))).toHaveLength(0);
    expect(args2.rollDamage.mock.calls[0][0].formula).toBe('2d10');
  });

  it('dc bytes: fullSpell.dc wins over spell.dc, and an explicit-null dc_success cannot veto the ?? fallthrough (:223, #1490 face)', async () => {
    rollExpression.mockReturnValue(rollerResult(10, [5, 5], 0, '2d10'));

    // Arm 1: synthetic divergent dc on the spell copy (disk HR owns fullSpell).
    const args = makeArgs({
      spell: { ...diskSpell('Hellish Rebuke'), dc: { dc_type: 'CON', dc_success: 'none' } },
      fullSpell: diskSpell('Hellish Rebuke'),
    });
    await handleSavePath(args);
    let ctx = args.rollDamage.mock.calls[0][0].context;
    expect(ctx.saveType).toBe('DEX'); // fullSpell disk byte wins (:222)
    expect(ctx.dcSuccess).toBe('half'); // fullSpell disk byte wins (:223)

    // Arm 2: explicit null on fullSpell.dc_success — ?? falls through to spell's.
    const args2 = makeArgs({
      fullSpell: { ...diskSpell('Hellish Rebuke'), dc: { dc_type: 'DEX', dc_success: null } },
    });
    await handleSavePath(args2);
    ctx = args2.rollDamage.mock.calls[0][0].context;
    expect(ctx.saveType).toBe('DEX');
    expect(ctx.dcSuccess).toBe('half'); // null cannot veto — disk spell.dc supplies

    // Arm 3 (2024 disk divergence, #1365 both rulesets): disk 2024 Ray of
    // Sickness carries NO dc — it is gated out at the hub (index.js:887
    // live) and never reaches here (noSavePath lane owns it; the :222
    // unguarded-deref crash twin is declined loud at the seam — #1494
    // guard arms pinned in the decline suite below).
  });

  it('saveDc carries the innate-sorcery +1 only when armed; metamagicHeighten rides hasInvisible; spellSchool stamp falls back fullSpell→spell→null', async () => {
    rollExpression.mockReturnValue(rollerResult(10, [5, 5], 0, '2d10'));

    const base = makeArgs();
    await handleSavePath(base);
    expect(base.rollDamage.mock.calls[0][0].context.saveDc).toBe(13);

    const innate = makeArgs({ innateSorceryActive: true, spellSaveDc: 14 });
    await handleSavePath(innate);
    expect(innate.rollDamage.mock.calls[0][0].context.saveDc).toBe(15); // 14 + 1

    const heighten = makeArgs({ hasInvisible: true });
    await handleSavePath(heighten);
    expect(heighten.rollDamage.mock.calls[0][0].context.metamagicHeighten).toBe(true);

    const spellOnly = makeArgs({ fullSpell: { ...diskSpell('Hellish Rebuke'), school: undefined } });
    await handleSavePath(spellOnly);
    expect(spellOnly.rollDamage.mock.calls[0][0].context.spellSchool).toBe('Evocation'); // :10 spell.school arm

    const bare = makeArgs({
      spell: { ...diskSpell('Hellish Rebuke'), school: undefined },
      fullSpell: { ...diskSpell('Hellish Rebuke'), school: undefined },
    });
    await handleSavePath(bare);
    expect(bare.rollDamage.mock.calls[0][0].context.spellSchool).toBe(null); // :10 null arm
  });

  it('isCantrip is armed by baseLevel === 0 OR level === 0 and false for leveled spells', async () => {
    rollExpression.mockReturnValue(rollerResult(10, [5, 5], 0, '2d10'));

    const spray = diskSpell('Poison Spray'); // lv0 disk row
    const args = makeArgs({ spell: spray, fullSpell: cloneDeep(spray), formula: '1d12', effectiveDamageType: 'Poison' });
    await handleSavePath(args);
    expect(args.rollDamage.mock.calls[0][0].context.isCantrip).toBe(true);

    // Synthetic probe (non-impersonating, #1492 names form): heightened-cantrip
    // shape where level was stamped up but baseLevel stayed 0 (:225 first arm).
    const probe = { name: 'Synthetic Heightened Cantrip Probe', level: 1, baseLevel: 0, school: 'Evocation', dc: { dc_type: 'CON', dc_success: 'none' } };
    const args2 = makeArgs({ spell: probe, fullSpell: cloneDeep(probe) });
    await handleSavePath(args2);
    expect(args2.rollDamage.mock.calls[0][0].context.isCantrip).toBe(true);

    const leveled = makeArgs(); // Hellish Rebuke lv1
    await handleSavePath(leveled);
    expect(leveled.rollDamage.mock.calls[0][0].context.isCantrip).toBe(false);
  });

  /* ---------------------------------------------------------------- */
  /*  #1494 guard-first decline suite (flips the pre-fix golden     */
  /*  TypeError pin at old :482). Pre-fix capture, verbatim, run    */
  /*  against the unguarded :222-:223 bytes:                        */
  /*    TypeError: Cannot read properties of undefined (reading      */
  /*    'dc_type')   ← :222, both-dc-absent and dc:{}/partial arms  */
  /*    TypeError: Cannot read properties of undefined (reading      */
  /*    'dc_success') ← :223, dc_type-only arm                      */
  /*  Hub-path face stays byte-intact: disk census 260/260 dc rows */
  /*  carry both fields, and every surviving arm above runs          */
  /*  untouched (#1348 hub-gate path preservation).                  */
  /* ---------------------------------------------------------------- */

  it('#1494 both dc absent → LOUD console.error + resolve null — no TypeError, no picker, no roll, no fake 0-DC prompt', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const args = makeArgs({
      spell: { ...diskSpell('Hellish Rebuke'), dc: undefined },
      fullSpell: { ...diskSpell('Hellish Rebuke'), dc: undefined },
    });

    const result = await handleSavePath(args);

    expect(result).toBe(null); // house decline shape: falsy → hub :889 falls through to post-cast triggers
    expect(consoleSpy).toHaveBeenCalledTimes(1); // guard must be loud BEFORE refusing
    expect(consoleSpy.mock.calls[0][0]).toMatch(/no save dc on spell or fullSpell/);
    expect(consoleSpy.mock.calls[0][1]).toBe('Hellish Rebuke');
    expect(args.getTargetInfo).not.toHaveBeenCalled(); // guard precedes the target picker — no side effects
    expect(rollExpression).not.toHaveBeenCalled();
    expect(args.rollDamage).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('#1494 residual crash arms: spell.dc absent + fullSpell.dc cannot resolve BOTH chain bytes → decline each (dc:{} crashes :222 pre-fix; dc_type-only and explicit-null dc_success crash :223 pre-fix)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const partialRows = [
      { label: 'dc:{} — :222 `||` fallthrough derefs spell.dc', dc: {} },
      { label: 'dc_type only — :223 `??` fallthrough derefs spell.dc', dc: { dc_type: 'CON' } },
      { label: 'explicit-null dc_success — ?? treats null as MISSING', dc: { dc_type: 'CON', dc_success: null } },
      { label: 'dc:null — optional chain yields undefined on both rungs', dc: null },
    ];

    for (const row of partialRows) {
      const args = makeArgs({
        spell: { ...diskSpell('Hellish Rebuke'), dc: undefined },
        fullSpell: { ...diskSpell('Hellish Rebuke'), dc: row.dc },
      });
      const result = await handleSavePath(args);
      expect(result, row.label).toBe(null);
      expect(consoleSpy, row.label).toHaveBeenCalledTimes(1);
      expect(args.rollDamage, row.label).not.toHaveBeenCalled();
      consoleSpy.mockClear();
    }
    consoleSpy.mockRestore();
  });

  it('#1494 guard does NOT over-reach: fullSpell.dc resolves both chain bytes → spell survives and ships the fullSpell dc rungs (chooser-row-supplied-by-disk hub shape)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    rollExpression.mockReturnValue(rollerResult(10, [5, 5], 0, '2d10'));
    const args = makeArgs({
      spell: { ...diskSpell('Hellish Rebuke'), dc: undefined }, // lightweight chooser row shape (fix#119 census)
      fullSpell: diskSpell('Hellish Rebuke'), // disk-resolved full row: dc {dc_type:'DEX', dc_success:'half'}
    });

    const result = await handleSavePath(args);

    expect(result).toBeUndefined(); // success lane shape unchanged (handleSingleTargetSave resolves undefined)
    expect(consoleSpy).not.toHaveBeenCalled();
    const ctx = args.rollDamage.mock.calls[0][0].context;
    expect(ctx.saveType).toBe('DEX'); // :222 fullSpell first arm, byte-intact
    expect(ctx.dcSuccess).toBe('half'); // :223 fullSpell arm, byte-intact
    consoleSpy.mockRestore();
  });

  it('#1494 guard is dc-ABSENCE-scoped, not field-validation-scoped: spell.dc present-but-empty object survives with undefined rungs (pre-fix quirk, unchanged)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    rollExpression.mockReturnValue(rollerResult(10, [5, 5], 0, '2d10'));
    const args = makeArgs({
      spell: { ...diskSpell('Hellish Rebuke'), dc: {} },
      fullSpell: { ...diskSpell('Hellish Rebuke'), dc: {} },
    });

    const result = await handleSavePath(args);

    expect(result).toBeUndefined();
    expect(consoleSpy).not.toHaveBeenCalled(); // bare derefs on PRESENT objects were never the #1494 crash surface
    const ctx = args.rollDamage.mock.calls[0][0].context;
    expect(ctx.saveType).toBeUndefined();
    expect(ctx.dcSuccess).toBeUndefined();
    expect(args.rollDamage).toHaveBeenCalledTimes(1);
    consoleSpy.mockRestore();
  });
});
