// @maintained-by-ai
/* ------------------------------------------------------------------ */
/*  BASE noDamage first-chain lane — index.js :278-:315 (per #1472    */
/*  split; noDamage-healing.test.js owns :316/:318-:320, :328-:332,   */
/*  :345-:359 — never re-owned here).                                 */
/*                                                                     */
/*  Arm census REAL bytes post-fix#296 (#1473) (index.js :278-:315    */
/*  era span, 34 arms — :279/:285/:288/:293 twins DELETED at host):   */
/*   passThrough (:74): :278 Regenerate, :280 Conjure                 */
/*   Volley, :287 Power Word Stun, :295 Command, :300 Friends,        */
/*   :301 Crown of Madness, :302 Animal Friendship, :303-:305         */
/*   Dominate Beast/Monster/Person, :307 Compelled Duel, :308 Globe,  */
/*   :309 Forcecage, :310 Silence, :313 Faerie Fire, :314 Tasha's,    */
/*   :315 Imprisonment.  swallow (:75): :281-:284, :286, :289-:292,   */
/*   :294-:299, :306, :311-:312.  sync thunks: :280/:310.              */
/*   DELETED arms (fix#296): :279 Fear (double-dead), :285 Confusion  */
/*   + :288 Hypnotic (merged-dc-gate collapse), :293 Mass Suggestion  */
/*   (dead-by-direct-route) — zero-dispatch tripwires below.           */
/*                                                                     */
/*  DISPOSITION #1 (#1458) EXECUTED: the old 'Mass Suggestion'/       */
/*  'Suggestion' rows pinned triggerSpells :293/:294 with handled:    */
/*  true for disk spells — unreachable: modalSpells.js:42 (:704)      */
/*  intercepts every lowercase-'mass suggestion' cast while             */
/*  computeSpellStats (:191-:222) makes spellSaveDc always numeric.  */
/*  :293 is therefore dead for EVERY production payload -> row        */
/*  deleted, folded by cite: earlyReturns-modal.test.js :468 (#1471   */
/*  dispatch) + modalSpells.massSuggestion-pay-at-confirm (:1386      */
/*  producer bytes). 'Suggestion' (:294) survives disk-byte-honest:   */
/*  :704's gate declines it, but disk automation 'suggestion' is      */
/*  hijacked at :710 by REAL handleGenericAutomation (census owned by */
/*  earlyReturns-generic.test.js:274) -> the ONLY production route is */
/*  the lightweight payload mirroring useActionSpellMetamagic.js:163  */
/*  {name, level, baseLevel} (row below).                             */
/*                                                                     */
/*  Dead-twin scan (headline class, #1458/:72) CLOSED-BY-FIX fix#296: */
/*  CONFUSION (:285) and HYPNOTIC PATTERN (:288) twins DELETED at the  */
/*  host — modalSpells.js:150/:96-era gate on fullSpell, and            */
/*  lookupFullSpell (:170-:189) merges the disk dc into EVERY           */
/*  lightweight cast of those names, so :707/:706 intercept both       */
/*  disk-full and lightweight routes; the merged gate is NAME-KEYED    */
/*  (merge sets name: spell.name) so one spell's dc can never satisfy  */
/*  the other's check — no fix#166 cross-gating to split -> COLLAPSE. */
/*  Owners: earlyReturns-modal.test.js :603/:561 (#1471). FEAR (:279)  */
/*  arm DELETED: disk-full hijacked at :710 (REAL automation 'fear',   */
/*  census #1470) AND lightweight declined by modalSpells.js:185        */
/*  (gate requires spell.dc, absent on :163 payload) -> no byte-       */
/*  honest row ever existed; fabrication banned (#1455 precedent). The  */
/*  handleFear mock stays in the vi.mock factories as a ZERO-dispatch   */
/*  tripwire: any resurrection of a hub fear dispatch flips red.        */
/*  DISPOSITION #2 (#1472) EXECUTED: :308-:315 arms now carry compact */
/*  rows (previously mock-through-only). Globe/Forcecage are owned by */
/*  blockChecks (:658/:659, lane #1466) for the INBOUND-block face;  */
/*  their :308/:309 chain arms are the cast-side trigger and are      */
/*  hijacked at :710 for disk bytes (REAL automation globe_of_         */
/*  invulnerability/forcecage) -> lightweight rows. Silence (:310) is */
/*  LIVE disk (automation null) and its injected getCombatSummary      */
/*  wrapper (:310 arrow, non-identity) is verified by extraction +     */
/*  delegation instead of tuple equality (no expect.any). Stinking     */
/*  Cloud/Sleet Storm (:311/:312) LIVE disk both rulesets; Faerie Fire*/
/*  (:313)/Imprisonment (:315) LIVE disk 5e; Tasha's (:314) LIVE disk */
/*  2024 only (5e disk has no row — reported). :317 Holy Aura is in  */
/*  NEITHER declared span (healing lane asserts it as neighbor only)  */
/*  — cross-file gap REPORTED, not added.                             */
/*  Cross-file REPORT: 2024 disk Hold Monster/Hold Person/Banishment/  */
/*  Maze/Slow/Beacon/Imprisonment carry automation -> hijacked at      */
/*  :710 there (5e rows below are LIVE disk); no lane executes REAL   */
/*  handleFear/handleConjureVolley/handleSilence producer bytes.       */
/*  Cited-by PRESERVED: seeInvisibilityService.test.js:20 cites this   */
/*  file's See Invisibility swallow pin — kept below.                  */
/*  Fixtures: REAL disk bytes both rulesets via URL-aware fetch stub  */
/*  (#1454-form, #1365); campaign locked to 'test-campaign'.           */
/*  Kill-matrix: M1 arm removed -> next arm intercepts, before/after   */
/*  counts + envelope flip catch; M2 reorder -> invocationCallOrder    */
/*  ascension + before-count fail; M3 swallow<->passThrough swap ->   */
/*  undefined vs LANE_POPUP identity flips; M4 :712 merge skipped ->  */
/*  surge-times-0 fails; M5 short-circuit removal -> after-count>0    */
/*  fails (heal/damage lanes would also wake).                         */
/*  NO-CLOCK: nothing here advances on wall-clock time; no timers.     */
/* ------------------------------------------------------------------ */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import spells5e from '../../../../../../public/data/spells.json';
import spells2024 from '../../../../../../public/data/2024/spells.json';

