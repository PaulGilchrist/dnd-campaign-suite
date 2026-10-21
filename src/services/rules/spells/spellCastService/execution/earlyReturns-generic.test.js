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
/*  #1455 (pinned, NOT fixed): a cast consumed at :710 returns at     */
/*  :712 directly — runPostCastTriggersMerged (:720/:727/:751/:759)   */
/*  never runs, so Wild Magic Surge and post-cast riders are           */
/*  structurally unreachable on generic-handled casts. This suite      */
/*  locks that behavior in both directions: consumed rows bypass the   */
/*  post-cast block; declined rows reach it exactly once.              */
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

describe('executeSpellCast — generic automation lane (:710 consumption / :712 bypass)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue([]);
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

  it('consumes EVERY real-gate-passing automation.type disk row at :710 — exact census 44 (5e) + 78 (2024), and every consumed cast bypasses the post-cast block (:712, #1455/#1459/#1463)', async () => {
    // Declines are the SERVICE_HANDLED-name rows (real triggerSpells.js set)
    // and the effects.fail/success rows. Exact list, not just counts, so a
    // disk row silently gaining/losing generic consumption fails loudly.
    const DECLINED_5E = ['Color Spray', 'Dominate Monster', 'Entangle', "Irresistible Dance", "Resilient Sphere", 'Sleep'].sort();
    const DECLINED_2024 = ['Arms of Hadar', 'Color Spray', 'Entangle', 'Grease', "Otiluke's Resilient Sphere", "Otto's Irresistible Dance", 'Sleep'].sort();
    const EXPECTED = [
      { rules: undefined, rows: spells5e, consumed: 44, declined: DECLINED_5E },
      { rules: '2024', rows: spells2024, consumed: 78, declined: DECLINED_2024 },
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
          // #1455 pinned bypass: this consumed cast never touched post-cast.
          expect(triggerWildMagicSurge).not.toHaveBeenCalled();
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

    expect(totalConsumed).toBe(122);
  });

  /* ---------------------------------------------------------------- */
  /*  Consumption unwrap + bypass (#1455 pinned, not fixed)          */
  /* ---------------------------------------------------------------- */

  it('returns the handler popup wrapped verbatim (:710 envelope, :712 identity) and bypasses every downstream lane and post-cast trigger', async () => {
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
    // The bypass: post-cast block is structurally unreachable (:712).
    expect(triggerWildMagicSurge).not.toHaveBeenCalled();
    expect(triggerPostCastRiderSaves).not.toHaveBeenCalled();
    expect(triggerPostCastSelfHeals).not.toHaveBeenCalled();
    expect(triggerPostCastAllyHeals).not.toHaveBeenCalled();
    expect(triggerInspiringSmite).not.toHaveBeenCalled();
    expect(triggerSmiteOfProtection).not.toHaveBeenCalled();
    expect(triggerSpellThief).not.toHaveBeenCalled();
    expect(triggerBewitchingMagic).not.toHaveBeenCalled();
    expect(endSanctuary).not.toHaveBeenCalled();
  });

  it('consumes the cast even when the handler returns null (triggerSpells.js:466) — resolves undefined yet still bypasses post-cast; executeHandler gets the exact arity-5 tuple (:462, #1461)', async () => {
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
    // Bypass still holds for the no-result shape (#1455).
    expect(triggerWildMagicSurge).not.toHaveBeenCalled();
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
