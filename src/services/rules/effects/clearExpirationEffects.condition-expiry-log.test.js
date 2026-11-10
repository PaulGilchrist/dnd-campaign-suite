// @maintained-by-ai
/**
 * Lane: [2026-11-07 clock-expiry audit] — a fired pendingExpirations clock
 * that strips an ACTIVE condition writes exactly ONE `condition removed`
 * campaign-log row carrying the condition label plus an expiry reason that
 * distinguishes round-anchor (expireOnCreatureName set — the
 * registerRiderConditionExpiry/FT-082 merged-payload shape, where
 * expiryRounds arrives as null after JSON serialization of Infinity) from
 * rounds-clock (finite expiryRounds) provenance. Copy mirrors the
 * repeat-save lane's removed rows (sleepService.js:231 /
 * frightfulPresenceService.js:191 — type:'condition', action:'removed',
 * condition, reason, sourceName) and the CLA-096 "duration has expired"
 * precedent rows in the same file.
 *
 * Negative faces pinned here: condition not actually present → silent
 * no-op stays silent; te-only / buff-only clocks (no condition leg) → zero
 * log noise; a repeated same-condition leg inside one clock fires at most
 * one row; dispatch never throws when the log write rejects.
 *
 * Owned elsewhere — do not duplicate:
 *   - main per-type clear bytes (condition/stunned/speed_zero strips):
 *     clearExpirationEffects.test.js
 *   - charmed/dominated strip bytes: clearExpirationEffects_additional_types.test.js
 *   - queue maturity/clock threading: expirationQueue.test.js +
 *     expirations_expireStaleEffects.test.js (entry passed as 5th arg)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  setRuntimeObject: vi.fn(),
  getAllStoreKeys: vi.fn(() => []),
}));

vi.mock('../../ui/utils.js', () => ({
  default: {
    getName: vi.fn((val) => String(val)),
  },
}));

vi.mock('../../ui/storage.js', () => ({
  default: {
    set: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../combat/concentration/concentrationService.js', () => ({
  breakConcentration: vi.fn(),
  cleanupConcentrationEffects: vi.fn(),
  restoreSuppressedConditions: vi.fn(),
}));

vi.mock('../../combat/summons/summonedCreatureService.js', () => ({
  removeSummonedCreatures: vi.fn(),
}));

vi.mock('../../automation/handlers/spells/polymorphService.js', () => ({
  revertPolymorph: vi.fn(),
}));

vi.mock('../../automation/handlers/spells/animalShapesService.js', () => ({
  revertAnimalShapes: vi.fn(),
}));

vi.mock('../../automation/handlers/spells/truePolymorphService.js', () => ({
  revertTruePolymorph: vi.fn(),
}));

vi.mock('../../automation/handlers/spells/shapechangeService.js', () => ({
  revertShapechange: vi.fn(),
}));

import { clearExpirationEffects } from './clearExpirationEffects.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';

const CAMPAIGN = 'MyCampaign';
const TARGET = 'Orc';
const ATTACKER = 'Shadow Rogue';

function resetMocks() {
  vi.clearAllMocks();
  getRuntimeValue.mockReset();
  setRuntimeValue.mockReset();
  localStorage.clear();
}

// Stateful store: each leg READS the previous write, so a second
// same-condition leg genuinely sees the condition as already gone.
function seedStore(initial = {}) {
  const store = { ...initial };
  getRuntimeValue.mockImplementation((name, key) => store[`${name}::${key}`] ?? null);
  setRuntimeValue.mockImplementation((name, key, value) => {
    store[`${name}::${key}`] = value;
  });
  return store;
}

// registerRiderConditionExpiry merged payload (attackRiderHandler.js:720-723):
// te-eviction leg FIRST, condition leg SECOND.
const RIDER_EFFECTS = [
  { type: 'remove_target_effect', effectKey: 'obscure', source: ATTACKER, option: 'Obscure', target: TARGET },
  { type: 'condition', condition: 'blinded' },
];

// Round-anchor clock as it exists AFTER the JSON store round-trip
// (Infinity → null; addExpiration.js:23 + expireOnCreatureName set).
const ROUND_ANCHOR_CLOCK = {
  target: TARGET,
  effects: RIDER_EFFECTS,
  appliedRound: 2,
  expiryRounds: null,
  expireOnCreatureName: ATTACKER,
};

const ROUNDS_CLOCK = (rounds) => ({
  target: TARGET,
  effects: RIDER_EFFECTS,
  appliedRound: 1,
  expiryRounds: rounds,
  expireOnCreatureName: null,
});

describe('clock-based condition expiry — campaign-log audit row', () => {
  beforeEach(resetMocks);

  it('round-anchor clock stripping an active Blinded logs exactly ONE removed row with anchor provenance', () => {
    seedStore({
      [`${TARGET}::activeConditions`]: ['blinded', 'poisoned'],
      'campaign::targetEffects': [],
    });

    clearExpirationEffects(RIDER_EFFECTS, TARGET, ATTACKER, CAMPAIGN, ROUND_ANCHOR_CLOCK);

    // Exactly one row for the WHOLE merged clock (the te leg adds no noise).
    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, {
      type: 'condition',
      action: 'removed',
      characterName: TARGET,
      condition: 'Blinded',
      reason: "Blinded ends (round-anchor clock expired at Shadow Rogue's turn start)",
      sourceName: ATTACKER,
      timestamp: expect.any(Number),
    });
    // State truth unchanged: the condition strip still lands.
    expect(setRuntimeValue).toHaveBeenCalledWith(TARGET, 'activeConditions', ['poisoned'], CAMPAIGN);
  });

  it('rounds-clock (finite expiryRounds) names the numeric clock in the reason', () => {
    seedStore({
      [`${TARGET}::activeConditions`]: ['blinded'],
      'campaign::targetEffects': [],
    });

    clearExpirationEffects(RIDER_EFFECTS, TARGET, ATTACKER, CAMPAIGN, ROUNDS_CLOCK(2));

    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(addEntry.mock.calls[0][1].reason).toBe('Blinded ends (2-round clock expired)');
  });

  it('round-anchor takes precedence when both seams are present', () => {
    seedStore({ [`${TARGET}::activeConditions`]: ['blinded'] });

    clearExpirationEffects([{ type: 'condition', condition: 'blinded' }], TARGET, ATTACKER, CAMPAIGN, {
      ...ROUNDS_CLOCK(3),
      expireOnCreatureName: ATTACKER,
    });

    expect(addEntry.mock.calls[0][1].reason).toContain('round-anchor clock expired');
  });

  it('clock without a resolvable seam (designed-immortal, no anchor) falls back to the CLA-096 duration copy', () => {
    seedStore({ [`${TARGET}::activeConditions`]: ['blinded'] });

    clearExpirationEffects([{ type: 'condition', condition: 'blinded' }], TARGET, ATTACKER, CAMPAIGN, {
      target: TARGET,
      effects: [{ type: 'condition', condition: 'blinded' }],
      appliedRound: 1,
      expiryRounds: Infinity,
      expireOnCreatureName: null,
    });

    expect(addEntry.mock.calls[0][1].reason).toBe('Blinded ends (duration has expired)');
  });

  it('legacy 4-arg caller (no clock entry) still logs with the duration-expiry copy', () => {
    seedStore({ [`${TARGET}::activeConditions`]: ['blinded'] });

    clearExpirationEffects([{ type: 'condition', condition: 'blinded' }], TARGET, ATTACKER, CAMPAIGN);

    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(addEntry.mock.calls[0][1].reason).toBe('Blinded ends (duration has expired)');
  });

  it('condition NOT actually present → silent no-op stays silent', () => {
    seedStore({ [`${TARGET}::activeConditions`]: ['poisoned'] });

    clearExpirationEffects(RIDER_EFFECTS, TARGET, ATTACKER, CAMPAIGN, ROUND_ANCHOR_CLOCK);

    expect(addEntry).not.toHaveBeenCalled();
  });

  it('empty/absent activeConditions → no row', () => {
    seedStore({});

    clearExpirationEffects(RIDER_EFFECTS, TARGET, ATTACKER, CAMPAIGN, ROUND_ANCHOR_CLOCK);

    expect(addEntry).not.toHaveBeenCalled();
  });

  it('te-only clock (no condition leg) produces zero log noise', () => {
    seedStore({
      [`${TARGET}::activeConditions`]: ['blinded'],
      'campaign::targetEffects': [{ effect: 'obscure', source: ATTACKER, target: TARGET, option: 'Obscure' }],
    });

    clearExpirationEffects([RIDER_EFFECTS[0]], TARGET, ATTACKER, CAMPAIGN, ROUND_ANCHOR_CLOCK);

    expect(addEntry).not.toHaveBeenCalled();
  });

  it('buff-only clock (no condition leg) produces zero log noise', () => {
    seedStore({
      [`${TARGET}::activeConditions`]: ['blinded'],
      [`${TARGET}::activeBuffs`]: [{ name: 'Some Buff', effect: 'some_buff' }],
    });

    clearExpirationEffects([{ type: 'remove_active_buff', buffName: 'Some Buff' }], TARGET, ATTACKER, CAMPAIGN, ROUNDS_CLOCK(2));

    expect(addEntry).not.toHaveBeenCalled();
  });

  it('same condition twice in one clock logs exactly ONE row — the second leg no-ops on the live store', () => {
    seedStore({ [`${TARGET}::activeConditions`]: ['blinded'] });

    clearExpirationEffects(
      [{ type: 'condition', condition: 'blinded' }, { type: 'condition', condition: 'blinded' }],
      TARGET, ATTACKER, CAMPAIGN, ROUNDS_CLOCK(2),
    );

    expect(addEntry).toHaveBeenCalledTimes(1);
  });

  // Save-margin rider (bug save-margin-rider-clock-ignores-authored-duration,
  // owner ruling 2026-11-10): the Thri-Kreen-shaped grant writes ONE merged
  // clock whose rounds derive from the AUTHORED "1 minute" duration
  // (minutes×10 = 10). At expiry that single clock must evict BOTH the base
  // and the rider condition — one removed row per leg, store left clean.
  it('save-margin twin-condition clock at the authored rounds:10 evicts BOTH conditions', () => {
    seedStore({ [`${TARGET}::activeConditions`]: ['poisoned', 'paralyzed'] });

    clearExpirationEffects(
      [{ type: 'condition', condition: 'poisoned' }, { type: 'condition', condition: 'paralyzed' }],
      TARGET, 'Thri-Kreen 1', CAMPAIGN,
      { target: TARGET, effects: [{ type: 'condition', condition: 'poisoned' }, { type: 'condition', condition: 'paralyzed' }], appliedRound: 1, expiryRounds: 10, expireOnCreatureName: null },
    );

    expect(addEntry).toHaveBeenCalledTimes(2);
    expect(addEntry.mock.calls.map(c => c[1].condition)).toEqual(['Poisoned', 'Paralyzed']);
    expect(addEntry.mock.calls.map(c => c[1].reason)).toEqual([
      'Poisoned ends (10-round clock expired)',
      'Paralyzed ends (10-round clock expired)',
    ]);
    expect(setRuntimeValue).toHaveBeenLastCalledWith(TARGET, 'activeConditions', [], CAMPAIGN);
  });

  it('condition stored with different casing still counts as active and is reported once', () => {
    seedStore({ [`${TARGET}::activeConditions`]: ['Blinded'] });

    clearExpirationEffects([{ type: 'condition', condition: 'blinded' }], TARGET, ATTACKER, CAMPAIGN, ROUNDS_CLOCK(2));

    expect(addEntry).toHaveBeenCalledTimes(1);
  });

  it.each([
    { type: 'charmed', label: 'Charmed' },
    { type: 'dominated', label: 'Charmed' },
    { type: 'speed_zero', label: 'Speed_zero' },
  ])("factory type '$type' logs one $label removed row (same provenance copy)", ({ type, label }) => {
    const conditionKey = type === 'speed_zero' ? 'speed_zero' : 'charmed';
    seedStore({ [`${TARGET}::activeConditions`]: [conditionKey, 'poisoned'] });

    clearExpirationEffects([{ type }], TARGET, ATTACKER, CAMPAIGN, ROUNDS_CLOCK(2));

    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
      type: 'condition',
      action: 'removed',
      characterName: TARGET,
      condition: label,
      reason: `${label} ends (2-round clock expired)`,
      sourceName: ATTACKER,
    }));
  });

  it('a rejected log write is swallowed loudly and never breaks the clear pass', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    addEntry.mockRejectedValueOnce(new Error('network down'));
    seedStore({ [`${TARGET}::activeConditions`]: ['blinded'] });

    expect(() => clearExpirationEffects(
      [{ type: 'condition', condition: 'blinded' }], TARGET, ATTACKER, CAMPAIGN, ROUNDS_CLOCK(2),
    )).not.toThrow();

    // Give the rejection microtask a tick to reach the .catch.
    return Promise.resolve().then(() => {
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });
});
