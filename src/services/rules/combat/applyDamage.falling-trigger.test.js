// CLA-315: trigger:'falling' passthrough onto lastAttack via
// applyDamageToTarget(options.trigger), and explicit null on the next
// un-triggered hit (buildLastAttackUpdate spread leak closed).
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

function stubRuntime(currentHp) {
  getRuntimeValue.mockReset();
  getRuntimeValue.mockImplementation((charName, key) => {
    if (key === 'activeBuffs') return [];
    if (key === 'arcaneWardActive') return false;
    if (key === 'arcaneWardHp') return 0;
    if (key === 'lastMetamagicDamage') return undefined;
    if (key === 'currentHitPoints') return currentHp;
    if (key === 'activeConditions') return [];
    if (key === 'tempHp') return 0;
    return undefined;
  });
}

const character = {
  name: 'Monk',
  computedStats: { resistances: [], immunities: [], class_levels: [], equipment: [], characterAdvancement: [], allFeatures: [], automation: { passives: [] } },
};

function lastAttackWrites() {
  return setRuntimeValue.mock.calls
    .filter(([target, key]) => target === 'campaign' && key === 'lastAttack')
    .map(([, , value]) => value);
}

describe('applyDamageToTarget trigger passthrough (CLA-315)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch.mockReset();
  });

  it('stamps trigger on the fall damage lastAttack', async () => {
    const cs = { round: 1, creatures: [{ name: 'Monk', type: 'player', maxHp: 50, currentHp: 50, resistances: [], immunities: [], conditions: [], template: [], concentration: null, saveBonuses: {} }] };
    stubRuntime(50);
    await applyDamageToTarget(cs, 'Monk', 27, ['bludgeoning'], { campaignName: 'test-campaign', characters: [character], attackerName: 'Falling', trigger: 'falling' });
    const writes = lastAttackWrites();
    expect(writes.length).toBeGreaterThan(0);
    expect(writes[0]).toMatchObject({ targetName: 'Monk', attackerName: 'Falling', trigger: 'falling', rawDamage: 27 });
  });

  it('clears a stale trigger:null on the next un-triggered hit', async () => {
    const cs = { round: 2, creatures: [{ name: 'Monk', type: 'player', maxHp: 50, currentHp: 50, resistances: [], immunities: [], conditions: [], template: [], concentration: null, saveBonuses: {} }] };
    stubRuntime(50);
    // previous fall still stamped
    getRuntimeValue.mockImplementation((charName, key) => {
      if (key === 'lastAttack') return { trigger: 'falling', targetName: 'Monk', primaryDamage: 27, timestamp: 1 };
      if (key === 'activeBuffs') return [];
      if (key === 'currentHitPoints') return 50;
      if (key === 'activeConditions') return [];
      if (key === 'tempHp') return 0;
      return undefined;
    });
    await applyDamageToTarget(cs, 'Monk', 5, ['slashing'], { campaignName: 'test-campaign', characters: [character], attackerName: 'Orc' });
    const writes = lastAttackWrites();
    expect(writes.length).toBeGreaterThan(0);
    expect(writes[0].trigger).toBeNull();
  });
});
