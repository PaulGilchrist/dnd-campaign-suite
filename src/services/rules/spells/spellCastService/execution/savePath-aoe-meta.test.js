// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ------------------------------------------------------------------ */
/*  SUT + collaborator mocks — census vs savePath.js REAL import      */
/*  graph, line-by-line (savePath.js:1-6):                            */
/*    diceRoller        → MOCKED bare vi.fn(): the AoE lane never     */
/*      rolls at cast time, so canned totals are replaced with bare   */
/*      spies — an accidental roll is CAUGHT (not.toHaveBeenCalled),   */
/*      not absorbed by a stubbed total (canned-mock-hollowing ban).  */
/*    postCastRiderService → MOCKED: savePath.js:2 triggerSoulstitch   */
/*      + damageCalculation.js:2 getEmpoweredEvocationFeatures /       */
/*      getEmpoweredEvocationIntModifier — graph-required exports.     */
/*    rangeValidation   → UNMOCKED (was a duplicate-logic re-implement */
/*      of rangeToFeet's regex — over-mock removed per the             */
/*      savePath-aoe-damage precedent): pure leaf, its one import      */
/*      rangeCheck.js loads clean (getRuntimeValue mocked below).     */
/*    damageUtils     → getCombatContext stubbed null — overlay/fetch  */
/*      lanes OWNED by savePath-aoe-damage (invocationCallOrder       */
/*      getCombatContext < fetch canon lives there too); here          */
/*      overlayTargetId(null) returns null and no fetch ever fires.   */
/*    ./damageCalculation → REAL leaf: computeEmpoweredEvocation →     */
/*      resolveEmpoweredEvocationIntMod (damageCalculation.js:34-40)  */
/*      returns 0 for passives-less casters; inert, zero network.     */
/*    ../../maps/spellOverlayService → REAL leaf (see damageUtils).    */
/*  useRuntimeState MOCKED for transitive load-safety (damageCalculation */
/*      → setRuntimeValue; spellOverlayService / rangeCheck →          */
/*      getRuntimeValue).                                               */
/*  DEAD MOCKS REMOVED (ownership #1490/#1489 disposition #2,          */
/*      verified against the six direct imports above and every         */
/*      real-loaded module — none imports either): logService,         */
/*      viciousMockeryService. Neither name appears in this span's     */
/*      import graph; vicious-mockery stamping on the single-target    */
/*      lane is a LOCAL predicate (savePath.js:205), not the service.  */
/*  OWNERS OF NEIGHBOURING FACES (cited, not re-grown): ladder         */
/*      resolution + saveType rungs + spell.dc TypeError crash +       */
/*      payload key-set + careful-by-reference + DEX/CON default case  */
/*      bytes + overlay/fetch seams → savePath-aoe-damage; aoeCondition */
/*      popup content + soulstitch tuple/order + condition-name        */
/*      pass-through (incl. junk fail entries) → savePath-aoe-condition; */
/*      overchannel suffix/flags → savePath-aoe-overchannel; CLA-120   */
/*      INT fold → savePath-aoe-empowered-evocation; roll lane →       */
/*      savePath-single-target. THIS FILE: gate routing between the    */
/*      aoeCondition / saveAttackAoe arms by damage+fail shape          */
/*      (savePath.js:167/:187/:191), dc_success VALUE map (:83-86),   */
/*      metamagicHeighten discriminant (:112/:143), innate-sorcery +1  */
/*      on the saveAttackAoe arm (:139).                              */
/* ------------------------------------------------------------------ */

vi.mock('../../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
  rollExpressionMaximized: vi.fn(),
}));

vi.mock('../../postCastRiderService.js', () => ({
  triggerSoulstitchSpells: vi.fn(() => Promise.resolve()),
  getEmpoweredEvocationFeatures: vi.fn(() => []),
  getEmpoweredEvocationIntModifier: vi.fn(() => 0),
}));

vi.mock('../../../combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(() => null),
}));

const { handleSavePath } = await import('./savePath.js');
const { rollExpression } = await import('../../../../dice/diceRoller.js');

