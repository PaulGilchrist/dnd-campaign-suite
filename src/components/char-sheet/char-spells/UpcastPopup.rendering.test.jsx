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
  it('renders a popup modal titled with the spell, explaining higher-level slots, with a Cancel option', () => {
    renderUpcastPopup();

    expect(document.querySelector('.popup-overlay .popup-modal.upcast-popup')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /upcast fireball/i })).toBeInTheDocument();
    expect(screen.getByText(/This spell can be cast using a higher-level spell slot/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^cancel$/i })).toBeInTheDocument();
  });

  it('renders one radio per upcast level with its formula and slot count, checking the first level with slots by default', () => {
    renderUpcastPopup();

    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByRole('radio', { name: /Level 3.*\+1d6.*3 slots remaining/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Level 4.*\+2d6.*2 slots remaining/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Level 5.*\+3d6.*0 slots remaining/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { checked: true })).toHaveAccessibleName(/Level 3/);
  });

  it('uses singular "slot" wording when exactly one slot remains', () => {
    renderUpcastPopup({
      levels: [{ level: 2, formula: '+1d8', availableSlots: 1 }],
    });

    expect(screen.getByRole('radio', { name: /Level 2.*1 slot remaining/ })).toBeInTheDocument();
    expect(screen.queryByText('1 slots remaining')).not.toBeInTheDocument();
  });

  it('disables exhausted levels, keeps levels with slots selectable, and never enables casting an exhausted level even after clicking it', () => {
    renderUpcastPopup();

    const exhausted = screen.getByRole('radio', { name: /Level 5/ });
    expect(exhausted).toBeDisabled();
    expect(screen.getByRole('radio', { name: /Level 3/ })).not.toBeDisabled();
    expect(screen.getByRole('radio', { name: /Level 4/ })).not.toBeDisabled();

    fireEvent.click(exhausted);

    expect(castButton()).toBeDisabled();
  });

  it.each([
    {
      scenario: 'an available one further down',
      levels: [
        { level: 3, formula: '+1d6', availableSlots: 0 },
        { level: 4, formula: '+2d6', availableSlots: 0 },
        { level: 5, formula: '+3d6', availableSlots: 2 },
      ],
      checkedName: /Level 5/,
      castable: true,
    },
    {
      scenario: 'none available',
      levels: [
        { level: 3, formula: '+1d6', availableSlots: 0 },
        { level: 4, formula: '+2d6', availableSlots: 0 },
      ],
      checkedName: /Level 3/,
      castable: false,
    },
  ])('defaults selection to $scenario', ({ levels, checkedName, castable }) => {
    renderUpcastPopup({ levels });

    expect(screen.getByRole('radio', { checked: true })).toHaveAccessibleName(checkedName);
    if (castable) {
      expect(castButton()).toBeEnabled();
      expect(castButton()).toHaveAccessibleName(/cast at level 5/i);
    } else {
      expect(castButton()).toBeDisabled();
    }
  });

  it('renders no options and offers the spell level, disabled, when there are no upcast levels', () => {
    renderUpcastPopup({ levels: [] });

    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(castButton()).toHaveAccessibleName(/cast at level 3/i);
    expect(castButton()).toBeDisabled();
  });

  it('moves the checked state to a newly selected level and updates the cast button', () => {
    renderUpcastPopup();

    fireEvent.click(screen.getByRole('radio', { name: /Level 4/ }));

    expect(screen.getByRole('radio', { name: /Level 4/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Level 3/ })).not.toBeChecked();
    expect(screen.getAllByRole('radio', { checked: true })).toHaveLength(1);
    expect(castButton()).toHaveAccessibleName(/cast at level 4/i);
    expect(castButton()).toBeEnabled();
  });
});
