// @maintained-by-ai
/* ------------------------------------------------------------------ */
/*  EARLY-MODAL CHAIN LANE — index.js :702-:709 dispatch/consume      */
/*                                                                     */
/*  Unit under test: executeSpellCast's early-trigger chain (          */
/*  index.js:701-712) for the modal/popup names ONLY — the arms,      */
/*  their exact dispatch envelopes, and the :712 consumption shape.    */
/*  earlyReturns-generic.test.js (#1470) owns :710 REAL generic        */
/*  consumption + :712 bypass census; cited-by generic lane :11        */
/*  ("earlyReturns-modal.test.js owns :702-:709 names") and           */
/*  noformula-modals :35-37 ("EARLY chain modals ... owned by         */
/*  execution/earlyReturns-modal.test.js — absent there").             */
/*                                                                     */
/*  REAL-vs-mock producer split (de-mock per #1350/#1470; producers    */
/*  whose exact payload bytes another lane already pins stay MOCKED    */
/*  here so this lane can own the hub dispatch tuple + consumption):   */
/*   - handlePowerWordHeal/Kill   MOCKED — REAL producer bytes owned   */
/*     by modalSpells.powerWordSpread.test.js (#CLA-392).              */
/*   - handleMassSuggestion       MOCKED — REAL producer bytes owned   */
/*     by modalSpells.massSuggestion-pay-at-confirm.test.js (#1386). */
/*   - handleHypnoticPatternEarly MOCKED — special lane #1461 runs     */
/*     the REAL producer (exact payload bytes, innate-sorcery +1,      */
/*     riders-never, dead-span twin) and folds this lane at ":386      */
/*     modalName only, mocked producer" — reconciled: this lane pins   */
/*     the :706 dispatch envelope + consumption + intercept order,     */
/*     NOT payload internals.                                            */
/*   - handleCalmEmotions / handleConfusionEarly / handleShapechange / */
/*     handleSleep  REAL — no sibling lane executes these producers;   */
/*     their external edges (shapechangeHandler.handle, confusion-     */
/*     Service.triggerConfusion) are the mock boundaries, owned by     */
/*     shapechangeHandler.test.js / confusionService.test.js.          */
/*                                                                     */
/*  :707 FIXED (fix#121(d), #1458; was the Promise-shape double-unwrap  */
/*  quirk, disposition "OWNED BY earlyReturns-modal"): handleConfusionEarly */
/*  returns { handled: true, result: <async-IIFE Promise> } (modalSpells.js */
/*  :151-157); the RETIRED arm read r.result?.result — a Promise has no    */
/*  .result, so the read was undefined EVERY time and the IIFE ran          */
/*  detached/untracked. The arm is now ASYNC: it awaits the Promise        */
/*  (effect lands before the lane resolves) and console.errors loudly on   */
/*  rejection (fix#116 await family + fix#9 loud-fail family). Swallow      */
/*  contract preserved: :712 consumes { value: undefined } and               */
/*  executeSpellCast resolves undefined. triggerConfusion fires with the    */
/*  exact wrapped tuple — now tracked, never floating. Post-cast riders run */
/*  once via the fix#121(a) merge.                                          */
/*                                                                     */
/*  Intercept-before-generic proof (#1463 dead-span contrast): the     */
/*  disk rows for Mass Suggestion/Hypnotic Pattern/Sleep carry          */
/*  automation.type with no effects.fail/success and are NOT in        */
/*  SERVICE_HANDLED_SPELLS (triggerSpells.js:42-57) — absent a :704/  */
/*  :706/:709 intercept they would be hijacked at :710. Every consumed */
/*  row pins handleGenericAutomation + executeHandler never called,   */
/*  and fix#121(a): consumed casts now run the post-cast rider block   */
/*  exactly once through the :712 merge (#1455 bypass retired).        */
/*  Case-gate split (#1457/185/212/232 trail): early-arm gates        */
/*  lowercase (modalSpells.js:42/70/96/123/150/163) while the disk    */
/*  lookup is EXACT-case (index.js:179) — pinned on the calm arm.     */
/*  NO-CLOCK: every modal here persists until answered; nothing        */
/*  auto-dismisses, no timers exist or are asserted-on.                */
/*  Fixtures are REAL disk rows (5e + 2024 PWH), fetch stubbed to the */
/*  same JSON (#1455/57/58/63/64/68 fabricated-shape ban); campaign    */
/*  locked to 'test-campaign'.                                         */
/* ------------------------------------------------------------------ */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import spells5e from '../../../../../../public/data/spells.json';
import spells2024 from '../../../../../../public/data/2024/spells.json';

