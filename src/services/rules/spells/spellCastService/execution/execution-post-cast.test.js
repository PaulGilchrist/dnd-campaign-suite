// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/* ------------------------------------------------------------------ */
/*  Mocks — all dependencies of execution/index.js                     */
/* ------------------------------------------------------------------ */

vi.mock('../../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((_playerName, _key, _campaignName) => undefined),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../automation/index.js', () => ({
  executeHandler: vi.fn(),
  checkCompelledDuelAttackExpiry: vi.fn(),
}));

vi.mock('../../../features/healingWordService.js', () => ({
  triggerHealingWord: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../rules/spells/postCastHealService.js', () => ({
  triggerPostCastSelfHeals: vi.fn(() => Promise.resolve()),
  triggerPostCastAllyHeals: vi.fn(() => Promise.resolve({})),
}));

vi.mock('../../../features/smiteOfProtectionService.js', () => ({
  triggerSmiteOfProtection: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../features/inspiringSmiteService.js', () => ({
  triggerInspiringSmite: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../features/primalCompanionSpellShareService.js', () => ({
  triggerPrimalCompanionSpellShare: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../features/wildMagicSurgeService.js', () => ({
  triggerWildMagicSurge: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../../../rules/spells/postCastRiderService.js', () => ({
  triggerBewitchingMagic: vi.fn(() => Promise.resolve()),
  triggerPostCastRiderSaves: vi.fn(() => Promise.resolve()),
  triggerSpellThief: vi.fn(() => Promise.resolve()),
  triggerSoulstitchSpells: vi.fn(() => Promise.resolve()),
  getEmpoweredEvocationFeatures: vi.fn(() => []),
  getEmpoweredEvocationIntModifier: vi.fn(() => 0),
}));

vi.mock('../../../../automation/handlers/spells/sanctuaryHandler.js', () => ({
  endSanctuary: vi.fn(),
}));

vi.mock('../../../combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(() => null),
}));

vi.mock('../../../combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(),
}));

vi.mock('../../../features/silenceService.js', () => ({
  getSilenceSource: vi.fn(() => null),
  isCreatureInSilenceZone: vi.fn(() => false),
}));

vi.mock('../../../features/friendsService.js', () => ({
  endFriendsOnHostileAction: vi.fn(),
}));

vi.mock('../../../features/invisibilityService.js', () => ({
  endInvisibilityOnHostileAction: vi.fn(),
}));

vi.mock('../../../../combat/buffs/buffService.js', () => ({
  isInnateSorceryActive: vi.fn(() => false),
}));

vi.mock('../../../core/spellDamageUtils.js', () => ({
  resolveSpellDamageWithTypes: vi.fn(() => ({ formula: '1d8', primaryType: 'Fire' })),
}));

vi.mock('../../../features/confusionService.js', () => ({
  triggerConfusion: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
  resolveHealingBonusesWithDetails: vi.fn(() => ({ totalBonus: 0, details: [] })),
  hasHealingMaximizationForTarget: vi.fn(() => false),
  hasRerollHealingOnes: vi.fn(() => false),
}));

vi.mock('../../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 5, rolls: [5] })),
  rollExpressionMaximized: vi.fn(() => ({ total: 8, rolls: [8] })),
  applyHealingRerollOnes: vi.fn(() => ({ displayRolls: [5], originalRolls: [5] })),
}));

vi.mock('./helpers.js', () => ({
  refundSpellBreakerSlot: vi.fn(),
  applyHexEffects: vi.fn(),
  applyPowerWordHealToTarget: vi.fn(),
  applyPowerWordKillToTarget: vi.fn(),
  triggerArcaneWard: vi.fn(() => Promise.resolve()),
  triggerDispelMagic: vi.fn(() => Promise.resolve()),
  triggerExpertDivination: vi.fn(() => Promise.resolve(null)),
  applyRegenerateSpell: vi.fn(),
  executeMagicMissile: vi.fn(() => Promise.resolve()),
}));

vi.mock('./blockChecks.js', () => ({
  checkGlobeOfInvulnerability: vi.fn(() => Promise.resolve(null)),
  checkForcecageBlocked: vi.fn(() => Promise.resolve(null)),
  checkBlockedBySpellcastingBuff: vi.fn(() => Promise.resolve(null)),
}));


