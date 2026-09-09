// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ------------------------------------------------------------------ */
/*  Mocks — all dependencies of savePath.js                            */
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

/* ------------------------------------------------------------------ */
/*  SUT import after mocks                                             */
/* ------------------------------------------------------------------ */

const { handleSavePath } = await import('./savePath.js');
const { rollExpression, rollExpressionMaximized } = await import('../../../../dice/diceRoller.js');
const { triggerViciousMockeryForGeneric } = await import('../../../features/viciousMockeryService.js');
const { triggerSoulstitchSpells } = await import('../../postCastRiderService.js');

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

function makeMetaCtx(overrides = {}) {
  return {
    targetName: 'Goblin',
    ...overrides,
  };
}

function makeSavePathArgs(overrides = {}) {
  return {
    spell: makeSpell(),
    fullSpell: makeSpell(),
    metaCtx: makeMetaCtx(),
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

describe('savePath.js — handleSingleTargetSave', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    rollExpression.mockReturnValue({ total: 5, rolls: [5] });
    rollExpressionMaximized.mockReturnValue({ total: 8, rolls: [8] });
    triggerSoulstitchSpells.mockResolvedValue(undefined);
  });

  /* ---------------------------------------------------------------- */
  /*  handleSingleTargetSave — basic flow                              */
  /* ---------------------------------------------------------------- */

  describe('basic flow', () => {
    it('calls rollExpression with damage formula', async () => {
      const args = makeSavePathArgs({ formula: '2d6' });
      const rollDamageMock = vi.fn();
      args.rollDamage = rollDamageMock;

      await handleSavePath(
        args.spell, args.fullSpell, args.metaCtx, args.playerStats,
        args.campaignName, args.mapName, args.characters, args.getTargetInfo,
        args.getRuntimeValue, args.innateSorceryActive, args.effectiveDamageType,
        args.spellSaveDc, args.overchannelFormula, args.overchannelActive,
        args.overchannelUseCount, args.rollAttack, args.rollDamage,
        args.formula, args.hasInvisible,
      );

      expect(rollExpression).toHaveBeenCalledWith('2d6');
    });

    it('calls rollExpressionMaximized when overchannelActive is true', async () => {
      const args = makeSavePathArgs({
        formula: '2d6',
        overchannelActive: true,
        overchannelFormula: '3d6',
      });
      const rollDamageMock = vi.fn();
      args.rollDamage = rollDamageMock;

      await handleSavePath(
        args.spell, args.fullSpell, args.metaCtx, args.playerStats,
        args.campaignName, args.mapName, args.characters, args.getTargetInfo,
        args.getRuntimeValue, args.innateSorceryActive, args.effectiveDamageType,
        args.spellSaveDc, args.overchannelFormula, args.overchannelActive,
        args.overchannelUseCount, args.rollAttack, args.rollDamage,
        args.formula, args.hasInvisible,
      );

      expect(rollExpressionMaximized).toHaveBeenCalledWith('3d6');
      expect(rollDamageMock).toHaveBeenCalledWith(
        'Fireball',
        '3d6',
        8,
        [8],
        undefined,
        expect.objectContaining({
          overchannelActive: true,
          overchannelUseCount: 0,
          overchannelSpellLevel: 3,
        }),
      );
    });

    it('calls rollExpression when overchannelActive is false', async () => {
      const args = makeSavePathArgs({ formula: '2d6', overchannelActive: false });
      const rollDamageMock = vi.fn();
      args.rollDamage = rollDamageMock;

      await handleSavePath(
        args.spell, args.fullSpell, args.metaCtx, args.playerStats,
        args.campaignName, args.mapName, args.characters, args.getTargetInfo,
        args.getRuntimeValue, args.innateSorceryActive, args.effectiveDamageType,
        args.spellSaveDc, args.overchannelFormula, args.overchannelActive,
        args.overchannelUseCount, args.rollAttack, args.rollDamage,
        args.formula, args.hasInvisible,
      );

      expect(rollExpression).toHaveBeenCalledWith('2d6');
      expect(rollExpressionMaximized).not.toHaveBeenCalled();
    });

    it('does not call rollDamage when overchannelResult is null', async () => {
      const args = makeSavePathArgs();
      const rollDamageMock = vi.fn();
      args.rollDamage = rollDamageMock;
      rollExpression.mockReturnValue(null);

      await handleSavePath(
        args.spell, args.fullSpell, args.metaCtx, args.playerStats,
        args.campaignName, args.mapName, args.characters, args.getTargetInfo,
        args.getRuntimeValue, args.innateSorceryActive, args.effectiveDamageType,
        args.spellSaveDc, args.overchannelFormula, args.overchannelActive,
        args.overchannelUseCount, args.rollAttack, args.rollDamage,
        args.formula, args.hasInvisible,
      );

      expect(rollDamageMock).not.toHaveBeenCalled();
    });
  });

  /* ---------------------------------------------------------------- */
  /*  handleSingleTargetSave — Vicious Mockery                         */
  /* ---------------------------------------------------------------- */

  describe('Vicious Mockery (CLA-377)', () => {
    it('never triggers vicious mockery at cast time — gated on the resolved save outcome', async () => {
      const args = makeSavePathArgs({
        spell: { name: 'Vicious Mockery', level: 0, baseLevel: 0, dc: {} },
        fullSpell: { name: 'Vicious Mockery', level: 0, baseLevel: 0, dc: {} },
        mapName: 'test-map',
        spellSaveDc: 15,
      });
      const rollDamageMock = vi.fn();
      args.rollDamage = rollDamageMock;

      await handleSavePath(
        args.spell, args.fullSpell, args.metaCtx, args.playerStats,
        args.campaignName, args.mapName, args.characters, args.getTargetInfo,
        args.getRuntimeValue, args.innateSorceryActive, args.effectiveDamageType,
        args.spellSaveDc, args.overchannelFormula, args.overchannelActive,
        args.overchannelUseCount, args.rollAttack, args.rollDamage,
        args.formula, args.hasInvisible,
      );

      await Promise.resolve();
      await Promise.resolve();

      expect(triggerViciousMockeryForGeneric).not.toHaveBeenCalled();
    });

    it('stamps viciousMockerySpell and viciousMockeryMapName into the save context', async () => {
      const args = makeSavePathArgs({
        spell: { name: 'Vicious Mockery', level: 0, baseLevel: 0, dc: {} },
        fullSpell: { name: 'Vicious Mockery', level: 0, baseLevel: 0, dc: {} },
        mapName: 'test-map',
        spellSaveDc: 15,
      });
      const rollDamageMock = vi.fn();
      args.rollDamage = rollDamageMock;

      await handleSavePath(
        args.spell, args.fullSpell, args.metaCtx, args.playerStats,
        args.campaignName, args.mapName, args.characters, args.getTargetInfo,
        args.getRuntimeValue, args.innateSorceryActive, args.effectiveDamageType,
        args.spellSaveDc, args.overchannelFormula, args.overchannelActive,
        args.overchannelUseCount, args.rollAttack, args.rollDamage,
        args.formula, args.hasInvisible,
      );

      const context = rollDamageMock.mock.calls[0][5];
      expect(context.viciousMockerySpell).toBe(args.spell);
      expect(context.viciousMockeryMapName).toBe('test-map');
    });

    it('does not stamp the save context for other spells', async () => {
      const args = makeSavePathArgs();
      const rollDamageMock = vi.fn();
      args.rollDamage = rollDamageMock;

      await handleSavePath(
        args.spell, args.fullSpell, args.metaCtx, args.playerStats,
        args.campaignName, args.mapName, args.characters, args.getTargetInfo,
        args.getRuntimeValue, args.innateSorceryActive, args.effectiveDamageType,
        args.spellSaveDc, args.overchannelFormula, args.overchannelActive,
        args.overchannelUseCount, args.rollAttack, args.rollDamage,
        args.formula, args.hasInvisible,
      );

      const context = rollDamageMock.mock.calls[0][5];
      expect(context.viciousMockerySpell).toBeUndefined();
      expect(context.viciousMockeryMapName).toBeUndefined();
      expect(triggerViciousMockeryForGeneric).not.toHaveBeenCalled();
    });
  });

  /* ---------------------------------------------------------------- */
  /*  handleSavePath — soulstitch error handling                       */
  /* ---------------------------------------------------------------- */

  describe('soulstitch error handling', () => {
    it('logs error when triggerSoulstitchSpells throws', async () => {
      const args = makeSavePathArgs();
      triggerSoulstitchSpells.mockRejectedValue(new Error('Soulstitch failed'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await handleSavePath(
        args.spell, args.fullSpell, args.metaCtx, args.playerStats,
        args.campaignName, args.mapName, args.characters, args.getTargetInfo,
        args.getRuntimeValue, args.innateSorceryActive, args.effectiveDamageType,
        args.spellSaveDc, args.overchannelFormula, args.overchannelActive,
        args.overchannelUseCount, args.rollAttack, args.rollDamage,
        args.formula, args.hasInvisible,
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        '[spellCast] Soulstitch Spells trigger failed:',
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });
  });

  /* ---------------------------------------------------------------- */
  /*  handleSingleTargetSave — context fields                          */
  /* ---------------------------------------------------------------- */

  describe('context fields', () => {
    it('calls rollDamage with correct context including overchannel fields', async () => {
      const args = makeSavePathArgs({
        formula: '2d6',
        overchannelActive: true,
        overchannelUseCount: 2,
      });
      const rollDamageMock = vi.fn();
      args.rollDamage = rollDamageMock;

      await handleSavePath(
        args.spell, args.fullSpell, args.metaCtx, args.playerStats,
        args.campaignName, args.mapName, args.characters, args.getTargetInfo,
        args.getRuntimeValue, args.innateSorceryActive, args.effectiveDamageType,
        args.spellSaveDc, args.overchannelFormula, args.overchannelActive,
        args.overchannelUseCount, args.rollAttack, args.rollDamage,
        args.formula, args.hasInvisible,
      );

      expect(rollDamageMock).toHaveBeenCalledWith(
        'Fireball',
        '2d6',
        8,
        [8],
        undefined,
        expect.objectContaining({
          overchannelActive: true,
          overchannelUseCount: 2,
          overchannelSpellLevel: 3,
          isCantrip: false,
          saveType: 'dex',
          damageType: 'Fire',
        }),
      );
    });

    it('sets isCantrip to true when baseLevel is 0', async () => {
      const args = makeSavePathArgs({
        spell: { name: 'Cantrip', level: 0, baseLevel: 0, dc: { dc_type: 'dex' } },
        fullSpell: { name: 'Cantrip', level: 0, baseLevel: 0, dc: { dc_type: 'dex' } },
      });
      const rollDamageMock = vi.fn();
      args.rollDamage = rollDamageMock;

      await handleSavePath(
        args.spell, args.fullSpell, args.metaCtx, args.playerStats,
        args.campaignName, args.mapName, args.characters, args.getTargetInfo,
        args.getRuntimeValue, args.innateSorceryActive, args.effectiveDamageType,
        args.spellSaveDc, args.overchannelFormula, args.overchannelActive,
        args.overchannelUseCount, args.rollAttack, args.rollDamage,
        args.formula, args.hasInvisible,
      );

      const context = rollDamageMock.mock.calls[0][5];
      expect(context.isCantrip).toBe(true);
    });

    it('sets isCantrip to true when level is 0', async () => {
      const args = makeSavePathArgs({
        spell: { name: 'Cantrip', level: 0, dc: { dc_type: 'dex' } },
        fullSpell: { name: 'Cantrip', level: 0, dc: { dc_type: 'dex' } },
      });
      const rollDamageMock = vi.fn();
      args.rollDamage = rollDamageMock;

      await handleSavePath(
        args.spell, args.fullSpell, args.metaCtx, args.playerStats,
        args.campaignName, args.mapName, args.characters, args.getTargetInfo,
        args.getRuntimeValue, args.innateSorceryActive, args.effectiveDamageType,
        args.spellSaveDc, args.overchannelFormula, args.overchannelActive,
        args.overchannelUseCount, args.rollAttack, args.rollDamage,
        args.formula, args.hasInvisible,
      );

      const context = rollDamageMock.mock.calls[0][5];
      expect(context.isCantrip).toBe(true);
    });

    it('sets saveType from fullSpell.dc.dc_type', async () => {
      const args = makeSavePathArgs();
      args.fullSpell = { dc: { dc_type: 'con' } };
      args.spell = { dc: { dc_type: 'dex' } };
      const rollDamageMock = vi.fn();
      args.rollDamage = rollDamageMock;

      await handleSavePath(
        args.spell, args.fullSpell, args.metaCtx, args.playerStats,
        args.campaignName, args.mapName, args.characters, args.getTargetInfo,
        args.getRuntimeValue, args.innateSorceryActive, args.effectiveDamageType,
        args.spellSaveDc, args.overchannelFormula, args.overchannelActive,
        args.overchannelUseCount, args.rollAttack, args.rollDamage,
        args.formula, args.hasInvisible,
      );

      const context = rollDamageMock.mock.calls[0][5];
      expect(context.saveType).toBe('con');
    });

    it('falls back to spell.dc.dc_type for saveType', async () => {
      const args = makeSavePathArgs();
      args.fullSpell = { dc: null };
      args.spell = { dc: { dc_type: 'wis' } };
      const rollDamageMock = vi.fn();
      args.rollDamage = rollDamageMock;

      await handleSavePath(
        args.spell, args.fullSpell, args.metaCtx, args.playerStats,
        args.campaignName, args.mapName, args.characters, args.getTargetInfo,
        args.getRuntimeValue, args.innateSorceryActive, args.effectiveDamageType,
        args.spellSaveDc, args.overchannelFormula, args.overchannelActive,
        args.overchannelUseCount, args.rollAttack, args.rollDamage,
        args.formula, args.hasInvisible,
      );

      const context = rollDamageMock.mock.calls[0][5];
      expect(context.saveType).toBe('wis');
    });

    it('uses metaCtx.slotLevel for overchannelSpellLevel', async () => {
      const args = makeSavePathArgs({
        formula: '2d6',
        overchannelActive: true,
        metaCtx: { slotLevel: 5 },
      });
      const rollDamageMock = vi.fn();
      args.rollDamage = rollDamageMock;

      await handleSavePath(
        args.spell, args.fullSpell, args.metaCtx, args.playerStats,
        args.campaignName, args.mapName, args.characters, args.getTargetInfo,
        args.getRuntimeValue, args.innateSorceryActive, args.effectiveDamageType,
        args.spellSaveDc, args.overchannelFormula, args.overchannelActive,
        args.overchannelUseCount, args.rollAttack, args.rollDamage,
        args.formula, args.hasInvisible,
      );

      const context = rollDamageMock.mock.calls[0][5];
      expect(context.overchannelSpellLevel).toBe(5);
    });

    it('falls back to spell.level for overchannelSpellLevel', async () => {
      const args = makeSavePathArgs({
        formula: '2d6',
        overchannelActive: true,
        metaCtx: {},
      });
      const rollDamageMock = vi.fn();
      args.rollDamage = rollDamageMock;

      await handleSavePath(
        args.spell, args.fullSpell, args.metaCtx, args.playerStats,
        args.campaignName, args.mapName, args.characters, args.getTargetInfo,
        args.getRuntimeValue, args.innateSorceryActive, args.effectiveDamageType,
        args.spellSaveDc, args.overchannelFormula, args.overchannelActive,
        args.overchannelUseCount, args.rollAttack, args.rollDamage,
        args.formula, args.hasInvisible,
      );

      const context = rollDamageMock.mock.calls[0][5];
      expect(context.overchannelSpellLevel).toBe(3);
    });
  });
});
