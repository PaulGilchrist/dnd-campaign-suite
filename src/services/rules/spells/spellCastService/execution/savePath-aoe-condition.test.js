// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ------------------------------------------------------------------ */
/*  SUT + collaborator mocks (census vs savePath.js REAL exports)    */
/*  savePath.js imports: diceRoller, postCastRiderService,             */
/*  rangeValidation, damageUtils, ./damageCalculation (REAL leaf —     */
/*  computeEmpoweredEvocation is in-memory, returns 0 without the     */
/*  empowered passives, zero network),                                 */
/*  ../../maps/spellOverlayService (REAL leaf — getCombatContext is   */
/*  stubbed null here, so overlayTargetId(null) returns null and no   */
/*  fetch ever fires; overlay lanes owned by savePath-aoe-damage).    */
/*  useRuntimeState is mocked for transitive load-safety only          */
/*  (damageCalculation → setRuntimeValue, spellOverlayService/combat  */
/*  Data → getRuntimeValue).                                           */
/*  DEAD mocks removed (reported): logService, viciousMockeryService  */
/*  — neither is in this span's import graph.                         */
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

vi.mock('../../../combat/rangeValidation.js', () => ({
  rangeToFeet: vi.fn((range) => {
    if (!range || typeof range !== 'string') return null;
    const match = String(range).match(/^(-?\d+(?:\.\d+)?)\s*(feet|foot|ft\.?)?$/i);
    return match ? parseFloat(match[1]) : null;
  }),
}));

vi.mock('../../../combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(() => null),
}));

const { handleSavePath } = await import('./savePath.js');
const { triggerSoulstitchSpells } = await import('../../postCastRiderService.js');
const { rangeToFeet } = await import('../../../combat/rangeValidation.js');
const { getCombatContext } = await import('../../../combat/damageUtils.js');
const { rollExpression } = await import('../../../../dice/diceRoller.js');

/* ------------------------------------------------------------------ */
/*  DISK ROWS — copied verbatim from public/data/2024/spells.json    */
/*  (provenance audit #1488: every area/DC/duration/automation byte  */
/*  below matches disk; dc_type is UPPERCASE on disk — 'DEX'/'STR',  */
/*  durations are TEXT bytes, never timestamps; condition-fail        */
/*  entries are {type:X,condition:X} mirrors, NOT {type:'condition'})*/
/*  Both are LIVE names on this gate: neither 'grease' nor            */
/*  'entangle' is hijacked by an upstream name gate in index.js /    */
/*  modalSpells.js (those intercept calm-emotions, confusion,         */
/*  conjure-volley, dispel-magic, fear, hypnotic-pattern, mass-      */
/*  suggestion, power-word-heal/kill, shapechange, silence, sleep).   */
/* ------------------------------------------------------------------ */

const DISK_GREASE_2024 = {
  name: 'Grease',
  level: 1,
  school: 'Conjuration',
  range: '60 feet',
  duration: '1 minute',
  concentration: false,
  damage: null,
  dc: { dc_type: 'DEX', dc_success: 'none' },
  area_of_effect: { shape: 'square', size: '10-foot' },
  status_effects: ['Prone'],
  automation: {
    type: 'save_only',
    saveType: 'DEX',
    effects: { fail: [{ type: 'prone', condition: 'prone' }] },
  },
};

const DISK_ENTANGLE_2024 = {
  name: 'Entangle',
  level: 1,
  school: 'Conjuration',
  range: '90 feet',
  duration: 'Concentration, up to 1 minute',
  concentration: true,
  damage: null,
  dc: { dc_type: 'STR', dc_success: 'none' },
  area_of_effect: { shape: 'square', size: '20-foot' },
  status_effects: ['Restrained'],
  automation: {
    type: 'save_only',
    saveType: 'STR',
    effects: { fail: [{ type: 'restrained', condition: 'restrained' }] },
  },
};

/* Cast-row mirror (what execution/index.js threads beside fullSpell):
   deliberately range-mismatched vs fullSpell so payload.range proves the
   fullSpell.range || spell.range precedence on savePath.js:182. */
