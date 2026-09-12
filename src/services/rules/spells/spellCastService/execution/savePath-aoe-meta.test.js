// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ------------------------------------------------------------------ */
/*  SUT — imported after mocks in main file                            */
/* ------------------------------------------------------------------ */

vi.mock('../../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 5, rolls: [5] })),
  rollExpressionMaximized: vi.fn(() => ({ total: 8, rolls: [8] })),
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

vi.mock('../../../features/viciousMockeryService.js', () => ({
  triggerViciousMockeryForGeneric: vi.fn(() => Promise.resolve()),
}));

const { handleSavePath } = await import('./savePath.js');

/* ------------------------------------------------------------------ */
/*  Test-data factories                                                */
/* ------------------------------------------------------------------ */

function makeSpell(overrides = {}) {
  return {
    name: 'Fireball',
    level: 3,
    school: 'Evocation',
    casting_time: '1 action',
    components: ['V', 'S'],
    range: '150 feet',
    damage: { damage_type: 'Fire', damage_at_slot_level: { 3: '8d6' } },
    dc: { dc_type: 'dex', dc_success: 'half' },
    ...overrides,
  };
}

function makeFullSpell(overrides = {}) {
  return {
    name: 'Fireball',
    level: 3,
    area_of_effect: { type: 'cone', size: 60 },
    damage: { damage_type: 'Fire', damage_at_slot_level: { 3: '8d6' } },
    dc: { dc_type: 'dex', dc_success: 'half' },
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
    spell: makeSpell(),
    fullSpell: makeSpell(),
    metaCtx: { targetName: 'Goblin' },
    playerStats: makePlayerStats(),
    campaignName: 'test-campaign',
    mapName: null,
    characters: [],
    getTargetInfo: async () => ({ name: 'Goblin' }),
    getRuntimeValue: vi.fn(),
    innateSorceryActive: false,
    effectiveDamageType: 'Fire',
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
/*  beforeEach — reset all mocks                                       */
/* ------------------------------------------------------------------ */

describe('savePath.js — handleAoE metadata path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* ---------------------------------------------------------------- */
  /*  handleAoE — innate sorcery DC bonus                              */
  /* ---------------------------------------------------------------- */

  describe('innate sorcery DC bonus', () => {
    it('adds +1 to saveDc when innateSorceryActive is true for regular AoE', async () => {
      const args = makeSavePathArgs({ innateSorceryActive: true });
      args.fullSpell = makeFullSpell({ area_of_effect: { type: 'cone', size: 60 } });

      const result = await handleSavePath(args);

      expect(result.automationPopup.payload.saveDc).toBe(18);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  handleAoE — dc_success resolution                                */
  /* ---------------------------------------------------------------- */

  describe('dc_success resolution', () => {
    it('maps dc_success 0 to "none"', async () => {
      const args = makeSavePathArgs();
      args.fullSpell = makeFullSpell({
        area_of_effect: { type: 'cone', size: 60 },
        dc: { dc_type: 'dex', dc_success: 0 },
      });

      const result = await handleSavePath(args);

      expect(result.automationPopup.payload.dcSuccess).toBe('none');
    });

    it('maps dc_success 0.5 to "half"', async () => {
      const args = makeSavePathArgs();
      args.fullSpell = makeFullSpell({
        area_of_effect: { type: 'cone', size: 60 },
        dc: { dc_type: 'dex', dc_success: 0.5 },
      });

      const result = await handleSavePath(args);

      expect(result.automationPopup.payload.dcSuccess).toBe('half');
    });

    it('uses dc_success value as-is when not 0 or 0.5', async () => {
      const args = makeSavePathArgs();
      args.fullSpell = makeFullSpell({
        area_of_effect: { type: 'cone', size: 60 },
        dc: { dc_type: 'dex', dc_success: 'none' },
      });

      const result = await handleSavePath(args);

      expect(result.automationPopup.payload.dcSuccess).toBe('none');
    });

    it('falls back to spell.dc.dc_success when fullSpell.dc is missing', async () => {
      const args = makeSavePathArgs();
      args.fullSpell = makeFullSpell({
        area_of_effect: { type: 'cone', size: 60 },
        dc: null,
      });
      args.spell = { dc: { dc_success: 0 } };

      const result = await handleSavePath(args);

      expect(result.automationPopup.payload.dcSuccess).toBe('none');
    });
  });

  /* ---------------------------------------------------------------- */
  /*  handleAoE — metamagicHeighten with hasInvisible                  */
  /* ---------------------------------------------------------------- */

  describe('metamagicHeighten', () => {
    it('sets metamagicHeighten to true when hasInvisible is true', async () => {
      const args = makeSavePathArgs({ hasInvisible: true });
      args.fullSpell = makeFullSpell({ area_of_effect: { type: 'cone', size: 60 } });

      const result = await handleSavePath(args);

      expect(result.automationPopup.payload.metamagicHeighten).toBe(true);
    });

    it('sets metamagicHeighten from metaCtx when hasInvisible is false', async () => {
      const args = makeSavePathArgs({ hasInvisible: false });
      args.fullSpell = makeFullSpell({ area_of_effect: { type: 'cone', size: 60 } });
      args.metaCtx = { metamagicHeighten: 'Heightened' };

      const result = await handleSavePath(args);

      expect(result.automationPopup.payload.metamagicHeighten).toBe('Heightened');
    });
  });

  /* ---------------------------------------------------------------- */
  /*  handleAoE — hasDamage detection                                  */
  /* ---------------------------------------------------------------- */

  describe('hasDamage detection', () => {
    it('treats damageExpression "0" as no damage', async () => {
      const args = makeSavePathArgs({ effectiveDamageType: '' });
      args.fullSpell = {
        name: 'TestSpell',
        area_of_effect: { type: 'cone', size: 60 },
        damage: { damage_at_slot_level: { 3: '0' } },
        dc: { dc_type: 'dex' },
        automation: {
          effects: {
            fail: [{ type: 'condition', condition: 'slowed' }],
          },
        },
      };

      const result = await handleSavePath(args);

      expect(result.automationPopup.modalName).toBe('aoeCondition');
    });

    it('treats empty string damageExpression as no damage', async () => {
      const args = makeSavePathArgs({ effectiveDamageType: '' });
      args.fullSpell = {
        name: 'TestSpell',
        area_of_effect: { type: 'cone', size: 60 },
        damage: { damage_at_slot_level: { 3: '' } },
        dc: { dc_type: 'dex' },
        automation: {
          effects: {
            fail: [{ type: 'condition', condition: 'slowed' }],
          },
        },
      };

      const result = await handleSavePath(args);

      expect(result.automationPopup.modalName).toBe('aoeCondition');
    });

    it('treats valid damage expression as having damage', async () => {
      const args = makeSavePathArgs();
      args.fullSpell = {
        name: 'Fireball',
        area_of_effect: { type: 'cone', size: 60 },
        damage: { damage_type: 'Fire', damage_at_slot_level: { 3: '8d6' } },
        dc: { dc_type: 'dex', dc_success: 'half' },
      };

      const result = await handleSavePath(args);

      expect(result.automationPopup.modalName).toBe('saveAttackAoe');
      expect(result.automationPopup.payload.damage).toBe('8d6');
    });
  });

  /* ---------------------------------------------------------------- */
  /*  handleAoE — condition-only with no fail effects                  */
  /* ---------------------------------------------------------------- */

  describe('condition-only with no fail effects', () => {
    it('goes to saveAttackAoe when automationEffects.fail is empty', async () => {
      const args = makeSavePathArgs({ effectiveDamageType: '' });
      args.fullSpell = {
        name: 'TestSpell',
        area_of_effect: { type: 'cone', size: 60 },
        damage: { damage_at_slot_level: {} },
        dc: { dc_type: 'dex' },
        automation: {
          effects: { fail: [] },
        },
      };

      const result = await handleSavePath(args);

      expect(result.automationPopup.modalName).toBe('saveAttackAoe');
    });
  });

  /* ---------------------------------------------------------------- */
  /*  handleAoE — no automation at all                                 */
  /* ---------------------------------------------------------------- */

  describe('no automation at all', () => {
    it('goes to saveAttackAoe when automation is missing', async () => {
      const args = makeSavePathArgs();
      args.fullSpell = {
        name: 'Fireball',
        area_of_effect: { type: 'cone', size: 60 },
        damage: { damage_type: 'Fire', damage_at_slot_level: { 3: '8d6' } },
        dc: { dc_type: 'dex', dc_success: 'half' },
      };

      const result = await handleSavePath(args);

      expect(result.automationPopup.modalName).toBe('saveAttackAoe');
    });
  });
});
