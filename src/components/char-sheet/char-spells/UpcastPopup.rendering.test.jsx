import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import UpcastPopup from './UpcastPopup.jsx';

const mockSpell = { name: 'Fireball', level: 3 };

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
  // ── Rendering: structure and content ──

  describe('rendering structure and content', () => {
    it('renders the popup overlay and modal container', () => {
      renderUpcastPopup();

      expect(document.querySelector('.popup-overlay')).toBeInTheDocument();
      expect(document.querySelector('.popup-modal.upcast-popup')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /upcast fireball/i })).toBeInTheDocument();
    });

    it('renders the descriptive instruction text', () => {
      renderUpcastPopup();

      expect(screen.getByText(/This spell can be cast using a higher-level spell slot/)).toBeInTheDocument();
    });

    it('renders all available upcast levels as radio options', () => {
      renderUpcastPopup();

      const radios = screen.getAllByRole('radio');
      expect(radios).toHaveLength(3);
    });

    it('renders level numbers, formulas, and slot counts for each option', () => {
      renderUpcastPopup();

      expect(screen.getByText('Level 3')).toBeInTheDocument();
      expect(screen.getByText('+1d6')).toBeInTheDocument();
      expect(screen.getByText('3 slots remaining')).toBeInTheDocument();

      expect(screen.getByText('Level 4')).toBeInTheDocument();
      expect(screen.getByText('+2d6')).toBeInTheDocument();
      expect(screen.getByText('2 slots remaining')).toBeInTheDocument();

      expect(screen.getByText('Level 5')).toBeInTheDocument();
      expect(screen.getByText('+3d6')).toBeInTheDocument();
      expect(screen.getByText('0 slots remaining')).toBeInTheDocument();
    });

    it('renders the spell name in the heading', () => {
      renderUpcastPopup({ spell: { name: 'Magic Missile', level: 1 } });

      expect(screen.getByText(/upcast magic missile/i)).toBeInTheDocument();
    });
  });

  // ── Rendering: disabled levels ──

  describe('disabled levels', () => {
    it('disables radio inputs for levels with no available slots', () => {
      renderUpcastPopup();

      const level5Radio = screen.getAllByRole('radio').find(r => r.value === '5');
      expect(level5Radio).toBeDisabled();
    });

    it('applies disabled styling class to levels with no available slots', () => {
      renderUpcastPopup();

      const level5Label = screen.getByText('Level 5').closest('label');
      expect(level5Label).toHaveClass('upcast-level-disabled');
    });

    it('enables radio inputs for levels with available slots', () => {
      renderUpcastPopup();

      const level3Radio = screen.getAllByRole('radio').find(r => r.value === '3');
      const level4Radio = screen.getAllByRole('radio').find(r => r.value === '4');
      expect(level3Radio).not.toBeDisabled();
      expect(level4Radio).not.toBeDisabled();
    });
  });

  // ── Rendering: default selection ──

  describe('default selection', () => {
    it('selects the first level with available slots by default', () => {
      renderUpcastPopup();

      const selectedRadio = screen.getByRole('radio', { checked: true });
      expect(selectedRadio.value).toBe('3');
    });

    it('skips unavailable levels when selecting the default', () => {
      const levels = [
        { level: 3, formula: '+1d6', availableSlots: 0 },
        { level: 4, formula: '+2d6', availableSlots: 0 },
        { level: 5, formula: '+3d6', availableSlots: 2 },
      ];

      renderUpcastPopup({ levels });

      const selectedRadio = screen.getByRole('radio', { checked: true });
      expect(selectedRadio.value).toBe('5');
    });

    it('falls back to the first level when no slots are available at all', () => {
      const levels = [
        { level: 3, formula: '+1d6', availableSlots: 0 },
        { level: 4, formula: '+2d6', availableSlots: 0 },
      ];

      renderUpcastPopup({ levels });

      const selectedRadio = screen.getByRole('radio', { checked: true });
      expect(selectedRadio.value).toBe('3');
    });

    it('renders empty level list when levels array is empty but still shows confirm button with fallback level', () => {
      const spell = { name: 'Fireball', level: 3 };

      renderUpcastPopup({ spell, levels: [] });

      expect(screen.queryByRole('radio')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cast at level 3/i })).toBeInTheDocument();
    });
  });

  // ── Rendering: confirm button state ──

  describe('confirm button state', () => {
    it('is enabled when a level with available slots is selected', () => {
      renderUpcastPopup();

      const confirmBtn = screen.getByRole('button', { name: /cast at level 3/i });
      expect(confirmBtn).not.toBeDisabled();
    });

    it('is disabled when only unavailable levels exist', () => {
      const levels = [
        { level: 3, formula: '+1d6', availableSlots: 0 },
        { level: 4, formula: '+2d6', availableSlots: 0 },
      ];

      renderUpcastPopup({ levels });

      const confirmBtn = screen.getByRole('button', { name: /cast at level 3/i });
      expect(confirmBtn).toBeDisabled();
    });
  });

  // ── Interactions: selection ──

  describe('selection interactions', () => {
    it('changes selection when clicking a different available level', () => {
      renderUpcastPopup();

      const level4Radio = screen.getAllByRole('radio').find(r => r.value === '4');
      fireEvent.click(level4Radio);

      const selectedRadio = screen.getByRole('radio', { checked: true });
      expect(selectedRadio.value).toBe('4');
    });

    it('keeps confirm button disabled when attempting to select a disabled level', () => {
      renderUpcastPopup();

      const level5Radio = screen.getAllByRole('radio').find(r => r.value === '5');
      fireEvent.click(level5Radio);

      const confirmBtn = screen.getByRole('button', { name: /cast at level 5/i });
      expect(confirmBtn).toBeDisabled();
    });
  });
});
