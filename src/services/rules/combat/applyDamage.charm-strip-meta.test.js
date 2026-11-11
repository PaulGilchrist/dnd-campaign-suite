// @maintained-by-ai
// LANE — applyDamage damage-triggered condition strip (removeCombatConditionsOnDamage,
// applyDamage.js) owns the activeConditionMeta hygiene leg: every stripped condition
// must purge its matching activeConditionMeta row in the SAME merged write
// (bug beguiling-song-own-damage-strips-its-charm, data-hygiene half). A removed
// condition leaving its meta row behind (orphan {dc, ability, source}) diverged from
// the canonical removeCondition hygiene (conditionSaveService.js:94-108) and the
// stripConditionsMerged merged-write idiom (clearExpirationEffects.js — §5 MA-0809
// same-endpoint law: two un-awaited per-key POSTs to the full-store replace route
// can reorder network-side and RESURRECT the purged row, so the strip must be ONE
// setRuntimeObject call whenever meta rows exist).
// Canon consulted (#967), NEVER re-driven here:
//   strip reason bytes / dominate routing → applyDamage.dominateRepeat.test.js T4
//   hypno trio ordering → applyDamage.hypnotic-break.test.js
//   grant-side meta stamping → saveProcessing (stampConditionMetaAndLogClauses)
// Store-faithful keyed runtime stub: every get/set is `${name}.${key}` and set
// WRITES, so post-call reads are store-truth.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { applyDamageToTarget } from './applyDamage.js';
import { setRuntimeValue, setRuntimeObject } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';

const { store } = vi.hoisted(() => ({ store: {} }));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((name, key) => store[`${name}.${key}`]),
  setRuntimeValue: vi.fn((name, key, value) => { store[`${name}.${key}`] = value; }),
  setRuntimeObject: vi.fn((name, obj) => {
    for (const [key, value] of Object.entries(obj)) store[`${name}.${key}`] = value;
  }),
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
const rstore = (name, key) => `${name}.${key}`;
const logEntries = () => addEntry.mock.calls.map((c) => c[1]).filter(Boolean);
const removalLogs = (name) => logEntries().filter((e) => e.type === 'condition' && e.action === 'removed' && e.characterName === name);
const conditionWrites = () => setRuntimeValue.mock.calls.filter((c) => c[1] === 'activeConditions');

function creature(name, type, hp) {
  return {
    name,
    type,
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

describe('damage strip purges activeConditionMeta (no orphan rows)', () => {
  it('PC charmed strip with a meta row lands ONE merged write: filtered list + purged meta, legacy single-key write NOT used', async () => {
    store[rstore('Wild_Sage_Druid', 'currentHitPoints')] = 200;
    store[rstore('Wild_Sage_Druid', 'activeConditions')] = ['cursed', 'poisoned', 'charmed'];
    store[rstore('Wild_Sage_Druid', 'activeConditionMeta')] = {
      charmed: { dc: 15, ability: 'wis', source: 'Performer Maestro' },
    };
    const cs = { round: 1, creatures: [creature('Wild_Sage_Druid', 'player', 200)] };

    await applyDamageToTarget(cs, 'Wild_Sage_Druid', 18, ['Psychic'], { campaignName: CAMPAIGN, characters: [], attackerName: 'Performer Maestro' });

    // Store-truth: charmed gone, siblings untouched, NO orphan charmed meta.
    expect(store[rstore('Wild_Sage_Druid', 'activeConditions')]).toEqual(['cursed', 'poisoned']);
    expect(store[rstore('Wild_Sage_Druid', 'activeConditionMeta')]).toEqual({});
    // ONE merged write carrying both keys (never two racing per-key writes).
    const merged = setRuntimeObject.mock.calls.filter((c) => c[0] === 'Wild_Sage_Druid');
    expect(merged).toHaveLength(1);
    expect(merged[0][1]).toEqual({
      activeConditions: ['cursed', 'poisoned'],
      activeConditionMeta: {},
    });
    expect(conditionWrites()).toHaveLength(0);
    expect(removalLogs('Wild_Sage_Druid').map((e) => [e.condition, e.reason])).toEqual([['Charmed', 'took damage (Friends)']]);
  });

  it('NPC frightened strip purges its meta row too, preserving a bystander condition meta', async () => {
    store[rstore('Bandit 1', 'activeConditions')] = ['frightened', 'poisoned'];
    store[rstore('Bandit 1', 'activeConditionMeta')] = {
      frightened: { dc: 12, ability: 'wis', source: 'Lamia' },
      poisoned: { dc: 13, ability: 'con', source: 'Wyvern' },
    };
    const cs = { round: 1, creatures: [creature('Bandit 1', 'npc', 11)] };

    await applyDamageToTarget(cs, 'Bandit 1', 6, ['Slashing'], { campaignName: CAMPAIGN, characters: [] });

    expect(store[rstore('Bandit 1', 'activeConditions')]).toEqual(['poisoned']);
    // Only the STRIPPED key's meta is purged — poisoned meta survives untouched.
    expect(store[rstore('Bandit 1', 'activeConditionMeta')]).toEqual({
      poisoned: { dc: 13, ability: 'con', source: 'Wyvern' },
    });
    expect(removalLogs('Bandit 1').map((e) => [e.condition, e.reason])).toEqual([['Frightened', 'took damage']]);
  });

  it('byte-inert legacy face: strip WITHOUT any meta rows keeps the single setRuntimeValue write and writes no meta', async () => {
    store[rstore('Bandit 1', 'activeConditions')] = ['charmed', 'speed_zero'];
    const cs = { round: 1, creatures: [creature('Bandit 1', 'npc', 11)] };

    await applyDamageToTarget(cs, 'Bandit 1', 6, ['Slashing'], { campaignName: CAMPAIGN, characters: [] });

    expect(store[rstore('Bandit 1', 'activeConditions')]).toEqual(['speed_zero']);
    expect(store[rstore('Bandit 1', 'activeConditionMeta')]).toBeUndefined();
    expect(setRuntimeObject.mock.calls.filter((c) => c[0] === 'Bandit 1')).toHaveLength(0);
    expect(conditionWrites()).toEqual([['Bandit 1', 'activeConditions', ['speed_zero'], CAMPAIGN]]);
  });

  it('zero-damage application strips nothing and leaves conds + meta byte-identical', async () => {
    store[rstore('Bandit 1', 'activeConditions')] = ['charmed'];
    store[rstore('Bandit 1', 'activeConditionMeta')] = { charmed: { dc: 15, ability: 'wis', source: 'Performer Maestro' } };
    const cs = { round: 1, creatures: [creature('Bandit 1', 'npc', 11)] };

    await applyDamageToTarget(cs, 'Bandit 1', 0, ['Psychic'], { campaignName: CAMPAIGN, characters: [] });

    expect(store[rstore('Bandit 1', 'activeConditions')]).toEqual(['charmed']);
    expect(store[rstore('Bandit 1', 'activeConditionMeta')]).toEqual({ charmed: { dc: 15, ability: 'wis', source: 'Performer Maestro' } });
    expect(removalLogs('Bandit 1')).toHaveLength(0);
  });
});
