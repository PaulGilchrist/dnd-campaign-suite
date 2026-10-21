// @maintained-by-ai
// Lane: the per-round maturity sweep — expireStaleEffects driving the real
// expirationQueue (expireForCreature/expireForTarget → processExpirationList).
// OWNER of the maturity truth table (confirmed by #1294: the round-arithmetic
// boundary is not pinned in the ba001/addExpiration lanes): currentRound vs
// appliedRound + expiryRounds, including the exact-expiry row (source operator
// is `>=` — pinned honestly), Infinity/missing-rounds inertness, negative and
// NaN rows, and the expireOnCreatureName seam (operator is strict `>`).
// Expiry CONSEQUENCE routing is pinned here as exact dispatch args with a
// multi-type mixed batch — per-type clear internals are owned by
// clearExpirationEffects*.test.js; the FT-082 te option-scoping collateral is
// owned by turnStartEffects_additional.test.js; real condition-clear
// consequence end-to-end + early exits live in expireStaleEffects.test.js.
// Original :275 cite preserved: "damage application is tested in
// applyAuraDamage.test.js" (plus turnStartEffects_innerRadiance.test.js and
// expirations_applyAuraDamage.test.js — innerRadiance aura damage is NOT
// this lane; the vacuous innerRadiance probe that stood here was removed).
// Cited BY: applyTurnStartEffects.test.js header (topple/cloak/wild-magic/
// flag clears), sleetStormHandler.areaSave.test.js (sleet seam pins),
// naturesVeilHandler.test.js (expiration queue internals).
// No-timers policy: the round is read ONLY through the getCurrentCombatRound
// seam — determinism proven by the negative test below.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  getAllStoreKeys: vi.fn(() => []),
}));

vi.mock('../../ui/utils.js', () => ({
  default: {
    getName: vi.fn((val) => String(val)),
  },
}));

vi.mock('../../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(),
  getActiveCreatureName: vi.fn(),
  getCombatSummary: vi.fn(),
  loadCombatSummary: vi.fn(),
  setCombatSummaryCache: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

// Consequence routing is pinned here; the real per-type switch is owned by
// clearExpirationEffects*.test.js lanes.
vi.mock('./clearExpirationEffects.js', () => ({
  clearExpirationEffects: vi.fn(),
}));

vi.mock('../../automation/handlers/spells/sleetStormHandler.js', () => ({
  processSleetStormAreaSave: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../automation/handlers/spells/stinkingCloudHandler.js', () => ({
  processStinkingCloudAreaSave: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../automation/handlers/spells/webAreaSaveHandler.js', () => ({
  processWebAreaSave: vi.fn().mockResolvedValue(undefined),
}));

// Inert under these fixtures (no matching turnStartEffects entries); mocked
// only to keep the import chain off unrelated services.
vi.mock('../../combat/automation/automationExpressions.js', () => ({
  evaluateAutoExpression: vi.fn((expr) => (typeof expr === 'number' ? expr : 1)),
}));
vi.mock('../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn().mockResolvedValue(true),
}));
vi.mock('../../rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(),
}));
vi.mock('../../automation/handlers/buffs/tempHpService.js', () => ({
  setTempHp: vi.fn(),
}));
vi.mock('../../../hooks/useAllySelection.js', () => ({
  getAllyList: vi.fn(() => []),
}));
vi.mock('../../ui/storage.js', () => ({
  default: {
    set: vi.fn().mockResolvedValue(undefined),
  },
}));

import { expireStaleEffects } from './expireStaleEffects.js';
import { applyTurnStartEffects, KEY } from './turnStartEffects.js';
import { clearExpirationEffects } from './clearExpirationEffects.js';
import { processSleetStormAreaSave } from '../../automation/handlers/spells/sleetStormHandler.js';
import { addEntry } from '../../ui/logService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getCurrentCombatRound, getActiveCreatureName, getCombatSummary } from '../../encounters/combatData.js';

const CAMPAIGN = 'test-campaign';

// mockClear keeps implementations — reset the mutable seams so a throwing or
// seeded stub from a previous test can never leak into the next.
function resetMocks() {
  vi.clearAllMocks();
  getRuntimeValue.mockReset().mockReturnValue(null);
  getCombatSummary.mockReset().mockReturnValue(null);
  getCurrentCombatRound.mockReset();
  getActiveCreatureName.mockReset();
}

function seedStore(values) {
  getRuntimeValue.mockImplementation((name, prop) => {
    const key = `${name}.${prop}`;
    return key in values ? values[key] : null;
  });
}

function seedActiveCombat(activeName, currentRound) {
  getCurrentCombatRound.mockReturnValue(currentRound);
  getActiveCreatureName.mockReturnValue(activeName);
  getCombatSummary.mockReturnValue({ creatures: [{ name: activeName }] });
}

