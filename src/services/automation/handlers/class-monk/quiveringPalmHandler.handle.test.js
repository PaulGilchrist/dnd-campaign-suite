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
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
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

// ── Tests: handle() edge cases ─────────────────────────────────

describe('quiveringPalmHandler.handle — edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a popup when there is no target selected', async () => {
    const ps = makePlayerStats();
    const action = makeAction();

    getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Goblin', type: 'monster' }],
    });
    getTargetFromAttacker.mockReturnValue(null);
    getRuntimeValue.mockImplementation((_a, b, _c) => {
      if (_a === 'campaign' && b === 'quivering_palm') return null;
      if (_a === 'campaign' && b === 'lastAttack') return {
        attackerName: 'TestMonk',
        attackName: 'Unarmed Strike',
        saveResult: 'success',
      };
      if (b === 'kiPoints') return 5;
      return undefined;
    });

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.description).toContain('No target selected');
  });

  it('uses default cost when auto.cost is not defined', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ cost: undefined });

    getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Goblin', type: 'monster' }],
    });
    getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
    getRuntimeValue.mockImplementation((_a, b, _c) => {
      if (_a === 'campaign' && b === 'quivering_palm') return null;
      if (_a === 'campaign' && b === 'lastAttack') return {
        attackerName: 'TestMonk',
        attackName: 'Unarmed Strike',
        saveResult: 'success',
      };
      if (b === 'kiPoints') return 5;
      return undefined;
    });

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Quivering Palm set on Goblin');
  });

  it('uses default kiPoints resource when auto.cost.resource is not defined', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ cost: { amount: 3 } });

    getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Goblin', type: 'monster' }],
    });
    getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
    getRuntimeValue.mockImplementation((_a, b, _c) => {
      if (_a === 'campaign' && b === 'quivering_palm') return null;
      if (_a === 'campaign' && b === 'lastAttack') return {
        attackerName: 'TestMonk',
        attackName: 'Unarmed Strike',
        saveResult: 'success',
      };
      if (b === 'kiPoints') return 5;
      return undefined;
    });

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Quivering Palm set on Goblin');
  });

  it('falls back to maxResource when getRuntimeValue returns undefined for kiPoints', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ cost: { amount: 3 } });

    getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Goblin', type: 'monster' }],
    });
    getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
    getRuntimeValue.mockImplementation((_a, b, _c) => {
      if (_a === 'campaign' && b === 'quivering_palm') return null;
      if (_a === 'campaign' && b === 'lastAttack') return {
        attackerName: 'TestMonk',
        attackName: 'Unarmed Strike',
        saveResult: 'success',
      };
      return undefined;
    });

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Quivering Palm set on Goblin');
  });

  it('shows Focus Points in message when resource is focusPoints', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ cost: { amount: 3, resource: 'focusPoints' } });

    getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Goblin', type: 'monster' }],
    });
    getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
    getRuntimeValue.mockImplementation((_a, b, _c) => {
      if (_a === 'campaign' && b === 'quivering_palm') return null;
      if (_a === 'campaign' && b === 'lastAttack') return {
        attackerName: 'TestMonk',
        attackName: 'Unarmed Strike',
        saveResult: 'success',
      };
      if (b === 'focusPoints') return 1;
      return undefined;
    });

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Focus Points');
    expect(result.payload.description).toContain('Not enough');
  });

  it('handles playerStats with no class_levels', async () => {
    const ps = makePlayerStats({ class: {} });
    const action = makeAction({ cost: { amount: 1 } });

    getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Goblin', type: 'monster' }],
    });
    getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
    getRuntimeValue.mockImplementation((_a, b, _c) => {
      if (_a === 'campaign' && b === 'quivering_palm') return null;
      if (_a === 'campaign' && b === 'lastAttack') return {
        attackerName: 'TestMonk',
        attackName: 'Unarmed Strike',
        saveResult: 'success',
      };
      if (b === 'kiPoints') return 0;
      return undefined;
    });

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Not enough');
  });
});
