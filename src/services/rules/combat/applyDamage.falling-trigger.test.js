// @maintained-by-ai
// CLA-315 applyDamage consumer-seam lane: trigger passthrough onto campaign
// lastAttack — applyDamageToTarget(options.trigger) → stampLastAttack
// (applyDamage.js:937-942) → buildLastAttackUpdate explicit-null default
// (:197) + guarded overwrite (:213). Owns: fall hit stamps trigger:'falling';
// the next un-triggered hit writes explicit trigger:null so the
// existingAttack spread (:196) can never leak 'falling' into the next hit
// and fail-open every matchesTrigger consumer.
//
// Owners cited, NOT re-driven here:
// - Producer (trigger:'falling' origin): fallDamage.js:31-47 chain header +
//   apply args, ladder math → fallDamage.test.js:47-59, :61-84 exact bytes.
// - Reaction consumers pressing against the stamped lastAttack:
//   damageReductionHandler.js:81-86 (matchesTrigger) → slow-fall lane;
//   featherFallHandler.js:34 → featherFallHandler.test.js.
// - Entry guards (null summary / unusable rawDamage / missing target) →
//   applyDamage.test.js:157-163.
// - B/P/S + floor resistance math → applyDamage.helpers.test.js
//   (computeDamageAfterResistances, applyDamage.js:41-50) CANON.
//
// old→new map:
// - "stamps trigger on the fall damage lastAttack" → strengthened: producer
//   chain header seeded verbatim; exact full written bytes (rollType carried,
//   trigger stamped); fall damage actually lands (50 → 23 HP).
// - "clears a stale trigger:null on the next un-triggered hit" →
//   strengthened: JSON-backed keyed store instead of hand-fed stale stub —
//   hit 2 ORGANICALLY consumes hit 1's fall stamp from the store, making the
//   spread-leak falsifier real; exact bytes pin primary/secondary chain
//   plus a no-'falling'-anywhere assert.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { applyDamageToTarget } from './applyDamage.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

vi.mock('../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
  rollExpression: vi.fn(),
}));
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  getStore: vi.fn(() => ({ keys: () => [] })),
}));
vi.mock('../../ui/storage.js', () => ({ default: { get: vi.fn(), set: vi.fn() } }));
vi.mock('../../combat/conditions/savePromptService.js', () => ({
  sendDeathSavePrompt: vi.fn(),
  sendConcentrationPrompt: vi.fn(),
}));
vi.mock('../../combat/concentration/concentrationRules.js', () => ({
  rollConcentrationSave: vi.fn(),
}));
vi.mock('../../ui/utils.js', () => ({ default: { guid: vi.fn(() => 'test-guid-001') } }));
vi.mock('./rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(() => 30),
}));
vi.mock('../../rules/features/silenceService.js', () => ({
  isCreatureInSilenceZone: vi.fn(() => false),
}));
vi.mock('../../combat/automation/automationPassives.js', () => ({
  getDamageReduction: vi.fn(() => null),
  getDamageResistances: vi.fn(() => []),
}));

global.fetch = vi.fn(() => new Promise(() => {}));

// Store-faithful keyed runtime stub: JSON snapshots per target:key, so every
// captured lastAttack write is the point-in-time disk shape and reads between
// writes see the latest stamp (no hand-fed staleness).
let store;
let writes;

function seedStore() {
  store = new Map([
    ['Monk:currentHitPoints', 50],
    ['Monk:activeBuffs', []],
    ['Monk:activeConditions', []],
    ['Monk:tempHp', 0],
    ['Monk:arcaneWardActive', false],
    ['Monk:arcaneWardHp', 0],
  ]);
  writes = [];
}

getRuntimeValue.mockImplementation((target, key) => store.get(`${target}:${key}`));
setRuntimeValue.mockImplementation((target, key, value) => {
  // Separate clones: the journal entry stays an immutable point-in-time
  // snapshot even though source code mutates the value read back from the
  // store (recordActualDamageInLastAttack mutates existing, :506).
  writes.push({ target, key, value: JSON.parse(JSON.stringify(value ?? null)) });
  store.set(`${target}:${key}`, JSON.parse(JSON.stringify(value ?? null)));
  return Promise.resolve();
});

