// @improved-by-ai
// BUG CLA-099 / CLA-130 rule lock: the once-per-Long-Rest uses counter and
// active stamp must live in LONG_REST_RESOURCES or the use dies permanently
// once the rounds clock or a retract drops the buff that carried the gate.
import { describe, it, expect } from 'vitest';
import { getLongRestResources, getShortRestResources } from './restRules-constants.js';

describe('CLA-099 dragonWings long-rest re-arm registration', () => {
  it('re-arms dragonWingsUses on a Long Rest', () => {
    expect(getLongRestResources()).toContain('dragonWingsUses');
  });

  it('clears dragonWingsActive on a Long Rest', () => {
    expect(getLongRestResources()).toContain('dragonWingsActive');
  });

  it('does NOT re-arm on a Short Rest (once per Long Rest RAW)', () => {
    expect(getShortRestResources()).not.toContain('dragonWingsUses');
    expect(getShortRestResources()).not.toContain('dragonWingsActive');
  });
});
