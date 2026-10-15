// @maintained-by-ai
// CLA-004 regression lane: the once-per-turn latch round threading in
// extraActionHandler's gateOncePerTurn seam. getCurrentCombatRound() without
// campaignName resolved the cs cache lookup to undefined -> null and pinned
// round to 1, so the stamp and the comparison were both 1 forever — every
// turn after the first surge in a combat was refused and the lv17 banked
// 2nd charge was stranded.
//
// Lane map: this file owns ONLY the oncePerTurn latch seam of the extra_action
// handler — the exact setRuntimeValue(name, 'actionSurgeUsedThisRound',
// <fresh threaded round>, campaignName, skipSync=true) stamp/compare contract.
// Generic gate coverage (oncePerCombat, firstRoundOnly, uses limit, custom
// recharge/resourceKey) lives in extraActionHandler.test.js; the round-wrap
// latch CLEAR (PLAYER_ROUND_LATCH_KEYS -> null) is pinned by its consumers
// (navigationHandlers/Initiative + restRules). oncePerTurn.js's
// { round, activeCreature } object-format latch internals are a different
// module and are NOT delegated to here — this seam stays a plain round number.
// Deterministic: every dependency is mocked, all round values are seeded.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
  loadCombatSummary: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

import { handle } from './extraActionHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../../../services/encounters/combatData.js';
import { addEntry } from '../../../ui/logService.js';

const campaignName = 'test-campaign';
const action = {
  name: 'Action Surge',
  description: 'You can push yourself beyond your normal limits for a moment.',
  automation: { type: 'extra_action', uses: 2, recharge: 'short_rest', oncePerTurn: true },
};
const playerStats = { name: 'EvasiveFighter', level: 18 };

// Mirrors live state: runtime store keys for the surge bank + latch.
function seedStore({ uses, latch }) {
  getRuntimeValue.mockImplementation((_name, key) => {
    if (key === 'actionSurgeUses') return uses;
    if (key === 'actionSurgeUsedThisRound') return latch;
    return undefined;
  });
}

function refusals() {
  return addEntry.mock.calls
    .map(([, e]) => e)
    .filter(e => e.automationType === 'action_surge_refused');
}

function spends() {
  return addEntry.mock.calls.map(([, e]) => e).filter(e => e.type === 'ability_use');
}

beforeEach(() => {
  vi.clearAllMocks();
  getRuntimeValue.mockReset();
  setRuntimeValue.mockReset().mockResolvedValue(undefined);
  loadCombatSummary.mockReset().mockResolvedValue({ round: 1, creatures: [] });
  addEntry.mockReset().mockResolvedValue(undefined);
});

describe('CLA-004 once-per-turn latch round threading', () => {
  // Gate table: (latch vs fresh threaded round) -> refuse | stamp+allow.

  it('stamps the fresh threaded round (not pinned 1) and spends a charge', async () => {
    loadCombatSummary.mockResolvedValue({ round: 2, creatures: [] });
    seedStore({ uses: 2, latch: null });

    const result = await handle(action, playerStats, campaignName);

    expect(result.payload.type).toBe('automation_info');
    expect(loadCombatSummary).toHaveBeenCalledWith(campaignName);
    expect(setRuntimeValue).toHaveBeenCalledWith('EvasiveFighter', 'actionSurgeUsedThisRound', 2, campaignName, true);
    expect(setRuntimeValue).toHaveBeenCalledWith('EvasiveFighter', 'actionSurgeUses', 1, campaignName, true);
  });

  it('refuses a second surge on the same round with uses unchanged', async () => {
    loadCombatSummary.mockResolvedValue({ round: 2, creatures: [] });
    seedStore({ uses: 1, latch: 2 });

    const result = await handle(action, playerStats, campaignName);

    expect(result.payload.description).toBe('Action Surge can only be used once per turn.');
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalledWith(campaignName, expect.objectContaining({ type: 'ability_use' }));
  });

  it('re-arms by round inequality even when the latch was not cleared at wrap, spending the banked 2nd charge', async () => {
    // Belt & braces: stale latch stamp 2 must not block in round 3+.
    loadCombatSummary.mockResolvedValue({ round: 3, creatures: [] });
    seedStore({ uses: 1, latch: 2 });

    const result = await handle(action, playerStats, campaignName);

    expect(result.payload.type).toBe('automation_info');
    expect(setRuntimeValue).toHaveBeenCalledWith('EvasiveFighter', 'actionSurgeUsedThisRound', 3, campaignName, true);
    expect(setRuntimeValue).toHaveBeenCalledWith('EvasiveFighter', 'actionSurgeUses', 0, campaignName, true);
  });

  it('refuses at 0 uses before the turn gate: no latch stamp, no spend', async () => {
    // Ordering pin for the oncePerTurn lane: a refusal upstream of
    // gateOncePerTurn must never touch the latch (message + zero-write
    // semantics owned by extraActionHandler.test.js uses-limit lane).
    loadCombatSummary.mockResolvedValue({ round: 3, creatures: [] });
    seedStore({ uses: 0, latch: null });

    await handle(action, playerStats, campaignName);

    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(spends()).toHaveLength(0);
  });

  it('post-short-rest null state recomputes from usesMax and logs the spend', async () => {
    loadCombatSummary.mockResolvedValue({ round: 1, creatures: [] });
    seedStore({ uses: null, latch: null });

    const result = await handle(action, playerStats, campaignName);

    expect(result.payload.type).toBe('automation_info');
    expect(setRuntimeValue).toHaveBeenCalledWith('EvasiveFighter', 'actionSurgeUsedThisRound', 1, campaignName, true);
    expect(setRuntimeValue).toHaveBeenCalledWith('EvasiveFighter', 'actionSurgeUses', 1, campaignName, true);
    expect(spends()).toHaveLength(1);
  });
});

describe('CLA-004 logging', () => {
  it('logs an ability_use spend with event details on success', async () => {
    loadCombatSummary.mockResolvedValue({ round: 2, creatures: [] });
    seedStore({ uses: 2, latch: null });

    await handle(action, playerStats, campaignName);

    const spend = spends();
    expect(spend).toHaveLength(1);
    expect(spend[0].characterName).toBe('EvasiveFighter');
    expect(spend[0].abilityName).toBe('Action Surge');
    expect(spend[0].description).toBe(
      'EvasiveFighter uses Action Surge to take one additional action this turn. 1 use(s) remain until your next short_rest.'
    );
  });

  it('logs action_surge_refused with reason on a same-turn refusal', async () => {
    loadCombatSummary.mockResolvedValue({ round: 2, creatures: [] });
    seedStore({ uses: 1, latch: 2 });

    await handle(action, playerStats, campaignName);

    const refusalsLogged = refusals();
    expect(refusalsLogged).toHaveLength(1);
    expect(refusalsLogged[0].characterName).toBe('EvasiveFighter');
    expect(refusalsLogged[0].description).toContain('once per turn');
  });
});
