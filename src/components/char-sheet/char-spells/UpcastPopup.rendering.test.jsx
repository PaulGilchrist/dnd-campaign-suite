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
  return render(
    <UpcastPopup
      spell={spell}
      levels={levels}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}

function castButton() {
  return screen.getByRole('button', { name: /cast at level/i });
}

describe('UpcastPopup rendering', () => {
  // ── Structure and content ──

  it('renders a popup overlay containing the upcast modal', () => {
    renderUpcastPopup();

    expect(document.querySelector('.popup-overlay .popup-modal.upcast-popup')).toBeInTheDocument();
  });

  it('titles the popup with the spell being upcast', () => {
    renderUpcastPopup();

    expect(screen.getByRole('heading', { name: /upcast fireball/i })).toBeInTheDocument();
  });

  it('shows the spell name in the title for any spell', () => {
    renderUpcastPopup({ spell: { name: 'Magic Missile', level: 1 } });

    expect(screen.getByRole('heading', { name: /upcast magic missile/i })).toBeInTheDocument();
  });

  it('explains that the spell can be cast using a higher-level slot', () => {
    renderUpcastPopup();

    expect(screen.getByText(/This spell can be cast using a higher-level spell slot/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^cancel$/i })).toBeInTheDocument();
  });

  // ── Level options ──

  it('renders one radio option per upcast level with its formula and slot count', () => {
    renderUpcastPopup();

    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByRole('radio', { name: /Level 3.*\+1d6.*3 slots remaining/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Level 4.*\+2d6.*2 slots remaining/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Level 5.*\+3d6.*0 slots remaining/ })).toBeInTheDocument();
  });

  it('uses singular "slot" wording when exactly one slot remains', () => {
    renderUpcastPopup({
      levels: [{ level: 2, formula: '+1d8', availableSlots: 1 }],
    });

    expect(screen.getByRole('radio', { name: /Level 2.*1 slot remaining/ })).toBeInTheDocument();
    expect(screen.queryByText('1 slots remaining')).not.toBeInTheDocument();
  });

  // ── Exhausted levels ──

  it('disables levels with no available slots', () => {
    renderUpcastPopup();

    expect(screen.getByRole('radio', { name: /Level 5/ })).toBeDisabled();
    expect(screen.getByRole('radio', { name: /Level 5/ }).closest('label')).toHaveClass('upcast-level-disabled');
  });

  it('keeps levels with available slots selectable', () => {
    renderUpcastPopup();

    expect(screen.getByRole('radio', { name: /Level 3/ })).not.toBeDisabled();
    expect(screen.getByRole('radio', { name: /Level 4/ })).not.toBeDisabled();
  });

  it('never enables casting an exhausted level, even after clicking it', () => {
    renderUpcastPopup();

    fireEvent.click(screen.getByRole('radio', { name: /Level 5/ }));

    expect(castButton()).toBeDisabled();
  });

  // ── Default selection ──

  it('defaults to the first level that has an available slot', () => {
    renderUpcastPopup();

    expect(screen.getByRole('radio', { checked: true })).toHaveAccessibleName(/Level 3/);
  });

  it('skips exhausted levels when choosing the default selection', () => {
    renderUpcastPopup({
      levels: [
        { level: 3, formula: '+1d6', availableSlots: 0 },
        { level: 4, formula: '+2d6', availableSlots: 0 },
        { level: 5, formula: '+3d6', availableSlots: 2 },
      ],
    });

    expect(screen.getByRole('radio', { checked: true })).toHaveAccessibleName(/Level 5/);
    expect(castButton()).toBeEnabled();
    expect(castButton()).toHaveAccessibleName(/cast at level 5/i);
  });

  it('selects the first level and blocks casting when every slot is exhausted', () => {
    renderUpcastPopup({
      levels: [
        { level: 3, formula: '+1d6', availableSlots: 0 },
        { level: 4, formula: '+2d6', availableSlots: 0 },
      ],
    });

    expect(screen.getByRole('radio', { checked: true })).toHaveAccessibleName(/Level 3/);
    expect(castButton()).toBeDisabled();
  });

  it('renders no options and offers the spell level, disabled, when there are no upcast levels', () => {
    renderUpcastPopup({ levels: [] });

    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(castButton()).toHaveAccessibleName(/cast at level 3/i);
    expect(castButton()).toBeDisabled();
  });

  // ── Selection state ──

  it('moves the checked state to the newly selected level', () => {
    renderUpcastPopup();

    fireEvent.click(screen.getByRole('radio', { name: /Level 4/ }));

    expect(screen.getByRole('radio', { name: /Level 4/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Level 3/ })).not.toBeChecked();
    expect(screen.getAllByRole('radio', { checked: true })).toHaveLength(1);
  });

  it('updates the cast button to the newly selected level', () => {
    renderUpcastPopup();

    fireEvent.click(screen.getByRole('radio', { name: /Level 4/ }));

    expect(screen.getByRole('button', { name: /cast at level 4/i })).toBeEnabled();
  });
});
