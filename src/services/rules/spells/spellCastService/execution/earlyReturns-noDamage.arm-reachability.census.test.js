// @maintained-by-ai
/* ------------------------------------------------------------------ */
/*  fix#355(a)/(c) — noDamageTriggers ARM-REACHABILITY CENSUS +      */
/*  healRidersRun STAMP-CHAIN AUDIT PINS (execution/index.js)        */
/*                                                                     */
/*  Stamp discharged (ledger :1580 QUEUED-OWNER-LIVE fix#337S,        */
/*  owner-pass fix#355): the reachability split the host comments      */
/*  byte-admit (:317 Fear 'ABSENT from SERVICE_HANDLED_SPELLS',       */
/*  :404 mass legs 'DEAD — both disk rows carry automation.type') is  */
/*  adjudicated ARM BY ARM below on CURRENT bytes. Verdict: every     */
/*  surviving arm is LIVE — arms for disk-absent names: ZERO (all 39   */
/*  gate-names have >=1 real disk row; conjure volley is 2024-disk-   */
/*  only, live there). arms live-but-wrong: ZERO (no silent-dud: the  */
/*  regenerate-class dud of fix#132 needed a shield, present and        */
/*  byte-integrity-scanned below; every :710-hijacked type resolves a  */
/*  LIVE HANDLER_MAP handler — earlyReturns-generic.test.js:288 owns   */
/*  the standing 43+77-row consumption census). arms live-correct:     */
/*  ALL — pinned here per equivalence class (arm-pin = dispatch         */
/*  reaches). DELETED arms (fix#296/#121(c)) stay dead: source-scan   */
/*  census pin below flips red on resurrection.                        */
/*                                                                     */
/*  ARM TABLE (current index.js bytes, disk facts from real both-      */
/*  ruleset JSON rows, disk 331/393 rows):                            */
/*   S=shielded (SERVICE_HANDLED_SPELLS -> :710 declines, arm is home)*/
/*   D=disk automation.type ABSENT -> :710 declines, arm disk-home     */
/*   H=disk automation.type -> :710 consumes disk bytes; arm =           */
/*     lightweight :163 home ({name, level, baseLevel} free-cast shape) */
/*   :314 Regenerate        S both (healing_start_of_turn, fix#132)    */
/*   :325 Conjure Volley    D 2024-only (5e ABSENT disk — reported)    */
/*   :326 See Invisibility  H both (temp_buff)   :327 FleshToStone H   */
/*   :328 HoldMonster       D 5e / H 2024 (hold_monster)                */
/*   :329 Banishment        D 5e / H 2024   :341 Maze D 5e / H 2024    */
/*   :342 PowerWordStun     D both          :350 Slow H both            */
/*   :351 Bane D both       :352 Bless D both                          */
/*   :353 BeaconOfHope      H both (beacon_of_hope)                     */
/*   :364 Suggestion        H both (suggestion; disk twin was :293,     */
/*                          the LIVE name-gate survives per fix#296)    */
/*   :365 Command           S+D (shield + auto ABSENT)                   */
/*   :366 OttoDance         S (5e 'irresistible dance'/2024 otto's)     */
/*   :367 ResilientSphere   S   :368 Blur S+D   :369 ExpRetreat S+D    */
/*   :370 Friends           S+D  :371 CrownOfMadness S (2024-only disk) */
/*   :372 AnimalFriendship  S+D  :373-:375 Dominate* S (5e monster H)  */
/*   :376 RayOfEnfeebl.     S+D  :377 CompelledDuel D both              */
/*   :378 Globe             H both  :379 Forcecage H both                */
/*   :380 Silence           D both  :381 StinkingCloud D 2024 (5e row   */
/*                          carries poison damage — damage-lane home)    */
/*   :382 SleetStorm        D both  :383 FaerieFire D both              */
/*   :384 Tashas           S (2024-only disk; 5e 'hideous laughter')    */
/*   :385 Imprisonment      D 5e / H 2024   :386 Heroism H both         */
/*   :387 HolyAura          H both  :388 Longstrider D both              */
/*   :389 SpareTheDying     D 5e / H 2024   :390 EnhanceAbility H 2024 */
/*  chain-2 (:398): :402 MassCureWounds D 5e -> flags healRidersRun:   */
/*  'self' (massCureWoundsService.js:126 fires SELF only) / H 2024 via  */
/*  :872; :414 FalseLife D both. DELETED legs stay deleted: Mass       */
/*  Healing Word + Prayer of Healing (fix#121(c) — tripwired here AND   */
/*  in earlyReturns-noDamage-healing.test.js:363-:371).                 */
/*                                                                     */
/*  fix#355(c) STAMP-CHAIN AUDIT (ledger :1612 — the ONLY idempotency */
/*  mechanism for generic-heal self/ally rider double-fire):            */
/*  PRODUCER -> FLAG map, audited at bytes:                            */
/*   runGenericHealPath fires PAIR (:594 self + :597 ally) -> 'pair'   */
/*   massCureWoundsService.js:126 SELF-only -> 'self' (:402 arm; the   */
/*    arm's bare handled:true is paired with the flag at :402)         */
/*   massHealUtils.js:220 confirmFn SELF-only -> 'self' (:872, set     */
/*    MASS_HEAL_CONFIRM_AUTOMATION_TYPES = mass_healing_word +          */
/*    prayer_of_healing + mass_cure_wounds — EXACTLY the three          */
/*    createMassHealHandler consumers, grep-census 2026-10-24)           */
/*   mass_heal (Mass Heal) is DIFFERENT code: massHealHandler.js has   */
/*    ZERO rider imports (byte-scanned below) -> flag correctly absent, */
/*    merged block fires the pair ONCE — the set's exclusion is by     */
/*    design, pinned. No other production rider call sites exist        */
/*    (repo grep: postCastHealService consumers = host + the two cited) */
/*  CONSUMER -> DEFER map (:647/:653): 'pair' defers both legs,        */
/*  'self' defers self only, undefined defers nothing; threads through */
/*  runPostCastTriggersMerged at :881/:890. VERDICT: chain INTACT —   */
/*  zero missing wires, zero never-clearing flags (healRidersRun is    */
/*  PER-CALL, never persisted — getRuntimeValue census below); no      */
/*  host edit was lawful: editing a verified-intact sanctioned chain    */
/*  would be fabrication. The lawful action is the pin.                  */
/*                                                                     */
/*  Fixtures: REAL disk bytes both rulesets (#1455 fabrication ban);   */
/*  lightweight envelopes mirror useActionSpellMetamagic.js:163          */
/*  {name, level, baseLevel} VERBATIM shape; fetch stubbed to disk.    */
/*  handleGenericAutomation runs as a BYTE-FAITHFUL replica of          */
/*  triggerSpells.js :472-:488 (the REAL-gate census is owned by        */
/*  earlyReturns-generic.test.js:288 — sole-owner #1350); its shield    */
/*  set is integrity-scanned against the triggerSpells.js source here.  */
/*  handleConjureVolley + handleSilence run REAL (closes the lane-      */
/*  header REPORTED gap in earlyReturns-noDamage.test.js:66-:67 'no     */
/*  lane executes REAL ... producer bytes'). Campaign: test-campaign.   */
/*  NO-CLOCK: pure dispatch pins; zero timers.                          */
/* ------------------------------------------------------------------ */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cloneDeep } from 'lodash';
import spells5e from '../../../../../../public/data/spells.json';
import spells2024 from '../../../../../../public/data/2024/spells.json';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/* ------------------------------------------------------------------ */
/*  Mocks — complete factory block (spellStats.test.js :66-:262 form), */
/*  with THREE deliberate deviations: combatData serves a real-shaped   */
/*  summary for the REAL silence producer; ./modalSpells.js is PARTIAL  */
/*  (conjure volley + silence REAL); ./triggerSpells.js is a BYTE-     */
/*  FAITHFUL replica of the :472-:488 generic gate, everything else    */
/*  counted decline.                                                     */
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
  triggerPostCastAllyHeals: vi.fn(() => Promise.resolve(null)),
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

