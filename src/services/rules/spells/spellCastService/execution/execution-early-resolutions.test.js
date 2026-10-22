// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

/* OWNER MAP — execution/index.js pre-chain lane (#1382/#1458/#1461/ */
/* #1462/#1470/#1474/#1495). OWNED HERE: ambush DEGRADE family        */
/* (fix#126 — guards :132/:140 pure-throw, hub catch :157-:164 @:774), */
/* SP-002 null-activeConditions CONTINUE (:124-129, cited :331-350), */
/* lastActionSpellCast casings (:67) + endFriends/endInvisibility     */
/* transport (:60-63) (#1382), cast-log bytes (:225-244), Hunter's    */
/* Mark/Hex consumption exits + CLA-389 single-write (:514/:629-636). */
/* FOLDED OUT (owners cited, never re-grown): silence popup/log bytes */
/* + no-V guard -> spellCastService.execute.test.js:341-377 +         */
/* noformula-modals.test.js:484-531 (SP-106); corrupt activeConditions */
/* ABORT bytes -> spellCastService.test.js:452-470; :701-709 modal    */
/* arms + :707 Promise quirk -> earlyReturns-modal (#1471); :710/712  */
/* generic bypass -> earlyReturns-generic (#1470); hub gate order ->  */
/* execution-block-checks (#1474); CLA-219 :680 fold ->                */
/* index.magicalAmbushTransport; CLA-134 stamp -> aoeSpells:375;      */
/* applyHexEffects writes / CLA-107 -> spellCastService.hexEffects.   */
/* FIXTURE TRUTH: lightweight payloads (#1472) — area_of_effect makes */
/* needsLookup false (:172) so fetch NEVER fires; fullSpell === spell. */
/* normalizeCastingTime + psychicSpellsHandler run REAL (pure guards). */
/* No clocks. Campaign lockdown: test-campaign. Kill matrix: guard     */
/* removed -> throw row; == null -> corrupt-row absent-here (parent   */
/* owns bytes); normalize skipped -> 'Action' arm; === inverted ->    */
/* Friends arm; includes('action') -> '1 reaction' arm; Hex skip and  */
/* :514 guard removed -> addEntry/applyHexEffects singleton censuses. */

/* Mocks — every dependency of execution/index.js. The barrel edge is */
/* mocked at the REAL import path (compelledDuelHandler, index.js:6 — */
/* SP-026); the triggerSpells table is exhaustive because :710's       */
/* handleGenericAutomation consults it on every pass-through row.      */

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

vi.mock('../../../../automation/handlers/spells/compelledDuelHandler.js', () => ({
  checkCompelledDuelAttackExpiry: vi.fn(() => null),
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
}));