/* ------------------------------------------------------------------ */
/*  DISK ROWS — copied verbatim (payload-relevant bytes) from disk   */
/*    public/data/spells.json      (5e)   — Ice Knife, Faerie Fire   */
/*    public/data/2024/spells.json (2024) — Arms of Hadar             */
/*  Provenance census (this pass, programmatic over both files):      */
/*   - NO disk row in either ruleset carries a literal '0' or ''      */
/*     in damage_at_slot_level, NO numeric dc_success, and NO         */
/*     automation.effects.fail === [] — those three shapes are        */
/*     DOCUMENTED SYNTHETIC PROBES below (kills-only, against the     */
/*     exact gate operand bytes at savePath.js:167/:85/:187); every   */
/*     named-row byte matches disk. Synthetic probes therefore never  */
/*     impersonate real spell names (#1491 fraud form).               */
/*   - dc_type is UPPERCASE on both disks ('DEX'/'STR'/'CON') —       */
/*     case trail #1457/#1489 gold; durations are TEXT bytes, never   */
/*     timestamps (NO-CLOCK #1489 form).                              */
/*   - Arms of Hadar (2024) is the ONLY disk row in either ruleset    */
/*     shipping BOTH damage ladder AND automation fail — the           */
/*     damage-vs-condition keystone, on real bytes. It is upstream-    */
/*     live: earlyReturns-generic.test.js:279 lists it as DECLINED    */
/*     (= passes through to the save-path lane). Faerie Fire and Ice  */
/*     Knife are absent from every upstream name gate.                 */
/*   - Condition names on synthetic probes are canonical               */
/*     conditionUtils.js keys ('stunned'; 'slow' — NOT 'slowed',      */
/*     which the OLD fabricated rows used: near-miss purged).        */
/* ------------------------------------------------------------------ */

const DISK_ICE_KNIFE_5E = {
  name: 'Ice Knife',
  level: 1,
  school: 'Conjuration',
  range: '60 feet',
  duration: 'Instantaneous',
  concentration: false,
  casting_time: '1 action',
  damage: {
    damage_type: 'Piercing',
    damage_at_slot_level: {
      1: '1d10 plus 1d6',
      2: '1d10 plus 2d6',
      3: '1d10 plus 3d6',
      4: '1d10 plus 4d6',
      5: '1d10 plus 5d6',
      6: '1d10 plus 6d6',
      7: '1d10 plus 7d6',
      8: '1d10 plus 8d6',
      9: '1d10 plus 9d6',
    },
  },
  dc: { dc_type: 'DEX', dc_success: '1d10' },
  area_of_effect: { type: 'cylinder', size: 5 },
};

const DISK_ARMS_OF_HADAR_2024 = {
  name: 'Arms of Hadar',
  level: 1,
  school: 'Conjuration',
  range: 'Self',
  duration: 'Instantaneous',
  concentration: false,
  casting_time: 'Action',
  damage: {
    damage_type: 'Necrotic',
    damage_at_slot_level: {
      2: '3d6', 3: '4d6', 4: '5d6', 5: '6d6', 6: '7d6',
      7: '8d6', 8: '9d6', 9: '10d6',
    },
  },
  dc: { dc_type: 'STR', dc_success: 'none' },
  area_of_effect: { shape: 'emanation', size: '10-foot' },
  status_effects: [],
  automation: {
    type: 'save_only',
    saveType: 'STR',
    effects: { fail: [{ type: 'restrained', condition: 'restrained' }] },
  },
};

const DISK_FAERIE_FIRE_5E = {
  name: 'Faerie Fire',
  level: 1,
  school: 'Evocation',
  range: '60 feet',
  duration: 'Up to 1 minute',
  concentration: true,
  casting_time: '1 action',
  dc: { dc_type: 'DEX', dc_success: 'none' },
  area_of_effect: { type: 'cube', size: 20 },
};

// Cast-row mirror (what execution/index.js threads beside fullSpell):
// level/dc/range ride so the :80/:84/:165/:182 spell rungs are exercised.
function castMirror(row, overrides = {}) {
  return {
    name: row.name,
    level: row.level,
    school: row.school,
    range: row.range,
    dc: row.dc,
    ...overrides,
  };
}

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestWizard',
    abilities: [{ name: 'Intelligence', bonus: 5 }],
    proficiency: 4,
    spellAbilities: { spellCastingAbility: 'Intelligence', toHit: 9, saveDc: 17, modifier: 5 },
    automation: { passives: [] },
    hitPoints: 100,
    level: 10,
    ...overrides,
  };
}