vi.mock('../../../combat/buffs/buffService.js', () => ({
  isInnateSorceryActive: vi.fn(() => false),
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

// REAL producer boundary for shapechange internals (earlyReturns-modal :193 precedent).
vi.mock('../../../../automation/handlers/spells/shapechangeHandler.js', () => ({
  handle: vi.fn(() => Promise.resolve(null)),
}));

// PARTIAL modalSpells: REAL handleConjureVolley + REAL handleSilence
// (the fix#355(a) producer-byte closure); every other early name stays a
// declined mock — their REAL producer bytes are owned by the sibling lanes
// named in earlyReturns-modal.test.js:17-:28.
vi.mock('./modalSpells.js', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    handlePowerWordHeal: vi.fn(() => Promise.resolve({ handled: false })),
    handlePowerWordKill: vi.fn(() => Promise.resolve({ handled: false })),
    handleMassSuggestion: vi.fn(() => ({ handled: false })),
    handleCalmEmotions: vi.fn(() => ({ handled: false })),
    handleHypnoticPatternEarly: vi.fn(() => ({ handled: false })),
    handleConfusionEarly: vi.fn(() => ({ handled: false })),
    handleShapechange: vi.fn(() => ({ handled: false })),
    handleSleep: vi.fn(() => ({ handled: false })),
  };
});

// Byte-faithful replica of triggerSpells.js:472-:488 handleGenericAutomation
// + the verbatim SERVICE_HANDLED_SPELLS literals (:42-:65, integrity-scanned
// against the source file below). All other exports: counted decline.
const SERVICE_HANDLED_SPELLS = new Set([
  "otto's irresistible dance", 'irresistible dance',
  "otiluke's resilient sphere", 'resilient sphere',
  'blur',
  'expeditious retreat',
  'friends',
  'crown of madness',
  'animal friendship',
  'dominate beast',
  'dominate monster',
  'dominate person',
  "tasha's hideous laughter", 'hideous laughter',
  'ray of enfeeblement',
  'hex',
  'command',
  'regenerate', // fix#132 shield byte (ledger :1640 fix#211 family)
]);

vi.mock('./triggerSpells.js', () => {
  const make = () => vi.fn(() => Promise.resolve({ handled: false }));
  const names = [
    'handleRegenerate', 'handleSeeInvisibility', 'handleFleshToStone', 'handleHoldMonster',
    'handleBanishment', 'handleConfusion', 'handleMaze', 'handlePowerWordStun',
    'handleHypnoticPattern', 'handleSlow', 'handleBane', 'handleBless', 'handleBeaconOfHope',
    'handleMassSuggestion', 'handleSuggestion', 'handleCommand', 'handleOttoDance',
    'handleResilientSphere', 'handleBlur', 'handleExpeditiousRetreat', 'handleFriends',
    'handleCrownOfMadness', 'handleAnimalFriendship', 'handleDominateBeast',
    'handleDominateMonster', 'handleDominatePerson', 'handleRayOfEnfeeblement',
    'handleCompelledDuel', 'handleGlobeOfInvulnerability', 'handleForcecage',
    'handleStinkingCloud', 'handleSleetStorm', 'handleFaerieFire',
    'handleTashasHideousLaughter', 'handleImprisonment', 'handleHeroism', 'handleHolyAura',
    'handleLongstrider', 'handleSpareTheDying', 'handleEnhanceAbility',
    'handleMassCureWounds', 'handleMassHealingWord', 'handlePrayerOfHealing',
    'handleFalseLife', 'handleRemoveCurse', 'handleProtectionFromEnergy',
    'handleProtectionFromPoison', 'handleResistance',
  ];
  const out = {};
  for (const n of names) out[n] = make();
  // MIRRORS triggerSpells.js:472-:488 verbatim gate + envelope.
  out.handleGenericAutomation = vi.fn(async ({ spell, executeHandler, playerStats, campaignName, mapName, characters, metaCtx }) => {
    const spellNameLower = (spell.name || '').toLowerCase();
    if (spell.automation?.type && !spell.automation?.effects?.fail && !spell.automation?.effects?.success && !SERVICE_HANDLED_SPELLS.has(spellNameLower)) {
      const action = {
        name: spell.name,
        spell: spell,
        automation: spell.automation,
        metaCtx: { ...metaCtx },
      };
      const handlerResult = await executeHandler(action, playerStats, campaignName, mapName, characters);
      if (handlerResult) {
        return { handled: true, result: { automationPopup: handlerResult } };
      }
      return { handled: true };
    }
    return { handled: false };
  });
  return out;
});

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

// Silence REAL producer consumes the summary — serve the combat shape.
vi.mock('../../../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({ creatures: [{ name: 'Goblin' }], players: [] })),
}));

