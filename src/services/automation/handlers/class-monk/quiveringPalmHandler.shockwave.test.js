// @maintained-by-ai
// Deterministic edge-case contract for applyShockwave(): damage defaults
// ('10d12'/'Force'), exact applyDamageToTarget call args + diceDisplay pin,
// cs-null damage-skip guard (unique here — nullContext.test.js owns the
// getCombatContext arm in handle()), resistance-adjust console.error,
// rollExpression-null rawDamage 0, saveResult ?? payload fallbacks, and the
// zero-saveBonus saveFormula ('1d20', no '+0') pin. Cluster seam map:
// addEntry rejection catches and the canonical ?? no-finalDamage detector →
// errorPaths.test.js; real DC resolution → saveDc.test.js; handle()/refusal
// lanes → handle.test.js, nullContext.test.js, catchCoverage.test.js,
// successCatch.test.js; happy popup + half-damage-on-save → .test.js.
// A full mock baseline is set in beforeEach — tests never rely on mock
// leakage from a preceding test (clearAllMocks preserves implementations).
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
import { addEntry } from '../../../ui/logService.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { buildSaveDc, createSaveListener } from '../../../automation/common/savePrompt.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'test-campaign';

const DEFAULT_ROLL = { total: 55, rolls: [10, 10, 10, 10, 10, 5, 0, 0, 0, 0], modifier: 0 };

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

function makeSaveListener(result) {
  return { promise: Promise.resolve(result) };
}

// ── Tests: applyShockwave() edge cases ─────────────────────────

describe('quiveringPalmHandler.applyShockwave — edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Full baseline: every test runs against a complete, explicit mock set
    // and overrides only the seam it targets — no order-dependent leakage.
    buildSaveDc.mockReturnValue(15);
    createSaveListener.mockReturnValue(makeSaveListener({ roll: 8, saveBonus: 2, total: 10, success: false }));
    rollExpression.mockReturnValue(DEFAULT_ROLL);
    getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
    getRuntimeValue.mockReturnValue([{ name: 'TestMonk' }]);
    applyDamageToTarget.mockReturnValue({ finalDamage: 55 });
  });

  it('uses default damageExpression and damageType when automation omits them', async () => {
    const action = makeAction({ damageExpression: undefined, damageType: undefined });

    const result = await applyShockwave(action, makePlayerStats(), campaignName, 'Goblin');

    // The default must actually reach the roller and the damage call.
    expect(rollExpression).toHaveBeenCalledWith('10d12');
    expect(applyDamageToTarget).toHaveBeenCalledWith(
      expect.anything(), 'Goblin', 55, ['Force'],
      expect.objectContaining({ ignoreResistance: false, attackerName: 'TestMonk' })
    );
    expect(result.payload.damageExpression).toBe('10d12');
    expect(result.payload.damageType).toBe('Force');
    expect(result.payload.rawDamage).toBe(55);
    expect(result.payload.finalDamage).toBe(55);
  });

  it('applies full damage on failed save with exact applyDamageToTarget args', async () => {
    const action = makeAction({
      damageExpression: '10d12',
      damageType: 'Force',
    });

    const result = await applyShockwave(action, makePlayerStats(), campaignName, 'Goblin');

    expect(applyDamageToTarget).toHaveBeenCalledWith(expect.objectContaining({ creatures: expect.any(Array) }), 'Goblin', 55, ['Force'], { campaignName, characters: [{ name: 'TestMonk' }], ignoreResistance: false, attackerName: 'TestMonk' });
    expect(result.payload.rawDamage).toBe(55);
    expect(result.payload.finalDamage).toBe(55);
    expect(result.payload.diceDisplay).toBe(' (10, 10, 10, 10, 10, 5, 0, 0, 0, 0)');
  });

  it('handles null combatSummary (skips damage application)', async () => {
    const action = makeAction({
      damageExpression: '10d12',
      damageType: 'Force',
    });

    getCombatSummary.mockReturnValue(null);

    const result = await applyShockwave(action, makePlayerStats(), campaignName, 'Goblin');

    expect(result.payload.rawDamage).toBe(55);
    expect(result.payload.finalDamage).toBe(55);
    expect(applyDamageToTarget).not.toHaveBeenCalled();
  });

  it('logs console.error when applyDamageToTarget adjusts damage', async () => {
    const action = makeAction({
      damageExpression: '10d12',
      damageType: 'Force',
    });

    applyDamageToTarget.mockReturnValue({ finalDamage: 27 });

    const consoleSpy = vi.spyOn(console, 'error');

    const result = await applyShockwave(action, makePlayerStats(), campaignName, 'Goblin');

    expect(consoleSpy).toHaveBeenCalledWith(
      '[quiveringPalm] Damage adjusted by resistances: 55 → 27'
    );
    // Popup reports the handler-computed finalDamage; the discrepancy is
    // surfaced via console.error, not silently rewritten into the payload.
    expect(result.payload.finalDamage).toBe(55);

    consoleSpy.mockRestore();
  });

  it('handles rollExpression returning null (rawDamage=0)', async () => {
    const action = makeAction({
      damageExpression: '10d12',
      damageType: 'Force',
    });

    rollExpression.mockReturnValue(null);
    applyDamageToTarget.mockReturnValue({ finalDamage: 0 });

    const result = await applyShockwave(action, makePlayerStats(), campaignName, 'Goblin');

    expect(result.payload.rawDamage).toBe(0);
    expect(result.payload.finalDamage).toBe(0);
    expect(result.payload.diceDisplay).toBe('');
  });

  it('defaults missing roll and saveBonus to 0 via ?? fallback', async () => {
    const action = makeAction({
      damageExpression: '10d12',
      damageType: 'Force',
    });

    createSaveListener.mockReturnValue(makeSaveListener({ success: false }));

    const result = await applyShockwave(action, makePlayerStats(), campaignName, 'Goblin');

    expect(result.payload.saveRoll).toBe(0);
    expect(result.payload.saveBonus).toBe(0);
  });

  it('preserves an explicit zero saveBonus and omits +0 from the save formula', async () => {
    const action = makeAction({
      damageExpression: '10d12',
      damageType: 'Force',
    });

    createSaveListener.mockReturnValue(makeSaveListener({ roll: 8, saveBonus: 0, total: 8, success: false }));

    const result = await applyShockwave(action, makePlayerStats(), campaignName, 'Goblin');

    expect(result.payload.saveBonus).toBe(0);
    const resultLog = addEntry.mock.calls
      .map(c => c[1])
      .find(e => e.saveFormula !== undefined);
    expect(resultLog.saveFormula).toBe('1d20');
  });
});
