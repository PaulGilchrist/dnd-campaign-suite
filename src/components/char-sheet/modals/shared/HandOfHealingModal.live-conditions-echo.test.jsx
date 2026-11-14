// @maintained-by-ai
//
// bug-hoh-physicians-touch-stale-conditions-phantom-row — the Physician's
// Touch section of the Hand of Healing result stage previously snapshotted
// the target's activeConditions at open (useMemo with no echo subscription)
// AND had no commit-time presence guard: a press on an externally-cured
// condition still wrote the bucket (zero-delta re-POST) and logged a phantom
// `condition broken` audit row behind a false "Condition Cleared" panel.
// The fix mirrors the 82f517b26/615a7580a recipe already shipped for
// HealingPoolModal: a useRuntimeValue(target, 'activeConditions') display
// echo (options retire/appear mid-dwell) + a commit-time re-read that
// refuses with the `<Target> is not affected by <Label>.` note, zero write
// and zero log row. Auto-cure is the MOUNT law only (owner decision
// 2026-11-14, backlog KB external-cure-auto-spend): echo renders never spend
// the free touch — they re-render the picker, so one Physician's Touch per
// HoH use holds with no spent-latch needed at all (priority target #4).
//
// Like HealingPoolModal.live-conditions-echo.test.jsx this file runs the
// REAL useRuntimeState module: echoes are driven through
// setRuntimeObject(..., skipSync=true) — the exact replace + notify path a
// `change-<campaign>-<Char>` SSE adoption uses — so the subscription seam
// itself is under test. Display echoes must never POST (fetch stub counts
// the bucket writes the cure commits themselves make).

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

import * as combatData from '../../../../services/encounters/combatData.js';
import * as logService from '../../../../services/ui/logService.js';
import { setRuntimeObject, clearRuntimeState, getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

// ── Fixtures ──

const CAMPAIGN = 'test-campaign';
const MONK = 'Disciplined_Monk';
const VICTIM = 'EvasiveFighter';

const fetchMock = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));

// Live-bucket echo: the exact skipSync replace + notify path of SSE adoption —
// display-only, never POSTs.
function echoBucket(values) {
  act(() => {
    setRuntimeObject(VICTIM, values, CAMPAIGN, true);
  });
}

const victimWrites = () =>
  fetchMock.mock.calls.filter(([url]) => String(url).endsWith(`/${encodeURIComponent(VICTIM)}`));

function makeProps(overrides = {}) {
  return {
    healName: 'Hand of Healing',
    formula: '1d12 + 7',
    rolls: [10],
    bonus: 7,
    actualHeal: 17,
    monkName: MONK,
    targetName: VICTIM,
    targetCurrentHp: 96,
    targetMaxHp: 112,
    hasPhysiciansTouch: true,
    campaignName: CAMPAIGN,
    onClose: vi.fn(),
    ...overrides,
  };
}

function renderModal(overrides = {}) {
  return render(<HandOfHealingModal {...makeProps(overrides)} />);
}

const removeBtn = (name) => screen.getByRole('button', { name: new RegExp(`Remove ${name}`) });
const hasRemoveBtn = (name) => !!screen.queryByRole('button', { name: new RegExp(`Remove ${name}$`) });

// ── Tests ──

