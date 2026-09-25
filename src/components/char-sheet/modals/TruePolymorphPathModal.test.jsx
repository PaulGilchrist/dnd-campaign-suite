// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TruePolymorphPathModal from './TruePolymorphPathModal.jsx';

const mockOnConfirm = vi.fn();
const mockOnCancel = vi.fn();

function renderModal(overrides) {
  return render(<TruePolymorphPathModal onConfirm={mockOnConfirm} onCancel={mockOnCancel} {...overrides} />);
}

// ── Path selection data ──

const paths = [
  { label: 'Creature into Creature', value: 'creature_to_creature' },
  { label: 'Object into Creature', value: 'object_into_creature' },
  { label: 'Creature into Object', value: 'creature_to_object' },
];

describe('TruePolymorphPathModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial render', () => {
    it('renders the modal with title, instruction, and three transformation paths', () => {
      renderModal();
      expect(screen.getByText('True Polymorph')).toBeInTheDocument();
      expect(screen.getByText('Choose the type of transformation:')).toBeInTheDocument();
      for (const { label } of paths) {
        expect(screen.getByText(label)).toBeInTheDocument();
      }
    });

    it('renders a Cancel button', () => {
      renderModal();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });
  });

  describe('path selection', () => {
    for (const { label, value } of paths) {
      it(`calls onConfirm with "${value}" when "${label}" is clicked`, () => {
        renderModal();
        fireEvent.click(screen.getByText(label));
        expect(mockOnConfirm).toHaveBeenCalledWith(value);
      });
    }
  });

  describe('close behavior', () => {
    it('calls onCancel when Cancel button is clicked', () => {
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });

    it('does not call onCancel when clicking the overlay background', () => {
      renderModal();
      const modal = screen.getByText('Choose the type of transformation:').closest('.sp-modal');
      const overlayEl = modal.parentElement;
      fireEvent.click(overlayEl);
      expect(mockOnCancel).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });
  });

  describe('escape key', () => {
    it('calls onCancel when Escape key is pressed', () => {
      renderModal();
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('edge cases', () => {
    it('handles missing onCancel gracefully (no-op)', () => {
      render(<TruePolymorphPathModal onConfirm={mockOnConfirm} />);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });
  });
});
