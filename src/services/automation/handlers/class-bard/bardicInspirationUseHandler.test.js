// @maintained-by-ai
// Deterministic unit tests for bardicInspirationUseHandler.handle — the sole execution
// coverage for the 'bardic_inspiration_use' automation (dispatched via
// src/services/automation/index.js registry; invoked from CharSheet). Focus is this
// handler's divergent core: the ability-check popup wording (full exact-payload pin)
// and the consumption shape — exactly two runtime clears (die + grantedBy), unlike the
// Offense/Defense siblings which also clear bardicInspirationCombatOptions. The refuse
// / roll-fail preamble is verbatim-identical to those siblings and pinned there; both
// early-return branches are covered here once, compactly, to keep this handler's own
// guard side-effect-free contract exercised. All deps mocked; no app churn should
// require rework beyond message-string updates.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './bardicInspirationUseHandler.js';
import * as diceRoller from '../../../dice/diceRoller.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';
const playerName = 'TestHero';

function makeAction() {
  return {
    name: 'Use Bardic Inspiration',
    automation: { type: 'bardic_inspiration_use' },
  };
}

function playerStats() {
  return { name: playerName };
}

function mockRuntime(dieSize, grantedBy) {
  runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
    if (key === 'bardicInspirationDie') return dieSize;
    if (key === 'bardicInspirationGrantedBy') return grantedBy;
    return null;
  });
}

// ── Tests ──────────────────────────────────────────────────────

describe('bardicInspirationUseHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('refuses without rolling or consuming state when no die is available or the roll fails', async () => {
    // No die in the runtime store.
    mockRuntime(null, null);
    const refused = await handle(makeAction(), playerStats(), campaignName);

    expect(refused).toEqual({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Use Bardic Inspiration',
        description: 'You do not have a Bardic Inspiration die.',
      },
    });

    // Die present but the roll itself fails — the die must NOT be consumed.
    mockRuntime(8, 'Ally Bard');
    diceRoller.rollExpression.mockReturnValue(null);
    const failed = await handle(makeAction(), playerStats(), campaignName);

    expect(failed).toEqual({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Use Bardic Inspiration',
        description: 'Roll failed.',
      },
    });

    expect(diceRoller.rollExpression).toHaveBeenCalledTimes(1);
    expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d8');
    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('rolls the die and returns the ability-check popup with roll details and grantor', async () => {
    mockRuntime(8, 'Bard College Member');
    diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [3, 2] });

    const result = await handle(makeAction(), playerStats(), campaignName);

    // Full exact payload pins the ability-check variant wording unique to this handler
    // (siblings say "attack's damage" / "your AC"), plus roll breakdown and grantor.
    expect(result).toEqual({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Use Bardic Inspiration',
        description:
          'Bardic Inspiration (1d8): rolled **5** (3, 2). Add this to an ability check. Die granted by Bard College Member.',
        automation: { type: 'bardic_inspiration_use' },
      },
    });
  });

  it('scales the roll expression with die size and falls back to an "unknown" grantor', async () => {
    mockRuntime(10, null);
    diceRoller.rollExpression.mockReturnValue({ total: 7, rolls: [7] });

    const result = await handle(makeAction(), playerStats(), campaignName);

    expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d10');
    expect(result.payload.description).toContain('Bardic Inspiration (1d10)');
    expect(result.payload.description).toContain('rolled **7** (7)');
    expect(result.payload.description).toContain('Die granted by unknown');
  });

  it('consumes the inspiration by clearing exactly die and grantedBy', async () => {
    mockRuntime(12, 'Bard NPC');
    diceRoller.rollExpression.mockReturnValue({ total: 10, rolls: [10] });

    await handle(makeAction(), playerStats(), campaignName);

    // Divergent from Offense/Defense siblings: this handler clears TWO keys, not three
    // (no bardicInspirationCombatOptions on the ability-check lane).
    const calls = runtimeState.setRuntimeValue.mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual([playerName, 'bardicInspirationDie', null, campaignName]);
    expect(calls[1]).toEqual([playerName, 'bardicInspirationGrantedBy', null, campaignName]);
  });
});