vi.mock('./modalSpells.js', () => ({
  handlePowerWordHeal: vi.fn(() => Promise.resolve({ handled: false })),
  handlePowerWordKill: vi.fn(() => Promise.resolve({ handled: false })),
  handleMassSuggestion: vi.fn(() => ({ handled: false })),
  handleCalmEmotions: vi.fn(() => ({ handled: false })),
  handleHypnoticPatternEarly: vi.fn(() => ({ handled: false })),
  handleConfusionEarly: vi.fn(() => ({ handled: false })),
  handleShapechange: vi.fn(() => ({ handled: false })),
  handleFear: vi.fn(() => ({ handled: false })),
  handleConjureVolley: vi.fn(() => ({ handled: false })),
  handleSilence: vi.fn(() => ({ handled: false })),
  handleSleep: vi.fn(() => ({ handled: false })),
}));

vi.mock('./triggerSpells.js', () => ({
  handleRegenerate: vi.fn(() => Promise.resolve({ handled: false })),
  handleSeeInvisibility: vi.fn(() => Promise.resolve({ handled: false })),
  handleFleshToStone: vi.fn(() => Promise.resolve({ handled: false })),
  handleHoldMonster: vi.fn(() => Promise.resolve({ handled: false })),
  handleBanishment: vi.fn(() => Promise.resolve({ handled: false })),
  handleConfusion: vi.fn(() => Promise.resolve({ handled: false })),
  handleMaze: vi.fn(() => Promise.resolve({ handled: false })),
  handlePowerWordStun: vi.fn(() => Promise.resolve({ handled: false })),
  handleHypnoticPattern: vi.fn(() => Promise.resolve({ handled: false })),
  handleSlow: vi.fn(() => Promise.resolve({ handled: false })),
  handleBane: vi.fn(() => Promise.resolve({ handled: false })),
  handleBless: vi.fn(() => Promise.resolve({ handled: false })),
  handleBeaconOfHope: vi.fn(() => Promise.resolve({ handled: false })),
  handleMassSuggestion: vi.fn(() => Promise.resolve({ handled: false })),
  handleSuggestion: vi.fn(() => Promise.resolve({ handled: false })),
  handleCommand: vi.fn(() => Promise.resolve({ handled: false })),
  handleOttoDance: vi.fn(() => Promise.resolve({ handled: false })),
  handleResilientSphere: vi.fn(() => Promise.resolve({ handled: false })),
  handleBlur: vi.fn(() => Promise.resolve({ handled: false })),
  handleExpeditiousRetreat: vi.fn(() => Promise.resolve({ handled: false })),
  handleFriends: vi.fn(() => Promise.resolve({ handled: false })),
  handleCrownOfMadness: vi.fn(() => Promise.resolve({ handled: false })),
  handleAnimalFriendship: vi.fn(() => Promise.resolve({ handled: false })),
  handleDominateBeast: vi.fn(() => Promise.resolve({ handled: false })),
  handleDominateMonster: vi.fn(() => Promise.resolve({ handled: false })),
  handleDominatePerson: vi.fn(() => Promise.resolve({ handled: false })),
  handleRayOfEnfeeblement: vi.fn(() => Promise.resolve({ handled: false })),
  handleCompelledDuel: vi.fn(() => Promise.resolve({ handled: false })),
  handleGlobeOfInvulnerability: vi.fn(() => Promise.resolve({ handled: false })),
  handleForcecage: vi.fn(() => Promise.resolve({ handled: false })),
  handleStinkingCloud: vi.fn(() => Promise.resolve({ handled: false })),
  handleSleetStorm: vi.fn(() => Promise.resolve({ handled: false })),
  handleFaerieFire: vi.fn(() => Promise.resolve({ handled: false })),
  handleTashasHideousLaughter: vi.fn(() => Promise.resolve({ handled: false })),
  handleImprisonment: vi.fn(() => Promise.resolve({ handled: false })),
  handleHeroism: vi.fn(() => Promise.resolve({ handled: false })),
  handleHolyAura: vi.fn(() => Promise.resolve({ handled: false })),
  handleLongstrider: vi.fn(() => Promise.resolve({ handled: false })),
  handleSpareTheDying: vi.fn(() => Promise.resolve({ handled: false })),
  handleEnhanceAbility: vi.fn(() => Promise.resolve({ handled: false })),
  handleMassCureWounds: vi.fn(() => Promise.resolve({ handled: false })),
  handleMassHealingWord: vi.fn(() => Promise.resolve({ handled: false })),
  handlePrayerOfHealing: vi.fn(() => Promise.resolve({ handled: false })),
  handleFalseLife: vi.fn(() => Promise.resolve({ handled: false })),
  handleRemoveCurse: vi.fn(() => Promise.resolve({ handled: false })),
  handleProtectionFromEnergy: vi.fn(() => Promise.resolve({ handled: false })),
  handleProtectionFromPoison: vi.fn(() => Promise.resolve({ handled: false })),
  handleResistance: vi.fn(() => Promise.resolve({ handled: false })),
  handleGenericAutomation: vi.fn(() => Promise.resolve({ handled: false })),
}));