const cs = {
  round: 1,
  creatures: [{ name: 'Monk', type: 'player', maxHp: 50, currentHp: 50, resistances: [], immunities: [], conditions: [], template: [], concentration: null, saveBonuses: {} }],
};

const character = {
  name: 'Monk',
  computedStats: { resistances: [], immunities: [], class_levels: [], equipment: [], characterAdvancement: [], allFeatures: [], automation: { passives: [] } },
};

function lastAttackWrites() {
  return writes.filter(({ target, key }) => target === 'campaign' && key === 'lastAttack').map(w => w.value);
}

describe('applyDamageToTarget trigger passthrough (CLA-315)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch.mockReset();
    seedStore();
  });

  it('fall hit stamps trigger:falling onto lastAttack, carries producer chain header, lands the damage', async () => {
    // Producer chain header verbatim (fallDamage.js:31-40, pinned by fallDamage.test.js:65-68)
    store.set('campaign:lastAttack', {
      attackerName: 'Falling', targetName: 'Monk', rollType: 'fall', trigger: 'falling',
      rawDamage: 0, damageApplied: false, timestamp: 1000,
    });

    await applyDamageToTarget(cs, 'Monk', 27, ['bludgeoning'], { campaignName: 'test-campaign', characters: [character], attackerName: 'Falling', trigger: 'falling' });

    expect(lastAttackWrites()[0]).toEqual({
      attackerName: 'Falling', targetName: 'Monk', rollType: 'fall',
      trigger: 'falling',
      rawDamage: 27, primaryDamage: 27, primaryDamageType: 'bludgeoning',
      secondaryDamage: null, secondaryDamageType: null,
      damageTypes: ['bludgeoning'],
      weaponType: 'melee', isUnarmedStrike: false,
      damageApplied: true,
      timestamp: expect.any(Number),
    });
    // Impact damage flows the seam untouched (no resistances in fixture): 50 → 23,
    // and the standing record consumers read is fall-stamped + actualDamage-recorded.
    expect(store.get('Monk:currentHitPoints')).toBe(23);
    expect(store.get('campaign:lastAttack')).toMatchObject({ trigger: 'falling', rollType: 'fall', actualDamage: 27 });
  });

  it('next un-triggered hit writes explicit trigger:null — the fall stamp cannot spread-leak', async () => {
    // Hit 1: real fall through the seam, stamp lands in the keyed store...
    await applyDamageToTarget(cs, 'Monk', 27, ['bludgeoning'], { campaignName: 'test-campaign', characters: [character], attackerName: 'Falling', trigger: 'falling' });
    expect(store.get('campaign:lastAttack').trigger).toBe('falling');
    const writesAfterFall = writes.length;

    // Hit 2: un-triggered slash ORGANICALLY consumes the fall stamp as existingAttack
    await applyDamageToTarget(cs, 'Monk', 5, ['slashing'], { campaignName: 'test-campaign', characters: [character], attackerName: 'Orc' });

    const stamp = writes.slice(writesAfterFall).filter(({ target, key }) => target === 'campaign' && key === 'lastAttack')[0].value;
    expect(stamp).toEqual({
      attackerName: 'Orc', targetName: 'Monk',
      trigger: null,
      rawDamage: 5, primaryDamage: 27, primaryDamageType: 'bludgeoning',
      secondaryDamage: 5, secondaryDamageType: 'slashing',
      damageTypes: ['slashing'],
      weaponType: 'melee', isUnarmedStrike: false,
      damageApplied: true,
      actualDamage: 27, // carried via spread from the fall's standing record
      timestamp: expect.any(Number),
    });
    // Guard falsifier: 'falling' must be absent from the whole record, not just the key
    expect(JSON.stringify(stamp)).not.toContain('falling');
    // Both hits actually landed: 50 → 23 → 18; secondary accumulates actualDamage 27+5
    expect(store.get('Monk:currentHitPoints')).toBe(18);
    expect(store.get('campaign:lastAttack')).toMatchObject({ trigger: null, actualDamage: 32 });
  });
});
