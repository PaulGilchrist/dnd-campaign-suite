// @maintained-by-ai
// remarkableAthlete lane — 2024 "Remarkable Athlete" crit-movement latch: a crit by a holder of the
// auto_effect remarkable_athlete_movement rider (2024/classes.json verbatim) writes the
// remarkableAthleteNoOA=true store byte; damage data passes through untouched.
// Owner-split (cite, do NOT re-drive here):
//  - attackRollPostDamage.js featureRiders owns condition dispatch and supplies ctx.isCrit bytes.
//  - ConditionEffectBadges.no-oa-speedy.test.jsx owns the "No OA (Crit)" badge face READ of this byte;
//    ConditionEffectBadges.jsx remarkable_no_oa owns the clear-to-false lane.
//  - conditionEffectsInternal.test.js owns remarkable_athlete_athletics STR-check advantage rows.
//  - feats/classes.json → automation.passives data routing: collector lanes, not re-driven here.
// Silent-step honesty (by design, #1054 pattern): this handler logs nothing — the latch byte IS the
// output consumed by the badge lane; setRuntimeValue call-count is the burn assertion (#1026).
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock set matches source imports exactly (dead-mock purge, #1049): useRuntimeState only.
vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

import { remarkableAthlete } from './remarkableAthlete.js';
import { setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

// Rider verbatim from public/data/2024/classes.json Remarkable Athlete automation (#993).
const PASSIVE = { type: 'auto_effect', effect: 'remarkable_athlete_movement' };

function makeCtx(overrides = {}) {
  return {
    campaignName: 'test-campaign',
    playerStats: { name: 'Fighter1', automation: { passives: [PASSIVE] } },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('remarkableAthlete — condition', () => {
  it('fires only on a crit carrying the exact auto_effect/remarkable_athlete_movement rider byte', () => {
    // Armed: crit + matching rider.
    expect(remarkableAthlete.condition(makeCtx({ isCrit: true }))).toBe(true);
    // Rider buried among decoys still arms.
    expect(remarkableAthlete.condition(makeCtx({
      isCrit: true,
      playerStats: {
        name: 'Fighter1',
        automation: { passives: [{ type: 'auto_effect', effect: 'other' }, PASSIVE] },
      },
    }))).toBe(true);

    // Refusals — every leg hits its own branch (#903 ladder).
    const armed = { name: 'Fighter1', automation: { passives: [PASSIVE] } };
    // non-crit short-circuits before any passive scan (exact false byte)
    expect(remarkableAthlete.condition(makeCtx({ isCrit: false, playerStats: armed }))).toBe(false);
    // missing crit byte: && short-circuit returns undefined, not false (honest ===)
    expect(remarkableAthlete.condition(makeCtx({ playerStats: armed }))).toBeFalsy();
    // right effect, wrong rider type
    expect(remarkableAthlete.condition(makeCtx({
      isCrit: true,
      playerStats: { name: 'Fighter1', automation: { passives: [{ type: 'passive_rule', effect: 'remarkable_athlete_movement' }] } },
    }))).toBe(false);
    // right type, wrong effect
    expect(remarkableAthlete.condition(makeCtx({
      isCrit: true,
      playerStats: { name: 'Fighter1', automation: { passives: [{ type: 'auto_effect', effect: 'some_other_effect' }] } },
    }))).toBe(false);
    // empty passives
    expect(remarkableAthlete.condition(makeCtx({ isCrit: true, playerStats: { name: 'Fighter1', automation: { passives: [] } } }))).toBe(false);
    // structurally missing store branches (optional-chain legs)
    expect(remarkableAthlete.condition(makeCtx({ isCrit: true, playerStats: { name: 'Fighter1', automation: {} } }))).toBe(false);
    expect(remarkableAthlete.condition(makeCtx({ isCrit: true, playerStats: { name: 'Fighter1', automation: null } }))).toBe(false);
    expect(remarkableAthlete.condition(makeCtx({ isCrit: true, playerStats: {} }))).toBe(false);
    expect(remarkableAthlete.condition(makeCtx({ isCrit: true, playerStats: null }))).toBe(false);
  });
});

describe('remarkableAthlete — handler', () => {
  it('burns exactly one latch byte remarkableAthleteNoOA=true and passes prevData through by identity', async () => {
    const prevData = { formula: '1d8+3', total: 11, rolls: [5, 3, 3] };

    const res = await remarkableAthlete.handler(makeCtx({ isCrit: true }), prevData);

    expect(res).toEqual({ data: prevData });
    expect(res.data).toBe(prevData); // pipeline passthrough preserves object identity (#829)
    expect(setRuntimeValue).toHaveBeenCalledTimes(1); // one write, no extra burns
    expect(setRuntimeValue).toHaveBeenCalledWith('Fighter1', 'remarkableAthleteNoOA', true, 'test-campaign');
  });

  it('keys the latch to the ctx character and campaign, not hardcoded bytes (#1050/#1052 falsifier)', async () => {
    const prevData = {};

    const res = await remarkableAthlete.handler(
      makeCtx({ campaignName: 'other-campaign', playerStats: { name: 'Barbarian42', automation: { passives: [PASSIVE] } } }),
      prevData,
    );

    expect(setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(setRuntimeValue).toHaveBeenCalledWith('Barbarian42', 'remarkableAthleteNoOA', true, 'other-campaign');
    expect(res).toEqual({ data: prevData });
  });
});
