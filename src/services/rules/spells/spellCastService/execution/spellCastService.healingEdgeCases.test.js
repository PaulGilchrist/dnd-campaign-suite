// @maintained-by-ai
/* ------------------------------------------------------------------ */
/*  executeSpellCast HEALING-LADDER EDGES (index.js :365-:460) —     */
/*  the arms index.genericHealFortified.test.js declares OUT OF SPAN */
/*  at its :56-59 ("440 slot guard, :444 spell.level fallback,     */
/*  :365 highestBelow, weak "max" branch — healingEdgeCases").    */
/*  Unit under test is ./index.js REAL: resolveGenericHeal,           */
/*  resolveHealExpression, runGenericHealPath, applyRolledHeal,       */
/*  applyMaxHeal-via-fallback, computeSpellStats (:191-:222) and the  */
/*  runNoDamagePath :337 gate. Sibling modules (triggerSpells /       */
/*  modalSpells / helpers / blockChecks / savePath / noSavePath /     */
/*  damageCalculation) and leaves (dice, bonus oracle, riders, log,   */
/*  store, combat ctx) are mocked — fortified-lane architecture       */
/*  (#1484), so every byte asserted here is index.js's own.           */
/*                                                                    */
/*  UNIQUENESS vs OWNERS (cite, do not re-grow): producers #1372/   */
/*  #1384/85/#1393/94/#1371; hub-compute/clamp #1455; genericHeal + */
/*  fortified latch + rider-merge-times-2 + :376 caster-maxHp + :378  */
/*  ??-full-HP + 'max' disk byte (2024 Resurrection {7:"max"}) —   */
/*  index.genericHealFortified.test.js; regenerate census + :0-       */
/*  silence contrast — helpers-regenerate.test.js; PW heal #1481 +   */
/*  spread #1487; both-rulesets ladder disk bytes #1365.              */
/*                                                                    */
/*  ROW DISPOSITIONS (owed owner redirects, this turn):               */
/*   - old :402-:416 (:440 throw)      -> STRENGTHENED row 1 (exact */
/*     message + console tuple + paid-before-zero-after census)       */
/*   - old :418-:433 (:444 fallback)   -> STRENGTHENED row 2 (disk   */
/*     Heal bytes, arms [null, 0] falsy-0-swallow, full tuples)      */
/*   - old :435-:450 (highestBelow)    -> STRENGTHENED row 3 (disk   */
/*     below-min null arm + synthetic gap-ladder highestBelow arm)   */
/*   - old :453-:473 (Regenerate)      -> DELETED per #1483 verbatim */
/*     "duplicates a weaker subset of the stamp/expiration           */
/*     censuses" — owners: helpers-regenerate.test.js (full census   */
/*     module-direct) + earlyReturns-noDamage.test.js (:278 hub       */
/*     intercept chain). arrayContaining/objectContaining purged.      */
/*   - old :477-:503 (Magic Missile)   -> DELETED; hub missile face  */
/*     CLOSED by spellCastService.missile.test.js T2 :403 (zero-count */
/*     target absent) + helpers-magicMissile.test.js :263 (zeroes     */
/*     skip cleanly). expect.anything() purged.                        */
/*   - old :505-:517 (ambush throw)    -> DELETED; hub twin already  */
/*     pinned exact-message + zero-side-effects by                     */
/*     execution-early-resolutions.test.js:362. NOTE for the owner:  */
/*     missile.test.js:99 cites THIS file for that twin — stale       */
/*     pointer, report-only (that file is out of scope).              */
/*   - old :519-:533 (spellCastingMod) -> replaced: the old name     */
/*     claimed "uses spellAbilities.modifier" but that is FALSE via */
/*     the real code (:212 truthy-miss skips the :217 else-if) and   */
/*     the assertion was bare toHaveBeenCalled() — suite-name-vs-     */
/*     behavior #1423/69 + vacuous. Row 4 pins the TRUE quirk byte.  */
/*   - old :535-:556 ("max" branch)    -> DELETED; folded-cite      */
/*     index.genericHealFortified.test.js Resurrection 2024 disk byte */
/*     {7:"max"} + its :394 cosmetic-fold quirk + M14 (#1484 owns   */
/*     gate/fold/identity there). Old fabricated Cure Wounds {1:'max'} */
/*     was a near-miss impersonation (not disk bytes) — purged.       */
/*   - old :558-:579 (innate advantage) -> DELETED; noSavePath.test- */
/*     .js T4 :265 pins forcedMode"advantage" + BASE_KEYS exact set */
/*     module-direct; spellStats.test.js :489 pins the hub gate      */
/*     tuple; execution-post-cast.test.js pins the hub forward.       */
/*                                                                    */
/*  FIXTURE INTEGRITY: REAL disk rows (spells.json, both catalogs    */
/*  existence-censused at load, #1494 form) drive rows 1-2 and 4 and  */
/*  the :446 arm of row 3. The one synthetic probe in row 3 is        */
/*  REQUIRED: no disk heal ladder has a gap (byte-verified: all 10    */
/*  heal_at_slot_level ladders are contiguous), so disk bytes alone   */
/*  cannot reach highestBelow without fabricating a ladder ON disk.   */
/*  The probe does not impersonate ("Probe Gap-Ladder Heal" is not */
/*  a disk spell) and its provenance is pinned live: the REAL          */
/*  lookupFullSpell console.errors the miss tuple, which row 3 asserts */
/*  verbatim. Campaign lockdown: "test-campaign" only. fetch is      */
/*  URL-aware (#1454): serves both REAL catalogs, unknown URLs throw.  */
/*                                                                    */
/*  NO-CLOCK POLICY: every spell here is instantaneous; Date.now()    */
/*  appears only as log timestamps (benign category). No durations, no */
/*  expiry numbers, no timers stored or asserted (#1489).             */
/*                                                                    */
/*  DEAD-MOCK AUDIT (#1484-95 family, incl. transitive): the old file */
/*  carried ~24 feature-service mocks consumed only by the REAL        */
/*  triggerSpells/modalSpells (fear, falseLife, fleshToStone,          */
/*  holdMonster, hypnoticPattern, massSuggestion, suggestion, otto-    */
/*  Dance, resilientSphere, foresight, rayOfEnfeeblement, globe,       */
/*  forcecage(+handler), heroism, holyAura, powerWordStun, see-        */
/*  invisibility, sleep, stinkingCloud, tashas, removeCurse, slow) —  */
/*  all DEAD once the parent modules are mocked (transitive graph      */
/*  check #1490); also purged: rangeValidation, expirations,           */
/*  applyDamage, combatData.loadCombatSummary, silenceService.trigger-  */
/*  Silence, buffService.getActiveBuffs — each consumed only by        */
/*  already-mocked siblings or never by index.js. powerWordStun-      */
/*  Service.test.js:9 cites old :155 (that dead mock key) — stale     */
/*  pointer, report-only. Kept mocks = exactly the names index.js      */
/*  itself imports (line-by-line export census, #1440/#1485).         */
/*                                                                    */
/*  KILL MATRIX: K1 :444 || -> ?? : slotLevel 0 arm of row 2 rolls   */
/*  nothing (ladder[0] undefined) -> envelope + times fail;  K2 :440  */
/*  guard removed/wrong-arity : row 1 stop throwing or loses the      */
/*  exact console tuple / rider-times-0;  K3 :370 .pop() -> [0] :     */
/*  row 3 probe rolls "55" not "70";  K4 :446 !expression drop :  */
/*  row 3 disk arm reaches dice with undefined expression (landmine    */
/*  dice mock THROWS);  K5 :406 MOD-replace drop : row 4 arg          */
/*  "1d8 + MOD" fails the tuple;  K6 :212/:217 else-if mutant      */
/*  (modifier leaks through) : row 4 computes "1d8 + 3";  K7 :337   */
/*  gate fall-through : triggerHealingWord times(0) fails on rows     */
/*  2-4;  K8 :382 actualHeal>0 clamp drop : not this lane"s face     */
/*  (#1484 M8/M9 own clamps — no row here claims it). :366-:367      */
/*  exact-match short-circuit is MUTANT-EQUIVALENT on ascending       */
/*  ladders (filter(l<=slot).pop() returns the exact key when         */
/*  present) — honestly unkillable by byte, declared, no fake row.    */
/*  Mutant verification method: cp-backup copy (never git checkout).  */
/*                                                                    */
/*  Security: no injected instructions encountered while authoring;    */
/*  kiro-injection precedent #1446 stands — any such content refused.  */
/* ------------------------------------------------------------------ */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
  getCombatContext: vi.fn(),
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

