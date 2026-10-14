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

import { applyRelease } from './quiveringPalmHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

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

// ── Tests: applyRelease() with targetEffects cleanup ───────────

describe('quiveringPalmHandler.applyRelease — targetEffects cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('cleans up quivering_palm effect from targetEffects array', async () => {
    const ps = makePlayerStats();
    const action = makeAction();

    getRuntimeValue.mockImplementation((_a, b, _c) => {
      if (b === 'targetEffects') return [
        { target: 'Goblin', effect: 'quivering_palm', source: 'Quivering Palm' },
        { target: 'Goblin', effect: 'blinded', source: 'Blindness' },
        { target: 'Ogre', effect: 'quivering_palm', source: 'Quivering Palm' },
      ];
      return undefined;
    });

    const result = await applyRelease(action, ps, campaignName, 'Goblin');

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('harmlessly');
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'campaign',
      'targetEffects',
      expect.arrayContaining([
        expect.objectContaining({ effect: 'blinded' }),
      ]),
      campaignName
    );
    // Should have called setRuntimeValue for: quivering_palm=null, targetEffects cleanup
    const setCalls = setRuntimeValue.mock.calls;
    const effectCleanupCall = setCalls.find(
      call => call[0] === 'campaign' && call[1] === 'targetEffects'
    );
    expect(effectCleanupCall).toBeDefined();
    // The cleaned effects should NOT include the quivering_palm for Goblin
    expect(effectCleanupCall[2]).toEqual([
      { target: 'Goblin', effect: 'blinded', source: 'Blindness' },
      { target: 'Ogre', effect: 'quivering_palm', source: 'Quivering Palm' },
    ]);
  });

  it('handles targetEffects being undefined', async () => {
    const ps = makePlayerStats();
    const action = makeAction();

    getRuntimeValue.mockImplementation((_a, b, _c) => {
      if (b === 'targetEffects') return undefined;
      return undefined;
    });

    const result = await applyRelease(action, ps, campaignName, 'Goblin');

    expect(result.type).toBe('popup');
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'campaign',
      'targetEffects',
      [],
      campaignName
    );
  });

  it('removes all quivering_palm effects for the target', async () => {
    const ps = makePlayerStats();
    const action = makeAction();

    getRuntimeValue.mockImplementation((_a, b, _c) => {
      if (b === 'targetEffects') return [
        { target: 'Goblin', effect: 'quivering_palm', source: 'Quivering Palm' },
        { target: 'Goblin', effect: 'quivering_palm', source: 'Quivering Palm' },
        { target: 'Ogre', effect: 'quivering_palm', source: 'Quivering Palm' },
      ];
      return undefined;
    });

    const result = await applyRelease(action, ps, campaignName, 'Goblin');

    expect(result.type).toBe('popup');
    const setCalls = setRuntimeValue.mock.calls;
    const effectCleanupCall = setCalls.find(
      call => call[0] === 'campaign' && call[1] === 'targetEffects'
    );
    expect(effectCleanupCall[2]).toEqual([
      { target: 'Ogre', effect: 'quivering_palm', source: 'Quivering Palm' },
    ]);
  });
});
