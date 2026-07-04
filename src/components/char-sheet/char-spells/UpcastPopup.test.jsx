// @improved-by-ai
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
    it('renders spell name in heading', () => {
      renderUpcastPopup();
      expect(screen.getByText(/Fireball/)).toBeInTheDocument();
    });

    it('renders all level options with their labels and formulas', () => {
      renderUpcastPopup();
      expect(screen.getByText('Level 3')).toBeInTheDocument();
      expect(screen.getByText('Level 4')).toBeInTheDocument();
      expect(screen.getByText('Level 5')).toBeInTheDocument();
      expect(screen.getByText('+1d6')).toBeInTheDocument();
      expect(screen.getByText('+2d6')).toBeInTheDocument();
      expect(screen.getByText('+3d6')).toBeInTheDocument();
    });

    it('renders the cancel and cast buttons', () => {
      renderUpcastPopup();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Cast at Level 3/ })).toBeInTheDocument();
    });
  });

  describe('default selection', () => {
    it('selects the first level with available slots', () => {
      renderUpcastPopup();
      const radios = screen.getAllByRole('radio');
      expect(radios[0]).toBeChecked();
    });

    it('skips levels with zero available slots when selecting default', () => {
      const levels = [
        { level: 3, formula: '+1d6', availableSlots: 0 },
        { level: 4, formula: '+2d6', availableSlots: 2 },
      ];
      renderUpcastPopup({ levels });
      const radios = screen.getAllByRole('radio');
      expect(radios[1]).toBeChecked();
    });

    it('falls back to spell base level when all levels have zero slots', () => {
      const levels = [
        { level: 3, formula: '+1d6', availableSlots: 0 },
      ];
      renderUpcastPopup({ levels });
      const radios = screen.getAllByRole('radio');
      expect(radios[0]).toBeChecked();
    });

    it('disables cast button when levels array is empty', () => {
      renderUpcastPopup({ levels: [] });
      const castButton = screen.getByRole('button', { name: /Cast at Level 3/ });
      expect(castButton).toBeDisabled();
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

    it('does not change selection when clicking a level with no available slots', () => {
      renderUpcastPopup();
      const radios = screen.getAllByRole('radio');
      expect(radios[0]).toBeChecked();

      fireEvent.click(screen.getByText('Level 5'));
      expect(radios[0]).toBeChecked();
    });

    it('disables radio inputs for levels with no available slots', () => {
      renderUpcastPopup();
      const radios = screen.getAllByRole('radio');
      expect(radios[2]).toBeDisabled();
    });
  });

  describe('cast button behavior', () => {
    it('is disabled when no slots available at selected level', () => {
      const levels = [
        { level: 3, formula: '+1d6', availableSlots: 0 },
      ];
      renderUpcastPopup({ levels });
      const castButton = screen.getByRole('button', { name: /Cast at Level/ });
      expect(castButton).toBeDisabled();
    });

    it('calls onConfirm with selected level when cast button clicked', () => {
      const onConfirm = vi.fn();
      renderUpcastPopup({ onConfirm });
      fireEvent.click(screen.getByRole('button', { name: /Cast at Level 3/ }));
      expect(onConfirm).toHaveBeenCalledWith(3);
    });

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

    it('calls onCancel when clicking the overlay background', () => {
      const onCancel = vi.fn();
      renderUpcastPopup({ onCancel });
      const overlay = document.querySelector('.popup-overlay');
      fireEvent.click(overlay);
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('does not call onCancel when clicking inside the modal', () => {
      const onCancel = vi.fn();
      renderUpcastPopup({ onCancel });
      const modal = document.querySelector('.popup-modal');
      fireEvent.click(modal);
      expect(onCancel).not.toHaveBeenCalled();
    });
  });

  describe('single level', () => {
    it('renders only the provided level option', () => {
      const levels = [
        { level: 5, formula: '+3d6', availableSlots: 1 },
      ];
      renderUpcastPopup({ levels });
      expect(screen.getByText('Level 5')).toBeInTheDocument();
      expect(screen.queryByText('Level 3')).not.toBeInTheDocument();
    });

    it('defaults to the only available level', () => {
      const levels = [
        { level: 5, formula: '+3d6', availableSlots: 1 },
      ];
      renderUpcastPopup({ levels });
      const radios = screen.getAllByRole('radio');
      expect(radios[0]).toBeChecked();
    });
  });
});
