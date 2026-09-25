// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CreateUndeadModal from './CreateUndeadModal.jsx';

// ── Test fixtures ──

function makeProps(overrides) {
  return {
    maxTargets: 3,
    onConfirm: vi.fn(),
    onClose: vi.fn(),
    ...(overrides || {}),
  };
}

// ── Helpers ──

function getTotalCreaturesDisplay() {
  return screen.getByText(/Total creatures:/);
}

function getAdjustButtons() {
  const spBody = document.querySelector('.sp-body');
  if (!spBody) return [];
  return [...spBody.querySelectorAll('button')].filter(
    (btn) => btn.querySelector('i.fa-minus') || btn.querySelector('i.fa-plus')
  );
}

// ── Tests ──

describe('CreateUndeadModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Rendering ──

  describe('initial render', () => {
    it('renders the instruction text with maxTargets', () => {
      render(<CreateUndeadModal {...makeProps({ maxTargets: 5 })} />);
      expect(screen.getByText(/You can create up to/)).toHaveTextContent(/5 ghoul/);
    });

    it('renders the total display showing initial ghoulCount of 1', () => {
      render(<CreateUndeadModal {...makeProps({ maxTargets: 3 })} />);
      expect(getTotalCreaturesDisplay()).toHaveTextContent(/Total creatures: 1 \/ 3/);
    });

    it('renders Confirm and Cancel buttons', () => {
      render(<CreateUndeadModal {...makeProps()} />);
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Create Undead \(1\)/ })).toBeInTheDocument();
    });
  });

  // ── Ghoul count adjustment ──

  describe('ghoul count adjustment', () => {
    it('increments with plus button', () => {
      render(<CreateUndeadModal {...makeProps({ maxTargets: 5 })} />);
      const buttons = getAdjustButtons();
      const plusBtn = buttons[1];
      fireEvent.click(plusBtn);
      expect(getTotalCreaturesDisplay()).toHaveTextContent(/Total creatures: 2 \/ 5/);
    });

    it('does not go below 1 when at minimum', () => {
      render(<CreateUndeadModal {...makeProps({ maxTargets: 5 })} />);
      const buttons = getAdjustButtons();
      const minusBtn = buttons[0];
      fireEvent.click(minusBtn);
      fireEvent.click(minusBtn);
      expect(getTotalCreaturesDisplay()).toHaveTextContent(/Total creatures: 1 \/ 5/);
    });

    it('does not exceed maxTargets', () => {
      render(<CreateUndeadModal {...makeProps({ maxTargets: 2 })} />);
      const buttons = getAdjustButtons();
      const plusBtn = buttons[1];
      fireEvent.click(plusBtn);
      fireEvent.click(plusBtn);
      expect(getTotalCreaturesDisplay()).toHaveTextContent(/Total creatures: 2 \/ 2/);
    });

    it('updates confirm button label when count changes', () => {
      render(<CreateUndeadModal {...makeProps({ maxTargets: 5 })} />);
      const buttons = getAdjustButtons();
      const plusBtn = buttons[1];
      fireEvent.click(plusBtn);
      expect(screen.getByRole('button', { name: /Create Undead \(2\)/ })).toBeInTheDocument();
    });
  });

  // ── Confirm action ──

  describe('confirm action', () => {
    it('calls onConfirm with ghoulCount when confirm is clicked at default', () => {
      const props = makeProps({ maxTargets: 3 });
      render(<CreateUndeadModal {...props} />);
      const confirmBtn = screen.getByRole('button', { name: /Create Undead/ });
      fireEvent.click(confirmBtn);
      expect(props.onConfirm).toHaveBeenCalledWith({ ghoulCount: 1 });
    });

    it('calls onConfirm with correct ghoulCount after adjustments', () => {
      const props = makeProps({ maxTargets: 5 });
      render(<CreateUndeadModal {...props} />);
      const buttons = getAdjustButtons();
      const plusBtn = buttons[1];
      fireEvent.click(plusBtn);
      fireEvent.click(plusBtn);
      const confirmBtn = screen.getByRole('button', { name: /Create Undead/ });
      fireEvent.click(confirmBtn);
      expect(props.onConfirm).toHaveBeenCalledWith({ ghoulCount: 3 });
    });
  });

  // ── Cancel / Close ──

  describe('cancel / close', () => {
    it('calls onClose when Cancel button is clicked', () => {
      const props = makeProps();
      render(<CreateUndeadModal {...props} />);
      fireEvent.click(screen.getByText('Cancel'));
      expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose when clicking the overlay', () => {
      const props = makeProps();
      render(<CreateUndeadModal {...props} />);
      fireEvent.click(document.querySelector('.sp-overlay'));
      expect(props.onClose).not.toHaveBeenCalled();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('does not call onClose when clicking the modal content', () => {
      const props = makeProps();
      render(<CreateUndeadModal {...props} />);
      fireEvent.click(document.querySelector('.sp-modal'));
      expect(props.onClose).not.toHaveBeenCalled();
    });
  });

  // ── Edge cases ──

  describe('edge cases', () => {
    it('handles maxTargets of 0 (count clamped to 1 but display shows 1/0)', () => {
      render(<CreateUndeadModal {...makeProps({ maxTargets: 0 })} />);
      expect(screen.getByText(/You can create up to/)).toHaveTextContent(/0 ghoul/);
      expect(getTotalCreaturesDisplay()).toHaveTextContent(/Total creatures: 1 \/ 0/);
    });
  });
});
