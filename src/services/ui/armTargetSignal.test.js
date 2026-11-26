// @maintained-by-ai 2026-11-25
/* Lane: arm-target signal (backlog 2026-11-24 run BA) — the sheet refusal's
 * "Arm a target" button arms a NAME-matched, single-shot focus request that
 * survives the sheet→Initiative navigation seam. Sibling shape of
 * encounterLoadSignal.test.js, plus the name-match law: a non-matching card
 * must never consume the request. */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  requestArmTarget,
  consumePendingArmTarget,
  subscribeToArmTarget,
} from './armTargetSignal.js';

describe('armTargetSignal', () => {
  afterEach(() => {
    // Drain any request a spec left armed so module state never leaks.
    consumePendingArmTarget('Korgath');
    consumePendingArmTarget('Goblin 1');
  });

  it('a request is honored exactly once, only by its own name', () => {
    expect(consumePendingArmTarget('Korgath')).toBe(false);
    requestArmTarget('Korgath');
    expect(consumePendingArmTarget('Goblin 1')).toBe(false); // sibling card must NOT eat it
    expect(consumePendingArmTarget('Korgath')).toBe(true);
    expect(consumePendingArmTarget('Korgath')).toBe(false); // single-shot
  });

  it('the latest request wins', () => {
    requestArmTarget('Korgath');
    requestArmTarget('Goblin 1');
    expect(consumePendingArmTarget('Korgath')).toBe(false);
    expect(consumePendingArmTarget('Goblin 1')).toBe(true);
  });

  it('subscribers fire synchronously and unsubscribe cleanly', () => {
    const handler = vi.fn();
    const unsubscribe = subscribeToArmTarget(handler);
    requestArmTarget('Korgath');
    expect(handler).toHaveBeenCalledTimes(1);
    unsubscribe();
    requestArmTarget('Korgath');
    expect(handler).toHaveBeenCalledTimes(1);
    consumePendingArmTarget('Korgath'); // drain the request the last click armed
  });
});
