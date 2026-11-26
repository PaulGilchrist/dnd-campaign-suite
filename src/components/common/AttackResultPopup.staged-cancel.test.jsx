// @maintained-by-ai 2026-11-11
// @improved-by-ai
// Staged-damage guard seam (hit-popup-backdrop-void-guard, 2026-11-11; the
// shared-Popup dismissal law of 2026-11-16 routes dismissable={false} exactly
// at this face). While a HIT popup stages Done-gated damage, the backdrop AND
// Escape must never dismiss it and the staged damage must never void silently.
// Pins:
//   • backdrop click with staged damage → popup stays open, onClose NOT called,
//     zero dice-roll-done dispatches; a later Done applies normally.
//   • Escape with staged damage → equally inert (no plain-onClose void).
//   • the explicit "Cancel attack" row logs an honest attack_cancelled row
//     (naming the attack) and closes with ZERO dice-roll-done dispatches.
//   • nothing staged → footer Done, no Cancel row, "click to dismiss" hint —
//     and the hint is now TRUE: Escape/pure backdrop route to the same
//     close-only handler Done already uses (zero dispatch, zero log rows).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AttackResultPopup from './AttackResultPopup.jsx';
import { addEntry } from '../../services/ui/logService.js';

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

const AUTO_DAMAGE = { name: 'Scimitar', formula: '1d6 + 2', damageType: 'Slashing', source: 'Goblin 1', targetName: 'Wild_Sage_Druid' };

function attackPopup(overrides = {}) {
  return {
    name: 'Scimitar',
    type: 'd20',
    rollType: 'attack',
    rolls: [18],
    bonus: 3,
    hit: true,
    ...overrides,
  };
}

let onClose = null;

function renderPopup(popupHtml, props = {}) {
  onClose = vi.fn();
  return render(
    <AttackResultPopup
      popupHtml={popupHtml}
      onClose={onClose}
      campaignName="test-campaign"
      attackerName="Goblin 1"
      setPopupHtml={vi.fn()}
      {...props}
    />
  );
}

let captured = [];
let removeCapture = null;

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