vi.mock('../../../core/spellDamageUtils.js', () => ({
  resolveSpellDamageWithTypes: vi.fn(() => ({ formula: '1d8', primaryType: 'Fire' })),
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
/*  Mock references                                                    */
/* ------------------------------------------------------------------ */

const { getRuntimeValue, setRuntimeValue } = await import('../../../../../hooks/runtime/useRuntimeState.js');
const { addEntry } = await import('../../../../ui/logService.js');
const { endFriendsOnHostileAction } = await import('../../../features/friendsService.js');
const { endInvisibilityOnHostileAction } = await import('../../../features/invisibilityService.js');
const { isInnateSorceryActive } = await import('../../../../combat/buffs/buffService.js');
const { resolveSpellDamageWithTypes } = await import('../../../core/spellDamageUtils.js');
const { getSilenceSource, isCreatureInSilenceZone } = await import('../../../features/silenceService.js');
const { applyHexEffects, triggerDispelMagic } = await import('./helpers.js');
const { handleSavePath } = await import('./savePath.js');
const { checkCompelledDuelAttackExpiry } = await import('../../../../automation/handlers/spells/compelledDuelHandler.js');

/* ------------------------------------------------------------------ */
/*  Fixtures — lightweight payloads (#1472 form). area_of_effect is  */
/*  present so lookupFullSpell's needsLookup (:172) is FALSE and no  */
/*  fetch fires; fullSpell stays the spell itself (identity).        */
/* ------------------------------------------------------------------ */

const CAMPAIGN = 'test-campaign';
const HOSTILE_TUPLE = ['TestWizard', CAMPAIGN];
const STAMP_TUPLE = ['TestWizard', 'lastActionSpellCast', 1, CAMPAIGN];

function makeSpell(overrides = {}) {
  return {
    name: 'Fireball',
    level: 3,
    school: 'Evocation',
    casting_time: '1 action',
    components: ['V', 'S'],
    range: '150 feet',
    area_of_effect: { type: 'sphere', size: 20 },
    damage: { damage_type: 'Fire', damage_at_slot_level: { 3: '8d6' } },
    dc: { dc_type: 'dex', dc_success: 'half' },
    ...overrides,
  };
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

const rollAttack = vi.fn();
const rollDamage = vi.fn();

function runCast(spell, playerStats = makePlayerStats()) {
  return executeSpellCast(spell, { targetName: 'Goblin' }, {
    rollAttack,
    rollDamage,
    playerStats,
    getTargetInfo: async () => ({ name: 'Goblin' }),
    campaignName: CAMPAIGN,
  });
}

/* Exact refusal bytes (index.js :142/:151) — identity of the exit
   point is pinned here; the silence lane's own ownership of these
   bytes lives in execute.test.js:341-377 / noformula-modals:484-531. */
const SILENCE_POPUP = {
  automationPopup: {
    type: 'popup',
    payload: {
      type: 'automation_info',
      name: 'Silence',
      description: 'Fireball cannot be cast — TestWizard is inside a Silence zone and Verbal spell components are impossible there.',
    },
  },
};
const SILENCE_LOG_REST = {
  type: 'automation',
  creatureName: 'TestWizard',
  name: 'Silence',
  description: 'Fireball blocked — TestWizard is inside SilenceCaster\'s Silence zone; Verbal components are impossible there.',
};

function withoutTimestamp(campaign, entry) {
  const { timestamp, ...rest } = entry;
  expect(Number.isInteger(timestamp)).toBe(true);
  return [campaign, rest];
}

/* ------------------------------------------------------------------ */
/*  beforeEach — reset all mock implementations to safe defaults     */
/* ------------------------------------------------------------------ */

describe('executeSpellCast — early resolutions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue([]);
    setRuntimeValue.mockResolvedValue(undefined);
    addEntry.mockResolvedValue(undefined);
    isInnateSorceryActive.mockReturnValue(false);
    getSilenceSource.mockReturnValue(null);
    isCreatureInSilenceZone.mockReturnValue(false);
    resolveSpellDamageWithTypes.mockReturnValue({ formula: '1d8', primaryType: 'Fire' });
  });

  /* ---------------------------------------------------------------- */
  /*  Magical-ambush resolution — fix#126 DEGRADE family (#1495)    */
  /* ---------------------------------------------------------------- */

  describe('magical-ambush passives guard', () => {
    it('fix#126 (#1495): passives-missing throw self-catches at the hub — cast CONTINUES degraded to metamagicHeighten:false, loud console pair, silence gate still reaches the cast', async () => {
      // Pre-fix capture (#1495, pinned green pre-fix): executeSpellCast REJECTED
      // WHOLE with 'playerStats.automation.passives is required…' — the paid slot
      // burned and every post-cast rider (surge/heals/marks, CLA-389 merge
      // :784+:793+:800+:824+:832) was structurally unreachable. fix#126 mirrors
      // the fix#119 :817 confusion-await self-catch law: guard throws stay LOUD
      // inside the resolver (pure :128-:144, exported contract intact) and the
      // single hub caller (:157-:164 → :774) degrades to the zero-bonus shape.
      const arms = [
        ['passives: null', makePlayerStats({ automation: { passives: null } })],
        ['passives key absent', makePlayerStats({ automation: {} })],
      ];
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        for (const [label, playerStats] of arms) {
          vi.clearAllMocks();
          getRuntimeValue.mockReturnValue([]);
          // Exit at the silence gate (:721) so the continue is observable without
          // walking the damage chain — SP-002 arm (:393) pattern, same next gate.
          getSilenceSource.mockReturnValue('SilenceCaster');
          isCreatureInSilenceZone.mockReturnValue(true);

          const result = await runCast(makeSpell(), playerStats);

          // No rejection: the cast reached the silence gate and returned its refusal.
          expect(result, label).toStrictEqual(SILENCE_POPUP);
          // Guard byte (:131) then hub catch byte (:161) — exact order, nothing else.
          expect(spy.mock.calls.map(c => c[0]), label).toEqual([
            '[spellCast] magicalAmbush check: playerStats.automation.passives is missing',
            '[spellCast] Magical Ambush resolution failed:',
          ]);
          // The resolver died BEFORE its caster read (:137): exactly one hub read.
          expect(getRuntimeValue.mock.calls, label).toEqual([['campaign', 'targetEffects']]);
          expect(getSilenceSource.mock.calls, label).toEqual([['TestWizard', CAMPAIGN]]);
          // Silence refusal precedes payment: cast log/hostile side effects still zero.
          expect(addEntry.mock.calls, label).toHaveLength(1);
          expect(setRuntimeValue.mock.calls, label).toEqual([]);
          expect(endFriendsOnHostileAction.mock.calls, label).toEqual([]);
          expect(endInvisibilityOnHostileAction.mock.calls, label).toEqual([]);
          spy.mockClear();
        }
      } finally {
        spy.mockRestore();
      }
    });
  });

  /* ---------------------------------------------------------------- */
  /*  SP-002 — null caster activeConditions continues (:124-129)     */
  /* ---------------------------------------------------------------- */

  describe('SP-002 null caster activeConditions', () => {
    it('SP-002: does not abort the cast when caster activeConditions is null', async () => {
      getRuntimeValue.mockImplementation((_character, key) => (
        key === 'activeConditions' ? null : []
      ));
      // Exit at the next gate (:682) so the continue is observable without
      // walking the damage chain (chain arms owned by earlyReturns-* lanes).
      getSilenceSource.mockReturnValue('SilenceCaster');
      isCreatureInSilenceZone.mockReturnValue(true);

      const result = await runCast(makeSpell());

      // A pre-chain abort would have rejected; instead the cast reached the
      // silence gate and returned its refusal with empty caster conditions.
      expect(result).toStrictEqual(SILENCE_POPUP);
      expect(getRuntimeValue.mock.calls).toEqual([
        ['campaign', 'targetEffects'],
        ['TestWizard', 'activeConditions', CAMPAIGN],
      ]);
      const [logCampaign, logRest] = withoutTimestamp(...addEntry.mock.calls[0]);
      expect(addEntry.mock.calls.length).toBe(1);
      expect(logCampaign).toBe(CAMPAIGN);
      expect(logRest).toEqual(SILENCE_LOG_REST);
      // Refusal precedes :687 — the cast never paid its hostile side effects.
      expect(endFriendsOnHostileAction.mock.calls).toEqual([]);
      expect(endInvisibilityOnHostileAction.mock.calls).toEqual([]);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  lastActionSpellCast casing table (#1382, index.js:67 CLA-399) */
  /* ---------------------------------------------------------------- */

  describe('lastActionSpellCast', () => {
    it('arms exactly for 5e "1 action" and 2024 "Action" casings and never for any other casting_time — full setRuntimeValue census per arm', async () => {
      const arms = [
        ['1 action', true],
        ['Action', true], // CLA-399: 2024 casing via REAL normalizeCastingTime
        ['Bonus Action', false], // CLA-399 negative
        ['1 bonus action', false],
        ['1 reaction', false], // kills an includes('action') shortcut at :67
      ];

      for (const [castingTime, armsFlag] of arms) {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue([]);
        setRuntimeValue.mockResolvedValue(undefined);
        addEntry.mockResolvedValue(undefined);

        const result = await runCast(makeSpell({ casting_time: castingTime }));

        // Every arm traverses the hostile lane to its null exit (:771).
        expect(result, castingTime).toBeNull();
        if (armsFlag) {
          expect(setRuntimeValue.mock.calls, castingTime).toEqual([STAMP_TUPLE]);
        } else {
          // Full census: ANY spurious stamp (wrong casing or extra call) fails.
          expect(setRuntimeValue.mock.calls, castingTime).toEqual([]);
          // Positive trail proves :60-63 executed — the skip is the :67 gate,
          // not an aborted lane (which would make the negative vacuous).
          expect(endFriendsOnHostileAction.mock.calls, castingTime).toEqual([HOSTILE_TUPLE]);
          expect(endInvisibilityOnHostileAction.mock.calls, castingTime).toEqual([HOSTILE_TUPLE]);
        }
      }
    });
  });

  /* ---------------------------------------------------------------- */
  /*  endFriends / endInvisibility transport (#1382, index.js:60-63) */
  /* ---------------------------------------------------------------- */

  describe('endFriends / endInvisibility', () => {
    it('ends Friends and Invisibility exactly once each, with exact tuples, on a hostile non-Friends cast', async () => {
      const result = await runCast(makeSpell({ name: 'Fireball' }));

      expect(result).toBeNull();
      expect(endFriendsOnHostileAction.mock.calls).toEqual([HOSTILE_TUPLE]);
      expect(endInvisibilityOnHostileAction.mock.calls).toEqual([HOSTILE_TUPLE]);
    });

    it('never ends Friends for the Friends spell in any casing, yet still ends Invisibility once per cast', async () => {
      for (const name of ['Friends', 'friends', 'FRIENDS']) {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue([]);
        addEntry.mockResolvedValue(undefined);

        const result = await runCast(makeSpell({ name }));

        expect(result, name).toBeNull();
        expect(endFriendsOnHostileAction.mock.calls, name).toEqual([]);
        expect(endInvisibilityOnHostileAction.mock.calls, name).toEqual([HOSTILE_TUPLE]);
      }
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Generic cast log (:225-244) — full key-set bytes               */
  /* ---------------------------------------------------------------- */

  describe('spell cast log', () => {
    it('writes exactly one generic spell-log entry with the full key-set, resolved target and computed saveDC', async () => {
      await runCast(makeSpell());

      expect(addEntry.mock.calls.length).toBe(1);
      const [logCampaign, entryRest] = withoutTimestamp(...addEntry.mock.calls[0]);
      expect(logCampaign).toBe(CAMPAIGN);
      expect(entryRest).toEqual({
        type: 'spell',
        characterName: 'TestWizard',
        targetName: 'Goblin',
        spellName: 'Fireball',
        spellLevel: 3,
        castingTime: '1 action',
        damageType: 'Fire',
        damageFormula: '1d8',
        saveDC: 17,
        concentration: false,
        description: null,
      });
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Hunter's Mark / Hex consumption (:629-636, CLA-389 single-write)*/
  /* ---------------------------------------------------------------- */

  describe('Hunter\'s Mark / Hex', () => {
    it('consumes Hunter\'s Mark at the marked-target gate: undefined exit, its own generic log, zero hex writes, zero duel expiry', async () => {
      const result = await runCast(makeSpell({ name: 'Hunter\'s Mark' }));

      expect(result).toBeUndefined();
      // Consumed at :725 BEFORE the duel-expiry (:731) and save-path (:754) seam.
      expect(checkCompelledDuelAttackExpiry.mock.calls).toEqual([]);
      expect(handleSavePath.mock.calls).toEqual([]);
      // CLA-389 double-write guard (:514): marked-target spells never re-apply hex.
      expect(applyHexEffects.mock.calls).toEqual([]);
      expect(triggerDispelMagic.mock.calls).toEqual([]);
      // Generic log ran for Hunter's Mark (only Hex is skipped at :226).
      expect(addEntry.mock.calls.length).toBe(1);
      const [logCampaign, entryRest] = withoutTimestamp(...addEntry.mock.calls[0]);
      expect(logCampaign).toBe(CAMPAIGN);
      expect(entryRest).toEqual({
        type: 'spell',
        characterName: 'TestWizard',
        targetName: 'Goblin',
        spellName: 'Hunter\'s Mark',
        spellLevel: 3,
        castingTime: '1 action',
        damageType: 'Fire',
        damageFormula: '1d8',
        saveDC: 17,
        concentration: false,
        description: null,
      });
    });

    it('Hex exit is owned by castHex: undefined result, one applyHexEffects call, and a single hex-shaped log — generic log skipped, base vs Eldritch bytes', async () => {
      const arms = [
        ['Hex', undefined, 'ability check disadvantage'],
        ['Hex with Eldritch Hex', [{ name: 'Eldritch Hex', type: 'conditional_disadvantage' }],
          'ability check disadvantage + saving throw disadvantage'],
      ];

      for (const [label, passives, effectsApplied] of arms) {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue([]);
        addEntry.mockResolvedValue(undefined);

        const spell = makeSpell({ name: 'Hex' });
        const playerStats = makePlayerStats(passives ? { automation: { passives } } : {});
        const result = await runCast(spell, playerStats);

        expect(result, label).toBeUndefined();
        // Single-write census: castHex (:498) is the ONLY hex write — the
        // CLA-389 post-cast guard (:514) skips its own applyHexEffects.
        expect(applyHexEffects.mock.calls, label).toEqual([
          [spell, playerStats, CAMPAIGN, 'Goblin', null],
        ]);
        expect(applyHexEffects.mock.calls[0][0], label).toBe(spell);
        // Consumed before the dispel fallback (:353/:357), duel expiry (:731)
        // and save path (:754).
        expect(triggerDispelMagic.mock.calls, label).toEqual([]);
        expect(checkCompelledDuelAttackExpiry.mock.calls, label).toEqual([]);
        expect(handleSavePath.mock.calls, label).toEqual([]);
        // Exactly ONE log: castHex's own entry — the generic log (:226) is skipped
        // for Hex. Full shape (no timestamp key) proves the generic shape is absent.
        expect(addEntry.mock.calls.length, label).toBe(1);
        const [logCampaign, hexEntry] = addEntry.mock.calls[0];
        expect(logCampaign, label).toBe(CAMPAIGN);
        expect(hexEntry, label).toEqual({
          type: 'spell',
          characterName: 'TestWizard',
          targetName: 'Goblin',
          spellName: 'Hex',
          spellLevel: 1,
          castingTime: '1 bonus action',
          hexAbility: null,
          effectsApplied,
        });
      }
    });
  });
});
