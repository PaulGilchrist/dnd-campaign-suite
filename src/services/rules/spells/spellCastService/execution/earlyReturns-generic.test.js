// @maintained-by-ai
/* ------------------------------------------------------------------ */
/*  GENERIC automation lane — :710 consumption / :712 bypass contract   */
/*                                                                     */
/*  Unit under test: executeSpellCast's early-trigger chain consumer  */
/*  (index.js:701-712). handleGenericAutomation (triggerSpells.js:453 */
/*  runs REAL here — consumers who mock it elsewhere need this join,   */
/*  #1350 sole-owner method; its direct unit coverage lives in         */
/*  triggerSpells.test.js / triggerSpells.metaCtx.test.js, and the     */
/*  :710 mock-boundary arg pin lives in index.generic-metaCtx.test.js */
/*  and earlyReturns-modal.test.js owns :702-:709 names).              */
/*                                                                     */
/*  #1455 FIXED (fix#121(a)): a cast consumed at :710 no longer returns  */
/*  at :712 directly — it threads runPostCastTriggersMerged exactly once  */
/*  (mirroring :720/:727/:751/:759), so Wild Magic Surge and the         */
/*  post-cast riders fire on generic-handled casts while the lane keeps   */
/*  its own visible picker/popup precedence (:583). This suite locks       */
/*  both directions: consumed rows run the post-cast block ONCE           */
/*  (surge + riderSaves + once; massHealUtils-routed heals defer the     */
/*  self rider — fix#121(b) healRidersRun); declined rows still reach it  */
/*  exactly once.                                                           */
/*                                                                     */
/*  Fixtures are REAL disk rows (#1455/57/58/68 fabricated-shape     */
/*  ban): automation.effects is an object on every disk row — never    */
/*  an array — and resolveSpellDamageWithTypes runs REAL so lane       */
/*  routing matches production (no fabricated '1d8' on damage-less      */
/*  rows, #1468). No timers, no clocks — consumption is instantaneous. */
/* ------------------------------------------------------------------ */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cloneDeep } from 'lodash';
import spells5e from '../../../../../../public/data/spells.json';
import spells2024 from '../../../../../../public/data/2024/spells.json';

/* ------------------------------------------------------------------ */
/*  Mocks — dependencies of execution/index.js, EXCEPT triggerSpells.js */
/*  and core/spellDamageUtils.js which run REAL (see header).          */
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
  // full-disk census reaches the REAL handleFriends trigger (triggerSpells.js) —
  // mock surface must cover its production import or the cast throws at the seam.
  triggerFriends: vi.fn(() => Promise.resolve(null)),
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
const { executeHandler, checkCompelledDuelAttackExpiry } = await import('../../../../automation/index.js');
const { triggerWildMagicSurge } = await import('../../../features/wildMagicSurgeService.js');
const { triggerPostCastRiderSaves, triggerSpellThief, triggerBewitchingMagic } = await import('../../../../rules/spells/postCastRiderService.js');
const { triggerPostCastSelfHeals, triggerPostCastAllyHeals } = await import('../../../../rules/spells/postCastHealService.js');
const { triggerInspiringSmite } = await import('../../../features/inspiringSmiteService.js');
const { triggerSmiteOfProtection } = await import('../../../features/smiteOfProtectionService.js');
const { endSanctuary } = await import('../../../../automation/handlers/spells/sanctuaryHandler.js');
const { handleSavePath } = await import('./savePath.js');
const { handleNoSavePath } = await import('./noSavePath.js');
const { computeRange } = await import('./damageCalculation.js');

/* ------------------------------------------------------------------ */
/*  Test-data factories (REAL disk rows, cloned — disk JSON modules   */
/*  are shared and applyPsychicComponentReduction may mutate)          */
/* ------------------------------------------------------------------ */

function diskRow(name, dataset) {
  const row = dataset.find(s => s.name === name && s.automation && s.automation.type);
  if (!row) throw new Error(`disk row missing: ${name} (fabricated fixture guard)`);
  return cloneDeep(row);
}