/* ------------------------------------------------------------------ */
/*  Mocks — all dependencies of execution/index.js (complete factories,*/
/*  #1440: every named import of index.js:1-:40 present)              */
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
  getActiveBuffs: vi.fn(() => []),
}));

// Null formula is the premise of the whole no-damage lane (:715) — set once,
// deterministically, here and in resetAllMocks.
vi.mock('../../../core/spellDamageUtils.js', () => ({
  resolveSpellDamageWithTypes: vi.fn(() => null),
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
  handleHolyAura: vi.fn(() => Promise.resolve({ handled: false })),
  handleMassCureWounds: vi.fn(() => Promise.resolve({ handled: false })),
  handleMassHealingWord: vi.fn(() => Promise.resolve({ handled: false })),
  handlePrayerOfHealing: vi.fn(() => Promise.resolve({ handled: false })),
  handleFalseLife: vi.fn(() => Promise.resolve({ handled: false })),
  handleRemoveCurse: vi.fn(() => Promise.resolve({ handled: false })),
  handleHeroism: vi.fn(() => Promise.resolve({ handled: false })),
  handleLongstrider: vi.fn(() => Promise.resolve({ handled: false })),
  handleSpareTheDying: vi.fn(() => Promise.resolve({ handled: false })),
  handleEnhanceAbility: vi.fn(() => Promise.resolve({ handled: false })),
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
/*  Mock references (asserted seams)                                   */
/* ------------------------------------------------------------------ */

const { resolveSpellDamageWithTypes } = await import('../../../core/spellDamageUtils.js');
const { getRuntimeValue } = await import('../../../../../hooks/runtime/useRuntimeState.js');
const { executeHandler } = await import('../../../../automation/index.js');
const { triggerHealingWord } = await import('../../../features/healingWordService.js');
const { triggerWildMagicSurge } = await import('../../../features/wildMagicSurgeService.js');
const { rollExpression, rollExpressionMaximized } = await import('../../../../dice/diceRoller.js');
const { resolveHealingBonusesWithDetails, markFortifiedHealthUsedIfGranted } = await import('../../../../combat/automation/automationService.js');
const { applyHealingToTarget } = await import('../../../combat/applyHealing.js');
const { computeRange } = await import('./damageCalculation.js');
const { handleSavePath } = await import('./savePath.js');
const { handleNoSavePath } = await import('./noSavePath.js');
const { applyRegenerateSpell } = await import('./helpers.js');
const { checkGlobeOfInvulnerability, checkForcecageBlocked, checkBlockedBySpellcastingBuff } = await import('./blockChecks.js');
const { getCombatSummary: mockCombatSummary } = await import('../../../../../services/encounters/combatData.js');
const {
  handleMassSuggestion: mockMassSuggestionEarly,
  handleFear: mockFear,
  handleConjureVolley: mockConjureVolley,
  handleSilence: mockSilence,
} = await import('./modalSpells.js');
const ts = await import('./triggerSpells.js');

/* ------------------------------------------------------------------ */
/*  Fixtures — REAL disk bytes + documented lightweight route         */
/* ------------------------------------------------------------------ */

const CAMPAIGN = 'test-campaign';
const SAVE_DC = 17;

function diskRow(list, name) {
  const row = list.find((s) => (s.name || '').toLowerCase() === name.toLowerCase());
  if (!row) throw new Error(`REAL disk row missing: ${name}`);
  return row;
}

// Lightweight second-caller shape, verbatim mirror of
// useActionSpellMetamagic.js:163 ({name, level, baseLevel}) — the ONLY
// production route to every :710-hijacked dedicated arm.
function lightweight(row) {
  return { name: row.name, level: row.level ?? 0, baseLevel: 0 };
}

function makePlayerStats(rules = '5e') {
  return {
    name: 'TestWizard',
    rules,
    abilities: [{ name: 'Intelligence', bonus: 5 }],
    proficiency: 4,
    spellAbilities: {
      spellCastingAbility: 'Intelligence',
      toHit: 9,
      saveDc: SAVE_DC,
      modifier: 5,
    },
    automation: { passives: [] },
    hitPoints: 100,
    level: 10,
  };
}

// The :680-stamped metaCtx every downstream tuple must carry (exact key set).
const stampedMeta = (metaCtx) => ({ ...metaCtx, metamagicHeighten: false });

const LANE_POPUP = { automationPopup: { type: 'popup', payload: { type: 'automation_info', name: 'lane-base' } } };

/* Chain census: index.js :278-:315 era span in EXACT order, post-fix#296
 * 34 arms (:279 Fear / :285 Confusion / :288 Hypnotic Pattern /
 * :293 Mass Suggestion twins DELETED at the host — zero-dispatch
 * tripwires live in the flipped describe below).
 * shape keys: posRegen(:278) pos4(spell,metaCtx,playerStats,campaign,mapName)
 * obj({spell,metaCtx,spellSaveDc,playerStats,campaign,mapName})
 * objG(obj + getTargetInfo) cv(:280 (spell,fullSpell)) sil(:310 special).
 * 'pass' = passThrough (:74), 'sw' = swallow (:75). sync = non-Promise thunk. */
const CHAIN = [
  /* :278 */ { mock: ts.handleRegenerate, lane: 'pass', shape: 'posRegen' },
  /* :280 */ { mock: mockConjureVolley, lane: 'pass', shape: 'cv', sync: true },
  /* :281 */ { mock: ts.handleSeeInvisibility, lane: 'sw', shape: 'pos4' },
  /* :282 */ { mock: ts.handleFleshToStone, lane: 'sw', shape: 'obj' },
  /* :283 */ { mock: ts.handleHoldMonster, lane: 'sw', shape: 'obj' },
  /* :284 */ { mock: ts.handleBanishment, lane: 'sw', shape: 'obj' },
  /* :286 */ { mock: ts.handleMaze, lane: 'sw', shape: 'obj' },
  /* :287 */ { mock: ts.handlePowerWordStun, lane: 'pass', shape: 'obj' },
  /* :289 */ { mock: ts.handleSlow, lane: 'sw', shape: 'obj' },
  /* :290 */ { mock: ts.handleBane, lane: 'sw', shape: 'obj' },
  /* :291 */ { mock: ts.handleBless, lane: 'sw', shape: 'obj' },
  /* :292 */ { mock: ts.handleBeaconOfHope, lane: 'sw', shape: 'obj' },
  /* :294 */ { mock: ts.handleSuggestion, lane: 'sw', shape: 'obj' },
  /* :295 */ { mock: ts.handleCommand, lane: 'pass', shape: 'objG' },
  /* :296 */ { mock: ts.handleOttoDance, lane: 'sw', shape: 'obj' },
  /* :297 */ { mock: ts.handleResilientSphere, lane: 'sw', shape: 'obj' },
  /* :298 */ { mock: ts.handleBlur, lane: 'sw', shape: 'pos4' },
  /* :299 */ { mock: ts.handleExpeditiousRetreat, lane: 'sw', shape: 'pos4' },
  /* :300 */ { mock: ts.handleFriends, lane: 'pass', shape: 'objG' },
  /* :301 */ { mock: ts.handleCrownOfMadness, lane: 'pass', shape: 'objG' },
  /* :302 */ { mock: ts.handleAnimalFriendship, lane: 'pass', shape: 'obj' },
  /* :303 */ { mock: ts.handleDominateBeast, lane: 'pass', shape: 'objG' },
  /* :304 */ { mock: ts.handleDominateMonster, lane: 'pass', shape: 'objG' },
  /* :305 */ { mock: ts.handleDominatePerson, lane: 'pass', shape: 'objG' },
  /* :306 */ { mock: ts.handleRayOfEnfeeblement, lane: 'sw', shape: 'objG' },
  /* :307 */ { mock: ts.handleCompelledDuel, lane: 'pass', shape: 'objG' },
  /* :308 */ { mock: ts.handleGlobeOfInvulnerability, lane: 'pass', shape: 'pos4' },
  /* :309 */ { mock: ts.handleForcecage, lane: 'pass', shape: 'pos4' },
  /* :310 */ { mock: mockSilence, lane: 'pass', shape: 'sil', sync: true },
  /* :311 */ { mock: ts.handleStinkingCloud, lane: 'sw', shape: 'obj' },
  /* :312 */ { mock: ts.handleSleetStorm, lane: 'sw', shape: 'obj' },
  /* :313 */ { mock: ts.handleFaerieFire, lane: 'pass', shape: 'obj' },
  /* :314 */ { mock: ts.handleTashasHideousLaughter, lane: 'pass', shape: 'obj' },
  /* :315 */ { mock: ts.handleImprisonment, lane: 'pass', shape: 'obj' },
];

const ARMS = CHAIN.map((c) => c.mock);
const GENERIC = ts.handleGenericAutomation;
// Healing-lane span arms (:316-:320/:328-:332/:345-:359) — must stay UNTOUCHED here.
const DOWNSTREAM = [
  ts.handleHeroism, ts.handleHolyAura, ts.handleLongstrider, ts.handleSpareTheDying, ts.handleEnhanceAbility,
  ts.handleMassCureWounds, ts.handleMassHealingWord, ts.handlePrayerOfHealing, ts.handleFalseLife,
  ts.handleProtectionFromEnergy, ts.handleProtectionFromPoison, ts.handleRemoveCurse, ts.handleResistance,
];
const INERT = [
  rollExpression, rollExpressionMaximized, resolveHealingBonusesWithDetails, applyHealingToTarget,
  markFortifiedHealthUsedIfGranted, computeRange, handleSavePath, handleNoSavePath,
  executeHandler, triggerHealingWord,
];

const SHAPES = {
  posRegen: (spell, _meta, stats, svc) => [spell, svc.getTargetInfo, applyRegenerateSpell, stats, CAMPAIGN],
  pos4: (spell, meta, stats) => [spell, meta, stats, CAMPAIGN, undefined],
  obj: (spell, meta, stats) => [{ spell, metaCtx: meta, spellSaveDc: SAVE_DC, playerStats: stats, campaignName: CAMPAIGN, mapName: undefined }],
  objG: (spell, meta, stats, svc) => [{ spell, metaCtx: meta, spellSaveDc: SAVE_DC, getTargetInfo: svc.getTargetInfo, playerStats: stats, campaignName: CAMPAIGN, mapName: undefined }],
  // :280 receives (spell, fullSpell); disk-full Conjure Volley (aoe set,
  // automation null) skips the lookup (:172) -> fullSpell IS spell.
  cv: (spell) => [spell, spell],
};

function resetAllMocks() {
  vi.clearAllMocks();
  getRuntimeValue.mockReturnValue([]);
  resolveSpellDamageWithTypes.mockReturnValue(null);
  for (const c of CHAIN) {
    if (c.sync) c.mock.mockReturnValue({ handled: false });
    else c.mock.mockResolvedValue({ handled: false });
  }
  for (const arm of [...DOWNSTREAM, GENERIC]) arm.mockResolvedValue({ handled: false });
  triggerWildMagicSurge.mockResolvedValue(null);
  triggerHealingWord.mockResolvedValue(undefined);
}

let consoleError;

async function runCast(row) {
  resetAllMocks();
  const list = row.rules === '2024' ? spells2024 : spells5e;
  const disk = diskRow(list, row.name);
  const spell = row.kind === 'light' ? lightweight(disk) : { ...disk };
  const stats = makePlayerStats(row.rules);
  const metaCtx = { targetName: 'Goblin' };
  const meta = stampedMeta(metaCtx);
  const services = {
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    playerStats: stats,
    getTargetInfo: async () => ({ name: 'Goblin' }),
    campaignName: CAMPAIGN,
  };
  const { mock: arm, lane, shape, sync, dead } = CHAIN[row.i];
  expect(dead).toBeUndefined(); // intercepted rows must not be dead twins

  const once = lane === 'pass' ? { handled: true, result: LANE_POPUP } : { handled: true };
  if (sync) arm.mockReturnValueOnce(once);
  else arm.mockResolvedValueOnce(once);

  const purity = { ...spell };
  const result = await executeSpellCast(spell, metaCtx, services);

  // Envelope semantics (:74/:75): passThrough forwards result VERBATIM
  // (:720 merge keeps it ahead of the surge), swallow resolves undefined.
  if (lane === 'pass') expect(result).toBe(LANE_POPUP);
  else expect(result).toBeUndefined();

  // Exact dispatch tuple against REAL index.js call sites (:278-:315).
  expect(arm).toHaveBeenCalledTimes(1);
  if (shape === 'sil') {
    // :310 injects a fresh arrow wrapper — identity comparison is impossible;
    // verify exact key set, references, and that the wrapper DELEGATES to the
    // combatData mock with the campaign name.
    const [arg] = arm.mock.lastCall;
    expect(Object.keys(arg).sort()).toEqual(['campaignName', 'getCombatSummary', 'metaCtx', 'playerStats', 'spell']);
    expect(arg.spell).toBe(spell);
    expect(arg.metaCtx).toEqual(meta);
    expect(arg.playerStats).toBe(stats);
    expect(arg.campaignName).toBe(CAMPAIGN);
    expect(mockCombatSummary).toHaveBeenCalledTimes(0);
    expect(arg.getCombatSummary(CAMPAIGN)).toBeNull();
    expect(mockCombatSummary).toHaveBeenCalledWith(CAMPAIGN);
  } else {
    expect(arm).toHaveBeenCalledWith(...SHAPES[shape](spell, meta, stats, services));
  }

  // Full first-chain census: every earlier arm ran declined, every later
  // arm is short-circuited (:322-:323).
  CHAIN.forEach((c, j) => {
    expect(c.mock).toHaveBeenCalledTimes(j <= row.i ? 1 : 0);
  });

  // :710 generic automation ran declined BEFORE this lane (early chain), and
  // the whole heal/damage span stayed inert.
  expect(GENERIC).toHaveBeenCalledTimes(1);
  for (const arm2 of DOWNSTREAM) expect(arm2).toHaveBeenCalledTimes(0);
  for (const m of INERT) expect(m).toHaveBeenCalledTimes(0);
  expect(services.rollDamage).toHaveBeenCalledTimes(0);
  expect(services.rollAttack).toHaveBeenCalledTimes(0);

  // Block checks ran declined pre-chain (:651-:667).
  expect(checkBlockedBySpellcastingBuff).toHaveBeenCalledTimes(1);
  expect(checkGlobeOfInvulnerability).toHaveBeenCalledTimes(1);
  expect(checkForcecageBlocked).toHaveBeenCalledTimes(1);

  // CLA-389 seam: post-cast riders run exactly once, AFTER the intercept
  // (:716-:720) — intercept position proof (#1470/:1472 canon).
  expect(triggerWildMagicSurge).toHaveBeenCalledTimes(1);
  const orders = [GENERIC, ...ARMS.slice(0, row.i + 1), triggerWildMagicSurge].map((m) => m.mock.invocationCallOrder[0]);
  expect(orders).toEqual([...orders].sort((a, b) => a - b));
  expect(new Set(orders).size).toBe(orders.length);

  // Golden-path purity: no console noise, no caller-payload mutation
  // (#1360 unguarded-deref guard; metaCtx stays the caller's own bytes).
  expect(consoleError).toHaveBeenCalledTimes(0);
  expect(spell).toEqual(purity);
  expect(metaCtx).toEqual({ targetName: 'Goblin' });

  if (row.verify) row.verify(services, meta, stats);
}

// Lightweight 'Suggestion': proves the :704 hijack runs-and-declines the
// non-mass name (the Mass Suggestion disposition, #1458) AND the fix#296
// (#1473) host deletions: the :293-era handleMassSuggestion twin and the
// :279-era handleFear arm no longer exist in the chain — ZERO dispatch,
// and the :285/:288 twins are gone too. Arming their mocks can no longer
// make them fire: the host no longer imports or dispatches them. Any
// resurrection of a hub dispatch for these names flips these ZERO pins red.
const suggestionVerify = () => {
  expect(mockMassSuggestionEarly).toHaveBeenCalledTimes(1); // :704 ran declined (non-mass name)
  expect(ts.handleMassSuggestion).toHaveBeenCalledTimes(0); // :293 twin DELETED (fix#296)
  expect(mockFear).toHaveBeenCalledTimes(0); // :279 arm DELETED (fix#296, double-dead)
  expect(ts.handleConfusion).toHaveBeenCalledTimes(0); // :285 twin DELETED (fix#296)
  expect(ts.handleHypnoticPattern).toHaveBeenCalledTimes(0); // :288 twin DELETED (fix#296)
};

/* ------------------------------------------------------------------ */
/*  Lanes                                                            */
/* ------------------------------------------------------------------ */

describe('executeSpellCast noDamage base chain (:278-:315) — hijacked disk names intercept on the lightweight :163 route; dedicated arm consumes at its exact position', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (url) => ({
      ok: true,
      json: async () => (String(url).includes('/2024/') ? spells2024 : spells5e),
    })));
    consoleError = vi.spyOn(console, 'error');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    consoleError.mockRestore();
  });

  const lightRows = [
    { i: 0, name: 'Regenerate', kind: 'light', label: 'first arm :278 passThrough, :710-hijacked disk route (#1455 dead-route face)' },
    { i: 2, name: 'See Invisibility', kind: 'light', label: ':281 swallow (cited-by seeInvisibilityService.test.js:20)' },
    { i: 3, name: 'Flesh to Stone', kind: 'light', label: ':282 swallow' },
    { i: 11, name: 'Beacon of Hope', kind: 'light', label: ':292 swallow' },
    { i: 12, name: 'Suggestion', kind: 'light', label: ':294 swallow, :704 declined for non-mass name (#1458 disposition; :293 twin deleted fix#296)', verify: suggestionVerify },
    { i: 26, name: 'Globe of Invulnerability', kind: 'light', label: ':308 passThrough (blockChecks owns the inbound block face, #1466)' },
    { i: 27, name: 'Forcecage', kind: 'light', label: ':309 passThrough (blockChecks owns the inbound block face, #1466)' },
  ];

  for (const r of lightRows) {
    it(`lightweight "${r.name}" (${r.label}) intercepts at CHAIN[${r.i}], envelope exact, later arms/heal/damage lanes inert, riders merge once`, async () => {
      await runCast(r);
    });
  }
});

