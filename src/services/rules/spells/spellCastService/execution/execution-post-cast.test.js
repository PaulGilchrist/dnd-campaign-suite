// @maintained-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import spells5e from '../../../../../../public/data/spells.json';
import spells2024 from '../../../../../../public/data/2024/spells.json';

/* ------------------------------------------------------------------ */
/*  BASE post-cast lane (#1461/#1463/#1476 fold receiver).            */
/*  SPLIT TABLE vs execution-post-cast-lanes.cla389.test.js (#1476): */
/*   - cla389 OWNS runPostCastTriggersMerged (:597) and its call     */
/*     sites :720/:727/:751/:759 — merge precedence, marked-target    */
/*     pops, auto-miss merged census, payload-less surrender (:599),  */
/*     #1455 producer times(2), Hex/HM :514 skip, duel-hook bytes on */
/*     the merged lanes. Never re-pinned here.                        */
/*   - THIS file OWNS the :771 TAIL (direct runPostCastTriggers,     */
/*     CLA-200 no-dc fall-through folded-out of #1476, cited :492),  */
/*     the full rider SET census on the tail exact-tuple x1 in source */
/*     order (#1463 'post-cast set' — the post-cast trigger SET),    */
/*     endSanctuaryOnCast :560-:579 sanctuary pair (folded #1461,     */
/*     cited :601/:632/:653), the auto-miss dc-BRANCH dispatch bytes  */
/*     only (runAutoMissPath :622 — merge census stays cla389), the   */
/*     Dispel dispatch into runDispelMagicFallback :357 with the       */
/*     lowercase name-gate, rider self-catch console bytes (#1401/    */
/*     #1428/#1452:472-522 cites) and the golden UNGUARDED            */
/*     applyHexEffects sync-throw (#515 has no catch — paid cast      */
/*     aborts; byte-pinned, do NOT silence without the owner).        */
/*  Fold map old→new: :390→T1; :345→T1; :364→T2; :304→(cla389 :437- */
/*  :484, dropped dup); :324→T3; :418→F; :443→T1 dispel times(0);    */
/*  :492→CLA-200 it (upgraded); :519→REMOVED vacuous (source :767    */
/*  awaits handleNoSavePath and IGNORES the return byte — null and     */
/*  undefined arms are byte-identical paths, no kill-matrix row);     */
/*  :541→REMOVED cross-file dup of cla389 :759 lane (reported);       */
/*  :601/:632→S1 loop census; :653→S2 three-state; :661→D identity.   */
/*  Ownership disclaims: lastActionSpellCast set census + endFriends/ */
/*  endInvisibility tuples → execution-early-resolutions.test.js      */
/*  :426/:464/:472; savePath internals → savePath-*.test.js; noSave   */
/*  internals → noSavePath.test.js; compute* bytes → damageCalculation */
/*  lanes; antimagic/silence blocks → execution-block-checks.test.js; */
/*  early-chain bypass → earlyReturns-* #1470-75.                      */
/*  Barrel-only-mock defect form (#1475/#1476): index.js:6 imports    */
/*  checkCompelledDuelAttackExpiry at its DIRECT path — mocked there,  */
/*  barrel mock keeps only executeHandler. './spellResolution.js'      */
/*  mock removed (index.js binds no live export from it). castingTime  */
/*  Utils/psychicSpellsHandler/spellResolution stay REAL: inert on     */
/*  passives:[] fixtures (getPsychicSpellsConfig → undefined, so no    */
/*  component mutation — purity pinned in T1).                        */
/*  NO-CLOCK POLICY: zero timers here; every rider stamps only at the */
/*  cast seam (:771); round/rest-seam owners #1332/#1297 untouched.   */
/*  Kill-matrix: K1 drop tail :771 -> T1/T2 rider times(0) fail;      */
/*  K2 drop endSanctuaryOnCast :554 -> S1 call-set fails; K3 sanctuary*/
/*  target/source filter flip -> S1 fails; K4 drop feats-of-chaos     */
/*  stamp :748 -> tail tuple byte flips; K5 drop :701 heighten choke- */
/*  point -> every stamped tuple fails; K6 flip auto-miss dc gate     */
/*  :622 -> T3 savePath dispatch flips; K7 remove a rider .catch ->   */
/*  E rejects; K8 break dispel lowercase gate -> F casing rows fail;  */
/*  K9 drop triggerTargetCtx :518 -> selfHeals tuple fails; K10 drop  */
/*  spellToHit/damageType bytes :767 -> T2 opts fail; K11 return lane  */
/*  value instead of triggerResult :556 -> D identity fails.           */
/*  Security: no kiro/injection-style content found in this seam or   */
/*  its citations (#1446 scan); campaign locked to 'test-campaign'.   */
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

