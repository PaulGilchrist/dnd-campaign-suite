// @maintained-by-ai
//
// improve cure-conditions-echo (backlog 2026-11-14 HZ) — the Cure Conditions
// sections (both tiers) previously snapshotted the target's activeConditions
// at open: an externally applied condition mid-dwell stayed invisible until
// close/reopen and an externally CURED one left a stale clickable button
// (UI saying something untrue, harmless post-615a7580a only because the
// commit guard refuses honestly). The modal now subscribes
// useRuntimeValue(target, 'activeConditions') alongside the HP subscriptions
// (20bed3215 seam), so every echo re-runs getTargetConditions →
// buildCurableEntries: curable button.char-btn entries appear/retire live,
// the whole section retires when the last entry goes, selectedConditions
// prunes with them, and re-selecting a target re-anchors the sections.
//
// This file deliberately runs the REAL useRuntimeState module (same harness as
// HealingPoolModal.live-hp-echo.test.jsx): the echo is driven through
// setRuntimeObject(..., skipSync=true) — the exact replace + notify path
// applyStoreUpdate uses when it adopts a `change-<campaign>-<Char>` SSE echo —
// so the subscription seam itself is under test. Display-only: no store write
// may fire mid-dwell (asserted via the fetch stub).

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
    { key: 'charmed', label: 'Charmed' },
    { key: 'poisoned', label: 'Poisoned' },
    { key: 'frightened', label: 'Frightened' },
  ],
}));

// ── Re-imports ──

import useTrackedResource from '../../../../hooks/runtime/useTrackedResource.js';
import * as damageUtils from '../../../../services/rules/combat/damageUtils.js';
import { setRuntimeObject, clearRuntimeState } from '../../../../hooks/runtime/useRuntimeState.js';

// ── Fixtures ──

const CAMPAIGN = 'test-campaign';
const HEALER = 'ElderPaladin';
const OTHER = 'EvasiveFighter';

const fetchMock = vi.fn(() => Promise.reject(new Error('no network in test')));

function seedBucket(name, values) {
  act(() => {
    setRuntimeObject(name, values, CAMPAIGN, true); // skipSync — echo path, never POSTs
  });
}

function makeProps(overrides = {}) {
  return {
    playerStats: { name: HEALER, level: 20, hitPoints: 224, abilities: { CHA: 18 } },
    campaignName: CAMPAIGN,
    isDicePool: false,
    name: 'Lay On Hands',
    alsoCures: ['Blinded', 'Poisoned'],
    cureCost: 5,
    restoringTouchConditions: null,
    onClose: vi.fn(),
    ...overrides,
  };
}

async function renderModal(overrides = {}) {
  useTrackedResource.mockImplementation(() => ({ current: 100, max: 100, update: vi.fn() }));
  const rendered = render(<HealingPoolModal {...makeProps(overrides)} />);
  await waitFor(() => {
    expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();
  });
  return rendered;
}

const cureBtn = (name) => screen.getByRole('button', { name });
const batchBtn = () => screen.getByRole('button', { name: /^Cure Selected/ });

// ── Tests ──

