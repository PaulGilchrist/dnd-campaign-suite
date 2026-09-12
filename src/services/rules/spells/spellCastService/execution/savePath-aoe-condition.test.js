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

describe('savePath.js — handleAoE condition-only path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* ---------------------------------------------------------------- */
  /*  handleAoE — condition-only AoE (grease)                          */
  /* ---------------------------------------------------------------- */

  describe('condition-only AoE', () => {
    it('returns aoeCondition modal for grease with fail effects', async () => {
      const args = makeSavePathArgs();
      args.fullSpell = {
        name: 'Grease',
        area_of_effect: { type: 'square', size: 10 },
        damage: { damage_type: 'Bludgeoning', damage_at_slot_level: {} },
        dc: { dc_type: 'dex' },
        automation: {
          effects: {
            fail: [{ type: 'condition', condition: 'prone' }],
          },
        },
      };
      args.effectiveDamageType = '';

      const result = await handleSavePath(args);

      expect(result.automationPopup.modalName).toBe('aoeCondition');
      expect(result.automationPopup.payload.includeCaster).toBe(true);
      expect(result.automationPopup.payload.shape).toBe('square');
      expect(result.automationPopup.payload.saveType).toBe('dex');
      expect(result.automationPopup.payload.conditionLabel).toBe('prone');
    });

    it('does not include caster for non-grease condition-only AoE', async () => {
      const args = makeSavePathArgs();
      args.fullSpell = {
        name: 'Slow',
        area_of_effect: { type: 'cube', size: 40 },
        damage: { damage_type: '', damage_at_slot_level: {} },
        dc: { dc_type: 'wis' },
        automation: {
          effects: {
            fail: [{ type: 'condition', condition: 'slowed' }],
          },
        },
      };
      args.effectiveDamageType = '';

      const result = await handleSavePath(args);

      expect(result.automationPopup.modalName).toBe('aoeCondition');
      expect(result.automationPopup.payload.includeCaster).toBe(false);
    });

    it('uses fullSpell.dc.dc_type when present', async () => {
      const args = makeSavePathArgs();
      args.fullSpell = {
        name: 'Grease',
        area_of_effect: { type: 'square', size: 10 },
        damage: { damage_at_slot_level: {} },
        dc: { dc_type: 'str' },
        automation: {
          effects: {
            fail: [{ type: 'condition', condition: 'prone' }],
          },
        },
      };
      args.effectiveDamageType = '';

      const result = await handleSavePath(args);

      expect(result.automationPopup.payload.saveType).toBe('str');
    });

    it('falls back to spell.dc.dc_type when fullSpell.dc is missing', async () => {
      const args = makeSavePathArgs();
      args.fullSpell = {
        name: 'Grease',
        area_of_effect: { type: 'square', size: 10 },
        damage: { damage_at_slot_level: {} },
        dc: null,
        automation: {
          effects: {
            fail: [{ type: 'condition', condition: 'prone' }],
          },
        },
      };
      args.spell = { dc: { dc_type: 'con' } };
      args.effectiveDamageType = '';

      const result = await handleSavePath(args);

      expect(result.automationPopup.payload.saveType).toBe('con');
    });

    it('defaults saveType to CON when no dc is defined', async () => {
      const args = makeSavePathArgs();
      args.fullSpell = {
        name: 'Grease',
        area_of_effect: { type: 'square', size: 10 },
        damage: { damage_at_slot_level: {} },
        dc: null,
        automation: {
          effects: {
            fail: [{ type: 'condition', condition: 'prone' }],
          },
        },
      };
      args.spell = { dc: {} };
      args.effectiveDamageType = '';

      const result = await handleSavePath(args);

      expect(result.automationPopup.payload.saveType).toBe('CON');
    });
  });

  /* ---------------------------------------------------------------- */
  /*  handleAoE — innate sorcery DC bonus (condition-only)             */
  /* ---------------------------------------------------------------- */

  describe('innate sorcery DC bonus', () => {
    it('adds +1 to saveDc when innateSorceryActive is true for condition-only AoE', async () => {
      const args = makeSavePathArgs({ innateSorceryActive: true });
      args.fullSpell = {
        name: 'Grease',
        area_of_effect: { type: 'square', size: 10 },
        damage: { damage_at_slot_level: {} },
        dc: { dc_type: 'dex' },
        automation: {
          effects: {
            fail: [{ type: 'condition', condition: 'prone' }],
          },
        },
      };
      args.effectiveDamageType = '';

      const result = await handleSavePath(args);

      expect(result.automationPopup.payload.saveDc).toBe(18);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  handleAoE — automationEffects fail conditions                    */
  /* ---------------------------------------------------------------- */

  describe('automationEffects fail conditions', () => {
    it('extracts condition names from fail effects', async () => {
      const args = makeSavePathArgs({ effectiveDamageType: '' });
      args.fullSpell = {
        name: 'Frightful Presence',
        area_of_effect: { type: 'cone', size: 60 },
        damage: { damage_at_slot_level: {} },
        dc: { dc_type: 'wis' },
        automation: {
          effects: {
            fail: [
              { type: 'condition', condition: 'frightened' },
              { type: 'condition', condition: 'incapacitated' },
            ],
          },
        },
      };

      const result = await handleSavePath(args);

      expect(result.automationPopup.payload.conditionLabel).toBe('frightened, incapacitated');
    });

    it('filters out effects without condition/type', async () => {
      const args = makeSavePathArgs({ effectiveDamageType: '' });
      args.fullSpell = {
        name: 'TestSpell',
        area_of_effect: { type: 'cone', size: 60 },
        damage: { damage_at_slot_level: {} },
        dc: { dc_type: 'dex' },
        automation: {
          effects: {
            fail: [
              { type: 'condition', condition: 'prone' },
              { someOtherField: 'value' },
              { condition: 'blinded' },
            ],
          },
        },
      };

      const result = await handleSavePath(args);

      expect(result.automationPopup.payload.conditionLabel).toBe('prone, blinded');
    });
  });
});
