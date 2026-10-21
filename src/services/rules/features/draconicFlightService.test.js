// @maintained-by-ai
// CLA-096 lane: the draconicFlightService.js retirement seam ITSELF —
// isDraconicFlightBuff matcher identity (exported constants pinned to disk
// canon) and endDraconicFlightBuff's retire write + FULL END_LOG_TEXT table
// (guarding the never-executed expired/incapacitated rows, whose production
// callers inline their own copies today) + latch neutrality (retiring never
// refunds the long-rest use). The service stores NO clock/date and stamps NO
// expiry field: retire is a filtered activeBuffs write only (10_minutes ≥
// 1min ⇒ combat-scoped, honest to #1302's note that the latch cannot ride
// the buff).
// Delegated away, cited verbatim from each sibling header:
//  - automation/handlers/buffs/buffHandler.draconic-flight.test.js owns
//    "the requiredLevel BLOCK branch refusal copy + side-effect-free gate,
//    and the long-rest-recharge popup copy"; it MOCKS this service (:70-72)
//    so the retract DISPATCH is pinned there — the bytes written live here.
//    Its gate reads the latch `=== true` (buffHandler.js:255).
//  - clearExpirationEffects.draconic-flight-expiry.test.js owns the
//    "Direct-handler contract of handleFlySpeedEqualsWalkSpeed"; its expiry
//    copy "duration has expired" (clearExpirationEffects.js:150) is a
//    NEAR-MISS to this service's expired copy "10 minutes have elapsed".
//    "Registration-side (addExpiration) is owned by the Draconic Flight
//    modal lane".
//  - turnStartEffects.draconic-flight-incapacitated.test.js: "the turn-start
//    incapacitated face lives in" that lane — where turnStartEffects.js:102
//    -115 inline-duplicates the dissolve copy instead of calling this seam
//    (drift risk reported); the service's OWN incapacitated row is pinned in
//    the reason table below.
//  - restRules-constants.cla096-draconic-flight.test.js owns SR zero-write
//    / LR null re-arm and the disk recharge/duration canon, asserting
//    "(draconicFlightService never touches the latch)" — that neutrality is
//    pinned here; re-arm (null) is theirs, never this service's.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import races2024 from '../../../../public/data/2024/races.json' with { type: 'json' };

const store = { DragonbornTest: {} };

// Mock surface = the service's only two real imports, 1:1 (no dead mocks).
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((name, key) => store[name]?.[key] ?? null),
  setRuntimeValue: vi.fn((name, key, value) => { store[name] = { ...store[name], [key]: value }; }),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

import {
  endDraconicFlightBuff,
  isDraconicFlightBuff,
  DRACONIC_FLIGHT_BUFF_NAME,
  DRACONIC_FLIGHT_EFFECT,
} from './draconicFlightService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';

const campaignName = 'test-campaign';
const PLAYER = 'DragonbornTest';

// Disk canon, derived programmatically (never transcribed): 2024 races.json
// Draconic Flight automation row (recharge long_rest + duration 10_minutes
// already pinned on disk by restRules-constants.cla096-draconic-flight.test.js).
function findFeature(node, name) {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findFeature(child, name);
      if (found) return found;
    }
    return null;
  }
  if (node && typeof node === 'object') {
    if (node.name === name && node.automation) return node;
    for (const child of Object.values(node)) {
      const found = findFeature(child, name);
      if (found) return found;
    }
  }
  return null;
}

const diskFeature = findFeature(races2024, 'Draconic Flight');
const DISK_BUFF = {
  name: diskFeature.name,
  effect: diskFeature.automation.effect,
  duration: diskFeature.automation.duration,
};

const BLESS = { name: 'Bless', effect: 'bless' };

// Exact end-clause copy per reason (the near-miss against
// clearExpirationEffects.js:150 "duration has expired" is deliberate here).
const END_COPY = {
  expired: `${PLAYER}'s spectral wings dissolve — Draconic Flight's 10 minutes have elapsed.`,
  incapacitated: `${PLAYER}'s spectral wings dissolve due to the Incapacitated condition.`,
  retracted: `${PLAYER} retracts the spectral wings (no action required) — Draconic Flight ends.`,
};

const envelope = (description) => ({
  type: 'ability_use',
  characterName: PLAYER,
  abilityName: diskFeature.name,
  description,
  timestamp: expect.any(Number),
});

