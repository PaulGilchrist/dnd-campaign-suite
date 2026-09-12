// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
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
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
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
      damageExpression: '10d10',
      damageType: 'Necrotic',
      ...automation,
    },
  };
}

// ── Tests: applyShockwave() edge cases ─────────────────────────

describe('quiveringPalmHandler.applyShockwave — edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses default damageExpression when not provided', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ damageExpression: undefined, damageType: undefined });

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

    const result = await applyShockwave(action, ps, campaignName, 'Goblin');

    expect(result.payload.damageExpression).toBe('10d12');
    expect(result.payload.damageType).toBe('Force');
    expect(result.payload.rawDamage).toBe(55);
    expect(result.payload.finalDamage).toBe(55);
  });

  it('applies damage when combatSummary is present', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      damageExpression: '10d12',
      damageType: 'Force',
    });

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
    getRuntimeValue.mockReturnValue([{ name: 'TestMonk' }]);
    applyDamageToTarget.mockReturnValue({ finalDamage: 55 });

    const result = await applyShockwave(action, ps, campaignName, 'Goblin');

    expect(result.payload.rawDamage).toBe(55);
    expect(result.payload.finalDamage).toBe(55);
    expect(applyDamageToTarget).toHaveBeenCalledWith(expect.objectContaining({ creatures: expect.any(Array) }), 'Goblin', 55, ['Force'], campaignName, [{ name: 'TestMonk' }], { ignoreResistance: false, attackerName: 'TestMonk' });
  });

  it('handles null combatSummary (skips damage application)', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      damageExpression: '10d12',
      damageType: 'Force',
    });

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
    getCombatSummary.mockReturnValue(null);

    const result = await applyShockwave(action, ps, campaignName, 'Goblin');

    expect(result.payload.rawDamage).toBe(55);
    expect(result.payload.finalDamage).toBe(55);
    expect(applyDamageToTarget).not.toHaveBeenCalled();
  });

  it('handles applyDamageToTarget returning no finalDamage', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      damageExpression: '10d12',
      damageType: 'Force',
    });

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
    applyDamageToTarget.mockReturnValue({});

    const result = await applyShockwave(action, ps, campaignName, 'Goblin');

    expect(result.payload.finalDamage).toBe(55);
  });

  it('logs console.error when applyDamageToTarget adjusts damage', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      damageExpression: '10d12',
      damageType: 'Force',
    });

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
    getRuntimeValue.mockReturnValue([{ name: 'TestMonk' }]);
    applyDamageToTarget.mockReturnValue({ finalDamage: 27 });

    const consoleSpy = vi.spyOn(console, 'error');

    const result = await applyShockwave(action, ps, campaignName, 'Goblin');

    expect(consoleSpy).toHaveBeenCalledWith(
      '[quiveringPalm] Damage adjusted by resistances: 55 → 27'
    );
    expect(result.payload.finalDamage).toBe(55);

    consoleSpy.mockRestore();
  });

  it('handles rollExpression returning null (rawDamage=0)', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      damageExpression: '10d12',
      damageType: 'Force',
    });

    buildSaveDc.mockReturnValue(15);
    createSaveListener.mockReturnValue({
      promise: Promise.resolve({
        roll: 8,
        saveBonus: 2,
        total: 10,
        success: false,
      }),
    });
    rollExpression.mockReturnValue(null);
    applyDamageToTarget.mockReturnValue({ finalDamage: 0 });

    const result = await applyShockwave(action, ps, campaignName, 'Goblin');

    expect(result.payload.rawDamage).toBe(0);
    expect(result.payload.finalDamage).toBe(0);
  });

  it('handles saveResult with missing roll and saveBonus', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      damageExpression: '10d12',
      damageType: 'Force',
    });

    buildSaveDc.mockReturnValue(15);
    createSaveListener.mockReturnValue({
      promise: Promise.resolve({
        success: false,
      }),
    });
    rollExpression.mockReturnValue({ total: 55, rolls: [10, 10, 10, 10, 10, 5, 0, 0, 0, 0], modifier: 0 });
    applyDamageToTarget.mockReturnValue({ finalDamage: 55 });

    const result = await applyShockwave(action, ps, campaignName, 'Goblin');

    expect(result.payload.saveRoll).toBe(0);
    expect(result.payload.saveBonus).toBe(0);
  });

  it('handles saveResult with saveBonus=0', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      damageExpression: '10d12',
      damageType: 'Force',
    });

    buildSaveDc.mockReturnValue(15);
    createSaveListener.mockReturnValue({
      promise: Promise.resolve({
        roll: 8,
        saveBonus: 0,
        total: 8,
        success: false,
      }),
    });
    rollExpression.mockReturnValue({ total: 55, rolls: [10, 10, 10, 10, 10, 5, 0, 0, 0, 0], modifier: 0 });
    applyDamageToTarget.mockReturnValue({ finalDamage: 55 });

    const result = await applyShockwave(action, ps, campaignName, 'Goblin');

    expect(result.payload.saveBonus).toBe(0);
  });

  it('handles rollExpression with empty rolls array', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      damageExpression: '10d12',
      damageType: 'Force',
    });

    buildSaveDc.mockReturnValue(15);
    createSaveListener.mockReturnValue({
      promise: Promise.resolve({
        roll: 8,
        saveBonus: 2,
        total: 10,
        success: false,
      }),
    });
    rollExpression.mockReturnValue({ total: 55, rolls: [], modifier: 0 });
    applyDamageToTarget.mockReturnValue({ finalDamage: 55 });

    const result = await applyShockwave(action, ps, campaignName, 'Goblin');

    expect(result.payload.diceDisplay).toBe('');
    expect(result.payload.rawDamage).toBe(55);
  });

  it('handles saveResult with no roll property in return payload', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      damageExpression: '10d12',
      damageType: 'Force',
    });

    buildSaveDc.mockReturnValue(15);
    createSaveListener.mockReturnValue({
      promise: Promise.resolve({
        success: true,
      }),
    });
    rollExpression.mockReturnValue({ total: 50, rolls: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5], modifier: 0 });
    applyDamageToTarget.mockReturnValue({ finalDamage: 25 });

    const result = await applyShockwave(action, ps, campaignName, 'Goblin');

    expect(result.payload.saveRoll).toBe(0);
    expect(result.payload.saveBonus).toBe(0);
    expect(result.payload.finalDamage).toBe(25);
  });
});
