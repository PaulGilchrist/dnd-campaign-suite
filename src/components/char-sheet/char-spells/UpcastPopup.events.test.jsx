// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import UpcastPopup from './UpcastPopup.jsx';

function renderUpcastPopup({
  spell = { name: 'Fireball', level: 3 },
  levels = [
    { level: 3, formula: '+1d6', availableSlots: 3 },
    { level: 4, formula: '+2d6', availableSlots: 2 },
    { level: 5, formula: '+3d6', availableSlots: 0 },
  ],
  onConfirm = vi.fn(),
  onCancel = vi.fn(),
} = {}) {
  const utils = render(
    <UpcastPopup
      spell={spell}
      levels={levels}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
  return { ...utils, onConfirm, onCancel };
}

function castButton() {
  return screen.getByRole('button', { name: /cast at level/i });
}

describe('UpcastPopup events', () => {
  describe('casting a spell', () => {
    it('confirms the default selected level when the cast button is clicked', () => {
      const { onConfirm } = renderUpcastPopup();

      fireEvent.click(castButton());

      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onConfirm).toHaveBeenCalledWith(3);
    });

    it('confirms the newly selected level after the player picks a higher slot', () => {
      const { onConfirm } = renderUpcastPopup();

      fireEvent.click(screen.getByRole('radio', { name: /^Level 4/ }));
      fireEvent.click(screen.getByRole('button', { name: /cast at level 4/i }));

      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onConfirm).toHaveBeenCalledWith(4);
    });

    it('does not cast when every spell slot is exhausted', () => {
      const { onConfirm } = renderUpcastPopup({
        levels: [
          { level: 3, formula: '+1d6', availableSlots: 0 },
          { level: 4, formula: '+2d6', availableSlots: 0 },
        ],
      });

      const button = castButton();
      expect(button).toBeDisabled();
      fireEvent.click(button);

      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  describe('cancelling', () => {
    it('calls onCancel when the Cancel button is clicked', () => {
      const { onCancel } = renderUpcastPopup();

      fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('calls onCancel once when the Escape key is pressed', () => {
      const { onCancel } = renderUpcastPopup();

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('ignores keys other than Escape', () => {
      const { onCancel } = renderUpcastPopup();

      fireEvent.keyDown(document, { key: 'Enter' });
      fireEvent.keyDown(document, { key: 'Delete' });

      expect(onCancel).not.toHaveBeenCalled();
    });

    it('stops responding to Escape after the popup is unmounted', () => {
      const { unmount, onCancel } = renderUpcastPopup();

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onCancel).toHaveBeenCalledTimes(1);

      unmount();
      fireEvent.keyDown(document, { key: 'Escape' });

      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });
});
