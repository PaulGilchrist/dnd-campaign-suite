// @maintained-by-ai
// Owns the applyRelease() release-flow cleanup contract: the filter predicate
// and `|| []` guard inside cleanupQuiveringPalmEffect. Popup happy path is
// pinned in quiveringPalmHandler.test.js; the L285 addEntry log-catch is
// pinned in quiveringPalmHandler.catchCoverage.test.js — do not re-pin here.
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

function targetEffectsWrite() {
  const call = setRuntimeValue.mock.calls.find(
    call => call[0] === 'campaign' && call[1] === 'targetEffects'
  );
  expect(call, 'applyRelease must persist targetEffects cleanup').toBeDefined();
  return call;
}

// ── Tests: applyRelease() targetEffects cleanup ────────────────

describe('quiveringPalmHandler.applyRelease — targetEffects cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('removes only the target\'s quivering_palm entries, preserving all others', async () => {
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

    await applyRelease(action, ps, campaignName, 'Goblin');

    // Exact-table pin: match (Goblin+quivering_palm) removed; different effect
    // on same target and same effect on other target both survive.
    expect(targetEffectsWrite()[2]).toEqual([
      { target: 'Goblin', effect: 'blinded', source: 'Blindness' },
      { target: 'Ogre', effect: 'quivering_palm', source: 'Quivering Palm' },
    ]);
  });

  it('writes an empty targetEffects array when stored effects are undefined', async () => {
    const ps = makePlayerStats();
    const action = makeAction();

    getRuntimeValue.mockReturnValue(undefined);

    await applyRelease(action, ps, campaignName, 'Goblin');

    // Pins the `|| []` guard in cleanupQuiveringPalmEffect — never persist undefined.
    expect(targetEffectsWrite()[2]).toEqual([]);
  });
});