/* ------------------------------------------------------------------ */
/*  SUT + seams                                                        */
/* ------------------------------------------------------------------ */

import { executeSpellCast } from './index.js';

const { executeHandler } = await import('../../../../automation/index.js');
const { getRuntimeValue } = await import('../../../../../hooks/runtime/useRuntimeState.js');
const { triggerPostCastSelfHeals, triggerPostCastAllyHeals } = await import('../../../../rules/spells/postCastHealService.js');
const { triggerWildMagicSurge } = await import('../../../features/wildMagicSurgeService.js');
const { triggerHealingWord } = await import('../../../features/healingWordService.js');
const modal = await import('./modalSpells.js');
const ts = await import('./triggerSpells.js');

const CAMPAIGN = 'test-campaign'; // campaign lockdown

function diskRow(name, year = '5e') {
  const arr = year === '2024' ? spells2024 : spells5e;
  const row = arr.find(s => s.name === name);
  if (!row) throw new Error(`disk drift: '${name}' missing from ${year} spells.json`);
  return cloneDeep(row);
}

// VERBATIM lightweight free-cast envelope shape (useActionSpellMetamagic.js:163).
const lightweight = (name, level = 2) => ({ name, level, baseLevel: level === 0 ? 0 : level });

function makeCaster() {
  return {
    name: 'ArmCensusCaster',
    abilities: [
      { name: 'Strength', bonus: -1 }, { name: 'Dexterity', bonus: 1 },
      { name: 'Constitution', bonus: 2 }, { name: 'Intelligence', bonus: 5 },
      { name: 'Wisdom', bonus: 3 }, { name: 'Charisma', bonus: 4 },
    ],
    proficiency: 4,
    spellAbilities: { spellCastingAbility: 'Intelligence', toHit: 99, saveDc: 17, modifier: 5 },
    automation: { passives: [] },
    hitPoints: 100,
    level: 10,
  };
}