// ---------------------------------------------------------------------------
// Maturity truth table — processExpirationList via expireStaleEffects (real)
// currentRound vs appliedRound + expiryRounds. Source operator is `>=`.
// ---------------------------------------------------------------------------
describe('expireStaleEffects — queue maturity boundary table', () => {
  beforeEach(() => {
    resetMocks();
    seedActiveCombat('Caster', 3);
  });

  it.each([
    { label: 'survives one round before the expiry round', appliedRound: 3, expiryRounds: 2, currentRound: 4, expires: false },
    { label: 'expires on the exact expiry round (operator >=, honestly pinned)', appliedRound: 3, expiryRounds: 2, currentRound: 5, expires: true },
    { label: 'never matures with expiryRounds Infinity (until:combat write shape)', appliedRound: 3, expiryRounds: Infinity, currentRound: 999, expires: false },
    { label: 'survives when appliedRound is missing (NaN comparison is false)', expiryRounds: 2, currentRound: 999, expires: false },
    { label: 'matures immediately when expiryRounds is negative', appliedRound: 5, expiryRounds: -1, currentRound: 5, expires: true },
  ])('$label', async ({ appliedRound, expiryRounds, currentRound, expires }) => {
    const entry = { target: 'Orc', effects: [{ type: 'condition', condition: 'restrained' }], expireOnCreatureName: null };
    if (appliedRound !== undefined) entry.appliedRound = appliedRound;
    if (expiryRounds !== undefined) entry.expiryRounds = expiryRounds;
    seedActiveCombat('Caster', currentRound);
    seedStore({ 'Caster.pendingExpirations': [entry] });

    await expireStaleEffects(CAMPAIGN, 'Caster');

    if (expires) {
      expect(clearExpirationEffects).toHaveBeenCalledTimes(1);
      expect(clearExpirationEffects).toHaveBeenCalledWith(entry.effects, 'Orc', 'Caster', CAMPAIGN);
      expect(setRuntimeValue).toHaveBeenCalledWith('Caster', KEY, [], CAMPAIGN);
    } else {
      expect(clearExpirationEffects).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
    }
  });

  it('matures on the expireOnCreatureName seam with strict > — holds on the applied round itself, fires the round after', async () => {
    const entry = { target: 'Orc', effects: [{ type: 'condition', condition: 'blinded' }], appliedRound: 3, expiryRounds: Infinity, expireOnCreatureName: 'Caster' };
    seedActiveCombat('Caster', 3);
    seedStore({ 'Caster.pendingExpirations': [entry] });

    await expireStaleEffects(CAMPAIGN, 'Caster');
    expect(clearExpirationEffects).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();

    resetMocks();
    seedActiveCombat('Caster', 4);
    seedStore({ 'Caster.pendingExpirations': [entry] });

    await expireStaleEffects(CAMPAIGN, 'Caster');
    expect(clearExpirationEffects).toHaveBeenCalledWith(entry.effects, 'Orc', 'Caster', CAMPAIGN);
    expect(setRuntimeValue).toHaveBeenCalledWith('Caster', KEY, [], CAMPAIGN);
  });

  it('dispatches one expired entry once with its FULL multi-type effects batch and rewrites the queue with only the live entry', async () => {
    const matured = { target: 'Orc', appliedRound: 1, expiryRounds: 2, expireOnCreatureName: null, effects: [
      { type: 'condition', condition: 'restrained' },
      { type: 'remove_target_effect', effect: 'slow', source: 'Caster' },
      { type: 'badge', badge: 'sleet_storm_zone' },
    ] };
    const live = { target: 'Troll', appliedRound: 3, expiryRounds: 2, expireOnCreatureName: null, effects: [{ type: 'condition', condition: 'blinded' }] };
    seedActiveCombat('Caster', 3);
    seedStore({ 'Caster.pendingExpirations': [matured, live] });

    await expireStaleEffects(CAMPAIGN, 'Caster');

    expect(clearExpirationEffects).toHaveBeenCalledTimes(1);
    expect(clearExpirationEffects).toHaveBeenCalledWith(matured.effects, 'Orc', 'Caster', CAMPAIGN);
    expect(setRuntimeValue).toHaveBeenCalledWith('Caster', KEY, [live], CAMPAIGN);
  });

  it('is deterministic — the round comes from the getCurrentCombatRound seam only, never Date.now', async () => {
    const nowSpy = vi.spyOn(Date, 'now');
    seedActiveCombat('Caster', 4);
    seedStore({ 'Caster.pendingExpirations': [{ target: 'Orc', effects: [], appliedRound: 3, expiryRounds: 2, expireOnCreatureName: null }] });

    await expireStaleEffects(CAMPAIGN, 'Caster');

    expect(getCurrentCombatRound).toHaveBeenCalledWith(CAMPAIGN);
    expect(nowSpy).not.toHaveBeenCalled();
    nowSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Sleet Storm recurring turn-start DEX saves (Phase 3) — seam owner cited by
// sleetStormHandler.areaSave.test.js
// ---------------------------------------------------------------------------
describe('expireStaleEffects — Sleet Storm recurring saves', () => {
  beforeEach(() => {
    resetMocks();
    seedActiveCombat('Caster', 3);
  });

  it('forces the area save at the caster tracking DC/map for live targets, skipping the caster itself', async () => {
    seedStore({
      'Caster._sleetStorm_Caster': { saveDc: 14, mapName: 'Cave' },
      'campaign.targetEffects': [
        { effect: 'sleet_storm', source: 'Caster', target: 'Orc' },
        { effect: 'sleet_storm', source: 'Caster', target: 'Caster' },
      ],
      'Orc.activeConditions': [],
    });

    await expireStaleEffects(CAMPAIGN, 'Caster');

    expect(processSleetStormAreaSave).toHaveBeenCalledTimes(1);
    expect(processSleetStormAreaSave).toHaveBeenCalledWith('Caster', 'Orc', CAMPAIGN, 'Cave');
  });

  it('skips a target that is already prone (no re-save)', async () => {
    seedStore({
      'Caster._sleetStorm_Caster': { saveDc: 14, mapName: 'Cave' },
      'campaign.targetEffects': [{ effect: 'sleet_storm', source: 'Caster', target: 'Orc' }],
      'Orc.activeConditions': ['prone', 'fatigued'],
    });

    await expireStaleEffects(CAMPAIGN, 'Caster');

    expect(processSleetStormAreaSave).not.toHaveBeenCalled();
  });

  it('is inert when the caster has no sleet storm tracking (spell ended)', async () => {
    seedStore({
      'campaign.targetEffects': [{ effect: 'sleet_storm', source: 'Caster', target: 'Orc' }],
      'Orc.activeConditions': [],
    });

    await expireStaleEffects(CAMPAIGN, 'Caster');

    expect(processSleetStormAreaSave).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Wild Magic Surge "end of your current turn" filter (Phase 1 side of
// expireStaleEffects). "end of your next turn" is owned by the
// applyTurnStartEffects lane below.
// ---------------------------------------------------------------------------
describe('expireStaleEffects — Wild Magic current-turn surge filter', () => {
  beforeEach(() => {
    resetMocks();
    seedActiveCombat('Wild Mage', 3);
  });

  it('drops "end of your current turn" entries (case/whitespace tolerant), writing the exact survivor list once', async () => {
    seedStore({
      'Wild Mage.wildMagicSurgeEffects': [
        { duration: ' End Of Your Current Turn ', type: 'surged' },
        { duration: '1 minute', type: 'keep_me' },
      ],
    });

    await expireStaleEffects(CAMPAIGN, 'Wild Mage');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Wild Mage',
      'wildMagicSurgeEffects',
      [{ duration: '1 minute', type: 'keep_me' }],
      CAMPAIGN,
      true,
    );
  });

  it('writes nothing when no surge effect matches the current-turn duration', async () => {
    seedStore({
      'Wild Mage.wildMagicSurgeEffects': [{ duration: '1 minute', type: 'keep_me' }],
    });

    await expireStaleEffects(CAMPAIGN, 'Wild Mage');

    const surgeWrites = setRuntimeValue.mock.calls.filter((c) => c[1] === 'wildMagicSurgeEffects');
    expect(surgeWrites).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Error recovery
// ---------------------------------------------------------------------------
describe('expireStaleEffects — error recovery', () => {
  it('resolves quietly with zero writes when getCombatSummary throws', async () => {
    resetMocks();
    getCurrentCombatRound.mockReturnValue(5);
    getActiveCreatureName.mockReturnValue('Goblin');
    getCombatSummary.mockImplementation(() => { throw new Error('summary offline'); });

    await expect(expireStaleEffects(CAMPAIGN)).resolves.toBeUndefined();
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// applyTurnStartEffects — cloak of shadows ends early when incapacitated
// (lane cited by applyTurnStartEffects.test.js header)
// ---------------------------------------------------------------------------
describe('applyTurnStartEffects — cloak_of_shadows', () => {
  beforeEach(() => {
    resetMocks();
    getCurrentCombatRound.mockReturnValue(2);
  });

  it('strips the buff and Invisible condition, clears the invisibility key, and logs when incapacitated', async () => {
    seedStore({
      'TestCharacter.activeBuffs': [{ effect: 'cloak_of_shadows' }, { effect: 'other' }],
      'TestCharacter.activeConditions': ['invisible', 'incapacitated', 'fatigued'],
    });

    await applyTurnStartEffects('TestCharacter', { turnStartEffects: [] }, CAMPAIGN);

    expect(setRuntimeValue).toHaveBeenCalledWith('TestCharacter', 'activeBuffs', [{ effect: 'other' }], CAMPAIGN);
    expect(setRuntimeValue).toHaveBeenCalledWith('TestCharacter', 'activeConditions', ['incapacitated', 'fatigued'], CAMPAIGN);
    expect(setRuntimeValue).toHaveBeenCalledWith('campaign', '_activeInvisibility_TestCharacter', null, CAMPAIGN);
    expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
      type: 'ability_use',
      characterName: 'TestCharacter',
      abilityName: 'Cloak of Shadows',
    }));
  });

  it('leaves the cloak standing when not incapacitated (zero writes)', async () => {
    seedStore({
      'TestCharacter.activeBuffs': [{ effect: 'cloak_of_shadows' }],
      'TestCharacter.activeConditions': ['fatigued'],
    });

    await applyTurnStartEffects('TestCharacter', { turnStartEffects: [] }, CAMPAIGN);

    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// applyTurnStartEffects — Topple prone cleanup boundary (currentRound >=
// appliedRound + 1, via the real toppleCleanup)
// ---------------------------------------------------------------------------
describe('applyTurnStartEffects — topple prone boundary', () => {
  beforeEach(() => {
    resetMocks();
    getCurrentCombatRound.mockReturnValue(2);
  });

  it.each([
    { label: 'clears prone on the exact expiry round (2 >= 1 + 1)', appliedRound: 1, expires: true },
    { label: 'keeps prone before the expiry round (2 >= 2 + 1 is false)', appliedRound: 2, expires: false },
  ])('$label', async ({ appliedRound, expires }) => {
    seedStore({
      'campaign.targetEffects': [{ effect: 'topple', target: 'Orc', appliedRound }],
      'Orc.activeConditions': ['prone', 'poisoned'],
    });

    await applyTurnStartEffects('TestCharacter', { turnStartEffects: [] }, CAMPAIGN);

    if (expires) {
      expect(setRuntimeValue).toHaveBeenCalledWith('Orc', 'activeConditions', ['poisoned'], CAMPAIGN);
      expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [], CAMPAIGN);
    } else {
      expect(setRuntimeValue).not.toHaveBeenCalled();
    }
  });
});

// ---------------------------------------------------------------------------
// applyTurnStartEffects — Wild Magic Surge "end of your next turn" clears at
// the START of the next turn (turnStartEffects.js:275 seam)
// ---------------------------------------------------------------------------
describe('applyTurnStartEffects — Wild Magic next-turn surge expiry', () => {
  beforeEach(() => {
    resetMocks();
    getCurrentCombatRound.mockReturnValue(2);
  });

  it('removes "end of your next turn" surge effects at next-turn start, keeping others', async () => {
    seedStore({
      'TestCharacter.wildMagicSurgeEffects': [
        { duration: 'end of your next turn', type: 'surged' },
        { duration: '1 minute', type: 'keep_me' },
      ],
    });

    await applyTurnStartEffects('TestCharacter', { turnStartEffects: [] }, CAMPAIGN);

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'TestCharacter',
      'wildMagicSurgeEffects',
      [{ duration: '1 minute', type: 'keep_me' }],
      CAMPAIGN,
      true,
    );
  });
});

// ---------------------------------------------------------------------------
// applyTurnStartEffects — once-per-turn flag clears (clearFlagIfSet seam)
// ---------------------------------------------------------------------------
describe('applyTurnStartEffects — once-per-turn flag clears', () => {
  beforeEach(() => {
    resetMocks();
    getCurrentCombatRound.mockReturnValue(2);
  });

  it.each([
    { flag: '_recklessAttack_offeredThisTurn', value: true, clears: true },
    { flag: 'piercerPunctureUsedThisTurn', value: true, clears: true },
    { flag: '_Savage_Attacker_usedRound', value: true, clears: true },
    { flag: 'piercerPunctureUsedThisTurn', value: null, clears: false },
  ])('clears $flag to null when set: $clears', async ({ flag, value, clears }) => {
    seedStore({ [`TestCharacter.${flag}`]: value });

    await applyTurnStartEffects('TestCharacter', { turnStartEffects: [] }, CAMPAIGN);

    const flagWrites = setRuntimeValue.mock.calls.filter((c) => c[1] === flag);
    if (clears) {
      expect(flagWrites).toEqual([['TestCharacter', flag, null, CAMPAIGN]]);
    } else {
      expect(flagWrites).toEqual([]);
    }
  });
});
