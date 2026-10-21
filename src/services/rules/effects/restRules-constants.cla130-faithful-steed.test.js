// @maintained-by-ai
// BUG CLA-130 rest-lane lock: 2024 Paladin lv5 Faithful Steed (classes.json
// free_spell uses:1 recharge:"long_rest") spends `_Faithful_Steed_freeCastCount`
// to 0 via spellPreparationService.adjustRechargeCounter. The spent 0 must
// SURVIVE a Short Rest with zero writes and be null-re-armed by the Long Rest
// atomic batch (null = available: featureFreeCastCount `stored ?? uses` fallback
// re-arms the Free Cast badge). Family rule (CLA-096/099/130): every feature-keyed
// `_<Feature>_freeCastCount` latch derived from disk class data must re-arm in the
// LR batch or the free use dies permanently. Badge-authorization semantics are owned
// by spellPreparationService.cla130-faithful-steed.test.js; the summon spawn lane by
// findSteedSummon.test.js (#1156 family). This file pins ONLY the rest-lane bytes.
// Mock surface mirrors sibling cla048/cla096/cla099/cla140 rest-lane tests verbatim.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import classes5e from '../../../../public/data/classes.json' with { type: 'json' };
import classes2024 from '../../../../public/data/2024/classes.json' with { type: 'json' };
import { getLongRestResources } from './restRules-constants.js';

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
const STEED_LATCH = '_Faithful_Steed_freeCastCount';

function makeStats() {
  return {
    name: 'ElderPaladin',
    hitPoints: 133,
    level: 20,
    proficiency: 6,
    class: { name: 'Paladin' },
    abilities: [{ name: 'Charisma', bonus: 4 }],
  };
}

function batchFor(name) {
  const call = setRuntimeBatch.mock.calls.find(c => c[0] === name);
  expect(call, `${name} rest lane must fire one atomic batch`).toBeTruthy();
  return call[1];
}

// Enumerate every feature-keyed `_<Feature>_freeCastCount` latch a free_spell +
// long-rest-recharge automation row in a class database can stamp at cast time.
function freeCastLatchKeys(classes) {
  const keys = new Set();
  const scan = (feature) => {
    const autos = Array.isArray(feature?.automation) ? feature.automation : [feature?.automation].filter(Boolean);
    for (const a of autos) {
      if (a?.type !== 'free_spell' || a?.perSpellTracking) continue;
      if (a.uses == null && a.uses_expression == null) continue;
      if (!String(a.recharge || '').includes('long_rest')) continue;
      keys.add(`_${String(feature.name).replace(/\s+/g, '_')}_freeCastCount`);
    }
  };
  const walk = (node) => {
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (node && typeof node === 'object') {
      if (node.name && node.automation) scan(node);
      Object.values(node).forEach(walk);
    }
  };
  walk(classes);
  return keys;
}

describe('CLA-130 Faithful Steed free-cast latch rest-lane contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRuntimeValue).mockReturnValue(undefined);
  });

  it('canon: 2024 classes.json Faithful Steed is a once-per-Long-Rest free Find Steed', () => {
    const keys = freeCastLatchKeys(classes2024);
    // Scanner health + data anchor: the row exists, is a long-rest free_spell of
    // Find Steed with uses:1, and its cast-time latch key spells exactly
    // `_Faithful_Steed_freeCastCount` (name→key derivation mirrors spellPreparationService).
    expect(keys.has(STEED_LATCH)).toBe(true);
    let auto = null;
    const walk = (node) => {
      if (auto || !node || typeof node !== 'object') return;
      if (node.name === 'Faithful Steed' && node.automation?.type === 'free_spell') { auto = node.automation; return; }
      (Array.isArray(node) ? node : Object.values(node)).forEach(walk);
    };
    walk(classes2024);
    expect(auto.spell).toBe('Find Steed');
    expect(auto.uses).toBe(1);
    expect(auto.recharge).toBe('long_rest');
  });

  it('a spent latch (0) survives a Short Rest with ZERO writes — re-arm stays closed (RAW: Long Rest only)', async () => {
    vi.mocked(getRuntimeValue).mockImplementation((_name, key) =>
      key === STEED_LATCH ? 0 : undefined);

    await applyShortRest(makeStats(), CAMPAIGN);

    const updates = batchFor('ElderPaladin');
    expect(Object.keys(updates).length, 'SR lane must still fire its own batch').toBeGreaterThan(0);
    expect(updates).not.toHaveProperty(STEED_LATCH);
    expect(setRuntimeValue.mock.calls.filter(c => c[1] === STEED_LATCH)).toHaveLength(0);
  });

  it('applyLongRest nulls every _<Feature>_freeCastCount latch — disk-scanned family AND registry — in the atomic batch', async () => {
    vi.mocked(getRuntimeValue).mockImplementation((_name, key) =>
      key === STEED_LATCH ? 0 : undefined);

    await applyLongRest(makeStats(), CAMPAIGN);

    const diskKeys = [...freeCastLatchKeys(classes5e), ...freeCastLatchKeys(classes2024)];
    // CLA-130 family floor: Faithful Steed, Contact Patron, Misty Wanderer,
    // Paladin's Smite and Favored Enemy latches must all be visible to the scan.
    expect(diskKeys).toContain(STEED_LATCH);
    expect(diskKeys).toContain('_Contact_Patron_freeCastCount');
    expect(new Set(diskKeys).size).toBeGreaterThanOrEqual(5);

    const updates = batchFor('ElderPaladin');
    const latches = new Set([...diskKeys,
      ...getLongRestResources().filter(k => k.endsWith('_freeCastCount'))]);
    for (const key of latches) {
      expect(updates, `${key} must be null-re-armed or the free use dies permanently`).toHaveProperty(key, null);
    }
  });
});