describe('executeSpellCast noDamage base chain — LIVE disk-byte intercepts (automation-null disk rows reach their dedicated arm; :710 declines for real)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (url) => ({
      ok: true,
      json: async () => (String(url).includes('/2024/') ? spells2024 : spells5e),
    })));
    consoleError = vi.spyOn(console, 'error');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    consoleError.mockRestore();
  });

  const diskRows = [
    { i: 1, name: 'Conjure Volley', rules: '2024', kind: 'disk', label: ':280 SYNC arm, (spell, fullSpell SAME-identity) tuple (no lookup: aoe set + automation null)' },
    { i: 4, name: 'Hold Monster', kind: 'disk', label: ':283 swallow' },
    { i: 4, name: 'Hold Person', kind: 'disk', label: ':283 swallow — dual-name arm (triggerSpells.js:87)' },
    { i: 5, name: 'Banishment', kind: 'disk', label: ':284 swallow' },
    { i: 6, name: 'Maze', kind: 'disk', label: ':286 swallow' },
    { i: 7, name: 'Power Word Stun', kind: 'disk', label: ':287 passThrough' },
    { i: 9, name: 'Bane', kind: 'disk', label: ':290 swallow' },
    { i: 10, name: 'Bless', kind: 'disk', label: ':291 swallow' },
    { i: 13, name: 'Command', kind: 'disk', label: ':295 passThrough command-choice modal envelope' },
    { i: 14, name: "Otto's Irresistible Dance", rules: '2024', kind: 'disk', label: ':296 swallow (SERVICE-declined at :710)' },
    { i: 15, name: "Otiluke's Resilient Sphere", rules: '2024', kind: 'disk', label: ':297 swallow (SERVICE-declined at :710)' },
    { i: 16, name: 'Blur', kind: 'disk', label: ':298 swallow pos4' },
    { i: 17, name: 'Expeditious Retreat', kind: 'disk', label: ':299 swallow pos4' },
    { i: 18, name: 'Friends', kind: 'disk', label: ':300 passThrough' },
    { i: 19, name: 'Crown of Madness', rules: '2024', kind: 'disk', label: ':301 passThrough (5e disk has no row — reported)' },
    { i: 20, name: 'Animal Friendship', kind: 'disk', label: ':302 passThrough' },
    { i: 21, name: 'Dominate Beast', kind: 'disk', label: ':303 passThrough' },
    { i: 22, name: 'Dominate Monster', kind: 'disk', label: ':304 passThrough (save_only automation declined at :710 by effects.fail/success)' },
    { i: 23, name: 'Dominate Person', kind: 'disk', label: ':305 passThrough' },
    { i: 24, name: 'Ray of Enfeeblement', kind: 'disk', label: ':306 swallow (only swallow among the S6 dominate-family arms)' },
    { i: 25, name: 'Compelled Duel', kind: 'disk', label: ':307 passThrough' },
    { i: 28, name: 'Silence', kind: 'disk', label: ':310 SYNC arm with injected getCombatSummary wrapper — delegation verified' },
    { i: 29, name: 'Stinking Cloud', kind: 'disk', label: ':311 swallow' },
    { i: 30, name: 'Sleet Storm', kind: 'disk', label: ':312 swallow' },
    { i: 31, name: 'Faerie Fire', kind: 'disk', label: ':313 passThrough' },
    { i: 32, name: "Tasha's Hideous Laughter", rules: '2024', kind: 'disk', label: ':314 passThrough forwards handler result VERBATIM (fix#358: host now hands the WRAPPED { automationPopup } per faerie guard :385-389 — hub flattening unchanged)' },
    { i: 33, name: 'Imprisonment', kind: 'disk', label: ':315 passThrough (2024 disk hijacked at :710 — reported)' },
  ];

  for (const r of diskRows) {
    it(`${r.rules ?? '5e'} disk bytes "${r.name}" (${r.label}) intercept at CHAIN[${r.i}], full-census decline before, zero after`, async () => {
      await runCast(r);
    });
  }
});