/* ------------------------------------------------------------------ */
/*  Mocks — all dependencies of execution/index.js except the four   */
/*  REAL early producers of ./modalSpells.js (partial mock below).   */
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

vi.mock('../../combat/buffs/buffService.js', () => ({
  isInnateSorceryActive: vi.fn(() => false),
}));

vi.mock('../../../core/spellDamageUtils.js', () => ({
  // REAL disk modal rows are damage-less — the mock must not fabricate a
  // formula (#1468). The early chain runs before the no-damage branch.
  resolveSpellDamageWithTypes: vi.fn(() => ({ formula: null, primaryType: null })),
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

// Boundary of the REAL shapechange producer; internals owned by
// automation/handlers/spells/shapechangeHandler.test.js (#1440 real-promise).
vi.mock('../../../../automation/handlers/spells/shapechangeHandler.js', () => ({
  handle: vi.fn(() => Promise.resolve(null)),
}));

// PARTIAL mock: the four producers no sibling lane runs stay REAL; the
// four whose exact bytes are pinned elsewhere stay mocked (header map).
vi.mock('./modalSpells.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    handlePowerWordHeal: vi.fn(async () => ({ handled: false })),
    handlePowerWordKill: vi.fn(async () => ({ handled: false })),
    handleMassSuggestion: vi.fn(() => ({ handled: false })),
    handleHypnoticPatternEarly: vi.fn(() => ({ handled: false })),
  };
});

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
/*  Mock references (identity-pinned)                                */
/* ------------------------------------------------------------------ */

const { getRuntimeValue } = await import('../../../../../hooks/runtime/useRuntimeState.js');
const { executeHandler } = await import('../../../../automation/index.js');
const { triggerConfusion } = await import('../../../features/confusionService.js');
const { handle: shapechangeHandle } = await import('../../../../automation/handlers/spells/shapechangeHandler.js');
const { handleSavePath } = await import('./savePath.js');
const { handleNoSavePath } = await import('./noSavePath.js');
const {
  handlePowerWordHeal: mockPwh,
  handlePowerWordKill: mockPwk,
  handleMassSuggestion: mockMassSuggestion,
  handleHypnoticPatternEarly: mockHypnoticEarly,
} = await import('./modalSpells.js');
const { handleGenericAutomation: mockGeneric } = await import('./triggerSpells.js');
const {
  triggerWildMagicSurge,
} = await import('../../../features/wildMagicSurgeService.js');
const {
  triggerPostCastRiderSaves,
  triggerBewitchingMagic,
  triggerSpellThief,
  triggerSoulstitchSpells,
} = await import('../../../../rules/spells/postCastRiderService.js');
const { triggerHealingWord } = await import('../../../features/healingWordService.js');
const { triggerPostCastSelfHeals, triggerPostCastAllyHeals } = await import('../../../../rules/spells/postCastHealService.js');
const { applyPowerWordHealToTarget, applyPowerWordKillToTarget } = await import('./helpers.js');

/* ------------------------------------------------------------------ */
/*  Fixtures — REAL disk rows only (#1455/57/58 fabricated-shape ban) */
/* ------------------------------------------------------------------ */

const CAMPAIGN = 'test-campaign';

function diskRow(name, rules = '5e') {
  const src = rules === '2024' ? spells2024 : spells5e;
  const row = src.find((s) => s.name === name);
  if (!row) throw new Error(`disk row missing: ${name} (${rules})`);
  return row;
}

const playerStats = {
  name: 'TestWizard',
  abilities: [{ name: 'Intelligence', bonus: 5 }],
  proficiency: 4,
  spellAbilities: { spellCastingAbility: 'Intelligence', toHit: 9, saveDc: 17, modifier: 5 },
  automation: { passives: [] },
  hitPoints: 100,
  level: 10,
};
const playerStats2024 = { ...playerStats, rules: '2024' };

const getTargetInfo = vi.fn(async () => ({ name: 'Goblin' }));
const rollAttack = vi.fn();
const rollDamage = vi.fn();
const characters = [{ name: 'Goblin' }];

function makeOpts(extra = {}) {
  return {
    rollAttack,
    rollDamage,
    playerStats,
    getTargetInfo,
    campaignName: CAMPAIGN,
    mapName: 'grid-1',
    characters,
    ...extra,
  };
}

// fix#121(a) (#1455): consumed early-chain casts now thread the post-cast rider
// block exactly once through the :712 merge (surge + riderSaves + bewitching +
// thief + heal pair riders via their name gates inside the mocked service). The
// damage/save paths, :710 generic arm and the healing-word fire remain unreachable
// — the cast was consumed before :714. Self/ally heal riders fire once at :519/:522
// unless the producer flagged healRidersRun (:710 mass types / :337 — none here).
function expectNoPostCastOrPaths() {
  expect(handleSavePath).not.toHaveBeenCalled();
  expect(handleNoSavePath).not.toHaveBeenCalled();
  expect(mockGeneric).not.toHaveBeenCalled();
  expect(executeHandler).not.toHaveBeenCalled();
  expect(triggerWildMagicSurge).toHaveBeenCalledTimes(1);
  expect(triggerPostCastRiderSaves).toHaveBeenCalledTimes(1);
  expect(triggerBewitchingMagic).toHaveBeenCalledTimes(1);
  expect(triggerSpellThief).toHaveBeenCalledTimes(1);
  expect(triggerSoulstitchSpells).not.toHaveBeenCalled();
  expect(triggerHealingWord).not.toHaveBeenCalled();
  expect(triggerPostCastSelfHeals).toHaveBeenCalledTimes(1);
  expect(triggerPostCastAllyHeals).toHaveBeenCalledTimes(1);
  expect(rollAttack).not.toHaveBeenCalled();
  expect(rollDamage).not.toHaveBeenCalled();
}

/* ------------------------------------------------------------------ */
/*  beforeEach — re-arm every mock to declined/default               */
/* ------------------------------------------------------------------ */

describe('executeSpellCast early-modal chain (:702-:709) — exact dispatch envelopes, :712 consumption, :707 Promise double-unwrap quirk', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue([]);
    // lookupFullSpell (index.js:170) fetches the disk dataset — serve the
    // same real JSON so fullSpell stays disk-truth and no test hits the
    // network (same stub as earlyReturns-generic #1470).
    globalThis.fetch = vi.fn(async (url) => ({
      ok: true,
      json: async () => (url.includes('/2024/') ? spells2024 : spells5e),
    }));
    mockPwh.mockResolvedValue({ handled: false });
    mockPwk.mockResolvedValue({ handled: false });
    mockMassSuggestion.mockReturnValue({ handled: false });
    mockHypnoticEarly.mockReturnValue({ handled: false });
    triggerConfusion.mockResolvedValue(undefined);
    shapechangeHandle.mockResolvedValue(null);
  });

  /* ---------------------------------------------------------------- */
  /*  :702/:703 — Power Word Heal/Kill. The REAL producers return    */
  /*  { handled: true } with NO result key (modalSpells.js:20/:36 — */
  /*  bytes pinned REAL by powerWordSpread.test.js), so passThrough  */
  /*  yields { value: undefined } and the cast resolves undefined.   */
  /*  Mock arms return the producers' exact bytes — no fabricated    */
  /*  result payloads.                                               */
  /* ---------------------------------------------------------------- */

  it('consumes Power Word Heal/Power Word Kill at :702/:703 — exact inject-helper tuple, resolves undefined (no result key exists), later arms and riders never run', async () => {
    for (const row of [
      // :703 hit — the :702 heal arm ran first and DECLINED
      { name: 'Power Word Kill', rules: '5e', mock: mockPwk, earlierDeclined: mockPwh },
      // :702 hit — the :703 kill arm never runs at all
      { name: 'Power Word Heal', rules: '2024', mock: mockPwh, laterNever: mockPwk },
    ]) {
      vi.clearAllMocks();
      const envelope = diskRow(row.name, row.rules);
      const apply = row.rules === '2024' ? applyPowerWordHealToTarget : applyPowerWordKillToTarget;
      const ctx = { slotLevel: 9 };
      row.mock.mockResolvedValue({ handled: true }); // exact producer shape

      const result = await executeSpellCast(envelope, ctx, makeOpts({
        playerStats: row.rules === '2024' ? playerStats2024 : playerStats,
      }));

      expect(result).toBeUndefined(); // :712 consumption of absent result
      expect(row.mock).toHaveBeenCalledTimes(1);
      const arg = row.mock.mock.calls[0][0];
      expect(arg).toEqual({
        spell: envelope,
        metaCtx: { ...ctx, metamagicHeighten: false }, // CLA-219 chokepoint :680
        getTargetInfo,
        playerStats: row.rules === '2024' ? playerStats2024 : playerStats,
        campaignName: CAMPAIGN,
        [row.rules === '2024' ? 'applyPowerWordHealToTarget' : 'applyPowerWordKillToTarget']: apply,
      });
      const applyKey = row.rules === '2024' ? 'applyPowerWordHealToTarget' : 'applyPowerWordKillToTarget';
      expect(Object.keys(arg).sort()).toEqual(
        ['campaignName', 'getTargetInfo', 'metaCtx', 'playerStats', 'spell', applyKey].sort(),
      );
      expect(arg.spell).toBe(envelope);
      expect(arg.getTargetInfo).toBe(getTargetInfo);
      expect(arg[applyKey]).toBe(apply); // injected helper identity (:702/:703 pass the helpers from helpers.js)
      // chain stops at the hit arm; hijack-proof: :710/generic never runs (#1463 contrast)
      for (const later of [mockMassSuggestion, mockHypnoticEarly, triggerConfusion, shapechangeHandle]) {
        expect(later).not.toHaveBeenCalled();
      }
      if (row.laterNever) expect(row.laterNever).not.toHaveBeenCalled(); // hit at :702
      if (row.earlierDeclined) {
        // :702 ran BEFORE :703 caught it — exact declined arm order proof
        expect(row.earlierDeclined).toHaveBeenCalledTimes(1);
        expect(row.earlierDeclined.mock.invocationCallOrder[0]).toBeLessThan(row.mock.mock.invocationCallOrder[0]);
      }
      expectNoPostCastOrPaths();
    }
  });

  /* ---------------------------------------------------------------- */
  /*  :704 — Mass Suggestion (producer MOCKED; payload bytes owned   */
  /*  by pay-at-confirm lane #1386). Positional dispatch tuple.     */
  /* ---------------------------------------------------------------- */

  it('intercepts Mass Suggestion at :704 with its positional tuple before the :710 generic hijack and passes the popup envelope through untouched', async () => {
    const envelope = diskRow('Mass Suggestion');
    const popup = {
      type: 'modal',
      modalName: 'massSuggestion',
      payload: { saveType: 'WIS', saveDc: 17, deferSlotPayment: false },
    };
    mockMassSuggestion.mockReturnValue({ handled: true, result: { automationPopup: popup } });

    const result = await executeSpellCast(envelope, { slotLevel: 6 }, makeOpts());

    expect(result).toEqual({ automationPopup: popup });
    expect(result.automationPopup).toBe(popup); // byte-untouched pass-through identity (:74 passThrough)
    // POSITIONAL arity-4 — not an object envelope (index.js:704)
    expect(mockMassSuggestion).toHaveBeenCalledWith(envelope, 17, playerStats, CAMPAIGN);
    expect(mockMassSuggestion.mock.calls[0].length).toBe(4);
    expect(mockMassSuggestion.mock.calls[0][0]).toBe(envelope);
    expect(mockMassSuggestion.mock.calls[0][2]).toBe(playerStats);
    // arms before ran-declined, arms after never ran
    expect(mockPwh).toHaveBeenCalledTimes(1);
    expect(mockPwk).toHaveBeenCalledTimes(1);
    expect(mockHypnoticEarly).not.toHaveBeenCalled();
    expect(triggerConfusion).not.toHaveBeenCalled();
    expect(shapechangeHandle).not.toHaveBeenCalled();
    expectNoPostCastOrPaths();
  });

  /* ---------------------------------------------------------------- */
  /*  :705 — Calm Emotions. REAL producer (sole hub face): exact     */
  /*  disk-shaped payload bytes at the hub + lowercase gate vs       */
  /*  exact-case disk lookup (#1457 :185/212/232 trail, here :70).  */
  /* ---------------------------------------------------------------- */

  it('opens the exact Calm Emotions modal from the REAL producer via :705 and still opens it for an uppercase cast the exact-case disk lookup misses (lowercase gate :70 vs lookup :179)', async () => {
    const envelope = diskRow('Calm Emotions');

    const result = await executeSpellCast(envelope, { slotLevel: 2 }, makeOpts());

    expect(result).toStrictEqual({
      automationPopup: {
        type: 'modal',
        modalName: 'calmEmotions',
        payload: {
          action: { name: 'Calm Emotions', automation: { type: 'calm_emotions' } },
          playerStats,
          campaignName: CAMPAIGN,
          saveType: 'CHA',
          saveDc: 17,
          activeOverlay: null,
          metamagicCareful: false,
          metamagicHeighten: false, // CLA-219 coercion at :680
        },
      },
    });
    expect(result.automationPopup.payload.playerStats).toBe(playerStats);
    expect(mockHypnoticEarly).not.toHaveBeenCalled(); // :706+ never reached
    expect(triggerConfusion).not.toHaveBeenCalled();
    expectNoPostCastOrPaths();

    // Case-gate twin: 'CALM EMOTIONS' misses the EXACT-case disk lookup
    // (:179 console.errors) but the lowercase producer gate (:70) still
    // opens the same modal off the envelope — gates normalize, lookup doesn't.
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.clearAllMocks();
    const upper = { name: 'CALM EMOTIONS', level: 2, casting_time: '1 action', components: ['V', 'S'], dc: { dc_type: 'cha', dc_success: 'none' } };

    const upperRes = await executeSpellCast(upper, { slotLevel: 2 }, makeOpts());

    expect(upperRes.automationPopup).toEqual({
      type: 'modal',
      modalName: 'calmEmotions',
      payload: {
        action: { name: 'Calm Emotions', automation: { type: 'calm_emotions' } },
        playerStats,
        campaignName: CAMPAIGN,
        saveType: 'CHA',
        saveDc: 17,
        activeOverlay: null,
        metamagicCareful: false,
        metamagicHeighten: false,
      },
    });
    expect(errSpy).toHaveBeenCalledWith('[spellCast] Spell not found in spells.json:', 'CALM EMOTIONS');
    errSpy.mockRestore();
  });

  /* ---------------------------------------------------------------- */
  /*  :706 — Hypnotic Pattern early (producer MOCKED per folded-     */
  /*  owner note in special lane #1461, which pins the REAL bytes + */
  /*  innate-sorcery +1 + riders-never + dead span twin). Face here: */
  /*  the hub dispatch envelope, consumption, and intercept order.   */
  /* ---------------------------------------------------------------- */

  it('dispatches Hypnotic Pattern to :706 with the exact object envelope (innateSorceryActive flag included), consumes its popup, and beats the would-be :710 automation hijack', async () => {
    const envelope = diskRow('Hypnotic Pattern');
    const ctx = { slotLevel: 3 };
    const popup = {
      type: 'modal',
      modalName: 'hypnoticPattern',
      payload: { saveType: 'WIS', saveDc: 17, activeOverlay: null },
    };
    mockHypnoticEarly.mockReturnValue({ handled: true, result: { automationPopup: popup } });

    const result = await executeSpellCast(envelope, ctx, makeOpts());

    expect(result).toEqual({ automationPopup: popup });
    expect(result.automationPopup).toBe(popup);
    expect(mockHypnoticEarly).toHaveBeenCalledTimes(1);
    const arg = mockHypnoticEarly.mock.calls[0][0];
    expect(mockHypnoticEarly.mock.calls[0].length).toBe(1);
    expect(Object.keys(arg).sort()).toEqual(
      ['campaignName', 'fullSpell', 'innateSorceryActive', 'metaCtx', 'playerStats', 'spellSaveDc'].sort(),
    );
    expect(arg).toEqual({
      fullSpell: { ...envelope, index: undefined }, // merged copy at :181 — disk bytes, index explicitly undefined
      spellSaveDc: 17,
      playerStats,
      campaignName: CAMPAIGN,
      metaCtx: { ...ctx, metamagicHeighten: false },
      innateSorceryActive: false, // threaded from isInnateSorceryActive (:692)
    });
    expect(arg.fullSpell).not.toBe(envelope); // disk merge happened at :181 (fresh object)
    expect(arg.playerStats).toBe(playerStats);
    // disk row carries automation.type 'hypnotic_pattern' and is NOT in
    // SERVICE_HANDLED_SPELLS — :706 intercept beats :710 (#1463 contrast)
    expect(triggerConfusion).not.toHaveBeenCalled(); // :707 not reached
    expect(shapechangeHandle).not.toHaveBeenCalled();
    expectNoPostCastOrPaths();
  });

  /* ---------------------------------------------------------------- */
  /*  :707 — Confusion early. 🔴 Promise-shape double-unwrap, OWNED  */
  /*  HERE (#1470 disposition). REAL producer, honest quirk pin.     */
  /* ---------------------------------------------------------------- */

  it('consumes Confusion at :707 resolving UNDEFINED — fix#121(d): the arm AWAITS the awaited-IIFE Promise (detached-read retired), triggerConfusion fires once with the exact wrapped tuple, a rejection fails loudly, and the consumed cast still skips :708+save/damage lanes while riders run once post-payment', async () => {
    const envelope = diskRow('Confusion');
    const ctx = { slotLevel: 4 };

    const result = await executeSpellCast(envelope, ctx, makeOpts());

    // fix#121(d): handleConfusionEarly still returns { handled: true,
    // result: <async-IIFE Promise> } (modalSpells.js:151-157), but the hub
    // arm now AWAITS it inside runTriggerChain — the effect is TRACKED and
    // landed before the lane resolves (fix#116 family). Swallow contract
    // preserved: the consumed lane resolves undefined.
    expect(result).toBeUndefined();
    expect(triggerConfusion).toHaveBeenCalledTimes(1);
    const [sArg, mArg, pArg, cArg, mpArg] = triggerConfusion.mock.calls[0];
    expect(sArg).toBe(envelope); // raw cast envelope, NOT fullSpell (:707 passes spell)
    expect(mArg).toEqual({ ...ctx, metamagicHeighten: false, spellSaveDc: 17 });
    expect(mArg).not.toBe(ctx); // fresh wrapper ({ ...metaCtx, spellSaveDc }) — purity
    expect(ctx.spellSaveDc).toBeUndefined();
    expect(pArg).toBe(playerStats);
    expect(cArg).toBe(CAMPAIGN);
    expect(mpArg).toBe('grid-1');
    // consumed DESPITE undefined: { value: undefined } is truthy at :712 —
    // later arms and the damage/save lanes never run; fix#121(a): the
    // post-cast rider block DOES run, exactly once, before the return.
    expect(shapechangeHandle).not.toHaveBeenCalled(); // :708 unreachable
    expectNoPostCastOrPaths();

    // loud-fail arm (fix#9 family): a rejecting triggerConfusion must console.error
    // the exact hub bytes instead of surfacing as an unhandled rejection.
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const boom = new Error('confusion-boom');
    triggerConfusion.mockRejectedValueOnce(boom);
    const rejResult = await executeSpellCast(envelope, ctx, makeOpts());
    expect(rejResult).toBeUndefined(); // consumed lane stays swallow-shaped
    expect(triggerConfusion).toHaveBeenCalledTimes(2);
    expect(errSpy).toHaveBeenCalledWith('[spellCast] Confusion early trigger failed:', boom);
    errSpy.mockRestore();
  });

  /* ---------------------------------------------------------------- */
  /*  :708 — Shapechange. REAL producer (sole hub face); boundary     */
  /*  shapechangeHandler.handle stays mocked (internals owned by its */
  /*  own lane). Two consumption faces: popup pass-through identity    */
  /*  and null-popup — consumed at :712 yet resolves null.             */
  /* ---------------------------------------------------------------- */

  it('routes Shapechange through :708 with the exact action tuple and forwards the awaited popup identity; a null-resolving popup still consumes the cast (:712) and resolves null', async () => {
    const envelope = diskRow('Shapechange');
    const ctx = { slotLevel: 9 };
    const popup = { type: 'popup', payload: { type: 'shapechange_select' } };
    shapechangeHandle.mockResolvedValueOnce(popup);

    const result = await executeSpellCast(envelope, ctx, makeOpts());

    expect(result).toEqual({ automationPopup: popup });
    expect(result.automationPopup).toBe(popup); // awaited-IIFE flattening through :74/:712
    expect(shapechangeHandle).toHaveBeenCalledTimes(1);
    const [action, pStats, cName, mName, chars] = shapechangeHandle.mock.calls[0];
    expect(shapechangeHandle.mock.calls[0].length).toBe(5);
    expect(action).toEqual({
      name: 'Shapechange',
      spell: { ...envelope, index: undefined }, // merged fullSpell at :181 (index undefined by design)
      automation: { type: 'shapechange' },
      metaCtx: { ...ctx, metamagicHeighten: false, characters }, // characters folded at modalSpells.js:168
    });
    expect(action.metaCtx.characters).toBe(characters);
    expect(pStats).toBe(playerStats);
    expect(cName).toBe(CAMPAIGN);
    expect(mName).toBe('grid-1');
    expect(chars).toBe(characters);
    // name-only gate: disk row has NO dc yet arm fires — asymmetry vs
    // :705/:706/:707/:709 which all require fullSpell.dc
    expect(mockGeneric).not.toHaveBeenCalled();
    expect(executeHandler).not.toHaveBeenCalled();

    // null-popup consume-vs-discard (#1458 canon): the arm's passThrough
    // yields { value: <Promise resolving null> }; :712 returns it anyway —
    // the cast is CONSUMED, resolvers downstream still never run.
    vi.clearAllMocks();
    shapechangeHandle.mockResolvedValue(null);

    const nullRes = await executeSpellCast(envelope, ctx, makeOpts());

    expect(nullRes).toBeNull();
    expect(shapechangeHandle).toHaveBeenCalledTimes(1);
    expect(mockGeneric).not.toHaveBeenCalled();
    expect(executeHandler).not.toHaveBeenCalled();
    expectNoPostCastOrPaths();
  });

  /* ---------------------------------------------------------------- */
  /*  :709 — Sleep. REAL producer (sole hub face, chain tail):       */
  /*  exact payload bytes incl. fullSpell threading + the proven     */
  /*  :702->:708 arm order via invocationCallOrder; disk automation  */
  /*  row would be generic-hijacked at :710 without this intercept.  */
  /* ---------------------------------------------------------------- */

  it('reaches the chain tail for Sleep at :709 in exact arm order (:702-:708 all ran declined), emits the exact modal bytes with the unmerged fullSpell identity, and never reaches the generic hijack', async () => {
    const envelope = diskRow('Sleep');
    const ctx = { slotLevel: 1 };

    const result = await executeSpellCast(envelope, ctx, makeOpts());

    expect(result).toStrictEqual({
      automationPopup: {
        type: 'modal',
        modalName: 'sleep',
        payload: {
          action: { name: 'Sleep', automation: { type: 'sleep' } },
          spell: envelope,
          playerStats,
          campaignName: CAMPAIGN,
          saveType: 'WIS',
          saveDc: 17,
          characters,
          metamagicCareful: false,
          metamagicHeighten: false, // CLA-219 :680 coercion
        },
      },
    });
    // AoE disk row skips the lookup entirely (index.js:172-173) — the
    // payload's spell IS the cast envelope, same reference.
    expect(result.automationPopup.payload.spell).toBe(envelope);
    expect(result.automationPopup.payload.characters).toBe(characters);
    // every earlier arm executed declined, in exact source order
    const order = [mockPwh, mockPwk, mockMassSuggestion, mockHypnoticEarly].map((m) => m.mock.invocationCallOrder[0]);
    expect(order).toHaveLength(4);
    expect([...order].sort((a, b) => a - b)).toEqual(order); // :702 < :703 < :704 < :706
    expect(triggerConfusion).not.toHaveBeenCalled(); // :707 producer declined by name
    expect(shapechangeHandle).not.toHaveBeenCalled(); // :708 producer declined by name
    // disk sleep row: automation.type 'sleep', effects has no fail/success
    // keys, name NOT in SERVICE_HANDLED_SPELLS (triggerSpells.js:42-57) —
    // :709 intercept beats :710 (#1463 contrast)
    expectNoPostCastOrPaths();
  });
});