describe('CLA-096 draconicFlightService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addEntry.mockResolvedValue(undefined); // re-seed the Promise contract
    store.DragonbornTest = {};
  });

  it('exports matcher constants equal to the disk canon and accepts only that buff', () => {
    expect(DRACONIC_FLIGHT_BUFF_NAME).toBe(diskFeature.name);
    expect(DRACONIC_FLIGHT_EFFECT).toBe(diskFeature.automation.effect);
    // The disk-derived row itself must match.
    expect(isDraconicFlightBuff(DISK_BUFF)).toBe(true);
    // Near-miss baits, REAL names: Heavenly Wings shares the fly effect
    // (attackRollBonuses.js:440); dragon_wings is dragonWingsService.js:12.
    expect(isDraconicFlightBuff({ name: 'Heavenly Wings', effect: DRACONIC_FLIGHT_EFFECT })).toBe(false);
    expect(isDraconicFlightBuff({ name: DRACONIC_FLIGHT_BUFF_NAME, effect: 'dragon_wings' })).toBe(false);
    expect(isDraconicFlightBuff(null)).toBe(false);
    expect(isDraconicFlightBuff(undefined)).toBe(false);
  });

  it('retires on retract via ONE campaign-scoped spread write and never touches the latch', () => {
    store.DragonbornTest.activeBuffs = [DISK_BUFF, BLESS];
    store.DragonbornTest.draconicFlightUsed = true; // spent use from activation

    const removed = endDraconicFlightBuff(PLAYER, campaignName, 'retracted');

    expect(removed).toBe(true);
    expect(getRuntimeValue).toHaveBeenCalledWith(PLAYER, 'activeBuffs', campaignName);
    expect(setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(setRuntimeValue).toHaveBeenCalledWith(PLAYER, 'activeBuffs', [BLESS], campaignName);
    expect(store.DragonbornTest.activeBuffs).toEqual([BLESS]);
    // Refund-lie guard: retiring the wings must not write (nor null-clear)
    // any runtime key besides the filtered buff list (buffHandler.js:255
    // gate reads draconicFlightUsed === true; only LONG_REST nulls it).
    expect(setRuntimeValue.mock.calls.every(([, key]) => key === 'activeBuffs')).toBe(true);
    expect(addEntry).toHaveBeenCalledWith(campaignName, envelope(END_COPY.retracted));
  });

  it('logs the exact END_LOG_TEXT copy for every reason, falling back to retracted', () => {
    const cases = [
      ['expired', END_COPY.expired],
      ['incapacitated', END_COPY.incapacitated],
      ['retracted', END_COPY.retracted],
      ['dragged-into-the-abyss', END_COPY.retracted], // unknown reason ⇒ retracted copy
    ];
    for (const [reason, copy] of cases) {
      store.DragonbornTest.activeBuffs = [DISK_BUFF];
      expect(endDraconicFlightBuff(PLAYER, campaignName, reason)).toBe(true);
      expect(addEntry).toHaveBeenCalledWith(campaignName, envelope(copy));
      expect(store.DragonbornTest.activeBuffs).toEqual([]);
    }
    // expired & incapacitated rows have no production caller today
    // (turnStartEffects.js / clearExpirationEffects.js inline their own
    // retire+log); still guard the whole table + write discipline.
    expect(setRuntimeValue).toHaveBeenCalledTimes(cases.length);
    expect(setRuntimeValue.mock.calls.every(([, key]) => key === 'activeBuffs')).toBe(true);
  });

  it('is a no-op without a standing buff (no write, no log)', () => {
    // No activeBuffs key at all (getRuntimeValue yields null).
    expect(endDraconicFlightBuff(PLAYER, campaignName, 'retracted')).toBe(false);
    // Foreign buffs only — foreign fly-effect bait included.
    store.DragonbornTest.activeBuffs = [BLESS, { name: 'Heavenly Wings', effect: DRACONIC_FLIGHT_EFFECT }];
    expect(endDraconicFlightBuff(PLAYER, campaignName, 'expired')).toBe(false);
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
    expect(store.DragonbornTest.activeBuffs).toEqual([BLESS, { name: 'Heavenly Wings', effect: DRACONIC_FLIGHT_EFFECT }]);
  });

  it('still strips the buff when the log write rejects, reporting the prefixed error', async () => {
    store.DragonbornTest.activeBuffs = [DISK_BUFF];
    addEntry.mockRejectedValueOnce(new Error('SSE down'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(endDraconicFlightBuff(PLAYER, campaignName, 'incapacitated')).toBe(true);
    expect(store.DragonbornTest.activeBuffs).toEqual([]);
    await Promise.resolve(); // let the service's addEntry().catch(...) microtask run
    expect(errSpy).toHaveBeenCalledWith('[draconicFlightService] Error:', expect.any(Error));

    errSpy.mockRestore();
  });
});