function services() {
  return {
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    playerStats: makeCaster(),
    getTargetInfo: async () => ({ name: 'Goblin' }),
    campaignName: CAMPAIGN,
    mapName: 'test-map',
    characters: [],
  };
}

// :710 generic-consumption marker: the EXACT replica envelope shape
// (triggerSpells.js:475-:480 key order) — early name-gated executeHandler
// consumers (heroism-style, no metaCtx key) never match it.
const genericDispatches = () => executeHandler.mock.calls.filter(([a]) =>
  a && Object.keys(a).join('|') === 'name|spell|automation|metaCtx');

// Mock-cross-talk law (#1440 family): every arm mock is name-BLIND at this
// boundary, so each cast must decline-all first, then arm EXACTLY the one
// under test. handleGenericAutomation keeps its faithful replica impl.
const declineAll = () => {
  for (const [k, fn] of Object.entries(ts)) {
    if (k !== 'handleGenericAutomation' && typeof fn?.mockResolvedValue === 'function') fn.mockResolvedValue({ handled: false });
  }
};
const arm = (key, result = undefined) => {
  declineAll();
  ts[key].mockResolvedValue({ handled: true, result });
};

beforeEach(() => {
  vi.clearAllMocks(); // clears calls/results but KEEPS per-test mockResolvedValues ->
  // re-arm every counted decline mock to its factory default so an arm armed in one
  // test cannot hijack a later test's chain (mock-cross-talk is a lane defect, #1440).
  for (const [k, fn] of Object.entries(ts)) {
    if (k !== 'handleGenericAutomation' && typeof fn?.mockResolvedValue === 'function') fn.mockResolvedValue({ handled: false });
  }
  for (const fn of Object.values(modal)) {
    if (typeof fn?.mockResolvedValue === 'function') fn.mockResolvedValue({ handled: false });
  }
  triggerWildMagicSurge.mockResolvedValue(null);
  triggerPostCastAllyHeals.mockResolvedValue(null);
  executeHandler.mockResolvedValue(undefined);
  globalThis.fetch = vi.fn(async (url) => ({
    ok: true,
    json: async () => (url.includes('/2024/') ? spells2024 : spells5e),
  }));
});

/* ------------------------------------------------------------------ */
/*  fix#355(a) — live-arm reachability pins, per equivalence class.  */
/* ------------------------------------------------------------------ */

