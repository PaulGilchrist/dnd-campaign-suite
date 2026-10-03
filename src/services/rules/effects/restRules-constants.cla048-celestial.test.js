// @generated-by:ai
// CLA-048: 2024 races.json Celestial Revelation is recharge:'long_rest' only —
// _celestialRevelationUses must NOT sit in SHORT_REST_RESOURCES (Short Rest
// re-armed the latch live), and MUST stay in LONG_REST_RESOURCES.
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../combat/conditions/exhaustionRules.js', () => ({
  getLevelAfterLongRest: vi.fn((s) => s?.level ?? 1),
}));

import { getShortRestResources, getLongRestResources } from './restRules-constants.js';

describe('CLA-048 rest latch resources', () => {
  it('_celestialRevelationUses is NOT short-rest re-armed', () => {
    expect(getShortRestResources()).not.toContain('_celestialRevelationUses');
  });

  it('_celestialRevelationUses IS long-rest re-armed (RAW: recharge long_rest)', () => {
    expect(getLongRestResources()).toContain('_celestialRevelationUses');
  });
});
