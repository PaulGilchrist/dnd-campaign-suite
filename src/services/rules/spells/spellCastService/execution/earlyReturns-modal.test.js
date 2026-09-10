// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

const { resolveSpellDamageWithTypes } = await import('../../../core/spellDamageUtils.js');
const { getRuntimeValue } = await import('../../../../../hooks/runtime/useRuntimeState.js');
const {
  handlePowerWordHeal: mockPwh,
  handlePowerWordKill: mockPwk,
  handleMassSuggestion: mockMassSuggestion,
  handleCalmEmotions: mockCalmEmotions,
  handleHypnoticPatternEarly: mockHypnoticEarly,
  handleConfusionEarly: mockConfusionEarly,
  handleShapechange: mockShapechange,
} = await import('./modalSpells.js');

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

describe('executeSpellCast — early returns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue([]);
    resolveSpellDamageWithTypes.mockReturnValue({ formula: '1d8', primaryType: 'Fire' });
    mockPwh.mockResolvedValue({ handled: false });
    mockPwk.mockResolvedValue({ handled: false });
    mockMassSuggestion.mockReturnValue({ handled: false });
    mockCalmEmotions.mockReturnValue({ handled: false });
    mockHypnoticEarly.mockReturnValue({ handled: false });
    mockConfusionEarly.mockReturnValue({ handled: false });
    mockShapechange.mockReturnValue({ handled: false });
  });

  /* ---------------------------------------------------------------- */
  /*  Power Word Heal early return                                    */
  /* ---------------------------------------------------------------- */

  describe('Power Word Heal early return', () => {
    it('returns early when Power Word Heal is handled', async () => {
      mockPwh.mockResolvedValue({ handled: true, result: { type: 'modal' } });

      const result = await executeSpellCast(
        makeSpell({ name: 'Power Word Heal' }),
        makeMetaCtx(),
        {
          rollAttack: vi.fn(),
          rollDamage: vi.fn(),
          playerStats: makePlayerStats(),
          getTargetInfo: async () => ({ name: 'Goblin' }),
          campaignName: 'test-campaign',
        },
      );

      expect(result).toEqual({ type: 'modal' });
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Power Word Kill early return                                    */
  /* ---------------------------------------------------------------- */

  describe('Power Word Kill early return', () => {
    it('returns early when Power Word Kill is handled', async () => {
      mockPwk.mockResolvedValue({ handled: true, result: { type: 'modal' } });

      const result = await executeSpellCast(
        makeSpell({ name: 'Power Word Kill' }),
        makeMetaCtx(),
        {
          rollAttack: vi.fn(),
          rollDamage: vi.fn(),
          playerStats: makePlayerStats(),
          getTargetInfo: async () => ({ name: 'Goblin' }),
          campaignName: 'test-campaign',
        },
      );

      expect(result).toEqual({ type: 'modal' });
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Modal spells early returns                                      */
  /* ---------------------------------------------------------------- */

  describe('modal spells early returns', () => {
    it('returns early for Mass Suggestion', async () => {
      mockMassSuggestion.mockReturnValue({ handled: true, result: { automationPopup: { type: 'modal', modalName: 'massSuggestion' } } });

      const result = await executeSpellCast(
        makeSpell({ name: 'Mass Suggestion' }),
        makeMetaCtx(),
        {
          rollAttack: vi.fn(),
          rollDamage: vi.fn(),
          playerStats: makePlayerStats(),
          getTargetInfo: async () => ({ name: 'Goblin' }),
          campaignName: 'test-campaign',
        },
      );

      expect(result).toEqual({ automationPopup: { type: 'modal', modalName: 'massSuggestion' } });
    });

    it('returns early for Calm Emotions', async () => {
      mockCalmEmotions.mockReturnValue({ handled: true, result: { automationPopup: { type: 'modal', modalName: 'calmEmotions' } } });

      const result = await executeSpellCast(
        makeSpell({ name: 'Calm Emotions' }),
        makeMetaCtx(),
        {
          rollAttack: vi.fn(),
          rollDamage: vi.fn(),
          playerStats: makePlayerStats(),
          getTargetInfo: async () => ({ name: 'Goblin' }),
          campaignName: 'test-campaign',
        },
      );

      expect(result).toEqual({ automationPopup: { type: 'modal', modalName: 'calmEmotions' } });
    });

    it('returns early for Hypnotic Pattern (early)', async () => {
      mockHypnoticEarly.mockReturnValue({ handled: true, result: { automationPopup: { type: 'modal', modalName: 'hypnoticPattern' } } });

      const result = await executeSpellCast(
        makeSpell({ name: 'Hypnotic Pattern' }),
        makeMetaCtx(),
        {
          rollAttack: vi.fn(),
          rollDamage: vi.fn(),
          playerStats: makePlayerStats(),
          getTargetInfo: async () => ({ name: 'Goblin' }),
          campaignName: 'test-campaign',
        },
      );

      expect(result).toEqual({ automationPopup: { type: 'modal', modalName: 'hypnoticPattern' } });
    });

    it('returns early for Confusion (early)', async () => {
      mockConfusionEarly.mockReturnValue({ handled: true, result: { result: { handled: true } } });

      const result = await executeSpellCast(
        makeSpell({ name: 'Confusion' }),
        makeMetaCtx(),
        {
          rollAttack: vi.fn(),
          rollDamage: vi.fn(),
          playerStats: makePlayerStats(),
          getTargetInfo: async () => ({ name: 'Goblin' }),
          campaignName: 'test-campaign',
        },
      );

      expect(result).toEqual({ handled: true });
    });

    it('returns early for Shapechange', async () => {
      mockShapechange.mockReturnValue({ handled: true, result: Promise.resolve({ automationPopup: { type: 'popup' } }) });

      const result = await executeSpellCast(
        makeSpell({ name: 'Shapechange' }),
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
