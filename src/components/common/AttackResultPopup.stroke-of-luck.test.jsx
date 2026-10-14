import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

  // ── Stroke of Luck / Miss to Hit ──

  describe('stroke of luck / miss to hit', () => {
    it('shows Stroke of Luck button when strokeOfLuck prop is true', () => {
      renderPopup({
        popupHtml: {
          name: 'Test Attack',
          type: 'd20',
          rolls: [3],
          bonus: 3,
          hit: false,
          strokeOfLuck: true,
        },
      });

      expect(screen.getByRole('button', { name: /Stroke of Luck/i })).toBeInTheDocument();
    });

    it('shows Boon of Combat Prowess button when autoRerollForAttack is true and hit is false', () => {
      renderPopup({
        popupHtml: {
          name: 'Test Attack',
          type: 'd20',
          rolls: [3],
          bonus: 3,
          hit: false,
          autoRerollForAttack: true,
        },
        attackerName: 'PlayerOne',
      });

      expect(screen.getByRole('button', { name: /Boon of Combat Prowess/i })).toBeInTheDocument();
    });

    it('calls onStrokeOfLuck when Stroke of Luck button is clicked', () => {
      const onStrokeOfLuck = vi.fn();
      renderPopup({
        popupHtml: {
          name: 'Test Attack',
          type: 'd20',
          rolls: [3],
          bonus: 3,
          hit: false,
          strokeOfLuck: true,
        },
        onStrokeOfLuck,
      });

      const strokeBtn = screen.getByRole('button', { name: /Stroke of Luck/i });
      fireEvent.click(strokeBtn);

      expect(onStrokeOfLuck).toHaveBeenCalledTimes(1);
    });

    it('calls onStrokeOfLuck when Boon of Combat Prowess button is clicked', () => {
      const onStrokeOfLuck = vi.fn();
      renderPopup({
        popupHtml: {
          name: 'Test Attack',
          type: 'd20',
          rolls: [3],
          bonus: 3,
          hit: false,
          autoRerollForAttack: true,
        },
        attackerName: 'PlayerOne',
        onStrokeOfLuck,
      });

      const boonBtn = screen.getByRole('button', { name: /Boon of Combat Prowess/i });
      fireEvent.click(boonBtn);

      expect(onStrokeOfLuck).toHaveBeenCalledTimes(1);
    });
  });

  // ── missToHitApplied state ──

  describe('missToHitApplied state', () => {
    it('shows Done button after Boon of Combat Prowess is clicked (miss converted to hit)', () => {
      renderPopup({
        popupHtml: {
          name: 'Test Attack',
          type: 'd20',
          rolls: [3],
          bonus: 3,
          hit: false,
          autoRerollForAttack: true,
          autoDamage: true,
        },
        attackerName: 'PlayerOne',
        onClose: vi.fn(),
      });

      const boonBtn = screen.getByRole('button', { name: /Boon of Combat Prowess/i });
      fireEvent.click(boonBtn);

      expect(screen.getByRole('button', { name: /Done/i })).toBeInTheDocument();
    });

    it('prevents double-clicking Boon of Combat Prowess via ref guard', () => {
      const onStrokeOfLuck = vi.fn();
      renderPopup({
        popupHtml: {
          name: 'Test Attack',
          type: 'd20',
          rolls: [3],
          bonus: 3,
          hit: false,
          autoRerollForAttack: true,
        },
        attackerName: 'PlayerOne',
        onStrokeOfLuck,
      });

      const boonBtn = screen.getByRole('button', { name: /Boon of Combat Prowess/i });
      fireEvent.click(boonBtn);
      fireEvent.click(boonBtn);

      expect(onStrokeOfLuck).toHaveBeenCalledTimes(1);
    });
  });
});