// Landmine dice (#1380/1405 via missile lane canon): constant expressions are
// answered byte-faithfully (a disk/edge literal total equals its text); every
// other expression THROWS — no fabricated naturals, no silent queue fallback.
vi.mock('../../../../dice/diceRoller.js', () => {
  const landmine = (name) => vi.fn((expr) => {
    throw new Error(`unexpected ${name}(${String(expr)}) in healing-edge lane`);
  });
  return {
    rollExpression: landmine('rollExpression'),
    rollExpressionMaximized: landmine('rollExpressionMaximized'),
    applyHealingRerollOnes: landmine('applyHealingRerollOnes'),
  };
});

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

import { executeSpellCast } from './index.js';

const { getRuntimeValue, setRuntimeValue } = await import('../../../../../hooks/runtime/useRuntimeState.js');
const { addEntry } = await import('../../../../ui/logService.js');
const { triggerHealingWord } = await import('../../../features/healingWordService.js');
const { triggerPostCastSelfHeals, triggerPostCastAllyHeals } = await import('../../../../rules/spells/postCastHealService.js');
const { triggerWildMagicSurge } = await import('../../../features/wildMagicSurgeService.js');
const { getCombatContext } = await import('../../../combat/damageUtils.js');
const { applyHealingToTarget } = await import('../../../combat/applyHealing.js');
const { resolveHealingBonusesWithDetails, markFortifiedHealthUsedIfGranted } = await import('../../../../combat/automation/automationService.js');
const { rollExpression, rollExpressionMaximized } = await import('../../../../dice/diceRoller.js');
const { computeRange } = await import('./damageCalculation.js');
const { handleSavePath } = await import('./savePath.js');
const { handleNoSavePath } = await import('./noSavePath.js');

