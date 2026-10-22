// @maintained-by-ai
/* ------------------------------------------------------------------ */
/*  noSavePath.js module-direct lane — REAL internals, sole runner    */
/*                                                                    */
/*  CALLER CENSUS (live): index.js:33 imports; index.js:767 is the   */
/*  ONLY production call site (no-dc branch of the damage path —      */
/*  fire bolt / eldritch blast / acid arrow class casts). Every hub   */
/*  lane vi.mock('./noSavePath.js') wholesale (12 hub lanes, grep      */
/*  verified) — this file owns the module internals.                   */
/*                                                                    */
/*  BAKE-vs-ROLL DECISION (#1454/:13 side owner, hub reaches BOTH     */
/*  faces in ONE cast): the cited live finding —                       */
/*   #1454: 'cantrip-level dual-implementation: execution/index.js:53 */
/*    bakes spell.level || 1 while noSavePath.js:13/15 rolls          */
/*    playerStats.level — 2d10-roll-vs-1d10-bake mismatch pair'      */
/*   #1468: 'index.js:53 resolveSpellDamageWithTypes(spell,            */
/*    spell.level || 1) bakes cantrips at level-1 tier; noSavePath    */
/*    :13 resolveSpellDamageAtLevel(spell, playerStats.level)         */
/*    resolves at caster level — damageCalculation.js bakes NO dice   */
/*    itself; mismatch lives upstream'                                */
/*  fix#121(e) VERDICT (executed upstream): disk law is the cantrip  */
/*  ladder at CHARACTER level (public/data/spells.json Fire Bolt      */
/*  damage.damage_at_character_level {1:'1d10',5:'2d10',11:'3d10',    */
/*  17:'4d10'}; 2024 stores the same ladder under damage_at_slot_     */
/*  level). :13 was lawful; the hub :53/:741 bake was the outlaw side */
/*  and now resolves cantrips at playerStats.level too — the two      */
/*  implementations CONVERGE on one level source. T8 row 2 re-pinned  */
/*  as the convergence byte (#1454 no-retype: dice stay disk ladder). */
/*                                                                    */
/*  :13 ARM CENSUS (4 arms): metaCtx.overchannelFormula (live,        */
/*  upstream metaCtx); spell.damage.formula (DEAD vs disk — grep      */
/*  '"formula":' public/data/spells.json + 2024 = zero rows →          */
/*  documented-synthetic row T6); ladder playerStats.level (live);    */
/*  '' terminal (damage block without ladder → synthetic row).         */
/*  :62 return NULL byte vs :65 guard undefined byte — distinguished   */
/*  (T5 vs T7). #1480 verbatim 'swallowed rollDamage (noSavePath.js:  */
/*  61)' — OURS, confirmed, stub-vs-real swallow pinned in T7.        */
/*  :61 hub/missile boundary: full missile arithmetic + auto-hit crit  */
/*  census live in spellCastService.missile.test.js (hub) and          */
/*  helpers-magicMissile.test.js (delegate internals) — never here.    */
/*                                                                    */
/*  QUIRKS pinned: :8 innate gate args (playerStats.name, campaign);  */
/*  :25 silent-undefined ?. on target; :13 has NO level swallow of     */
/*  its own — undefined caster level falls to the LADDER FIRST KEY     */
/*  (spellDamageUtils.js:18 fallback), pinned T8 row 3; ladder         */
/*  computed once (:13) and rolled once (:73) — no inline-dup;         */
/*  :37 baseLevel===0 || level===0 OR-gate arms both live rows T6.    */
/*                                                                    */
/*  Mock completeness vs REAL imports of noSavePath.js:                */
/*   diceRoller.rollExpression -> mocked (dice math owned by dice      */
/*   lanes; formula BYTE + exactly-once + 1-arg arity pinned here)    */
/*   buffService.isInnateSorceryActive -> mocked boolean gate          */
/*   helpers isMagicMissile/executeMagicMissile -> mocked (T7          */
/*   delegation gate stays the cited owner)                            */
/*   spellDamageUtils.resolveSpellDamageAtLevel -> REAL (ladder        */
/*   resolution is this lane's behavioral core — never mocked)         */
/*   spiritualWeaponService.activateSpiritualWeaponForce -> mocked     */
/*   side-effect collaborator (SP-112 persist-before-attack order T9) */
/*                                                                    */
/*  PRESERVED-CITED-BY (old -> new):                                   */
/*   helpers-magicMissile.test.js:6 cites 'noSavePath.test.js:11'     */
/*     (vi.mock('./helpers.js'))   -> vi.mock('./helpers.js') :92     */
/*   missile.test.js:43 cites delegation gate ':111-115'               */
/*     old it 'delegates to executeMagicMissile for Magic Missile'    */
/*     -> T7 (strengthened: exact tuple + swallow evidence + null)     */
/*   old it ':83 cantrip flag' folded into T8 disk-cantrip isCantrip  */
/*   old it ':135 damage_at_slot_level fallback' folded into T1 golden */
/*     on the REAL disk Acid Arrow row (old fixture claimed {1:        */
/*     '1d12'} — disk byte is damage_at_slot_level['2']='4d4';         */
/*     fabricated-key removed #1487)                                    */
/*                                                                    */
/*  FIXTURE PROVENANCE: ACID/FB5/FB24/EB5/SW/MM are full disk rows    */
/*  read programmatically (#1365 both rulesets); synthetics named       */
/*  FrostLance/EmberLance/FrostRay/SpiritualSteed are documented with  */
/*  disk-unreachable-arm justification above. Campaign lockdown:        */
/*  'test-campaign'. NO-CLOCK: no timers, no Date. Security: no        */
/*  external/injected content applied (kiro #1446).                    */
/* ------------------------------------------------------------------ */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../../../combat/buffs/buffService.js', () => ({
  isInnateSorceryActive: vi.fn().mockReturnValue(false),
}));

