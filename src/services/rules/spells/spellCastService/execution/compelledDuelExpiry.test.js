// @maintained-by-ai
// SP-026 lane: the Compelled Duel EXPIRY caller edge on executeSpellCast's damage lane
// (execution/index.js:643/731 expireCompelledDuelOnHarmfulCast). Raw break rule (5e +
// 2024 spells.json, identical text): "The spell ends if ... you cast a spell on an enemy
// other than the target". Expiry seam: cast-time break at the pre-range choke point —
// NO wall-clock: duration is concentration/combat-scoped, and checkCompelledDuelAttackExpiry
// fires BEFORE computeRange so even an auto-miss hostile cast breaks the duel.
// Body ownership split (do not duplicate here):
//  - checkCompelledDuelAttackExpiry/endCompelledDuel guard logic + store writes:
//    compelledDuelHandler.test.js (handler lane).
//  - triggerSpells.js:292/305/318 dominate/ray call sites + invocationCallOrder-before-trigger:
//    spellCastService.noformula-utility.test.js / .noformula-services.test.js.
//  - cast-time duel stamp (addExpiration te, concentration): compelledDuelService.test.js
//    + compelledDuelHandler.test.js:163-218.
// This lane runs the REAL handler via an importActual spy so the end-to-end caller→body
// contract (exact arg tuple, formula gate, te removal payload incl. skipSync, removed log)
// is verified, and pins source-keyed te filtering with a same-effect duel from ANOTHER
// caster in the store. Mocks mirror earlyReturns-generic.test.js.
import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ------------------------------------------------------------------ */
/*  Mocks — all dependencies of execution/index.js                     */
/* ------------------------------------------------------------------ */

vi.mock('../../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../automation/index.js', () => ({
  executeHandler: vi.fn(),
}));

vi.mock('../../../../automation/handlers/spells/compelledDuelHandler.js', async (importActual) => {
  const actual = await importActual();
  return { ...actual, checkCompelledDuelAttackExpiry: vi.fn(actual.checkCompelledDuelAttackExpiry) };
});

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

