// @maintained-by-ai
// Lane: expirationQueue.js processExpirationList corrupt-entry isolation (#1298,
// owner-blanket-approved ⚠ pair fixed at file):
//  • :47-era — a null list entry TypeErrors the loop and the caller's outer
//    catch (expireStaleEffects.js:113) starves every later entry in that
//    store and every later phase (#105/#111-family starvation lesson);
//  • :48-era — a missing appliedRound computes a NaN expirationRound, so
//    `currentRound >= NaN` is never true: the entry was immortal AND silent.
// Posture triple (#1348): designed-immortal-SILENT / corrupt-LOUD-RETAINED /
// expired-PROCESSED. No-clock law: corrupt entries are never given a
// fabricated default clock — loud warning + retention is the honest repair.
// Byte-exact neighbours owned elsewhere: producer Infinity contract
// (addExpiration.test.js / addExpiration.ba001-single-write.test.js),
// maturity truth table (expirations_expireStaleEffects.test.js), until:'combat'
// sweeper seams (MonsterCardModal.paralyzing-breath.test.jsx #755/#1348,
// zoneDurationClock.test.js), hurl queue seam (clearExpirationEffects-hurlThroughHell.test.js).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  getAllStoreKeys: vi.fn(() => []),
}));

vi.mock('../../ui/utils.js', () => ({
  default: {
    getName: vi.fn((val) => String(val)),
  },
}));

vi.mock('../../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(() => 1),
  getActiveCreatureName: vi.fn(() => null),
  getCombatSummary: vi.fn(),
  loadCombatSummary: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../ui/storage.js', () => ({
  default: {
    set: vi.fn().mockResolvedValue(undefined),
  },
}));

// Clear side is recorded, not executed — per-type clear bytes are owned by
// the clearExpirationEffects*.test.js lanes (same posture as the #755 pin).
vi.mock('./clearExpirationEffects.js', () => ({
  clearExpirationEffects: vi.fn(),
}));

import { processExpirationList, expireForCreature, expireForTarget } from './expirationQueue.js';
import { clearExpirationEffects } from './clearExpirationEffects.js';
import { getRuntimeValue, setRuntimeValue, getAllStoreKeys } from '../../../hooks/runtime/useRuntimeState.js';
import { KEY } from './turnStartEffects.js';

const CAMPAIGN = 'test-campaign';
const OWNER = 'Caster';

let consoleSpy;

beforeEach(() => {
  vi.clearAllMocks();
  consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleSpy.mockRestore();
});

function warnTexts() {
  return consoleSpy.mock.calls.map((c) => String(c[0]));
}

function warnCalls(matcher) {
  return consoleSpy.mock.calls.filter((c) => String(c[0]).includes(matcher));
}

