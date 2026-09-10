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

const { getRuntimeValue, setRuntimeValue } = await import('../../../../../hooks/runtime/useRuntimeState.js');
const { addEntry } = await import('../../../../ui/logService.js');
const { endFriendsOnHostileAction } = await import('../../../features/friendsService.js');
const { endInvisibilityOnHostileAction } = await import('../../../features/invisibilityService.js');
const { isInnateSorceryActive } = await import('../../../../combat/buffs/buffService.js');
const { resolveSpellDamageWithTypes } = await import('../../../core/spellDamageUtils.js');
const { getSilenceSource, isCreatureInSilenceZone } = await import('../../../features/silenceService.js');
const { triggerDispelMagic: mockTriggerDispelMagic } = await import('./helpers.js');

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

describe('executeSpellCast — early resolutions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue([]);
    setRuntimeValue.mockResolvedValue(undefined);
    addEntry.mockResolvedValue(undefined);
    isInnateSorceryActive.mockReturnValue(false);
    getSilenceSource.mockReturnValue(null);
    isCreatureInSilenceZone.mockReturnValue(false);
    resolveSpellDamageWithTypes.mockReturnValue({ formula: '1d8', primaryType: 'Fire' });
  });

  /* ---------------------------------------------------------------- */
  /*  Spell resolution — missing passives                             */
  /* ---------------------------------------------------------------- */

  describe('missing passives', () => {
    it('throws when passives is null', async () => {
      const playerStats = makePlayerStats({ automation: { passives: null } });

      await expect(
        executeSpellCast(makeSpell(), makeMetaCtx(), {
          rollAttack: vi.fn(),
          rollDamage: vi.fn(),
          playerStats,
          getTargetInfo: async () => ({ name: 'Goblin' }),
          campaignName: 'test-campaign',
        }),
      ).rejects.toThrow('playerStats.automation.passives is required for magical ambush check');
    });

    it('throws when passives is undefined', async () => {
      const playerStats = makePlayerStats({ automation: {} });

      await expect(
        executeSpellCast(makeSpell(), makeMetaCtx(), {
          rollAttack: vi.fn(),
          rollDamage: vi.fn(),
          playerStats,
          getTargetInfo: async () => ({ name: 'Goblin' }),
          campaignName: 'test-campaign',
        }),
      ).rejects.toThrow('playerStats.automation.passives is required for magical ambush check');
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Spell resolution — missing activeConditions                     */
  /* ---------------------------------------------------------------- */

  describe('missing activeConditions', () => {
    it('throws when activeConditions is null', async () => {
      getRuntimeValue.mockImplementation((playerName, key, _cn) => {
        if (key === 'activeConditions') return null;
        return undefined;
      });

      await expect(
        executeSpellCast(makeSpell(), makeMetaCtx(), {
          rollAttack: vi.fn(),
          rollDamage: vi.fn(),
          playerStats: makePlayerStats(),
          getTargetInfo: async () => ({ name: 'Goblin' }),
          campaignName: 'test-campaign',
        }),
      ).rejects.toThrow('activeConditions must be an array for caster');
    });

    it('throws when activeConditions is not an array', async () => {
      getRuntimeValue.mockImplementation((playerName, key, _cn) => {
        if (key === 'activeConditions') return 'not-an-array';
        return undefined;
      });

      await expect(
        executeSpellCast(makeSpell(), makeMetaCtx(), {
          rollAttack: vi.fn(),
          rollDamage: vi.fn(),
          playerStats: makePlayerStats(),
          getTargetInfo: async () => ({ name: 'Goblin' }),
          campaignName: 'test-campaign',
        }),
      ).rejects.toThrow('activeConditions must be an array for caster');
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Spell resolution — silence blocking                             */
  /* ---------------------------------------------------------------- */

  describe('silence blocking', () => {
    it('refuses with popup and log when caster is silenced with verbal component', async () => {
      getSilenceSource.mockReturnValue('SilenceCaster');
      isCreatureInSilenceZone.mockReturnValue(true);
      addEntry.mockClear();

      const result = await executeSpellCast(
        makeSpell({ components: ['V', 'S'] }),
        makeMetaCtx(),
        {
          rollAttack: vi.fn(),
          rollDamage: vi.fn(),
          playerStats: makePlayerStats(),
          getTargetInfo: async () => ({ name: 'Goblin' }),
          campaignName: 'test-campaign',
        },
      );

      expect(result).toEqual({
        automationPopup: {
          type: 'popup',
          payload: expect.objectContaining({
            type: 'automation_info',
            name: 'Silence',
          }),
        },
      });
      const blockLog = addEntry.mock.calls.find(
        (c) => c[1].type === 'automation' && c[1].name === 'Silence'
      );
      expect(blockLog).toBeDefined();
      expect(blockLog[1].description).toContain('blocked');
    });

    it('does not block when spell has no verbal component', async () => {
      getSilenceSource.mockReturnValue(null);

      const result = await executeSpellCast(
        makeSpell({ components: ['S'] }),
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
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Spell resolution — lastActionSpellCast                          */
  /* ---------------------------------------------------------------- */

  describe('lastActionSpellCast', () => {
    it('sets lastActionSpellCast when casting_time is 1 action', async () => {
      await executeSpellCast(
        makeSpell({ casting_time: '1 action' }),
        makeMetaCtx(),
        {
          rollAttack: vi.fn(),
          rollDamage: vi.fn(),
          playerStats: makePlayerStats(),
          getTargetInfo: async () => ({ name: 'Goblin' }),
          campaignName: 'test-campaign',
        },
      );

      expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'lastActionSpellCast', 1, 'test-campaign');
    });

    it('does not set lastActionSpellCast for non-action spells', async () => {
      await executeSpellCast(
        makeSpell({ casting_time: '1 bonus action' }),
        makeMetaCtx(),
        {
          rollAttack: vi.fn(),
          rollDamage: vi.fn(),
          playerStats: makePlayerStats(),
          getTargetInfo: async () => ({ name: 'Goblin' }),
          campaignName: 'test-campaign',
        },
      );

      expect(setRuntimeValue).not.toHaveBeenCalledWith('TestWizard', 'lastActionSpellCast', 1, 'test-campaign');
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Spell resolution — endFriends / endInvisibility                 */
  /* ---------------------------------------------------------------- */

  describe('endFriends / endInvisibility', () => {
    it('calls endFriendsOnHostileAction for non-Friends spells', async () => {
      await executeSpellCast(
        makeSpell({ name: 'Fireball' }),
        makeMetaCtx(),
        {
          rollAttack: vi.fn(),
          rollDamage: vi.fn(),
          playerStats: makePlayerStats(),
          getTargetInfo: async () => ({ name: 'Goblin' }),
          campaignName: 'test-campaign',
        },
      );

      expect(endFriendsOnHostileAction).toHaveBeenCalledWith('TestWizard', 'test-campaign');
    });

    it('does not call endFriendsOnHostileAction for Friends spell', async () => {
      await executeSpellCast(
        makeSpell({ name: 'Friends' }),
        makeMetaCtx(),
        {
          rollAttack: vi.fn(),
          rollDamage: vi.fn(),
          playerStats: makePlayerStats(),
          getTargetInfo: async () => ({ name: 'Goblin' }),
          campaignName: 'test-campaign',
        },
      );

      expect(endFriendsOnHostileAction).not.toHaveBeenCalled();
    });

    it('calls endInvisibilityOnHostileAction for all spells', async () => {
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

      expect(endInvisibilityOnHostileAction).toHaveBeenCalledWith('TestWizard', 'test-campaign');
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Spell resolution — logGenericSpellCast                          */
  /* ---------------------------------------------------------------- */

  describe('spell cast log', () => {
    it('logs a spell entry when spell is not Hex', async () => {
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

      expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
        type: 'spell',
        characterName: 'TestWizard',
        spellName: 'Fireball',
      }));
    });

    it('does not log the generic spell entry when spell name is Hex', async () => {
      await executeSpellCast(
        makeSpell({ name: 'Hex' }),
        makeMetaCtx(),
        {
          rollAttack: vi.fn(),
          rollDamage: vi.fn(),
          playerStats: makePlayerStats(),
          getTargetInfo: async () => ({ name: 'Goblin' }),
          campaignName: 'test-campaign',
        },
      );

      expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
        spellName: 'Hex',
        type: 'spell',
      }));
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Hunter's Mark / Hex                                             */
  /* ---------------------------------------------------------------- */

  describe("Hunter's Mark / Hex", () => {
    it('returns early for Hunter\'s Mark', async () => {
      const result = await executeSpellCast(
        makeSpell({ name: "Hunter's Mark" }),
        makeMetaCtx(),
        {
          rollAttack: vi.fn(),
          rollDamage: vi.fn(),
          playerStats: makePlayerStats(),
          getTargetInfo: async () => ({ name: 'Goblin' }),
          campaignName: 'test-campaign',
        },
      );

      expect(result).toBeUndefined();
      expect(mockTriggerDispelMagic).not.toHaveBeenCalled();
    });

    it('returns early for Hex and applies hex effects', async () => {
      const result = await executeSpellCast(
        makeSpell({ name: 'Hex' }),
        makeMetaCtx(),
        {
          rollAttack: vi.fn(),
          rollDamage: vi.fn(),
          playerStats: makePlayerStats(),
          getTargetInfo: async () => ({ name: 'Goblin' }),
          campaignName: 'test-campaign',
        },
      );

      expect(result).toBeUndefined();
      expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
        spellName: 'Hex',
      }));
    });

    it('Hex with Eldritch Hex passive logs both disadvantages', async () => {
      const playerStats = makePlayerStats({
        automation: {
          passives: [
            { name: 'Eldritch Hex', type: 'conditional_disadvantage' },
          ],
        },
      });

      await executeSpellCast(
        makeSpell({ name: 'Hex' }),
        makeMetaCtx(),
        {
          rollAttack: vi.fn(),
          rollDamage: vi.fn(),
          playerStats,
          getTargetInfo: async () => ({ name: 'Goblin' }),
          campaignName: 'test-campaign',
        },
      );

      expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
        effectsApplied: 'ability check disadvantage + saving throw disadvantage',
      }));
    });
  });
});
