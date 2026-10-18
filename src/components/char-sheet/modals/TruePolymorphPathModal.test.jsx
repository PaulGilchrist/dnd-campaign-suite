// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TruePolymorphPathModal from './TruePolymorphPathModal.jsx';

const mockOnConfirm = vi.fn();
const mockOnCancel = vi.fn();

function renderModal() {
  return render(<TruePolymorphPathModal onConfirm={mockOnConfirm} onCancel={mockOnCancel} />);
}

// ── Path selection data (mirrors the three onConfirm payloads in the source) ──

const paths = [
  { label: 'Creature into Creature', value: 'creature_to_creature' },
  { label: 'Object into Creature', value: 'object_into_creature' },
  { label: 'Creature into Object', value: 'creature_to_object' },
];

describe('TruePolymorphPathModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders title, instruction, three path buttons and Cancel without firing callbacks', () => {
    renderModal();
    expect(screen.getByText('True Polymorph')).toBeInTheDocument();
    expect(screen.getByText('Choose the type of transformation:')).toBeInTheDocument();
    // Guardrail: exactly the 3 path buttons + Cancel, nothing else.
    expect(screen.getAllByRole('button')).toHaveLength(4);
    for (const { label } of paths) {
      expect(screen.getByRole('button', { name: new RegExp(label) })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(mockOnConfirm).not.toHaveBeenCalled();
    expect(mockOnCancel).not.toHaveBeenCalled();
  });

  for (const { label, value } of paths) {
    it(`confirms exactly "${value}" when the "${label}" path button is clicked`, () => {
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: new RegExp(label) }));
      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
      expect(mockOnConfirm).toHaveBeenCalledWith(value);
      expect(mockOnCancel).not.toHaveBeenCalled();
    });
  }

  it('cancels once when the Cancel button is clicked', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
    expect(mockOnConfirm).not.toHaveBeenCalled();
  });

  it('cancels once on Escape only — other keys are ignored', () => {
    renderModal();
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(mockOnCancel).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
    expect(mockOnConfirm).not.toHaveBeenCalled();
  });
});
