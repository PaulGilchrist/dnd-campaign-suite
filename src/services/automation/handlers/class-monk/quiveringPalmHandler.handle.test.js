// @maintained-by-ai
// handle() edge-case lane for quiveringPalmHandler: resource/cost RESOLUTION defaults —
// `auto.cost?.amount || 3`, `auto.cost?.resource || 'kiPoints'`, `?? maxResource` fallback,
// resourceLabel ternary, and monkFocusPointMax's optional-chain crash guard.
// Seam map for the cluster: happy path + lastAttack-precondition refusals + modal path →
// quiveringPalmHandler.test.js; null-combat-context route to the '!targetName' refusal →
// nullContext.test.js; addEntry rejection-injection catches → catchCoverage.test.js.
// This file owns the no-target refusal (live context, no selected target) and every
// insufficient-resource refusal variant (label + zero-max), each pinned full-string with
// no-side-effect guards so refusals are proven inert (no ki spent, no vibrations set).
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

import { handle } from './quiveringPalmHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'test-campaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestMonk',
    level: 17,
    proficiencyBonus: 6,
    proficiency: 6,
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

// Successful-preconditions router: no vibrations active, valid last Unarmed Strike hit.
// Any resource key not listed returns undefined so ?? maxResource fallbacks engage.
function okRuntime({ resource, value } = {}) {
  return (_a, b, _c) => {
    if (_a === 'campaign' && b === 'quivering_palm') return null;
    if (_a === 'campaign' && b === 'lastAttack') return {
      attackerName: 'TestMonk',
      attackName: 'Unarmed Strike',
      saveResult: 'success',
    };
    if (resource && b === resource) return value;
    return undefined;
  };
}

// ── Tests: handle() — refusals ─────────────────────────────────

describe('quiveringPalmHandler.handle — refusals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('refuses with no-side-effects popup when target is deselected (live combat context)', async () => {
    const ps = makePlayerStats();
    const action = makeAction();

    getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Goblin', type: 'monster' }],
    });
    getTargetFromAttacker.mockReturnValue(null);
    getRuntimeValue.mockImplementation(okRuntime({ resource: 'kiPoints', value: 5 }));

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.description).toBe('Quivering Palm — No target selected.');
    // Refusal must be inert: no ki deducted, no vibrations set.
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('refuses with Focus Points label when focusPoints resource is short', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ cost: { amount: 3, resource: 'focusPoints' } });

    getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Goblin', type: 'monster' }],
    });
    getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
    getRuntimeValue.mockImplementation(okRuntime({ resource: 'focusPoints', value: 1 }));

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('Not enough Focus Points. 1/3 required.');
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('refuses when class_levels is missing — monkFocusPointMax fallback is 0', async () => {
    const ps = makePlayerStats({ class: {} });
    const action = makeAction({ cost: { amount: 1 } });

    getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Goblin', type: 'monster' }],
    });
    getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
    // kiPoints undefined in runtime → currentResource = ?? maxResource = 0 (no class_levels).
    getRuntimeValue.mockImplementation(okRuntime());

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('Not enough Ki Points. 0/1 required.');
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });
});

// ── Tests: handle() — cost/resource defaults on success path ──

describe('quiveringPalmHandler.handle — cost/resource defaults', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('defaults cost to 3 kiPoints when auto.cost is undefined', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ cost: undefined });

    getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Goblin', type: 'monster' }],
    });
    getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
    getRuntimeValue.mockImplementation(okRuntime({ resource: 'kiPoints', value: 5 }));

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Quivering Palm set on Goblin');
    // Pins BOTH defaults in one exact write: cost||3 and resource||'kiPoints' (5-3=2).
    expect(setRuntimeValue).toHaveBeenCalledWith('TestMonk', 'kiPoints', 2, campaignName);
    expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'quivering_palm', 'Goblin', campaignName);
  });

  it('falls back to monkFocusPointMax when runtime resource is undefined', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ cost: { amount: 3 } });

    getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Goblin', type: 'monster' }],
    });
    getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
    // No kiPoints value in runtime → ?? maxResource = focus_points 4 → spends down to 1.
    getRuntimeValue.mockImplementation(okRuntime());

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Quivering Palm set on Goblin');
    expect(setRuntimeValue).toHaveBeenCalledWith('TestMonk', 'kiPoints', 1, campaignName);
  });
});