// ---------------------------------------------------------------------------
// :47 era — null-entry poison can never starve siblings
// ---------------------------------------------------------------------------
describe('#1298 processExpirationList — null entry loud-skip, siblings processed', () => {
  it('3-entry list poison-at-2: entry 1 retained and entry 3 matures — starvation proven impossible', () => {
    const live = { target: 'Troll', effects: [{ type: 'condition', condition: 'blinded' }], appliedRound: 3, expiryRounds: 2, expireOnCreatureName: null };
    const expired = { target: 'Orc', effects: [{ type: 'condition', condition: 'restrained' }], appliedRound: 1, expiryRounds: 2, expireOnCreatureName: null };

    const r = processExpirationList([live, null, expired], 3, OWNER, CAMPAIGN, OWNER);

    // Entry after the poison is evaluated and cleared (pre-fix the null at :47
    // TypeErrors and this entry never existed to the loop).
    expect(clearExpirationEffects).toHaveBeenCalledTimes(1);
    expect(clearExpirationEffects).toHaveBeenCalledWith(expired.effects, 'Orc', OWNER, CAMPAIGN);
    expect(r).toEqual({ processed: [live, null], expiredCount: 1, changed: true });
    // Loud-skip byte: the null is warned (never silent) and RETAINED (never
    // silently dropped) — it leaves only via a real seam or manual cleanup.
    expect(warnTexts()).toContain('[expirationQueue] null entry skipped');
    expect(warnCalls('[expirationQueue] null entry skipped')[0][1]).toEqual({ targetOwner: OWNER, campaignName: CAMPAIGN });
  });

  it('two matured entries bracketing the poison BOTH clear (expiredCount 2)', () => {
    const a = { target: 'Orc', effects: [{ type: 'condition', condition: 'prone' }], appliedRound: 1, expiryRounds: 2, expireOnCreatureName: null };
    const b = { target: 'Troll', effects: [{ type: 'condition', condition: 'blinded' }], appliedRound: 1, expiryRounds: 2, expireOnCreatureName: null };

    const r = processExpirationList([a, null, b], 3, OWNER, CAMPAIGN, OWNER);

    expect(r.expiredCount).toBe(2);
    expect(r.changed).toBe(true);
    expect(r.processed).toEqual([null]);
    expect(clearExpirationEffects).toHaveBeenCalledTimes(2);
  });

  it('expireForTarget cross-store isolation: poison in store A never starves matured store B', () => {
    // Pre-fix: the null TypeError propagated through expireForTarget's loop
    // into the caller outer catch (expireStaleEffects.js:113) — store B's
    // matured entry went unprocessed for the whole pass.
    getAllStoreKeys.mockReturnValue(['StoreA', 'StoreB']);
    const matured = { target: 'Orc', effects: [{ type: 'condition', condition: 'restrained' }], appliedRound: 1, expiryRounds: 2, expireOnCreatureName: null };
    getRuntimeValue.mockImplementation((name, key) => {
      if (key !== KEY) return null;
      if (name === 'StoreA') return [null];
      if (name === 'StoreB') return [matured];
      return null;
    });

    expect(expireForTarget('Orc', 3, CAMPAIGN)).toBe(true);

    expect(clearExpirationEffects).toHaveBeenCalledTimes(1);
    expect(clearExpirationEffects).toHaveBeenCalledWith(matured.effects, 'Orc', 'StoreB', CAMPAIGN);
    expect(setRuntimeValue).toHaveBeenCalledWith('StoreB', KEY, [], CAMPAIGN);
    expect(warnCalls('[expirationQueue] null entry skipped')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// :48 era — missing appliedRound: loud-retained, never silently immortal
// ---------------------------------------------------------------------------
describe('#1298 processExpirationList — corrupt appliedRound loud-retained', () => {
  it('missing appliedRound on a finite clock warns every pass and retains the entry (not silently immortal)', () => {
    // Expiry table arm expirations_expireStaleEffects.test.js:137 already
    // pins retain + no-clear + no-write; this pins the OTHER half: it is now
    // LOUD (the silent-immortal state leak is closed).
    const corrupt = { target: 'Orc', effects: [{ type: 'condition', condition: 'restrained' }], expiryRounds: 2, expireOnCreatureName: null };

    const r = processExpirationList([corrupt], 999, OWNER, CAMPAIGN, OWNER);
    expect(r).toEqual({ processed: [corrupt], expiredCount: 0, changed: false });

    const warns = warnCalls('[expirationQueue] entry cannot age — missing/non-finite appliedRound or expiryRounds; retained');
    expect(warns).toHaveLength(1);
    expect(warns[0][1]).toEqual({ target: 'Orc', appliedRound: undefined, expiryRounds: 2, targetOwner: OWNER, campaignName: CAMPAIGN });

    // Warning is per-pass, not once-and-silent: the hole stays loud.
    processExpirationList([corrupt], 1000, OWNER, CAMPAIGN, OWNER);
    expect(warnCalls('entry cannot age')).toHaveLength(2);
    expect(clearExpirationEffects).not.toHaveBeenCalled();
  });

  it('NaN expiryRounds is corrupt (NOT the designed-immortal Infinity sentinel) — loud-retained', () => {
    const corrupt = { target: 'Orc', effects: [], appliedRound: 3, expiryRounds: NaN, expireOnCreatureName: null };

    const r = processExpirationList([corrupt], 999, OWNER, CAMPAIGN, OWNER);

    expect(r.processed).toEqual([corrupt]);
    expect(r.changed).toBe(false);
    expect(warnCalls('entry cannot age')).toHaveLength(1);
  });

  it('expireOnCreatureName anchor without finite appliedRound is loud-retained (creature seam unresolvable)', () => {
    const corrupt = { target: 'Orc', effects: [], expiryRounds: Infinity, expireOnCreatureName: 'Caster' };

    const r = processExpirationList([corrupt], 999, OWNER, CAMPAIGN, OWNER);

    expect(r.processed).toEqual([corrupt]);
    expect(r.expiredCount).toBe(0);
    expect(r.changed).toBe(false);
    expect(clearExpirationEffects).not.toHaveBeenCalled();
    const warns = warnCalls('[expirationQueue] expireOnCreatureName anchor unresolvable — missing/non-finite appliedRound; retained');
    expect(warns).toHaveLength(1);
    expect(warns[0][1]).toEqual({ target: 'Orc', expireOnCreatureName: 'Caster', targetOwner: OWNER, campaignName: CAMPAIGN });
  });

  it('expireForCreature retains the corrupt entry with ZERO writes (changed stays false)', () => {
    const corrupt = { target: 'Orc', effects: [{ type: 'condition', condition: 'restrained' }], expiryRounds: 2, expireOnCreatureName: null };
    getRuntimeValue.mockImplementation((name, key) => (name === OWNER && key === KEY ? [corrupt] : null));

    expect(expireForCreature(OWNER, 999, CAMPAIGN)).toBe(false);
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(warnCalls('entry cannot age')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Designed-immortal silence + per-entry catch last resort
// ---------------------------------------------------------------------------
describe('#1298 designed-immortal stays silent and clear-throws stay local (#1348 posture)', () => {
  it('Infinity-designed shapes never warn at the round seam (producer ?? Infinity / until:combat contract)', () => {
    const combatScoped = { target: 'ElderPaladin', effects: [], appliedRound: 3, expiryRounds: Infinity, until: 'combat' };
    const producerInfinity = { target: 'Crawler', effects: [] }; // rounds absent -> ?? Infinity by addExpiration :23 contract
    const creatureHeld = { target: 'Orc', effects: [], appliedRound: 3, expiryRounds: Infinity, expireOnCreatureName: 'Caster' };

    // activeName mismatch keeps the creature-anchored entry held too.
    const r = processExpirationList([combatScoped, producerInfinity, creatureHeld], 9999, OWNER, CAMPAIGN, 'Goblin');

    expect(r.processed).toEqual([combatScoped, producerInfinity, creatureHeld]);
    expect(r.expiredCount).toBe(0);
    expect(r.changed).toBe(false);
    expect(consoleSpy).not.toHaveBeenCalled(); // the Infinity lane MUST stay silent
  });

  it('#1348 posture triple in one pass: designed-immortal-silent / corrupt-loud-retained / expired-processed', () => {
    const designed = { target: 'ElderPaladin', effects: [], appliedRound: 3, expiryRounds: Infinity, until: 'combat' };
    const corrupt = { target: 'Troll', effects: [], expiryRounds: 2, expireOnCreatureName: null };
    const expired = { target: 'Orc', effects: [{ type: 'condition', condition: 'restrained' }], appliedRound: 1, expiryRounds: 2, expireOnCreatureName: null };

    const r = processExpirationList([designed, corrupt, expired], 3, OWNER, CAMPAIGN, OWNER);

    expect(clearExpirationEffects).toHaveBeenCalledTimes(1);
    expect(clearExpirationEffects).toHaveBeenCalledWith(expired.effects, 'Orc', OWNER, CAMPAIGN);
    expect(r).toEqual({ processed: [designed, corrupt], expiredCount: 1, changed: true });
    expect(consoleSpy).toHaveBeenCalledTimes(1); // ONLY the corrupt arm speaks
    expect(warnTexts()[0]).toContain('cannot age');
  });

  it('clearExpirationEffects throwing mid-clear is loud-retained for the next seam; later sibling still matures', () => {
    const poison = { target: 'Orc', effects: [{ type: 'condition', condition: 'restrained' }], appliedRound: 1, expiryRounds: 2, expireOnCreatureName: null };
    const sibling = { target: 'Troll', effects: [{ type: 'condition', condition: 'blinded' }], appliedRound: 1, expiryRounds: 2, expireOnCreatureName: null };
    clearExpirationEffects.mockImplementationOnce(() => { throw new Error('clear blew up'); });

    const r = processExpirationList([poison, sibling], 3, OWNER, CAMPAIGN, OWNER);

    // Poison entry fails locally and is RETAINED (retry/audit at the next
    // seam), the sibling behind it matures — pre-fix the throw escaped to
    // the caller outer catch and starved the sibling.
    expect(r.processed).toEqual([poison]);
    expect(r.expiredCount).toBe(1);
    expect(r.changed).toBe(true);
    expect(clearExpirationEffects).toHaveBeenCalledTimes(2);
    expect(clearExpirationEffects).toHaveBeenLastCalledWith(sibling.effects, 'Troll', OWNER, CAMPAIGN);
    const throws = warnCalls('[expirationQueue] entry processing failed — retained for next seam');
    expect(throws).toHaveLength(1);
    expect(throws[0][2]).toBeInstanceOf(Error);
  });
});