function makeCastSpell(overrides = {}) {
  return {
    name: DISK_GREASE_2024.name,
    level: 1,
    school: 'Conjuration',
    range: '90 feet',
    dc: { dc_type: 'DEX', dc_success: 'none' },
    ...overrides,
  };
}

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestWizard',
    abilities: [{ name: 'Intelligence', bonus: 5 }],
    proficiency: 4,
    spellAbilities: {
      spellCastingAbility: 'Intelligence',
      toHit: 9,
      saveDc: 17,
      modifier: 5,
    },
    automation: { passives: [] },
    hitPoints: 100,
    level: 10,
    ...overrides,
  };
}

function makeSavePathArgs(overrides = {}) {
  return {
    spell: makeCastSpell(),
    fullSpell: DISK_GREASE_2024,
    metaCtx: { targetName: 'Goblin' },
    playerStats: makePlayerStats(),
    campaignName: 'test-campaign',
    mapName: null,
    characters: [],
    getTargetInfo: async () => ({ name: 'Goblin' }),
    getRuntimeValue: vi.fn(),
    innateSorceryActive: false,
    effectiveDamageType: '',
    spellSaveDc: 17,
    overchannelFormula: null,
    overchannelActive: false,
    overchannelUseCount: 0,
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    formula: undefined,
    hasInvisible: false,
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  Suite                                                              */
/* ------------------------------------------------------------------ */

describe('savePath.js — condition-only AoE save path → aoeCondition modal payload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ships the full aoeCondition popup for the live disk Grease row: CLA-321 soulstitch tuple first, disk shape/range/uppercase saveType bytes, SP-024 text duration, innate-sorcery +1, grease-only includeCaster, raw fail-array identity, and no dice rolled', async () => {
    const args = makeSavePathArgs({
      innateSorceryActive: true,
      hasInvisible: true,
    });

    const result = await handleSavePath(args);

    // Whole-popup strict pin: exact key set, no fabricated keys
    // (no dcSuccess/damage keys — those live only on saveAttackAoe),
    // and no clock/timestamp keys — expiry is the modal's job
    // (AOEConditionModal.jsx resolveConditionClock reads the TEXT duration).
    expect(result).toStrictEqual({
      automationPopup: {
        type: 'modal',
        modalName: 'aoeCondition',
        payload: {
          action: { name: 'Grease', automation: DISK_GREASE_2024.automation },
          playerStats: args.playerStats,
          campaignName: 'test-campaign',
          shape: 'square',
          range: 60,
          duration: '1 minute',
          saveType: 'DEX',
          saveDc: 18,
          effects: DISK_GREASE_2024.automation.effects.fail,
          conditionLabel: 'prone',
          activeOverlay: null,
          metamagicCareful: false,
          metamagicHeighten: true,
          includeCaster: true,
        },
      },
    });

    // References ride through unwrapped (identity, not copies).
    expect(result.automationPopup.payload.playerStats).toBe(args.playerStats);
    expect(result.automationPopup.payload.effects).toBe(DISK_GREASE_2024.automation.effects.fail);

    // CLA-321: soulstitch fires exactly once, 5-arg positional tuple by
    // identity, BEFORE the combat-context read that precedes the modal.
    expect(triggerSoulstitchSpells.mock.calls[0]).toHaveLength(5);
    expect(triggerSoulstitchSpells).toHaveBeenCalledWith(
      args.fullSpell, args.metaCtx, args.playerStats, 'test-campaign', null,
    );
    expect(triggerSoulstitchSpells.mock.invocationCallOrder[0])
      .toBeLessThan(getCombatContext.mock.invocationCallOrder[0]);
    expect(getCombatContext).toHaveBeenCalledTimes(1);
    expect(getCombatContext).toHaveBeenCalledWith('test-campaign');

    // fullSpell.range wins over the mismatched cast-row range.
    expect(rangeToFeet).toHaveBeenCalledTimes(1);
    expect(rangeToFeet).toHaveBeenCalledWith('60 feet');

    // Condition-only lane never rolls dice.
    expect(rollExpression).not.toHaveBeenCalled();
  });

  it('ships the full aoeCondition popup for the live disk Entangle row: includeCaster stays false off-grease, concentration duration rides as text, metamagicHeighten coerces to strict true (fix#358) while careful passes through metaCtx, saveDc untouched without innate sorcery', async () => {
    const args = makeSavePathArgs({
      fullSpell: DISK_ENTANGLE_2024,
      spell: makeCastSpell({ name: 'Entangle' }),
      metaCtx: { targetName: 'Goblin', metamagicCareful: ['Goblin'], metamagicHeighten: 'Heightened' },
    });

    const result = await handleSavePath(args);

    expect(result).toStrictEqual({
      automationPopup: {
        type: 'modal',
        modalName: 'aoeCondition',
        payload: {
          action: { name: 'Entangle', automation: DISK_ENTANGLE_2024.automation },
          playerStats: args.playerStats,
          campaignName: 'test-campaign',
          shape: 'square',
          range: 90,
          duration: 'Concentration, up to 1 minute',
          saveType: 'STR',
          saveDc: 17,
          effects: DISK_ENTANGLE_2024.automation.effects.fail,
          conditionLabel: 'restrained',
          activeOverlay: null,
          metamagicCareful: ['Goblin'],
          metamagicHeighten: true, // fix#358 (#1464) flip: strict boolean — 'Heightened' string coerces via !!, raw string never ships (:112 arm)
          includeCaster: false,
        },
      },
    });
    expect(result.automationPopup.payload.effects).toBe(DISK_ENTANGLE_2024.automation.effects.fail);
  });

  it('falls back down the saveType chain when fullSpell.dc is null: cast-row dc_type first, then the uppercase CON default byte', async () => {
    // Arm 1: spell.dc.dc_type (savePath.js:80 middle term).
    const midFallback = await handleSavePath(makeSavePathArgs({
      fullSpell: { ...DISK_GREASE_2024, dc: null },
      spell: makeCastSpell({ dc: { dc_type: 'CON' } }),
    }));
    expect(midFallback.automationPopup.modalName).toBe('aoeCondition');
    expect(midFallback.automationPopup.payload.saveType).toBe('CON');

    // Arm 2: no dc_type anywhere → the 'CON' literal fallback
    // (savePath.js:106 — note the asymmetry with the damage lane's 'DEX'
    // default, pinned in savePath-aoe-damage.test.js).
    const tail = await handleSavePath(makeSavePathArgs({
      fullSpell: { ...DISK_GREASE_2024, dc: null },
      spell: makeCastSpell({ dc: {} }),
    }));
    expect(tail.automationPopup.modalName).toBe('aoeCondition');
    expect(tail.automationPopup.payload.saveType).toBe('CON');
  });

  it('joins only condition-or-type bytes into conditionLabel while the raw fail array rides through untouched', async () => {
    // Synthetic multi-fail probe (no disk spell reaching this gate ships
    // >1 fail entry): entries keep the disk {type:X,condition:X} mirror
    // shape; one entry lacks type, one is pure junk.
    const probeName = 'Multi Fail Probe';
    const fail = [
      { type: 'blinded', condition: 'blinded' },
      { condition: 'restrained' },
      { someOtherField: 'value' },
    ];
    const args = makeSavePathArgs({
      fullSpell: {
        name: probeName,
        level: 1,
        school: 'Enchantment',
        range: '90 feet',
        duration: 'Instantaneous',
        damage: null,
        dc: { dc_type: 'CON', dc_success: 'none' },
        area_of_effect: { shape: 'cone', size: '15-foot' },
        automation: { type: 'save_only', saveType: 'CON', effects: { fail } },
      },
      spell: makeCastSpell({ name: probeName, dc: { dc_type: 'CON', dc_success: 'none' } }),
    });

    const result = await handleSavePath(args);

    expect(result.automationPopup.modalName).toBe('aoeCondition');
    expect(result.automationPopup.payload.conditionLabel).toBe('blinded, restrained');
    expect(result.automationPopup.payload.duration).toBe('Instantaneous');
    // No pre-filtering: junk entry survives inside effects verbatim.
    expect(result.automationPopup.payload.effects).toBe(fail);
    expect(result.automationPopup.payload.effects).toStrictEqual([
      { type: 'blinded', condition: 'blinded' },
      { condition: 'restrained' },
      { someOtherField: 'value' },
    ]);
    expect(result.automationPopup.payload.includeCaster).toBe(false);
  });
});
