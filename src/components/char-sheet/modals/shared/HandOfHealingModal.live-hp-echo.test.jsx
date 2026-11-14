// @maintained-by-ai
//
// improve heal-modal-live-hp-echo — Hand of Healing target-picker echo
// adoption. GZ witnessed the radio aria staying `Select EvasiveFighter, 60 of
// 112 HP` after an external refill to 112 while the picker dwelled open
// (commit-time resolveLiveTargetHp was already honest post-f3950317c — only
// the display misled). Picker rows now ride SecondaryTargetModal's liveHp tier
// (per-row useRuntimeValue on the target's buckets + bucket-first
// resolveLiveTargetHp), so aria updates mid-dwell WITHOUT a reopen — and the
// confirm-time refusal face re-rides here: a target refilled to full while the
// picker dwells still refuses with the inline note and zero writes.
//
// Runs the REAL useRuntimeState module: the echo is driven through
// setRuntimeObject(..., skipSync=true), the exact adopt-and-notify path the
// SSE echo consumer (applyStoreUpdate) uses.

import { render, screen, fireEvent, act } from '@testing-library/react';import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import HandOfHealingModal from './HandOfHealingModal.jsx';

// ── Mocked modules (everything except the runtime store itself) ──

vi.mock('../../../../services/ui/utils.js', () => ({
  default: { getName: (n) => (n || '').trim() },
}));

vi.mock('../../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({ creatures: [] })),
}));

// ── Re-imports ──

import { setRuntimeObject } from '../../../../hooks/runtime/useRuntimeState.js';

// ── Fixtures ──

const CAMPAIGN = 'test-campaign';
const MONK = 'Disciplined_Monk';
const FIGHTER = 'EvasiveFighter';

const fetchMock = vi.fn(() => Promise.reject(new Error('no network in test')));

function seedBucket(name, values) {
  act(() => {
    setRuntimeObject(name, values, CAMPAIGN, true); // skipSync — echo path, never POSTs
  });
}

function makePendingProps(confirmHeal) {
  return {
    healName: 'Hand of Healing',
    monkName: MONK,
    campaignName: CAMPAIGN,
    pending: true,
    creatureTargets: [
      { name: MONK, type: 'player', currentHp: 60, maxHp: 112 },
      { name: FIGHTER, type: 'player', currentHp: 60, maxHp: 112 },
    ],
    confirmHeal,
    onClose: vi.fn(),
  };
}

describe('HandOfHealingModal picker - mid-dwell bucket echo adoption (display-only)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockClear();
    seedBucket(MONK, { currentHitPoints: 60, hitPoints: 112, activeConditions: [] });
    seedBucket(FIGHTER, { currentHitPoints: 60, hitPoints: 112, activeConditions: [] });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('radio aria-label adopts an external refill mid-dwell — no reopen, no store writes', () => {
    render(<HandOfHealingModal {...makePendingProps(vi.fn())} />);

    expect(screen.getByRole('radio', { name: `Select ${FIGHTER}, 60 of 112 HP` })).toBeInTheDocument();

    // External tab refills the fighter to full while the picker dwells open.
    seedBucket(FIGHTER, { currentHitPoints: 112, hitPoints: 112, activeConditions: [] });

    expect(screen.getByRole('radio', { name: `Select ${FIGHTER}, 112 of 112 HP` })).toBeInTheDocument();
    // Untouched targets keep their row snapshot (bucket-first, row fallback).
    expect(screen.getByRole('radio', { name: `Select ${MONK}, 60 of 112 HP` })).toBeInTheDocument();
    // Display-only subscription: the echo wake introduced ZERO store writes.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('an echo-refilled-to-full target still refuses at confirm with the inline note and zero writes (f3950317c holds)', async () => {
    const confirmHeal = vi.fn().mockResolvedValue({ refusal: `${FIGHTER} is already at full HP. No focus spent.` });
    render(<HandOfHealingModal {...makePendingProps(confirmHeal)} />);

    seedBucket(FIGHTER, { currentHitPoints: 112, hitPoints: 112, activeConditions: [] });

    fireEvent.click(screen.getByRole('radio', { name: `Select ${FIGHTER}, 112 of 112 HP` }));
    fireEvent.click(screen.getByRole('button', { name: 'Heal' }));

    const note = await screen.findByText(`${FIGHTER} is already at full HP. No focus spent.`);
    expect(note).toHaveClass('healing-restriction-note');
    // Picker stays open for another choice; no result modal, no writes.
    expect(screen.getByText('Choose target for Hand of Healing')).toBeInTheDocument();
    expect(screen.queryByText(/HP restored/)).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
