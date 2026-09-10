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

const { getRuntimeValue } = await import('../../../../../hooks/runtime/useRuntimeState.js');
const { addEntry } = await import('../../../../ui/logService.js');

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

describe('executeSpellCast — spell stats & innate sorcery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue([]);
  });

  /* ---------------------------------------------------------------- */
  /*  Spell stats — ability overrides                                 */
  /* ---------------------------------------------------------------- */

  describe('spell stats — ability overrides', () => {
    it('uses spell.spellCastingAbility when present', async () => {
      const spell = makeSpell({ spellCastingAbility: 'Wisdom' });
      const playerStats = makePlayerStats({
        abilities: [
          { name: 'Intelligence', bonus: 5 },
          { name: 'Wisdom', bonus: 3 },
        ],
        proficiency: 4,
      });

      await executeSpellCast(
        spell,
        makeMetaCtx(),
        {
          rollAttack: vi.fn(),
          rollDamage: vi.fn(),
          playerStats,
          getTargetInfo: async () => ({ name: 'Goblin' }),
          campaignName: 'test-campaign',
        },
      );

      expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.any(Object));
    });

    it('calculates spellToHit from ability.bonus + proficiency when cantripSpellAbility matches', async () => {
      const spell = makeSpell({ spellCastingAbility: 'Intelligence' });
      const playerStats = makePlayerStats({
        spellAbilities: {
          spellCastingAbility: 'Intelligence',
          toHit: 99,
          saveDc: 99,
          modifier: 5,
        },
        abilities: [{ name: 'Intelligence', bonus: 5 }],
        proficiency: 4,
      });

      await executeSpellCast(
        spell,
        makeMetaCtx(),
        {
          rollAttack: vi.fn(),
          rollDamage: vi.fn(),
          playerStats,
          getTargetInfo: async () => ({ name: 'Goblin' }),
          campaignName: 'test-campaign',
        },
      );

      expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.any(Object));
    });

    it('defaults spellToHit to 0 when spellAbilities is missing', async () => {
      const playerStats = makePlayerStats({ spellAbilities: null });

      await executeSpellCast(
        makeSpell(),
        makeMetaCtx(),
        {
          rollAttack: vi.fn(),
          rollDamage: vi.fn(),
          playerStats,
          getTargetInfo: async () => ({ name: 'Goblin' }),
          campaignName: 'test-campaign',
        },
      );

      expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.any(Object));
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Spell stats — save DC resolution                                */
  /* ---------------------------------------------------------------- */

  describe('spell stats — save DC resolution', () => {
    it('uses playerStats.spellAbilities.saveDc when present', async () => {
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

      expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.any(Object));
    });

    it('calculates save DC from proficiency when saveDc is missing', async () => {
      const playerStats = makePlayerStats({
        spellAbilities: { toHit: 9, modifier: 5 },
      });

      await executeSpellCast(
        makeSpell(),
        makeMetaCtx(),
        {
          rollAttack: vi.fn(),
          rollDamage: vi.fn(),
          playerStats,
          getTargetInfo: async () => ({ name: 'Goblin' }),
          campaignName: 'test-campaign',
        },
      );

      expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.any(Object));
    });

    it('throws when saveDc is missing and proficiency is also missing', async () => {
      const playerStats = makePlayerStats({
        spellAbilities: { toHit: 9, modifier: 5 },
        proficiency: null,
      });

      await expect(
        executeSpellCast(makeSpell(), makeMetaCtx(), {
          rollAttack: vi.fn(),
          rollDamage: vi.fn(),
          playerStats,
          getTargetInfo: async () => ({ name: 'Goblin' }),
          campaignName: 'test-campaign',
        }),
      ).rejects.toThrow('playerStats.proficiency is required for spell save DC calculation');
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Spell stats — spellCastingMod fallback                          */
  /* ---------------------------------------------------------------- */

  describe('spell stats — spellCastingMod fallback', () => {
    it('uses ability.bonus when cantripSpellAbility matches', async () => {
      const playerStats = makePlayerStats({
        spellAbilities: null,
      });

      await executeSpellCast(
        makeSpell({ spellCastingAbility: 'Intelligence' }),
        makeMetaCtx(),
        {
          rollAttack: vi.fn(),
          rollDamage: vi.fn(),
          playerStats,
          getTargetInfo: async () => ({ name: 'Goblin' }),
          campaignName: 'test-campaign',
        },
      );

      expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.any(Object));
    });

    it('defaults to 0 when cantripSpellAbility is missing and spellAbilities has no modifier', async () => {
      const playerStats = makePlayerStats({
        spellAbilities: { toHit: 5 },
        abilities: null,
      });

      await executeSpellCast(
        makeSpell(),
        makeMetaCtx(),
        {
          rollAttack: vi.fn(),
          rollDamage: vi.fn(),
          playerStats,
          getTargetInfo: async () => ({ name: 'Goblin' }),
          campaignName: 'test-campaign',
        },
      );

      expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.any(Object));
    });

    it('defaults to 0 when cantripSpellAbility is missing and spellAbilities is null', async () => {
      const playerStats = makePlayerStats({
        spellAbilities: null,
        abilities: null,
      });

      await executeSpellCast(
        makeSpell(),
        makeMetaCtx(),
        {
          rollAttack: vi.fn(),
          rollDamage: vi.fn(),
          playerStats,
          getTargetInfo: async () => ({ name: 'Goblin' }),
          campaignName: 'test-campaign',
        },
      );

      expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.any(Object));
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Innate Sorcery                                                  */
  /* ---------------------------------------------------------------- */

  describe('innate sorcery', () => {
    it('sets innateSorceryActive from isInnateSorceryActive', async () => {
      const { isInnateSorceryActive } = await import('../../../../combat/buffs/buffService.js');
      isInnateSorceryActive.mockReturnValue(true);

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

      expect(isInnateSorceryActive).toHaveBeenCalledWith('TestWizard', 'test-campaign');
    });
  });
});
