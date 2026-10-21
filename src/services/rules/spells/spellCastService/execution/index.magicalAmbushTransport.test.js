// @maintained-by-ai
/* ------------------------------------------------------------------ */
/*  OWNER: CLA-219 :680 fold TRANSPORT face (hub executeSpellCast).  */
/*  Ownership reconciled by bytes (2026-10-21): execution-early-      */
/*  resolutions.test.js:5 owns the ambush THROW family (index.js:117- */
/*  120) and SP-002 null-conditions continue (:124-129); its owner    */
/*  map folds 'CLA-219 :680 fold' HERE. earlyReturns-generic.test.js: */
/*  424 owns the stamp riding the GENERIC :710 executeHandler         */
/*  envelope — this lane owns the three remaining consumers: the       */
/*  dedicated-handler chain (:295), the savePath opts (:746/:623),    */
/*  and the status-effects fallback rollDamage context (:250-259).    */
/*  Throws are NOT re-grown here (cited: execution-early-resolutions  */
/*  :361-384); passives-missing arms therefore use automation.        */
/*  passives:[] — the non-throwing empty state.                        */
/*                                                                     */
/*  FIXTURE TRUTH: disk rows pulled programmatically from both ruleset */
/*  datasets (#1365); the Magical Ambush passive bytes come from       */
/*  public/data/2024/classes.json (:9978 region) — zero fabricated     */
/*  spell shapes (the retired fixtures' 5:'5d10' PK tier does NOT     */
/*  exist on the 5e disk). resolveSpellDamageWithTypes runs REAL       */
/*  (pure, zero imports) so formula routing is disk bytes: Command ->  */
/*  null formula (noDamage lane), Phantasmal Killer -> '4d10'          */
/*  (savePath lane), Telekinesis -> null (fallback lane). fetch is     */
/*  mocked to serve the same disk JSON — no network (#1472 lightweight */
/*  route not needed: every row takes the real lookup). psychicSpells */
/*  Handler + compelledDuelHandler + castingTimeUtils run REAL (pure   */
/*  guards, store reads hit the mocked runtime). getPsychicSpellsConfig */
/*  finds nothing -> no component reduction (census-stable).           */
/*                                                                     */
/*  TRANSPORT PINS: exact getRuntimeValue/setRuntimeValue tuple        */
/*  censuses (campaignName arity; setRuntimeValue is 4-arg per         */
/*  useRuntimeState.js:78 — the lastActionSpellCast stamp rides it on */
/*  every '1 action'/'Action' cast via the REAL normalizeCastingTime, */
/*  CLA-399). Fold adds ZERO extra writes (index.js:676-680 'metaCtx  */
/*  threading only — no new persistence'): censuses below prove it.   */
/*  No POST/SSE in this lane (store edge is the mocked hook module);  */
/*  skipSync discipline lives at the useRuntimeState/setRuntimeObject   */
/*  layer, untouched here. NO-CLOCK: fold is cast-seam instantaneous; */
/*  the only invisibility removal is the endInvisibilityOnHostileAction */
/*  service call (:61) — zero duration bytes stored by this lane.      */
/*  Campaign lockdown: test-campaign (#1484 held).                     */
/*                                                                     */
/*  QUIRK SCAN (reported, pinned, NOT fixed): :256 `hasInvisible ||   */
/*  metaCtx?.metamagicHeighten` is a tautological inline-dup (#1357/   */
/*  58 class) — metaCtx.metamagicHeighten is ALREADY folded to exactly */
/*  that expression at :680, so :256 can never differ from :251's      */
/*  spread; mutant 'drop :256 key' survives by design, mutant ':256 -> */
/*  false' is killed by the fallback test. Asymmetry pinned: an        */
/*  explicit sorcerer Heightened metaCtx survives the fold (:680 OR)   */
/*  while opts.hasInvisible stays false (:675 resolution only) — the   */
/*  consumer-side difference is asserted, not hidden. :130 String().   */
/*  toLowerCase coercion is pinned with a capitalised store row.       */
/*                                                                     */
/*  KILL MATRIX: K1 fold removed at :680 -> all four tests' true arms */
/*  fail; K2 :130 comparison inverted/case-dropped -> T2 'Invisible'  */
/*  arm fails; K3 :121 discriminants ('passive_rule' / 'magical_ambush */
/*  ') flipped -> T2 decoy arms fail; K4 :680 OR -> && / caller-metaCtx */
/*  side dropped -> T3 explicit-heightened arm fails; K5 hasInvisible  */
/*  dropped from savePathOpts (:746/:623) -> T3 opts.hasInvisible      */
/*  fails; K6 :680 mutates caller instead of spreading -> T1/T3 caller */
/*  snapshots fail; K7 campaignName dropped from :124 read -> exact     */
/*  tuple censuses fail; K8 new store write added to fold -> write     */
/*  censuses fail; K9 :256 metamagicHeighten -> false (tautology only   */
/*  killable via :680) -> T4 exact rollDamage payload fails; K10 fake  */
/*  spell fixture (no status_effects / wrong damage bytes) -> disk-     */
/*  derived fetch+formula+payload pins fail loudly.                     */
/* ------------------------------------------------------------------ */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cloneDeep } from 'lodash';
import spells5e from '../../../../../../public/data/spells.json';
import spells2024 from '../../../../../../public/data/2024/spells.json';
import classes2024 from '../../../../../../public/data/2024/classes.json';

