// @maintained-by-ai
/* ------------------------------------------------------------------ */
/*  OWNER (sole lane): what index.js :710 FORWARDS to handleGeneric-  */
/*  Automation — the mock-boundary arg pin (earlyReturns-generic:10    */
/*  hands this face HERE; the envelope is visible ONLY with trigger-    */
/*  Spells mocked wholesale). Pinned contract: exact single-object      */
/*  envelope {spell, executeHandler, playerStats, campaignName,         */
/*  mapName, characters, metaCtx} — NOT the arity-5 tuple (that is the */
/*  SECOND crossing inside the REAL handler, owned by earlyReturns-     */
/*  generic:375/:462 — #1462 re-verified real signature :710 = env).   */
/*  Also pinned: the :680 CLA-219 fold composition riding metaCtx       */
/*  (#1470/:1485 stamp transport cited, not regrown), identity chain    */
/*  (fresh folded metaCtx, shared inner refs, caller purity — #1487),  */
/*  and the :710/712 `r.result || undefined` falsy collapse (observable */
/*  only via mocked result bytes).                                      */
/*                                                                     */
/*  SPLIT-TABLE RECONCILIATION (owners cited, never re-grown):         */
/*   - consumption-vs-rejection census 44/78 + :712 bypass: earlyReturns-generic:274 (#1470) */
/*   - fold stamp riding REAL envelope + caller purity: earlyReturns-generic:424 */
/*   - ambush THROW family :117-:120 + SP-002 throw: execution-early-resolutions:361-384 */
/*   - CLA-399 lastActionSpellCast census ONCE FIRST :68: execution-early-resolutions:426 (#1498) */
/*   - :702-:709 modal chain names/order: earlyReturns-modal */
/*   - ambush fold TRANSPORT (dedicated/savePath/fallback): index.magicalAmbushTransport (#1485) */
/*   - handleGenericAutomation internals (action shape, metaCtx spread): triggerSpells.metaCtx */
/*   - deferChooserSlotPayment is a SPELL-level flag consumed at :230, never a metaCtx key —   */
/*     it crosses :710 implicitly via the by-reference env.spell pin (#1486 answer).          */
/*                                                                     */
/*  Mock completeness (line-by-line vs index.js imports, 2026-10-21): every import mocked       */
/*  EXCEPT justified REAL carries: psychicSpellsHandler.getPsychicSpellsConfig,                 */
/*  castingTimeUtils.normalizeCastingTime, core/spellDamageUtils.resolveSpellDamageWithTypes    */
/*  (pure — the canned '10d6' return is REMOVED per #1491 hollowing-ban; disk rows resolve     */
/*  their own bytes), compelledDuelHandler (loaded, unreachable — cast returns at :712).       */
/*  Dead twins DELETED (#1504): barrel key checkCompelledDuelAttackExpiry (direct-import edge   */
/*  :6 owns it), helpers key executeMagicMissile, entire ./spellResolution.js mock (index.js    */
/*  never imports it; spellResolution-log owns that module). No timers/clocks — forwarding is  */
/*  instantaneous; invocationCallOrder unnecessary (exactly-one forward pinned).                 */
/*  Security (#1446 kiro scan): none found in lane or fixtures.                                */
/*  Fixtures: REAL disk rows BOTH rulesets + load-drift-throw (#1503/04); synthetic           */
/*  non-impersonating caster (#1492); campaign lockdown 'test-campaign'.                        */
/* ------------------------------------------------------------------ */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cloneDeep } from 'lodash';
import spells5e from '../../../../../../public/data/spells.json';
import spells2024 from '../../../../../../public/data/2024/spells.json';

const diskRow5e = spells5e.find(s => s.name === 'Prismatic Spray');
const diskRow2024 = spells2024.find(s => s.name === 'Burning Hands');
if (!diskRow5e) throw new Error('disk drift: 5e Prismatic Spray row missing from public/data/spells.json');
if (!diskRow2024) throw new Error('disk drift: 2024 Burning Hands row missing from public/data/2024/spells.json');

