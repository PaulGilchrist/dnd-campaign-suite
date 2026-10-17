// @maintained-by-ai
// @improved-by-ai
// Close-behavior seam: AttackResultPopup owns WHICH close control the popup shows
// and WHAT each close path does. The contract is behavioral:
//   • auto-damage hit  → DiceRollResult's own Done dispatches dice-roll-done
//     (autoDamage payload unmodified) and then closes; the footer close is suppressed
//     so exactly one Done exists.
//   • any other state  → the plain footer Done closes WITHOUT dispatching
//     (no auto-damage to apply), including auto-damage that became an auto-miss.
//   • damage-type choices act as the Done click, merging the chosen type into the
//     autoDamage payload before dispatch.
//   • offer clicks (Stroke of Luck / Boon) never close the popup or dispatch —
//     only Done closes. The popup is fully synchronous: no timers, no clock.
// Vision/label visibility of the offers is covered by the stroke-of-luck and
// bi-defense sibling files; this file pins only the close paths.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AttackResultPopup from './AttackResultPopup.jsx';

// ── Mock dependencies ──
// Network/SSE boundaries only (store + log); rendering of DiceRollResult and the
// boon-locked consult stay real so the popup seam is exercised end to end.

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

const AUTO_DAMAGE = { name: 'Test Attack', formula: '1d8 + 3', damageType: 'Force', source: 'PlayerOne' };

function attackPopup(overrides = {}) {
  return {
    name: 'Test Attack',
    type: 'd20',
    rollType: 'attack',
    rolls: [18],
    bonus: 3,
    hit: true,
    ...overrides,
  };
}

// ── Helpers ──

let onClose = null;

function renderPopup(popupHtml, props = {}) {
  onClose = vi.fn();
  return render(
    <AttackResultPopup
      popupHtml={popupHtml}
      onClose={onClose}
      campaignName="test-campaign"
      attackerName="PlayerOne"
      setPopupHtml={vi.fn()}
      {...props}
    />
  );
}

let captured = [];
let removeCapture = null;

function clickDone() {
  fireEvent.click(screen.getByRole('button', { name: /Done/i }));
}

// ── Tests ──

describe('AttackResultPopup close behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    captured = [];
    const handler = (e) => captured.push(e.detail);
    window.addEventListener('dice-roll-done', handler);
    removeCapture = () => window.removeEventListener('dice-roll-done', handler);
  });

  afterEach(() => {
    removeCapture();
    removeCapture = null;
  });

  // ── Auto-damage hit: the popup's own Done dispatches, then closes ──

  describe('auto-damage hit', () => {
    it('shows exactly one Done button (footer close suppressed) and dispatches nothing until clicked', () => {
      renderPopup(attackPopup({ autoDamage: AUTO_DAMAGE }));

      // One Done means DiceRollResult's action button replaced the footer close —
      // a regression in showCloseButton={!showsOwnDone} would render a second Done.
      expect(screen.getAllByRole('button', { name: /Done/i })).toHaveLength(1);
      expect(captured).toHaveLength(0);

      clickDone();
      expect(captured).toHaveLength(1);
    });

    it('clicking Done dispatches dice-roll-done once with the autoDamage payload unmodified, then closes', () => {
      renderPopup(attackPopup({ autoDamage: AUTO_DAMAGE, isCrit: true }));

      clickDone();

      expect(captured).toHaveLength(1);
      expect(captured[0]).toEqual({ autoDamage: AUTO_DAMAGE, isCrit: true, hit: true });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('a damage-type choice acts as the Done click, merging the chosen type into the payload', () => {
      renderPopup(attackPopup({
        autoDamage: { ...AUTO_DAMAGE, damageTypeChoices: ['Piercing', 'Radiant'] },
      }));

      fireEvent.click(screen.getByRole('button', { name: 'Radiant' }));

      expect(captured).toHaveLength(1);
      // Chosen type overrides the base type; formula/name/source ride along unchanged
      // (damageTypeChoices is carried through the spread — transport metadata only).
      expect(captured[0].autoDamage).toMatchObject({ ...AUTO_DAMAGE, damageType: 'Radiant' });
      expect(captured[0].hit).toBe(true);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  // ── Non-dispatching close paths: footer Done only closes ──

  describe('footer Done (no auto-damage to apply)', () => {
    it.each([
      { label: 'hit', popup: attackPopup({ hit: true }) },
      { label: 'miss', popup: attackPopup({ rolls: [3], hit: false }) },
    ])('closes on Done without dispatching dice-roll-done ($label)', ({ popup }) => {
      renderPopup(popup);

      clickDone();

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(captured).toHaveLength(0);
    });

    it('closes on Done without dispatching when auto-damage was overridden to an auto-miss', () => {
      // BI-defense can rewrite a hit into { hit: false, isAutoMiss: true } while
      // keeping autoDamage — nothing may auto-apply on close.
      renderPopup(attackPopup({ hit: false, isAutoMiss: true, autoDamage: AUTO_DAMAGE }));

      clickDone();

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(captured).toHaveLength(0);
    });
  });

  // ── Miss converted to hit: Done dispatches on the converted hit ──

  describe('miss converted to hit via Boon of Combat Prowess', () => {
    it('the boon click neither closes nor dispatches; Done then dispatches the hit and closes', () => {
      renderPopup(attackPopup({ rolls: [3], hit: false, autoDamage: AUTO_DAMAGE, autoRerollForAttack: true }));

      fireEvent.click(screen.getByRole('button', { name: /Boon of Combat Prowess/i }));

      // Conversion alone must not close the popup or pay out damage.
      expect(onClose).not.toHaveBeenCalled();
      expect(captured).toHaveLength(0);

      clickDone();

      expect(captured).toHaveLength(1);
      expect(captured[0]).toEqual({ autoDamage: AUTO_DAMAGE, isCrit: undefined, hit: true });
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
