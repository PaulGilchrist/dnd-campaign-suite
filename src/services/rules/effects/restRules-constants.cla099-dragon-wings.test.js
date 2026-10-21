// @maintained-by-ai
// BUG CLA-099 / CLA-130 rule lock: the once-per-Long-Rest uses counter
// (`dragonWingsUses`, spent to 0 by dragonWingsHandler) and the active stamp
// (`dragonWingsActive`, cleared to false by dragonWingsService on retract /
// expiry) must live in LONG_REST_RESOURCES or the use dies permanently once
// the 1-hour rounds clock or a retract drops the buff that carried the gate.
// Long-rest lane nulls the pair via the atomic batch (null = full uses:
// the gate reads `storedUses ?? auto.uses`, dragonWingsHandler.js:134-135).
// A Short Rest must NOT refund the use — RAW is once per Long Rest (or the
// 3 SP restore, owned by dragonWingsHandler.test.js).
// Activation is owned by dragonWingsHandler/dragonWingsService.test.js;
// expiry clear by clearExpirationEffects.dragon-wings-expiry.test.js.
// Mock surface mirrors sibling cla048/cla096/cla130/cla140 rest-lane tests verbatim.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import classes2024 from '../../../../public/data/2024/classes.json' with { type: 'json' };

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
const USES_KEY = 'dragonWingsUses';
const ACTIVE_KEY = 'dragonWingsActive';

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
    name: 'TestDragonSorcerer',
    hitPoints: 95,
    level: 14,
    proficiency: 5,
    class: { name: 'Sorcerer' },
    abilities: [{ name: 'Charisma', bonus: 5 }],
    ...overrides,
  };
}

// Store state after the wings have gone — clock-expired or retracted buff
// leaves uses=0 + active=false, the exact state the old bug stranded forever.
function seedSpentState() {
  vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
    if (key === USES_KEY) return 0;
    if (key === ACTIVE_KEY) return false;
    return undefined;
  });
}

function batchFor(name) {
  const call = vi.mocked(setRuntimeBatch).mock.calls.find(c => c[0] === name);
  expect(call, 'rest lane must fire one atomic batch for the character').toBeTruthy();
  return call[1];
}

describe('CLA-099 Dragon Wings rest-latch behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRuntimeValue).mockReturnValue(undefined);
  });

  it('canon: 2024 classes.json grants Dragon Wings 1 use recharging on a Long Rest, buffed 1 hour', () => {
    const feature = findFeature(classes2024, 'Dragon Wings');
    expect(feature?.automation?.type).toBe('dragon_wings');
    expect(feature?.automation?.recharge).toBe('long_rest');
    expect(feature?.automation?.uses).toBe(1);
    // The 1-hour clock is why the latch cannot ride on the buff — it must
    // outlive the buff and be re-armed by the Long Rest batch alone.
    expect(feature?.automation?.duration).toBe('1_hour');
  });

  it('spent state (0 uses, buff gone) survives a Short Rest with ZERO writes — no refund', async () => {
    seedSpentState();

    await applyShortRest(makeStats(), CAMPAIGN);

    const updates = batchFor('TestDragonSorcerer');
    expect(updates).not.toHaveProperty(USES_KEY);
    expect(updates).not.toHaveProperty(ACTIVE_KEY);
    expect(setRuntimeValue).not.toHaveBeenCalledWith('TestDragonSorcerer', USES_KEY, expect.anything(), CAMPAIGN);
    expect(setRuntimeValue).not.toHaveBeenCalledWith('TestDragonSorcerer', ACTIVE_KEY, expect.anything(), CAMPAIGN);
  });

  it('applyLongRest nulls the uses counter and active stamp in the atomic batch (null = full uses for the gate)', async () => {
    seedSpentState();

    await applyLongRest(makeStats(), CAMPAIGN);

    const updates = batchFor('TestDragonSorcerer');
    expect(updates[USES_KEY]).toBeNull();
    expect(updates[ACTIVE_KEY]).toBeNull();
  });
});
