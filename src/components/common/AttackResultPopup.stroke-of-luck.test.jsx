// @improved-by-ai
// Stroke-of-luck seam: AttackResultPopup owns WHICH miss→hit converters
// (Stroke of Luck, Boon of Combat Prowess) get wired to its host callback,
// WHICH featureKey each offer routes (so the host charges the right resource),
// and that one converted attack pays out EXACTLY ONCE — the popup threads
// hit=true into DiceRollResult after any conversion, so the unused second
// offer unmounts and can never route a second spend.
// Deliberately NOT repeated here (sibling files own those seams):
//   • rendering     — branch selection, boon miss→hit line flip, FT-007 round latch
//   • close-behavior— Done paths + dice-roll-done dispatch after conversion
//   • DiceRollResult.* — component-internal offer gates, stroke reroll display
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AttackResultPopup from './AttackResultPopup.jsx';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

// ── Mock dependencies ──
// Network/SSE boundaries only (store + log); the sanitizer passthrough keeps
// the string branch inert. DiceRollResult and the FT-007 latch consult stay
// real so offers are exercised end to end at the popup seam.

vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// ── Fixtures ──
// 3 + 3 = 6 vs AC 15 → MISS. Target fields are REQUIRED for this seam:
// without targetName/rollType the ✓/✗ outcome line never renders, so the
// popup's miss→hit override would be unobservable.

const CAMPAIGN = 'test-campaign';

function missPopup(overrides = {}) {
  return {
    name: 'Test Attack',
    type: 'd20',
    rollType: 'attack',
    rolls: [3],
    bonus: 3,
    targetName: 'Goblin',
    targetAc: 15,
    hit: false,
    ...overrides,
  };
}

function renderPopup(popupHtml, props = {}) {
  return render(
    <AttackResultPopup
      popupHtml={popupHtml}
      onClose={vi.fn()}
      campaignName={CAMPAIGN}
      attackerName="PlayerOne"
      setPopupHtml={vi.fn()}
      {...props}
    />
  );
}

const strokeButton = () => screen.queryByRole('button', { name: /^Stroke of Luck$/i });
const boonButton = () => screen.queryByRole('button', { name: /Boon of Combat Prowess/i });

// ── Tests ──

describe('AttackResultPopup — miss-to-hit offers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(null); // FT-007 latch: boon never spent this round
  });

  describe('offer visibility', () => {
    it('offers both converters on a failed attack when both flags are set', () => {
      renderPopup(missPopup({ strokeOfLuck: true, autoRerollForAttack: true }));

      expect(strokeButton()).toBeInTheDocument();
      expect(boonButton()).toBeInTheDocument();
      // Nothing adjudicated yet: no conversion receipts on screen.
      expect(screen.queryByText(/Stroke of Luck:/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Miss converted to Hit/i)).not.toBeInTheDocument();
    });

    it('offers no converter on a hitting attack even when both flags are set', () => {
      // rolls 18 + 3 = 21 vs AC 15 — a numerically consistent hit so the
      // popup's own recompute also reports HIT (offers gate on failure).
      renderPopup(missPopup({ rolls: [18], hit: true, strokeOfLuck: true, autoRerollForAttack: true }));

      expect(strokeButton()).not.toBeInTheDocument();
      expect(boonButton()).not.toBeInTheDocument();
    });
  });

  describe('click routing', () => {
    it('routes Stroke of Luck as strokeOfLuck exactly once and keeps the popup open', () => {
      const onStrokeOfLuck = vi.fn();
      const onClose = vi.fn();
      renderPopup(missPopup({ strokeOfLuck: true }), { onStrokeOfLuck, onClose });

      fireEvent.click(strokeButton());

      // The featureKey is the popup's contract: it tells the host which
      // resource to charge. A generic (once) assertion would pass if the
      // popup mislabeled the spend as the boon.
      expect(onStrokeOfLuck).toHaveBeenCalledTimes(1);
      expect(onStrokeOfLuck).toHaveBeenCalledWith('strokeOfLuck');
      expect(onClose).not.toHaveBeenCalled();
    });

    it('routes Boon of Combat Prowess as boonOfCombatProwess exactly once and keeps the popup open', () => {
      const onStrokeOfLuck = vi.fn();
      const onClose = vi.fn();
      renderPopup(missPopup({ autoRerollForAttack: true }), { onStrokeOfLuck, onClose });

      fireEvent.click(boonButton());

      expect(onStrokeOfLuck).toHaveBeenCalledTimes(1);
      expect(onStrokeOfLuck).toHaveBeenCalledWith('boonOfCombatProwess');
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('one conversion per attack', () => {
    // Popup-owned: the popup reports hit=true into DiceRollResult after ANY
    // conversion, which unmounts BOTH offered converters. If the popup ever
    // stops overriding hit, the second offer survives and this fails.
    it.each([
      { first: 'Stroke of Luck', firstKey: 'strokeOfLuck', second: 'Boon of Combat Prowess' },
      { first: 'Boon of Combat Prowess', firstKey: 'boonOfCombatProwess', second: 'Stroke of Luck' },
    ])('using $first first consumes the attack — $second can never route a second spend', ({ first, firstKey, second }) => {
      const onStrokeOfLuck = vi.fn();
      renderPopup(missPopup({ strokeOfLuck: true, autoRerollForAttack: true }), { onStrokeOfLuck });

      const buttonFor = (label) => (label === 'Stroke of Luck' ? strokeButton() : boonButton());
      fireEvent.click(buttonFor(first));
      // If the surviving second offer is still mounted, try the double-spend
      // (a real defect to catch); otherwise there is nothing left to click.
      if (buttonFor(second)) fireEvent.click(buttonFor(second));

      expect(onStrokeOfLuck).toHaveBeenCalledTimes(1);
      expect(onStrokeOfLuck).toHaveBeenCalledWith(firstKey);
      expect(buttonFor(second)).not.toBeInTheDocument();
    });

    it('reports Stroke of Luck as an authoritative hit even when the boosted 20 still fails AC', () => {
      // popup-owned missToHitApplied override: 20 + 3 = 23 < AC 25 would
      // compute a miss from the roll data alone — only the popup's hit=true
      // override can flip this line (the rendering sibling covers the boon).
      renderPopup(missPopup({ strokeOfLuck: true, targetAc: 25 }));

      fireEvent.click(strokeButton());

      expect(screen.getByText('✓ HIT (23 vs AC 25)')).toBeInTheDocument();
      expect(screen.getByText(/20 \(Stroke of Luck\)/)).toBeInTheDocument();
    });
  });
});