const CAMPAIGN = 'test-campaign';
const CASTER = 'Healing_Edge_Cleric';
const TARGET = 'Healing_Edge_Target';
const COMBAT_CTX = { round: 3 };

function diskRow(list, name) {
  const row = list.find((s) => (s.name || '').toLowerCase() === name.toLowerCase());
  if (!row) throw new Error(`REAL disk row missing: ${name}`);
  return row;
}

// Existence census at load (#1494 form): every disk byte this file leans on.
const DISK_HEAL = diskRow(spells5e, 'Heal');
const DISK_CURE = diskRow(spells5e, 'Cure Wounds');
const DISK_CURE_2024 = diskRow(spells2024, 'Cure Wounds');
if (DISK_HEAL.level !== 6 || DISK_HEAL.heal_at_slot_level['6'] !== '70') {
  throw new Error('disk bytes moved: Heal must stay level 6 with {6:"70"}');
}
if (DISK_CURE.heal_at_slot_level['1'] !== '1d8 + MOD') {
  throw new Error('disk bytes moved: 5e Cure Wounds must stay {1:"1d8 + MOD"}');
}
if (DISK_CURE_2024.heal_at_slot_level['1'] !== '2d8 + MOD') {
  throw new Error('disk bytes moved: 2024 Cure Wounds must stay {1:"2d8 + MOD"}');
}
// Byte-verified fixture premise (header): no disk heal ladder is sparse, so
// highestBelow requires the synthetic probe in row 3.
for (const s of [...spells5e, ...spells2024]) {
  const h = s.heal_at_slot_level;
  if (!h) continue;
  const ks = Object.keys(h).map(Number).sort((a, b) => a - b);
  if (ks.some((k, i) => i > 0 && k !== ks[i - 1] + 1)) {
    throw new Error(`fixture premise broken: ${s.name} now has a SPARSE heal ladder — row 3 may switch to disk bytes`);
  }
}

function casterStats(overrides = {}) {
  return {
    name: CASTER,
    rules: '5e',
    abilities: [{ name: 'Intelligence', bonus: 5 }],
    proficiency: 4,
    spellAbilities: { spellCastingAbility: 'Intelligence', toHit: 9, saveDc: 17, modifier: 3 },
    automation: { passives: [] },
    hitPoints: 100,
    level: 15,
    ...overrides,
  };
}

function makeServices(caster) {
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
    characters: [{ name: TARGET, type: 'player' }],
  };
}

function runtimeReads({ maxHp = 100, currentHp = 20 } = {}) {
  return (_who, key) => {
    if (key === 'activeConditions' || key === 'targetEffects') return [];
    if (key === 'hitPoints') return maxHp;
    if (key === 'currentHitPoints') return currentHp;
    return undefined;
  };
}

