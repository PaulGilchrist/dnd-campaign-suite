// @maintained-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import spells5e from '../../../../../../public/data/spells.json';
import spells2024 from '../../../../../../public/data/2024/spells.json';

/* ------------------------------------------------------------------ */
/*  CLA-389 owner lane: runPostCastTriggersMerged (:597-:601) and    */
/*  its call sites :720/:727/:751/:759 + the fix#121(a) :712 early-  */
/*  chain merge — the post-payment rider seam (#1470/#1472/#1473).   */
/*  The :712 early-chain bypass that kept riders structurally         */
/*  unreachable on consumed casts (#1455 🔴) is FIXED by fix#121(a):  */
/*  consumed casts merge once here; the per-arm pins live in          */
/*  earlyReturns-generic.test.js/:712 + earlyReturns-modal.test.js.  */
/*  Cross-file REPORT (not touched): the merged auto-miss/tail lanes */
/*  in execution-post-cast.test.js use bare toHaveBeenCalled() and   */
/*  own the sanctuary-pair + CLA-200 tail faces (:492/:572-:635).   */
/*  #1455 dedupe FIXED (fix#121(b)): producers flag healRidersRun   */
/*  ('pair' from runGenericHealPath :470/:473, 'self' from the       */
/*  massHealUtils.confirmFn-routed automations at :710/:329) and      */
/*  runPostCastTriggers defers exactly those legs — every heal rider  */
/*  lands EXACTLY ONCE per cast; merge-only riders stay single-fire. */
/*  Kill-matrix: M1 merge skipped at :712/:720/:727/:751/:759 ->     */
/*  surge times(0)+result-identity flips fail; M2 rider reorder inside */
/*  :505-:556 -> invocationCallOrder ascension fails; M3 swallow<->   */
/*  passThrough swap on :299 -> laneValue undefined vs popup flips;   */
/*  M4 hasVisibleCastPayload drop of targetName check (:587) -> T4    */
/*  result identity flips to surge; M5 :514 Hex/HM skip removed ->    */
/*  applyHexEffects times(0) pin fails; M6 heal-rider guard removed   */
/*  -> T4 self/ally times(1) pins fail loudly (fix#121(b)). No game   */
/*  clocks anywhere (surge fires only at the cast seam; rest-seam      */
/*  owners #1302-#1312).                                                */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Mocks — every direct import of execution/index.js, at REAL path  */
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
}));

