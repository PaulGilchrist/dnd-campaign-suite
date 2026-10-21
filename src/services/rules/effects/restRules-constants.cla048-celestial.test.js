// @maintained-by-ai
// CLA-048: 2024 races.json Celestial Revelation is recharge:'long_rest' only —
// a spent `_celestialRevelationUses` counter (0) must SURVIVE a Short Rest
// (Short Rest re-armed the latch live) and be nulled by the Long Rest atomic
// batch (null = re-armed: the handler gate reads `stored ?? auto.usesMax`,
// gate contract owned by celestialRevelationHandler.test.js).
// Payload assertions mirror the cla130/cla140 constants-lane pattern.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import races2024 from '../../../../public/data/2024/races.json' with { type: 'json' };

// Mock surface mirrors restRules-constants.cla130/cla140 sibling lanes.
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => undefined),
  setRuntimeBatch: vi.fn(),
  setRuntimeValue: vi.fn(),
  getAllStoreKeys: vi.fn(() => []),
}));

vi.mock('../../../services/dice/diceRoller.js', () => ({
  rollD20: vi.fn(() => 10),
}));

vi.mock('./expirations.js', () => ({
  clearAllExpirationEffects: vi.fn(),
}));

vi.mock('../../combat/conditions/exhaustionRules.js', () => ({
  getLevelAfterLongRest: vi.fn((level) => Math.max(0, level - 1)),
}));

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve({})),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
  setCombatSummaryCache: vi.fn(),
}));

vi.mock('../../../services/combat/concentration/concentrationService.js', () => ({
  clearAllConcentrations: vi.fn(),
}));

vi.mock('../../../services/automation/handlers/class-warlock/celestialResilienceHandler.js', () => ({
  grantCelestialResilience: vi.fn(() => null),
  // automation/index.js imports handle + confirm/skip statically — mock full surface
  handle: vi.fn(() => null),
  confirmCelestialResilience: vi.fn(() => null),
  skipCelestialResilience: vi.fn(() => null),
}));

vi.mock('../features/invisibilityService.js', () => ({
  endInvisibility: vi.fn(),
  endGreaterInvisibility: vi.fn(),
}));

vi.mock('../../../services/ui/storage.js', () => ({
  default: { set: vi.fn() },
}));

import { applyShortRest, applyLongRest } from './restRules.js';
import { getRuntimeValue, setRuntimeBatch, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

const CAMPAIGN = 'test-campaign';
const LATCH_KEY = '_celestialRevelationUses';

function findFeature(node, name) {
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findFeature(item, name);
      if (found) return found;
    }
    return null;
  }
  if (node && typeof node === 'object') {
    if (node.name === name && node.automation) return node;
    for (const value of Object.values(node)) {
      const found = findFeature(value, name);
      if (found) return found;
    }
  }
  return null;
}

function makeStats(overrides = {}) {
  return {
    name: 'AasimarSorc',
    hitPoints: 24,
    level: 3,
    proficiency: 2,
    class: { name: 'Sorcerer' },
    abilities: [{ name: 'Charisma', bonus: 4 }],
    ...overrides,
  };
}

function batchFor(name) {
  const call = vi.mocked(setRuntimeBatch).mock.calls.find(c => c[0] === name);
  expect(call, 'rest lane must fire one atomic batch for the character').toBeTruthy();
  return call[1];
}

describe('CLA-048 Celestial Revelation rest-latch behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRuntimeValue).mockReturnValue(undefined);
  });

  it('canon: 2024 races.json recharges Celestial Revelation on a Long Rest only', () => {
    const feature = findFeature(races2024, 'Celestial Revelation');
    expect(feature?.automation?.recharge).toBe('long_rest');
  });

  it('a spent latch (0) survives a Short Rest with ZERO writes — re-arm stays closed', async () => {
    vi.mocked(getRuntimeValue).mockImplementation((_name, key) =>
      key === LATCH_KEY ? 0 : undefined);

    await applyShortRest(makeStats(), CAMPAIGN);

    const updates = batchFor('AasimarSorc');
    expect(updates).not.toHaveProperty(LATCH_KEY);
    expect(setRuntimeValue).not.toHaveBeenCalledWith('AasimarSorc', LATCH_KEY, expect.anything(), CAMPAIGN);
  });

  it('applyLongRest nulls the latch in the atomic batch (null = re-armed for the gate)', async () => {
    await applyLongRest(makeStats(), CAMPAIGN);

    const updates = batchFor('AasimarSorc');
    expect(updates[LATCH_KEY]).toBeNull();
  });
});
