// @maintained-by-ai
/* ------------------------------------------------------------------ */
/*  noDamage-chain HEAL/special face of executeSpellCast (index.js)  */
/*                                                                     */
/*  Chain arms enumerated from index.js REAL bytes:                    */
/*   - first-chain passThrough tail arms: :316 Heroism,               */
/*     :318 Longstrider, :319 Spare the Dying, :320 Enhance Ability  */
/*     (:317 Holy Aura swallow sits between — asserted as neighbor)  */
/*   - mass-heal swallow chain :328-332: Mass Cure Wounds (:329),    */
/*     Mass Healing Word (:330), Prayer of Healing (:331),            */
/*     False Life (:332); consumed at :334 — BEFORE the generic-heal */
/*     gate :337 and the :341 Healing-Word fire-and-forget           */
/*   - tail swallow arms after :341: Protection From Energy (:346),  */
/*     Protection from Poison (:347), Remove Curse (:351, with the   */
/*     REAL inline :267 dispel-name gate), Resistance (:359)         */
/*   - rider seam: every lane here returns via runPostCastTriggers-  */
/*     Merged (:716 -> :720, CLA-389) — riders RUN post-payment on  */
/*     this face, unlike the :710/:712 generic-automation bypass     */
/*     (owned by earlyReturns-generic.test.js:274 census, #1455).   */
/*                                                                     */
/*  Hijack disposition (#1458 dead-twin class, #1463 hijack census): */
/*     SERVICE_HANDLED_SPELLS (triggerSpells.js:42-57) contains NO  */
/*     heal-family names, so handleGenericAutomation (:710) consumes */
/*     every REAL disk row of Mass Healing Word, Prayer of Healing,  */
/*     both Protections, Remove Curse, Resistance, Heroism (both      */
/*     rulesets) and Mass Cure Wounds / Spare the Dying / Enhance    */
/*     Ability (2024 only) — their dedicated arms are reachable in   */
/*     production ONLY via automation-free lightweight payloads, the */
/*     exact second-caller shape of useActionSpellMetamagic.js:163  */
/*     ({name, level, baseLevel}). Rows below use REAL disk rows     */
/*     where disk automation is null (Mass Cure Wounds 5e, False     */
/*     Life both, Longstrider both, Spare the Dying 5e, Enhance      */
/*     Ability 5e) and documented lightweight rows otherwise.        */
/*  Heal-domain owners (cite): producers #1372/#1384/85/#1393/94/    */
/*  #1371, riders #1452, materials #1450, hub-compute #1455,         */
/*  special :328-332 #1463.                                           */
/*                                                                     */
/*  Kill-matrix: M1 arm removed -> lane falls to generic-heal gate   */
/*  (:337 — swallow rows carry REAL heal_at_slot_level bytes, so     */
/*  rollExpression/applyHealingToTarget would fire: caught by the     */
/*  :337-inert assertion); M2 chain reorder -> invocationCallOrder   */
/*  ascension fails; M3 swallow<->passThrough swap -> envelope        */
/*  undefined vs popup-identity flips; M4 CLA-389 merge skip -> the  */
/*  per-row surge-called-exactly-once-after-intercept pin fails;     */
/*  M5 short-circuit removal -> nextArms-count assertions fail.      */
/*  Name-gate case-fold lives inside REAL triggerSpells handlers     */
/*  (properly mocked here — the unit under test is the index.js      */
/*  chain); disk name bytes are pinned via diskRow() for both        */
/*  rulesets (#1362/#1365).                                          */
/* ------------------------------------------------------------------ */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import spells5e from '../../../../../../public/data/spells.json';
import spells2024 from '../../../../../../public/data/2024/spells.json';

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
  getActiveBuffs: vi.fn(() => []),
}));

// Null formula is the premise of the whole no-damage lane (:715) — set once,
// deterministically, in resetAllMocks and here.
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
/*  Mock references (asserted seams)                                   */
/* ------------------------------------------------------------------ */

