// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ------------------------------------------------------------------ */
/*  HUB block-check integration lane (execution/index.js)              */
/*                                                                     */
/*  runCastBlockChecks (:651-667) REAL gate order:                     */
/*   1. checkBlockedBySpellcastingBuff(spell, playerStats, campaign)  */
/*      :652 — short-circuits :653 BEFORE getTargetInfo resolves.     */
/*   2. globeTargetName = (await getTargetInfo())?.name || null :655   */
/*   3. blockers array :657-661, first truthy returns :664:             */
/*      a. checkGlobeOfInvulnerability(spell, target, stats, camp)     */
/*      b. checkForcecageBlocked(spell, target, stats, camp)  :659     */
/*      c. checkAntimagicField(spell, stats, target, camp) :660        */
/*         — INLINE in index.js :90-113 (not a blockChecks export),    */
/*         so its hub payload/log bytes are owned HERE.                */
/*   4. null -> executeSpellCast continues :673; refusal bubbles the   */
/*      gate object IDENTICAL (:672 return block).                      */
/*                                                                     */
/*  Boundary reconciliation (do not duplicate):                          */
/*   - spellCastService.execute.test.js #1454: REAL blockChecks.js    */
/*     gate internals — buff refusal (:281) + silence ordering (:341).*/
/*   - execution/blockChecks.test.js #1466: module-direct gate bodies  */
/*     (globe/forcecage/buff payload bytes).                           */
/*   - HERE: gates MOCKED to pin hub->gate invocation tuples, exact    */
/*     invocationCallOrder, three-state short-circuit (block / pass /  */
/*     never-reached), identical-object bubbling, and the inline       */
/*     antimagic caster/target/precedence bytes (:90-113).             */
/*   - Cited by spellCastService.special.test.js:41 + #1461/:1466 as  */
/*     hub checkForcecageBlocked integration owner — face preserved    */
/*     as the Forcecage refusal row (see shift map in PR summary).    */
/*                                                                     */
/*  Kill matrix: gate reordered, short-circuit skipped, refusal swallowed */
/*  or cloned (identity), gate tuple wrong, wrong-arity store read,     */
/*  target branch firing with null target, caster/target precedence      */
/*  flipped, continuation halting at :672.                              */
/*  No clocks: all gates instantaneous; stored durations owned elsewhere. */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Mocks — every hub import (index.js:1-40) stubbed so no real        */
/*  service or disk lane loads; castingTimeUtils stays REAL (pure).    */
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
}));