/* ------------------------------------------------------------------ */
/*  Mocks — every dependency of execution/index.js. triggerSpells.js  */
/*  is mocked EXHAUSTIVELY against its real export list (48 handlers) */
/*  so no chain position (:278-:320) can crash on an undefined hole   */
/*  (#1440 line-by-line). Runs REAL on purpose (pure guards):         */
/*  compelledDuelHandler (:6 direct edge, SP-026), psychicSpells      */
/*  Handler (:19), castingTimeUtils (:30), core/spellDamageUtils      */
/*  (:21). The barrel (:3) carries ONLY executeHandler — the retired  */
/*  checkCompelledDuelAttackExpiry key was a dead mock: index.js:6    */
/*  imports it from the direct path, which stays unmocked here too.   */
/*  './spellResolution.js' was a dead-MODULE mock (hub never imports  */
/*  it) — removed (#1484 dead-module-mock hunt).                       */
/* ------------------------------------------------------------------ */

vi.mock('../../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => undefined),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../automation/index.js', () => ({
  executeHandler: vi.fn(() => Promise.resolve(null)),
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

vi.mock('./triggerSpells.js', () => {
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
    'handleTashasHideousLaughter', 'handleImprisonment', 'handleHolyAura',
    'handleMassCureWounds', 'handleMassHealingWord', 'handlePrayerOfHealing',
    'handleFalseLife', 'handleRemoveCurse', 'handleHeroism', 'handleLongstrider',
    'handleSpareTheDying', 'handleEnhanceAbility', 'handleProtectionFromEnergy',
    'handleProtectionFromPoison', 'handleResistance', 'handleGenericAutomation',
  ];
  const mod = { SERVICE_HANDLED_SPELLS: [] };
  for (const n of names) mod[n] = vi.fn(async () => ({ handled: false }));
  return mod;
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

vi.mock('../../../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
}));

/* ------------------------------------------------------------------ */

import { getRuntimeValue, setRuntimeValue } from '../../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../../ui/logService.js';
import { executeHandler } from '../../../../automation/index.js';
import { endFriendsOnHostileAction } from '../../../features/friendsService.js';
import { endInvisibilityOnHostileAction } from '../../../features/invisibilityService.js';
import { handleCommand } from './triggerSpells.js';
import { handleSavePath } from './savePath.js';
import { executeSpellCast } from './index.js';

const CAMPAIGN = 'test-campaign';
const CASTER = 'AasimarTest';

/* Disk truth: the Magical Ambush passive automation bytes, pulled
 * programmatically from the 2024 classes dataset (never hand-typed). */
function findAmbushAutomation(node) {
  if (!node || typeof node !== 'object') return null;
  if (node.effect === 'magical_ambush') return node;
  for (const value of Object.values(node)) {
    const hit = findAmbushAutomation(value);
    if (hit) return hit;
  }
  return null;
}
const AMBUSH_AUTOMATION = findAmbushAutomation(classes2024);
const REAL_PASSIVE = [{ name: 'Magical Ambush', ...AMBUSH_AUTOMATION }];

function diskRow(name, rules) {
  const ds = rules === '2024' ? spells2024 : spells5e;
  const row = ds.find((s) => s.name === name);
  if (!row) throw new Error(`disk row missing: ${name} (${rules})`);
  return cloneDeep(row);
}

function ambushCaster(rules, passives) {
  return {
    name: CASTER,
    rules,
    proficiency: 6,
    spellAbilities: { saveDc: 14, modifier: 5, toHit: 11 },
    abilities: [{ name: 'Charisma', bonus: 5 }],
    automation: { passives },
  };
}

function baseOpts(playerStats) {
  return {
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    playerStats,
    getTargetInfo: async () => ({ name: 'HexWarlock' }),
    attackerPos: null, targetPos: null, featEffects: {},
    campaignName: CAMPAIGN, mapName: null, characters: [],
  };
}

/* Exact store-read censuses for the three lanes (order-bearing):
 * every cast pays the antimagic hub read (:91) and the ambush read
 * (:124); no-damage and fallback lanes then pay the sanctuary read
 * (:566) after the chain exit; the damage lane additionally pays the
 * REAL duel read (:177) and the CLA-134 feats read (:741). */
const ANTIMAGIC = ['campaign', 'targetEffects'];
const SANCTUARY = ['campaign', 'targetEffects'];
const AMBUSH_READ = [CASTER, 'activeConditions', CAMPAIGN];
const FEATS_READ = [CASTER, 'featsOfChaosActive', CAMPAIGN];
const NO_DAMAGE_CENSUS = [ANTIMAGIC, AMBUSH_READ, SANCTUARY];
const DAMAGE_CENSUS = [ANTIMAGIC, AMBUSH_READ, ANTIMAGIC, FEATS_READ, SANCTUARY];
const FALLBACK_CENSUS = [ANTIMAGIC, AMBUSH_READ, FEATS_READ, SANCTUARY];
/* The only fold-lane-adjacent write is the CLA-399 lastActionSpellCast
 * stamp (:63) — the fold itself (:680) must add ZERO writes (#1484). */
const WRITE_CENSUS = [[CASTER, 'lastActionSpellCast', 1, CAMPAIGN]];

function ambushSetup(passives, conditions, rules = '2024') {
  getRuntimeValue.mockImplementation((who, key) =>
    (who === CASTER && key === 'activeConditions') ? conditions : undefined);
  return ambushCaster(rules, passives);
}

function consumeCommand() {
  handleCommand.mockImplementation(async ({ metaCtx }) => ({
    handled: true,
    result: { automationPopup: { type: 'modal', modalName: 'commandChoice', payload: { metaCtx } } },
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  getRuntimeValue.mockReturnValue(undefined);
  // clearAllMocks keeps implementations — neutralise the Command consumer
  // so pass-through lanes (fallback, savePath) are not hijacked (:295).
  handleCommand.mockImplementation(async () => ({ handled: false }));
  // lookupFullSpell (:170) fetches the disk dataset — serve the same real
  // JSON so no test hits the network and fullSpell stays disk-truth.
  globalThis.fetch = vi.fn(async (url) => ({
    ok: true,
    json: async () => (url.includes('/2024/') ? spells2024 : spells5e),
  }));
});

describe('CLA-219 :680 fold transport — dedicated Command handler lane (:295)', () => {
  it('stamps metamagicHeighten from invisible+disk-passive on both rulesets, echoes the fresh stamped metaCtx to handleCommand, and pays the exact store census (campaignName arity, zero fold writes)', async () => {
    consumeCommand();
    const arms = [
      ['5e / invisible', '5e', ['invisible'], true],
      ['2024 / invisible', '2024', ['invisible'], true],
      ['2024 / visible control', '2024', [], false],
    ];

    for (const [label, rules, conditions, expected] of arms) {
      vi.clearAllMocks();
      globalThis.fetch = vi.fn(async (url) => ({
        ok: true,
        json: async () => (url.includes('/2024/') ? spells2024 : spells5e),
      }));
      const playerStats = ambushSetup(REAL_PASSIVE, conditions, rules);
      const caller = {};
      const spell = diskRow('Command', rules);

      const result = await executeSpellCast(spell, caller, baseOpts(playerStats));

      const [[captured]] = handleCommand.mock.calls;
      // :680 injects the key always — defined boolean, never absent.
      expect(captured.metaCtx, label).toEqual({ metamagicHeighten: expected });
      // Fresh object at :680 — caller snapshot untouched (K6).
      expect(captured.metaCtx, label).not.toBe(caller);
      expect(caller, label).toEqual({});
      // :295 -> :712 passThrough, CLA-389 merge keeps the lane popup.
      expect(result.automationPopup.modalName, label).toBe('commandChoice');
      // Transport censuses: exact tuples pin the 3-arg ambush read (#1484
      // campaign-arg-omitted guard) and prove no extra persistence (:680).
      expect(getRuntimeValue.mock.calls, label).toEqual(NO_DAMAGE_CENSUS);
      expect(setRuntimeValue.mock.calls, label).toEqual(WRITE_CENSUS);
      // Ruleset disk routing (CLA-399 'Action' + 5e '1 action' both stamp).
      expect(globalThis.fetch.mock.calls.map((c) => c[0]), label)
        .toEqual([rules === '2024' ? '/data/2024/spells.json' : '/data/spells.json']);
      expect(addEntry.mock.calls.map((c) => c[0]), label).toEqual([CAMPAIGN]);
      // Cast-seam invisibility release (NO-CLOCK: no stored duration).
      expect(endInvisibilityOnHostileAction.mock.calls, label).toEqual([[CASTER, CAMPAIGN]]);
      expect(endFriendsOnHostileAction.mock.calls, label).toEqual([[CASTER, CAMPAIGN]]);
    }
  });
});

describe('CLA-219 resolve discriminants via the fold (:121/:130)', () => {
  it('requires BOTH passive_rule+magical_ambush disk bytes AND an invisible condition — decoys false, lowercase and capitalised store rows both true', async () => {
    consumeCommand();
    const arms = [
      ['lowercase store row', REAL_PASSIVE, ['invisible'], true],
      ['capitalised store row coerced (:130)', REAL_PASSIVE, ['Invisible'], true],
      ['passive_rule, wrong effect', [{ name: 'Witch Bolt', ...AMBUSH_AUTOMATION, effect: 'wrong_effect' }], ['invisible'], false],
      ['magical_ambush, wrong type', [{ name: 'Magical Ambush', ...AMBUSH_AUTOMATION, type: 'wrong_type' }], ['invisible'], false],
      ['empty passives (non-throwing empty state)', [], ['invisible'], false],
    ];

    for (const [label, passives, conditions, expected] of arms) {
      vi.clearAllMocks();
      consumeCommand();
      const playerStats = ambushSetup(passives, conditions);

      await executeSpellCast(diskRow('Command', '2024'), {}, baseOpts(playerStats));

      const [[captured]] = handleCommand.mock.calls;
      expect(captured.metaCtx, label).toEqual({ metamagicHeighten: expected });
      expect(getRuntimeValue.mock.calls, label).toEqual(NO_DAMAGE_CENSUS);
    }
  });
});

describe('CLA-219 stamped metaCtx + hasInvisible ride savePath opts (:746)', () => {
  it('delivers the disk-resolved formula, both ambush carries, and the threaded store-reader identity to handleSavePath across invisible/visible/explicit-heightened arms', async () => {
    const arms = [
      ['2024 invisible', '2024', ['invisible'], undefined, true, true],
      ['5e visible control', '5e', [], undefined, false, false],
      ['2024 explicit sorcerer Heightened while visible', '2024', [], { metamagicHeighten: true }, true, false],
    ];

    for (const [label, rules, conditions, callerExtra, expectedMeta, expectedRaw] of arms) {
      vi.clearAllMocks();
      globalThis.fetch = vi.fn(async (url) => ({
        ok: true,
        json: async () => (url.includes('/2024/') ? spells2024 : spells5e),
      }));
      const playerStats = ambushSetup(REAL_PASSIVE, conditions, rules);
      const caller = { ...callerExtra };

      await executeSpellCast(diskRow('Phantasmal Killer', rules), caller, baseOpts(playerStats));

      const [[opts]] = handleSavePath.mock.calls;
      // Exact key-set at the damage seam: :680's fold SURVIVES the :741
      // fresh re-spread (CLA-134 adds finalFormula + featsOfChaosArmedAt
      // — semantics owned by aoeSpells.test.js:375, presence pinned here).
      expect(opts.metaCtx, label).toEqual({
        metamagicHeighten: expectedMeta,
        finalFormula: null,
        featsOfChaosArmedAtCast: false,
      });
      // Asymmetry pinned: :680 OR keeps the explicit flag TRUE while the
      // dedicated :675 key stays FALSE for a visible caster (K4/K5).
      expect(opts.hasInvisible, label).toBe(expectedRaw);
      // Formula is REAL disk resolution bytes, not a mock default (#1468).
      expect(opts.formula, label).toBe('4d10');
      // The mocked store reader itself is threaded into the lane (:746).
      expect(opts.getRuntimeValue, label).toBe(getRuntimeValue);
      expect(opts.campaignName, label).toBe(CAMPAIGN);
      expect(opts.metaCtx, label).not.toBe(caller);
      expect(caller, label).toEqual(callerExtra || {});
      expect(getRuntimeValue.mock.calls, label).toEqual(DAMAGE_CENSUS);
      expect(setRuntimeValue.mock.calls, label).toEqual(WRITE_CENSUS);
      expect(globalThis.fetch.mock.calls.map((c) => c[0]), label)
        .toEqual([rules === '2024' ? '/data/2024/spells.json' : '/data/spells.json']);
    }
  });
});

describe('CLA-219 fallback rollDamage context carries the stamp (:250-259)', () => {
  it('routes an unhandled DC status-effect disk row (Telekinesis) through the fallback with the exact rollDamage payload — metamagicHeighten true, zero generic dispatch', async () => {
    const playerStats = ambushSetup(REAL_PASSIVE, ['invisible']);
    const spell = diskRow('Telekinesis', '2024');
    const opts = baseOpts(playerStats);

    await executeSpellCast(spell, {}, opts);

    expect(opts.rollDamage.mock.calls).toHaveLength(1);
    const [[payload]] = opts.rollDamage.mock.calls;
    expect(payload).toEqual({
      name: 'Telekinesis',
      formula: '0',
      total: 0,
      rolls: [],
      modifier: 0,
      context: {
        targetName: 'HexWarlock',
        attackerName: CASTER,
        // :251 spread + :256 inline-dup (tautological post-:680 — see
        // header QUIRK SCAN): both feed the same folded value.
        metamagicHeighten: true,
        spellSchool: 'Transmutation',
        saveDc: 14,
        saveType: 'STR',
        dcSuccess: 'none',
        isCantrip: false,
        statusEffects: ['Restrained'],
      },
    });
    expect(payload.context.statusEffects).toBe(spell.status_effects);
    expect(getRuntimeValue.mock.calls).toEqual(FALLBACK_CENSUS);
    expect(setRuntimeValue.mock.calls).toEqual(WRITE_CENSUS);
    // No automation.type on the disk row — the :710 generic lane stays clean.
    expect(executeHandler.mock.calls).toEqual([]);
  });
});