const { resolveSpellDamageWithTypes } = await import('../../../core/spellDamageUtils.js');
const { getRuntimeValue } = await import('../../../../../hooks/runtime/useRuntimeState.js');
const { executeHandler } = await import('../../../../automation/index.js');
const { triggerHealingWord } = await import('../../../features/healingWordService.js');
const { triggerWildMagicSurge } = await import('../../../features/wildMagicSurgeService.js');
const { rollExpression } = await import('../../../../dice/diceRoller.js');
const { resolveHealingBonusesWithDetails, markFortifiedHealthUsedIfGranted } = await import('../../../../combat/automation/automationService.js');
const { applyHealingToTarget } = await import('../../../combat/applyHealing.js');
const { computeRange } = await import('./damageCalculation.js');
const { handleSavePath } = await import('./savePath.js');
const { handleNoSavePath } = await import('./noSavePath.js');
const { triggerDispelMagic } = await import('./helpers.js');
const {
  handleMassCureWounds: mockMassCureWounds,
  handleMassHealingWord: mockMassHealingWord,
  handlePrayerOfHealing: mockPrayerOfHealing,
  handleFalseLife: mockFalseLife,
  handleRemoveCurse: mockRemoveCurse,
  handleProtectionFromEnergy: mockProtectionFromEnergy,
  handleProtectionFromPoison: mockProtectionFromPoison,
  handleResistance: mockResistance,
  handleHeroism: mockHeroism,
  handleHolyAura: mockHolyAura,
  handleLongstrider: mockLongstrider,
  handleSpareTheDying: mockSpareTheDying,
  handleEnhanceAbility: mockEnhanceAbility,
  handleGenericAutomation: mockGenericAutomation,
} = await import('./triggerSpells.js');

/* ------------------------------------------------------------------ */
/*  Test-data — REAL disk bytes (#1362) + documented lightweight    */
/*  rows mirroring useActionSpellMetamagic.js:163 ({name, level,    */
/*  baseLevel}) for the :710-hijacked names.                         */
/* ------------------------------------------------------------------ */

const CAMPAIGN = 'test-campaign';

function diskRow(list, name) {
  const row = list.find((s) => (s.name || '').toLowerCase() === name.toLowerCase());
  if (!row) throw new Error(`REAL disk row missing: ${name}`);
  return row;
}

function lightweight(row) {
  return { name: row.name, level: row.level, baseLevel: 0 };
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
      saveDc: 17,
      modifier: 5,
    },
    automation: { passives: [] },
    hitPoints: 100,
    level: 10,
  };
}

function makeServices(playerStats) {
  return {
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    playerStats,
    getTargetInfo: async () => ({ name: 'TestWizard' }),
    campaignName: CAMPAIGN,
  };
}

// The :680-stamped metaCtx every downstream tuple must carry (exact key set).
const stampedMeta = (slotLevel) => ({ targetName: 'TestWizard', slotLevel, metamagicHeighten: false });

const LANE_POPUP = { automationPopup: { type: 'popup', payload: { type: 'automation_info', name: 'lane' } } };

function expectAscending(mocks) {
  const orders = mocks.map((m) => m.mock.invocationCallOrder[0]);
  expect(orders).toEqual([...orders].sort((a, b) => a - b));
  expect(new Set(orders).size).toBe(orders.length);
}

const FIRST_TAIL = [mockHeroism, mockHolyAura, mockLongstrider, mockSpareTheDying, mockEnhanceAbility];
// fix#121(c) (#1463, FIXED): the hub :328 chain shed its Mass Healing Word / Prayer
// of Healing legs — disk rows carry automation.type on both rulesets and are consumed
// EARLIER at :710 handleGenericAutomation; the only shape that ever reached the legs
// (lightweight {name, level, baseLevel}) carries no heal ladder, so the forwarded
// services resolved null and produced nothing (massHealingWordService.js:141-145,
// prayerOfHealingService.js:210-212). LIVE chain arms: massCure + falseLife. The
// retired legs stay mocked as landmines — pinned times(0) by runRow below.
const MASS_ARMS = [mockMassCureWounds, mockFalseLife];
const RETIRED_HEAL_LEGS = [mockMassHealingWord, mockPrayerOfHealing];
const TAIL_ARMS = [mockProtectionFromEnergy, mockProtectionFromPoison, mockRemoveCurse, mockResistance];
// Lanes that every handled no-damage arm must bypass (index.js :337/:341/:724/:730/:754).
const HEAL_LANE_INERT = [rollExpression, resolveHealingBonusesWithDetails, applyHealingToTarget, markFortifiedHealthUsedIfGranted];
const DAMAGE_LANE_INERT = [computeRange, handleSavePath, handleNoSavePath];

