// @maintained-by-ai
// Deterministic error-path contract for applyShockwave(): both addEntry rejection
// catches ([quiveringPalm] Error: at handler L191/L212 — owned exclusively here)
// must log without throwing, and the `finalDamage ?? finalDamage` fallback in
// applyShockwaveDamage (handler L243) must prevent a spurious resistance-adjust
// error log. NB: shockwave.test.js's similarly-named fallback test is vacuous —
// getCombatSummary leaks `null` from the preceding test, so applyDamageToTarget
// is never called there and the ?? fallback is never taken.
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

function makeFailedSaveListener() {
  return {
    promise: Promise.resolve({
      roll: 8,
      saveBonus: 2,
      total: 10,
      success: false,
    }),
  };
}

// ── Tests: applyShockwave() — addEntry rejection error paths ───

describe('quiveringPalmHandler.applyShockwave — addEntry rejection', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    buildSaveDc.mockReturnValue(15);
    createSaveListener.mockReturnValue(makeFailedSaveListener());
    rollExpression.mockReturnValue({ total: 55, rolls: [10, 10, 10, 10, 10, 5, 0, 0, 0, 0], modifier: 0 });
    applyDamageToTarget.mockReturnValue({ finalDamage: 55 });
  });

  it('handles first addEntry rejection (save-damage log) without throwing', async () => {
    const ps = makePlayerStats();
    const action = makeAction();

    // applyShockwave logs twice: save-damage prompt then final result.
    // Reject the first; the second must still resolve.
    addEntry.mockReturnValueOnce(Promise.reject(new Error('log error 1')));
    addEntry.mockReturnValue(Promise.resolve());

    const consoleSpy = vi.spyOn(console, 'error');

    const result = await applyShockwave(action, ps, campaignName, 'Goblin');

    expect(consoleSpy).toHaveBeenCalledWith('[quiveringPalm] Error:', new Error('log error 1'));
    expect(result.type).toBe('popup');
    expect(result.payload.finalDamage).toBe(55);

    consoleSpy.mockRestore();
  });

  it('handles second addEntry rejection (final result log) without throwing', async () => {
    const ps = makePlayerStats();
    const action = makeAction();

    // First log (save-damage prompt) resolves; the second (final result log) rejects.
    addEntry.mockReturnValueOnce(Promise.resolve());
    addEntry.mockReturnValueOnce(Promise.reject(new Error('log error 2')));
    addEntry.mockReturnValue(Promise.resolve());

    const consoleSpy = vi.spyOn(console, 'error');

    const result = await applyShockwave(action, ps, campaignName, 'Goblin');

    expect(consoleSpy).toHaveBeenCalledWith('[quiveringPalm] Error:', new Error('log error 2'));
    expect(addEntry).toHaveBeenCalledTimes(2);
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
    createSaveListener.mockReturnValue(makeFailedSaveListener());
    rollExpression.mockReturnValue({ total: 55, rolls: [10, 10, 10, 10, 10, 5, 0, 0, 0, 0], modifier: 0 });
    // getCombatSummary must return a summary so applyShockwaveDamage actually calls
    // applyDamageToTarget — otherwise the ?? fallback is never reached.
    getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
    applyDamageToTarget.mockReturnValue({});

    const consoleSpy = vi.spyOn(console, 'error');

    const result = await applyShockwave(action, ps, campaignName, 'Goblin');

    expect(applyDamageToTarget).toHaveBeenCalled();
    // The ?? fallback keeps actualDamage === finalDamage, so no false
    // "resistance adjustment" error is logged (without the fallback this
    // would log "Damage adjusted by resistances: 55 → undefined").
    expect(consoleSpy).not.toHaveBeenCalled();
    expect(result.payload.finalDamage).toBe(55);

    consoleSpy.mockRestore();
  });
});