describe('AttackResultPopup staged-damage guard', () => {
  describe('backdrop with staged damage', () => {
    it('does NOT dismiss: backdrop click leaves the popup open, closes nothing, dispatches nothing', () => {
      renderPopup(attackPopup({ autoDamage: AUTO_DAMAGE }));

      fireEvent.click(screen.getByTestId('popup-overlay'));

      expect(onClose).not.toHaveBeenCalled();
      expect(captured).toHaveLength(0);
      expect(addEntry).not.toHaveBeenCalled();
      // The staged popup is still fully mounted with both exits.
      expect(screen.getByRole('button', { name: /Done/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Cancel attack/i })).toBeInTheDocument();
    });

    it('pressing Done after a backdrop click still applies the damage (one dispatch, then close)', () => {
      renderPopup(attackPopup({ autoDamage: AUTO_DAMAGE }));

      fireEvent.click(screen.getByTestId('popup-overlay'));
      fireEvent.click(screen.getByRole('button', { name: /Done/i }));

      expect(captured).toHaveLength(1);
      expect(captured[0]).toEqual({ autoDamage: AUTO_DAMAGE, isCrit: undefined, hit: true });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('pressing Escape is equally inert: no silent void of the staged damage', () => {
      renderPopup(attackPopup({ autoDamage: AUTO_DAMAGE }));

      fireEvent.keyDown(screen.getByTestId('popup-overlay').querySelector('.popup-modal'), { key: 'Escape' });

      expect(onClose).not.toHaveBeenCalled();
      expect(captured).toHaveLength(0);
      expect(addEntry).not.toHaveBeenCalled();
      // Both honest exits still mounted, and a later Done still applies.
      expect(screen.getByRole('button', { name: /Cancel attack/i })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /Done/i }));
      expect(captured).toHaveLength(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('a full mousedown+click on the backdrop is inert too (useModalDismiss drag law cannot fire)', () => {
      renderPopup(attackPopup({ autoDamage: AUTO_DAMAGE }));

      const overlay = screen.getByTestId('popup-overlay');
      fireEvent.mouseDown(overlay);
      fireEvent.click(overlay);

      expect(onClose).not.toHaveBeenCalled();
      expect(captured).toHaveLength(0);
      expect(addEntry).not.toHaveBeenCalled();
    });

    it('shows no "click to dismiss" hint on the staged face (the hint would lie)', () => {
      renderPopup(attackPopup({ autoDamage: AUTO_DAMAGE }));
      expect(screen.queryByText('click to dismiss')).not.toBeInTheDocument();
    });
  });

  describe('explicit Cancel attack', () => {
    it('logs an honest attack_cancelled row naming the attack and closes with zero damage dispatch', () => {
      renderPopup(attackPopup({ autoDamage: AUTO_DAMAGE }));

      fireEvent.click(screen.getByRole('button', { name: /Cancel attack/i }));

      expect(addEntry).toHaveBeenCalledTimes(1);
      const [campaign, entry] = addEntry.mock.calls[0];
      expect(campaign).toBe('test-campaign');
      expect(entry).toMatchObject({
        type: 'automation',
        automationType: 'attack_cancelled',
        reason: 'staged_damage_cancelled',
        characterName: 'Goblin 1',
        abilityName: 'Scimitar',
      });
      expect(entry.description).toContain('Scimitar');
      expect(entry.description).toContain('Wild_Sage_Druid');
      // Zero damage applied — nothing rides the dice-roll-done lane.
      expect(captured).toHaveLength(0);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('nothing staged (dismissal-safe face)', () => {
    it('plain hit popup: no Cancel row, footer Done present, dismiss hint stays and is TRUE', () => {
      renderPopup(attackPopup());

      expect(screen.queryByRole('button', { name: /Cancel attack/i })).not.toBeInTheDocument();
      expect(screen.getByText('click to dismiss')).toBeInTheDocument();

      // Pure backdrop click closes via the SAME close-only handler the footer
      // Done uses — zero dice-roll-done dispatch, zero attack_cancelled rows.
      const overlay = screen.getByTestId('popup-overlay');
      fireEvent.mouseDown(overlay);
      fireEvent.click(overlay);
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(captured).toHaveLength(0);
      expect(addEntry).not.toHaveBeenCalled();

      // Footer Done likewise closes without dispatch or a cancel row.
      onClose.mockClear();
      fireEvent.click(screen.getByRole('button', { name: /Done/i }));
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(captured).toHaveLength(0);
      expect(addEntry).not.toHaveBeenCalled();
    });

    it('plain hit popup: Escape closes with zero dispatch and zero log rows', () => {
      renderPopup(attackPopup());

      fireEvent.keyDown(screen.getByTestId('popup-overlay').querySelector('.popup-modal'), { key: 'Escape' });

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(captured).toHaveLength(0);
      expect(addEntry).not.toHaveBeenCalled();
    });

    it('a drag that started inside the panel never dismisses', () => {
      renderPopup(attackPopup());

      fireEvent.mouseDown(screen.getByTestId('popup-overlay').querySelector('.popup-modal'));
      fireEvent.click(screen.getByTestId('popup-overlay'));

      expect(onClose).not.toHaveBeenCalled();
      expect(captured).toHaveLength(0);
    });

    it('string refusal face (no pending apply): Done still exits (no regression)', () => {
      renderPopup('<div class="mc-no-target-refusal"><h3>No Target</h3><p>No attack rolled, nothing spent.</p></div>');

      fireEvent.click(screen.getByRole('button', { name: /Done/i }));
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(captured).toHaveLength(0);
      expect(addEntry).not.toHaveBeenCalled();
    });

    it('string refusal face: Escape closes with zero dispatch and zero log rows', () => {
      renderPopup('<div class="mc-no-target-refusal"><h3>No Target</h3></div>');

      fireEvent.keyDown(screen.getByTestId('popup-overlay').querySelector('.popup-modal'), { key: 'Escape' });

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(captured).toHaveLength(0);
      expect(addEntry).not.toHaveBeenCalled();
    });

    it('string refusal face: pure backdrop click closes with zero dispatch and zero log rows', () => {
      renderPopup('<div class="mc-no-target-refusal"><h3>No Target</h3></div>');

      const overlay = screen.getByTestId('popup-overlay');
      fireEvent.mouseDown(overlay);
      fireEvent.click(overlay);

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(captured).toHaveLength(0);
      expect(addEntry).not.toHaveBeenCalled();
    });

    it('auto-miss carrying autoDamage stages nothing: no Cancel row', () => {
      renderPopup(attackPopup({ rolls: [1], hit: false, isAutoMiss: true, autoDamage: AUTO_DAMAGE }));
      expect(screen.queryByRole('button', { name: /Cancel attack/i })).not.toBeInTheDocument();
    });
  });
});