function resetAllMocks() {
  vi.clearAllMocks();
  getRuntimeValue.mockReturnValue([]);
  resolveSpellDamageWithTypes.mockReturnValue(null);
  for (const arm of [...FIRST_TAIL, ...MASS_ARMS, ...TAIL_ARMS, mockGenericAutomation]) {
    arm.mockResolvedValue({ handled: false });
  }
  triggerWildMagicSurge.mockResolvedValue(null);
  triggerHealingWord.mockResolvedValue(undefined);
}

async function runRow(row) {
  const playerStats = makePlayerStats(row.rules);
  const services = makeServices(playerStats);
  const metaCtx = { targetName: 'TestWizard', slotLevel: row.spell.level };
  const puritySnapshot = { ...row.spell };
  if (row.lane === 'passThrough') {
    row.arm.mockResolvedValueOnce({ handled: true, result: LANE_POPUP });
  } else {
    row.arm.mockResolvedValueOnce({ handled: true });
  }

  const result = await executeSpellCast(row.spell, metaCtx, services);

  // Envelope: swallow lanes resolve undefined (index.js:75/:334);
  // passThrough lanes forward the handler result VERBATIM (:74) and the
  // CLA-389 merge keeps them ahead of the surge popup (:599-:600).
  if (row.lane === 'passThrough') {
    expect(result).toBe(LANE_POPUP);
  } else {
    expect(result).toBeUndefined();
  }

  // The intercepting arm ran exactly once with the exact positional/object
  // tuple against REAL signatures (triggerSpells.js:413-:574).
  expect(row.arm).toHaveBeenCalledTimes(1);
  expect(row.arm).toHaveBeenCalledWith(...row.tuple(row.spell, stampedMeta(row.spell.level), playerStats));

  // :710 generic automation dispatched and missed (payloads here are
  // automation-free or disk automation-null — hijack census owned by
  // earlyReturns-generic.test.js:274).
  expect(mockGenericAutomation).toHaveBeenCalledTimes(1);

  for (const m of row.before) expect(m).toHaveBeenCalledTimes(1);
  for (const m of row.after) expect(m).toHaveBeenCalledTimes(0);
  // fix#121(c) landmine: the retired :330/:331 hub legs never dispatch, from any row.
  for (const m of RETIRED_HEAL_LEGS) expect(m).toHaveBeenCalledTimes(0);
  expectAscending(row.order);

  // :341 Healing-Word fire-and-forget: skipped by :322/:334 returns on the
  // first-chain and mass-heal rows; MUST precede every tail-arm intercept.
  if (row.wordBefore) {
    expect(triggerHealingWord).toHaveBeenCalledTimes(1);
    expect(triggerHealingWord).toHaveBeenCalledWith(row.spell, stampedMeta(row.spell.level), playerStats, CAMPAIGN, undefined);
  } else {
    expect(triggerHealingWord).toHaveBeenCalledTimes(0);
  }

  for (const m of [...HEAL_LANE_INERT, ...DAMAGE_LANE_INERT]) expect(m).toHaveBeenCalledTimes(0);
  expect(services.rollDamage).toHaveBeenCalledTimes(0);

  // CLA-389 seam: the post-cast rider block runs exactly once, AFTER the
  // lane intercept (this segment sits before the :720 rider merge, unlike
  // the :712 bypass).
  expect(triggerWildMagicSurge).toHaveBeenCalledTimes(1);

  // Golden-path purity: healthy lane emits no console.error, no caller
  // payload mutation.
  expect(consoleError).toHaveBeenCalledTimes(0);
  expect(row.spell).toEqual(puritySnapshot);
}

