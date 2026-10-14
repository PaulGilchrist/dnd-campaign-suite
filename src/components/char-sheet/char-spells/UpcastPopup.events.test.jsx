import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import UpcastPopup from './UpcastPopup.jsx';

const mockSpell = {
  name: 'Fireball',
  level: 3,
};

const mockLevels = [
  { level: 3, formula: '+1d6', availableSlots: 3 },
  { level: 4, formula: '+2d6', availableSlots: 2 },
  { level: 5, formula: '+3d6', availableSlots: 0 },
];

function renderUpcastPopup(props = {}) {
  return render(
    <UpcastPopup
      spell={mockSpell}
      levels={mockLevels}
      onConfirm={vi.fn()}
      onCancel={vi.fn()}
      {...props}
    />
  );
}

function getRadioByLevel(level) {
  return screen.getByRole('radio', { name: new RegExp(`^Level ${level}`) });
}

describe('UpcastPopup events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('cast behavior', () => {
    it('calls onConfirm with the default selected level when cast button clicked', () => {
      const onConfirm = vi.fn();
      renderUpcastPopup({ onConfirm });
      fireEvent.click(screen.getByRole('button', { name: /Cast at Level 3/ }));
      expect(onConfirm).toHaveBeenCalledWith(3);
    });

    it('calls onConfirm with a non-default level when a different level is selected', () => {
      const onConfirm = vi.fn();
      renderUpcastPopup({ onConfirm });
      fireEvent.click(getRadioByLevel(4));
      fireEvent.click(screen.getByRole('button', { name: /Cast at Level 4/ }));
      expect(onConfirm).toHaveBeenCalledWith(4);
    });

    it('does not call onConfirm when cast button is disabled', () => {
      const onConfirm = vi.fn();
      const levels = [{ level: 3, formula: '+1d6', availableSlots: 0 }];
      renderUpcastPopup({ onConfirm, levels });
      const castButton = screen.getByRole('button', { name: /Cast at Level 3/ });
      expect(castButton).toBeDisabled();
      fireEvent.click(castButton);
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  describe('cancel behavior', () => {
    it('calls onCancel when pressing Escape key', () => {
      const onCancel = vi.fn();
      renderUpcastPopup({ onCancel });
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('event listener cleanup', () => {
    it('removes the keydown event listener on unmount', () => {
      const onCancel = vi.fn();
      const { unmount } = renderUpcastPopup({ onCancel });
      // Confirm listener is active before unmount
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onCancel).toHaveBeenCalledTimes(1);
      onCancel.mockClear();
      unmount();
      // Firing Escape after unmount should not trigger onCancel
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onCancel).not.toHaveBeenCalled();
    });
  });
});
