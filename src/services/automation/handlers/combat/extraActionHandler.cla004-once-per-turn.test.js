import { describe, it, expect, vi, beforeEach } from 'vitest';

// CLA-004 regression: Action Surge once-per-turn latch must never pin the
// round. getCurrentCombatRound() without campaignName resolved the cs cache
// lookup to undefined -> null and pinned round to 1, so the stamp and the
// comparison were both 1 forever — every turn after the first surge in a
// combat was refused and the lv17 banked 2nd charge was stranded.

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

  it('re-arms on a later turn: banked 2nd charge spends after round-wrap clear', async () => {
    // Round 3, latch cleared at the round wrap (PLAYER_ROUND_LATCH_KEYS).
    loadCombatSummary.mockResolvedValue({ round: 3, creatures: [] });
    seedStore({ uses: 1, latch: null });

    const result = await handle(action, playerStats, campaignName);

    expect(result.payload.type).toBe('automation_info');
    expect(setRuntimeValue).toHaveBeenCalledWith('EvasiveFighter', 'actionSurgeUsedThisRound', 3, campaignName, true);
    expect(setRuntimeValue).toHaveBeenCalledWith('EvasiveFighter', 'actionSurgeUses', 0, campaignName, true);
  });

  it('re-arms by round inequality even when the latch was not cleared at wrap', async () => {
    // Belt & braces: stale latch stamp 2 must not block in round 3+.
    loadCombatSummary.mockResolvedValue({ round: 3, creatures: [] });
    seedStore({ uses: 1, latch: 2 });

    const result = await handle(action, playerStats, campaignName);

    expect(result.payload.type).toBe('automation_info');
    expect(setRuntimeValue).toHaveBeenCalledWith('EvasiveFighter', 'actionSurgeUses', 0, campaignName, true);
  });

  it('refuses at 0 uses with a logged refusal and zero writes', async () => {
    loadCombatSummary.mockResolvedValue({ round: 3, creatures: [] });
    seedStore({ uses: 0, latch: null });

    const result = await handle(action, playerStats, campaignName);

    expect(result.payload.description).toBe('Action Surge has no uses remaining. Recharges on a short_rest.');
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(refusals()).toHaveLength(1);
    expect(refusals()[0].characterName).toBe('EvasiveFighter');
  });

  it('post-short-rest null state recomputes from usesMax and logs the spend', async () => {
    loadCombatSummary.mockResolvedValue({ round: 1, creatures: [] });
    seedStore({ uses: null, latch: null });

    const result = await handle(action, playerStats, campaignName);

    expect(result.payload.type).toBe('automation_info');
    expect(setRuntimeValue).toHaveBeenCalledWith('EvasiveFighter', 'actionSurgeUses', 1, campaignName, true);
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
    expect(spend[0].description).toContain('additional action');
    expect(spend[0].description).toContain('1 use(s) remain');
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
