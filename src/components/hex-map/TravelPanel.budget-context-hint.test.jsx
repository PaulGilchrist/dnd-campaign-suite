// @maintained-by-ai
/*
 * TravelPanel — spent-day budget-context hint (backlog 2026-10-27-M).
 *
 * Live defect: accruedCost survives arrival/cancel BY DESIGN (same-day trips
 * share the day's budget pool), so a freshly planned trip on an already-spent
 * day reject-flags the exhausted banner ("Travel budget exhausted — camp or
 * forced march?") with no hint that the accrual belongs to an EARLIER trip —
 * the advance loop looked dead until the change-data keys were read.
 *
 * Pinned contract:
 * - while the exhausted banner is up (dayExhausted), a `.travel-budget-hint`
 *   line names the day's actual numbers (`accrued / budget used today`);
 * - the "carried from earlier trips today" clause appears ONLY when the
 *   latch saw accrued > 0 when the CURRENT trip started (mount adopt at
 *   pathIndex 0, or the path empty→non-empty plan flip) and that carry is
 *   still inside today's accrual — a day ground down by the trip's OWN
 *   advances shows numbers without the carry claim;
 * - the banner lane is untouched: copy, Camp/Forced-March buttons, disabled
 *   Advance coexistence (a6cf65f52 mount-flag lane), and the sibling
 *   `.travel-panel-hint` lanes all keep rendering.
 *
 * Lane map: the mount-flag producer itself is pinned by
 * useTravelManagement.day-exhausted-init.test.js; the advance reject-and-flag
 * lane by the HexMap travel tests. This file owns the panel's hint render.
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TravelPanel from './TravelPanel.jsx';

const PATH = [
  { q: 0, r: 0 },
  { q: 1, r: 0 },
  { q: 2, r: 0 },
];

const CARRY_SUFFIX = ' — carried from earlier trips today';

const makeProps = (overrides = {}) => ({
  travelPace: 'normal',
  path: PATH,
  pathIndex: 0,
  accruedCost: 0,
  dailyBudget: 4,
  dayExhausted: false,
  lastMessage: null,
  hexesRemaining: 3,
  isTravelActive: true,
  pendingEvent: null,
  terrain: { '0,0': 'plains' },
  eventFrequency: 'normal',
  showOwnHexHint: false,
  onChangePace: vi.fn(),
  onAdvance: vi.fn(),
  onCancel: vi.fn(),
  onForceCamp: vi.fn(),
  onForcedMarch: vi.fn(),
  weather: null,
  onReRollWeather: vi.fn(),
  onSetEventFrequency: vi.fn(),
  horseback: false,
  onToggleHorseback: vi.fn(),
  forcedMarchHours: 0,
  exhaustionMultiplier: 100,
  partyHasMaxExhaustion: false,
  ...overrides,
});

const renderPanel = (overrides = {}) => {
  const props = makeProps(overrides);
  const utils = render(<TravelPanel {...props} />);
  return { props, ...utils };
};

const hintSpan = () => document.querySelector('.travel-panel-hint.travel-budget-hint span');

describe('TravelPanel — spent-day budget-context hint', () => {
  describe('carried-over context (accrued > 0 when the trip starts)', () => {
    it('mount-adopt of a just-planned trip on a spent day names numbers + carry wording', () => {
      // Criterion 1 + reopen lane: panel (re)mounts with a live trip at
      // pathIndex 0 while the mount-flag banner is already up — the whole
      // 3.4 accrual belongs to earlier trips today (this trip never advanced).
      renderPanel({ accruedCost: 3.4, dailyBudget: 4, dayExhausted: true });
      const hint = document.querySelector('.travel-budget-hint');
      expect(hint).not.toBeNull();
      expect(hintSpan().textContent).toBe(`3.4 / 4 used today${CARRY_SUFFIX}`);
    });

    it('plan flip (empty path → route) latches the carried accrual', () => {
      // Open panel on a spent-but-unplanned day, then set a destination:
      // the moment the route appears, accrued 1.5 predates this trip.
      const { rerender } = renderPanel({ path: [], hexesRemaining: 0, accruedCost: 1.5, dayExhausted: true });
      // No trip yet → numbers only, never a carry claim.
      expect(hintSpan().textContent).toBe('1.5 / 4 used today');
      rerender(<TravelPanel {...makeProps({ accruedCost: 1.5, dayExhausted: true })} />);
      expect(hintSpan().textContent).toBe(`1.5 / 4 used today${CARRY_SUFFIX}`);
    });

    it('carry wording survives this trip advancing (its own hexes add on top)', () => {
      const { rerender } = renderPanel({ accruedCost: 1.5, dayExhausted: true });
      rerender(<TravelPanel {...makeProps({ pathIndex: 1, accruedCost: 2.6, dayExhausted: true })} />);
      expect(hintSpan().textContent).toBe(`2.6 / 4 used today${CARRY_SUFFIX}`);
    });
  });

  describe('fresh-day control (this trip spent the day itself)', () => {
    it('mount mid-trip never claims a carry', () => {
      // pathIndex > 0 at mount: the accrual may be entirely this trip's own.
      renderPanel({ pathIndex: 2, accruedCost: 4.5, dayExhausted: true });
      expect(hintSpan().textContent).toBe('4.5 / 4 used today');
    });

    it('plan on an unspent day (accrued 0) latches nothing — banner shows numbers only', () => {
      const { rerender } = renderPanel({ path: [], hexesRemaining: 0, accruedCost: 0 });
      rerender(<TravelPanel {...makeProps({ accruedCost: 0 })} />);
      // This trip's own advances then grind the day out (reject-and-flag).
      rerender(<TravelPanel {...makeProps({ pathIndex: 2, accruedCost: 4.5, dayExhausted: true })} />);
      const hint = document.querySelector('.travel-budget-hint');
      expect(hint).not.toBeNull();
      expect(hintSpan().textContent).toBe('4.5 / 4 used today');
    });

    it('drops the carry claim after a camp/regen wipes the carried accrual', () => {
      const { rerender } = renderPanel({ accruedCost: 3.4, dayExhausted: true });
      expect(hintSpan().textContent).toBe(`3.4 / 4 used today${CARRY_SUFFIX}`);
      // New day: accrued reset below the stale latch — claim must not survive.
      rerender(<TravelPanel {...makeProps({ pathIndex: 1, accruedCost: 0.8, dayExhausted: true })} />);
      expect(hintSpan().textContent).toBe('0.8 / 4 used today');
    });
  });

  describe('banner lane regression (criterion 3)', () => {
    it('coexists with the untouched banner copy, Camp/Forced-March, and disabled Advance', () => {
      renderPanel({ accruedCost: 3.4, dayExhausted: true });
      expect(screen.getByText('Travel budget exhausted — camp or forced march?')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Camp' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Forced March' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Advance One Hex' })).toBeDisabled();
      // Mount-flag lane (a6cf65f52): banner up with an un-advanced route.
      expect(document.querySelector('.travel-panel-exhausted')).not.toBeNull();
    });

    it('is absent while the day still travels (no banner, no hint)', () => {
      renderPanel({ accruedCost: 1.5 });
      expect(document.querySelector('.travel-budget-hint')).toBeNull();
    });

    it('stacks with the sibling max-exhaustion hint lane without clobbering it', () => {
      renderPanel({ accruedCost: 3.4, dayExhausted: true, partyHasMaxExhaustion: true });
      const hints = [...document.querySelectorAll('.travel-panel-hint')];
      expect(hints).toHaveLength(2);
      expect(screen.getByText('A party member is at maximum exhaustion — rest required')).toBeInTheDocument();
      expect(hintSpan().textContent).toBe(`3.4 / 4 used today${CARRY_SUFFIX}`);
      // FM stays disabled-with-tooltip at max exhaustion beside the new hint.
      const march = screen.getByRole('button', { name: 'Forced March' });
      expect(march).toBeDisabled();
      expect(march).toHaveAttribute('title', 'Cannot forced march — a party member has reached maximum exhaustion');
    });
  });
});
