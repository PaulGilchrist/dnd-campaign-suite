// @maintained-by-ai
/* ------------------------------------------------------------------ */
/*  executeSpellCast GENERIC-HEAL lane (:337 gate) — FT-012 face      */
/*  (span :336-:486 + rider merge :716-:720; fix commit 676a4c8ae)   */
/*                                                                     */
/*  Unit under test is ./index.js REAL: resolveGenericHeal,            */
/*  runGenericHealPath, applyRolledHeal, applyMaxHeal,                 */
/*  resolveHealExpression, resolveTargetHpBounds, applyHealToCombat,  */
/*  runPostCastTriggers(+Merged), runNoDamagePath. Only leaves are    */
/*  mocked (#1350): dice, automationService bonus oracle, rider        */
/*  services, trigger/modal arms, log, runtime store.                   */
/*                                                                     */
/*  LIVE-vs-HIJACKED census at :337 (post-#1472 mass-swallow,         */
/*  post-#1483 regenerate pin; automation bytes disk-verified):        */
/*   - LIVE disk rows used here: Cure Wounds, Healing Word (5e),      */
/*     Cure Wounds, Resurrection {7:'max'} (2024) — automation is     */
/*     undefined on disk, SERVICE_HANDLED_SPELLS (:42-57) carries no  */
/*     heal name, so :710 handleGenericAutomation misses for real and */
/*     these rows reach :337 with disk bytes. No lightweight shim     */
/*     needed (#1472 documented-route applies only to hijacked names: */
/*     Power Word Heal :702, Regenerate :278, mass four :328-332 —    */
/*     owned by earlyReturns-modal/helpers/noDamage-healing lanes).   */
/*   - :337 return precedes the :341 triggerHealingWord fire-and-     */
/*     forget: every row pins triggerHealingWord times(0), incl. the  */
/*     Healing Word row — the hub consumes it generically. (#1470)     */
/*                                                                     */
/*  FORTIFIED HEALTH MOCK AUTHENTICITY (3rd-instance audit of the     */
/*  #1478/#1479 dead-mock-key pattern): index.js:24 imports            */
/*  markFortifiedHealthUsedIfGranted and calls it at :457 — ALIVE.    */
/*  Unlike the dispel/expertDivination lanes, this is not a fake       */
/*  mock key. Bonus FOLDING is owned by automationPassives.fortified   */
/*  Health.test.js; this lane owns only the hub tuple/identity/gate.   */
/*                                                                     */
/*  RIDER REACH: consumed heals return via :720 runPostCastTriggers-  */
/*  Merged (CLA-389) — riders RUN post-payment (surge times(1) every   */
/*  row). fix#121(a): early-handled casts now reach this same merge.   */
/*  fix#121(b) (#1455, FIXED): runGenericHealPath fires the self/ally */
/*  heal riders at :470/:473 and flags healRidersRun:'pair' —          */
/*  runPostCastTriggers DEFERS those legs (:553/:559 guard); the      */
/*  #1476 times(2) merge-not-dedupe double-fire is retired.           */
/*                                                                     */
/*  QUIRKS pinned as documented behavior (byte evidence in rows):     */
/*   - FIXED fix#126 (#1484): the retired :376 tail `|| playerStats.   */
/*     hitPoints` adopted the CASTER's max for an unstamped ally      */
/*     target. maxHp is now TARGET-OWNED (own runtime row -> own       */
/*     characters snapshot -> loud-skip), fix#103 prayer twin law;      */
/*     the two arms live in the guards describe below.                  */
/*   - :394 'max' branch records bonusHeal but never lands it         */
/*     (cosmetic fold byte).                                           */
/*   - delta-0 log-vs-skip: :428 addEntry fires at delta 0 while      */
/*     :383 applyHealToCombat skips the combat write (#1483 contrast;  */
/*     reroll-ones machinery :413 consumes owner applyHealingRerollOnes */
/*     #1480 — display-only bytes in the reroll row).                  */
/*   - :378 currentHitPoints `?? maxHp` silent-full-HP arm (guarded    */
/*     by the runtimeReads pinning every read tuple).                   */
/*   - NO-CLOCK: latch stamp is a bare forward; no duration bytes here */
/*     (#1483). fetch is URL-aware stubbed (#1454) — deterministic.    */
/*                                                                     */
/*  OUT OF SPAN (covered elsewhere — not duplicated): :440 slot guard, */
/*  :444 spell.level fallback, :365 highestBelow, weak 'max' branch — */
/*  spellCastService.healingEdgeCases.test.js (bare toHaveBeenCalled,  */
/*  cross-file hardening report-only).                                 */
/*                                                                     */
/*  KILL MATRIX: M1 :456 latch removed -> all landed rows fail;        */
/*  M2 latch gate `>0` -> `>=0` -> full-HP row fails times(0);        */
/*  M3 latch arg swap caster<->target -> toBe identity fails;          */
/*  M4 bonusHeal folded-drop :419 -> rawTotal bytes fail;              */
/*  M5 MOD replace :406 drop -> rollExpression tuple '... + MOD'      */
/*  fails; M6 :409 maximize XOR flip -> plain/maximized times fail;   */
/*  M7 :412 !maximize guard drop -> maximize row reroll times(1)      */
/*  fails; M8 :383 clamp drop -> full-HP row getCombatContext fail;   */
/*  M9 fix#126 re-own: law row cap-drop -> healAmount still 62 (62<83 */
/*     headroom) but hp-log delta/clamp + loud-skip arms fail; the     */
/*     retired 62-vs-38 quirk kill is now the target-own-pool law row; */
/*  M10 :337 gate fall-through -> triggerHealingWord times(0) fails   */
/*  incl. Healing Word row; M11 :479 chalice drop -> modal envelope    */
/*  fails; M12 :467 target guard drop -> resolve times(0) fails;       */
/*  M13 :720 merge skip -> surge times(1) fails on every row;          */
/*  M14 :394/'max' formula flip -> envelope toStrictEqual fails.       */
/*  Campaign lockdown: 'test-campaign' only.                            */
/* ------------------------------------------------------------------ */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cloneDeep } from 'lodash';
import spells5e from '../../../../../../public/data/spells.json';
import spells2024 from '../../../../../../public/data/2024/spells.json';

