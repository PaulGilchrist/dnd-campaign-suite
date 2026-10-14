// @maintained-by-ai
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
  it('confirms the default level, then the newly selected level after the player switches slots', () => {
    const { onConfirm, onCancel } = renderUpcastPopup();

    fireEvent.click(castButton());
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(3);

    fireEvent.click(screen.getByRole('radio', { name: /^Level 4/ }));
    fireEvent.click(screen.getByRole('button', { name: /cast at level 4/i }));
    expect(onConfirm).toHaveBeenCalledTimes(2);
    expect(onConfirm).toHaveBeenLastCalledWith(4);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('cancels when the Cancel button is clicked, without casting', () => {
    const { onConfirm, onCancel } = renderUpcastPopup();

    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('cancels once on Escape, ignores other keys, and stops responding after unmount', () => {
    const { unmount, onCancel } = renderUpcastPopup();

    fireEvent.keyDown(document, { key: 'Enter' });
    fireEvent.keyDown(document, { key: 'Delete' });
    expect(onCancel).not.toHaveBeenCalled();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);

    unmount();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
