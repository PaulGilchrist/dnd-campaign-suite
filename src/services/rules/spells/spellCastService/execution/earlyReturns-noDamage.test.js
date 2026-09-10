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
  handleGenericAutomation: vi.fn(() => Promise.resolve({ handled: false })),
  handleAnimalFriendship: vi.fn(() => Promise.resolve({ handled: false })),
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
const { handleFear: mockFear, handleConjureVolley: mockConjureVolley, handleSilence: mockSilence } = await import('./modalSpells.js');
const {
  handleRegenerate: mockRegenerate,
  handleSeeInvisibility: mockSeeInvisibility,
  handleFleshToStone: mockFleshToStone,
  handleHoldMonster: mockHoldMonster,
  handleBanishment: mockBanishment,
  handleConfusion: mockConfusion,
  handleMaze: mockMaze,
  handlePowerWordStun: mockPowerWordStun,
  handleHypnoticPattern: mockHypnoticPattern,
  handleSlow: mockSlow,
  handleBane: mockBane,
  handleBless: mockBless,
  handleBeaconOfHope: mockBeaconOfHope,
  handleMassSuggestion: mockMassSuggestionTrigger,
  handleSuggestion: mockSuggestion,
  handleOttoDance: mockOttoDance,
  handleResilientSphere: mockResilientSphere,
  handleBlur: mockBlur,
  handleExpeditiousRetreat: mockExpeditiousRetreat,
  handleFriends: mockFriends,
  handleCrownOfMadness: mockCrownOfMadness,
} = await import('./triggerSpells.js');

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

function resetAllMocks() {
  vi.clearAllMocks();
  getRuntimeValue.mockReturnValue([]);
  resolveSpellDamageWithTypes.mockReturnValue({ formula: '1d8', primaryType: 'Fire' });
  mockRegenerate.mockResolvedValue({ handled: false });
  mockFear.mockReturnValue({ handled: false });
  mockConjureVolley.mockReturnValue({ handled: false });
  mockSilence.mockReturnValue({ handled: false });
  mockSeeInvisibility.mockResolvedValue({ handled: false });
  mockFleshToStone.mockResolvedValue({ handled: false });
  mockHoldMonster.mockResolvedValue({ handled: false });
  mockBanishment.mockResolvedValue({ handled: false });
  mockConfusion.mockResolvedValue({ handled: false });
  mockMaze.mockResolvedValue({ handled: false });
  mockPowerWordStun.mockResolvedValue({ handled: false });
  mockHypnoticPattern.mockResolvedValue({ handled: false });
  mockSlow.mockResolvedValue({ handled: false });
  mockBane.mockResolvedValue({ handled: false });
  mockBless.mockResolvedValue({ handled: false });
  mockBeaconOfHope.mockResolvedValue({ handled: false });
  mockMassSuggestionTrigger.mockResolvedValue({ handled: false });
  mockSuggestion.mockResolvedValue({ handled: false });
  mockOttoDance.mockResolvedValue({ handled: false });
  mockResilientSphere.mockResolvedValue({ handled: false });
  mockBlur.mockResolvedValue({ handled: false });
  mockExpeditiousRetreat.mockResolvedValue({ handled: false });
  mockFriends.mockResolvedValue({ handled: false });
  mockCrownOfMadness.mockResolvedValue({ handled: false });
}

function makeExecuteArgs(spellName) {
  return [
    makeSpell({ name: spellName }),
    makeMetaCtx(),
    {
      rollAttack: vi.fn(),
      rollDamage: vi.fn(),
      playerStats: makePlayerStats(),
      getTargetInfo: async () => ({ name: 'Goblin' }),
      campaignName: 'test-campaign',
    },
  ];
}

/* Early-return spells that resolve to null damage and call their handler */
const noDamageSpells = [
  { name: 'Regenerate', mock: mockRegenerate, expectResult: { healed: 10 }, resultOverride: { handled: true, result: { healed: 10 } }, sync: false },
  { name: 'Fear', mock: mockFear, expectResult: { automationPopup: { type: 'modal' } }, resultOverride: { handled: true, result: { automationPopup: { type: 'modal' } } }, sync: true },
  { name: 'Conjure Volley', mock: mockConjureVolley, expectResult: { automationPopup: { type: 'popup' } }, resultOverride: { handled: true, result: { automationPopup: { type: 'popup' } } }, sync: true },
  { name: 'See Invisibility', mock: mockSeeInvisibility, expectResult: undefined, resultOverride: { handled: true } },
  { name: 'Flesh to Stone', mock: mockFleshToStone, expectResult: undefined, resultOverride: { handled: true } },
  { name: 'Hold Monster', mock: mockHoldMonster, expectResult: undefined, resultOverride: { handled: true } },
  { name: 'Banishment', mock: mockBanishment, expectResult: undefined, resultOverride: { handled: true } },
  { name: 'Confusion', mock: mockConfusion, expectResult: undefined, resultOverride: { handled: true } },
  { name: 'Maze', mock: mockMaze, expectResult: undefined, resultOverride: { handled: true } },
  { name: 'Power Word Stun', mock: mockPowerWordStun, expectResult: { automationPopup: { type: 'popup' } }, resultOverride: { handled: true, result: { automationPopup: { type: 'popup' } } } },
  { name: 'Hypnotic Pattern', mock: mockHypnoticPattern, expectResult: undefined, resultOverride: { handled: true } },
  { name: 'Slow', mock: mockSlow, expectResult: undefined, resultOverride: { handled: true } },
  { name: 'Bane', mock: mockBane, expectResult: undefined, resultOverride: { handled: true } },
  { name: 'Bless', mock: mockBless, expectResult: undefined, resultOverride: { handled: true } },
  { name: 'Beacon of Hope', mock: mockBeaconOfHope, expectResult: undefined, resultOverride: { handled: true } },
  { name: 'Mass Suggestion', mock: mockMassSuggestionTrigger, expectResult: undefined, resultOverride: { handled: true } },
  { name: 'Suggestion', mock: mockSuggestion, expectResult: undefined, resultOverride: { handled: true } },
  { name: "Otto's Irresistible Dance", mock: mockOttoDance, expectResult: undefined, resultOverride: { handled: true } },
  { name: "Otiluke's Resilient Sphere", mock: mockResilientSphere, expectResult: undefined, resultOverride: { handled: true } },
  { name: 'Blur', mock: mockBlur, expectResult: undefined, resultOverride: { handled: true } },
  { name: 'Expeditious Retreat', mock: mockExpeditiousRetreat, expectResult: undefined, resultOverride: { handled: true } },
  { name: 'Friends', mock: mockFriends, expectResult: { automationPopup: { type: 'popup' } }, resultOverride: { handled: true, result: { automationPopup: { type: 'popup' } } } },
  { name: 'Crown of Madness', mock: mockCrownOfMadness, expectResult: { automationPopup: { type: 'popup' } }, resultOverride: { handled: true, result: { automationPopup: { type: 'popup' } } } },
];

describe('executeSpellCast — early returns (no damage path)', () => {
  beforeEach(resetAllMocks);

  describe('no damage path — general spells', () => {
    for (const spell of noDamageSpells) {
      it(`returns early when ${spell.name} is handled`, async () => {
        resolveSpellDamageWithTypes.mockReturnValue(null);
        if (spell.sync) {
          spell.mock.mockReturnValue(spell.resultOverride);
        } else {
          spell.mock.mockResolvedValue(spell.resultOverride);
        }

        const result = await executeSpellCast(
          ...makeExecuteArgs(spell.name),
        );

        expect(result).toEqual(spell.expectResult);
      });
    }
  });
});