vi.mock('../../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
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
  getCombatContext: vi.fn(() => Promise.resolve({ round: 3 })),
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
  resolveSpellDamageWithTypes: vi.fn(() => ({ formula: null, primaryType: null })),
}));

vi.mock('../../../features/confusionService.js', () => ({
  triggerConfusion: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../combat/automation/automationService.js', () => ({
  markFortifiedHealthUsedIfGranted: vi.fn(() => Promise.resolve()),
  resolveHealingBonusesWithDetails: vi.fn(() => ({ totalBonus: 0, details: [] })),
  hasHealingMaximizationForTarget: vi.fn(() => false),
  hasRerollHealingOnes: vi.fn(() => false),
}));

vi.mock('../../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
  rollExpressionMaximized: vi.fn(),
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

import { executeSpellCast } from './index.js';

const { getRuntimeValue } = await import('../../../../../hooks/runtime/useRuntimeState.js');
const { addEntry } = await import('../../../../ui/logService.js');
const { executeHandler } = await import('../../../../automation/index.js');
const { triggerHealingWord } = await import('../../../features/healingWordService.js');
const { triggerPostCastSelfHeals, triggerPostCastAllyHeals } = await import('../../../../rules/spells/postCastHealService.js');
const { triggerWildMagicSurge } = await import('../../../features/wildMagicSurgeService.js');
const { getCombatContext } = await import('../../../combat/damageUtils.js');
const { applyHealingToTarget } = await import('../../../combat/applyHealing.js');
const { endFriendsOnHostileAction } = await import('../../../features/friendsService.js');
const { endInvisibilityOnHostileAction } = await import('../../../features/invisibilityService.js');
const { resolveHealingBonusesWithDetails, hasHealingMaximizationForTarget, hasRerollHealingOnes, markFortifiedHealthUsedIfGranted } = await import('../../../../combat/automation/automationService.js');
const { rollExpression, rollExpressionMaximized, applyHealingRerollOnes } = await import('../../../../dice/diceRoller.js');
const { handlePowerWordHeal } = await import('./modalSpells.js');
const {
  handleMassCureWounds: massCureArm,
  handleMassHealingWord: massWordArm,
  handlePrayerOfHealing: prayerArm,
  handleFalseLife: falseLifeArm,
  handleGenericAutomation,
} = await import('./triggerSpells.js');
const { computeRange } = await import('./damageCalculation.js');
const { handleSavePath } = await import('./savePath.js');
const { handleNoSavePath } = await import('./noSavePath.js');

const CAMPAIGN = 'test-campaign';
const CASTER = 'Wild_Sage_Druid';
const TARGET = 'Disciplined_Monk';
const COMBAT_CTX = { round: 3 };
const SURGE_POPUP = { automationPopup: { type: 'popup', payload: { type: 'automation_info', name: 'Wild Magic Surge' } } };
// fix#121(c) (#1463): the hub :328 chain lost its Mass Healing Word / Prayer of
// Healing legs (structurally dead — disk rows consumed at :710; see hub comment).
// The live chain arms are massCure + falseLife; the deleted arms stay mocked as
// landmines and are pinned times(0) below.
const MASS_ARMS = [massCureArm, falseLifeArm];
const DEAD_LEG_ARMS = [massWordArm, prayerArm];

function diskRow(list, name) {
  const row = list.find((s) => (s.name || '').toLowerCase() === name.toLowerCase());
  if (!row) throw new Error(`REAL disk row missing: ${name}`);
  return row;
}

// 2024 Epic Boon Fortified Health host (FT-012): the passive OWNER lives on
// the target; folding/ownership adjudication is automationPassives' unit —
// here it only has to travel inside the forwarded tuple.
function targetStats() {
  return {
    name: TARGET,
    abilities: [{ name: 'Constitution', bonus: 2 }],
    proficiency: 6,
    automation: {
      passives: [{
        type: 'passive_rule',
        effect: 'fortified_health',
        name: 'Fortified Health',
        amount: 40,
        alsoSelfHealing: { extraHealingExpression: 'CON modifier', oncePerTurn: true },
      }],
    },
    hitPoints: 183,
    level: 20,
  };
}

function casterStats(rules = '5e') {
  return {
    name: CASTER,
    rules,
    abilities: [{ name: 'Wisdom', bonus: 3 }],
    proficiency: 6,
    spellAbilities: { spellCastingAbility: 'Wisdom', toHit: 9, saveDc: 17, modifier: 3 },
    automation: { passives: [] },
    hitPoints: 138,
    level: 20,
  };
}

function makeServices(caster, characters) {
  return {
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    playerStats: caster,
    getTargetInfo: async () => ({ name: TARGET }),
    attackerPos: null,
    targetPos: null,
    featEffects: {},
    campaignName: CAMPAIGN,
    mapName: 'testMap',
    characters,
  };
}

function runtimeReads({ maxHp = 183, currentHp = 100 } = {}) {
  return (_who, key) => {
    if (key === 'activeConditions' || key === 'targetEffects') return [];
    if (key === 'hitPoints') return maxHp;
    if (key === 'currentHitPoints') return currentHp;
    return undefined;
  };
}

// Strips the nondeterministic timestamp but pins its presence; every log
// call must be scoped to CAMPAIGN.
function loggedEntries() {
  return addEntry.mock.calls.map(([campaign, entry]) => {
    expect(campaign).toBe(CAMPAIGN);
    expect(Number.isFinite(entry.timestamp)).toBe(true);
    const rest = { ...entry };
    delete rest.timestamp;
    return rest;
  });
}

function expectAscending(mocks) {
  const orders = mocks.map((m) => m.mock.invocationCallOrder[0]);
  expect(orders).toEqual([...orders].sort((a, b) => a - b));
  expect(new Set(orders).size).toBe(orders.length);
}

const castLogOf = (spell) => ({
  type: 'spell',
  characterName: CASTER,
  targetName: TARGET,
  spellName: spell.name,
  spellLevel: spell.level || 0,
  castingTime: spell.casting_time,
  damageType: null,
  damageFormula: null,
  saveDC: null,
  concentration: !!spell.concentration,
  description: (spell.description || []).join(' ') || null,
});

const diceEnvelope = (formula, rolls, healAmount, rawTotal, bonusHeal, bonusDetails) => ({
  targetName: TARGET,
  healAmount,
  formula,
  rolls,
  rawTotal,
  bonusHeal,
  bonusDetails,
  healingRerollOriginalRolls: null,
  healingRerollDisplayRolls: rolls,
});

let consoleError;

beforeEach(() => {
  vi.clearAllMocks();
  // #1454 URL-aware fetch stub: REAL lookupFullSpell resolves both catalog
  // tiers deterministically (no live :80 dependency).
  vi.stubGlobal('fetch', vi.fn(async (url) => ({
    ok: true,
    json: async () => (String(url).includes('/2024/') ? spells2024 : spells5e),
  })));
  consoleError = vi.spyOn(console, 'error');
  getRuntimeValue.mockImplementation(runtimeReads());
  resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 2, details: [{ name: 'Fortified Health', amount: 2 }] });
  markFortifiedHealthUsedIfGranted.mockResolvedValue(undefined);
  rollExpression.mockReturnValue({ total: 5, rolls: [5] });
  rollExpressionMaximized.mockReturnValue({ total: 8, rolls: [8] });
  applyHealingRerollOnes.mockReturnValue({ displayRolls: [5], originalRolls: [5] });
  hasHealingMaximizationForTarget.mockReturnValue(false);
  hasRerollHealingOnes.mockReturnValue(false);
  getCombatContext.mockResolvedValue(COMBAT_CTX);
  triggerWildMagicSurge.mockResolvedValue(null);
  triggerPostCastAllyHeals.mockResolvedValue({});
  triggerPostCastSelfHeals.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  consoleError.mockRestore();
});