describe('fix#355(a) arm-reachability — class S: SERVICE_HANDLED_SPELLS shields route disk bytes to the ARM', () => {
  it('Regenerate disk bytes BOTH rulesets (automation.type healing_start_of_turn, shielded at triggerSpells.js:64): the :314 arm fires once, :710 generic dispatch is ZERO — the fix#132 shield is the live home', async () => {
    arm('handleRegenerate', { type: 'popup', payload: { note: 'regen' } });
    for (const year of ['5e', '2024']) {
      executeHandler.mockReset(); executeHandler.mockResolvedValue(undefined);
      ts.handleRegenerate.mockClear();
      const row = diskRow('Regenerate', year);
      expect(row.automation?.type).toBe('healing_start_of_turn'); // shield premise
      const result = await executeSpellCast(cloneDeep(row), { targetName: 'Goblin' }, services());
      expect(ts.handleRegenerate, `${year} arm dispatch`).toHaveBeenCalledTimes(1);
      expect(genericDispatches(), `${year} shielded name must NOT hit :710`).toHaveLength(0);
      // passThrough transport: the consumed lane keeps its own visible payload
      // (:712-era CLA-389 merge precedence, hasVisibleCastPayload).
      expect(result).toEqual({ type: 'popup', payload: { note: 'regen' } });
    }
  });

  it("Otto's Irresistible Dance 2024 shielded byte (auto ottos_dance) reaches the :366 arm while 5e 'Irresistible Dance' (auto ottos_dance, shielded) reaches it too — zero generic consumption either side", async () => {
    arm('handleOttoDance');
    const row24 = diskRow("Otto's Irresistible Dance", '2024');
    expect(row24.automation?.type).toBe('ottos_dance');
    await executeSpellCast(cloneDeep(row24), { targetName: 'Goblin' }, services());
    expect(ts.handleOttoDance).toHaveBeenCalledTimes(1);
    expect(genericDispatches()).toHaveLength(0);
    ts.handleOttoDance.mockClear();
    const row5 = diskRow('Irresistible Dance', '5e');
    expect(row5.automation?.type).toBe('ottos_dance');
    await executeSpellCast(cloneDeep(row5), { targetName: 'Goblin' }, services());
    expect(ts.handleOttoDance).toHaveBeenCalledTimes(1);
    expect(genericDispatches()).toHaveLength(0);
  });

  it('Command disk bytes (shielded AND auto-ABSENT — double-live D+S): :365 opens the commandChoice seam exactly once, :710 zero', async () => {
    arm('handleCommand', { automationPopup: { type: 'modal', modalName: 'commandChoice', payload: {} } });
    const row = diskRow('Command');
    expect(row.automation?.type).toBeUndefined(); // D premise
    const result = await executeSpellCast(cloneDeep(row), { targetName: 'Goblin' }, services());
    expect(ts.handleCommand).toHaveBeenCalledTimes(1);
    expect(genericDispatches()).toHaveLength(0);
    expect(result?.automationPopup?.modalName).toBe('commandChoice'); // passThrough identity
  });
});

describe('fix#355(a) arm-reachability — class D: disk automation.type ABSENT -> arm is the disk-byte home', () => {
  it('Conjure Volley REAL producer bytes (2024-disk-only, auto ABSENT): the :325 arm fires and its popup carries the VERBATIM disk description bytes — closing the REPORTED no-real-producer gap of earlyReturns-noDamage.test.js:66-:67', async () => {
    // disk-absence honesty: the 5e disk has NO Conjure Volley row (census
    // 2026-10-24: diskRow throws disk drift below) — arm is live 2024-disk.
    declineAll(); // REAL modalSpells producers run; every counted arm declines
    expect(() => diskRow('Conjure Volley', '5e')).toThrow(/disk drift/);
    const row = diskRow('Conjure Volley', '2024');
    expect(row.automation).toBeFalsy(); // D premise: no automation.type to hijack
    const result = await executeSpellCast(cloneDeep(row), { targetName: 'Goblin' }, services());
    expect(modal.handleConjureVolley).toBeDefined(); // REAL (partial mock keeps it)
    expect(genericDispatches()).toHaveLength(0);
    expect(result.automationPopup).toEqual({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Conjure Volley',
        description: row.description.join(' '), // disk bytes verbatim through fullSpell
      },
    });
  });

  it('Silence REAL producer bytes (auto ABSENT BOTH rulesets): the :380 arm intercepts its disk range/aoe bytes and the chain CONSUMES — every downstream fallback (:426 healing-word, protection/curse/resistance chain) stays un-dispatched', async () => {
    declineAll();
    for (const year of ['5e', '2024']) {
      const row = diskRow('Silence', year);
      expect(row.automation?.type).toBeUndefined(); // D premise
      executeHandler.mockClear(); triggerHealingWord.mockClear();
      ts.handleRemoveCurse.mockClear(); ts.handleResistance.mockClear();
      const result = await executeSpellCast(cloneDeep(row), { targetName: 'Goblin' }, services());
      expect(genericDispatches(), `${year}: nothing generic for auto-ABSENT`).toHaveLength(0);
      // consumption proof: downstream of runNoDamagePath never runs (chain
      // returned handled:true at :393 — REAL handleSilence produced the
      // silenceTargetSelection modal INTO the consumed value):
      expect(triggerHealingWord, `${year}: consumed BEFORE the :426 healing-word fallback`).not.toHaveBeenCalled();
      expect(ts.handleRemoveCurse).not.toHaveBeenCalled();
      expect(ts.handleResistance).not.toHaveBeenCalled();
      // The CLA-389 merge surfaces the REAL producer's picker modal as the
      // lane payload (hasVisibleCastPayload: value.modalName under automationPopup).
      expect(result?.automationPopup?.modalName, `${year}: REAL handleSilence picker survives the merge`).toBe('silenceTargetSelection');
    }
  });

  it('Power Word Stun (auto ABSENT both) + Compelled Duel (auto ABSENT both) reach :342/:377 once each with spellSaveDc threaded numeric (computeSpellStats always-numeric law #1473)', async () => {
    arm('handlePowerWordStun');
    await executeSpellCast(diskRow('Power Word Stun'), { targetName: 'Goblin' }, services());
    expect(ts.handlePowerWordStun).toHaveBeenCalledTimes(1);
    expect(ts.handlePowerWordStun.mock.calls[0][0].spellSaveDc).toBe(17); // 8+5+4
    expect(genericDispatches()).toHaveLength(0);
    arm('handleCompelledDuel');
    await executeSpellCast(diskRow('Compelled Duel'), { targetName: 'Goblin' }, services());
    expect(ts.handleCompelledDuel).toHaveBeenCalledTimes(1);
    expect(genericDispatches()).toHaveLength(0);
  });
});

