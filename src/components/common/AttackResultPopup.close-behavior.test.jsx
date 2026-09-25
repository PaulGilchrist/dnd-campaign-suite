// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AttackResultPopup from './AttackResultPopup.jsx';

// ── Mock dependencies ──

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

// ── Helpers ──

function renderPopup(props = {}) {
  const defaultProps = {
    popupHtml: { name: 'Test Attack', type: 'd20', rolls: [15], bonus: 3, hit: true },
    onClose: vi.fn(),
    campaignName: 'test-campaign',
    attackerName: 'PlayerOne',
    setPopupHtml: vi.fn(),
    ...props,
  };
  return render(<AttackResultPopup {...defaultProps} />);
}

// ── Tests ──

describe('AttackResultPopup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Done button visibility ──

  describe('Done button visibility', () => {
    it('shows exactly one Done button when autoDamage and hit are both true (DiceRollResult only, standard footer suppressed)', async () => {
      renderPopup({
        popupHtml: {
          name: 'Test Attack',
          type: 'd20',
          rolls: [18],
          bonus: 3,
          hit: true,
          autoDamage: true,
        },
      });

      const doneButtons = screen.getAllByRole('button', { name: /Done/i });
      expect(doneButtons).toHaveLength(1);
    });

    it('shows the standard footer Done button in the non-autoDamage case', async () => {
      renderPopup({
        popupHtml: {
          name: 'Test Attack',
          type: 'd20',
          rolls: [15],
          bonus: 3,
          hit: true,
        },
      });

      const doneButtons = screen.getAllByRole('button', { name: /Done/i });
      expect(doneButtons).toHaveLength(1);
    });

    it('shows the standard footer Done button in the miss (no autoDamage) case', async () => {
      renderPopup({
        popupHtml: {
          name: 'Test Attack',
          type: 'd20',
          rolls: [3],
          bonus: 3,
          hit: false,
        },
      });

      const doneButtons = screen.getAllByRole('button', { name: /Done/i });
      expect(doneButtons).toHaveLength(1);
    });
  });

  // ── onClose behavior ──

  describe('onClose behavior', () => {
    it('calls onClose when Done button is clicked', async () => {
      const onClose = vi.fn();
      renderPopup({
        popupHtml: {
          name: 'Test Attack',
          type: 'd20',
          rolls: [18],
          bonus: 3,
          hit: true,
          autoDamage: true,
        },
        onClose,
      });

      const doneBtn = screen.getByRole('button', { name: /Done/i });
      fireEvent.click(doneBtn);

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  // ── dice-roll-done event dispatch ──

  describe('dice-roll-done event dispatch', () => {
    it('dispatches dice-roll-done event with correct detail when Done is clicked with autoDamage and hit', async () => {
      const onClose = vi.fn();
      renderPopup({
        popupHtml: {
          name: 'Test Attack',
          type: 'd20',
          rolls: [18],
          bonus: 3,
          hit: true,
          autoDamage: true,
          isCrit: true,
        },
        onClose,
      });

      const eventHandler = vi.fn();
      window.addEventListener('dice-roll-done', eventHandler);

      const doneBtn = screen.getByRole('button', { name: /Done/i });
      fireEvent.click(doneBtn);

      await waitFor(() => {
        expect(eventHandler).toHaveBeenCalledTimes(1);
      });

      const detail = eventHandler.mock.calls[0][0].detail;
      expect(detail.autoDamage).toBe(true);
      expect(detail.isCrit).toBe(true);
      expect(detail.hit).toBe(true);

      window.removeEventListener('dice-roll-done', eventHandler);
    });
  });
});
