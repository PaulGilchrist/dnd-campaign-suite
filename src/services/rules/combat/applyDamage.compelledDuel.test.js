// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { applyDamageToTarget } from './applyDamage.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  getStore: vi.fn(() => ({ keys: () => [] })),
}));

vi.mock('../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
  rollExpression: vi.fn(),
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

vi.mock('../../automation/handlers/spells/tashasLaughterHandler.js', () => ({
  processTashasLaughterRepeatSave: vi.fn(),
  handle: vi.fn(),
}));

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

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// ── Globals ─────────────────────────────────────────────────────

global.fetch = vi.fn(() => new Promise(() => {}));

// ── Helpers ─────────────────────────────────────────────────────

function makeCombatSummary(creatures) {
  return { round: 1, creatures };
}

function createNpcCreature(name, extra = {}) {
  return {
    name,
    type: 'monster',
    maxHp: 30,
    currentHp: 30,
    resistances: [],
    immunities: [],
    conditions: [],
    template: [],
    concentration: null,
    saveBonuses: {},
    ...extra,
  };
}

function stubNpcRuntime(targetEffects) {
  getRuntimeValue.mockImplementation((_charName, key, _campaignName) => {
    if (key === 'lastAttack') return null;
    if (key === 'activeBuffs') return [];
    if (key === 'arcaneWardActive') return false;
    if (key === 'arcaneWardHp') return 0;
    if (key === 'lastMetamagicDamage') return undefined;
    if (key === 'currentHitPoints') return 30;
    if (key === 'activeConditions') return [];
    if (key === 'holyAuraSaveDc') return undefined;
    if (key === 'stealthAttackCost') return undefined;
    if (key === 'targetEffects') return targetEffects;
    if (key === 'tempHp') return 0;
    if (key === 'resistanceUsedThisTurn') return undefined;
    return undefined;
  });
}

// ── Tests ───────────────────────────────────────────────────────

describe('Compelled Duel — damage expiry in applyDamageToTarget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch.mockReset();
  });

  it('ends the duel when the target takes damage from a creature other than the caster', async () => {
    const duelEffect = { target: 'Goblin', effect: 'compelled_duel', source: 'Paladin', duration: 'concentration' };
    stubNpcRuntime([duelEffect]);

    const goblin = createNpcCreature('Goblin');
    const cs = makeCombatSummary([goblin]);

    const result = await applyDamageToTarget(cs, 'Goblin', 10, ['Slashing'], 'TestCampaign', [], { ignoreResistance: false, attackerName: 'Orc' });

    expect(result.finalDamage).toBe(10);
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'campaign',
      'targetEffects',
      [],
      'TestCampaign',
      true
    );
    expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
      type: 'condition',
      action: 'removed',
      characterName: 'Goblin',
      condition: 'Compelled Duel',
      note: expect.stringContaining('Orc damaged Goblin'),
    }));
  });

  it('does not end the duel when the caster deals the damage', async () => {
    const duelEffect = { target: 'Goblin', effect: 'compelled_duel', source: 'Paladin', duration: 'concentration' };
    stubNpcRuntime([duelEffect]);

    const goblin = createNpcCreature('Goblin');
    const cs = makeCombatSummary([goblin]);

    await applyDamageToTarget(cs, 'Goblin', 10, ['Slashing'], 'TestCampaign', [], { ignoreResistance: false, attackerName: 'Paladin' });

    expect(setRuntimeValue).not.toHaveBeenCalledWith(
      'campaign',
      'targetEffects',
      [],
      'TestCampaign',
      true
    );
    expect(addEntry).not.toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
      type: 'condition',
      action: 'removed',
      condition: 'Compelled Duel',
    }));
  });

  it('does nothing when there is no compelled_duel effect on the target', async () => {
    stubNpcRuntime([]);

    const goblin = createNpcCreature('Goblin');
    const cs = makeCombatSummary([goblin]);

    await applyDamageToTarget(cs, 'Goblin', 10, ['Slashing'], 'TestCampaign', [], { ignoreResistance: false, attackerName: 'Orc' });

    expect(setRuntimeValue).not.toHaveBeenCalledWith(
      'campaign',
      'targetEffects',
      [],
      'TestCampaign',
      true
    );
  });

  it('does nothing when there is no attacker', async () => {
    const duelEffect = { target: 'Goblin', effect: 'compelled_duel', source: 'Paladin', duration: 'concentration' };
    stubNpcRuntime([duelEffect]);

    const goblin = createNpcCreature('Goblin');
    const cs = makeCombatSummary([goblin]);

    await applyDamageToTarget(cs, 'Goblin', 10, ['Slashing'], 'TestCampaign', []);

    expect(setRuntimeValue).not.toHaveBeenCalledWith(
      'campaign',
      'targetEffects',
      [],
      'TestCampaign',
      true
    );
  });
});