vi.mock('../../../../combat/buffs/buffService.js', () => ({
  isInnateSorceryActive: vi.fn(() => false),
}));

vi.mock('../../../core/spellDamageUtils.js', () => ({
  resolveSpellDamageWithTypes: vi.fn(),
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

const { getRuntimeValue } = await import('../../../../../hooks/runtime/useRuntimeState.js');
const { addEntry } = await import('../../../../ui/logService.js');
const { checkCompelledDuelAttackExpiry } = await import('../../../../automation/handlers/spells/compelledDuelHandler.js');
const { endSanctuary } = await import('../../../../automation/handlers/spells/sanctuaryHandler.js');
const { triggerPostCastSelfHeals, triggerPostCastAllyHeals } = await import('../../../../rules/spells/postCastHealService.js');
const { triggerSmiteOfProtection } = await import('../../../features/smiteOfProtectionService.js');
const { triggerInspiringSmite } = await import('../../../features/inspiringSmiteService.js');
const { triggerPrimalCompanionSpellShare } = await import('../../../features/primalCompanionSpellShareService.js');
const { triggerWildMagicSurge } = await import('../../../features/wildMagicSurgeService.js');
const { triggerBewitchingMagic, triggerPostCastRiderSaves, triggerSpellThief } = await import('../../../../rules/spells/postCastRiderService.js');
const { triggerHealingWord } = await import('../../../features/healingWordService.js');
const { applyHexEffects, triggerExpertDivination, triggerArcaneWard, triggerDispelMagic } = await import('./helpers.js');
const { handleSavePath: mockHandleSavePath } = await import('./savePath.js');
const { handleNoSavePath: mockHandleNoSavePath } = await import('./noSavePath.js');
const { resolveSpellDamageWithTypes } = await import('../../../core/spellDamageUtils.js');
const { computeRange } = await import('./damageCalculation.js');

/* ------------------------------------------------------------------ */
/*  Fixtures — REAL disk bytes both rulesets via URL-aware fetch     */
/*  stub (#1365-form); campaign locked to 'test-campaign'.            */
/* ------------------------------------------------------------------ */

function diskRow(spells, name) {
  const row = spells.find(s => s.name === name);
  if (!row) throw new Error(`disk row missing: ${name}`);
  return row;
}

const fireball5e = diskRow(spells5e, 'Fireball');
const smite2024 = diskRow(spells2024, 'Divine Smite');
const dispel5e = diskRow(spells5e, 'Dispel Magic');

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

// Ascending-order census helper (#1384 form): the recorded invocationCallOrder
// stream must equal its own sorted copy — source-order dispatch (:506-:554).
const ascends = (ids) => expect(ids).toEqual([...ids].sort((a, b) => a - b));

describe('executeSpellCast base post-cast lane — :771 tail, sanctuary, dispel dispatch (merges owned by .cla389)', () => {
  let consoleError;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(async (url) => ({
      ok: true,
      json: async () => (String(url).includes('/2024/') ? spells2024 : spells5e),
    })));
    getRuntimeValue.mockReturnValue([]);
    addEntry.mockResolvedValue(undefined);
    mockHandleSavePath.mockResolvedValue(null);
    mockHandleNoSavePath.mockResolvedValue(null);
    computeRange.mockReturnValue({});
    triggerWildMagicSurge.mockResolvedValue(null);
    resolveSpellDamageWithTypes.mockReturnValue({ formula: '8d6', primaryType: 'Fire' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    consoleError.mockRestore();
  });

  /* ---------------------------------------------------------------- */
  /*  :771 TAIL — full rider SET census, exact tuples x1, ordered    */
  /* ---------------------------------------------------------------- */

  describe('damage tail :771 runPostCastTriggers — rider SET census exact-tuple x1 in source order', () => {
    // #1463 fold face ('post-cast set') upgraded: a dc spell whose save lane
    // DECLINES (resolves falsy) falls through to the tail; every rider fires
    // exactly once with the cast-stamped metaCtx (:701 heighten + :748
    // finalFormula/featsOfChaos), the surge gate is awaited and its null
    // outcome yields result null. Merged lanes never run here (#1476 split).
    it('dc spell with declined save path: tail fires all riders once with stamped tuples, duel hook exact, surge null -> result null, console untouched', async () => {
      const spell = { ...fireball5e };
      const playerStats = makePlayerStats();
      const metaCtxIn = { targetName: 'Goblin' };
      const rollAttack = vi.fn();
      const rollDamage = vi.fn();
      const getTargetInfo = vi.fn(async () => ({ name: 'Goblin' }));
      // CLA-134 stamp byte: feats-of-chaos armed -> true flows into every tail tuple.
      getRuntimeValue.mockImplementation((name, key) =>
        key === 'featsOfChaosActive' ? true : []);

      const result = await executeSpellCast(spell, metaCtxIn, {
        rollAttack, rollDamage, playerStats, getTargetInfo, campaignName: 'test-campaign',
      });

      const stamped = { targetName: 'Goblin', metamagicHeighten: false };
      const tail = { ...stamped, finalFormula: null, featsOfChaosArmedAtCast: true };
      const pos = [spell, tail, playerStats, 'test-campaign', undefined];

      expect(result).toBeNull();
      // lane dispatch: save lane ran once and declined — tail (not merge) ran.
      expect(mockHandleSavePath).toHaveBeenCalledTimes(1);
      const [opts] = mockHandleSavePath.mock.calls[0];
      expect(Object.keys(opts)).toEqual(['spell', 'fullSpell', 'metaCtx', 'playerStats',
        'campaignName', 'mapName', 'characters', 'getTargetInfo', 'getRuntimeValue',
        'innateSorceryActive', 'effectiveDamageType', 'spellSaveDc', 'overchannelFormula',
        'overchannelActive', 'overchannelUseCount', 'rollAttack', 'rollDamage', 'formula',
        'hasInvisible']);
      expect(opts.spell).toBe(spell);
      expect(opts.fullSpell).toBe(spell); // disk Fireball HAS area_of_effect -> :172 needsLookup false
      expect(opts.metaCtx).toEqual(tail);
      expect(opts.playerStats).toBe(playerStats);
      expect(opts.campaignName).toBe('test-campaign');
      expect(opts.mapName).toBeUndefined();
      expect(opts.characters).toBeUndefined();
      expect(opts.innateSorceryActive).toBe(false);
      expect(opts.effectiveDamageType).toBe('Fire');
      expect(opts.spellSaveDc).toBe(17);
      expect(opts.overchannelFormula).toBeNull();
      expect(opts.overchannelActive).toBe(false);
      expect(opts.overchannelUseCount).toBe(0);
      expect(opts.formula).toBe('8d6');
      expect(opts.hasInvisible).toBe(false);
      expect(opts.rollAttack).toBe(rollAttack);
      expect(opts.rollDamage).toBe(rollDamage);
      expect(mockHandleNoSavePath).toHaveBeenCalledTimes(0); // dc/no-dc mutually exclusive
      expect(computeRange).toHaveBeenCalledTimes(1);
      expect(computeRange).toHaveBeenCalledWith(spell, stamped, undefined, undefined, undefined);
      expect(checkCompelledDuelAttackExpiry).toHaveBeenCalledTimes(1);
      expect(checkCompelledDuelAttackExpiry).toHaveBeenCalledWith('TestWizard', 'Goblin', 'test-campaign');

      // rider SET census — each exactly once, exact tuple (arity vs REAL incl :550 arcaneWard 4-arg).
      expect(triggerPostCastRiderSaves).toHaveBeenCalledTimes(1);
      expect(triggerPostCastRiderSaves).toHaveBeenCalledWith(...pos);
      expect(applyHexEffects).toHaveBeenCalledTimes(1);
      expect(applyHexEffects).toHaveBeenCalledWith(spell, playerStats, 'test-campaign', 'Goblin', undefined);
      expect(triggerPostCastSelfHeals).toHaveBeenCalledTimes(1);
      expect(triggerPostCastSelfHeals).toHaveBeenCalledWith(spell, { ...tail, targetNames: ['Goblin'] }, playerStats, 'test-campaign', undefined);
      expect(triggerPostCastAllyHeals).toHaveBeenCalledTimes(1);
      expect(triggerPostCastAllyHeals).toHaveBeenCalledWith(...pos);
      expect(triggerSmiteOfProtection).toHaveBeenCalledTimes(1);
      expect(triggerSmiteOfProtection).toHaveBeenCalledWith(...pos);
      expect(triggerInspiringSmite).toHaveBeenCalledTimes(1);
      expect(triggerInspiringSmite).toHaveBeenCalledWith(...pos);
      expect(triggerPrimalCompanionSpellShare).toHaveBeenCalledTimes(1);
      expect(triggerPrimalCompanionSpellShare).toHaveBeenCalledWith(...pos);
      expect(triggerSpellThief).toHaveBeenCalledTimes(1);
      expect(triggerSpellThief).toHaveBeenCalledWith(...pos);
      expect(triggerWildMagicSurge).toHaveBeenCalledTimes(1);
      expect(triggerWildMagicSurge).toHaveBeenCalledWith(...pos);
      expect(triggerBewitchingMagic).toHaveBeenCalledTimes(1);
      expect(triggerBewitchingMagic).toHaveBeenCalledWith(...pos);
      expect(triggerExpertDivination).toHaveBeenCalledTimes(1);
      expect(triggerExpertDivination).toHaveBeenCalledWith(...pos);
      expect(triggerArcaneWard).toHaveBeenCalledTimes(1);
      expect(triggerArcaneWard).toHaveBeenCalledWith(spell, tail, playerStats, 'test-campaign');

      // dispatch bytes NOT mine: no no-damage lane, no dispel, no sanctuary (targetEffects []).
      expect(triggerHealingWord).toHaveBeenCalledTimes(0);
      expect(triggerDispelMagic).toHaveBeenCalledTimes(0);
      expect(endSanctuary).toHaveBeenCalledTimes(0);
      // rolls live inside the mocked save lane: zero here.
      expect(rollDamage).toHaveBeenCalledTimes(0);
      expect(rollAttack).toHaveBeenCalledTimes(0);
      expect(addEntry).toHaveBeenCalledTimes(1); // generic cast log — bytes owned by early-resolutions :492
      expect(getTargetInfo).toHaveBeenCalledTimes(3); // block probe, cast log, duel hook; :510 short-circuits on metaCtx.targetName
      // getRuntimeValue full-call census incl the arity-2 'campaign' read (antimagic + sanctuary share it).
      expect(getRuntimeValue.mock.calls).toEqual([
        ['campaign', 'targetEffects'],
        ['TestWizard', 'activeConditions', 'test-campaign'],
        ['TestWizard', 'featsOfChaosActive', 'test-campaign'],
        ['campaign', 'targetEffects'],
      ]);
      ascends([
        mockHandleSavePath.mock.invocationCallOrder[0],
        ...[triggerPostCastRiderSaves, applyHexEffects, triggerPostCastSelfHeals,
          triggerPostCastAllyHeals, triggerSmiteOfProtection, triggerInspiringSmite,
          triggerPrimalCompanionSpellShare, triggerSpellThief, triggerWildMagicSurge,
          triggerBewitchingMagic, triggerExpertDivination, triggerArcaneWard]
          .map(m => m.mock.invocationCallOrder[0]),
      ]);
      // purity: real psychicSpellsHandler declines (passives:[]) -> components untouched; input metaCtx untouched.
      expect(spell.components).toStrictEqual(fireball5e.components);
      expect(metaCtxIn).toEqual({ targetName: 'Goblin' });
      expect(consoleError).toHaveBeenCalledTimes(0);
    });

    // CLA-200 (cited old :492, folded-out of #1476 tail): 2024 disk Divine
    // Smite has NO dc -> handleNoSavePath dispatch then FALL THROUGH to :771;
    // post-cast gates (Inspiring Smite, Surge) become reachable. Old vacuous
    // arms (savePath-called / noSavePath-called / resolves-undefined) are
    // contained in this exact census — source :767 ignores the return byte.
    it('CLA-200 no-dc Divine Smite (2024 disk bytes): no-save lane exact opts, then tail SET once, result null', async () => {
      const spell = { ...smite2024 };
      const playerStats = makePlayerStats({ rules: '2024' });
      resolveSpellDamageWithTypes.mockReturnValue({ formula: '2d8', primaryType: 'Radiant' });

      const result = await executeSpellCast(
        spell,
        { targetName: 'Goblin', slotLevel: 1 },
        {
          rollAttack: vi.fn(),
          rollDamage: vi.fn(),
          playerStats,
          getTargetInfo: async () => ({ name: 'Goblin' }),
          campaignName: 'test-campaign',
        },
      );

      const stamped = { targetName: 'Goblin', slotLevel: 1, metamagicHeighten: false };
      const tail = { ...stamped, finalFormula: null, featsOfChaosArmedAtCast: false };
      const pos = [spell, tail, playerStats, 'test-campaign', undefined];

      expect(result).toBeNull();
      expect(mockHandleSavePath).toHaveBeenCalledTimes(0); // dc:null disk -> no-save branch
      expect(mockHandleNoSavePath).toHaveBeenCalledTimes(1);
      const [noSaveOpts] = mockHandleNoSavePath.mock.calls[0];
      expect(Object.keys(noSaveOpts)).toEqual(['spell', 'metaCtx', 'playerStats', 'campaignName',
        'mapName', 'characters', 'getTargetInfo', 'rollAttack', 'spellToHit', 'damageType']);
      expect(noSaveOpts.spell).toBe(spell);
      expect(noSaveOpts.metaCtx).toEqual(tail);
      expect(noSaveOpts.spellToHit).toBe(9);
      expect(noSaveOpts.damageType).toBe('Radiant');
      expect(computeRange).toHaveBeenCalledWith(spell, stamped, undefined, undefined, undefined);
      expect(checkCompelledDuelAttackExpiry).toHaveBeenCalledWith('TestWizard', 'Goblin', 'test-campaign');

      expect(triggerPostCastRiderSaves).toHaveBeenCalledWith(...pos);
      expect(applyHexEffects).toHaveBeenCalledWith(spell, playerStats, 'test-campaign', 'Goblin', undefined);
      expect(triggerPostCastSelfHeals).toHaveBeenCalledWith(spell, { ...tail, targetNames: ['Goblin'] }, playerStats, 'test-campaign', undefined);
      expect(triggerPostCastAllyHeals).toHaveBeenCalledWith(...pos);
      expect(triggerSmiteOfProtection).toHaveBeenCalledWith(...pos);
      expect(triggerInspiringSmite).toHaveBeenCalledWith(...pos); // the CLA-200 bug: this was unreachable
      expect(triggerPrimalCompanionSpellShare).toHaveBeenCalledWith(...pos);
      expect(triggerSpellThief).toHaveBeenCalledWith(...pos);
      expect(triggerWildMagicSurge).toHaveBeenCalledTimes(1);
      expect(triggerBewitchingMagic).toHaveBeenCalledWith(...pos);
      expect(triggerExpertDivination).toHaveBeenCalledWith(...pos);
      expect(triggerArcaneWard).toHaveBeenCalledWith(spell, tail, playerStats, 'test-campaign');
      expect(endSanctuary).toHaveBeenCalledTimes(0);
      expect(triggerHealingWord).toHaveBeenCalledTimes(0); // formula present -> no-damage lane skipped
      // no-clock policy: a Bonus-Action disk cast writes no state here (per-arm census owned by early-resolutions :426).
      expect(addEntry).toHaveBeenCalledTimes(1);
      expect(consoleError).toHaveBeenCalledTimes(0);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Auto-miss dispatch — dc BRANCH bytes only (merge census: cla389)*/
  /* ---------------------------------------------------------------- */

  it('auto-miss without dc (runAutoMissPath :622 false branch): zero-damage roll exact, save lane skipped, slot still paid, result null', async () => {
    const spell = { ...smite2024 }; // disk dc:null -> fullSpell.dc null -> gate declines save lane
    const playerStats = makePlayerStats({ rules: '2024' });
    resolveSpellDamageWithTypes.mockReturnValue({ formula: '2d8', primaryType: 'Radiant' });
    computeRange.mockReturnValue({ isAutoMiss: true, rangeReason: 'out of range' });
    const rollDamage = vi.fn();

    const result = await executeSpellCast(
      spell,
      { targetName: 'Goblin', slotLevel: 1 },
      {
        rollAttack: vi.fn(),
        rollDamage,
        playerStats,
        getTargetInfo: async () => ({ name: 'Goblin' }),
        campaignName: 'test-campaign',
      },
    );

    const tail = { targetName: 'Goblin', slotLevel: 1, metamagicHeighten: false, finalFormula: null, featsOfChaosArmedAtCast: false };
    expect(result).toBeNull();
    expect(rollDamage).toHaveBeenCalledTimes(1);
    expect(rollDamage).toHaveBeenCalledWith({
      name: 'Divine Smite',
      formula: '2d8',
      total: 0,
      rolls: [],
      modifier: 0,
      context: {
        targetName: 'Goblin',
        attackerName: 'TestWizard',
        slotLevel: 1,
        metamagicHeighten: false,
        finalFormula: null,
        featsOfChaosArmedAtCast: false,
        isAutoMiss: true,
        rangeReason: 'out of range',
        saveDc: 17,
        saveType: undefined,
        dcSuccess: undefined,
        isCantrip: false,
      },
    });
    expect(mockHandleSavePath).toHaveBeenCalledTimes(0);
    expect(mockHandleNoSavePath).toHaveBeenCalledTimes(0); // auto-miss returns before the dc gate tail
    // slot-paid proof: the :751 merge ran its gate once (full merged census owned by cla389).
    expect(triggerWildMagicSurge).toHaveBeenCalledTimes(1);
    expect(triggerWildMagicSurge).toHaveBeenCalledWith(spell, tail, playerStats, 'test-campaign', undefined);
    expect(consoleError).toHaveBeenCalledTimes(0);
  });

  /* ---------------------------------------------------------------- */
  /*  endSanctuaryOnCast :560 — sanctuary pair (folded #1461)          */
  /* ---------------------------------------------------------------- */

  describe('endSanctuaryOnCast :560 — filter + caster-lookup loop census', () => {
    // Upgrades cited old :601 (positive exact tuple) and :632 (caster not in
    // characters) into one four-shape filter census: right target/right source
    // fires; wrong source (not in characters) contributes 0; wrong target
    // contributes 0; non-sanctuary te contributes 0. Loop multiplicity pinned.
    it('ends Sanctuary once per matching effect with the exact 4-tuple; non-matching rows contribute zero', async () => {
      resolveSpellDamageWithTypes.mockReturnValue({ formula: '8d6', primaryType: 'Fire' });
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'targetEffects') {
          return [
            { effect: 'sanctuary', target: 'TestWizard', source: 'Cleric' }, // HIT
            { effect: 'sanctuary', target: 'TestWizard', source: 'UnknownCaster' }, // source not in characters
            { effect: 'sanctuary', target: 'OtherGuy', source: 'Cleric' }, // wrong target
            { effect: 'bless', target: 'TestWizard', source: 'Druid' }, // wrong effect
          ];
        }
        return [];
      });

      const playerStats = makePlayerStats();
      const result = await executeSpellCast(
        { ...fireball5e },
        { targetName: 'Goblin' },
        {
          rollAttack: vi.fn(),
          rollDamage: vi.fn(),
          playerStats,
          getTargetInfo: async () => ({ name: 'Goblin' }),
          campaignName: 'test-campaign',
          characters: [{ name: 'Cleric' }, { name: 'Druid' }],
        },
      );

      expect(result).toBeNull();
      expect(endSanctuary).toHaveBeenCalledTimes(1);
      expect(endSanctuary.mock.calls).toEqual([
        ['Cleric', 'TestWizard', 'test-campaign', 'TestWizard cast a spell, ending Sanctuary.'],
      ]);

      // loop arm: two armed casters -> two exact calls, source order.
      endSanctuary.mockClear();
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'targetEffects') {
          return [
            { effect: 'sanctuary', target: 'TestWizard', source: 'Cleric' },
            { effect: 'sanctuary', target: 'TestWizard', source: 'Druid' },
          ];
        }
        return [];
      });
      await executeSpellCast(
        { ...fireball5e },
        { targetName: 'Goblin' },
        {
          rollAttack: vi.fn(),
          rollDamage: vi.fn(),
          playerStats,
          getTargetInfo: async () => ({ name: 'Goblin' }),
          campaignName: 'test-campaign',
          characters: [{ name: 'Cleric' }, { name: 'Druid' }],
        },
      );
      expect(endSanctuary).toHaveBeenCalledTimes(2);
      expect(endSanctuary.mock.calls).toEqual([
        ['Cleric', 'TestWizard', 'test-campaign', 'TestWizard cast a spell, ending Sanctuary.'],
        ['Druid', 'TestWizard', 'test-campaign', 'TestWizard cast a spell, ending Sanctuary.'],
      ]);
      expect(consoleError).toHaveBeenCalledTimes(0);
    });

    // Cited old :653 upgraded to the three-state no-op scan. Dead-catch report:
    // the try/catch at :566 is structurally UNREACHABLE via executeSpellCast —
    // checkAntimagicField reads the SAME ('campaign','targetEffects') tuple at
    // :88 UNGUARDED, so a throwing probe aborts the cast there first (golden
    // unguarded byte; :566 guard is dead code from this seam — reported).
    it('sanctuary no-op states: empty array and undefined targetEffects end nothing; a throwing probe rejects at the unguarded :88 read before the :566 guard', async () => {
      const cast = () => executeSpellCast(
        { ...fireball5e },
        { targetName: 'Goblin' },
        {
          rollAttack: vi.fn(),
          rollDamage: vi.fn(),
          playerStats: makePlayerStats(),
          getTargetInfo: async () => ({ name: 'Goblin' }),
          campaignName: 'test-campaign',
          characters: [{ name: 'Cleric' }],
        },
      );

      getRuntimeValue.mockReturnValue([]);
      expect(await cast()).toBeNull();
      expect(endSanctuary).toHaveBeenCalledTimes(0);
      expect(addEntry).toHaveBeenCalledTimes(1); // normal cast log ran; guard no-op

      addEntry.mockClear();
      getRuntimeValue.mockReturnValue(undefined); // || [] guard feeds the filter
      expect(await cast()).toBeNull();
      expect(endSanctuary).toHaveBeenCalledTimes(0);
      expect(addEntry).toHaveBeenCalledTimes(1);

      addEntry.mockClear();
      const boom = new Error('runtime probe down');
      getRuntimeValue.mockImplementation(() => { throw boom; });
      await expect(cast()).rejects.toBe(boom); // golden :88 — no catch on this tuple there
      expect(endSanctuary).toHaveBeenCalledTimes(0);
      expect(addEntry).toHaveBeenCalledTimes(0); // rejected before the cast log
      expect(consoleError).toHaveBeenCalledTimes(0); // golden unguarded: no console byte
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Wild Magic Surge surfaced by the tail (:541/:556)               */
  /* ---------------------------------------------------------------- */

  // cla389 owns :599 MERGE precedence; this is the tail returning triggerResult
  // DIRECTLY — object identity, both popup and modal shapes.
  it('tail surfaces the surge result by identity: popup and modal objects pass through :771 unchanged', async () => {
    const popup = { automationPopup: { type: 'popup', payload: { type: 'automation_info', name: 'Wild Magic Surge' } } };
    const modal = { type: 'modal', modalName: 'wildMagicSurge', payload: { mode: 'roll', roll: 17 } };

    triggerWildMagicSurge.mockResolvedValueOnce(popup);
    const r1 = await executeSpellCast(
      { ...fireball5e },
      { targetName: 'Goblin' },
      {
        rollAttack: vi.fn(), rollDamage: vi.fn(), playerStats: makePlayerStats(),
        getTargetInfo: async () => ({ name: 'Goblin' }), campaignName: 'test-campaign',
      },
    );
    expect(r1).toBe(popup);

    triggerWildMagicSurge.mockResolvedValueOnce(modal);
    const r2 = await executeSpellCast(
      { ...fireball5e },
      { targetName: 'Goblin' },
      {
        rollAttack: vi.fn(), rollDamage: vi.fn(), playerStats: makePlayerStats(),
        getTargetInfo: async () => ({ name: 'Goblin' }), campaignName: 'test-campaign',
      },
    );
    expect(r2).toBe(modal);
    expect(triggerWildMagicSurge).toHaveBeenCalledTimes(2);
    expect(consoleError).toHaveBeenCalledTimes(0);
  });

  /* ---------------------------------------------------------------- */
  /*  Dispel dispatch into runDispelMagicFallback :357 (+ case gate) */
  /* ---------------------------------------------------------------- */

  // Upgraded cited-family CLA-322 dispatch face: every declined no-damage arm
  // falls through to :357, which stamps targetName and dispatches; the cast
  // then continues to the no-save tail (disk dc:null) and exits :771 null.
  // Non-Dispel negatives pinned in T1 (triggerDispelMagic times(0)).
  it('Dispel Magic (disk bytes) declines the whole no-damage chain, dispatches once at :357 with exact tuple, name-gate is case-insensitive, then rides no-save tail to a null exit', async () => {
    for (const name of ['Dispel Magic', 'dispel magic', 'DISPEL MAGIC']) {
      vi.clearAllMocks();
      getRuntimeValue.mockReturnValue([]);
      addEntry.mockResolvedValue(undefined);
      mockHandleSavePath.mockResolvedValue(null);
      mockHandleNoSavePath.mockResolvedValue(null);
      computeRange.mockReturnValue({});
      triggerWildMagicSurge.mockResolvedValue(null);
      resolveSpellDamageWithTypes.mockReturnValue({ formula: null, primaryType: null });

      const spell = { ...dispel5e, name };
      const playerStats = makePlayerStats();
      const result = await executeSpellCast(
        spell,
        { targetName: 'Goblin', slotLevel: 2 },
        {
          rollAttack: vi.fn(),
          rollDamage: vi.fn(),
          playerStats,
          getTargetInfo: async () => ({ name: 'Goblin' }),
          campaignName: 'test-campaign',
        },
      );

      expect(triggerDispelMagic).toHaveBeenCalledTimes(1);
      expect(triggerDispelMagic).toHaveBeenCalledWith(
        { targetName: 'Goblin', slotLevel: 2, metamagicHeighten: false },
        spell,
        playerStats,
        'test-campaign',
        undefined,
      );
      expect(mockHandleSavePath).toHaveBeenCalledTimes(0); // disk dc:null both rulesets
      expect(mockHandleNoSavePath).toHaveBeenCalledTimes(1);
      expect(triggerWildMagicSurge).toHaveBeenCalledTimes(1); // tail ran; result null -> :541 gate declined
      expect(result).toBeNull();
      // golden byte: the disk lookup is case-SENSITIVE (find by exact name) —
      // exact-disk casing logs nothing, synthetic casings report not-found
      // while the lowercase name-gate at :267 still dispatches the dispel.
      expect(consoleError.mock.calls).toEqual(
        name === 'Dispel Magic' ? [] : [['[spellCast] Spell not found in spells.json:', name]],
      );
    }
  });

  /* ---------------------------------------------------------------- */
  /*  Rider self-catch bytes (#1401/#1428/#1452 cites) + hex golden  */
  /* ---------------------------------------------------------------- */

  it('each rejecting tail rider self-catches with its exact console byte and the paid cast still resolves null; applyHexEffects is the golden UNGUARDED throw', async () => {
    const rows = [
      [triggerPostCastRiderSaves, '[spellCast] Post-cast rider save failed:'],
      [triggerPostCastSelfHeals, '[spellCast] Post-cast self-heal failed:'],
      [triggerPostCastAllyHeals, '[spellCast] Post-cast ally-heal failed:'],
      [triggerSmiteOfProtection, '[spellCast] Smite of Protection trigger failed:'],
      [triggerInspiringSmite, '[spellCast] Inspiring Smite trigger failed:'],
      [triggerPrimalCompanionSpellShare, '[spellCast] Primal companion spell share failed:'],
      [triggerSpellThief, '[spellCast] Spell Thief failed:'],
      [triggerWildMagicSurge, '[spellCast] Wild Magic Surge trigger failed:'],
      [triggerBewitchingMagic, '[spellCast] Bewitching Magic trigger failed:'],
      [triggerExpertDivination, '[spellCast] Expert Divination trigger failed:'],
      [triggerArcaneWard, '[spellCast] Arcane Ward trigger failed:'],
    ];

    const cast = () => executeSpellCast(
      { ...fireball5e },
      { targetName: 'Goblin' },
      {
        rollAttack: vi.fn(),
        rollDamage: vi.fn(),
        playerStats: makePlayerStats(),
        getTargetInfo: async () => ({ name: 'Goblin' }),
        campaignName: 'test-campaign',
      },
    );

    for (const [failing, prefix] of rows) {
      vi.clearAllMocks();
      getRuntimeValue.mockReturnValue([]);
      addEntry.mockResolvedValue(undefined);
      computeRange.mockReturnValue({});
      mockHandleSavePath.mockResolvedValue(null);
      resolveSpellDamageWithTypes.mockReturnValue({ formula: '8d6', primaryType: 'Fire' });
      for (const [mock] of rows) mock.mockResolvedValue(undefined);
      const err = new Error(`${prefix} boom`);
      failing.mockRejectedValue(err);

      const result = await cast();
      expect(result).toBeNull(); // #5 rejects NEVER abort the paid cast
      expect(consoleError).toHaveBeenCalledTimes(1);
      expect(consoleError).toHaveBeenCalledWith(prefix, err);
      // the block ran to completion: every other rider still fired exactly once
      // (surge awaited even on its own reject row -> caught, triggerResult null).
      for (const [mock] of rows) {
        if (mock !== failing) expect(mock).toHaveBeenCalledTimes(1);
      }
      expect(endSanctuary).toHaveBeenCalledTimes(0);
    }

    // golden (#515 has NO catch): a synchronous hex throw ABORTS the cast —
    // riderSaves already fired (order :506), surge never reached, no console byte.
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue([]);
    computeRange.mockReturnValue({});
    mockHandleSavePath.mockResolvedValue(null);
    resolveSpellDamageWithTypes.mockReturnValue({ formula: '8d6', primaryType: 'Fire' });
    triggerPostCastRiderSaves.mockResolvedValue(undefined);
    const hexBoom = new Error('hex down');
    applyHexEffects.mockImplementation(() => { throw hexBoom; });

    await expect(cast()).rejects.toBe(hexBoom);
    expect(triggerPostCastRiderSaves).toHaveBeenCalledTimes(1); // fired pre-abort
    expect(triggerWildMagicSurge).toHaveBeenCalledTimes(0); // block never reached :538
    expect(consoleError).toHaveBeenCalledTimes(0); // no catch at :515 — golden unguarded byte
  });
});
