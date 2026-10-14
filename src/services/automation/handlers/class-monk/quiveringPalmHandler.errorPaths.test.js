import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

vi.mock('../../../automation/common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { applyShockwave } from './quiveringPalmHandler.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { buildSaveDc, createSaveListener } from '../../../automation/common/savePrompt.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'test-campaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestMonk',
    level: 17,
    proficiencyBonus: 6,
    abilities: [
      { name: 'Strength', bonus: 2 },
      { name: 'Wisdom', bonus: 3 },
      { name: 'Dexterity', bonus: 2 },
    ],
    class: {
      class_levels: [{ level: 17, focus_points: 4 }],
    },
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Quivering Palm',
    automation: {
      type: 'quivering_palm',
      casting_time: 'passive',
      cost: { amount: 3, resource: 'kiPoints' },
      trigger: 'action',
      damageExpression: '10d12',
      damageType: 'Force',
      ...automation,
    },
  };
}

// ── Tests: applyShockwave() — addEntry rejection error paths ───

describe('quiveringPalmHandler.applyShockwave — addEntry rejection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles first addEntry rejection (save-damage log) without throwing', async () => {
    const ps = makePlayerStats();
    const action = makeAction();

    const firstAddEntryReject = Promise.reject(new Error('log error 1'));
    addEntry.mockReturnValueOnce(firstAddEntryReject);
    addEntry.mockReturnValue(Promise.resolve());

    buildSaveDc.mockReturnValue(15);
    createSaveListener.mockReturnValue({
      promise: Promise.resolve({
        roll: 8,
        saveBonus: 2,
        total: 10,
        success: false,
      }),
    });
    rollExpression.mockReturnValue({ total: 55, rolls: [10, 10, 10, 10, 10, 5, 0, 0, 0, 0], modifier: 0 });
    applyDamageToTarget.mockReturnValue({ finalDamage: 55 });

    const consoleSpy = vi.spyOn(console, 'error');

    const result = await applyShockwave(action, ps, campaignName, 'Goblin');

    expect(consoleSpy).toHaveBeenCalledWith('[quiveringPalm] Error:', expect.any(Error));
    expect(result.type).toBe('popup');
    expect(result.payload.finalDamage).toBe(55);

    consoleSpy.mockRestore();
  });

  it('handles second addEntry rejection (final roll log) without throwing', async () => {
    const ps = makePlayerStats();
    const action = makeAction();

    addEntry.mockReturnValue(Promise.resolve());
    addEntry.mockReturnValueOnce(Promise.resolve());
    // The second call (the final roll log at line 238) will reject
    const secondAddEntryReject = Promise.reject(new Error('log error 2'));
    addEntry.mockReturnValueOnce(secondAddEntryReject);

    buildSaveDc.mockReturnValue(15);
    createSaveListener.mockReturnValue({
      promise: Promise.resolve({
        roll: 8,
        saveBonus: 2,
        total: 10,
        success: false,
      }),
    });
    rollExpression.mockReturnValue({ total: 55, rolls: [10, 10, 10, 10, 10, 5, 0, 0, 0, 0], modifier: 0 });
    applyDamageToTarget.mockReturnValue({ finalDamage: 55 });

    const consoleSpy = vi.spyOn(console, 'error');

    const result = await applyShockwave(action, ps, campaignName, 'Goblin');

    expect(consoleSpy).toHaveBeenCalledWith('[quiveringPalm] Error:', expect.any(Error));
    expect(result.type).toBe('popup');
    expect(result.payload.finalDamage).toBe(55);

    consoleSpy.mockRestore();
  });
});

// ── Tests: applyShockwave() — ?? fallback branch ───────────────

describe('quiveringPalmHandler.applyShockwave — ?? fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses finalDamage from ?? fallback when applyDamageToTarget returns no finalDamage', async () => {
    const ps = makePlayerStats();
    const action = makeAction();

    buildSaveDc.mockReturnValue(15);
    createSaveListener.mockReturnValue({
      promise: Promise.resolve({
        roll: 8,
        saveBonus: 2,
        total: 10,
        success: false,
      }),
    });
    rollExpression.mockReturnValue({ total: 55, rolls: [10, 10, 10, 10, 10, 5, 0, 0, 0, 0], modifier: 0 });
    getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
    applyDamageToTarget.mockReturnValue({});

    const result = await applyShockwave(action, ps, campaignName, 'Goblin');

    expect(result.payload.finalDamage).toBe(55);
    expect(applyDamageToTarget).toHaveBeenCalled();
  });
});
