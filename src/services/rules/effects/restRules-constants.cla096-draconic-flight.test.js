// @maintained-by-ai
// CLA-096: 2024 races.json Draconic Flight is recharge:'long_rest' with a
// 10-minute buff — buffHandler stamps `draconicFlightUsed = true` on activation
// and expiry/retract/Incapacitated drop the buff WITHOUT refunding the use
// (draconicFlightService never touches the latch), so the spent true must
// SURVIVE a Short Rest with zero writes and be nulled by the Long Rest atomic
// batch (null = re-armed: the gate reads `getRuntimeValue(...) === true`,
// contract owned by buffHandler.draconic-flight.test.js). Expiry logging is
// owned by clearExpirationEffects.draconic-flight-expiry.test.js; the
// Incapacitated tick by turnStartEffects.draconic-flight-incapacitated.test.js.
// Mock surface mirrors sibling cla048/cla130/cla140 rest-lane tests verbatim.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import races2024 from '../../../../public/data/2024/races.json' with { type: 'json' };

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
const LATCH_KEY = 'draconicFlightUsed';

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
    name: 'TestDragonborn',
    hitPoints: 32,
    level: 5,
    proficiency: 3,
    class: { name: 'Fighter' },
    abilities: [{ name: 'Strength', bonus: 3 }],
    ...overrides,
  };
}

function batchFor(name) {
  const call = vi.mocked(setRuntimeBatch).mock.calls.find(c => c[0] === name);
  expect(call, 'rest lane must fire one atomic batch for the character').toBeTruthy();
  return call[1];
}

describe('CLA-096 Draconic Flight rest-latch behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRuntimeValue).mockReturnValue(undefined);
  });

  it('canon: 2024 races.json recharges Draconic Flight on a Long Rest only, buffed for 10 minutes', () => {
    const feature = findFeature(races2024, 'Draconic Flight');
    expect(feature?.automation?.recharge).toBe('long_rest');
    // The 10-minute clock is why the latch cannot ride on the buff — it must
    // outlive the buff and be re-armed by the Long Rest batch alone.
    expect(feature?.automation?.duration).toBe('10_minutes');
  });

  it('a spent latch (true) survives a Short Rest with ZERO writes — re-arm stays closed', async () => {
    vi.mocked(getRuntimeValue).mockImplementation((_name, key) =>
      key === LATCH_KEY ? true : undefined);

    await applyShortRest(makeStats(), CAMPAIGN);

    const updates = batchFor('TestDragonborn');
    expect(updates).not.toHaveProperty(LATCH_KEY);
    expect(setRuntimeValue).not.toHaveBeenCalledWith('TestDragonborn', LATCH_KEY, expect.anything(), CAMPAIGN);
  });

  it('applyLongRest nulls the spent latch in the atomic batch (null = gate re-open)', async () => {
    vi.mocked(getRuntimeValue).mockImplementation((_name, key) =>
      key === LATCH_KEY ? true : undefined);

    await applyLongRest(makeStats(), CAMPAIGN);

    const updates = batchFor('TestDragonborn');
    expect(updates[LATCH_KEY]).toBeNull();
  });
});