describe('executeSpellCast noDamage base chain — fix#296 (#1473) twin deletions are PERMANENT: zero-dispatch tripwires (the #1473-era pinned-not-fixed pins flipped to real behavior)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (url) => ({
      ok: true,
      json: async () => (String(url).includes('/2024/') ? spells2024 : spells5e),
    })));
    consoleError = vi.spyOn(console, 'error');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    consoleError.mockRestore();
  });

  it('Fear arm (:279-era) DELETED double-dead — lightweight declines (no spell.dc), disk hijacks at :710 — hub dispatches ZERO, cast falls through to the merged-dc save lane', async () => {
    // fix#296 (#1473) FLIPPED pin (formerly pinned-not-fixed 'declined once'):
    // the :279-era handleFear hub arm is DELETED from the chain — the host no
    // longer imports or dispatches handleFear. Lightweight Fear ({name, level,
    // baseLevel}) still cannot trip modalSpells.js:185 (requires spell.dc) and
    // disk-full Fear is consumed at :710 by REAL generic automation (census
    // #1470 — fear's live route is DIRECT fearHandler, automation/index.js:530;
    // fearService deleted fix#294), so the cast falls through the whole
    // :278-:315 SURVIVOR census unhandled and reaches the :326 status-effects
    // fallback / damage lane. Pinned: every survivor arm ran once declined,
    // handleFear dispatches ZERO (any resurrection flips this red), the chain
    // returned unhandled, and the :754 save lane seam (merged fullSpell.dc)
    // dispatched instead of any dedicated arm.
    resetAllMocks();
    const spell = lightweight(diskRow(spells5e, 'Fear'));
    const stats = makePlayerStats();
    const metaCtx = { targetName: 'Goblin' };
    const services = { rollAttack: vi.fn(), rollDamage: vi.fn(), playerStats: stats, getTargetInfo: async () => ({ name: 'Goblin' }), campaignName: CAMPAIGN };

    mockFear.mockReturnValue({ handled: true, result: LANE_POPUP }); // armed resurrection probe

    const result = await executeSpellCast(spell, metaCtx, services);

    expect(result).toBeNull(); // unhandled: falls to :771 runPostCastTriggers (surge null)
    for (const c of CHAIN) expect(c.mock).toHaveBeenCalledTimes(1);
    expect(mockFear).toHaveBeenCalledTimes(0); // DELETED arm — never dispatched (fix#296)
    // :341 fire-and-forget runs ONLY on unhandled fall-through — the exact
    // inverse of every handled row above (healing-lane wordBefore boundary).
    expect(triggerHealingWord).toHaveBeenCalledTimes(1);
    expect(handleSavePath).toHaveBeenCalledTimes(1); // :754 fullSpell.dc merged via fetch stub
    expect(handleNoSavePath).toHaveBeenCalledTimes(0);
    expect(computeRange).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledTimes(0);
  });

  it('Confusion/Hypnotic Pattern twins (:285/:288-era) DELETED — merged-dc-gate collapse: armed twins stay UNDISPATCHED for lightweight AND disk shapes; merged hub falls through to the save lane', async () => {
    // fix#296 (#1473) FLIPPED pin (formerly pinned-not-fixed 'intercepts in the
    // mocked world'): lookupFullSpell merges the disk dc NAME-KEYED into every
    // lightweight cast, so the REAL early gates (modalSpells.js:96/:150) consume
    // 'Hypnotic Pattern'/'Confusion' before the noDamage chain (REAL bytes owned
    // by earlyReturns-modal :603/:561, #1471) — the twins were dead on every
    // production route. The merged gate is correct-by-data — identical dc shapes
    // ({dc_type:'WIS',dc_success:'none'}), distinct name keys, no fix#166-style
    // cross-gating to split — so the STRUCTURAL fix COLLAPSED them: arms deleted
    // at the host. Even armed with handled:true they cannot fire.
    resetAllMocks();
    const stats = makePlayerStats();
    const metaCtx = { targetName: 'Goblin' };
    const services = { rollAttack: vi.fn(), rollDamage: vi.fn(), playerStats: stats, getTargetInfo: async () => ({ name: 'Goblin' }), campaignName: CAMPAIGN };

    ts.handleConfusion.mockResolvedValue({ handled: true });
    ts.handleHypnoticPattern.mockResolvedValue({ handled: true });

    const conf = await executeSpellCast(lightweight(diskRow(spells5e, 'Confusion')), metaCtx, services);
    expect(ts.handleConfusion).toHaveBeenCalledTimes(0); // twin DELETED — never dispatched
    expect(ts.handleHypnoticPattern).toHaveBeenCalledTimes(0);
    expect(conf).toBeNull(); // unhandled here (early gate mock-declined): merged-dc save lane seam
    expect(handleSavePath).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledTimes(0);

    resetAllMocks();
    const hyp = await executeSpellCast({ ...diskRow(spells5e, 'Hypnotic Pattern') }, metaCtx, services);
    expect(ts.handleHypnoticPattern).toHaveBeenCalledTimes(0); // disk shape too (generic :710 mocked-declined in this lane)
    expect(ts.handleConfusion).toHaveBeenCalledTimes(0);
    expect(hyp).toBeNull();
    expect(consoleError).toHaveBeenCalledTimes(0);
  });

  it('Mass Suggestion twin (:293-era) DELETED — :704-era early arm is the sole dispatcher (spellSaveDc always numeric, #1473); armed ts twin stays silent', async () => {
    // fix#296 (#1473): #1458 disposition EXECUTED at the host. handleMassSuggestion
    // (:704-era, modalSpells.js:45 — lowercase-name + spellSaveDc gate) intercepts
    // EVERY 'mass suggestion' cast — computeSpellStats makes spellSaveDc ALWAYS
    // numeric (spellStats.test.js:384 pin) — so the :293 triggerSpells forwarder was
    // dead-by-direct-route: REMOVED from the chain. Route home triggerSpells
    // .handleMassSuggestion stays byte-stable for other callers (fix#109); live
    // dispatch envelopes: earlyReturns-modal :468-era + modalSpells.massSuggestion-
    // pay-at-confirm (producer bytes) + noformula-services 'twins never fire' pin.
    resetAllMocks();
    const stats = makePlayerStats();
    const metaCtx = { targetName: 'Goblin' };
    const services = { rollAttack: vi.fn(), rollDamage: vi.fn(), playerStats: stats, getTargetInfo: async () => ({ name: 'Goblin' }), campaignName: CAMPAIGN };

    ts.handleMassSuggestion.mockResolvedValue({ handled: true }); // armed resurrection probe

    const result = await executeSpellCast(lightweight(diskRow(spells5e, 'Mass Suggestion')), metaCtx, services);

    expect(ts.handleMassSuggestion).toHaveBeenCalledTimes(0); // twin DELETED — never dispatched
    expect(mockMassSuggestionEarly).toHaveBeenCalledTimes(1); // :704 ran (mock-declined in this lane)
    expect(result).toBeNull(); // merged-dc save-lane seam owns the fall-through here
    expect(handleSavePath).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledTimes(0);
  });
});
