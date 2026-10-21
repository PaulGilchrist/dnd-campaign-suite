// @maintained-by-ai
// CLA-388 lane: the ONLY tripwire pinning `_Wild_Companion_freeCast` registration.
// The grant is stamped by WildCompanionModal.jsx (:43/:60, paid-but-unspent Find
// Familiar array after expending a slot or a Wild Shape use) and re-armed to null by
// the generic LONG_REST_RESOURCES batch (restRules-constants.js:266) — "the familiar
// disappears when you finish a Long Rest" (2024 classes.json Druid lv2).
// Why this lane is NOT subsumed by the base full-set proof (#1312): the disk row is a
// free_spell with resourceCost "wild_companion" and NO uses/recharge, so the cla130
// disk scanner skips it (restRules-constants.cla130-faithful-steed.test.js:98), and the
// key lacks the `_freeCastCount` suffix its registry filter uses (:165) — if the key were
// ever de-registered, no sibling scan notices and the paid familiar grant survives every
// Long Rest, violating RAW. The base lane cites this file as CLA-388 owner
// (restRules-longRest.test.js:16-17). Consume-side (badge prep / clear on cast) is
// owned by spellPreparationService.wildCompanion.test.js and WildCompanionModal.test.jsx.
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve({})),
}));

vi.mock('../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
  setCombatSummaryCache: vi.fn(),
}));

vi.mock('../../combat/concentration/concentrationService.js', () => ({
  clearAllConcentrations: vi.fn(),
}));

vi.mock('../../automation/handlers/class-warlock/celestialResilienceHandler.js', () => ({
  grantCelestialResilience: vi.fn(() => null),
  // automation/index.js imports handle + confirm/skip statically — mock full surface
  handle: vi.fn(() => null),
  confirmCelestialResilience: vi.fn(() => null),
  skipCelestialResilience: vi.fn(() => null),
}));

vi.mock('../../automation/handlers/buffs/tempHpService.js', () => ({
  setTempHp: vi.fn((name, amount) => amount),
}));

vi.mock('../features/invisibilityService.js', () => ({
  endInvisibility: vi.fn(),
  endGreaterInvisibility: vi.fn(),
}));

vi.mock('../../ui/storage.js', () => ({
  default: { set: vi.fn() },
}));

import { applyShortRest, applyLongRest } from './restRules.js';
import { getRuntimeValue, setRuntimeBatch, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

const CAMPAIGN = 'test-campaign';
const GRANT_KEY = '_Wild_Companion_freeCast';
const PAID_GRANT = ['Find Familiar'];

function makeDruid() {
  return {
    name: 'Wild_Sage_Druid',
    hitPoints: 90,
    level: 20,
    proficiency: 6,
    class: { name: 'Druid', hit_point_die: 'd8', class_levels: [{ level: 2, wild_shape: 2 }] },
    abilities: [{ name: 'Wisdom', bonus: 5 }],
  };
}

function batchFor(name) {
  const call = setRuntimeBatch.mock.calls.find(c => c[0] === name);
  expect(call, `${name} rest lane must fire one atomic batch`).toBeTruthy();
  return call[1];
}

// Arity-safe writer-set: every standalone setRuntimeValue write of `key`.
function writeKeys(key) {
  return setRuntimeValue.mock.calls.filter(c => c[1] === key);
}

describe('CLA-388 Wild Companion Long Rest reset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // vitest-4: clearAllMocks RETAINS mockImplementation — re-seed the empty store.
    vi.mocked(getRuntimeValue).mockReturnValue(undefined);
  });

  it('canon: a paid Wild Companion grant is a registered LONG_REST_RESOURCES key the disk scanners cannot see', () => {
    // Disk anchor: 2024 Druid lv2 Wild Companion is a free_spell Find Familiar paid
    // with wild_companion resources — no uses/recharge, so the cla130 freeCastCount
    // scanner never derives this latch and the registry pin below is the sole guard.
    let auto = null;
    const walk = (node) => {
      if (auto || !node || typeof node !== 'object') return;
      if (node.name === 'Wild Companion' && node.automation?.type === 'free_spell') { auto = node.automation; return; }
      (Array.isArray(node) ? node : Object.values(node)).forEach(walk);
    };
    walk(classes2024);
    expect(auto, '2024 classes.json must ship the Wild Companion free_spell row').toBeTruthy();
    expect(auto.spell).toBe('Find Familiar');
    expect(auto.resourceCost).toBe('wild_companion');
    expect(auto.uses ?? null).toBeNull();
    expect(auto.recharge ?? null).toBeNull();
    // Modal-stamp key derivation (WildCompanionModal.jsx:43/:60) spells exactly this.
    expect(`_${'Wild Companion'.replace(/\s+/g, '_')}_freeCast`).toBe(GRANT_KEY);
    // Membership tripwire: de-registering silently strands every paid familiar past
    // its Long Rest death (base batch loops whatever remains; nothing else names it).
    expect(getLongRestResources()).toContain(GRANT_KEY);
  });

  it('a paid-but-unspent grant survives a Short Rest untouched and is null-re-armed by the Long Rest batch', async () => {
    vi.mocked(getRuntimeValue).mockImplementation((_name, key) =>
      key === GRANT_KEY ? [...PAID_GRANT] : undefined);

    // RAW: the familiar disappears only at the END of a Long Rest — SR must not
    // re-arm the grant nor spend it away.
    await applyShortRest(makeDruid(), CAMPAIGN);
    const sr = batchFor('Wild_Sage_Druid');
    expect(Object.keys(sr).length, 'SR lane must still fire its own batch').toBeGreaterThan(0);
    expect(sr).not.toHaveProperty(GRANT_KEY);
    expect(writeKeys(GRANT_KEY)).toHaveLength(0);

    vi.clearAllMocks();
    // clearAllMocks keeps implementations — re-seed the stored grant explicitly.
    vi.mocked(getRuntimeValue).mockImplementation((_name, key) =>
      key === GRANT_KEY ? [...PAID_GRANT] : undefined);

    await applyLongRest(makeDruid(), CAMPAIGN);
    // Exact null byte in the atomic batch — null re-arm clears the familiar grant.
    expect(batchFor('Wild_Sage_Druid')).toHaveProperty(GRANT_KEY, null);
    // Reset flows ONLY through the batch — no surplus standalone write here, and
    // bait: the unregistered numeric-latch spelling must never be written (the
    // modal stamps an array grant, not a _freeCastCount latch).
    expect(writeKeys(GRANT_KEY)).toHaveLength(0);
    expect(writeKeys('_Wild_Companion_freeCastCount')).toHaveLength(0);
    expect(batchFor('Wild_Sage_Druid')).not.toHaveProperty('_Wild_Companion_freeCastCount');
  });
});
