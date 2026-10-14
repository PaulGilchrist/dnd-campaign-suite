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

import { handle, applyRelease } from './quiveringPalmHandler.js';
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

// ── Tests: handle() — addEntry rejection (silent .catch) ───────

describe('quiveringPalmHandler.handle — addEntry rejection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addEntry.mockResolvedValue(undefined);
  });

  it('does not throw when addEntry rejects (modal path - vibrations already active)', async () => {
    const ps = makePlayerStats();
    const action = makeAction();

    addEntry.mockRejectedValueOnce(new Error('log error'));

    getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Goblin', type: 'monster' }],
    });
    getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
    getRuntimeValue.mockImplementation((_a, b, _c) => {
      if (_a === 'campaign' && b === 'quivering_palm') return 'Ogre';
      return undefined;
    });

    // Should not throw - the .catch(() => {}) swallows the error
    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('modal');
    expect(result.modalName).toBe('quiveringPalm');
    expect(result.payload.targetName).toBe('Ogre');
  });

  it('does not throw when addEntry rejects (last attack not by monk)', async () => {
    const ps = makePlayerStats();
    const action = makeAction();

    addEntry.mockRejectedValueOnce(new Error('log error'));

    getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Goblin', type: 'monster' }],
    });
    getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
    getRuntimeValue.mockImplementation((_a, b, _c) => {
      if (_a === 'campaign' && b === 'quivering_palm') return null;
      if (_a === 'campaign' && b === 'lastAttack') return { attackerName: 'Goblin', attackName: 'Longsword' };
      return undefined;
    });

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Last attack was not made by you');
  });

  it('does not throw when addEntry rejects (last attack not Unarmed Strike)', async () => {
    const ps = makePlayerStats();
    const action = makeAction();

    addEntry.mockRejectedValueOnce(new Error('log error'));

    getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Goblin', type: 'monster' }],
    });
    getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
    getRuntimeValue.mockImplementation((_a, b, _c) => {
      if (_a === 'campaign' && b === 'quivering_palm') return null;
      if (_a === 'campaign' && b === 'lastAttack') return {
        attackerName: 'TestMonk',
        attackName: 'Longsword',
        total: 15,
        targetAc: 12,
      };
      return undefined;
    });

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Unarmed Strike');
  });

  it('does not throw when addEntry rejects (Unarmed Strike did not hit)', async () => {
    const ps = makePlayerStats();
    const action = makeAction();

    addEntry.mockRejectedValueOnce(new Error('log error'));

    getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Goblin', type: 'monster' }],
    });
    getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
    getRuntimeValue.mockImplementation((_a, b, _c) => {
      if (_a === 'campaign' && b === 'quivering_palm') return null;
      if (_a === 'campaign' && b === 'lastAttack') return {
        attackerName: 'TestMonk',
        attackName: 'Unarmed Strike',
        total: 8,
        targetAc: 15,
      };
      return undefined;
    });

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('did not hit');
  });

  it('does not throw when addEntry rejects (no target selected)', async () => {
    const ps = makePlayerStats();
    const action = makeAction();

    addEntry.mockRejectedValueOnce(new Error('log error'));

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
    expect(result.payload.description).toContain('No target selected');
  });

  it('does not throw when addEntry rejects (not enough resources)', async () => {
    const ps = makePlayerStats();
    const action = makeAction();

    addEntry.mockRejectedValueOnce(new Error('log error'));

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
      if (b === 'kiPoints') return 1;
      return undefined;
    });

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Not enough');
  });
});

// ── Tests: applyRelease() — addEntry rejection ─────────────────

describe('quiveringPalmHandler.applyRelease — addEntry rejection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addEntry.mockResolvedValue(undefined);
  });

  it('does not throw when addEntry rejects', async () => {
    const ps = makePlayerStats();
    const action = makeAction();

    getRuntimeValue.mockImplementation((_a, b, _c) => {
      if (b === 'targetEffects') return [
        { target: 'Goblin', effect: 'quivering_palm', source: 'Quivering Palm' },
      ];
      return undefined;
    });

    addEntry.mockRejectedValueOnce(new Error('log error'));

    // Should not throw - the .catch(() => {}) swallows the error
    const result = await applyRelease(action, ps, campaignName, 'Goblin');

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('harmlessly');
  });
});