describe('HealingPoolModal - mid-dwell activeConditions echo adoption (cure sections)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockClear();
    clearRuntimeState(HEALER);
    clearRuntimeState(OTHER);
    damageUtils.getCombatContext.mockResolvedValue({
      creatures: [
        { name: HEALER, type: 'player' },
        { name: OTHER, type: 'player' },
      ],
    });
    seedBucket(HEALER, { currentHitPoints: 224, hitPoints: 224, activeConditions: ['blinded'] });
    seedBucket(OTHER, { currentHitPoints: 100, hitPoints: 112, activeConditions: [] });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    useTrackedResource.mockReset();
    damageUtils.getCombatContext.mockReset();
    clearRuntimeState(HEALER);
    clearRuntimeState(OTHER);
  });

  describe('SINGLE tier (alsoCures, no Restoring Touch)', () => {
    it('externally APPLIED condition appears as a live button.char-btn entry — no reopen, no writes', async () => {
      await renderModal();

      expect(cureBtn('Blinded')).toHaveClass('char-btn');
      expect(screen.queryByRole('button', { name: 'Poisoned' })).not.toBeInTheDocument();

      // External tab applies Poisoned to the target mid-dwell (full-bucket echo).
      seedBucket(HEALER, { currentHitPoints: 224, hitPoints: 224, activeConditions: ['blinded', 'poisoned'] });

      await waitFor(() => {
        expect(cureBtn('Poisoned')).toHaveClass('char-btn');
      });
      expect(cureBtn('Blinded')).toBeInTheDocument();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('externally CURED condition loses its stale button; the whole section retires when the last entry goes', async () => {
      await renderModal();
      expect(cureBtn('Blinded')).toBeInTheDocument();

      // Another tab cures the condition while the modal dwells open.
      seedBucket(HEALER, { currentHitPoints: 224, hitPoints: 224, activeConditions: [] });

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'Blinded' })).not.toBeInTheDocument();
      });
      // No stale section, heading, or buttons survive the last entry leaving.
      expect(screen.queryByText(/Cure Conditions/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Select conditions affecting/)).not.toBeInTheDocument();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('BATCH tier (Restoring Touch)', () => {
    it('entries appear and retire live and a selected-but-externally-cured condition is pruned from the batch', async () => {
      await renderModal({ alsoCures: [], restoringTouchConditions: ['Blinded', 'Poisoned', 'Charmed'] });

      expect(cureBtn('Blinded')).toBeInTheDocument();
      fireEvent.click(cureBtn('Blinded'));
      expect(batchBtn()).toHaveTextContent('Cure Selected (1 for 5 HP)');

      // External tab applies Charmed AND cures the selected Blinded mid-dwell.
      seedBucket(HEALER, { currentHitPoints: 224, hitPoints: 224, activeConditions: ['charmed'] });

      await waitFor(() => {
        expect(cureBtn('Charmed')).toBeInTheDocument();
      });
      expect(screen.queryByRole('button', { name: 'Blinded' })).not.toBeInTheDocument();
      // Selection-pruning effect keeps the batch in step with the live entries.
      expect(batchBtn()).toHaveTextContent('Cure Selected (0 for 0 HP)');
      expect(batchBtn()).toBeDisabled();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('section mounts from nothing when the first condition is applied externally (absent → live, no reopen)', async () => {
      seedBucket(HEALER, { currentHitPoints: 224, hitPoints: 224, activeConditions: [] });
      await renderModal({ alsoCures: [], restoringTouchConditions: ['Blinded', 'Poisoned'] });

      expect(screen.queryByText(/Cure Conditions/)).not.toBeInTheDocument();

      seedBucket(HEALER, { currentHitPoints: 224, hitPoints: 224, activeConditions: ['poisoned'] });

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 4, name: 'Cure Conditions (5 HP each)' })).toBeInTheDocument();
      });
      expect(cureBtn('Poisoned')).toBeInTheDocument();
      expect(screen.getByText('Select conditions affecting ElderPaladin to cure:')).toBeInTheDocument();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('target re-selection re-anchors the cure sections', () => {
    async function selectTarget(name) {
      fireEvent.click(await screen.findByRole('radio', { name: new RegExp(`^Select ${name},`) }));
      fireEvent.click(screen.getByRole('button', { name: 'Heal' }));
    }

    it('sections follow the NEW target: its live echoes render, old target entries never linger, old target writes do not echo', async () => {
      seedBucket(HEALER, { currentHitPoints: 224, hitPoints: 224, activeConditions: ['blinded'] });
      seedBucket(OTHER, { currentHitPoints: 100, hitPoints: 112, activeConditions: ['poisoned'] });

      // ≥2 eligible targets arms the chooser branch (showTargetSelection law).
      await renderModal({
        alsoCures: ['Blinded', 'Poisoned', 'Charmed', 'Frightened'],
        creatureTargets: [
          { name: HEALER, type: 'player', currentHp: 224, maxHp: 224 },
          { name: OTHER, type: 'player', currentHp: 100, maxHp: 112 },
        ],
      });
      await selectTarget(OTHER);

      // Anchored to the NEW target: its entry renders, the previous target's does not.
      await waitFor(() => {
        expect(cureBtn('Poisoned')).toBeInTheDocument();
      });
      expect(screen.queryByRole('button', { name: 'Blinded' })).not.toBeInTheDocument();

      // External write to the OLD target must not leak into the new target's section.
      seedBucket(HEALER, { currentHitPoints: 224, hitPoints: 224, activeConditions: ['blinded', 'charmed'] });
      expect(screen.queryByRole('button', { name: 'Blinded' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Charmed' })).not.toBeInTheDocument();

      // External write to the NEW target echoes live.
      seedBucket(OTHER, { currentHitPoints: 100, hitPoints: 112, activeConditions: ['poisoned', 'frightened'] });
      await waitFor(() => {
        expect(cureBtn('Frightened')).toBeInTheDocument();
      });
      // And an external cure of the NEW target's entries retires the whole section.
      seedBucket(OTHER, { currentHitPoints: 100, hitPoints: 112, activeConditions: [] });
      await waitFor(() => {
        expect(screen.queryByText(/Cure Conditions/)).not.toBeInTheDocument();
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