describe('fix#355(a) arm-reachability — class H: automation-bearing disk bytes are CONSUMED at :710, the arm keeps the lightweight :163 lane', () => {
  it('Slow / Beacon of Hope / Globe / Forcecage / Holy Aura / Heroism disk bytes (both rulesets where the row carries automation): :710 consumes EXACTLY once per cast, the dedicated arm is NEVER dispatched on disk bytes', async () => {
    declineAll(); // arms decline; :710 replica consumes the automation bytes
    const rows = [
      ['Slow', '5e'], ['Slow', '2024'],
      ['Beacon of Hope', '5e'], ['Beacon of Hope', '2024'],
      ['Globe of Invulnerability', '5e'],
      ['Forcecage', '5e'],
      ['Holy Aura', '5e'], ['Holy Aura', '2024'],
      ['Heroism', '5e'], ['Heroism', '2024'],
    ];
    for (const [name, year] of rows) {
      declineAll();
      executeHandler.mockClear();
      ts.handleGenericAutomation.mockClear();
      for (const k of ['handleSlow', 'handleBeaconOfHope', 'handleGlobeOfInvulnerability', 'handleForcecage', 'handleHolyAura', 'handleHeroism']) ts[k].mockClear();
      const row = diskRow(name, year);
      expect(row.automation?.type, `${name} ${year} premise`).toBeTruthy();
      await executeSpellCast(cloneDeep(row), { targetName: 'Goblin' }, services());
      const g = genericDispatches();
      expect(g, `${name} ${year} consumed at :710`).toHaveLength(1);
      expect(g[0][0].automation).toBe(g[0][0].spell.automation); // by-reference into the cast envelope
      expect(g[0][0].automation).toEqual(row.automation); // disk bytes verbatim on the envelope
      const armName = { Slow: 'handleSlow', 'Beacon of Hope': 'handleBeaconOfHope', 'Globe of Invulnerability': 'handleGlobeOfInvulnerability', Forcecage: 'handleForcecage', 'Holy Aura': 'handleHolyAura', Heroism: 'handleHeroism' }[name];
      expect(ts[armName], `${armName} unreachable on disk bytes (${year})`).not.toHaveBeenCalled();
    }
  });

  it('Suggestion disk bytes (auto suggestion both rulesets) are consumed at :710 — the :364 arm is lightweight-only (fix#296 disposition, lane-header :28-:33), while Hold Monster / Banishment / Maze / Enhance Ability / Spare the dying are LIVE arms on 5e (auto ABSENT) and CONSUMED on 2024 (auto present) — the mixed twin, split by bytes', async () => {
    declineAll();
    ts.handleSuggestion.mockClear();
    await executeSpellCast(diskRow('Suggestion'), { targetName: 'Goblin' }, services());
    expect(genericDispatches()).toHaveLength(1);
    expect(ts.handleSuggestion).not.toHaveBeenCalled();

    for (const [name, armKey] of [['Hold Monster', 'handleHoldMonster'], ['Hold Person', 'handleHoldMonster'], ['Banishment', 'handleBanishment'], ['Maze', 'handleMaze'], ['Enhance Ability', 'handleEnhanceAbility'], ['Spare the Dying', 'handleSpareTheDying']]) {
      arm(armKey);
      executeHandler.mockClear(); ts[armKey].mockClear();
      await executeSpellCast(diskRow(name, '5e'), { targetName: 'Goblin' }, services());
      expect(ts[armKey], `5e ${name}: auto ABSENT -> arm home`).toHaveBeenCalledTimes(1);
      expect(genericDispatches(), `5e ${name}: nothing to hijack`).toHaveLength(0);
      declineAll(); // consumed twin: the arm must NOT fire on the automation byte
      executeHandler.mockClear(); ts[armKey].mockClear();
      await executeSpellCast(diskRow(name, '2024'), { targetName: 'Goblin' }, services());
      expect(genericDispatches(), `2024 ${name}: automation consumed at :710`).toHaveLength(1);
      expect(ts[armKey], `2024 ${name}: arm unreachable on disk bytes`).not.toHaveBeenCalled();
    }
  });

  it('lightweight :163 free-cast envelope (useActionSpellMetamagic.js:163 verbatim {name, level, baseLevel}) REACHES the H-class arms: automation-free envelope declines at :710 and the dedicated arm fires once — the split is split, not dead', async () => {
    arm('handleSlow');
    const slow = lightweight('Slow', 3);
    await executeSpellCast(slow, { slotLevel: 3, targetName: 'Goblin' }, services());
    expect(genericDispatches(), 'no automation on the envelope -> :710 declines').toHaveLength(0);
    expect(ts.handleSlow).toHaveBeenCalledTimes(1);
    expect(ts.handleSlow.mock.calls[0][0].spell).toBe(slow); // envelope identity
    arm('handleHeroism');
    const hero = lightweight('Heroism', 1);
    await executeSpellCast(hero, { slotLevel: 1, targetName: 'Goblin' }, services());
    expect(genericDispatches()).toHaveLength(0);
    expect(ts.handleHeroism).toHaveBeenCalledTimes(1);
    // disk lookup still ran (needsLookup: no aoe) but the CONSUMED flag key
    // reads the ENVELOPE, not fullSpell — the lightweight lane is structural.
  });
});

