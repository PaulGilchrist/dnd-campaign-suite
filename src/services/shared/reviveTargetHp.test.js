// @maintained-by-ai
//
// ── reviveTargetHp.js — revive-family pre-payment invariant ──
// Verdict table shared by the three revive lanes (revivifyService
// validateBeforeConsume, handOfUltimateMercyHandler commitResurrection,
// revivificationHandler.handle): a resolved target HP of 0 or below PASSES the
// pre-payment gate; anything above 0 REFUSES before the lane consumes/spends
// (bug-revivify-stale-isdead-negative-heal — clampHpLadder's heal-never-drains
// floor only guards delta > 0, so a positive resolved HP would silently turn
// the `healAmount - targetHp` commit delta into damage).
// Absent-HP-key law: an absent key DEFAULTS TO ZERO (corpse) — the commit lanes
// never fall back to the combatSummary row for players; that row-fallback is
// the DISPLAY twin (healing/liveTargetHp.js) only.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
}));

import { resolveReviveTargetHp, reviveTargetIsLiving, stripUnconsciousOnRevive } from './reviveTargetHp.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

describe('resolveReviveTargetHp — pre-payment HP truth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('player reads the runtime bucket currentHitPoints, never the row', () => {
    getRuntimeValue.mockReturnValue(18);
    const zombie = { name: 'Ally', type: 'player', currentHp: 0, maxHp: 112 };

    expect(resolveReviveTargetHp(zombie)).toBe(18);
    expect(getRuntimeValue).toHaveBeenCalledWith('Ally', 'currentHitPoints');
  });

  it('player with an absent bucket key defaults to 0 (corpse, no row fallback)', () => {
    getRuntimeValue.mockReturnValue(null);
    const evicted = { name: 'Ally', type: 'player', currentHp: 7, maxHp: 112 };

    // Divergent-bucket face: the display twin would show row 7; the COMMIT gate
    // defaults absent-bucket to 0 — the three lanes' pinned pre-extraction law.
    expect(resolveReviveTargetHp(evicted)).toBe(0);
  });

  it('monster reads the combatSummary row (bucket is never consulted)', () => {
    const goblin = { name: 'Goblin', type: 'npc', currentHp: 12 };

    expect(resolveReviveTargetHp(goblin)).toBe(12);
    expect(getRuntimeValue).not.toHaveBeenCalled();
  });

  it('monster row with an absent currentHp defaults to 0', () => {
    const ghost = { name: 'Ghost', type: 'npc' };

    expect(resolveReviveTargetHp(ghost)).toBe(0);
  });

  it('bucket 0 is passed through as 0 (a genuine corpse passes the gate)', () => {
    getRuntimeValue.mockReturnValue(0);

    expect(resolveReviveTargetHp({ name: 'Ally', type: 'player' })).toBe(0);
  });
});

describe('reviveTargetIsLiving — verdict table (hp > 0 refuses)', () => {
  it.each([
    [1, true],
    [5, true],
    [18, true],
    [0.5, true],
    [0, false],
    [-3, false],
  ])('resolved HP %s -> refuses=%s', (hp, refuses) => {
    expect(reviveTargetIsLiving(hp)).toBe(refuses);
  });
});

describe('stripUnconsciousOnRevive — death→life crossing strip', () => {
  const CAMPAIGN = 'TestCampaign';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads the victim bucket once, campaign-threaded', () => {
    getRuntimeValue.mockReturnValue(['unconscious']);
    expect(stripUnconsciousOnRevive('Ally', CAMPAIGN)).toEqual([]);
    expect(getRuntimeValue).toHaveBeenCalledTimes(1);
    expect(getRuntimeValue).toHaveBeenCalledWith('Ally', 'activeConditions', CAMPAIGN);
  });

  it('sheds ONLY unconscious (interceptor parity): prone and the rest ride through, order preserved', () => {
    getRuntimeValue.mockReturnValue(['prone', 'unconscious', 'poisoned']);
    expect(stripUnconsciousOnRevive('Ally', CAMPAIGN)).toEqual(['prone', 'poisoned']);
  });

  it('case-folds the member test (the interceptor String(c).toLowerCase() predicate)', () => {
    getRuntimeValue.mockReturnValue(['Unconscious', 'UNCONSCIOUS', 'stunned']);
    expect(stripUnconsciousOnRevive('Ally', CAMPAIGN)).toEqual(['stunned']);
  });

  it('returns null when there is nothing to shed so callers keep their exact batch bytes', () => {
    // absent bucket key (real getRuntimeValue -> null)
    getRuntimeValue.mockReturnValue(null);
    expect(stripUnconsciousOnRevive('Ally', CAMPAIGN)).toBeNull();
    // empty / non-array / condition-free arrays never materialise a write
    for (const raw of [[], ['prone'], 'unconscious', {}]) {
      getRuntimeValue.mockReturnValue(raw);
      expect(stripUnconsciousOnRevive('Ally', CAMPAIGN)).toBeNull();
    }
  });
});