describe('executeSpellCast generic-heal lane (:337) — disk-live consumed casts, FT-012 latch on the owner, CLA-389 riders merged once (:720)', () => {
  // rows: dice branch 'plain' | 'maximized' | 'reroll' | 'max'
  const consumeRows = [
    {
      name: '5e disk Cure Wounds slot 1 folds Fortified +2 onto the rolled heal',
      spell: diskRow(spells5e, 'Cure Wounds'), rules: '5e', slotLevel: 1, dice: 'plain',
      roll: { total: 5, rolls: [5] },
      envelope: diceEnvelope('1d8 + 3', [5], 7, 7, 2, [{ name: 'Fortified Health', amount: 2 }]),
      hpLog: { type: 'hp_change', targetName: TARGET, delta: 7, currentHp: 107, maxHp: 183, isHealing: true, sourceName: CASTER, note: 'Cure Wounds', formula: '1d8 + 3 + (2 Fortified Health)', bonusDetails: [{ name: 'Fortified Health', amount: 2 }] },
    },
    {
      name: '2024 disk Cure Wounds upcast slot 2 rolls the REAL scaled {2:"4d8 + MOD"} byte',
      spell: diskRow(spells2024, 'Cure Wounds'), rules: '2024', slotLevel: 2, dice: 'plain',
      roll: { total: 12, rolls: [4, 4, 4] },
      envelope: diceEnvelope('4d8 + 3', [4, 4, 4], 14, 14, 2, [{ name: 'Fortified Health', amount: 2 }]),
      hpLog: { type: 'hp_change', targetName: TARGET, delta: 14, currentHp: 114, maxHp: 183, isHealing: true, sourceName: CASTER, note: 'Cure Wounds', formula: '4d8 + 3 + (2 Fortified Health)', bonusDetails: [{ name: 'Fortified Health', amount: 2 }] },
    },
    {
      name: '5e disk Healing Word is consumed generically at :337 — the :341 Healing-Word fire never reaches it',
      spell: diskRow(spells5e, 'Healing Word'), rules: '5e', slotLevel: 1, dice: 'plain',
      roll: { total: 3, rolls: [3] },
      envelope: diceEnvelope('1d4 + 3', [3], 5, 5, 2, [{ name: 'Fortified Health', amount: 2 }]),
      hpLog: { type: 'hp_change', targetName: TARGET, delta: 5, currentHp: 105, maxHp: 183, isHealing: true, sourceName: CASTER, note: 'Healing Word', formula: '1d4 + 3 + (2 Fortified Health)', bonusDetails: [{ name: 'Fortified Health', amount: 2 }] },
    },
    {
      name: "2024 disk Resurrection {7:'max'} heals to full via applyMaxHeal — bonusHeal recorded (:394) but cosmetic, and the latch still stamps",
      spell: diskRow(spells2024, 'Resurrection'), rules: '2024', slotLevel: 7, dice: 'max',
      envelope: { targetName: TARGET, healAmount: 83, formula: 'max', rolls: [], rawTotal: 83, bonusHeal: 2, bonusDetails: [{ name: 'Fortified Health', amount: 2 }] },
      hpLog: { type: 'hp_change', targetName: TARGET, delta: 83, currentHp: 183, maxHp: 183, isHealing: true, sourceName: CASTER, note: 'Resurrection' },
    },
    {
      name: 'target at full HP: heal clamps to 0 — combat write skipped (:383), delta-0 log STILL emitted (:428), latch NOT stamped (:456)',
      spell: diskRow(spells5e, 'Cure Wounds'), rules: '5e', slotLevel: 1, dice: 'plain',
      roll: { total: 5, rolls: [5] }, currentHp: 183, landed: false,
      envelope: diceEnvelope('1d8 + 3', [5], 0, 7, 2, [{ name: 'Fortified Health', amount: 2 }]),
      hpLog: { type: 'hp_change', targetName: TARGET, delta: 0, currentHp: 183, maxHp: 183, isHealing: true, sourceName: CASTER, note: 'Cure Wounds', formula: '1d8 + 3 + (2 Fortified Health)', bonusDetails: [{ name: 'Fortified Health', amount: 2 }] },
    },
    {
      name: 'no Fortified bonus folded: hub does NOT gate on details.length (:456) — latch forwards [] for the real service to judge',
      spell: diskRow(spells5e, 'Cure Wounds'), rules: '5e', slotLevel: 1, dice: 'plain',
      roll: { total: 5, rolls: [5] }, bonus: { totalBonus: 0, details: [] },
      envelope: diceEnvelope('1d8 + 3', [5], 5, 5, 0, []),
      hpLog: { type: 'hp_change', targetName: TARGET, delta: 5, currentHp: 105, maxHp: 183, isHealing: true, sourceName: CASTER, note: 'Cure Wounds', formula: '1d8 + 3', bonusDetails: undefined },
    },
    {
      name: 'maximize seam (:407-:409): maximized dice only, plain roll inert, reroll suppressed by !maximize guard (:412)',
      spell: diskRow(spells5e, 'Cure Wounds'), rules: '5e', slotLevel: 1, dice: 'maximized',
      maximize: true, rerollArmed: true,
      envelope: diceEnvelope('1d8 + 3', [8], 10, 10, 2, [{ name: 'Fortified Health', amount: 2 }]),
      hpLog: { type: 'hp_change', targetName: TARGET, delta: 10, currentHp: 110, maxHp: 183, isHealing: true, sourceName: CASTER, note: 'Cure Wounds', formula: '1d8 + 3 + (2 Fortified Health)', bonusDetails: [{ name: 'Fortified Health', amount: 2 }] },
    },
    {
      name: 'reroll-ones seam (:413) is display-only — healAmount/rawTotal keep the ORIGINAL total (owner applyHealingRerollOnes #1480)',
      spell: diskRow(spells5e, 'Cure Wounds'), rules: '5e', slotLevel: 1, dice: 'reroll',
      rerollArmed: true, rerollReturn: { displayRolls: [6], originalRolls: [5] },
      envelope: { targetName: TARGET, healAmount: 7, formula: '1d8 + 3', rolls: [6], rawTotal: 7, bonusHeal: 2, bonusDetails: [{ name: 'Fortified Health', amount: 2 }], healingRerollOriginalRolls: [5], healingRerollDisplayRolls: [6] },
      hpLog: { type: 'hp_change', targetName: TARGET, delta: 7, currentHp: 107, maxHp: 183, isHealing: true, sourceName: CASTER, note: 'Cure Wounds', formula: '1d8 + 3 + (2 Fortified Health)', bonusDetails: [{ name: 'Fortified Health', amount: 2 }] },
    },
  ];

  for (const row of consumeRows) {
    it(row.name, async () => {
      if (row.bonus) resolveHealingBonusesWithDetails.mockReturnValue(row.bonus);
      if (row.currentHp != null) getRuntimeValue.mockImplementation(runtimeReads({ currentHp: row.currentHp }));
      if (row.maximize) hasHealingMaximizationForTarget.mockReturnValue(true);
      if (row.rerollArmed) hasRerollHealingOnes.mockReturnValue(true);
      if (row.rerollReturn) applyHealingRerollOnes.mockReturnValue(row.rerollReturn);
      if (row.roll) rollExpression.mockReturnValue(row.roll);
      // CLA-389 precedence: a surge popup must never displace the heal payload (:599).
      triggerWildMagicSurge.mockResolvedValue(SURGE_POPUP);

      const caster = casterStats(row.rules);
      const computed = targetStats();
      const services = makeServices(caster, [{ name: TARGET, type: 'player', computedStats: computed }]);
      const spellSnap = cloneDeep(row.spell);
      const metaCtx = { slotLevel: row.slotLevel, targetName: TARGET };
      const metaSnap = { ...metaCtx };

      const result = await executeSpellCast(row.spell, metaCtx, services);

      // Exact envelope key-set per branch (#1448 arity/keys; dice branch
      // carries the reroll pair, :394 'max' branch does not).
      expect(result).toStrictEqual(row.envelope);

      // :175 ruleset-routed disk URL, exactly one lookup.
      expect(fetch.mock.calls.map((c) => c[0])).toEqual([row.rules === '2024' ? '/data/2024/spells.json' : '/data/spells.json']);

      // :449 fold tuple against the REAL signature, targetStats threaded.
      expect(resolveHealingBonusesWithDetails).toHaveBeenCalledTimes(1);
      expect(resolveHealingBonusesWithDetails).toHaveBeenCalledWith(caster, { prof: 6, level: 20, slotLevel: row.slotLevel, campaignName: CAMPAIGN, targetStats: computed });

      // dice seam bytes per branch
      const plainCount = row.dice === 'plain' || row.dice === 'reroll' ? 1 : 0;
      expect(rollExpression).toHaveBeenCalledTimes(plainCount);
      expect(rollExpressionMaximized).toHaveBeenCalledTimes(row.dice === 'maximized' ? 1 : 0);
      if (row.dice !== 'max') {
        expect(hasHealingMaximizationForTarget).toHaveBeenCalledTimes(1);
        expect(hasHealingMaximizationForTarget).toHaveBeenCalledWith(caster, TARGET, CAMPAIGN);
        expect(hasRerollHealingOnes).toHaveBeenCalledWith(caster);
        expect((row.dice === 'maximized' ? rollExpressionMaximized : rollExpression).mock.calls[0]).toEqual([row.envelope.formula]);
      } else {
        expect(hasHealingMaximizationForTarget).toHaveBeenCalledTimes(0);
        expect(hasRerollHealingOnes).toHaveBeenCalledTimes(0);
      }
      expect(applyHealingRerollOnes).toHaveBeenCalledTimes(row.dice === 'reroll' ? 1 : 0);
      if (row.dice === 'reroll') expect(applyHealingRerollOnes).toHaveBeenCalledWith([5], row.envelope.formula);

      // combat write + hp_change log bytes
      const landed = row.landed !== false;
      expect(getCombatContext).toHaveBeenCalledTimes(landed ? 1 : 0);
      expect(applyHealingToTarget).toHaveBeenCalledTimes(landed ? 1 : 0);
      if (landed) expect(applyHealingToTarget).toHaveBeenCalledWith(COMBAT_CTX, TARGET, row.envelope.healAmount, CAMPAIGN);
      const entries = loggedEntries();
      expect(entries).toHaveLength(2);
      expect(entries[0]).toStrictEqual(castLogOf(row.spell));
      expect(entries[1]).toStrictEqual(row.hpLog);

      // FT-012 latch: stamp iff healAmount > 0, forwarding the rolled-in
      // details and the OWNER's resolved computedStats (:447-:457) by identity.
      const latchCount = row.envelope.healAmount > 0 ? 1 : 0;
      expect(markFortifiedHealthUsedIfGranted).toHaveBeenCalledTimes(latchCount);
      if (latchCount) {
        const call = markFortifiedHealthUsedIfGranted.mock.calls[0];
        expect(call[0]).toBe(resolveHealingBonusesWithDetails.mock.results[0].value.details);
        expect(call[1]).toBe(caster);
        expect(call[2]).toBe(computed);
        expect(call[3]).toBe(CAMPAIGN);
      }

      // :337 consumed BEFORE :341 — the Healing-Word fire-and-forget is
      // unreachable for any spell carrying heal_at_slot_level (#1470 census).
      expect(triggerHealingWord).toHaveBeenCalledTimes(0);
      // Early/modal arms dispatched and missed honestly (:701-:711, :328-332).
      expect(handleGenericAutomation).toHaveBeenCalledTimes(1);
      expect(handlePowerWordHeal).toHaveBeenCalledTimes(1);
      for (const arm of MASS_ARMS) expect(arm).toHaveBeenCalledTimes(1);
      // fix#121(c): the deleted :330/:331 legs never dispatch — again, from any lane.
      for (const arm of DEAD_LEG_ARMS) expect(arm).toHaveBeenCalledTimes(0);
      expect(endFriendsOnHostileAction).toHaveBeenCalledWith(CASTER, CAMPAIGN);
      expect(endInvisibilityOnHostileAction).toHaveBeenCalledWith(CASTER, CAMPAIGN);

      // CLA-389 rider merge at :720 + fix#121(b) single-owner split: runGenericHealPath
      // fired the self/ally pair (:472/:475) and flagged healRidersRun:'pair' — the
      // merged block at :519/:522 DEFERS those two legs (the #1476 times(2) double-fire
      // is retired); merge-only riders stay single-fire.
      const stampedCtx = { slotLevel: row.slotLevel, targetName: TARGET, metamagicHeighten: false };
      expect(triggerWildMagicSurge).toHaveBeenCalledTimes(1);
      expect(triggerPostCastSelfHeals).toHaveBeenCalledTimes(1);
      expect(triggerPostCastSelfHeals).toHaveBeenCalledWith(row.spell, { ...stampedCtx, targetNames: [TARGET] }, caster, CAMPAIGN, 'testMap');
      expect(triggerPostCastAllyHeals).toHaveBeenCalledTimes(1);
      expect(triggerPostCastAllyHeals).toHaveBeenCalledWith(row.spell, stampedCtx, caster, CAMPAIGN, 'testMap');

      // damage-lane inert — the noDamage return at :717-:720 outranks it.
      expect(services.rollDamage).toHaveBeenCalledTimes(0);
      expect(services.rollAttack).toHaveBeenCalledTimes(0);
      expect(computeRange).toHaveBeenCalledTimes(0);
      expect(handleSavePath).toHaveBeenCalledTimes(0);
      expect(handleNoSavePath).toHaveBeenCalledTimes(0);
      expect(executeHandler).toHaveBeenCalledTimes(0);

      // HP-bound reads: exactly one pair, campaign arg omitted at :376-:378
      // (documented quirk — the ?? arm silently treats missing currentHp as full).
      expect(getRuntimeValue.mock.calls.filter((c) => c[0] === TARGET && c[1] !== 'activeConditions')).toEqual([
        [TARGET, 'hitPoints'],
        [TARGET, 'currentHitPoints'],
      ]);

      // invocation order (#1480 canon): roll -> combat write -> latch ->
      // generic riders -> surge (heal resolves before the merge at :720).
      const seq = [];
      if (row.dice === 'plain' || row.dice === 'reroll') seq.push(rollExpression);
      if (row.dice === 'maximized') seq.push(rollExpressionMaximized);
      if (landed) seq.push(applyHealingToTarget);
      if (latchCount) seq.push(markFortifiedHealthUsedIfGranted);
      seq.push(triggerPostCastSelfHeals, triggerPostCastAllyHeals, triggerWildMagicSurge);
      expectAscending(seq);

      // purity: disk row and caller metaCtx untouched
      expect(row.spell).toEqual(spellSnap);
      expect(metaCtx).toEqual(metaSnap);
      expect(consoleError).toHaveBeenCalledTimes(0);
    });
  }
});