/* ------------------------------------------------------------------ */
/*  Mocks — every mockable import of execution/index.js                */
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

vi.mock('../../../features/confusionService.js', () => ({
  triggerConfusion: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../combat/automation/automationService.js', () => ({
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
/*  SUT import after mocks (index.js hub REAL)                         */
/* ------------------------------------------------------------------ */

import { executeSpellCast } from './index.js';

const { getRuntimeValue } = await import('../../../../../hooks/runtime/useRuntimeState.js');
const { executeHandler } = await import('../../../../automation/index.js');
const { handleGenericAutomation: mockGenericAutomation } = await import('./triggerSpells.js');
const { handleSavePath } = await import('./savePath.js');

/* ------------------------------------------------------------------ */
/*  Test-data factories (synthetic caster — non-impersonating, #1492) */
/* ------------------------------------------------------------------ */

function makePlayerStats(rules) {
  return {
    name: 'TestWizard',
    rules,
    abilities: [{ name: 'Intelligence', bonus: 3 }],
    proficiency: 6,
    spellAbilities: { spellCastingAbility: 'Intelligence', toHit: 9, saveDc: 17, modifier: 3 },
    automation: { passives: [] },
    hitPoints: 82,
    level: 20,
  };
}

function makeOpts(playerStats) {
  return {
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    playerStats,
    getTargetInfo: async () => ({ name: 'Zombie 1' }),
    campaignName: 'test-campaign',
    mapName: 'test-map',
    characters: [],
  };
}

/* ------------------------------------------------------------------ */

describe('executeSpellCast :710 forwarding — envelope + metaCtx composition handed to handleGenericAutomation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue([]);
    mockGenericAutomation.mockResolvedValue({ handled: true });
  });

  it('forwards the exact single-object envelope (key census, arity 1) with by-reference spell/stats/characters, the barrel executeHandler function identity, a FRESH :680-folded metaCtx carrying caller selectedTargets by shared reference and the metamagicHeighten:false byte, no post-:741 stamps injected, and returns the handler result verbatim at :712', async () => {
    const spell = cloneDeep(diskRow5e);
    const opts = makeOpts(makePlayerStats('5e'));
    const callerMetaCtx = { selectedTargets: ['Zombie 1', 'Zombie 2'] };
    const SENTINEL = { automationPopup: { type: 'popup', payload: { type: 'result' } } };
    mockGenericAutomation.mockResolvedValue({ handled: true, result: SENTINEL });

    const result = await executeSpellCast(spell, callerMetaCtx, opts);

    expect(executeSpellCast.length).toBe(3);
    expect(mockGenericAutomation).toHaveBeenCalledTimes(1);
    const callArgs = mockGenericAutomation.mock.calls[0];
    expect(callArgs).toHaveLength(1); // single envelope object — the 5-tuple is the SECOND crossing (earlyReturns-generic:375 owns it)
    const [env] = callArgs;
    expect(Object.keys(env)).toEqual(['spell', 'executeHandler', 'playerStats', 'campaignName', 'mapName', 'characters', 'metaCtx']);
    expect(env.spell).toBe(spell); // spell-level flags (e.g. _deferChooserSlotPayment, #1486) ride by reference
    expect(env.playerStats).toBe(opts.playerStats);
    expect(env.characters).toBe(opts.characters);
    expect(env.executeHandler).toBe(executeHandler); // chokepoint threading (#1357): the same barrel fn reference
    expect(env.campaignName).toBe('test-campaign');
    expect(env.mapName).toBe('test-map');
    expect(env.metaCtx).not.toBe(callerMetaCtx); // :680 rebuilds the envelope metaCtx (fresh object, #1487)
    expect(env.metaCtx).toStrictEqual({ selectedTargets: ['Zombie 1', 'Zombie 2'], metamagicHeighten: false }); // #1495 explicit false byte
    expect(env.metaCtx.selectedTargets).toBe(callerMetaCtx.selectedTargets); // shallow fold — inner array shared by reference
    expect(env.metaCtx).not.toHaveProperty('finalFormula'); // :741 second fold runs AFTER :710 — temporal pin
    expect(env.metaCtx).not.toHaveProperty('featsOfChaosArmedAtCast');
    expect(result).toBe(SENTINEL); // :712 pass-through identity
  });

  it('carries every caller metaCtx key across :710 verbatim on a real 2024 disk row — caller metamagicHeighten:true survives the CLA-219 fold unchanged, slotLevel threads as a number byte (#1503 form), explicit-null and implicit-undefined keys stay distinguished (toStrictEqual), and no keys are fabricated', async () => {
    const spell = cloneDeep(diskRow2024);
    const opts = makeOpts(makePlayerStats('2024'));
    const callerMetaCtx = { slotLevel: 3, metamagicHeighten: true, selectedTargets: null, focusPending: undefined, deferChooserSlotPayment: false };

    await executeSpellCast(spell, callerMetaCtx, opts);

    expect(mockGenericAutomation).toHaveBeenCalledTimes(1);
    const [env] = mockGenericAutomation.mock.calls[0];
    expect(Object.keys(env.metaCtx)).toEqual(['slotLevel', 'metamagicHeighten', 'selectedTargets', 'focusPending', 'deferChooserSlotPayment']);
    expect(env.metaCtx).toStrictEqual(callerMetaCtx); // :680 fold recomputes metamagicHeighten false||!!true = true — byte-stable; undefined-present vs null preserved (#1499)
    expect(env.metaCtx).not.toBe(callerMetaCtx);
    expect(typeof env.metaCtx.slotLevel).toBe('number');
    expect(callerMetaCtx).toStrictEqual({ slotLevel: 3, metamagicHeighten: true, selectedTargets: null, focusPending: undefined, deferChooserSlotPayment: false }); // caller purity (#1487 form)
  });

  it('survives an undefined caller metaCtx (:680 optional-chain guard) — :710 receives a stamped-only metaCtx of exactly {metamagicHeighten:false} forwarded exactly once', async () => {
    const spell = cloneDeep(diskRow5e);
    const opts = makeOpts(makePlayerStats('5e'));

    await executeSpellCast(spell, undefined, opts);

    expect(mockGenericAutomation).toHaveBeenCalledTimes(1);
    const [env] = mockGenericAutomation.mock.calls[0];
    expect(env.metaCtx).toStrictEqual({ metamagicHeighten: false });
  });

  it('collapses every falsy handled-result byte (null, 0, empty string, false, missing key) through the :710 "|| undefined" to an undefined resolution while truthy object and string results cross back by identity, and a consumed-but-empty result still bypasses the save lane', async () => {
    const spell = cloneDeep(diskRow5e);
    const TRUTHY_OBJ = { automationPopup: { type: 'popup' } };
    const arms = [
      { ret: { handled: true, result: null }, expected: undefined },
      { ret: { handled: true, result: 0 }, expected: undefined },
      { ret: { handled: true, result: '' }, expected: undefined },
      { ret: { handled: true, result: false }, expected: undefined },
      { ret: { handled: true }, expected: undefined },
      { ret: { handled: true, result: TRUTHY_OBJ }, expected: TRUTHY_OBJ },
      { ret: { handled: true, result: 'PASS' }, expected: 'PASS' },
    ];
    for (const arm of arms) {
      mockGenericAutomation.mockResolvedValue(arm.ret);
      const opts = makeOpts(makePlayerStats('5e'));
      const forwardsBefore = mockGenericAutomation.mock.calls.length;
      const result = await executeSpellCast(spell, {}, opts);
      if (typeof arm.expected === 'object' && arm.expected !== null) {
        expect(result, JSON.stringify(arm.ret)).toBe(arm.expected);
      } else {
        expect(result, JSON.stringify(arm.ret)).toStrictEqual(arm.expected);
      }
      expect(mockGenericAutomation.mock.calls.length - forwardsBefore, `one forward per cast (${JSON.stringify(arm.ret)})`).toBe(1);
    }
    expect(handleSavePath).not.toHaveBeenCalled(); // every arm consumed at :712 — bypass census owned by earlyReturns-generic:274 (#1470), this is the falsy-edge half
  });
});