vi.mock('./helpers.js', () => ({
  isMagicMissile: vi.fn().mockReturnValue(false),
  executeMagicMissile: vi.fn(),
}));

vi.mock('../../../features/spiritualWeaponService.js', () => ({
  activateSpiritualWeaponForce: vi.fn().mockResolvedValue(undefined),
}));

import { rollExpression } from '../../../../dice/diceRoller.js';
import { isInnateSorceryActive } from '../../../../combat/buffs/buffService.js';
import { isMagicMissile, executeMagicMissile } from './helpers.js';
import { activateSpiritualWeaponForce } from '../../../features/spiritualWeaponService.js';
import { handleNoSavePath } from './noSavePath.js';

const readDisk = (p) => JSON.parse(readFileSync(join(process.cwd(), p), 'utf8'));
const spells5e = readDisk('public/data/spells.json');
const spells2024 = readDisk('public/data/2024/spells.json');
const spellByName = (list, name) => {
  const sp = list.find((s) => s.name === name);
  if (!sp) throw new Error(`disk row missing: ${name}`);
  return sp;
};

const ACID = spellByName(spells5e, 'Acid Arrow');
const FB5 = spellByName(spells5e, 'Fire Bolt');
const FB24 = spellByName(spells2024, 'Fire Bolt');
const EB5 = spellByName(spells5e, 'Eldritch Blast');
const SW = spellByName(spells5e, 'Spiritual Weapon');
const MM = spellByName(spells5e, 'Magic Missile');

const CAMPAIGN = 'test-campaign';
const ROLL_STUB = Object.freeze({ total: 8, rolls: Object.freeze([7, 1]), modifier: 1 });