vi.mock('../../../../automation/handlers/spells/compelledDuelHandler.js', () => ({
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
  resolveSpellDamageWithTypes: vi.fn(() => ({ formula: null, primaryType: null })),
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
const { checkCompelledDuelAttackExpiry } = await import('../../../../automation/handlers/spells/compelledDuelHandler.js');
const { handleSavePath: mockHandleSavePath } = await import('./savePath.js');
const { handleNoSavePath: mockHandleNoSavePath } = await import('./noSavePath.js');
const { resolveSpellDamageWithTypes } = await import('../../../core/spellDamageUtils.js');
const { computeRange } = await import('./damageCalculation.js');
const { handleExpeditiousRetreat: mockHandleExpeditiousRetreat } = await import('./triggerSpells.js');
const { triggerPostCastSelfHeals, triggerPostCastAllyHeals } = await import('../../../../rules/spells/postCastHealService.js');
const { triggerSmiteOfProtection } = await import('../../../features/smiteOfProtectionService.js');
const { triggerInspiringSmite } = await import('../../../features/inspiringSmiteService.js');
const { triggerPrimalCompanionSpellShare } = await import('../../../features/primalCompanionSpellShareService.js');
const { triggerWildMagicSurge: mockTriggerWildMagicSurge } = await import('../../../features/wildMagicSurgeService.js');
const { triggerPostCastRiderSaves, triggerSpellThief, triggerBewitchingMagic } = await import('../../../../rules/spells/postCastRiderService.js');
const { applyHexEffects, triggerExpertDivination, triggerArcaneWard } = await import('./helpers.js');
const { triggerHealingWord } = await import('../../../features/healingWordService.js');
const { endSanctuary } = await import('../../../../automation/handlers/spells/sanctuaryHandler.js');
const { applyHealingToTarget } = await import('../../../combat/applyHealing.js');

/* ------------------------------------------------------------------ */
/*  Fixtures — REAL disk bytes both rulesets via URL-aware fetch     */
/*  stub (#1365-form); campaign locked to 'test-campaign'.            */
/* ------------------------------------------------------------------ */

function diskRow(spells, name) {
  const row = spells.find(s => s.name === name);
  if (!row) throw new Error(`disk row missing: ${name}`);
  return row;
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

// Wild Magic nat-11 refusal popup (surge rolled, gate declined) — the
// refusal arm post-payment lane value (#1472 form).
const GATE_POPUP = {
  type: 'popup',
  payload: {
    type: 'automation_info',
    name: 'Wild Magic Surge',
    description: 'Wild Magic Surge: Rolled 11 (not a 20). No surge occurs.',
  },
};

const SURGE_MODAL = { type: 'modal', modalName: 'wildMagicSurge', payload: { mode: 'roll', roll: 55 } };

// Ascending-order census helper: the recorded invocationCallOrder stream
// must equal its own sorted copy — order-stable dispatch (#1384/#1385 form).
const ascends = (ids) => expect(ids).toEqual([...ids].sort((a, b) => a - b));

describe('executeSpellCast CLA-389 runPostCastTriggersMerged (:597) — post-payment rider seam at :720/:727/:751/:759', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn(async (url) => ({
      ok: true,
      json: async () => (String(url).includes('/2024/') ? spells2024 : spells5e),
    })));
    getRuntimeValue.mockReturnValue([]);
    setRuntimeValue.mockResolvedValue(undefined);
    addEntry.mockResolvedValue(undefined);
    mockHandleSavePath.mockResolvedValue(null);
    mockHandleNoSavePath.mockResolvedValue(null);
    mockHandleExpeditiousRetreat.mockResolvedValue({ handled: false });
    mockTriggerWildMagicSurge.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it(':720 no-damage handled lane — swallow-exit runs the FULL merged rider block once, post-payment, with exact tuples, on REAL disk rows both rulesets, and the surge popup surfaces (both rulesets)', async () => {
    for (const rules of ['5e', '2024']) {
      vi.clearAllMocks();
      const spells = rules === '2024' ? spells2024 : spells5e;
      const spell = diskRow(spells, 'Expeditious Retreat');
      const playerStats = makePlayerStats(rules === '2024' ? { rules: '2024' } : {});
      resolveSpellDamageWithTypes.mockReturnValue({ formula: null, primaryType: null });
      mockHandleExpeditiousRetreat.mockResolvedValue({ handled: true }); // :299 swallow → laneValue undefined
      mockTriggerWildMagicSurge.mockResolvedValue(GATE_POPUP);
      const metaCtx = { slotLevel: 1 };
      const rollDamage = vi.fn();
      const getTargetInfo = async () => null;

      const result = await executeSpellCast(spell, metaCtx, {
        rollAttack: vi.fn(), rollDamage, playerStats, getTargetInfo, campaignName: 'test-campaign',
      });

      const stamped = { slotLevel: 1, metamagicHeighten: false };
      // Lane consumed, then every rider fires with its REAL arity tuple.
      expect(mockHandleExpeditiousRetreat).toHaveBeenCalledTimes(1);
      expect(mockHandleExpeditiousRetreat).toHaveBeenCalledWith(spell, stamped, playerStats, 'test-campaign', undefined);
      expect(triggerPostCastRiderSaves).toHaveBeenCalledWith(spell, stamped, playerStats, 'test-campaign', undefined);
      expect(applyHexEffects).toHaveBeenCalledWith(spell, playerStats, 'test-campaign', undefined, undefined);
      expect(triggerPostCastSelfHeals).toHaveBeenCalledWith(spell, { ...stamped, targetNames: undefined }, playerStats, 'test-campaign', undefined);
      expect(triggerPostCastAllyHeals).toHaveBeenCalledWith(spell, stamped, playerStats, 'test-campaign', undefined);
      expect(triggerSmiteOfProtection).toHaveBeenCalledWith(spell, stamped, playerStats, 'test-campaign', undefined);
      expect(triggerInspiringSmite).toHaveBeenCalledWith(spell, stamped, playerStats, 'test-campaign', undefined);
      expect(triggerPrimalCompanionSpellShare).toHaveBeenCalledWith(spell, stamped, playerStats, 'test-campaign', undefined);
      expect(triggerSpellThief).toHaveBeenCalledWith(spell, stamped, playerStats, 'test-campaign', undefined);
      expect(mockTriggerWildMagicSurge).toHaveBeenCalledWith(spell, stamped, playerStats, 'test-campaign', undefined);
      expect(triggerBewitchingMagic).toHaveBeenCalledWith(spell, stamped, playerStats, 'test-campaign', undefined);
      expect(triggerExpertDivination).toHaveBeenCalledWith(spell, stamped, playerStats, 'test-campaign', undefined);
      expect(triggerArcaneWard).toHaveBeenCalledWith(spell, stamped, playerStats, 'test-campaign'); // :550 arity-4 vs REAL
      // One-shot per lane exit (:1472 surge-exactly-once-after-arm).
      expect(mockHandleExpeditiousRetreat).toHaveBeenCalledTimes(1);
      expect(mockTriggerWildMagicSurge).toHaveBeenCalledTimes(1);
      expect(triggerPostCastSelfHeals).toHaveBeenCalledTimes(1); // no producer on this lane — no double-fire
      expect(triggerPostCastAllyHeals).toHaveBeenCalledTimes(1);
      // Rider seam: lane consumes BEFORE any rider runs; canonical :506-:550 order.
      ascends([
        mockHandleExpeditiousRetreat, triggerPostCastRiderSaves, applyHexEffects,
        triggerPostCastSelfHeals, triggerPostCastAllyHeals, triggerSmiteOfProtection,
        triggerInspiringSmite, triggerPrimalCompanionSpellShare, triggerSpellThief,
        mockTriggerWildMagicSurge, triggerBewitchingMagic, triggerExpertDivination, triggerArcaneWard,
      ].map(m => m.mock.invocationCallOrder[0]));
      // Unreached lanes stay dead.
      expect(mockHandleSavePath).toHaveBeenCalledTimes(0);
      expect(mockHandleNoSavePath).toHaveBeenCalledTimes(0);
      expect(rollDamage).toHaveBeenCalledTimes(0);
      expect(triggerHealingWord).toHaveBeenCalledTimes(0); // :341 — chain exited at :323
      expect(checkCompelledDuelAttackExpiry).toHaveBeenCalledTimes(0);
      expect(endSanctuary).toHaveBeenCalledTimes(0); // targetEffects [] — no sanctuary to end
      // laneValue undefined → :599 true branch: surge popup surfaces verbatim.
      expect(result).toBe(GATE_POPUP);
      // Caller metaCtx purity (:680 clones at the chokepoint).
      expect(metaCtx).toEqual({ slotLevel: 1 });
    }
  });

  it(':759 save-path lane precedence — a visible picker outranks the surge (:599 false branch) and a payload-less lane result surrenders to the surge modal (:599 true branch)', async () => {
    resolveSpellDamageWithTypes.mockReturnValue({ formula: '3d8', primaryType: 'Fire' }); // disk Burn Hands L1 bytes
    const spell = diskRow(spells5e, 'Burning Hands');
    const playerStats = makePlayerStats();
    // :741 stamps before :759; the empower/blessed/radiant mocks pass null through,
    // so finalFormula is null at this seam — documented REAL merge-face bytes.
    const stamped = { slotLevel: 1, metamagicHeighten: false, finalFormula: null, featsOfChaosArmedAtCast: false };
    const cast = async () => executeSpellCast(spell, { slotLevel: 1 }, {
      rollAttack: vi.fn(),
      rollDamage: vi.fn(),
      playerStats,
      getTargetInfo: async () => ({ name: 'Goblin' }),
      campaignName: 'test-campaign',
    });

    // Cast A — picker modal outranks the surge (two modals cannot stack).
    const pickerResult = { automationPopup: { type: 'modal', modalName: 'saveAttackAoe', payload: { shape: 'cone' } } };
    mockHandleSavePath.mockResolvedValue(pickerResult);
    mockTriggerWildMagicSurge.mockResolvedValue(GATE_POPUP);
    const resultA = await cast();
    expect(mockHandleSavePath).toHaveBeenCalledTimes(1);
    expect(resultA).toBe(pickerResult);
    expect(mockTriggerWildMagicSurge).toHaveBeenCalledTimes(1); // gate still rolled + logged, popup suppressed
    expect(mockTriggerWildMagicSurge).toHaveBeenCalledWith(spell, stamped, playerStats, 'test-campaign', undefined);
    expect(mockHandleNoSavePath).toHaveBeenCalledTimes(0); // dc present — branches mutually exclusive

    // Cast B — lane returned non-null but INVISIBLE (:583-:589 all false) → surge wins.
    vi.clearAllMocks();
    mockHandleSavePath.mockResolvedValue({ info: true });
    mockTriggerWildMagicSurge.mockResolvedValue(SURGE_MODAL);
    const resultB = await cast();
    expect(mockHandleSavePath).toHaveBeenCalledTimes(1);
    expect(resultB).toBe(SURGE_MODAL);
    expect(mockTriggerWildMagicSurge).toHaveBeenCalledTimes(1);
    expect(mockHandleNoSavePath).toHaveBeenCalledTimes(0);
  });

  it('undefined-exiting lanes still pop the gate — :727 Hunter\'s Mark (zero hex writes) and :751 auto-miss (zero-damage roll bytes) both surface the surge popup on laneValue undefined (:599)', async () => {
    // Lane :727 — Hunter's Mark is consumed by runMarkedTargetSpell BEFORE the
    // damage path; laneValue undefined, yet the merged block runs and pops.
    resolveSpellDamageWithTypes.mockReturnValue({ formula: null, primaryType: null }); // disk HM has no damage
    mockTriggerWildMagicSurge.mockResolvedValue(GATE_POPUP);
    const hm = diskRow(spells5e, "Hunter's Mark");
    const playerStats = makePlayerStats();
    const rollDamage = vi.fn();
    const resultHM = await executeSpellCast(hm, { slotLevel: 1 }, {
      rollAttack: vi.fn(), rollDamage, playerStats, getTargetInfo: async () => ({ name: 'Goblin' }), campaignName: 'test-campaign',
    });
    expect(resultHM).toBe(GATE_POPUP); // lane undefined exit no longer swallows the gate
    expect(applyHexEffects).toHaveBeenCalledTimes(0); // :514 marked-target skip — no hex bytes
    expect(mockHandleSavePath).toHaveBeenCalledTimes(0);
    expect(rollDamage).toHaveBeenCalledTimes(0); // :731 damage lane never entered
    expect(checkCompelledDuelAttackExpiry).toHaveBeenCalledTimes(0); // consumed before :731
    expect(mockTriggerWildMagicSurge).toHaveBeenCalledTimes(1);
    expect(mockTriggerWildMagicSurge).toHaveBeenCalledWith(hm, { slotLevel: 1, metamagicHeighten: false }, playerStats, 'test-campaign', undefined);
    expect(setRuntimeValue).toHaveBeenCalledTimes(0); // '1 bonus action' — no cast-clock write, no fabricated state

    // Lane :751 — out-of-range Fireball pays a zero-damage roll, then merges.
    vi.clearAllMocks();
    resolveSpellDamageWithTypes.mockReturnValue({ formula: '8d6', primaryType: 'Fire' }); // disk Fireball L3 bytes
    const fireball = diskRow(spells5e, 'Fireball');
    computeRange.mockReturnValue({ isAutoMiss: true, rangeReason: 'out of range' });
    mockTriggerWildMagicSurge.mockResolvedValue(GATE_POPUP);
    const rollDamageAM = vi.fn();
    const resultAM = await executeSpellCast(fireball, { slotLevel: 3 }, {
      rollAttack: vi.fn(), rollDamage: rollDamageAM, playerStats, getTargetInfo: async () => ({ name: 'Goblin' }), campaignName: 'test-campaign',
    });
    expect(rollDamageAM).toHaveBeenCalledTimes(1);
    expect(rollDamageAM).toHaveBeenCalledWith({
      name: 'Fireball', formula: '8d6', total: 0, rolls: [], modifier: 0,
      context: {
        targetName: 'Goblin', attackerName: 'TestWizard', slotLevel: 3, metamagicHeighten: false,
        finalFormula: null, featsOfChaosArmedAtCast: false, isAutoMiss: true,
        rangeReason: 'out of range', saveDc: 17, saveType: 'DEX', dcSuccess: 'half',
        isCantrip: false,
      },
    });
    expect(mockHandleSavePath).toHaveBeenCalledTimes(1); // auto-miss runs its save lane before returning null
    expect(computeRange).toHaveBeenCalledTimes(1);
    expect(computeRange).toHaveBeenCalledWith(fireball, { slotLevel: 3, metamagicHeighten: false }, undefined, undefined, undefined);
    expect(checkCompelledDuelAttackExpiry).toHaveBeenCalledWith('TestWizard', 'Goblin', 'test-campaign'); // :731 pre-damage hook, direct-path mock live
    expect(resultAM).toBe(GATE_POPUP); // runAutoMissPath's null surrenders to the gate
    expect(mockTriggerWildMagicSurge).toHaveBeenCalledTimes(1);
    // :741 stamped the merge ctx before :748/:751 — finalFormula null via mocks.
    expect(mockTriggerWildMagicSurge).toHaveBeenCalledWith(fireball, { slotLevel: 3, metamagicHeighten: false, finalFormula: null, featsOfChaosArmedAtCast: false }, playerStats, 'test-campaign', undefined);
  });

  it('#1455 dedupe FIXED (fix#121(b)) — the :337 generic-heal producer fires self/ally riders and flags healRidersRun:"pair"; the :720 merge DEFERS those legs: each rider fires exactly once, the visible heal payload outranks the surge, and the heal result is byte-exact', async () => {
    // Cure Wounds rides :337 runGenericHealPath (producer self/ally riders, flagged
    // 'pair'), then :720 merges into runPostCastTriggers — the heal-rider pair is
    // deferred (:553/:559 guards); merge-only riders still run once each there.
    const spell = diskRow(spells5e, 'Cure Wounds');
    const playerStats = makePlayerStats();
    resolveSpellDamageWithTypes.mockReturnValue({ formula: null, primaryType: null }); // disk CW has no damage
    getRuntimeValue.mockImplementation((_p, key) => (key === 'hitPoints' ? 20 : key === 'currentHitPoints' ? 10 : []));
    mockTriggerWildMagicSurge.mockResolvedValue(GATE_POPUP);
    const metaCtx = { slotLevel: 1, targetName: 'Goblin' };

    const result = await executeSpellCast(spell, metaCtx, {
      rollAttack: vi.fn(),
      rollDamage: vi.fn(),
      playerStats,
      getTargetInfo: async () => null,
      campaignName: 'test-campaign',
    });

    const stamped = { slotLevel: 1, targetName: 'Goblin', metamagicHeighten: false };
    // Single-fire: producer only, merge defers the flagged pair.
    expect(triggerPostCastSelfHeals).toHaveBeenCalledTimes(1);
    expect(triggerPostCastSelfHeals).toHaveBeenCalledWith(spell, { ...stamped, targetNames: ['Goblin'] }, playerStats, 'test-campaign', undefined);
    expect(triggerPostCastAllyHeals).toHaveBeenCalledTimes(1);
    expect(triggerPostCastAllyHeals).toHaveBeenCalledWith(spell, stamped, playerStats, 'test-campaign', undefined);
    // Merge-only riders stay single-fire (:712 chain never ran — generic heal is :338).
    expect(triggerPostCastRiderSaves).toHaveBeenCalledTimes(1);
    expect(triggerInspiringSmite).toHaveBeenCalledTimes(1);
    expect(mockTriggerWildMagicSurge).toHaveBeenCalledTimes(1); // gate rolled once; popup suppressed by precedence
    expect(triggerHealingWord).toHaveBeenCalledTimes(0); // :341 skipped — :338 handled
    // Provenance order: producer pair strictly before merge riders, surge inside merge.
    ascends([
      triggerPostCastSelfHeals.mock.invocationCallOrder[0],
      triggerPostCastAllyHeals.mock.invocationCallOrder[0],
      triggerPostCastRiderSaves.mock.invocationCallOrder[0],
      applyHexEffects.mock.invocationCallOrder[0],
      mockTriggerWildMagicSurge.mock.invocationCallOrder[0],
    ]);
    // :587 targetName != null → lane outranks surge: exact heal bytes, not the popup.
    expect(result).toEqual({
      targetName: 'Goblin',
      healAmount: 5,
      formula: '1d8 + 5',
      rolls: [5],
      rawTotal: 5,
      bonusHeal: 0,
      bonusDetails: [],
      healingRerollOriginalRolls: null,
      healingRerollDisplayRolls: [5],
    });
    expect(result).not.toBe(GATE_POPUP);
    expect(applyHexEffects).toHaveBeenCalledWith(spell, playerStats, 'test-campaign', 'Goblin', undefined);
    expect(applyHealingToTarget).toHaveBeenCalledTimes(0); // getCombatContext null — out-of-combat heal lane inert
    // Two logs only: generic cast log + hp_change log — no third double-log (#1449 family).
    expect(addEntry).toHaveBeenCalledTimes(2);
    // Purity: the caller's metaCtx is untouched by the :680/:741 stamps.
    expect(metaCtx).toEqual({ slotLevel: 1, targetName: 'Goblin' });
  });
});