describe('executeSpellCast generic-heal lane guards and payload precedence', () => {
  it('fix#126 LAW (:401-:436): player target with unstamped runtime hitPoints resolves maxHp from its OWN snapshot 183 — never the CASTER pool 138 (fix#103 twin); heal lands against 183', async () => {
    // Retired defect (#1484, pre-fix capture in the fix-maintain ledger): the tail
    // `|| playerStats.hitPoints` clamped the ally at the caster's 138 — envelope
    // healAmount 38, hp log maxHp 138. fix#126 resolution order: own runtime row
    // (unstamped here -> LOUD warn byte), own characters snapshot (computedStats
    // .hitPoints 183 — the target's OWN law), caster value structurally unreachable.
    // Explicit impl: 'hitPoints' key returns undefined (DEFAULT parameters
    // would resurrect a 183 default here).
    getRuntimeValue.mockImplementation((_who, key) => {
      if (key === 'activeConditions' || key === 'targetEffects') return [];
      if (key === 'currentHitPoints') return 100;
      return undefined;
    });
    rollExpression.mockReturnValue({ total: 60, rolls: [60] });
    const caster = casterStats('5e');
    const computed = targetStats();
    const services = makeServices(caster, [{ name: TARGET, type: 'player', computedStats: computed }]);

    const result = await executeSpellCast(diskRow(spells5e, 'Cure Wounds'), { slotLevel: 1, targetName: TARGET }, services);

    // headroom 183-100=83 > roll+bonus 62 -> NOTHING truncated (the #1484 38-cap is dead)
    expect(result).toStrictEqual(diceEnvelope('1d8 + 3', [60], 62, 62, 2, [{ name: 'Fortified Health', amount: 2 }]));
    const healLog = loggedEntries()[1];
    expect(healLog).toStrictEqual({ type: 'hp_change', targetName: TARGET, delta: 62, currentHp: 162, maxHp: 183, isHealing: true, sourceName: CASTER, note: 'Cure Wounds', formula: '1d8 + 3 + (2 Fortified Health)', bonusDetails: [{ name: 'Fortified Health', amount: 2 }] });
    expect(applyHealingToTarget).toHaveBeenCalledTimes(1);
    expect(applyHealingToTarget).toHaveBeenCalledWith(COMBAT_CTX, TARGET, 62, CAMPAIGN);
    expect(markFortifiedHealthUsedIfGranted).toHaveBeenCalledTimes(1);
    expect(markFortifiedHealthUsedIfGranted.mock.calls[0][2]).toBe(computed);
    // unstamped-runtime is LOUD even when the fallback lawfully resolves (fix#113 family)
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError.mock.calls[0][0]).toContain(`player target ${TARGET} has unstamped runtime 'hitPoints'`);
    // reads stay the target-owned pair — the caster store is never consulted
    expect(getRuntimeValue.mock.calls.filter((c) => c[1] === 'hitPoints')).toEqual([[TARGET, 'hitPoints']]);
  });

  it('fix#126 loud-skip (:432-:435): target with NO own resolvable maxHp (runtime unstamped, no snapshot) -> console.error skip, zero combat write, zero heal log, zero latch; cast still pays riders once', async () => {
    // auraOfVitality/prayer loud-skip family (#1393 verdict): unresolvable stays
    // unresolvable — the caster's 138 never stands in. characters:[] removes the
    // snapshot AND the player classification, so the exact skip byte is the census.
    getRuntimeValue.mockImplementation((_who, key) => {
      if (key === 'activeConditions' || key === 'targetEffects') return [];
      if (key === 'currentHitPoints') return 100;
      return undefined;
    });
    rollExpression.mockReturnValue({ total: 60, rolls: [60] });
    triggerWildMagicSurge.mockResolvedValue(SURGE_POPUP);
    const caster = casterStats('5e');
    const services = makeServices(caster, []);

    const result = await executeSpellCast(diskRow(spells5e, 'Cure Wounds'), { slotLevel: 1, targetName: TARGET }, services);

    // loud-skip -> lane null -> CLA-389 merge keeps the surge popup (:638)
    expect(result).toBe(SURGE_POPUP);
    // displayed roll is harmless memory (diceRoller is pure): one roll, NO writes
    expect(rollExpression).toHaveBeenCalledTimes(1);
    expect(getCombatContext).toHaveBeenCalledTimes(0);
    expect(applyHealingToTarget).toHaveBeenCalledTimes(0);
    expect(markFortifiedHealthUsedIfGranted).toHaveBeenCalledTimes(0);
    // ONE log — the generic cast log; the hp_change row is never written
    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(loggedEntries()[0]).toStrictEqual({ ...castLogOf(diskRow(spells5e, 'Cure Wounds')) });
    // skip byte once; bounds read stops at the unresolved 'hitPoints' tuple
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError.mock.calls[0][0]).toContain(`Skipping heal of ${TARGET}: unresolved target maxHp`);
    expect(getRuntimeValue.mock.calls.filter((c) => c[0] === TARGET && c[1] !== 'activeConditions')).toEqual([
      [TARGET, 'hitPoints'],
    ]);
    // the paid cast keeps its riders (fix#121(b) 'pair' ownership unchanged)
    expect(triggerPostCastSelfHeals).toHaveBeenCalledTimes(1);
    expect(triggerPostCastAllyHeals).toHaveBeenCalledTimes(1);
    expect(triggerWildMagicSurge).toHaveBeenCalledTimes(1);
  });

  it('no target (picker cancelled): :467 skips the whole resolve — no bonus oracle, no dice, no latch — yet CLA-389 riders still run and the surge popup becomes the lane value', async () => {
    const caster = casterStats('5e');
    const services = makeServices(caster, [{ name: TARGET, type: 'player', computedStats: targetStats() }]);
    services.getTargetInfo = vi.fn(async () => null);
    triggerWildMagicSurge.mockResolvedValue(SURGE_POPUP);

    const result = await executeSpellCast(diskRow(spells5e, 'Cure Wounds'), { slotLevel: 1 }, services);

    // lane null -> :599 keeps the surge popup; picker consulted at log, lane, rider.
    expect(result).toBe(SURGE_POPUP);
    expect(getRuntimeValue.mock.calls.filter((c) => c[0] === TARGET && c[1] !== 'activeConditions')).toEqual([]);
    expect(resolveHealingBonusesWithDetails).toHaveBeenCalledTimes(0);
    expect(rollExpression).toHaveBeenCalledTimes(0);
    expect(applyHealingToTarget).toHaveBeenCalledTimes(0);
    expect(markFortifiedHealthUsedIfGranted).toHaveBeenCalledTimes(0);
    expect(triggerHealingWord).toHaveBeenCalledTimes(0);
    // fix#121(b): :467 skips the heal itself but the :472/:475 rider pair still
    // fires once inside runGenericHealPath (flagged 'pair') — the merged block's
    // retired second leg (#1476 times(2)) stays skipped.
    expect(triggerPostCastSelfHeals).toHaveBeenCalledTimes(1);
    expect(triggerPostCastSelfHeals).toHaveBeenCalledWith(diskRow(spells5e, 'Cure Wounds'), { slotLevel: 1, metamagicHeighten: false, targetNames: undefined }, caster, CAMPAIGN, 'testMap');
    expect(triggerPostCastAllyHeals).toHaveBeenCalledTimes(1);
    expect(triggerWildMagicSurge).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(loggedEntries()[0]).toStrictEqual({ ...castLogOf(diskRow(spells5e, 'Cure Wounds')), targetName: null });
    expect(consoleError).toHaveBeenCalledTimes(0);
  });

  it('Starry Chalice needsModal (:479) REPLACES the envelope with the modal — yet the landed heal write and the FT-012 latch already happened inside (:421/:457)', async () => {
    const caster = casterStats('5e');
    const computed = targetStats();
    const services = makeServices(caster, [{ name: TARGET, type: 'player', computedStats: computed }]);
    const spell = diskRow(spells5e, 'Cure Wounds');
    triggerPostCastAllyHeals.mockResolvedValue({ needsModal: true, amount: 20 });
    triggerWildMagicSurge.mockResolvedValue(SURGE_POPUP);

    const result = await executeSpellCast(spell, { slotLevel: 1, targetName: TARGET }, services);

    // modal envelope exact bytes; pending chalice runtime is unset -> caster fallback (:483)
    expect(result).toStrictEqual({
      type: 'modal',
      modalName: 'starryChaliceHeal',
      payload: { casterName: CASTER, campaignName: CAMPAIGN, amount: 20, targetNames: [CASTER] },
    });
    // the underlying Cure Wounds heal still landed and latched (hasVisibleCastPayload :586 keeps the modal)
    expect(applyHealingToTarget).toHaveBeenCalledTimes(1);
    expect(applyHealingToTarget).toHaveBeenCalledWith(COMBAT_CTX, TARGET, 7, CAMPAIGN);
    expect(markFortifiedHealthUsedIfGranted).toHaveBeenCalledTimes(1);
    expect(markFortifiedHealthUsedIfGranted.mock.calls[0][2]).toBe(computed);
    expect(triggerWildMagicSurge).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledTimes(2);
    expect(consoleError).toHaveBeenCalledTimes(0);
  });
});