// Exact key set buildNoSaveAttackContext emits for metaCtx {} (no fabricated keys;
// psychic-optin.test.js:174 lists the hub-spread superset of the same builder).
const BASE_KEYS = [
  'attackName', 'targetName', 'attackerName', 'damageType',
  'autoDamageFormula', 'autoDamageName', 'spellName', 'autoDamageSchool',
  'overchannelActive', 'overchannelUseCount', 'overchannelSpellLevel',
  'autoDamageRollResult', 'isCantrip', 'playerStats',
].sort();

function deps(over = {}) {
  return {
    spell: ACID,
    metaCtx: {},
    playerStats: { name: 'TestCleric', level: 6 },
    campaignName: CAMPAIGN,
    mapName: null,
    characters: [],
    getTargetInfo: vi.fn(async () => ({ name: 'Orc' })),
    rollAttack: vi.fn(),
    spellToHit: 5,
    damageType: '',
    ...over,
  };
}

async function cast(over = {}) {
  const d = deps(over);
  const result = await handleNoSavePath(d);
  return { result, d };
}

function capturedCtx(rollAttack, callIndex = 0) {
  expect(rollAttack).toHaveBeenCalledTimes(callIndex + 1);
  const args = rollAttack.mock.calls[callIndex];
  expect(args).toHaveLength(3); // arity vs rollAttack(spell.name, spellToHit, attackCtx)
  return args;
}