let consoleError;

describe('executeSpellCast — noDamage heal chain: swallow arms consume before the generic-heal gate (:328-334)', () => {
  beforeEach(resetAllMocks);
  beforeEach(() => {
    // #1454 URL-aware fetch stub: REAL lookupFullSpell resolves both catalog
    // tiers deterministically (no live :80 dependency).
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

  const posHeal = (spell, meta, stats) => [spell, meta, stats, CAMPAIGN, undefined];

  const rows = [
    // REAL 5e disk row: automation null on disk, so :710 misses for real and
    // the :329 arm intercepts LIVE; row carries heal_at_slot_level 5-9, so
    // it has teeth against M5 (:337 leak).
    {
      spell: diskRow(spells5e, 'Mass Cure Wounds'), lane: 'swallow', arm: mockMassCureWounds, tuple: posHeal,
      before: FIRST_TAIL,
      after: [mockMassHealingWord, mockPrayerOfHealing, mockFalseLife, ...TAIL_ARMS],
      order: [mockGenericAutomation, ...FIRST_TAIL, mockMassCureWounds, triggerWildMagicSurge],
      wordBefore: false,
    },
    // :710-hijacked disk names -> documented lightweight payload (real
    // second-caller shape) is the ONLY production route to these arms.
    // fix#121(c) (#1463): the massHW/prayer rows of this table were RETIRED together
    // with their hub legs — replaced by the fall-through census below.
    // REAL disk bytes, both rulesets (False Life stores automation null).
    {
      spell: diskRow(spells5e, 'False Life'), lane: 'swallow', arm: mockFalseLife, tuple: posHeal,
      before: [...FIRST_TAIL, mockMassCureWounds],
      after: [...TAIL_ARMS],
      order: [mockGenericAutomation, mockMassCureWounds, mockFalseLife, triggerWildMagicSurge],
      wordBefore: false,
    },
    {
      spell: diskRow(spells2024, 'False Life'), rules: '2024', lane: 'swallow', arm: mockFalseLife, tuple: posHeal,
      before: [...FIRST_TAIL, mockMassCureWounds],
      after: [...TAIL_ARMS],
      order: [mockGenericAutomation, mockMassCureWounds, mockFalseLife, triggerWildMagicSurge],
      wordBefore: false,
    },
  ];

  for (const row of rows) {
    it(`:328-334 swallow lane — ${row.rules ?? '5e'} "${row.spell.name}" intercepts at its chain position, skips :337/:341, resolves undefined, riders run post-payment`, async () => {
      await runRow(row);
    });
  }

  // fix#121(c) fall-through census (#1463) — the retired spans stay silent and the
  // names produce nothing on the lightweight shape (same zero the retired legs
  // produced: service refused without a heal ladder). Disk bytes are consumed at
  // :710 — census owned by aoeHealingSpecial.test.js:498 + earlyReturns-generic :274.
  for (const name of ['Mass Healing Word', 'Prayer of Healing']) {
    it(`fix#121(c) — lightweight "${name}" misses the trimmed :328 chain and the ladder-less :337, fires :341 once, produces zero heals, and runs merged post-cast riders once`, async () => {
      const services = makeServices(makePlayerStats());

      const result = await executeSpellCast(lightweight(diskRow(spells5e, name)), { slotLevel: name === 'Mass Healing Word' ? 3 : 2 }, services);

      for (const m of RETIRED_HEAL_LEGS) expect(m).toHaveBeenCalledTimes(0); // spans deleted — never dispatch
      expect(mockMassCureWounds).toHaveBeenCalledTimes(1); // name-missed, chain passed
      expect(mockFalseLife).toHaveBeenCalledTimes(1); // name-missed — chain no longer short-circuits at the retired positions
      expect(mockGenericAutomation).toHaveBeenCalledTimes(1); // declined here (mocked); REAL disk bytes ARE consumed there (#1463 hijack)
      for (const m of FIRST_TAIL) expect(m).toHaveBeenCalledTimes(1); // declined first-chain arms
      expect(triggerHealingWord).toHaveBeenCalledTimes(1); // :341 reachable post-deletion (was skipped by the retired legs)
      for (const m of TAIL_ARMS) expect(m).toHaveBeenCalledTimes(1); // declined tail
      for (const m of HEAL_LANE_INERT) expect(m).toHaveBeenCalledTimes(0); // zero heal production — no ladder on the lightweight envelope
      expect(handleSavePath).toHaveBeenCalledTimes(0); // disk dc null
      expect(handleNoSavePath).toHaveBeenCalledTimes(1); // :767 no-dc damage tail (inert mocked consumer)
      expect(triggerWildMagicSurge).toHaveBeenCalledTimes(1); // one merge, :771 tail
      expect(result).toBeNull();
      expect(consoleError).toHaveBeenCalledTimes(0);
    });
  }
});

describe('executeSpellCast — noDamage first-chain tail (:316-320): passThrough arms forward the lane popup verbatim and outrank the surge (:599/:720)', () => {
  beforeEach(resetAllMocks);
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

  const objTuple = (keys) => (spell, meta, stats) => [{
    ...(keys.includes('metaCtx') ? { metaCtx: meta } : {}),
    spell,
    playerStats: stats,
    campaignName: CAMPAIGN,
    mapName: undefined,
    characters: undefined,
    executeHandler,
  }];
  const posBuff = (spell, _meta, stats) => [spell, stats, CAMPAIGN, undefined, executeHandler];

  const ALL_DOWNSTREAM = [...MASS_ARMS, ...TAIL_ARMS];

  const rows = [
    // Heroism stores automation.type='heroism' on BOTH rulesets -> :710
    // consumes disk-byte casts (census-owned); the :316 arm is reachable
    // only via the documented lightweight shape.
    {
      spell: lightweight(diskRow(spells5e, 'Heroism')), lane: 'passThrough', arm: mockHeroism, tuple: objTuple([]),
      before: [],
      after: [mockHolyAura, mockLongstrider, mockSpareTheDying, mockEnhanceAbility, ...ALL_DOWNSTREAM],
      order: [mockGenericAutomation, mockHeroism, triggerWildMagicSurge],
      wordBefore: false,
    },
    // REAL disk rows, both rulesets (Longstrider automation null).
    {
      spell: diskRow(spells5e, 'Longstrider'), lane: 'passThrough', arm: mockLongstrider, tuple: posBuff,
      before: [mockHeroism, mockHolyAura],
      after: [mockSpareTheDying, mockEnhanceAbility, ...ALL_DOWNSTREAM],
      order: [mockHeroism, mockHolyAura, mockLongstrider, triggerWildMagicSurge],
      wordBefore: false,
    },
    {
      spell: diskRow(spells2024, 'Longstrider'), rules: '2024', lane: 'passThrough', arm: mockLongstrider, tuple: posBuff,
      before: [mockHeroism, mockHolyAura],
      after: [mockSpareTheDying, mockEnhanceAbility, ...ALL_DOWNSTREAM],
      order: [mockHeroism, mockHolyAura, mockLongstrider, triggerWildMagicSurge],
      wordBefore: false,
    },
    // Spare the Dying automation-null 5e only (2024 hijacked — reported).
    {
      spell: diskRow(spells5e, 'Spare the Dying'), lane: 'passThrough', arm: mockSpareTheDying, tuple: objTuple([]),
      before: [mockHeroism, mockHolyAura, mockLongstrider],
      after: [mockEnhanceAbility, ...ALL_DOWNSTREAM],
      order: [mockHeroism, mockHolyAura, mockLongstrider, mockSpareTheDying, triggerWildMagicSurge],
      wordBefore: false,
    },
    // Enhance Ability automation-null 5e only (2024 hijacked — reported).
    {
      spell: diskRow(spells5e, 'Enhance Ability'), lane: 'passThrough', arm: mockEnhanceAbility, tuple: objTuple(['metaCtx']),
      before: [mockHeroism, mockHolyAura, mockLongstrider, mockSpareTheDying],
      after: [...ALL_DOWNSTREAM],
      order: [mockHeroism, mockHolyAura, mockLongstrider, mockSpareTheDying, mockEnhanceAbility, triggerWildMagicSurge],
      wordBefore: false,
    },
  ];

  for (const row of rows) {
    it(`:316-320 passThrough lane — ${row.rules ?? '5e'} "${row.spell.name}" forwards result identity verbatim, outranks surge, never reaches :328+/:337/:341`, async () => {
      await runRow(row);
    });
  }
});

describe('executeSpellCast — noDamage tail arms after the :341 Healing-Word fire: protections (:345-347), Remove Curse (:351-355), Resistance (:359) swallow undefined and never reach the damage lane', () => {
  beforeEach(resetAllMocks);
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

  const posBuff = (spell, _meta, stats) => [spell, stats, CAMPAIGN, undefined, executeHandler];
  const posHeal = (spell, meta, stats) => [spell, meta, stats, CAMPAIGN, undefined];
  const objRes = (spell, meta, stats) => [{ spell, playerStats: stats, campaignName: CAMPAIGN, mapName: undefined, characters: undefined, executeHandler, metaCtx: meta }];

  const rows = [
    // Disk name bytes differ per ruleset (5e "Protection From Energy"); the
    // 5e byte-exact row is used. Disk automation non-null -> lightweight.
    {
      spell: lightweight(diskRow(spells5e, 'Protection From Energy')), lane: 'swallow', arm: mockProtectionFromEnergy, tuple: posBuff,
      before: [mockGenericAutomation, ...FIRST_TAIL, ...MASS_ARMS],
      after: [mockProtectionFromPoison, mockRemoveCurse, mockResistance],
      order: [...MASS_ARMS, triggerHealingWord, mockProtectionFromEnergy, triggerWildMagicSurge],
      wordBefore: true,
    },
    {
      spell: lightweight(diskRow(spells5e, 'Protection from Poison')), lane: 'swallow', arm: mockProtectionFromPoison, tuple: posBuff,
      before: [mockGenericAutomation, ...FIRST_TAIL, ...MASS_ARMS, mockProtectionFromEnergy],
      after: [mockRemoveCurse, mockResistance],
      order: [...MASS_ARMS, triggerHealingWord, mockProtectionFromEnergy, mockProtectionFromPoison, triggerWildMagicSurge],
      wordBefore: true,
    },
    {
      spell: lightweight(diskRow(spells5e, 'Remove Curse')), lane: 'swallow', arm: mockRemoveCurse, tuple: posHeal,
      before: [mockGenericAutomation, ...FIRST_TAIL, ...MASS_ARMS, mockProtectionFromEnergy, mockProtectionFromPoison],
      after: [mockResistance],
      order: [...MASS_ARMS, triggerHealingWord, mockProtectionFromEnergy, mockProtectionFromPoison, mockRemoveCurse, triggerWildMagicSurge],
      wordBefore: true,
      extra: () => {
        // REAL inline gate index.js:267-268 (not mocked — local function):
        // the :353 dispel fallback runs but its name gate declines
        // "Remove Curse", so triggerDispelMagic stays untouched.
        expect(triggerDispelMagic).toHaveBeenCalledTimes(0);
      },
    },
    {
      spell: lightweight(diskRow(spells5e, 'Resistance')), lane: 'swallow', arm: mockResistance, tuple: objRes,
      before: [mockGenericAutomation, ...FIRST_TAIL, ...MASS_ARMS, mockProtectionFromEnergy, mockProtectionFromPoison, mockRemoveCurse],
      after: [],
      order: [...MASS_ARMS, triggerHealingWord, mockProtectionFromEnergy, mockProtectionFromPoison, mockRemoveCurse, mockResistance, triggerWildMagicSurge],
      wordBefore: true,
    },
  ];

  for (const row of rows) {
    it(`:345-359 tail lane — lightweight "${row.spell.name}" intercepts after the :341 word fire, swallows undefined, short-circuits ${row.after.length ? `and skips [${row.after.length} later arm(s)}]` : 'as the final arm'}`, async () => {
      await runRow(row);
      if (row.extra) row.extra();
    });
  }
});