vi.mock('./savePath.js', () => ({
  handleSavePath: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('./noSavePath.js', () => ({
  handleNoSavePath: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('./damageCalculation.js', () => ({
  computeRange: vi.fn(() => ({})),
  computeEmpoweredEvocation: vi.fn(() => ({ empEvocFormula: null })),
  computeBlessedStrikes: vi.fn((_, formula) => formula),
  computeRadiantSoul: vi.fn((_, __, ___, ____, formula) => formula),
  computeOverchannel: vi.fn(() => ({ overchannelFormula: null, overchannelActive: false, overchannelUseCount: 0 })),
}));

vi.mock('./spellResolution.js', () => ({
  getActiveBuffs: vi.fn(() => []),
}));

vi.mock('../../../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
}));

/* ------------------------------------------------------------------ */
/*  SUT import after mocks                                             */
/* ------------------------------------------------------------------ */

import { executeSpellCast } from './index.js';

/* ------------------------------------------------------------------ */
/*  Mock references                                                    */
/* ------------------------------------------------------------------ */

const { getRuntimeValue, setRuntimeValue } = await import('../../../../../hooks/runtime/useRuntimeState.js');
const { addEntry } = await import('../../../../ui/logService.js');
const { endSanctuary } = await import('../../../../automation/handlers/spells/sanctuaryHandler.js');
const { triggerPostCastSelfHeals, triggerPostCastAllyHeals } = await import('../../../../rules/spells/postCastHealService.js');
const { triggerSmiteOfProtection } = await import('../../../features/smiteOfProtectionService.js');
const { triggerInspiringSmite } = await import('../../../features/inspiringSmiteService.js');
const { triggerPrimalCompanionSpellShare } = await import('../../../features/primalCompanionSpellShareService.js');
const { triggerBewitchingMagic, triggerPostCastRiderSaves, triggerSpellThief } = await import('../../../../rules/spells/postCastRiderService.js');
const {
  triggerArcaneWard: mockTriggerArcaneWard,
  triggerDispelMagic: mockTriggerDispelMagic,
  triggerExpertDivination: mockTriggerExpertDivination,
} = await import('./helpers.js');
const { handleSavePath: mockHandleSavePath } = await import('./savePath.js');
const { handleNoSavePath: mockHandleNoSavePath } = await import('./noSavePath.js');
const { resolveSpellDamageWithTypes } = await import('../../../core/spellDamageUtils.js');
const { computeRange } = await import('./damageCalculation.js');

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

/* ------------------------------------------------------------------ */
/*  beforeEach — reset all mock implementations to safe defaults       */
/* ------------------------------------------------------------------ */

describe('executeSpellCast — post-cast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue([]);
    setRuntimeValue.mockResolvedValue(undefined);
    addEntry.mockResolvedValue(undefined);
    resolveSpellDamageWithTypes.mockReturnValue({ formula: '1d8', primaryType: 'Fire' });
    computeRange.mockReturnValue({});
  });

  /* ---------------------------------------------------------------- */
  /*  Damage path — auto miss                                         */
  /* ---------------------------------------------------------------- */

  describe('auto miss', () => {
    it('returns null when range result is auto miss with save DC', async () => {
      resolveSpellDamageWithTypes.mockReturnValue({ formula: '8d6', primaryType: 'Fire' });
      computeRange.mockReturnValue({ isAutoMiss: true, rangeReason: 'out of range' });

      const result = await executeSpellCast(
        makeSpell(),
        makeMetaCtx(),
        {
          rollAttack: vi.fn(),
          rollDamage: vi.fn(),
          playerStats: makePlayerStats(),
          getTargetInfo: async () => ({ name: 'Goblin' }),
          campaignName: 'test-campaign',
        },
      );

      expect(result).toBeNull();
      expect(mockHandleSavePath).toHaveBeenCalled();
    });

    it('returns null when range result is auto miss without save DC', async () => {
      resolveSpellDamageWithTypes.mockReturnValue({ formula: '8d6', primaryType: 'Fire' });
      computeRange.mockReturnValue({ isAutoMiss: true, rangeReason: 'out of range' });

      const spell = makeSpell({ dc: undefined });
      const result = await executeSpellCast(
        spell,
        makeMetaCtx(),
        {
          rollAttack: vi.fn(),
          rollDamage: vi.fn(),
          playerStats: makePlayerStats(),
          getTargetInfo: async () => ({ name: 'Goblin' }),
          campaignName: 'test-campaign',
        },
      );

      expect(result).toBeNull();
      expect(mockHandleSavePath).not.toHaveBeenCalled();
    });

    it('handles save path when spell has dc', async () => {
      resolveSpellDamageWithTypes.mockReturnValue({ formula: '8d6', primaryType: 'Fire' });
      computeRange.mockReturnValue({});

      await executeSpellCast(
        makeSpell(),
        makeMetaCtx(),
        {
          rollAttack: vi.fn(),
          rollDamage: vi.fn(),
          playerStats: makePlayerStats(),
          getTargetInfo: async () => ({ name: 'Goblin' }),
          campaignName: 'test-campaign',
        },
      );

      expect(mockHandleSavePath).toHaveBeenCalled();
    });

    it('handles no-save path when spell has no dc', async () => {
      resolveSpellDamageWithTypes.mockReturnValue({ formula: '8d6', primaryType: 'Fire' });
      computeRange.mockReturnValue({});

      const spell = makeSpell({ dc: undefined });
      await executeSpellCast(
        spell,
        makeMetaCtx(),
        {
          rollAttack: vi.fn(),
          rollDamage: vi.fn(),
          playerStats: makePlayerStats(),
          getTargetInfo: async () => ({ name: 'Goblin' }),
          campaignName: 'test-campaign',
        },
      );

      expect(mockHandleNoSavePath).toHaveBeenCalled();
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Post-cast triggers                                              */
  /* ---------------------------------------------------------------- */

  describe('post-cast triggers', () => {
    it('calls all post-cast trigger functions on the damage path', async () => {
      resolveSpellDamageWithTypes.mockReturnValue({ formula: '8d6', primaryType: 'Fire' });
      computeRange.mockReturnValue({});

      await executeSpellCast(
        makeSpell(),
        makeMetaCtx(),
        {
          rollAttack: vi.fn(),
          rollDamage: vi.fn(),
          playerStats: makePlayerStats(),
          getTargetInfo: async () => ({ name: 'Goblin' }),
          campaignName: 'test-campaign',
        },
      );

      expect(triggerPostCastRiderSaves).toHaveBeenCalled();
      expect(triggerPostCastSelfHeals).toHaveBeenCalled();
      expect(triggerPostCastAllyHeals).toHaveBeenCalled();
      expect(triggerSmiteOfProtection).toHaveBeenCalled();
      expect(triggerInspiringSmite).toHaveBeenCalled();
      expect(triggerPrimalCompanionSpellShare).toHaveBeenCalled();
      expect(triggerSpellThief).toHaveBeenCalled();
      expect(triggerBewitchingMagic).toHaveBeenCalled();
      expect(mockTriggerExpertDivination).toHaveBeenCalled();
      expect(mockTriggerArcaneWard).toHaveBeenCalled();
    });

    it('resolves Dispel Magic via triggerDispelMagic on the no-damage path (CLA-322)', async () => {
      resolveSpellDamageWithTypes.mockReturnValue({ formula: null, primaryType: null });
      computeRange.mockReturnValue({});

      await executeSpellCast(
        makeSpell({ name: 'Dispel Magic' }),
        { ...makeMetaCtx(), slotLevel: 2 },
        {
          rollAttack: vi.fn(),
          rollDamage: vi.fn(),
          playerStats: makePlayerStats(),
          getTargetInfo: async () => ({ name: 'Goblin' }),
          campaignName: 'test-campaign',
        },
      );

      expect(mockTriggerDispelMagic).toHaveBeenCalledWith(
        expect.objectContaining({ targetName: 'Goblin' }),
        expect.objectContaining({ name: 'Dispel Magic' }),
        expect.any(Object),
        'test-campaign',
        undefined,
      );
    });

    it('does not call triggerDispelMagic for non-Dispel Magic', async () => {
      resolveSpellDamageWithTypes.mockReturnValue({ formula: '8d6', primaryType: 'Fire' });
      computeRange.mockReturnValue({});

      await executeSpellCast(
        makeSpell({ name: 'Fireball' }),
        { ...makeMetaCtx(), slotLevel: 2 },
        {
          rollAttack: vi.fn(),
          rollDamage: vi.fn(),
          playerStats: makePlayerStats(),
          getTargetInfo: async () => ({ name: 'Goblin' }),
          campaignName: 'test-campaign',
        },
      );

      expect(mockTriggerDispelMagic).not.toHaveBeenCalled();
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Post-cast triggers — no-save path (CLA-200)                    */
  /* ---------------------------------------------------------------- */

  describe('no-save path post-cast triggers (CLA-200)', () => {
    // Divine Smite has no `dc` in 2024 spells.json — it must take the no-save
    // path (handleNoSavePath rolls the attack) AND still reach the post-cast
    // trigger block. Before the fix, the no-dc branch early-returned and the
    // Inspiring Smite auto-trigger was unreachable.
    function makeDivineSmite() {
      return makeSpell({
        name: 'Divine Smite',
        level: 1,
        school: 'Evocation',
        casting_time: 'Bonus Action',
        dc: undefined,
        attack_type: 'melee',
        damage: { damage_type: 'Radiant', damage_at_slot_level: { 1: '2d8' } },
      });
    }

    // The module-level vi.mock implementations persist across tests (the mock
    // factory runs once per file), so restore the default falsy returns after
    // each test here to avoid poisoning later describes (Sanctuary etc.).
    afterEach(() => {
      mockHandleNoSavePath.mockResolvedValue(null);
      mockHandleSavePath.mockResolvedValue(null);
    });

    it('fires the post-cast triggers for a no-dc spell (Inspiring Smite reachable)', async () => {
      resolveSpellDamageWithTypes.mockReturnValue({ formula: '2d8', primaryType: 'Radiant' });
      computeRange.mockReturnValue({});
      mockHandleNoSavePath.mockResolvedValue(null);

      const result = await executeSpellCast(
        makeDivineSmite(),
        { ...makeMetaCtx(), slotLevel: 1 },
        {
          rollAttack: vi.fn(),
          rollDamage: vi.fn(),
          playerStats: makePlayerStats(),
          getTargetInfo: async () => ({ name: 'Goblin' }),
          campaignName: 'test-campaign',
        },
      );

      expect(mockHandleNoSavePath).toHaveBeenCalled();
      expect(mockHandleSavePath).not.toHaveBeenCalled();
      expect(triggerInspiringSmite).toHaveBeenCalled();
      expect(triggerPostCastRiderSaves).toHaveBeenCalled();
      expect(triggerPostCastSelfHeals).toHaveBeenCalled();
      expect(triggerPostCastAllyHeals).toHaveBeenCalled();
      expect(triggerSmiteOfProtection).toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('always falls through the no-save branch (handleNoSavePath resolves null/undefined)', async () => {
      resolveSpellDamageWithTypes.mockReturnValue({ formula: '2d8', primaryType: 'Radiant' });
      computeRange.mockReturnValue({});
      mockHandleNoSavePath.mockResolvedValue(undefined);

      const result = await executeSpellCast(
        makeDivineSmite(),
        { ...makeMetaCtx(), slotLevel: 1 },
        {
          rollAttack: vi.fn(),
          rollDamage: vi.fn(),
          playerStats: makePlayerStats(),
          getTargetInfo: async () => ({ name: 'Goblin' }),
          campaignName: 'test-campaign',
        },
      );

      expect(mockHandleNoSavePath).toHaveBeenCalled();
      expect(result).toBeNull();
      expect(triggerInspiringSmite).toHaveBeenCalled();
    });

    it('skips post-cast triggers when a dc save path returns a handled result (dc spells unchanged)', async () => {
      resolveSpellDamageWithTypes.mockReturnValue({ formula: '8d6', primaryType: 'Fire' });
      computeRange.mockReturnValue({});
      mockHandleSavePath.mockResolvedValue({ automationPopup: { type: 'popup' } });

      await executeSpellCast(
        makeSpell(),
        makeMetaCtx(),
        {
          rollAttack: vi.fn(),
          rollDamage: vi.fn(),
          playerStats: makePlayerStats(),
          getTargetInfo: async () => ({ name: 'Goblin' }),
          campaignName: 'test-campaign',
        },
      );

      expect(mockHandleSavePath).toHaveBeenCalled();
      expect(mockHandleNoSavePath).not.toHaveBeenCalled();
      expect(triggerInspiringSmite).not.toHaveBeenCalled();
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Post-cast — Sanctuary end                                       */
  /* ---------------------------------------------------------------- */

  describe('Sanctuary end', () => {
    it('ends Sanctuary when caster has sanctuary effect and target is in characters list', async () => {
      resolveSpellDamageWithTypes.mockReturnValue({ formula: '8d6', primaryType: 'Fire' });
      computeRange.mockReturnValue({});
      getRuntimeValue.mockImplementation((playerName, prop, _cn) => {
        if (prop === 'targetEffects') {
          return [{ effect: 'sanctuary', target: 'TestWizard', source: 'Cleric' }];
        }
        if (prop === 'activeConditions') {
          return [];
        }
        return undefined;
      });

      const characters = [{ name: 'Cleric' }];

      await executeSpellCast(
        makeSpell(),
        makeMetaCtx(),
        {
          rollAttack: vi.fn(),
          rollDamage: vi.fn(),
          playerStats: makePlayerStats(),
          getTargetInfo: async () => ({ name: 'Goblin' }),
          campaignName: 'test-campaign',
          characters,
        },
      );

      expect(endSanctuary).toHaveBeenCalledWith('Cleric', 'TestWizard', 'test-campaign', expect.stringContaining('cast a spell'));
    });

    it('does not end Sanctuary when caster effect exists but caster not in characters', async () => {
      resolveSpellDamageWithTypes.mockReturnValue({ formula: '8d6', primaryType: 'Fire' });
      computeRange.mockReturnValue({});
      getRuntimeValue.mockImplementation((playerName, prop, _cn) => {
        if (prop === 'targetEffects') {
          return [{ effect: 'sanctuary', target: 'TestWizard', source: 'UnknownCaster' }];
        }
        if (prop === 'activeConditions') {
          return [];
        }
        return undefined;
      });

      const characters = [{ name: 'Cleric' }];

      await executeSpellCast(
        makeSpell(),
        makeMetaCtx(),
        {
          rollAttack: vi.fn(),
          rollDamage: vi.fn(),
          playerStats: makePlayerStats(),
          getTargetInfo: async () => ({ name: 'Goblin' }),
          campaignName: 'test-campaign',
          characters,
        },
      );

      expect(endSanctuary).not.toHaveBeenCalled();
    });

    it('handles empty sanctuary effects gracefully', async () => {
      resolveSpellDamageWithTypes.mockReturnValue({ formula: '8d6', primaryType: 'Fire' });
      computeRange.mockReturnValue({});
      getRuntimeValue.mockReturnValue([]);

      await executeSpellCast(
        makeSpell(),
        makeMetaCtx(),
        {
          rollAttack: vi.fn(),
          rollDamage: vi.fn(),
          playerStats: makePlayerStats(),
          getTargetInfo: async () => ({ name: 'Goblin' }),
          campaignName: 'test-campaign',
          characters: [],
        },
      );

      expect(endSanctuary).not.toHaveBeenCalled();
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Post-cast — Wild Magic Surge                                    */
  /* ---------------------------------------------------------------- */

  describe('Wild Magic Surge', () => {
    it('handles Wild Magic Surge result when returned', async () => {
      resolveSpellDamageWithTypes.mockReturnValue({ formula: '8d6', primaryType: 'Fire' });
      computeRange.mockReturnValue({});
      const { triggerWildMagicSurge: wms } = await import('../../../features/wildMagicSurgeService.js');
      vi.mocked(wms).mockResolvedValue({ automationPopup: { type: 'popup' } });

      const result = await executeSpellCast(
        makeSpell(),
        makeMetaCtx(),
        {
          rollAttack: vi.fn(),
          rollDamage: vi.fn(),
          playerStats: makePlayerStats(),
          getTargetInfo: async () => ({ name: 'Goblin' }),
          campaignName: 'test-campaign',
        },
      );

      expect(result).toEqual({ automationPopup: { type: 'popup' } });
    });
  });
});