describe('fix#355(a) census — deleted arms stay dead (dead-arm-deletion-census-pin)', () => {
  it('host source scan: NO dispatch of fix#296/#121(c)-deleted arms survives or resurrects (code bytes only; deletion comments may cite the names); the fix#132 shield + fix#121(b) flag-set + defer-flag gates are byte-integral', () => {
    const host = fs.readFileSync(path.join(HERE, 'index.js'), 'utf8');
    const code = host.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
    // fix#296 deleted twins (:279-era Fear, :285-era Confusion, :288-era
    // Hypnotic Pattern, :293-era Mass Suggestion) + fix#121(c) mass legs:
    for (const dead of ['handleFear(', 'await handleConfusion(', 'await handleHypnoticPattern(', 'handleMassHealingWordTrigger', 'handlePrayerOfHealingTrigger']) {
      expect(code, `deleted arm resurrected: ${dead}`).not.toContain(dead);
    }
    // early-modal imports are the EARLY homes only (Early-suffixed twins):
    expect(code).toContain('handleConfusionEarly(');
    expect(code).toContain('handleHypnoticPatternEarly(');
    // fix#132 shield byte + fix#121(b) ownership machinery, verbatim:
    const trig = fs.readFileSync(path.join(HERE, 'triggerSpells.js'), 'utf8');
    expect(trig).toContain("'regenerate',");
    for (const literal of ["otto's irresistible dance", "otiluke's resilient sphere", "'blur'", "'expeditious retreat'", "'friends'", "'crown of madness'", "'animal friendship'", "'dominate beast'", "'dominate monster'", "'dominate person'", "tasha's hideous laughter", "'hideous laughter'", "'ray of enfeeblement'", "'hex'", "'command'"]) {
      expect(trig.includes(literal), `SERVICE_HANDLED_SPELLS literal drifted: ${literal}`).toBe(true);
    }
    expect(host).toContain("const MASS_HEAL_CONFIRM_AUTOMATION_TYPES = new Set(['mass_healing_word', 'prayer_of_healing', 'mass_cure_wounds']);");
    expect(host).toContain("if (healRidersRun !== 'pair' && healRidersRun !== 'self') {");
    expect(host).toContain("if (healRidersRun !== 'pair') {");
  });
});

/* ------------------------------------------------------------------ */
/*  fix#355(c) — stamp-chain audit pins (producer flag -> consumer    */
/*  defer), one cast per ownership class.                              */
/* ------------------------------------------------------------------ */

