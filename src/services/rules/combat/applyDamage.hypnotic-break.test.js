// @maintained-by-ai
// LANE — SP-069 applyDamage CONSUMER seam only: applyDamageToTarget must route
// real damage through the REAL breakHypnoticPatternOnDamage producer BEFORE the
// generic condition reads (applyDamage.js:546-557 "single owner per fact"), and
// the break must be PER-CREATURE (an untouched hypno victim keeps its trio).
// This lane owns the lane-level wiring + guard-silence falsifier (#1187):
//   T1 fire leg: trio cleared, hypno removal bytes, and ZERO generic
//      '(Charm)'/'(Friends)' strip logs on a hypno target (break-before-read).
//   T2 containment leg: second hypno creature in the same scene is untouched.
//   T3 refuse leg: near-miss fingerprint (charmed+speed_zero, Confusion-style)
//      stays silent on hypnotic_pattern_broken while the generic charm-strip
//      owner still strips charmed and preserves the non-hypno condition.
// Canon consulted (#967), NEVER re-driven here:
//   fingerprint guard / trio strip / unrelated-condition preservation
//     → hypnoticPatternService.test.js:281-333 (breakHypnoticPatternOnDamage)
//   generic charm-strip reason bytes
//     → applyDamage.dominateRepeat.test.js T4:343-364
//   resistance/save/evasion arithmetic → applyDamage.helpers.test.js:53-196
//   HP-UI wiring → createCreatureHandlers.sp069.test.js
// Store-faithful keyed runtime stub (#1057/#1186): every get/set is
// `${name}.${key}` and set WRITES, so post-call reads are store-truth.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { applyDamageToTarget } from './applyDamage.js';
import { addEntry } from '../../ui/logService.js';

const { store } = vi.hoisted(() => ({ store: {} }));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((name, key) => store[`${name}.${key}`]),
  setRuntimeValue: vi.fn((name, key, value) => { store[`${name}.${key}`] = value; }),
  getAllStoreKeys: vi.fn(() => []),
  getStore: vi.fn(() => ({ keys: () => [] })),
}));

vi.mock('../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(() => 10),
  rollExpression: vi.fn(),
}));

vi.mock('../../ui/storage.js', () => ({ default: { get: vi.fn(), set: vi.fn() } }));

vi.mock('../../combat/conditions/savePromptService.js', () => ({
  sendDeathSavePrompt: vi.fn(),
  sendConcentrationPrompt: vi.fn(),
  sendSavePrompt: vi.fn(),
}));

vi.mock('../../combat/concentration/concentrationRules.js', () => ({
  rollConcentrationSave: vi.fn(),
}));

vi.mock('../../ui/utils.js', () => ({ default: { guid: vi.fn(() => 'test-guid-001'), getName: vi.fn((n) => String(n).toLowerCase()) } }));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

global.fetch = vi.fn(() => new Promise(() => {}));

const CAMPAIGN = 'TestCampaign';
const HYPNO_TRIO = ['charmed', 'incapacitated', 'speed_zero'];

const rstore = (name, key) => `${name}.${key}`;
const logEntries = () => addEntry.mock.calls.map((c) => c[1]).filter(Boolean);
const brokenLogs = () => logEntries().filter((e) => e.automation === 'hypnotic_pattern_broken');
const hypnoRemovals = (name) => logEntries().filter(
  (e) => e.type === 'condition' && e.action === 'removed' && e.characterName === name
    && /Took damage \(Hypnotic Pattern\)/.test(e.reason)
);
const genericCharmStrips = () => logEntries().filter(
  (e) => e.type === 'condition' && e.action === 'removed' && e.condition === 'Charmed'
    && /took damage \((Charm|Friends)\)/.test(e.reason)
);

function npc(name, hp) {
  return {
    name,
    type: 'npc',
    maxHp: hp,
    currentHp: hp,
    resistances: [],
    immunities: [],
    conditions: [],
    template: [],
    concentration: null,
    saveBonuses: {},
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(store).forEach((k) => delete store[k]);
});

describe('SP-069: applyDamage lane breaks Hypnotic Pattern per creature', () => {
  it('damage through the lane strips the hypno trio before the generic read — hypno logs only, single owner', async () => {
    store[rstore('Bandit 1', 'activeConditions')] = [...HYPNO_TRIO, 'prone'];
    const cs = { round: 1, creatures: [npc('Bandit 1', 11), npc('Bandit Captain 1', 52)] };

    const result = await applyDamageToTarget(cs, 'Bandit 1', 6, ['Slashing'], { campaignName: CAMPAIGN, characters: [] });

    expect(result.newHp).toBe(5);
    // Trio stripped by the producer, non-hypno condition preserved; store-truth write.
    expect(store[rstore('Bandit 1', 'activeConditions')]).toEqual(['prone']);
    expect(hypnoRemovals('Bandit 1').map((e) => e.condition).sort()).toEqual(['Charmed', 'Incapacitated', 'Speed_zero']);
    // Break ran BEFORE the generic reads (:546-552), so the generic charm-strip is a no-op.
    expect(genericCharmStrips()).toEqual([]);
    expect(brokenLogs()).toHaveLength(1);
    expect(brokenLogs()[0].characterName).toBe('Bandit 1');
  });

  it('break is per-creature: an untouched hypno victim keeps its trio and generates no logs', async () => {
    store[rstore('Bandit 1', 'activeConditions')] = [...HYPNO_TRIO];
    store[rstore('Bandit Captain 1', 'activeConditions')] = [...HYPNO_TRIO];
    const cs = { round: 1, creatures: [npc('Bandit 1', 11), npc('Bandit Captain 1', 52)] };

    const result = await applyDamageToTarget(cs, 'Bandit 1', 6, ['Slashing'], { campaignName: CAMPAIGN, characters: [] });

    expect(result.newHp).toBe(5);
    expect(store[rstore('Bandit 1', 'activeConditions')]).toEqual([]);
    expect(brokenLogs()).toHaveLength(1);
    // The other spell victim is untouched — trio intact, zero logs of its own.
    expect(store[rstore('Bandit Captain 1', 'activeConditions')]).toEqual([...HYPNO_TRIO]);
    expect(brokenLogs().some((e) => e.characterName === 'Bandit Captain 1')).toBe(false);
    expect(logEntries().some((e) => e.characterName === 'Bandit Captain 1')).toBe(false);
  });

  it('near-miss fingerprint (charmed+speed_zero) stays silent on hypnotic_pattern_broken — generic charm-strip owner still fires', async () => {
    store[rstore('Bandit 1', 'activeConditions')] = ['charmed', 'speed_zero'];
    const cs = { round: 1, creatures: [npc('Bandit 1', 11)] };

    await applyDamageToTarget(cs, 'Bandit 1', 6, ['Slashing'], { campaignName: CAMPAIGN, characters: [] });

    // Guard stays silent: no hypno producer output...
    expect(brokenLogs()).toHaveLength(0);
    expect(hypnoRemovals('Bandit 1')).toHaveLength(0);
    // ...and does not half-fire — charmed is still owned (and stripped) by the
    // generic house rule, the non-hypno speed_zero survives.
    expect(store[rstore('Bandit 1', 'activeConditions')]).toEqual(['speed_zero']);
    expect(genericCharmStrips().map((e) => e.reason)).toEqual(['took damage (Charm)']);
  });
});