describe('HandOfHealingModal - Physician\'s Touch activeConditions echo + commit guard', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockClear();
    logService.addEntry.mockClear();
    clearRuntimeState(VICTIM);
    combatData.getCombatSummary.mockReturnValue({ creatures: [] });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearRuntimeState(VICTIM);
  });

  describe('display echo (mid-dwell adoption, no reopen)', () => {
    it('externally CURED condition retires its button live (multi → multi, zero writes)', async () => {
      echoBucket({ currentHitPoints: 96, activeConditions: ['blinded', 'stunned', 'poisoned'] });
      renderModal();

      expect(hasRemoveBtn('Blinded')).toBe(true);
      expect(hasRemoveBtn('Stunned')).toBe(true);
      expect(hasRemoveBtn('Poisoned')).toBe(true);

      // Another tab cures Blinded while the result stage dwells.
      echoBucket({ currentHitPoints: 96, activeConditions: ['stunned', 'poisoned'] });

      await waitFor(() => {
        expect(hasRemoveBtn('Blinded')).toBe(false);
      });
      expect(hasRemoveBtn('Stunned')).toBe(true);
      expect(hasRemoveBtn('Poisoned')).toBe(true);
      // Display-only: the echo itself must write nothing and log nothing.
      expect(victimWrites()).toHaveLength(0);
      expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('externally APPLIED curable condition surfaces a new button live', async () => {
      echoBucket({ currentHitPoints: 96, activeConditions: ['blinded', 'stunned'] });
      renderModal();

      expect(hasRemoveBtn('Paralyzed')).toBe(false);

      echoBucket({ currentHitPoints: 96, activeConditions: ['blinded', 'stunned', 'paralyzed'] });

      await waitFor(() => {
        expect(hasRemoveBtn('Paralyzed')).toBe(true);
      });
      expect(victimWrites()).toHaveLength(0);
      expect(logService.addEntry).not.toHaveBeenCalled();
    });

    // FLIPPED 2026-11-14 (owner decision, backlog KB "external cure can
    // auto-SPEND the unspent Physician's Touch"): this face previously pinned
    // the KB-recorded law that the auto-cure effect fires on the ECHO re-render
    // (544b9cbe2). It no longer does — auto-cure is the MOUNT law only, so a
    // foreign write shrinking the curable set to one re-renders the picker and
    // leaves the choice with the user.
    it('multi → single mid-dwell does NOT auto-cure: the surviving option stays a picker button', async () => {
      echoBucket({ currentHitPoints: 96, activeConditions: ['blinded', 'stunned'] });
      renderModal();
      expect(hasRemoveBtn('Blinded')).toBe(true);

      // Externally curing Blinded leaves a single curable condition. Unlike a
      // fresh open with one curable (which still auto-cures — see the mount
      // pin below), the echo render must NOT spend the free touch.
      echoBucket({ currentHitPoints: 96, activeConditions: ['stunned'] });

      await waitFor(() => {
        expect(hasRemoveBtn('Blinded')).toBe(false);
      });
      // The single survivor is surfaced as its own button…
      expect(hasRemoveBtn('Stunned')).toBe(true);
      // …and nothing was cured by the echo: no panel, no bucket write, no row.
      expect(screen.queryByText(/Condition Cleared/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Stunned removed/)).not.toBeInTheDocument();
      expect(getRuntimeValue(VICTIM, 'activeConditions')).toEqual(['stunned']);
      expect(victimWrites()).toHaveLength(0);
      expect(logService.addEntry).not.toHaveBeenCalled();

      // Surfaced button is still pressable and cures honestly (write + one row).
      fireEvent.click(removeBtn('Stunned'));
      await waitFor(() => {
        expect(screen.getByText(/Stunned removed from EvasiveFighter \(Physician/)).toBeInTheDocument();
      });
      expect(victimWrites()).toHaveLength(1);
      expect(getRuntimeValue(VICTIM, 'activeConditions')).toEqual([]);
      expect(logService.addEntry).toHaveBeenCalledTimes(1);
      const [campaign, entry] = logService.addEntry.mock.calls[0];
      expect(campaign).toBe(CAMPAIGN);
      expect(entry).toMatchObject({
        type: 'condition',
        characterName: VICTIM,
        condition: 'Stunned',
        action: 'broken',
        sourceName: `${MONK} (Hand of Healing)`,
      });

      // A fresh curable condition arriving afterwards must NOT grant a second
      // free cure (Priority Target #4: one Physician's Touch per HoH use).
      echoBucket({ currentHitPoints: 96, activeConditions: ['poisoned'] });
      // The echo lands untouched — nothing cured it.
      expect(getRuntimeValue(VICTIM, 'activeConditions')).toEqual(['poisoned']);
      expect(logService.addEntry).toHaveBeenCalledTimes(1);
      expect(victimWrites()).toHaveLength(1);
      expect(screen.getByText(/Stunned removed/)).toBeInTheDocument();
      expect(hasRemoveBtn('Poisoned')).toBe(false);
    });

    // MOUNT law (regression pin for the flip above): a result stage that opens
    // on a target with exactly ONE curable condition still auto-cures.
    it('mount with exactly one curable condition still auto-cures (mount law unchanged)', async () => {
      echoBucket({ currentHitPoints: 96, activeConditions: ['stunned'] });
      renderModal();

      await waitFor(() => {
        expect(screen.getByText(/Stunned removed from EvasiveFighter \(Physician/)).toBeInTheDocument();
      });
      expect(victimWrites()).toHaveLength(1);
      expect(getRuntimeValue(VICTIM, 'activeConditions')).toEqual([]);
      expect(logService.addEntry).toHaveBeenCalledTimes(1);
      expect(logService.addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
        condition: 'Stunned',
        action: 'broken',
      }));
      expect(hasRemoveBtn('Stunned')).toBe(false);
    });

    it('no curable condition at open: a mid-dwell-applied single condition surfaces as a button and never auto-cures', async () => {
      echoBucket({ currentHitPoints: 96, activeConditions: [] });
      renderModal();
      expect(screen.queryByText(/Physician/i)).not.toBeInTheDocument();

      echoBucket({ currentHitPoints: 96, activeConditions: ['poisoned'] });
      await waitFor(() => {
        expect(hasRemoveBtn('Poisoned')).toBe(true);
      });
      // Echo-arrived single: picker, not a free spend (owner decision 2026-11-14).
      expect(screen.queryByText(/Condition Cleared/)).not.toBeInTheDocument();
      expect(getRuntimeValue(VICTIM, 'activeConditions')).toEqual(['poisoned']);
      expect(victimWrites()).toHaveLength(0);
      expect(logService.addEntry).not.toHaveBeenCalled();

      // Pressing it cures once; a later arrival finds the touch spent.
      fireEvent.click(removeBtn('Poisoned'));
      await waitFor(() => {
        expect(screen.getByText(/Poisoned removed from EvasiveFighter \(Physician/)).toBeInTheDocument();
      });
      expect(logService.addEntry).toHaveBeenCalledTimes(1);

      echoBucket({ currentHitPoints: 96, activeConditions: ['paralyzed'] });
      await waitFor(() => {
        expect(getRuntimeValue(VICTIM, 'activeConditions')).toEqual(['paralyzed']);
      });
      expect(logService.addEntry).toHaveBeenCalledTimes(1);
      expect(victimWrites()).toHaveLength(1);
      expect(screen.getByText(/Poisoned removed/)).toBeInTheDocument();
      expect(screen.queryByText(/Paralyzed removed/)).not.toBeInTheDocument();
    });
  });

  describe('commit-time presence guard (stale-button race)', () => {
    it('pressing a button whose condition vanished since render refuses: zero write, zero log row, inline note', async () => {
      // Both options arrive via the combat-summary lane, which the section now
      // subscribes (KB 2026-11-14 cs-row echo) — but a stale button is still
      // deterministically held across the click by mutating the board the
      // commit-time re-read sees WITHOUT issuing the store echo that would
      // wake a re-render (the pre-echo click race). Zero runtime-curables
      // left after the refusal.
      const csBoard = { creatures: [{ name: MONK }, { name: VICTIM, conditions: [{ key: 'blinded' }, { key: 'stunned' }] }] };
      combatData.getCombatSummary.mockReturnValue(csBoard);
      echoBucket({ currentHitPoints: 96, activeConditions: [] });
      renderModal();

      expect(hasRemoveBtn('Blinded')).toBe(true);
      expect(hasRemoveBtn('Stunned')).toBe(true);

      // External cure of both cs-sourced conditions before the click lands.
      csBoard.creatures[1].conditions = [];
      fireEvent.click(removeBtn('Stunned'));

      // Honest refusal in the `<Target> is not affected by <Label>.` family…
      const note = screen.getByText('EvasiveFighter is not affected by Stunned.');
      expect(note).toHaveClass('healing-restriction-note');
      // …with zero state delta, zero bucket write and zero audit row.
      expect(getRuntimeValue(VICTIM, 'activeConditions')).toEqual([]);
      expect(victimWrites()).toHaveLength(0);
      expect(logService.addEntry).not.toHaveBeenCalled();
      expect(screen.queryByText(/Condition Cleared/)).not.toBeInTheDocument();
      // The other stale option is retired with the section — no buttons left.
      expect(hasRemoveBtn('Blinded')).toBe(false);
    });

    it('control: pressing a button for a still-present condition cures honestly (write + one broken row)', async () => {
      echoBucket({ currentHitPoints: 96, activeConditions: ['blinded', 'stunned'] });
      renderModal();

      fireEvent.click(removeBtn('Blinded'));

      await waitFor(() => {
        expect(screen.getByText(/Blinded removed from EvasiveFighter \(Physician/)).toBeInTheDocument();
      });
      expect(getRuntimeValue(VICTIM, 'activeConditions')).toEqual(['stunned']);
      expect(victimWrites()).toHaveLength(1);
      expect(logService.addEntry).toHaveBeenCalledTimes(1);
      expect(logService.addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
        type: 'condition',
        characterName: VICTIM,
        condition: 'Blinded',
        action: 'broken',
        sourceName: `${MONK} (Hand of Healing)`,
      }));
      expect(screen.queryByText(/is not affected by/)).not.toBeInTheDocument();
    });
  });
});