vi.mock('../../../features/inspiringSmiteService.js' , () => ({
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

vi.mock('../../../combat/buffs/buffService.js', () => ({
  isInnateSorceryActive: vi.fn(() => false),
}));

vi.mock('../../../core/spellDamageUtils.js', () => ({
  resolveSpellDamageWithTypes: vi.fn(() => ({ formula: '1d8', primaryType: 'Fire' })),
}));

vi.mock('../../../features/confusionService.js', () => ({
  triggerConfusion: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
  markFortifiedHealthUsedIfGranted: vi.fn(),
  resolveHealingBonusesWithDetails: vi.fn(() => ({ totalBonus: 0, details: [] })),
  hasHealingMaximizationForTarget: vi.fn(() => false),
  hasRerollHealingOnes: vi.fn(() => false),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
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

// Correct path: execution/index.js imports src/services/encounters/combatData.js
// ('../../../../../services/encounters/...'); the old mock ('../../../../services/...')
// resolved nowhere and was never applied — the real module loaded instead.
vi.mock('../../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
}));

/* ------------------------------------------------------------------ */
/*  SUT import after mocks                                             */
/* ------------------------------------------------------------------ */

import { executeSpellCast } from './index.js';

const { getRuntimeValue, setRuntimeValue } = await import('../../../../../hooks/runtime/useRuntimeState.js');
const { addEntry } = await import('../../../../ui/logService.js');
const { checkCompelledDuelAttackExpiry } = await import('../../../../automation/handlers/spells/compelledDuelHandler.js');
const { resolveSpellDamageWithTypes } = await import('../../../core/spellDamageUtils.js');
const { computeRange } = await import('./damageCalculation.js');

/* ------------------------------------------------------------------ */
/*  Factories                                                          */
/* ------------------------------------------------------------------ */

const CAMPAIGN = 'test-campaign';
const CASTING = { name: 'TestWizard', proficiency: 4, spellAbilities: { saveDc: 17, modifier: 5 }, automation: { passives: [] }, hitPoints: 100, level: 10 };
const DUEL_TE = { target: 'Bandit 1', effect: 'compelled_duel', source: 'TestWizard', duration: 'concentration' };
// Same effect, different source+target — must survive the duel-break filter untouched.
const OTHER_CASTER_DUEL_TE = { target: 'Bandit 2', effect: 'compelled_duel', source: 'OtherPaladin', duration: 'concentration' };

let teState = [];

function services(targetName) {
  return {
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    playerStats: CASTING,
    getTargetInfo: async () => (targetName ? { name: targetName } : null),
    campaignName: CAMPAIGN,
  };
}

function harmfulSpell() {
  return { name: 'Fire Bolt', level: 0, baseLevel: 0, damage: { damage_type: 'Fire' } };
}

function utilitySpell() {
  return { name: 'Guidance', level: 0, baseLevel: 0 };
}

const teWrites = () => setRuntimeValue.mock.calls.filter(c => c[1] === 'targetEffects');
const removedLogs = () => addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'condition' && e.action === 'removed');

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('executeSpellCast — SP-026 Compelled Duel expiry hook on the damage lane', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    teState = [OTHER_CASTER_DUEL_TE, DUEL_TE];
    getRuntimeValue.mockImplementation((_scope, key) => (key === 'targetEffects' ? teState : []));
    resolveSpellDamageWithTypes.mockReturnValue({ formula: '1d8', primaryType: 'Fire' });
    computeRange.mockReturnValue({});
  });

  it('breaks the caster\'s duel on a harmful spell cast at a NON-duel enemy: exact tuple, skipSync te write preserving other casters\' duels, removed log keyed to the duel target', async () => {
    await executeSpellCast(harmfulSpell(), { targetName: 'Bandit 2' }, services('Bandit 2'));

    expect(checkCompelledDuelAttackExpiry).toHaveBeenCalledTimes(1);
    expect(checkCompelledDuelAttackExpiry).toHaveBeenCalledWith('TestWizard', 'Bandit 2', CAMPAIGN);

    // Full-set te write: exactly one write, exact payload (other caster's duel survives),
    // skipSync=true, fresh array (not the stored one).
    expect(teWrites()).toEqual([['campaign', 'targetEffects', [OTHER_CASTER_DUEL_TE], CAMPAIGN, true]]);
    expect(teWrites()[0][2]).not.toBe(teState);

    // Exactly one condition-removed log: characterName is the DUEL target (Bandit 1),
    // the note names the attacked creature (Bandit 2) that broke the duel.
    const removed = removedLogs();
    expect(removed).toHaveLength(1);
    const { timestamp, ...entry } = removed[0];
    expect(Number.isFinite(timestamp)).toBe(true);
    expect(entry).toEqual({
      type: 'condition',
      action: 'removed',
      characterName: 'Bandit 1',
      condition: 'Compelled Duel',
      reason: 'Compelled Duel ended',
      note: 'TestWizard attacked or forced a saving throw against Bandit 2 instead of the duel target.',
    });
  });

  it('breaks the duel before range adjudication — an out-of-range (auto-miss) hostile cast still ends it (expiry invocation precedes computeRange)', async () => {
    computeRange.mockReturnValue({ isAutoMiss: true, rangeReason: 'out of range' });

    await executeSpellCast(harmfulSpell(), { targetName: 'Bandit 2' }, services('Bandit 2'));

    expect(checkCompelledDuelAttackExpiry).toHaveBeenCalledWith('TestWizard', 'Bandit 2', CAMPAIGN);
    expect(checkCompelledDuelAttackExpiry.mock.invocationCallOrder[0])
      .toBeLessThan(computeRange.mock.invocationCallOrder[0]);
    expect(teWrites()).toEqual([['campaign', 'targetEffects', [OTHER_CASTER_DUEL_TE], CAMPAIGN, true]]);
  });

  it('leaves the duel state untouched when the harmful spell targets the duel target itself, and when no duel is active', async () => {
    // Arm 1: duel active, spell hits the duel target itself — check fires, body no-ops.
    await executeSpellCast(harmfulSpell(), { targetName: 'Bandit 1' }, services('Bandit 1'));

    expect(checkCompelledDuelAttackExpiry).toHaveBeenCalledTimes(1);
    expect(checkCompelledDuelAttackExpiry).toHaveBeenCalledWith('TestWizard', 'Bandit 1', CAMPAIGN);
    expect(teWrites()).toEqual([]);
    expect(removedLogs()).toEqual([]);

    // Arm 2: no compelled_duel te from this caster in the store — check fires, no-op.
    vi.clearAllMocks();
    teState = [OTHER_CASTER_DUEL_TE];
    await executeSpellCast(harmfulSpell(), { targetName: 'Bandit 2' }, services('Bandit 2'));

    expect(checkCompelledDuelAttackExpiry).toHaveBeenCalledTimes(1);
    expect(checkCompelledDuelAttackExpiry).toHaveBeenCalledWith('TestWizard', 'Bandit 2', CAMPAIGN);
    expect(teWrites()).toEqual([]);
    expect(removedLogs()).toEqual([]);
  });

  it('never reaches the expiry hook for a spell with no damage formula (no-damage lane keeps the duel intact)', async () => {
    resolveSpellDamageWithTypes.mockReturnValue({ formula: null, primaryType: null });

    await executeSpellCast(utilitySpell(), { targetName: 'Bandit 2' }, services('Bandit 2'));

    expect(checkCompelledDuelAttackExpiry).not.toHaveBeenCalled();
    expect(teWrites()).toEqual([]);
    expect(removedLogs()).toEqual([]);
  });
});