describe('fix#355(c) healRidersRun stamp-chain — the ONLY idempotency mechanism, audited intact and now pinned', () => {
  it('generic heal (Cure Wounds disk, auto ABSENT -> :419): runGenericHealPath fires the rider PAIR once and flags healRidersRun:"pair" — runPostCastTriggers defers BOTH legs (each rider: exactly ONE call total)', async () => {
    declineAll();
    const row = diskRow('Cure Wounds');
    expect(row.heal_at_slot_level).toBeTruthy();
    await executeSpellCast(cloneDeep(row), { slotLevel: 1, targetName: 'Goblin' }, services());
    expect(triggerPostCastSelfHeals).toHaveBeenCalledTimes(1); // :594 producer only
    expect(triggerPostCastAllyHeals).toHaveBeenCalledTimes(1); // :597 producer only
    expect(triggerWildMagicSurge).toHaveBeenCalledTimes(1);    // merged block still runs
  });

  it("Mass Cure Wounds 5e disk (auto ABSENT -> :402 forwarder arm): fires no rider at the host producer lane but flags healRidersRun:'self' (massCureWoundsService.js:126 owns the SELF leg) — merged block defers SELF, ALLY fires once", async () => {
    const row = diskRow('Mass Cure Wounds', '5e');
    expect(row.automation?.type).toBeUndefined(); // D premise (:710 cannot consume)
    arm('handleMassCureWounds');
    await executeSpellCast(cloneDeep(row), { slotLevel: 5, targetName: 'Goblin' }, services());
    expect(ts.handleMassCureWounds).toHaveBeenCalledTimes(1);
    expect(triggerPostCastSelfHeals).not.toHaveBeenCalled(); // deferred at :647
    expect(triggerPostCastAllyHeals).toHaveBeenCalledTimes(1); // stays live at :653
    expect(triggerWildMagicSurge).toHaveBeenCalledTimes(1);
  });

  it("Mass Healing Word (auto mass_healing_word, both rulesets) and Mass Cure Wounds 2024 (auto mass_cure_wounds): :710 consumes and the :868 arm flags healRidersRun:'self' (massHealUtils.js:220 confirmFn owns the SELF rider) — merged block defers SELF, ALLY fires ONCE", async () => {
    declineAll();
    for (const [name, year] of [['Mass Healing Word', '5e'], ['Mass Healing Word', '2024'], ['Mass Cure Wounds', '2024'], ['Prayer of Healing', '5e']]) {
      executeHandler.mockClear(); triggerPostCastSelfHeals.mockClear(); triggerPostCastAllyHeals.mockClear();
      const row = diskRow(name, year);
      expect(row.automation?.type, `${name} ${year} premise`).toBeTruthy();
      await executeSpellCast(cloneDeep(row), { slotLevel: row.level, targetName: 'Goblin' }, services());
      expect(genericDispatches(), `${name} ${year}`).toHaveLength(1);
      expect(triggerPostCastSelfHeals, `${name} ${year}: self rider deferred by the 'self' flag`).not.toHaveBeenCalled();
      expect(triggerPostCastAllyHeals, `${name} ${year}: ally leg stays live`).toHaveBeenCalledTimes(1);
    }
  });

  it('MASS HEAL (auto mass_heal) is DIFFERENT CODE and correctly UNFLAGGED: massHealHandler.js carries ZERO rider imports (byte-proof) — :710 consumes without a flag and the merged block fires the PAIR exactly once (one self + one ally), pinning the MASS_HEAL_CONFIRM_AUTOMATION_TYPES exclusion as by-design, not an oversight', async () => {
    const handlerSrc = fs.readFileSync(path.resolve(HERE, '../../../../automation/handlers/healing/massHealHandler.js'), 'utf8');
    expect(handlerSrc).not.toContain('triggerPostCastSelfHeals');
    expect(handlerSrc).not.toContain('triggerPostCastAllyHeals');
    declineAll();
    await executeSpellCast(diskRow('Mass Heal'), { slotLevel: 9, targetName: 'Goblin' }, services());
    expect(genericDispatches()).toHaveLength(1);
    expect(triggerPostCastSelfHeals).toHaveBeenCalledTimes(1); // ungated :649
    expect(triggerPostCastAllyHeals).toHaveBeenCalledTimes(1); // ungated :654
  });

  it('the flag is PER-CALL, never persisted: executing the flagged pair-cast AND the flagged self-cast, getRuntimeValue is NEVER read under key healRidersRun (no store, no clock — audit verdict "chain intact, zero edits lawful" locked)', async () => {
    declineAll();
    await executeSpellCast(diskRow('Cure Wounds'), { slotLevel: 1, targetName: 'Goblin' }, services());
    arm('handleMassCureWounds');
    await executeSpellCast(diskRow('Mass Cure Wounds', '5e'), { slotLevel: 5, targetName: 'Goblin' }, services());
    const reads = getRuntimeValue.mock.calls.map(c => c[1]);
    expect(reads.includes('healRidersRun'), 'flag must never enter the runtime store').toBe(false);
    expect(triggerPostCastSelfHeals.mock.calls.length).toBeGreaterThan(0); // the two casts really ran
  });
});
