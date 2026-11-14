// @maintained-by-ai
//
// improve heal-modal-live-hp-echo — mounted heal UI adopts target-bucket SSE
// echoes mid-dwell. Before this lane the header stayed `100 / 143` after an
// external PATCH refilled the bucket to 143 (the FX-observed "header stale and
// gate open" dwell face): resolveTargetCurrentHp is an imperative read that
// only re-ran at reopen/commit. The modal now subscribes to the resolved
// target's currentHitPoints/hitPoints buckets (display-only wake seam) and the
// heal chooser rows render via SecondaryTargetModal's liveHp tier, so
// header/gate/aria update on echo WITHOUT a close/reopen.
//
// This file deliberately runs the REAL useRuntimeState module: the echo is
// driven through setRuntimeObject(..., skipSync=true) — the exact replace +
// notify path applyStoreUpdate uses when it adopts a `change-<campaign>-<Char>`
// SSE echo — so the subscription seam itself is under test. Display-only: no
// store write may fire mid-dwell (asserted via the fetch stub).

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import HealingPoolModal from './HealingPoolModal.jsx';

// ── Mocked modules (everything except the runtime store itself) ──

vi.mock('../../../../hooks/runtime/useTrackedResource.js', () => ({
  default: vi.fn(),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../services/rules/combat/damageUtils.js', () => ({
  getTargetFromAttacker: vi.fn(() => null),
  getCombatContext: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../../../services/rules/combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(),
}));

vi.mock('../../../../services/ui/utils.js', () => ({
  default: { getName: vi.fn((n) => n?.toLowerCase().trim()) },
}));

vi.mock('../../../../services/combat/conditions/conditionUtils.js', () => ({
  CONDITIONS: [
    { key: 'blinded', label: 'Blinded' },
    { key: 'poisoned', label: 'Poisoned' },
  ],
}));

// ── Re-imports ──

import useTrackedResource from '../../../../hooks/runtime/useTrackedResource.js';
import * as damageUtils from '../../../../services/rules/combat/damageUtils.js';
import { setRuntimeObject } from '../../../../hooks/runtime/useRuntimeState.js';

// ── Fixtures ──

const CAMPAIGN = 'test-campaign';
const HEALER = 'CelestialWarlock';
const OTHER = 'ElderPaladin';

const fetchMock = vi.fn(() => Promise.reject(new Error('no network in test')));

function seedBucket(name, values) {
  act(() => {
    setRuntimeObject(name, values, CAMPAIGN, true); // skipSync — echo path, never POSTs
  });
}

function makeProps(overrides = {}) {
  return {
    playerStats: { name: HEALER, level: 3, hitPoints: 143, abilities: { CHA: 14 } },
    campaignName: CAMPAIGN,
    isDicePool: true,
    dieType: 6,
    name: 'Healing Light',
    alsoCures: [],
    cureCost: 3,
    restoringTouchConditions: null,
    onClose: vi.fn(),
    ...overrides,
  };
}

async function renderModal(overrides = {}) {
  useTrackedResource.mockImplementation(() => ({ current: 21, max: 21, update: vi.fn() }));
  const rendered = render(<HealingPoolModal {...makeProps(overrides)} />);
  await waitFor(() => {
    expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();
  });
  return rendered;
}

describe('HealingPoolModal - mid-dwell target-bucket echo adoption (display-only)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockClear();
    damageUtils.getCombatContext.mockResolvedValue({
      creatures: [
        { name: HEALER, type: 'player' },
        { name: OTHER, type: 'player' },
      ],
    });
    // Sheet-truth buckets (full-store seeds ride the real store, as the App
    // hydration lane does): both chars wounded at 100 / 143.
    seedBucket(HEALER, { currentHitPoints: 100, hitPoints: 143, activeConditions: [] });
    seedBucket(OTHER, { currentHitPoints: 60, hitPoints: 112, activeConditions: [] });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    useTrackedResource.mockReset();
    damageUtils.getCombatContext.mockReset();
  });

  it('dice header re-renders from the SSE echo mid-dwell and the full-HP gate closes — no reopen, no writes', async () => {
    await renderModal();

    expect(screen.getByRole('heading', { name: /Roll Dice — CelestialWarlock \(100 \/ 143 HP\)/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Roll a d6' })).not.toBeDisabled();

    // External tab PATCHes the bucket to full (the 100→143 backlog face).
    seedBucket(HEALER, { currentHitPoints: 143, hitPoints: 143, activeConditions: [] });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Roll Dice — CelestialWarlock \(143 \/ 143 HP\)/ })).toBeInTheDocument();
    });
    // The gate that used to stay open all dwell now closes on the echo.
    expect(screen.getByRole('button', { name: 'Roll a d6' })).toBeDisabled();
    expect(screen.getByText('CelestialWarlock is already at full HP. No die spent.')).toHaveClass('healing-restriction-note');

    // Display-only subscription: the echo wake introduced ZERO store writes.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('amount header re-renders from the echo mid-dwell (same seam, amount lane)', async () => {
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [{ name: HEALER, type: 'player' }] });
    await renderModal({ isDicePool: false, name: 'Lay On Hands' });

    expect(screen.getByRole('heading', { name: /Heal — CelestialWarlock \(100 \/ 143 HP\)/ })).toBeInTheDocument();

    seedBucket(HEALER, { currentHitPoints: 138, hitPoints: 143, activeConditions: [] });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Heal — CelestialWarlock \(138 \/ 143 HP\)/ })).toBeInTheDocument();
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('chooser radio aria-label adopts the echo without closing/reopening the picker', async () => {
    damageUtils.getCombatContext.mockResolvedValue({
      creatures: [
        { name: HEALER, type: 'player', currentHp: 100, maxHp: 143 },
        { name: OTHER, type: 'player', currentHp: 60, maxHp: 112 },
      ],
    });
    // ≥2 eligible targets arms the chooser branch (showTargetSelection law).
    await renderModal({
      creatureTargets: [
        { name: HEALER, type: 'player', currentHp: 100, maxHp: 143 },
        { name: OTHER, type: 'player', currentHp: 60, maxHp: 112 },
      ],
    });

    expect(screen.getByRole('radio', { name: `Select ${OTHER}, 60 of 112 HP` })).toBeInTheDocument();

    seedBucket(OTHER, { currentHitPoints: 112, hitPoints: 112, activeConditions: [] });

    await waitFor(() => {
      expect(screen.getByRole('radio', { name: `Select ${OTHER}, 112 of 112 HP` })).toBeInTheDocument();
    });
    // Selection machine untouched by the live rows.
    fireEvent.click(screen.getByRole('radio', { name: `Select ${OTHER}, 112 of 112 HP` }));
    const healBtn = screen.getByRole('button', { name: /Heal/ });
    expect(healBtn).not.toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