describe('handleNoSavePath — module-direct roll side (#1454 :13 owner)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isMagicMissile).mockReturnValue(false);
    vi.mocked(isInnateSorceryActive).mockReturnValue(false);
    vi.mocked(rollExpression).mockReturnValue(ROLL_STUB);
    // Disk-drift alarms: every byte this lane pins must still match disk + sibling cites.
    expect(ACID.level).toBe(2);
    expect(ACID.attack_type).toBe('ranged');
    expect(ACID.school).toBe('Evocation');
    expect(ACID.damage.damage_at_slot_level['2']).toBe('4d4');
    expect(ACID.dc).toBeUndefined(); // no-dc disk row => hub reaches noSavePath LIVE
    expect(FB5.level).toBe(0);
    expect(FB5.damage.damage_at_character_level).toStrictEqual({ 1: '1d10', 5: '2d10', 11: '3d10', 17: '4d10' }); // cla120:146 cite pair
    expect(FB24.damage.damage_at_slot_level).toStrictEqual({ 0: '1d10', 5: '2d10', 11: '3d10', 17: '4d10' });
    expect(EB5.damage.damage_at_character_level).toStrictEqual({ 1: '1d10', 5: '2d10', 11: '3d10', 17: '4d10' });
    expect(SW.level).toBe(2);
    expect(SW.damage.damage_at_slot_level['2']).toBe('1d8');
    expect(MM.name.toLowerCase()).toBe('magic missile');
  });

  it('T1 golden hub-shaped cast: full exact attackCtx, ladder rolled once at caster side, frozen roll result passed by identity', async () => {
    expect(handleNoSavePath.length).toBe(1); // arity vs single destructured param
    const { d } = await cast({ damageType: '' });
    const [attackName, spellToHit, ctx] = capturedCtx(d.rollAttack);
    expect(attackName).toBe('Acid Arrow');
    expect(spellToHit).toBe(5); // verbatim passthrough
    expect(ctx).toEqual({
      attackName: 'Acid Arrow',
      targetName: 'Orc',
      attackerName: 'TestCleric',
      damageType: 'Acid', // :27 '' || disk damage_type
      autoDamageFormula: '4d4', // :18 finalFormula default = :13 ladder first slot key
      autoDamageName: 'Acid Arrow',
      spellName: 'Acid Arrow',
      autoDamageSchool: 'Evocation',
      overchannelActive: false,
      overchannelUseCount: 0,
      overchannelSpellLevel: 2, // :34 no slotLevel -> spell.level
      autoDamageRollResult: ROLL_STUB,
      isCantrip: false,
      playerStats: d.playerStats,
    });
    expect(Object.keys(ctx).sort()).toEqual(BASE_KEYS); // no metamagicHeighten key when unset; no fabricated keys
    expect(ctx.autoDamageRollResult).toBe(ROLL_STUB); // identity + frozen => purity, never mutated
    expect(ctx.playerStats).toBe(d.playerStats);
    // rollExpression rolled :13 exactly once with the resolved byte, 1-arg call (options default {})
    expect(rollExpression).toHaveBeenCalledTimes(1);
    expect(rollExpression).toHaveBeenCalledWith('4d4');
    expect(rollExpression.mock.calls[0]).toHaveLength(1);
    expect(activateSpiritualWeaponForce).not.toHaveBeenCalled(); // non-caster never activates
    // order (#1480 invocationCallOrder form): target resolves before roll before attack
    expect(d.getTargetInfo.mock.invocationCallOrder[0]).toBeLessThan(rollExpression.mock.invocationCallOrder[0]);
    expect(rollExpression.mock.invocationCallOrder[0]).toBeLessThan(d.rollAttack.mock.invocationCallOrder[0]);

    // QUIRK (:25 silent-undefined ?.): getTargetInfo resolving undefined still rolls, targetName undefined
    const { d: d2 } = await cast({ getTargetInfo: vi.fn(async () => undefined) });
    expect(capturedCtx(d2.rollAttack)[2].targetName).toBeUndefined();
  });

  it('T2 damageType channel: caller param survives disk byte; attack_type-only row passes the guard with undefined type and empty formula', async () => {
    const { d } = await cast({ spell: ACID, damageType: 'Cold' });
    expect(capturedCtx(d.rollAttack)[2].damageType).toBe('Cold');

    // synthetic FrostLance (disk-unreachable arm: attack_type present, damage absent — the
    // guard-negative twin killing &&-vs-|| at :65; resolveSpellDamageAtLevel :11 '' guard)
    const { result, d: d2 } = await cast({
      spell: { name: 'Frost Lance', level: 1, school: 'Evocation', attack_type: 'melee' },
      damageType: undefined,
    });
    expect(result).toBeUndefined();
    const [, , ctx] = capturedCtx(d2.rollAttack);
    expect(ctx.damageType).toBeUndefined();
    expect(ctx.autoDamageFormula).toBe('');
    expect(rollExpression).toHaveBeenCalledTimes(2); // 1 per cast — ladder never consulted without damage
  });

  it('T3 two-channel formula contract: metaCtx.finalFormula lands in autoDamageFormula while rollExpression gets overchannelFormula byte, with overchannel tuple', async () => {
    const metaCtx = {
      finalFormula: '5d4 + 2', overchannelFormula: '4d4 + 2',
      overchannelActive: true, overchannelUseCount: 1, slotLevel: 3, metamagicHeighten: true,
    };
    const { d } = await cast({ metaCtx });
    const [, , ctx] = capturedCtx(d.rollAttack);
    // :73 rolls the OVERCHANNEL formula, never finalFormula (byte-distinct fixtures #1348)
    expect(rollExpression).toHaveBeenCalledTimes(1);
    expect(rollExpression).toHaveBeenCalledWith('4d4 + 2');
    expect(ctx.autoDamageFormula).toBe('5d4 + 2');
    expect(ctx.overchannelActive).toBe(true);
    expect(ctx.overchannelUseCount).toBe(1);
    expect(ctx.overchannelSpellLevel).toBe(3);
    expect(ctx.metamagicHeighten).toBe(true); // :40-42 gate adds the key
    expect(Object.keys(ctx).sort()).toEqual([...BASE_KEYS, 'finalFormula', 'overchannelFormula', 'slotLevel', 'metamagicHeighten'].sort());

    // second cast: no heighten in metaCtx -> key ABSENT; slot fallback = spell.level
    const { d: d2 } = await cast({});
    const ctx2 = capturedCtx(d2.rollAttack)[2];
    expect(ctx2.overchannelSpellLevel).toBe(2);
    expect(Object.keys(ctx2).sort()).toEqual(BASE_KEYS);
  });

  it('T4 innate sorcery advantage: gated on (playerStats.name, campaignName), forcedMode never overridden', async () => {
    vi.mocked(isInnateSorceryActive).mockReturnValue(true);
    const { d } = await cast({});
    expect(isInnateSorceryActive).toHaveBeenCalledWith('TestCleric', CAMPAIGN);
    expect(isInnateSorceryActive.mock.calls[0]).toHaveLength(2); // arity vs real (name, campaign)
    const ctx = capturedCtx(d.rollAttack)[2];
    expect(ctx.forcedMode).toBe('advantage');
    expect(Object.keys(ctx).sort()).toEqual([...BASE_KEYS, 'forcedMode'].sort()); // adds exactly one key

    // existing forcedMode survives untouched (:8 ||-guard)
    const { d: d2 } = await cast({ metaCtx: { forcedMode: 'disadvantage' } });
    const ctx2 = capturedCtx(d2.rollAttack)[2];
    expect(ctx2.forcedMode).toBe('disadvantage');
    expect(Object.keys(ctx2).sort()).toEqual([...BASE_KEYS, 'forcedMode'].sort());
  });

  it('T5 zero-content guard returns implicit undefined with every collaborator untouched (null-byte contrast owned by T7)', async () => {
    for (const spell of [
      { name: 'Guard Gate', level: 1, school: 'Abjuration' }, // both falsy (undefined)
      { name: 'Guard Gate', level: 1, school: 'Abjuration', attack_type: '', damage: '' }, // falsy triple: '' both
    ]) {
      const { result, d } = await cast({ spell });
      expect(result).toBeUndefined(); // :65 implicit undefined, NOT the :62 missile null byte
      expect(d.getTargetInfo).not.toHaveBeenCalled();
      expect(rollExpression).not.toHaveBeenCalled();
      expect(d.rollAttack).not.toHaveBeenCalled();
      expect(isInnateSorceryActive).not.toHaveBeenCalled();
      expect(activateSpiritualWeaponForce).not.toHaveBeenCalled();
    }
  });

  it('T6 :13 priority chain byte table: metaCtx.overchannelFormula > disk-dead damage.formula > caster ladder > empty terminal', async () => {
    const rows = [
      { // arm 1: metaCtx beats the caster-level ladder it would otherwise resolve
        spell: FB5, playerStats: { name: 'TestSorcerer', level: 6 }, metaCtx: { overchannelFormula: '4d10 + 4' },
        rollArg: '4d10 + 4', auto: '4d10 + 4', damageType: 'Fire', isCantrip: true,
      },
      { // arm 2: spell.damage.formula — DEAD vs disk (zero '"formula":' rows in both spells.json),
        // documented-synthetic; also pins the baseLevel===0 OR-arm of :37 (level undefined)
        spell: { name: 'Ember Lance', level: undefined, baseLevel: 0, school: 'Evocation', attack_type: 'ranged', damage: { formula: '3d6 + 1', damage_type: 'Fire' } },
        playerStats: { name: 'TestSorcerer', level: 6 }, metaCtx: {},
        rollArg: '3d6 + 1', auto: '3d6 + 1', damageType: 'Fire', isCantrip: true,
      },
      { // arm 3: caster ladder — disk Eldritch Blast at level 12
        spell: EB5, playerStats: { name: 'TestWarlock', level: 12 }, metaCtx: {},
        rollArg: '3d10', auto: '3d10', damageType: 'Force', isCantrip: true,
      },
      { // arm 4 terminal: damage block without any ladder -> '' reaches rollExpression verbatim
        spell: { name: 'Frost Ray', level: 1, school: 'Evocation', attack_type: 'ranged', damage: { damage_type: 'Cold' } },
        playerStats: { name: 'TestWizard', level: 3 }, metaCtx: {},
        rollArg: '', auto: '', damageType: 'Cold', isCantrip: false,
      },
    ];
    for (const [i, row] of rows.entries()) {
      rollExpression.mockClear();
      const { d } = await cast({ spell: row.spell, playerStats: row.playerStats, metaCtx: row.metaCtx });
      expect(rollExpression, `row ${i}`).toHaveBeenCalledTimes(1);
      expect(rollExpression, `row ${i}`).toHaveBeenCalledWith(row.rollArg); // exact byte, no options arg
      const ctx = capturedCtx(d.rollAttack)[2];
      expect(ctx.autoDamageFormula, `row ${i}`).toBe(row.auto);
      expect(ctx.damageType, `row ${i}`).toBe(row.damageType);
      expect(ctx.isCantrip, `row ${i}`).toBe(row.isCantrip);
    }
  });

  it('T7 magic-missile delegation gate (missile.test.js:43 cites old :111-115): exact forward tuple, swallowed rollDamage stub (#1480 :61 ours), returns null', async () => {
    vi.mocked(isMagicMissile).mockReturnValue(true);
    const metaCtx = { slotLevel: 2 };
    const { result, d } = await cast({ spell: MM, metaCtx, damageType: 'Force' });
    expect(result).toBeNull(); // :62 explicit null byte — distinct from the :65 guard undefined
    expect(executeMagicMissile).toHaveBeenCalledTimes(1);
    const [spelled, passedCtx, services] = executeMagicMissile.mock.calls[0];
    expect(executeMagicMissile.mock.calls[0]).toHaveLength(3);
    expect(spelled).toBe(MM);
    expect(passedCtx).toBe(metaCtx);
    expect(Object.keys(services).sort()).toEqual(['campaignName', 'characters', 'getTargetInfo', 'mapName', 'playerStats', 'rollDamage']);
    expect(services.playerStats).toBe(d.playerStats);
    expect(services.getTargetInfo).toBe(d.getTargetInfo);
    expect(services.characters).toBe(d.characters);
    expect(services.campaignName).toBe(CAMPAIGN);
    expect(services.mapName).toBeNull();
    expect(typeof services.rollDamage).toBe('function');
    expect(services.rollDamage()).toBeUndefined(); // the swallowed stub, not the hub's real rollDamage
    // gate returns before everything else: target, dice, innate and attack all untouched
    expect(d.rollAttack).not.toHaveBeenCalled();
    expect(rollExpression).not.toHaveBeenCalled();
    expect(d.getTargetInfo).not.toHaveBeenCalled();
    expect(isInnateSorceryActive).not.toHaveBeenCalled();
  });

  it('T8 cantrip ladder at caster level on BOTH ruleset disk rows, with the fix#121(e) bake-roll convergence and the undefined-level first-key quirk', async () => {
    // row 1: 5e Fire Bolt caster 6 -> ladder by playerStats.level (:13): '2d10'
    const { d } = await cast({ spell: FB5, playerStats: { name: 'TestWizard', level: 6 } });
    expect(rollExpression).toHaveBeenCalledWith('2d10');
    const ctx = capturedCtx(d.rollAttack)[2];
    expect(ctx.autoDamageFormula).toBe('2d10');
    expect(ctx.damageType).toBe('Fire');
    expect(ctx.isCantrip).toBe(true); // level===0 arm (:37), replaces the deleted fixture-only test
    expect(ctx.overchannelSpellLevel).toBe(0); // :34 quirk: metaCtx.slotLevel absent -> spell.level 0 (a zero byte, not swallowed)

    // row 2: PRODUCTION HUB SHAPE — index.js:741 stamps metaCtx.finalFormula and
    // fix#121(e) resolves the cantrip bake at CASTERR level (mirror of :13), so the
    // hub feeds '2d10' for a caster-6 row. The retired spell.level||1 bake fed '1d10'
    // and the mismatch stood RED; the pair now CONVERGES — pinned as the same byte.
    rollExpression.mockClear();
    const { d: d2 } = await cast({ spell: FB5, playerStats: { name: 'TestWizard', level: 6 }, metaCtx: { finalFormula: '2d10' } });
    expect(rollExpression).toHaveBeenCalledWith('2d10');
    const ctx2 = capturedCtx(d2.rollAttack)[2];
    expect(ctx2.autoDamageFormula).toBe('2d10'); // baked side byte — lawful caster-level tier
    expect(ctx2.autoDamageRollResult).toBe(ROLL_STUB); // rolled side fed the SAME '2d10'
    expect(ctx2.autoDamageFormula).toBe(rollExpression.mock.calls[0][0]); // convergence pin (was not.toBe, #1454 RED)

    // row 3: undefined caster level — :13 has NO '|| 1' of its own; the ladder falls back to
    // its FIRST KEY (spellDamageUtils.js:18), giving the same '1d10' tier by a different route.
    rollExpression.mockClear();
    await cast({ spell: FB5, playerStats: { name: 'TestWizard', level: undefined } });
    expect(rollExpression).toHaveBeenCalledWith('1d10');

    // row 4: 2024 Fire Bolt (slot-ladder shape) caster 17 -> top tier '4d10'
    rollExpression.mockClear();
    await cast({ spell: FB24, playerStats: { name: 'TestWizard', level: 17 } });
    expect(rollExpression).toHaveBeenCalledWith('4d10');
  });

  it('T9 spiritual-weapon activation (SP-112): OR-gate arms, exact force tuple, activation awaited before the roll and the attack', async () => {
    const rows = [
      { spell: SW, metaCtx: { slotLevel: 4, finalFormula: '2d8' }, slotLevel: 4, formula: '2d8' }, // disk row, both arms
      { spell: { ...SW, name: 'Custom Spectral Mace' }, metaCtx: {}, slotLevel: 2, formula: '1d8' }, // index arm alone
      { spell: { ...SW, index: undefined }, metaCtx: {}, slotLevel: 2, formula: '1d8' }, // name arm alone
    ];
    for (const [i, row] of rows.entries()) {
      activateSpiritualWeaponForce.mockClear();
      rollExpression.mockClear();
      const { d } = await cast({ spell: row.spell, metaCtx: row.metaCtx });
      expect(activateSpiritualWeaponForce, `row ${i}`).toHaveBeenCalledTimes(1);
      const [spelled, ps, campaign, opts] = activateSpiritualWeaponForce.mock.calls[0];
      expect(activateSpiritualWeaponForce.mock.calls[0]).toHaveLength(4);
      expect(spelled).toBe(row.spell);
      expect(ps).toBe(d.playerStats);
      expect(campaign).toBe(CAMPAIGN);
      expect(opts).toEqual({ slotLevel: row.slotLevel, formula: row.formula }); // disk ladder byte at no finalFormula
      expect(Object.keys(opts).sort()).toEqual(['formula', 'slotLevel']);
      // order: force entity persists BEFORE the roll/attack seam (noSavePath.js:46-49 SP-112)
      expect(activateSpiritualWeaponForce.mock.invocationCallOrder[0]).toBeLessThan(rollExpression.mock.invocationCallOrder[0]);
      expect(rollExpression.mock.invocationCallOrder[0]).toBeLessThan(d.rollAttack.mock.invocationCallOrder[0]);
    }
    // near-miss gate denial: neither arm matches -> never activates, still attacks
    activateSpiritualWeaponForce.mockClear();
    const { d } = await cast({ spell: { ...SW, index: 'spiritual-steed', name: 'Spiritual Steed' } });
    expect(activateSpiritualWeaponForce).not.toHaveBeenCalled();
    expect(d.rollAttack).toHaveBeenCalledTimes(1);
  });
});
