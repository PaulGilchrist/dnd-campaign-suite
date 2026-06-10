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

describe('UpcastPopup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders spell name in heading', () => {
    render(
      <UpcastPopup
        spell={mockSpell}
        levels={mockLevels}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText(/Fireball/)).toBeInTheDocument();
  });

  it('shows level options with available slots', () => {
    render(
      <UpcastPopup
        spell={mockSpell}
        levels={mockLevels}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText('Level 3')).toBeInTheDocument();
    expect(screen.getByText('Level 4')).toBeInTheDocument();
    expect(screen.getByText('Level 5')).toBeInTheDocument();
  });

  it('default selects first available slot', () => {
    render(
      <UpcastPopup
        spell={mockSpell}
        levels={mockLevels}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    const radios = screen.getAllByRole('radio');
    expect(radios[0]).toBeChecked();
  });

  it('selects a higher level via radio click', () => {
    render(
      <UpcastPopup
        spell={mockSpell}
        levels={mockLevels}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    const radios = screen.getAllByRole('radio');
    expect(radios[0]).toBeChecked();

    fireEvent.click(screen.getByText('Level 4'));
    expect(radios[1]).toBeChecked();
  });

  it('confirm button is disabled when no slots available at selected level', () => {
    const levels = [
      { level: 3, formula: '+1d6', availableSlots: 0 },
    ];
    render(
      <UpcastPopup
        spell={mockSpell}
        levels={levels}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    const castButton = screen.getByRole('button', { name: /Cast at Level/ });
    expect(castButton).toBeDisabled();
  });

  it('calls onConfirm with selected level number when cast button clicked', () => {
    const onConfirm = vi.fn();
    render(
      <UpcastPopup
        spell={mockSpell}
        levels={mockLevels}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );
    // Default is level 3 (first with available slots)
    fireEvent.click(screen.getByRole('button', { name: /Cast at Level 3/ }));
    expect(onConfirm).toHaveBeenCalledWith(3);
  });

  it('calls onCancel when cancel button clicked', () => {
    const onCancel = vi.fn();
    render(
      <UpcastPopup
        spell={mockSpell}
        levels={mockLevels}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('pressing Escape key calls onCancel', () => {
    const onCancel = vi.fn();
    render(
      <UpcastPopup
        spell={mockSpell}
        levels={mockLevels}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