// index.js:6 imports this DIRECT edge (barrel mock does not cover it).
vi.mock('../../../../automation/handlers/spells/compelledDuelHandler.js', () => ({
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

vi.mock('../../../features/inspiringSmiteService.js'
  , () => ({
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

// index.js:20 direct edge — never reached on any block/refusal row.
vi.mock('../../../../automation/handlers/class-warlock/psychicSpellsHandler.js', () => ({
  getPsychicSpellsConfig: vi.fn(() => null),
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
const { getSilenceSource, isCreatureInSilenceZone } = await import('../../../features/silenceService.js');
const { endFriendsOnHostileAction } = await import('../../../features/friendsService.js');
const { endInvisibilityOnHostileAction } = await import('../../../features/invisibilityService.js');
const { isInnateSorceryActive } = await import('../../../../combat/buffs/buffService.js');
const { checkBlockedBySpellcastingBuff: mockBuffGate, checkGlobeOfInvulnerability: mockGlobeGate, checkForcecageBlocked: mockForcecageGate } = await import('./blockChecks.js');
const { handleSleep, handleShapechange } = await import('./modalSpells.js');
const { handleGenericAutomation: mockGenericAutomation } = await import('./triggerSpells.js');

/* ------------------------------------------------------------------ */
/*  Test-data factories (lightweight payloads matching REAL hub       */
/*  field reads: te.effect/te.target per                       */
/*  src/services/combat/conditions/targetEffectDefinitions.js:636)   */
/* ------------------------------------------------------------------ */

const CAMPAIGN = 'test-campaign';

function makeSpell(overrides = {}) {
  return {
    name: 'Fireball',
    level: 3,
    school: 'Evocation',
    casting_time: '1 action',
    components: ['V', 'S'],
    range: '150 feet',
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

function makeOpts(playerStats = makePlayerStats()) {
  return {
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    playerStats,
    getTargetInfo: vi.fn(async () => ({ name: 'Goblin' })),
    campaignName: CAMPAIGN,
  };
}

const orderOf = (fn) => fn.mock.invocationCallOrder[0];

/* ------------------------------------------------------------------ */
/*  beforeEach — reset EVERY gate to explicit pass-through so no       */
/*  mockResolvedValue leaks across rows (vi.clearAllMocks keeps        */
/*  implementations).                                                    */
/* ------------------------------------------------------------------ */

describe('executeSpellCast — hub block-gate integration (index.js:651-672)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBuffGate.mockResolvedValue(null);
    mockGlobeGate.mockResolvedValue(null);
    mockForcecageGate.mockResolvedValue(null);
    getRuntimeValue.mockReturnValue([]);
    getSilenceSource.mockReturnValue(null);
    isCreatureInSilenceZone.mockReturnValue(false);
  });

  /* Gate 1 first: buff refusal bubbles identical, nothing after runs. */
  it('returns the buff-gate refusal object untouched and never resolves the target, reads the antimagic store, checks silence, logs or rolls', async () => {
    const spell = makeSpell();
    const playerStats = makePlayerStats();
    const opts = makeOpts(playerStats);
    const blockResult = { automationPopup: { type: 'popup', payload: { type: 'automation_info', name: 'Wild Shape', description: 'Fireball cannot be cast while TestWizard is under Wild Shape — no Spellcasting is allowed.' } } };
    mockBuffGate.mockResolvedValue(blockResult);

    const result = await executeSpellCast(spell, {}, opts);

    expect(result).toBe(blockResult);
    expect(mockBuffGate).toHaveBeenCalledTimes(1);
    expect(mockBuffGate).toHaveBeenCalledWith(spell, playerStats, CAMPAIGN);
    expect(opts.getTargetInfo).not.toHaveBeenCalled();
    expect(mockGlobeGate).not.toHaveBeenCalled();
    expect(mockForcecageGate).not.toHaveBeenCalled();
    expect(getRuntimeValue).not.toHaveBeenCalled();
    expect(getSilenceSource).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(opts.rollAttack).not.toHaveBeenCalled();
    expect(opts.rollDamage).not.toHaveBeenCalled();
  });

  /* Gate 2 (globe) after target resolution; gate 3 never reached. */
  it('resolves the target once, refuses at the globe gate with the full (spell, targetName, playerStats, campaign) tuple, and never reaches the forcecage or antimagic gates', async () => {
    const spell = makeSpell();
    const playerStats = makePlayerStats();
    const opts = makeOpts(playerStats);
    const blockResult = { automationPopup: { type: 'popup', payload: { type: 'automation_info', name: 'Globe of Invulnerability', description: 'Fireball is blocked' } } };
    mockGlobeGate.mockResolvedValue(blockResult);

    const result = await executeSpellCast(spell, {}, opts);

    expect(result).toBe(blockResult);
    expect(mockBuffGate).toHaveBeenCalledTimes(1);
    expect(opts.getTargetInfo).toHaveBeenCalledTimes(1);
    expect(mockGlobeGate).toHaveBeenCalledTimes(1);
    expect(mockGlobeGate).toHaveBeenCalledWith(spell, 'Goblin', playerStats, CAMPAIGN);
    expect(orderOf(mockBuffGate)).toBeLessThan(orderOf(mockGlobeGate));
    expect(mockForcecageGate).not.toHaveBeenCalled();
    expect(getRuntimeValue).not.toHaveBeenCalled();
    expect(getSilenceSource).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
    expect(opts.rollDamage).not.toHaveBeenCalled();
  });

  /* Cited hub face (#1461/#1466): forcecage refusal runs third. */
  it('refuses at the forcecage gate after the globe gate passed once, with the same resolved target tuple, before any antimagic store read', async () => {
    const spell = makeSpell();
    const playerStats = makePlayerStats();
    const opts = makeOpts(playerStats);
    const blockResult = { automationPopup: { type: 'popup', payload: { type: 'automation_info', name: 'Forcecage', description: 'Fireball is blocked' } } };
    mockForcecageGate.mockResolvedValue(blockResult);

    const result = await executeSpellCast(spell, {}, opts);

    expect(result).toBe(blockResult);
    expect(mockGlobeGate).toHaveBeenCalledTimes(1);
    expect(mockGlobeGate).toHaveBeenCalledWith(spell, 'Goblin', playerStats, CAMPAIGN);
    expect(mockForcecageGate).toHaveBeenCalledTimes(1);
    expect(mockForcecageGate).toHaveBeenCalledWith(spell, 'Goblin', playerStats, CAMPAIGN);
    expect(orderOf(mockGlobeGate)).toBeLessThan(orderOf(mockForcecageGate));
    // antimagic inline gate (:660) never ran — campaign store never read:
    expect(getRuntimeValue).not.toHaveBeenCalled();
    // and nothing past the block phase (:673+) ran:
    expect(getSilenceSource).not.toHaveBeenCalled();
    expect(handleSleep).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(opts.rollAttack).not.toHaveBeenCalled();
    expect(opts.rollDamage).not.toHaveBeenCalled();
  });

  /* Inline antimagic hub bytes (:90-113) — caster branch, runs third,   */
  /* caster precedence over a same-store target match.                      */
  it('blocks on the inline antimagic gate third with exact caster popup and refusal log bytes, and the caster branch wins even when the target also matches', async () => {
    const spell = makeSpell();
    const playerStats = makePlayerStats();
    const opts = makeOpts(playerStats);
    getRuntimeValue.mockImplementation((key, prop) => {
      if (key === 'campaign' && prop === 'targetEffects') {
        return [{ effect: 'antimagic_field', target: 'TestWizard', source: 'Sorcerer' }];
      }
      return [];
    });

    const result = await executeSpellCast(spell, {}, opts);

    expect(result).toEqual({
      automationPopup: {
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Antimagic Field',
          description: 'Fireball is blocked by Antimagic Field affecting TestWizard.',
        },
      },
    });
    expect(getRuntimeValue.mock.calls).toEqual([['campaign', 'targetEffects']]);
    expect(addEntry).toHaveBeenCalledTimes(1);
    const [logCampaign, entry] = addEntry.mock.calls[0];
    expect(logCampaign).toBe(CAMPAIGN);
    expect({ ...entry, timestamp: undefined }).toEqual({
      type: 'automation',
      creatureName: 'TestWizard',
      name: 'Antimagic Field',
      description: 'Fireball blocked — caster is within Antimagic Field.',
      timestamp: undefined,
    });
    expect(typeof entry.timestamp).toBe('number');
    // globe and forcecage ran (null) BEFORE antimagic logged:
    expect(mockGlobeGate).toHaveBeenCalledTimes(1);
    expect(mockForcecageGate).toHaveBeenCalledTimes(1);
    expect(orderOf(mockGlobeGate)).toBeLessThan(orderOf(mockForcecageGate));
    expect(orderOf(mockForcecageGate)).toBeLessThan(orderOf(addEntry));
    expect(getSilenceSource).not.toHaveBeenCalled();
    expect(opts.rollDamage).not.toHaveBeenCalled();

    // Precedence: caster + Goblin both in the field -> still the caster popup.
    getRuntimeValue.mockImplementation((key, prop) => {
      if (key === 'campaign' && prop === 'targetEffects') {
        return [
          { effect: 'antimagic_field', target: 'Goblin', source: 'Cleric' },
          { effect: 'antimagic_field', target: 'TestWizard', source: 'Sorcerer' },
        ];
      }
      return [];
    });

    const result2 = await executeSpellCast(spell, {}, opts);

    expect(result2).toEqual({
      automationPopup: {
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Antimagic Field',
          description: 'Fireball is blocked by Antimagic Field affecting TestWizard.',
        },
      },
    });
    expect(addEntry).toHaveBeenCalledTimes(2);
    const [, entry2] = addEntry.mock.calls[1];
    expect({ ...entry2, timestamp: undefined }).toEqual({
      type: 'automation',
      creatureName: 'TestWizard',
      name: 'Antimagic Field',
      description: 'Fireball blocked — caster is within Antimagic Field.',
      timestamp: undefined,
    });
  });

  /* Inline antimagic hub bytes — target branch (:104-110). */
  it('blocks on the inline antimagic gate with exact target popup and log bytes when only the resolved target is inside the field', async () => {
    const spell = makeSpell();
    const playerStats = makePlayerStats();
    const opts = makeOpts(playerStats);
    getRuntimeValue.mockImplementation((key, prop) => {
      if (key === 'campaign' && prop === 'targetEffects') {
        return [
          { effect: 'antimagic_field', target: 'Nobody', source: 'Druid' },
          { effect: 'antimagic_field', target: 'Goblin', source: 'Cleric' },
        ];
      }
      return [];
    });

    const result = await executeSpellCast(spell, {}, opts);

    expect(result).toEqual({
      automationPopup: {
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Antimagic Field',
          description: 'Fireball is blocked by Antimagic Field protecting Goblin.',
        },
      },
    });
    expect(addEntry).toHaveBeenCalledTimes(1);
    const [logCampaign, entry] = addEntry.mock.calls[0];
    expect(logCampaign).toBe(CAMPAIGN);
    expect({ ...entry, timestamp: undefined }).toEqual({
      type: 'automation',
      creatureName: 'TestWizard',
      name: 'Antimagic Field',
      description: 'Fireball blocked — Goblin is within Antimagic Field.',
      timestamp: undefined,
    });
    expect(typeof entry.timestamp).toBe('number');
    expect(getSilenceSource).not.toHaveBeenCalled();
    expect(opts.rollAttack).not.toHaveBeenCalled();
  });

  /* Three-state "pass": all four gates null -> hub continues and exits   */
  /* at the silence gate (:682), proving null is not a block (:672).      */
  it('continues past four passing block gates and exits at the Silence gate before the cast log, hostile side effects, trigger chain or dice', async () => {
    const spell = makeSpell();
    const playerStats = makePlayerStats();
    const opts = makeOpts(playerStats);
    getRuntimeValue.mockImplementation((key, prop) => {
      if (key === 'campaign' && prop === 'targetEffects') {
        return [{ effect: 'faerie_fire', target: 'Goblin', source: 'Druid' }];
      }
      return [];
    });
    getSilenceSource.mockReturnValue('SilenceCaster');
    isCreatureInSilenceZone.mockReturnValue(true);

    const result = await executeSpellCast(spell, {}, opts);

    // Exited via the Silence gate — payload bytes owned by
    // spellCastService.noformula-modals.test.js; only identity of the
    // exit point pinned here.
    expect(result.automationPopup.type).toBe('popup');
    expect(result.automationPopup.payload.name).toBe('Silence');
    // Full hub gate order: buff -> getTargetInfo -> globe -> forcecage ->
    // antimagic store read -> (magical ambush read) -> silence lookup.
    expect(orderOf(mockBuffGate)).toBeLessThan(orderOf(opts.getTargetInfo));
    expect(orderOf(opts.getTargetInfo)).toBeLessThan(orderOf(mockGlobeGate));
    expect(orderOf(mockGlobeGate)).toBeLessThan(orderOf(mockForcecageGate));
    expect(getRuntimeValue.mock.calls).toEqual([
      ['campaign', 'targetEffects'],
      ['TestWizard', 'activeConditions', CAMPAIGN],
    ]);
    expect(getSilenceSource).toHaveBeenCalledTimes(1);
    expect(orderOf(mockForcecageGate)).toBeLessThan(orderOf(getSilenceSource));
    // Only the silence gate's own refusal log fired (:138 — payload bytes
    // owned by spellCastService.execute.test.js ORDER 2); nothing past :683
    // ran: no cast log (:698), no side effects, no chain, no dice.
    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(addEntry.mock.calls[0][0]).toBe(CAMPAIGN);
    expect(addEntry.mock.calls[0][1].name).toBe('Silence');
    expect(addEntry.mock.calls[0][1].creatureName).toBe('TestWizard');
    expect(endFriendsOnHostileAction).not.toHaveBeenCalled();
    expect(endInvisibilityOnHostileAction).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(isInnateSorceryActive).not.toHaveBeenCalled();
    expect(handleSleep).not.toHaveBeenCalled();
    expect(handleShapechange).not.toHaveBeenCalled();
    expect(mockGenericAutomation).not.toHaveBeenCalled();
    expect(opts.rollAttack).not.toHaveBeenCalled();
    expect(opts.rollDamage).not.toHaveBeenCalled();
  });
});