// Strips the nondeterministic timestamp but pins presence + campaign scope.
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

const castLogOf = (spell, spellLevel) => ({
  type: 'spell',
  characterName: CASTER,
  targetName: TARGET,
  spellName: spell.name,
  spellLevel,
  castingTime: spell.casting_time,
  damageType: null,
  damageFormula: null,
  saveDC: null,
  concentration: !!spell.concentration,
  description: (spell.description || []).join(' ') || null,
});

const diceEnvelope = (formula, rolls, healAmount, rawTotal) => ({
  targetName: TARGET,
  healAmount,
  formula,
  rolls,
  rawTotal,
  bonusHeal: 0,
  bonusDetails: [],
  healingRerollOriginalRolls: null,
  healingRerollDisplayRolls: rolls,
});

const hpLogOf = (spell, { delta, currentHp, maxHp, formula }) => ({
  type: 'hp_change',
  targetName: TARGET,
  delta,
  currentHp,
  maxHp,
  isHealing: true,
  sourceName: CASTER,
  note: spell.name,
  formula,
  bonusDetails: undefined,
});

let consoleError;

beforeEach(() => {
  vi.clearAllMocks();
  // #1454 URL-aware fetch stub: REAL lookupFullSpell resolves both catalogs
  // from the same imported disk bytes; unknown URLs reject loudly.
  vi.stubGlobal('fetch', vi.fn(async (url) => ({
    ok: true,
    json: async () => (String(url).includes('/2024/') ? spells2024 : spells5e),
  })));
  consoleError = vi.spyOn(console, 'error');
  getRuntimeValue.mockImplementation(runtimeReads());
  getCombatContext.mockResolvedValue(COMBAT_CTX);
  rollExpression.mockImplementation((expr) => {
    const m = /^(\d+)$/.exec(String(expr));
    if (m) return { total: Number(m[1]), rolls: [Number(m[1])] };
    throw new Error(`unpinned rollExpression(${String(expr)})`);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  consoleError.mockRestore();
});

describe('executeSpellCast heal-slot ladder edges (index.js :365-:446) — the arms fortified declares out-of-span', () => {
  it(':440 throw row: disk-Heal probe with level:null + slotLevel:null rejects with the exact guard message, stamps the exact console tuple, pays ONLY the pre-throw census, and every heal/post-cast collaborator stays at zero', async () => {
    // Provenance: every REAL disk heal row carries an integer level, so the
    // :440 double-null arm is only reachable via a disk-derived null-level
    // clone (non-impersonating input edge: the name still resolves on disk).
    const probe = { ...DISK_HEAL, level: null };
    const services = makeServices(casterStats());

    const err = await executeSpellCast(probe, { slotLevel: null, targetName: TARGET }, services).catch((e) => e);

    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('slot level is required for healing spell');
    expect(consoleError.mock.calls).toEqual([
      ['[spellCast] executeSpellCast: slot level is missing (metaCtx.slotLevel and spell.level) for healing spell'],
    ]);
    // Paid before the throw (:671-:698): antimagic read, ambush read, the
    // REAL psychicSpellsConfig store read (:685), hostile side-effect stamp,
    // and exactly the generic cast log — spellLevel
    // spell.level || 0 lands the probe null as 0. Sanctuary read (:563) is
    // post-cast and never happens because the throw outruns :720.
    expect(getRuntimeValue.mock.calls).toEqual([
      ['campaign', 'targetEffects'],
      [CASTER, 'activeConditions', CAMPAIGN],
      [CASTER, 'activeBuffs', CAMPAIGN],
    ]);
    expect(setRuntimeValue.mock.calls).toEqual([[CASTER, 'lastActionSpellCast', 1, CAMPAIGN]]);
    expect(loggedEntries()).toEqual([castLogOf(probe, 0)]);
    // Zero after the throw: bonus oracle, dice, HP bounds, combat producer,
    // latch, :472/:475 path riders (:468 threw first), :341 healing word,
    // and every :720 post-cast rider/merge byte.
    expect(resolveHealingBonusesWithDetails).not.toHaveBeenCalled();
    expect(rollExpression).not.toHaveBeenCalled();
    expect(rollExpressionMaximized).not.toHaveBeenCalled();
    expect(getCombatContext).not.toHaveBeenCalled();
    expect(applyHealingToTarget).not.toHaveBeenCalled();
    expect(markFortifiedHealthUsedIfGranted).not.toHaveBeenCalled();
    expect(triggerHealingWord).not.toHaveBeenCalled();
    expect(triggerPostCastSelfHeals).not.toHaveBeenCalled();
    expect(triggerPostCastAllyHeals).not.toHaveBeenCalled();
    expect(triggerWildMagicSurge).not.toHaveBeenCalled();
    expect(computeRange).not.toHaveBeenCalled();
    expect(handleSavePath).not.toHaveBeenCalled();
    expect(handleNoSavePath).not.toHaveBeenCalled();
    expect(services.rollAttack).not.toHaveBeenCalled();
    expect(services.rollDamage).not.toHaveBeenCalled();
  });

  it(':444 fallback row: REAL disk Heal ({6:"70"}) with slotLevel null AND falsy-0 both resolve to spell.level 6 — K1 kills ||->??, both arms roll byte-faithful "70" through the full exact write/log/order census', async () => {
    for (const slotArm of [null, 0]) {
      vi.clearAllMocks();
      getRuntimeValue.mockImplementation(runtimeReads());
      const services = makeServices(casterStats());

      const result = await executeSpellCast(DISK_HEAL, { slotLevel: slotArm, targetName: TARGET }, services);

      expect(rollExpression).toHaveBeenCalledTimes(1);
      expect(rollExpression).toHaveBeenCalledWith('70');
      expect(rollExpressionMaximized).not.toHaveBeenCalled();
      expect(resolveHealingBonusesWithDetails).toHaveBeenCalledWith(
        services.playerStats,
        { prof: 4, level: 15, slotLevel: 6, campaignName: CAMPAIGN, targetStats: services.characters[0] },
      );
      // gap = 100 - 20 = 80; heal 70 lands unclamped at 90.
      expect(result).toStrictEqual(diceEnvelope('70', [70], 70, 70));
      expect(getCombatContext).toHaveBeenCalledWith(CAMPAIGN);
      expect(applyHealingToTarget).toHaveBeenCalledWith(COMBAT_CTX, TARGET, 70, CAMPAIGN);
      expect(markFortifiedHealthUsedIfGranted).toHaveBeenCalledWith([], services.playerStats, services.characters[0], CAMPAIGN);
      expect(loggedEntries()).toEqual([
        castLogOf(DISK_HEAL, 6),
        hpLogOf(DISK_HEAL, { delta: 70, currentHp: 90, maxHp: 100, formula: '70' }),
      ]);
      // :337 return outruns :341 — healing word never fires on a consumed
      // generic heal (and the 2-arg store reads at :376/:378 are pinned by
      // the exact call sequence below).
      expect(triggerHealingWord).not.toHaveBeenCalled();
      expect(getRuntimeValue.mock.calls).toEqual([
        ['campaign', 'targetEffects'],
        [CASTER, 'activeConditions', CAMPAIGN],
        [CASTER, 'activeBuffs', CAMPAIGN],
        [TARGET, 'hitPoints'],
        [TARGET, 'currentHitPoints'],
        ['campaign', 'targetEffects'],
      ]);
      expect(setRuntimeValue.mock.calls).toEqual([[CASTER, 'lastActionSpellCast', 1, CAMPAIGN]]);
      expectAscending([rollExpression, getCombatContext, applyHealingToTarget, markFortifiedHealthUsedIfGranted]);
    }
  });

  it('expression-resolution arms: disk Heal at slot 5 (below ladder min 6) returns null with a zero-heal census while riders still run once, and a synthetic gap-ladder probe at slot 7 takes the HIGHEST tier at or below ("70", not "55" — K3 kills .pop()->[0])', async () => {
    const services = makeServices(casterStats());

    // Arm 1 — :446 null-expression on REAL disk bytes: no oracle, no dice,
    // no HP read for the target, no combat write, no log beyond the cast,
    // no latch, no healing-word (:337 precedes :341) — yet :470/:473 fire once
    // inside runGenericHealPath (fix#121(b) flags healRidersRun:'pair' — the
    // merged :519/:522 re-fire is retired) and the lane value stays null.
    const nullResult = await executeSpellCast(DISK_HEAL, { slotLevel: 5, targetName: TARGET }, services);
    expect(nullResult).toBe(null);
    expect(resolveHealingBonusesWithDetails).not.toHaveBeenCalled();
    expect(rollExpression).not.toHaveBeenCalled();
    expect(getCombatContext).not.toHaveBeenCalled();
    expect(applyHealingToTarget).not.toHaveBeenCalled();
    expect(markFortifiedHealthUsedIfGranted).not.toHaveBeenCalled();
    expect(triggerHealingWord).not.toHaveBeenCalled();
    expect(triggerPostCastSelfHeals).toHaveBeenCalledTimes(1);
    expect(triggerPostCastAllyHeals).toHaveBeenCalledTimes(1);
    expect(triggerWildMagicSurge).toHaveBeenCalledTimes(1);
    expect(loggedEntries()).toEqual([castLogOf(DISK_HEAL, 6)]);
    expect(getRuntimeValue.mock.calls).toEqual([
      ['campaign', 'targetEffects'],
      [CASTER, 'activeConditions', CAMPAIGN],
      [CASTER, 'activeBuffs', CAMPAIGN],
      ['campaign', 'targetEffects'],
    ]);

    // Arm 2 — synthetic probe, provenance in the header: required because
    // every disk heal ladder is contiguous (load-time byte census above),
    // so :369-:370 highestBelow is disk-unreachable. Non-impersonating
    // name; its disk MISS is itself pinned as the provenance tuple.
    vi.clearAllMocks();
    getRuntimeValue.mockImplementation(runtimeReads({ maxHp: 100, currentHp: 45 }));
    const probe = {
      name: 'Probe Gap-Ladder Heal', level: 6, school: 'Evocation',
      casting_time: '1 action', components: ['V', 'S'], range: 'touch',
      heal_at_slot_level: { 5: '55', 6: '70', 8: '90' },
    };

    const result = await executeSpellCast(probe, { slotLevel: 7, targetName: TARGET }, services);

    expect(rollExpression).toHaveBeenCalledTimes(1);
    expect(rollExpression).toHaveBeenCalledWith('70');
    // gap = 100 - 45 = 55 -> the 70-byte heal clamps to 55 (edge byte here,
    // clamp machinery owned by #1484 M8/M9).
    expect(result).toStrictEqual(diceEnvelope('70', [70], 55, 70));
    expect(applyHealingToTarget).toHaveBeenCalledWith(COMBAT_CTX, TARGET, 55, CAMPAIGN);
    expect(markFortifiedHealthUsedIfGranted).toHaveBeenCalledWith([], services.playerStats, services.characters[0], CAMPAIGN);
    expect(loggedEntries()).toEqual([
      castLogOf(probe, 6),
      hpLogOf(probe, { delta: 55, currentHp: 100, maxHp: 100, formula: '70' }),
    ]);
    expect(consoleError.mock.calls).toEqual([
      ['[spellCast] Spell not found in spells.json:', probe.name],
    ]);
  });

  it('QUIRK spellCastingMod (:212/:217): cantripSpellAbility truthy-but-absent-from-abilities skips the else-if — REAL disk Cure Wounds rolls "1d8 + 0", never "1d8 + 3" (K5/K6)', async () => {
    // spellAbilities.modifier 3 is UNREACHABLE here: :212 is truthy
    // ('Strength') so the :217 else-if that would read it never runs.
    // The old suite name claimed the opposite; this is the true byte.
    const spell = { ...DISK_CURE, spellCastingAbility: 'Strength' };
    const services = makeServices(casterStats());
    rollExpression.mockReturnValue({ total: 6, rolls: [6] });

    const result = await executeSpellCast(spell, { slotLevel: 1, targetName: TARGET }, services);

    expect(rollExpression).toHaveBeenCalledTimes(1);
    expect(rollExpression).toHaveBeenCalledWith('1d8 + 0');
    expect(result).toStrictEqual(diceEnvelope('1d8 + 0', [6], 6, 6));
    expect(applyHealingToTarget).toHaveBeenCalledWith(COMBAT_CTX, TARGET, 6, CAMPAIGN);
    expect(loggedEntries()).toEqual([
      castLogOf(spell, 1),
      hpLogOf(spell, { delta: 6, currentHp: 26, maxHp: 100, formula: '1d8 + 0' }),
    ]);
    expect(consoleError).not.toHaveBeenCalled();
  });
});