// Name-gated early arms (:741-:743, :762) fire on spell NAME, not automation —
// e.g. Power Word Kill 5e carries no automation.type on disk. Same disk-truth
// guard, without the automation requirement.
function nameRow(name, dataset) {
  const row = dataset.find(s => s.name === name);
  if (!row) throw new Error(`disk row missing: ${name} (fabricated fixture guard)`);
  return cloneDeep(row);
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

const POPUP = Object.freeze({ type: 'popup', payload: { automation: true } });

function makeOpts(playerStats, extra = {}) {
  return {
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    playerStats,
    getTargetInfo: async () => ({ name: 'Goblin' }),
    campaignName: 'test-campaign',
    mapName: 'test-map',
    characters: [],
    ...extra,
  };
}

/* ------------------------------------------------------------------ */
/*  beforeEach                                                         */
/* ------------------------------------------------------------------ */

describe('executeSpellCast — generic automation lane (:710 consumption / :712 merge)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue([]);
    // clearAllMocks keeps implementations — re-arm the declined surge default so
    // a census test that armed mockResolvedValue(SURGE) cannot leak into later lanes.
    triggerWildMagicSurge.mockResolvedValue(null);
    // lookupFullSpell (index.js:170) fetches the disk dataset — serve the same
    // real JSON so no test ever hits the network and fullSpell stays disk-truth.
    globalThis.fetch = vi.fn(async (url) => ({
      ok: true,
      json: async () => (url.includes('/2024/') ? spells2024 : spells5e),
    }));
  });

  /* ---------------------------------------------------------------- */
  /*  Disk census — every automation.type row, both rulesets, REAL   */
  /*  gate. Counts pinned as of the 2026-10-21 disk state.           */
  /* ---------------------------------------------------------------- */

  it('consumes EVERY real-gate-passing automation.type disk row at :710 — exact census 43 (5e) + 77 (2024), and every consumed cast runs the merged post-cast block exactly once (:712 merge, fix#121(a), #1459/#1463)', async () => {
    // Declines are the SERVICE_HANDLED-name rows (real triggerSpells.js set)
    // and the effects.fail/success rows. Exact list, not just counts, so a
    // disk row silently gaining/losing generic consumption fails loudly.
    // fix#132 (#1483/#1472): 'Regenerate' MOVED consumed->declined in both
    // editions — the shield now routes disk-byte casts past the drop-dead
    // :710 dispatch (HANDLER_MAP registers 'regenerate', never the disk
    // type 'healing_start_of_turn') to the live chain arm applyRegenerateSpell.
    const DECLINED_5E = ['Color Spray', 'Dominate Monster', 'Entangle', "Irresistible Dance", 'Regenerate', "Resilient Sphere", 'Sleep'].sort();
    const DECLINED_2024 = ['Arms of Hadar', 'Color Spray', 'Entangle', 'Grease', "Otiluke's Resilient Sphere", "Otto's Irresistible Dance", 'Regenerate', 'Sleep'].sort();
    const EXPECTED = [
      { rules: undefined, rows: spells5e, consumed: 43, declined: DECLINED_5E },
      { rules: '2024', rows: spells2024, consumed: 77, declined: DECLINED_2024 },
    ];

    executeHandler.mockResolvedValue(POPUP);
    let totalConsumed = 0;

    for (const { rules, rows, consumed: expectedConsumed, declined: expectedDeclined } of EXPECTED) {
      const playerStats = makePlayerStats(rules ? { rules } : {});
      let ruleConsumed = 0;
      const declinedNames = [];

      for (const row of rows) {
        if (!row.automation || !row.automation.type) continue;
        vi.clearAllMocks();
        executeHandler.mockResolvedValue(POPUP);

        const spell = cloneDeep(row);
        // Generic dispatch is discriminable by envelope identity: triggerSpells.js:459
        // passes `automation: spell.automation` BY REFERENCE; the real SERVICE-name
        // handlers re-spread their automation into fresh objects (:456 vs service
        // action builders), so identity — not call presence — marks consumption.
        // Real SERVICE-name handlers (dominate/flesh-to-stone family) also dispatch
        // through executeHandler, keeping automation identity but adding their own
        // keys (spellSlotLevel etc). Only the EXACT triggerSpells.js:456-461
        // envelope { name, spell, automation, metaCtx } counts as :710 consumption.
        const genericDispatches = () => executeHandler.mock.calls.filter(([a]) =>
          a && a.automation === spell.automation && a.name === row.name
          && Object.keys(a).join('|') === 'name|spell|automation|metaCtx');

        const result = await executeSpellCast(spell, { targetName: 'Goblin' }, makeOpts(playerStats));

        if (genericDispatches().length === 1) {
          // Consumed at :710: envelope identity + :712 verbatim return.
          ruleConsumed++;
          const [[action]] = genericDispatches();
          expect(Object.keys(action)).toEqual(['name', 'spell', 'automation', 'metaCtx']);
          expect(action.name).toBe(row.name);
          expect(action.spell).toBe(spell);
          expect(action.automation).toBe(spell.automation);
          expect(action.metaCtx).toEqual({ targetName: 'Goblin', metamagicHeighten: false });
          // :710 envelope contract: { automationPopup: <handlerResult verbatim> }.
          expect(result).toEqual({ automationPopup: POPUP });
          expect(result.automationPopup).toBe(POPUP);
          // fix#121(a): the consumed cast threads the merged post-cast block once —
          // surge rolled AFTER :710, lane popup preserved by :583 precedence.
          expect(triggerWildMagicSurge).toHaveBeenCalledTimes(1);
        } else {
          // Declined at the real :455 gate: no generic dispatch; the cast falls
          // through and reaches the post-cast block exactly once (:720/:771).
          expect(genericDispatches(), `no generic dispatch for ${row.name}`).toHaveLength(0);
          expect(triggerWildMagicSurge).toHaveBeenCalledTimes(1);
          declinedNames.push(row.name);
        }
      }

      expect(ruleConsumed, `${rules || '5e'} consumed census`).toBe(expectedConsumed);
      expect(declinedNames.sort()).toEqual(expectedDeclined);
      totalConsumed += ruleConsumed;
    }

    expect(totalConsumed).toBe(120);
  });

  /* ---------------------------------------------------------------- */
  /*  Zero-bypass census — #1470 CLOSED by the :784 merge             */
  /*  (fix#119/#121(a)). Fresh run 2026-10-22 on current bytes:      */
  /*  every disk row, both rulesets, every lane (early chain :741-    */
  /*  :771 → :784 merge, noDamage :793, marked-target :800, auto-     */
  /*  miss :824, save-path :832, tail :844) fires the post-cast       */
  /*  rider block exactly once. Roster derived at runtime from disk — */
  /*  never retyped. A zero-surge cast (the #1470 signature) names    */
  /*  itself in `violations` and fails loudly. Only blocked casts     */
  /*  (:711/:722 guards, slot unpaid) may skip the block — every      */
  /*  guard is declined-null in this lane, so zero skips are legal.  */
  /* ---------------------------------------------------------------- */

  it('zero-bypass census (#1470 CLOSED): EVERY disk row of BOTH rulesets runs the post-cast rider block exactly once — zero surge-less, zero rider-less casts, roster derived at runtime', async () => {
    executeHandler.mockResolvedValue(POPUP);
    const violations = [];
    let castCount = 0;

    for (const { rules, rows } of [
      { rules: undefined, rows: spells5e },
      { rules: '2024', rows: spells2024 },
    ]) {
      const playerStats = makePlayerStats(rules ? { rules } : {});
      for (const row of rows) {
        vi.clearAllMocks(); // clears calls only — factory declined-defaults stay armed
        executeHandler.mockResolvedValue(POPUP);
        triggerWildMagicSurge.mockResolvedValue(null);
        getRuntimeValue.mockReturnValue([]);
        const spell = cloneDeep(row);

        try {
          await executeSpellCast(spell, { targetName: 'Goblin' }, makeOpts(playerStats));
        } catch (e) {
          violations.push(`${rules || '5e'}/${row.name}: threw ${e?.message}`);
          continue;
        }
        castCount++;
        if (triggerWildMagicSurge.mock.calls.length !== 1) {
          violations.push(`${rules || '5e'}/${row.name}: surge calls=${triggerWildMagicSurge.mock.calls.length}`);
        }
        if (triggerPostCastRiderSaves.mock.calls.length !== 1) {
          violations.push(`${rules || '5e'}/${row.name}: riderSaves calls=${triggerPostCastRiderSaves.mock.calls.length}`);
        }
      }
    }

    expect(violations).toEqual([]);
    // Every disk row cast, both rulesets — runtime count, not a retype.
    expect(castCount).toBe(spells5e.length + spells2024.length);
  });

  /* ---------------------------------------------------------------- */
  /*  Early-chain arm census — extension of fix#119's flipped pins   */
  /*  (earlyReturns-generic :274 consumes at the :771 generic arm;    */
  /*  earlyReturns-modal #1471 pins exact envelopes per arm). Here:    */
  /*  EVERY dedicated early arm (:741-:763) consuming a REAL disk row */
  /*  rides the :784 runPostCastTriggersMerged — surge rolled once,   */
  /*  riderSaves once, and CLA-389 payload precedence holds: a lane    */
  /*  popup wins over the surge popup, an undefined-lane cast returns */
  /*  the surge popup. healRidersRun stays undefined on these rows    */
  /*  (none is a MASS_HEAL_CONFIRM_AUTOMATION_TYPES — fix#121(b)      */
  /*  flags untouched).                                                 */
  /* ---------------------------------------------------------------- */

  it('early-chain census (#1470): every dedicated early arm consuming at :741-:763 threads the :784 merge — surge once, payload precedence per CLA-389', async () => {
    const modalSpells = await import('./modalSpells.js');
    const SURGE = { type: 'popup', payload: { surge: true } };
    const LANED = { automationPopup: POPUP };

    // Arm shapes mirror modalSpells producers' real return shapes (earlyReturns-
    // modal #1471 pins those bytes): PWH/PWK handled-with-no-result (async),
    // sync arms plain envelopes, Confusion carries an awaited Promise (:752-:761).
    const ARMS = [
      { name: 'Power Word Heal', rules: '2024', fn: modalSpells.handlePowerWordHeal, shape: { handled: true }, async: true, expected: SURGE },
      { name: 'Power Word Kill', rules: '5e', fn: modalSpells.handlePowerWordKill, shape: { handled: true }, async: true, expected: SURGE },
      { name: 'Mass Suggestion', rules: '5e', fn: modalSpells.handleMassSuggestion, shape: { handled: true, result: LANED }, async: false, expected: LANED },
      { name: 'Calm Emotions', rules: '5e', fn: modalSpells.handleCalmEmotions, shape: { handled: true, result: LANED }, async: false, expected: LANED },
      { name: 'Hypnotic Pattern', rules: '5e', fn: modalSpells.handleHypnoticPatternEarly, shape: { handled: true, result: LANED }, async: false, expected: LANED },
      { name: 'Confusion', rules: '5e', fn: modalSpells.handleConfusionEarly, shape: { handled: true, result: Promise.resolve(undefined) }, async: false, expected: SURGE },
      { name: 'Shapechange', rules: '5e', fn: modalSpells.handleShapechange, shape: { handled: true, result: LANED }, async: false, expected: LANED },
      { name: 'Sleep', rules: '5e', fn: modalSpells.handleSleep, shape: { handled: true, result: LANED }, async: false, expected: LANED },
    ];

    for (const arm of ARMS) {
      vi.clearAllMocks();
      executeHandler.mockResolvedValue(POPUP);
      triggerWildMagicSurge.mockResolvedValue(SURGE);
      getRuntimeValue.mockReturnValue([]);
      const spell = nameRow(arm.name, arm.rules === '2024' ? spells2024 : spells5e);
      if (arm.async) arm.fn.mockResolvedValueOnce(arm.shape);
      else arm.fn.mockReturnValueOnce(arm.shape);

      const result = await executeSpellCast(spell, { targetName: 'Goblin' }, makeOpts(makePlayerStats(arm.rules ? { rules: arm.rules } : {})));

      expect(arm.fn, `${arm.name} arm reached`).toHaveBeenCalledTimes(1);
      // :710 generic arm never runs — consumed at the earlier arm (#1463 contrast).
      expect(executeHandler, `${arm.name} not generic-hijacked`).not.toHaveBeenCalled();
      // The bypass signature (#1470): zero surge. Structural impossibility now —
      // the ONLY exit is :784 runPostCastTriggersMerged.
      expect(triggerWildMagicSurge, `${arm.name} surge rolled once`).toHaveBeenCalledTimes(1);
      expect(triggerPostCastRiderSaves, `${arm.name} riders once`).toHaveBeenCalledTimes(1);
      if (arm.expected === SURGE) {
        expect(result, `${arm.name} surge popup wins (no lane payload)`).toBe(SURGE);
      } else {
        expect(result, `${arm.name} lane popup wins (:638 precedence)`).toEqual(LANED);
      }
    }
  });

  /* ---------------------------------------------------------------- */
  /*  Consumption unwrap + bypass (#1455 pinned, not fixed)          */
  /* ---------------------------------------------------------------- */

  it('returns the handler popup wrapped verbatim (:710 envelope, :712 identity) and bypasses every downstream damage/save lane while running the post-cast rider block exactly once (fix#121(a))', async () => {
    executeHandler.mockResolvedValue(POPUP);
    const playerStats = makePlayerStats();
    const spell = diskRow('Barkskin', spells5e);

    const result = await executeSpellCast(spell, { targetName: 'Goblin' }, makeOpts(playerStats));

    expect(result).toEqual({ automationPopup: POPUP });
    expect(result.automationPopup).toBe(POPUP);
    expect(executeHandler).toHaveBeenCalledTimes(1);
    // Downstream damage/save lanes never run for a consumed cast.
    expect(computeRange).not.toHaveBeenCalled();
    expect(handleSavePath).not.toHaveBeenCalled();
    expect(handleNoSavePath).not.toHaveBeenCalled();
    expect(checkCompelledDuelAttackExpiry).not.toHaveBeenCalled();
    // fix#121(a): the post-cast block is reachable on consumed casts now (:712 merge) —
    // every rider exactly once; Barkskin is not an automation-routed heal, so the
    // self/ally pair fires here (fix#121(b) guards only the mass-heal types).
    expect(triggerWildMagicSurge).toHaveBeenCalledTimes(1);
    expect(triggerPostCastRiderSaves).toHaveBeenCalledTimes(1);
    expect(triggerPostCastSelfHeals).toHaveBeenCalledTimes(1);
    expect(triggerPostCastAllyHeals).toHaveBeenCalledTimes(1);
    expect(triggerInspiringSmite).toHaveBeenCalledTimes(1);
    expect(triggerSmiteOfProtection).toHaveBeenCalledTimes(1);
    expect(triggerSpellThief).toHaveBeenCalledTimes(1);
    expect(triggerBewitchingMagic).toHaveBeenCalledTimes(1);
    expect(endSanctuary).not.toHaveBeenCalled(); // no sanctuary te in the store
  });

  it('consumes the cast even when the handler returns null (triggerSpells.js:466) — resolves undefined yet still runs the merged post-cast block once (fix#121(a)); executeHandler gets the exact arity-5 tuple (:462, #1461)', async () => {
    executeHandler.mockResolvedValue(null);
    const playerStats = makePlayerStats({ rules: '2024' });
    const characters = [{ name: 'Goblin' }];
    const spell = diskRow('Arcane Vigor', spells2024);

    const result = await executeSpellCast(spell, { targetName: 'Goblin' }, makeOpts(playerStats, { characters }));

    // :710 `r.result || undefined` — consumed, no popup, undefined return.
    expect(result).toBeUndefined();
    // Real :462 tuple: (action, playerStats, campaignName, mapName, characters).
    const call = executeHandler.mock.calls[0];
    expect(call).toHaveLength(5);
    expect(call[0].automation).toBe(spell.automation);
    expect(call[1]).toBe(playerStats);
    expect(call[2]).toBe('test-campaign');
    expect(call[3]).toBe('test-map');
    expect(call[4]).toBe(characters);
    // fix#121(a): consumed-no-result shape now threads the merge — surge once,
    // save/damage lanes still unreachable (:712 consumed before :714).
    expect(triggerWildMagicSurge).toHaveBeenCalledTimes(1);
    expect(handleNoSavePath).not.toHaveBeenCalled();
  });

  /* ---------------------------------------------------------------- */
  /*  Decline falls through — the contrast case, seam order proof     */
  /* ---------------------------------------------------------------- */

  it('falls through to the save lane and returns the surge popup when the REAL :455 gate declines an effects.fail/success disk row (Color Spray) — declined casts reach post-cast exactly once', async () => {
    const surgePopup = { type: 'popup', payload: { surge: true } };
    triggerWildMagicSurge.mockResolvedValue(surgePopup);
    const playerStats = makePlayerStats();
    const spell = diskRow('Color Spray', spells5e);

    const result = await executeSpellCast(spell, { targetName: 'Goblin' }, makeOpts(playerStats));

    expect(executeHandler).not.toHaveBeenCalled();
    // Gate declined → chain passed → damage/save lane ran once...
    expect(handleSavePath).toHaveBeenCalledTimes(1);
    // ...then post-cast, AFTER the save lane (:759 → :771 seam order, #1461/#1467).
    expect(triggerWildMagicSurge).toHaveBeenCalledTimes(1);
    expect(handleSavePath.mock.invocationCallOrder[0]).toBeLessThan(triggerWildMagicSurge.mock.invocationCallOrder[0]);
    // The lane carries no visible payload, so the surge popup wins (CLA-389 merge).
    expect(result).toBe(surgePopup);
  });

  /* ---------------------------------------------------------------- */
  /*  CLA-219 stamped metaCtx rides the REAL envelope                 */
  /* ---------------------------------------------------------------- */

  it('forwards the :680-stamped metamagicHeighten through the REAL envelope without mutating the caller metaCtx', async () => {
    executeHandler.mockResolvedValue(POPUP);
    getRuntimeValue.mockImplementation((who, key) =>
      (key === 'activeConditions' && who === 'TestWizard') ? ['invisible'] : []);
    const playerStats = makePlayerStats({
      automation: { passives: [{ type: 'passive_rule', effect: 'magical_ambush' }] },
    });
    const callerMetaCtx = { targetName: 'Goblin' };
    const spell = diskRow('Barkskin', spells5e);

    const result = await executeSpellCast(spell, callerMetaCtx, makeOpts(playerStats));

    expect(result.automationPopup).toBe(POPUP);
    const [action] = executeHandler.mock.calls[0];
    // Stamped at index.js:680, spread fresh at triggerSpells.js:460.
    expect(action.metaCtx).toEqual({ targetName: 'Goblin', metamagicHeighten: true });
    expect(action.metaCtx).not.toBe(callerMetaCtx);
    // Caller's object untouched — index.js:680 clones, never mutates.
    expect(callerMetaCtx).toEqual({ targetName: 'Goblin' });
  });
});
