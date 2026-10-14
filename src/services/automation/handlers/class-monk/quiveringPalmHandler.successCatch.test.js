import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(),
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
import { addEntry } from '../../../ui/logService.js';
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

// ── Tests: handle() — success path with addEntry rejection ─────

describe('quiveringPalmHandler.handle — success path addEntry rejection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addEntry.mockResolvedValue(undefined);
  });

  it('does not throw when addEntry rejects on success path (set vibrations log)', async () => {
    const ps = makePlayerStats();
    const action = makeAction();

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
      if (b === 'targetEffects') return [];
      return undefined;
    });

    // The success path calls addEntry once at line 170-175
    // Make it reject so the .catch(() => {}) on line 175 fires
    addEntry.mockRejectedValueOnce(new Error('log error'));

    // Should not throw - the .catch(() => {}) on line 175 swallows the error
    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Quivering Palm set on Goblin');
  });
});
