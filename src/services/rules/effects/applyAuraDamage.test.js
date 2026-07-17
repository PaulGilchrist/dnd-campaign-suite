// @improved-by-ai
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

vi.mock('../../ui/storage.js', () => ({
  default: {
    set: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(() => 5),
  getActiveCreatureName: vi.fn(() => 'TestCharacter'),
  getCombatSummary: vi.fn(),
  loadCombatSummary: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../rules/combat/rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(),
}));

vi.mock('../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../automation/handlers/spells/slowHandler.js', () => ({
  processSlowRepeatSave: vi.fn().mockResolvedValue(undefined),
  handle: vi.fn(),
}));

vi.mock('../../automation/handlers/spells/tashasLaughterHandler.js', () => ({
  processTashasLaughterRepeatSave: vi.fn().mockResolvedValue(undefined),
  handle: vi.fn(),
}));

vi.mock('../../combat/automation/automationExpressions.js', () => ({
  evaluateAutoExpression: vi.fn(() => 5),
}));

vi.mock('../../rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(),
}));

import { applyAuraDamage } from './expirations.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary, loadCombatSummary } from '../../encounters/combatData.js';
import { isWithinRange } from '../../rules/combat/rangeCheck.js';
import utils from '../../ui/utils.js';
import { applyDamageToTarget } from '../../rules/combat/applyDamage.js';

function resetMocks() {
  vi.clearAllMocks();
  localStorage.clear();
  window.dispatchEvent = vi.fn();
}

// ---------------------------------------------------------------------------
// applyAuraDamage — damage application
// ---------------------------------------------------------------------------
describe('applyAuraDamage — damage application', () => {
  beforeEach(() => {
    resetMocks();
    getRuntimeValue.mockImplementation((_name, _prop, _campaign) => null);
    utils.getName.mockImplementation((v) => String(v));
    applyDamageToTarget.mockReturnValue(undefined);
  });

  it('applies damage to creatures in range', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (prop === 'innerRadianceActive') return true;
      return null;
    });
    getCombatSummary.mockReturnValue({
      creatures: [
        { name: 'Orc', hit_points: { current: 15 } },
        { name: 'Goblin', hit_points: { current: 7 } },
      ],
    });
    isWithinRange.mockResolvedValue(true);

    await applyAuraDamage('Test', {}, 'Campaign', [], {
      activeKey: 'innerRadianceActive',
      damageValue: 5,
      range: 10,
      damageType: 'Radiant',
    });

    expect(applyDamageToTarget).toHaveBeenCalledWith(
      expect.any(Object),
      'Orc',
      5,
      ['Radiant'],
      'Campaign',
      [],
      false,
      'Test',
    );
  });

  it('skips self when creature name matches activeName', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (prop === 'innerRadianceActive') return true;
      return null;
    });
    getCombatSummary.mockReturnValue({
      creatures: [
        { name: 'Test' },
        { name: 'Orc' },
      ],
    });
    isWithinRange.mockResolvedValue(true);

    await applyAuraDamage('Test', {}, 'Campaign', [], {
      activeKey: 'innerRadianceActive',
      damageValue: 5,
      range: 10,
      damageType: 'Radiant',
    });

    expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
    expect(applyDamageToTarget.mock.calls[0][1]).toBe('Orc');
  });

  it('includes creatures with null distance when map is active', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (prop === 'innerRadianceActive') return true;
      if (name === '__map__' && prop === 'activeMapName') return 'TestMap';
      return null;
    });
    getCombatSummary.mockReturnValue({
      players: [{ name: 'Test', gridX: 1, gridY: 1 }],
      creatures: [
        { name: 'Orc', gridX: 1, gridY: 1 },
        { name: 'Goblin', gridX: 10, gridY: 10 },
      ],
    });
    isWithinRange.mockResolvedValue(true);

    await applyAuraDamage('Test', {}, 'Campaign', [], {
      activeKey: 'innerRadianceActive',
      damageValue: 5,
      range: 10,
      damageType: 'Radiant',
    });

    expect(applyDamageToTarget).toHaveBeenCalledTimes(2);
    const targetNames = applyDamageToTarget.mock.calls.map(c => c[1]);
    expect(targetNames).toContain('Orc');
    expect(targetNames).toContain('Goblin');
  });

  it('applies targetFilter to exclude creatures', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (prop === 'holyNimbusActive') return true;
      return null;
    });
    getCombatSummary.mockReturnValue({
      creatures: [
        { name: 'Demon', type: 'fiend', hit_points: { current: 20 } },
        { name: 'Slime', type: 'ooze', hit_points: { current: 5 } },
      ],
    });
    isWithinRange.mockResolvedValue(true);

    await applyAuraDamage('Test', {}, 'Campaign', [], {
      activeKey: 'holyNimbusActive',
      damageValue: 5,
      range: 10,
      damageType: 'Radiant',
      targetFilter: (c) => c.type === 'fiend' || c.type === 'undead',
    });

    expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
    expect(applyDamageToTarget.mock.calls[0][1]).toBe('Demon');
  });

  it('applies damage when map exists but position info is incomplete', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (prop === 'innerRadianceActive') return true;
      if (prop === '__map__') return 'TestMap';
      return null;
    });
    getCombatSummary.mockReturnValue({
      players: [{ name: 'Test', gridX: 1, gridY: 1 }],
      creatures: [
        { name: 'Orc' },
      ],
    });

    await applyAuraDamage('Test', {}, 'Campaign', [], {
      activeKey: 'innerRadianceActive',
      damageValue: 5,
      range: 10,
      damageType: 'Radiant',
    });

    expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
  });

  it('uses loadCombatSummary when getCombatSummary returns null', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (prop === 'innerRadianceActive') return true;
      return null;
    });
    getCombatSummary.mockReturnValue(null);
    const loadedSummary = { creatures: [{ name: 'Orc', hit_points: { current: 15 } }] };
    loadCombatSummary.mockResolvedValue(loadedSummary);
    isWithinRange.mockResolvedValue(true);

    await applyAuraDamage('Test', {}, 'Campaign', [], {
      activeKey: 'innerRadianceActive',
      damageValue: 5,
      range: 10,
      damageType: 'Radiant',
    });

    expect(applyDamageToTarget).toHaveBeenCalled();
  });

  it('uses default damageType Radiant when not specified', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (prop === 'innerRadianceActive') return true;
      return null;
    });
    getCombatSummary.mockReturnValue({
      creatures: [{ name: 'Orc', hit_points: { current: 15 } }],
    });
    isWithinRange.mockResolvedValue(true);

    await applyAuraDamage('Test', {}, 'Campaign', [], {
      activeKey: 'innerRadianceActive',
      damageValue: 5,
      range: 10,
    });

    expect(applyDamageToTarget).toHaveBeenCalledWith(
      expect.any(Object),
      'Orc',
      5,
      ['Radiant'],
      'Campaign',
      [],
      false,
      'Test',
    );
  });
});
