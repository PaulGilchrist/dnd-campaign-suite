// @cleaned-by-ai
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

describe('UpcastPopup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('rendering', () => {
    it('renders spell name, level options, formulas, and action buttons', () => {
      renderUpcastPopup();
      expect(screen.getByText(/Fireball/)).toBeInTheDocument();
      expect(screen.getByText('Level 3')).toBeInTheDocument();
      expect(screen.getByText('Level 4')).toBeInTheDocument();
      expect(screen.getByText('Level 5')).toBeInTheDocument();
      expect(screen.getByText('+1d6')).toBeInTheDocument();
      expect(screen.getByText('+2d6')).toBeInTheDocument();
      expect(screen.getByText('+3d6')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Cast at Level 3/ })).toBeInTheDocument();
    });
  });

  describe('default selection', () => {
    it.each([
      ['first level with available slots', mockLevels, 0],
      ['skips zero-slot levels', [{ level: 3, formula: '+1d6', availableSlots: 0 }, { level: 4, formula: '+2d6', availableSlots: 2 }], 1],
      ['falls back to spell base level when all levels have zero slots', [{ level: 3, formula: '+1d6', availableSlots: 0 }], 0],
      ['disables cast button when levels array is empty', [], 0],
    ])('selects %s', (_, levels, expectedIndex) => {
      renderUpcastPopup({ levels });
      const castButton = screen.getByRole('button', { name: /Cast at Level/ });
      const radios = screen.queryAllByRole('radio');
      if (radios.length) {
        expect(radios[expectedIndex]).toBeChecked();
        const hasSlots = levels.some(l => l.availableSlots > 0);
        if (hasSlots) {
          expect(castButton).not.toBeDisabled();
        }
        else {
          expect(castButton).toBeDisabled();
        }
      }
      else {
        expect(castButton).toBeDisabled();
      }
    });
  });

  describe('user interaction', () => {
    it('updates selection when clicking a higher level with available slots', () => {
      renderUpcastPopup();
      const radios = screen.getAllByRole('radio');
      expect(radios[0]).toBeChecked();

      fireEvent.click(screen.getByText('Level 4'));
      expect(radios[1]).toBeChecked();
    });

    it('disables radio inputs for levels with no available slots', () => {
      renderUpcastPopup();
      const radios = screen.getAllByRole('radio');
      expect(radios[2]).toBeDisabled();
    });

    it('disables cast button when no slots available at selected level', () => {
      const levels = [{ level: 3, formula: '+1d6', availableSlots: 0 }];
      renderUpcastPopup({ levels });
      const castButton = screen.getByRole('button', { name: /Cast at Level/ });
      expect(castButton).toBeDisabled();
    });
  });

  describe('cast behavior', () => {
    it('calls onConfirm with the newly selected level', () => {
      const onConfirm = vi.fn();
      renderUpcastPopup({ onConfirm });
      fireEvent.click(screen.getByText('Level 4'));
      fireEvent.click(screen.getByRole('button', { name: /Cast at Level 4/ }));
      expect(onConfirm).toHaveBeenCalledWith(4);
    });
  });

  describe('cancel behavior', () => {
    it('calls onCancel when cancel button clicked', () => {
      const onCancel = vi.fn();
      renderUpcastPopup({ onCancel });
      fireEvent.click(screen.getByText('Cancel'));
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('calls onCancel when pressing Escape key', () => {
      const onCancel = vi.fn();
      renderUpcastPopup({ onCancel });
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });
});
