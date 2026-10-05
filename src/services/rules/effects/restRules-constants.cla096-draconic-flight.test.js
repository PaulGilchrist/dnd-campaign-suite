// @improved-by-ai
// BUG CLA-096 / CLA-130 rule lock: the once-per-Long-Rest latch must live in
// LONG_REST_RESOURCES or the use dies permanently once expiry/retract drops
// the buff that previously carried the gate.
import { describe, it, expect } from 'vitest';
import { getLongRestResources, getShortRestResources } from './restRules-constants.js';

describe('CLA-096 draconicFlightUsed long-rest re-arm registration', () => {
  it('re-arms draconicFlightUsed on a Long Rest', () => {
    expect(getLongRestResources()).toContain('draconicFlightUsed');
  });

  it('does NOT re-arm on a Short Rest (once per Long Rest RAW)', () => {
    expect(getShortRestResources()).not.toContain('draconicFlightUsed');
  });
});
