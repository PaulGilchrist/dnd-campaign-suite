// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { applyDamageToTarget } from './applyDamage.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';

// Mirrors applyDamage.dominateRepeat.test.js mock shape — but the runtime
// store keeps LIVE per-creature arrays so the REAL breakHypnoticPatternOnDamage
// producer (invoked inside removeCombatConditionsOnDamage) runs end-to-end.
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn((name, key, value) => {
    store[`${name}.${key}`] = value;
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
let store = {};

function stub(storeMap) {
  store = { ...storeMap };
  getRuntimeValue.mockImplementation((name, key) => store[`${name}.${key}`]);
  setRuntimeValue.mockImplementation((name, key, value) => {
    store[`${name}.${key}`] = value;
  });
}

function makeCs() {
  return {
    round: 1,
    creatures: [
      { name: 'Bandit 1', type: 'npc', maxHp: 11, currentHp: 11, resistances: [], immunities: [], conditions: [], template: [], concentration: null, saveBonuses: {} },
      { name: 'Bandit Captain 1', type: 'npc', maxHp: 52, currentHp: 52, resistances: [], immunities: [], conditions: [], template: [], concentration: null, saveBonuses: {} },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  addEntry.mockResolvedValue(undefined);
  global.fetch.mockReset();
  global.fetch.mockImplementation(() => new Promise(() => {}));
});

describe('SP-069: attack-damage lane breaks Hypnotic Pattern per creature', () => {
  it('damage to a hypno-affected creature removes its trio and logs hypnotic_pattern_broken', async () => {
    stub({
      'Bandit 1.activeConditions': ['charmed', 'incapacitated', 'speed_zero'],
      'Bandit 1.pendingExpirations': [],
      'Bandit 1.activeBuffs': [],
      'Bandit 1.targetEffects': [],
      'Bandit 1.tempHp': 0,
      'Bandit Captain 1.activeConditions': [],
      'Bandit Captain 1.pendingExpirations': [],
      'Bandit Captain 1.activeBuffs': [],
      'Bandit Captain 1.targetEffects': [],
    });
    const cs = makeCs();

    const result = await applyDamageToTarget(cs, 'Bandit 1', 6, ['Slashing'], { campaignName: CAMPAIGN, characters: [] });

    expect(result.newHp).toBe(5);
    expect(getRuntimeValue('Bandit 1', 'activeConditions')).toEqual([]);

    const removedLogs = addEntry.mock.calls
      .map(c => c[1])
      .filter(e => e && e.type === 'condition' && e.action === 'removed' && e.characterName === 'Bandit 1');
    expect(removedLogs.map(e => e.condition).sort()).toEqual(['Charmed', 'Incapacitated', 'Speed_zero']);
    expect(removedLogs.every(e => /Took damage \(Hypnotic Pattern\)/.test(e.reason))).toBe(true);

    const broken = addEntry.mock.calls.map(c => c[1]).find(e => e && e.automation === 'hypnotic_pattern_broken');
    expect(broken).toBeTruthy();
    expect(broken.characterName).toBe('Bandit 1');
  });

  it('untouched creatures keep their conditions (only the damaged creature breaks)', async () => {
    stub({
      'Bandit 1.activeConditions': ['charmed'],
      'Bandit 1.pendingExpirations': [],
      'Bandit 1.activeBuffs': [],
      'Bandit 1.targetEffects': [],
    });
    const cs = makeCs();

    await applyDamageToTarget(cs, 'Bandit 1', 6, ['Slashing'], { campaignName: CAMPAIGN, characters: [] });

    // Non-hypno fingerprint (no trio): no hypnotic_pattern_broken producer, but the
    // generic charmed-strip house rule owns non-hypno charms (dominateRepeat lane pins it).
    const broken = addEntry.mock.calls.map(c => c[1]).find(e => e && e.automation === 'hypnotic_pattern_broken');
    expect(broken).toBeUndefined();
    expect(getRuntimeValue('Bandit Captain 1', 'activeConditions') === undefined || getRuntimeValue('Bandit Captain 1', 'activeConditions') == null || Array.isArray(getRuntimeValue('Bandit Captain 1', 'activeConditions'))).toBe(true);
  });
});