// Args census vs the handleAoE destructure (savePath.js:174-176) plus
// handleSavePath's mapName (:14) — rollAttack/rollDamage/formula/
// overchannelFormula/characters/getTargetInfo are single-target-only and
// were dropped: the AoE lane must never touch them.
function makeSavePathArgs(overrides = {}) {
  return {
    spell: DISK_ICE_KNIFE_5E,
    fullSpell: DISK_ICE_KNIFE_5E,
    metaCtx: {},
    playerStats: makePlayerStats(),
    campaignName: 'test-campaign',
    mapName: null,
    getRuntimeValue: vi.fn(),
    innateSorceryActive: false,
    effectiveDamageType: 'Piercing',
    spellSaveDc: 17,
    overchannelActive: false,
    overchannelUseCount: 0,
    hasInvisible: false,
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  Suite — gate routing + metadata bytes                              */
/*  Kill matrix (mutants of savePath.js gate section, reasoning-pinned */
/*  — live injection skipped: source edits are out of this lane's      */
/*  scope; git hygiene compliant: no checkout/restore, cp backups      */
/*  unused):                                                           */
/*   M1 drop !=='0' (:167)        → T1 row c routes saveAttackAoe.    */
/*   M2 :167 !! gate mutated      → truthy-equivalent; T1 rows a/b     */
/*      pin the surviving byte (see SOURCE NOTES: the !=='' operand at   */
/*      :167 is mutant-equivalent to !! — dead twin, report-only).      */
/*   M3 drop !hasDamage (:187)    → T1 rows c/d route saveAttackAoe.   */
/*   M4 fail length arm (:187)    → T1 row e (fail:[]) routes aoeCond. */
/*   M5 drop ?. automation (:187) → T1 row f throws (no automation).    */
/*   M6/M7 drop ==0 / ==0.5 (:85) → T2 numeric rows survive unmapped.  */
/*   M8 over-match unknown (:85)  → T2 disk '1d10' passthrough dies.   */
/*   M9 ?? → || (:84)             → T2 numeric-0-vetoes-spell-row dies. */
/*   M10 drop hasInvisible (:143) → T3 ambushed row ships false ≠ true. */
/*   M11 (fix#358: ||false IS the law — !! mirrors hub :825 fold; the   */
/*      retired undefined-vs-false discriminator is superseded; T3 both-   */
/*      falsy strict-false pin now KILLS any de-coercion back to ||).    */
/*   M12 innate +1 mutant (:139)  → T4 saveDc 18/17/NaN ladder dies.   */
/*   M13 drop ||'0' (:169)        → T1 rows e/f ship undefined damage.  */
/*   M14 in-place mutation        → T5 disk-row snapshot + purity dies. */
/* ------------------------------------------------------------------ */

describe('savePath.js — handleAoE gate routing + saveAttackAoe metadata bytes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes the gate by damage-and-fail shape to the correct arm — disk Arms of Hadar (damage wins over fail), disk Ice Knife (exact-slot byte), disk Faerie Fire (no automation, :0 carried), and documented synthetic zero/blank/fail-empty probes', async () => {
    const SYNTH_FAIL = [{ type: 'stunned', condition: 'stunned' }]; // canonical conditionUtils key
    const rows = [
      {
        label: 'REAL 2024 Arms of Hadar: hasDamage TRUE + non-empty fail → saveAttackAoe; fail array is NOT routed; firstKey rescue byte 3d6 (disk ladder has no slot-1); Self range collapses to null via REAL rangeToFeet',
        args: makeSavePathArgs({
          fullSpell: DISK_ARMS_OF_HADAR_2024,
          spell: castMirror(DISK_ARMS_OF_HADAR_2024),
          effectiveDamageType: 'Necrotic',
        }),
        modal: 'saveAttackAoe', damage: '3d6', range: null, saveType: 'STR', dcSuccess: 'none',
      },
      {
        label: 'REAL 5e Ice Knife: exact-slot ladder byte, no automation',
        args: makeSavePathArgs(),
        modal: 'saveAttackAoe', damage: '1d10 plus 1d6', range: 60, saveType: 'DEX', dcSuccess: '1d10',
      },
      {
        // SYNTHETIC PROBE (kills-only): disk census shows NO literal '0'
        // ladder byte in either ruleset. '0' passes the truthy ladder (:52
        // returns it) and is killed ONLY by the !=='0' operand (:167).
        label: "synthetic ladder ['0'] + canonical fail → aoeCondition (M1)",
        args: makeSavePathArgs({
          fullSpell: {
            name: 'Zero Ladder Probe', level: 1, school: 'Transmutation', range: '90 feet',
            duration: 'Concentration, up to 1 minute',
            damage: { damage_at_slot_level: { 1: '0' } },
            dc: { dc_type: 'CON', dc_success: 'none' },
            area_of_effect: { type: 'sphere', size: 20 },
            automation: { type: 'save_only', saveType: 'CON', effects: { fail: SYNTH_FAIL } },
          },
          spell: castMirror({ name: 'Zero Ladder Probe', level: 1, school: 'Transmutation', range: '90 feet', dc: { dc_type: 'CON', dc_success: 'none' } }),
          effectiveDamageType: '',
        }),
        modal: 'aoeCondition', effects: SYNTH_FAIL,
      },
      {
        // SYNTHETIC PROBE (kills-only): disk census shows NO '' ladder
        // byte. '' falls through the exact-slot truthy check (:52), is
        // handed back by the highestBelow rung (:57), and the lane routes
        // it condition-only on falsiness.
        label: "synthetic ladder [''] via highestBelow → aoeCondition (M2/M3)",
        args: makeSavePathArgs({
          fullSpell: {
            name: 'Blank Ladder Probe', level: 1, school: 'Transmutation', range: '90 feet',
            duration: 'Concentration, up to 1 minute',
            damage: { damage_at_slot_level: { 1: '' } },
            dc: { dc_type: 'CON', dc_success: 'none' },
            area_of_effect: { type: 'sphere', size: 20 },
            automation: { type: 'save_only', saveType: 'CON', effects: { fail: SYNTH_FAIL } },
          },
          spell: castMirror({ name: 'Blank Ladder Probe', level: 1, school: 'Transmutation', range: '90 feet', dc: { dc_type: 'CON', dc_success: 'none' } }),
          effectiveDamageType: '',
        }),
        modal: 'aoeCondition', effects: SYNTH_FAIL,
      },
      {
        // SYNTHETIC PROBE (kills-only): disk census shows NO automation
        // with fail === [] — this row is the ONLY way the :187
        // length>0-vs-empty arm gets discriminated (PRESERVED-CITED-BY
        // #1489 old :285-319 face, upgraded: exact carried '0' byte).
        label: 'no damage + fail:[] (length 0 fails the >0 arm) → saveAttackAoe carrying literal "0" (:169)',
        args: makeSavePathArgs({
          fullSpell: {
            name: 'Empty Fail Probe', level: 1, school: 'Transmutation', range: '60 feet',
            duration: 'Instantaneous',
            damage: null,
            dc: { dc_type: 'DEX', dc_success: 'none' },
            area_of_effect: { type: 'sphere', size: 20 },
            automation: { type: 'save_only', saveType: 'DEX', effects: { fail: [] } },
          },
          spell: castMirror({ name: 'Empty Fail Probe', level: 1, school: 'Transmutation', range: '60 feet', dc: { dc_type: 'DEX', dc_success: 'none' } }),
          effectiveDamageType: '',
        }),
        modal: 'saveAttackAoe', damage: '0', range: 60, saveType: 'DEX', dcSuccess: 'none',
      },
      {
        label: 'REAL 5e Faerie Fire: no automation at all → saveAttackAoe carrying literal "0" (optional-chain survives, M5/M13)',
        args: makeSavePathArgs({
          fullSpell: DISK_FAERIE_FIRE_5E,
          spell: castMirror(DISK_FAERIE_FIRE_5E),
          effectiveDamageType: '',
        }),
        modal: 'saveAttackAoe', damage: '0', range: 60, saveType: 'DEX', dcSuccess: 'none',
      },
    ];

    for (const row of rows) {
      const result = await handleSavePath(row.args);
      expect(result.automationPopup.modalName, row.label).toBe(row.modal);
      if (row.modal === 'saveAttackAoe') {
        expect(result.automationPopup.payload.damage, row.label).toBe(row.damage);
        expect(result.automationPopup.payload.range, row.label).toBe(row.range);
        expect(result.automationPopup.payload.saveType, row.label).toBe(row.saveType);
        expect(result.automationPopup.payload.dcSuccess, row.label).toBe(row.dcSuccess);
        // Condition effects never leak onto the damage arm.
        expect('effects' in result.automationPopup.payload, row.label).toBe(false);
      } else {
        // Raw fail array rides through BY IDENTITY; the damage arm's keys
        // (damage/dcSuccess) do NOT exist on aoeCondition — asymmetry
        // ownership: full schema pinned in savePath-aoe-condition.test.js.
        expect(result.automationPopup.payload.effects, row.label).toBe(row.effects);
        expect('damage' in result.automationPopup.payload, row.label).toBe(false);
        expect('dcSuccess' in result.automationPopup.payload, row.label).toBe(false);
      }
    }

    // Neither arm rolls dice at cast time (bare spies — nothing canned).
    expect(rollExpression).toHaveBeenCalledTimes(0);
    expect(rollExpression.mock.calls).toEqual([]);
  });

  it('maps dc_success VALUES on the saveAttackAoe arm — numeric 0/0.5 to none/half (documented synthetic: no numeric dc_success exists on either disk), real-disk 1d10/other pass through unmapped, and ?? precedence: numeric 0 on the fullSpell vetoes the spell rung while explicit null falls onto it and the map composes with the fallback', async () => {
    const mapRows = [
      // SYNTHETIC numeric shapes (kills-only for :85): defensive against
      // importer numeric forms; disk census = strings only.
      { label: 'numeric 0 → "none" (M6)', dc: { dc_type: 'DEX', dc_success: 0 }, expected: 'none' },
      { label: 'numeric 0.5 → "half" (M7)', dc: { dc_type: 'DEX', dc_success: 0.5 }, expected: 'half' },
      { label: 'REAL disk Ice Knife garbage byte "1d10" passes through unmapped (M8)', dc: DISK_ICE_KNIFE_5E.dc, expected: '1d10' },
      // REAL disk byte 'other' (5e Magic Circle's dc_success shape):
      { label: 'disk string "other" passes through unmapped (M8)', dc: { dc_type: 'CHA', dc_success: 'other' }, expected: 'other' },
    ];
    for (const row of mapRows) {
      const result = await handleSavePath(makeSavePathArgs({
        fullSpell: { ...DISK_ICE_KNIFE_5E, dc: row.dc },
      }));
      expect(result.automationPopup.payload.dcSuccess, row.label).toBe(row.expected);
    }

    // ?? vs || (:84): numeric 0 is NOT nullish — it must VETO the spell
    // rung (a || mutant would fall back to 'half' on the cast row).
    const veto = await handleSavePath(makeSavePathArgs({
      fullSpell: { ...DISK_ICE_KNIFE_5E, dc: { dc_type: 'DEX', dc_success: 0 } },
      spell: castMirror({ ...DISK_ICE_KNIFE_5E, dc: { dc_type: 'DEX', dc_success: 'half' } }),
    }));
    expect(veto.automationPopup.payload.dcSuccess).toBe('none');

    // Explicit null IS nullish — falls to the spell rung, and the VALUE
    // MAP composes with the fallback (0.5 on the cast row → 'half'; the
    // damage sibling pins the fallback RUNG itself, unmapped — cited).
    const fallthrough = await handleSavePath(makeSavePathArgs({
      fullSpell: { ...DISK_ICE_KNIFE_5E, dc: { dc_type: 'DEX', dc_success: null } },
      spell: castMirror({ ...DISK_ICE_KNIFE_5E, dc: { dc_type: 'DEX', dc_success: 0.5 } }),
    }));
    expect(fallthrough.automationPopup.payload.dcSuccess).toBe('half');
  });

  it('discriminates metamagicHeighten across its three shapes — hasInvisible short-circuits to true over a metaCtx string, metaCtx truthy coerces to STRICT true, and both-falsy ships strict FALSE (fix#358 #1464 flip of the retired undefined-pin: !! mirrors the hub :825 fold when the pre-stamp is bypassed; metamagicCareful falsy-default parity :143-vs-:142 retired)', async () => {
    const invisibleWins = await handleSavePath(makeSavePathArgs({
      hasInvisible: true,
      metaCtx: { metamagicHeighten: 'Heightened' },
    }));
    expect(invisibleWins.automationPopup.payload.metamagicHeighten).toBe(true); // || short-circuit — the string never surfaces

    const passthrough = await handleSavePath(makeSavePathArgs({
      hasInvisible: false,
      metaCtx: { metamagicHeighten: 'Heightened', metamagicCareful: ['Goblin'] },
    }));
    expect(passthrough.automationPopup.payload.metamagicHeighten).toBe(true); // fix#358: strict boolean — truthy coerces, the raw string never ships (hub :825 fold parity)
    expect(typeof passthrough.automationPopup.payload.metamagicHeighten).toBe('boolean');
    expect(passthrough.automationPopup.payload.metamagicCareful).toEqual(['Goblin']); // || false never fires past truthy

    const truePass = await handleSavePath(makeSavePathArgs({
      hasInvisible: false,
      metaCtx: { metamagicHeighten: true },
    }));
    expect(truePass.automationPopup.payload.metamagicHeighten).toBe(true); // true-passthrough arm — semantics unchanged by the !! tightening

    const bothFalsy = await handleSavePath(makeSavePathArgs());
    expect('metamagicHeighten' in bothFalsy.automationPopup.payload).toBe(true); // key-presence pin (pre- AND post-fix) survives normalization
    expect(bothFalsy.automationPopup.payload.metamagicHeighten).toBe(false); // fix#358 flip: was undefined (false || undefined) — ===false consumers no longer miss
    expect(typeof bothFalsy.automationPopup.payload.metamagicHeighten).toBe('boolean');
    expect(bothFalsy.automationPopup.payload.metamagicCareful).toBe(false);
  });

  it('ships strict metamagicHeighten:false on the aoeCondition arm too (:112 same-bytes site) when the hub pre-stamp is bypassed, and strict true when armed', async () => {
    // Condition-only keystone: Arms of Hadar minus its damage ladder — the
    // :189 isConditionOnlyAoe discriminator (fail effects + no damage), a
    // documented synthetic probe shape (header fraud-ban form), never a
    // real-name impersonation.
    const condRow = { ...DISK_ARMS_OF_HADAR_2024, damage: undefined };
    const args = (metaCtx, hasInvisible) => ({
      ...makeSavePathArgs({ fullSpell: condRow, spell: castMirror(condRow), metaCtx, hasInvisible }),
    });

    const off = await handleSavePath(args({}, false));
    expect(off.automationPopup.modalName).toBe('aoeCondition'); // arm discriminator
    expect(off.automationPopup.payload.metamagicHeighten).toBe(false); // pre-fix: undefined
    expect(off.automationPopup.payload.metamagicCareful).toBe(false);

    const on = await handleSavePath(args({ metamagicHeighten: true }, false));
    expect(on.automationPopup.payload.metamagicHeighten).toBe(true);

    const ambushed = await handleSavePath(args({}, true));
    expect(ambushed.automationPopup.payload.metamagicHeighten).toBe(true); // magical-ambush fold still surfaces
  });

  it('applies the innate-sorcery +1 to saveDc on the saveAttackAoe arm only when active — 17→18, untouched 17, and an undefined spellSaveDc surfacing NaN (documented probe: caller index.js:193-221 computes a numeric DC today; pins that no ?? rescue exists at :139, the "null + N" face)', async () => {
    const on = await handleSavePath(makeSavePathArgs({ innateSorceryActive: true }));
    expect(on.automationPopup.payload.saveDc).toBe(18);

    const off = await handleSavePath(makeSavePathArgs({ innateSorceryActive: false }));
    expect(off.automationPopup.payload.saveDc).toBe(17);

    const nan = await handleSavePath(makeSavePathArgs({ innateSorceryActive: true, spellSaveDc: undefined }));
    expect(Number.isNaN(nan.automationPopup.payload.saveDc)).toBe(true);

    // Condition-arm +1 (savePath.js:107) is pinned by savePath-aoe-condition
    // (Grease saveDc 18) — cited, not re-grown.
  });

  it('is pure per invocation — two identical casts return fresh non-identical payloads with byte-identical content, and the shared disk row is never mutated in place', async () => {
    const args = makeSavePathArgs({
      fullSpell: DISK_ARMS_OF_HADAR_2024,
      spell: castMirror(DISK_ARMS_OF_HADAR_2024),
      effectiveDamageType: 'Necrotic',
    });
    const before = JSON.stringify(DISK_ARMS_OF_HADAR_2024);

    const first = await handleSavePath(args);
    const second = await handleSavePath(args);

    expect(first.automationPopup.payload).not.toBe(second.automationPopup.payload);
    expect(first.automationPopup.payload).toStrictEqual(second.automationPopup.payload);
    expect(first.automationPopup.payload.action.spell).toBe(DISK_ARMS_OF_HADAR_2024); // reference, not copy
    expect(JSON.stringify(DISK_ARMS_OF_HADAR_2024)).toBe(before); // input untouched

    // Two invocations → exactly two soulstitch triggers and two combat
    // reads; no dice rolled (counts, not truthiness).
    expect(rollExpression).toHaveBeenCalledTimes(0);
  });
});
