// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AnimateDeadModal from './AnimateDeadModal.jsx';

// ── Test fixtures ──

function makeProps(overrides) {
  return {
    maxTargets: 3,
    onConfirm: vi.fn(),
    onClose: vi.fn(),
    ...(overrides || {}),
  };
}

function renderModal(overrides) {
  const props = makeProps(overrides);
  render(<AnimateDeadModal {...props} />);
  return props;
}

// ── Helpers ──

function getCountDisplay() {
  return screen.getByText(/Total creatures:/);
}

function getConfirmButton() {
  return screen.getByRole('button', { name: /Animate Dead/ });
}

function getCancelButton() {
  return screen.getByRole('button', { name: 'Cancel' });
}

function getZombieCountSpan() {
  const zombieLabel = screen.getByText('Zombie(s)');
  const row = zombieLabel.closest('[style*="gap: 12px"]');
  return row ? row.querySelector('span[style*="width: 40px"]') : null;
}

function getSkeletonCountSpan() {
  const skeletonLabel = screen.getByText('Skeleton(s)');
  const row = skeletonLabel.closest('[style*="gap: 12px"]');
  return row ? row.querySelector('span[style*="width: 40px"]') : null;
}

function getZombieMinusButton() {
  const zombieLabel = screen.getByText('Zombie(s)');
  const row = zombieLabel.closest('[style*="gap: 12px"]');
  return row ? row.querySelector('button:first-of-type') : null;
}

function getZombiePlusButton() {
  const zombieLabel = screen.getByText('Zombie(s)');
  const row = zombieLabel.closest('[style*="gap: 12px"]');
  return row ? row.querySelector('button:last-of-type') : null;
}

function getSkeletonMinusButton() {
  const skeletonLabel = screen.getByText('Skeleton(s)');
  const row = skeletonLabel.closest('[style*="gap: 12px"]');
  return row ? row.querySelector('button:first-of-type') : null;
}

function getSkeletonPlusButton() {
  const skeletonLabel = screen.getByText('Skeleton(s)');
  const row = skeletonLabel.closest('[style*="gap: 12px"]');
  return row ? row.querySelector('button:last-of-type') : null;
}

// ── Tests ──

describe('AnimateDeadModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Rendering ──

  describe('initial render', () => {
    it('renders the modal overlay, header, creature rows, total display, and buttons with correct initial state', () => {
      renderModal({ maxTargets: 3 });
      expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
      expect(document.querySelector('.sp-modal')).toBeInTheDocument();
      expect(screen.getByText('Animate Dead')).toBeInTheDocument();
      expect(screen.getByText(/You can create up to/)).toHaveTextContent(/3/);
      expect(screen.getByText('Zombie(s)')).toBeInTheDocument();
      expect(screen.getByText('Skeleton(s)')).toBeInTheDocument();
      expect(getCountDisplay()).toHaveTextContent(/Total creatures: 3 \/ 3/);
      expect(getConfirmButton()).toBeInTheDocument();
      expect(getCancelButton()).toBeInTheDocument();
      expect(getConfirmButton()).toHaveTextContent(/Animate Dead \(3\)/);
    });
  });

  // ── Zombie count adjustment ──

  describe('zombie count adjustment', () => {
    it('increments zombie and decrements skeleton to keep total constant', () => {
      renderModal({ maxTargets: 3 });
      fireEvent.click(getZombiePlusButton());
      expect(getCountDisplay()).toHaveTextContent(/Total creatures: 3 \/ 3/);
      expect(getZombieCountSpan()?.textContent).toBe('1');
    });

    it('does not go below 0 for zombie (skeleton adjusts up)', () => {
      renderModal({ maxTargets: 3 });
      fireEvent.click(getZombieMinusButton());
      expect(getZombieCountSpan()?.textContent).toBe('0');
    });

    it('does not exceed maxTargets for zombie (skeleton stays at 0)', () => {
      renderModal({ maxTargets: 2 });
      fireEvent.click(getZombiePlusButton());
      fireEvent.click(getZombiePlusButton());
      fireEvent.click(getZombiePlusButton());
      expect(getZombieCountSpan()?.textContent).toBe('2');
    });
  });

  // ── Skeleton count adjustment ──

  describe('skeleton count adjustment', () => {
    it('decrements skeleton and reduces total', () => {
      renderModal({ maxTargets: 3 });
      fireEvent.click(getSkeletonMinusButton());
      expect(getCountDisplay()).toHaveTextContent(/Total creatures: 2 \/ 3/);
    });

    it('does not exceed maxTargets for skeleton', () => {
      renderModal({ maxTargets: 3 });
      fireEvent.click(getSkeletonPlusButton());
      expect(getSkeletonCountSpan()?.textContent).toBe('3');
    });

    it('does not go below 0 for skeleton', () => {
      renderModal({ maxTargets: 3 });
      fireEvent.click(getSkeletonMinusButton());
      fireEvent.click(getSkeletonMinusButton());
      fireEvent.click(getSkeletonMinusButton());
      fireEvent.click(getSkeletonMinusButton());
      expect(getSkeletonCountSpan()?.textContent).toBe('0');
      expect(getCountDisplay()).toHaveTextContent(/Total creatures: 0 \/ 3/);
    });
  });

  // ── Interactive adjustment scenarios ──

  describe('interactive adjustment scenarios', () => {
    it('allows distributing between zombie and skeleton', () => {
      renderModal({ maxTargets: 4 });
      fireEvent.click(getZombiePlusButton());
      fireEvent.click(getSkeletonMinusButton());
      fireEvent.click(getSkeletonMinusButton());
      expect(getCountDisplay()).toHaveTextContent(/Total creatures: 2 \/ 4/);
    });

    it('allows creating zero creatures', () => {
      renderModal({ maxTargets: 3 });
      fireEvent.click(getSkeletonMinusButton());
      fireEvent.click(getSkeletonMinusButton());
      fireEvent.click(getSkeletonMinusButton());
      expect(getCountDisplay()).toHaveTextContent(/Total creatures: 0 \/ 3/);
      expect(getConfirmButton()).toBeDisabled();
    });
  });

  // ── Confirm button state ──

  describe('confirm button state', () => {
    it('is disabled when total is 0, enabled when total > 0', () => {
      renderModal({ maxTargets: 3 });
      expect(getConfirmButton()).not.toBeDisabled();
      fireEvent.click(getSkeletonMinusButton());
      fireEvent.click(getSkeletonMinusButton());
      fireEvent.click(getSkeletonMinusButton());
      expect(getConfirmButton()).toBeDisabled();
      fireEvent.click(getZombiePlusButton());
      expect(getConfirmButton()).not.toBeDisabled();
    });

    it('shows and updates total count in button label', () => {
      renderModal({ maxTargets: 3 });
      expect(getConfirmButton()).toHaveTextContent(/Animate Dead \(3\)/);
      fireEvent.click(getSkeletonMinusButton());
      expect(getConfirmButton()).toHaveTextContent(/Animate Dead \(2\)/);
      fireEvent.click(getSkeletonMinusButton());
      expect(getConfirmButton()).toHaveTextContent(/Animate Dead \(1\)/);
    });
  });

  // ── Confirm action ──

  describe('confirm action', () => {
    it('calls onConfirm with zombieCount and skeletonCount when total > 0', () => {
      const { onConfirm } = renderModal({ maxTargets: 3 });
      fireEvent.click(getZombiePlusButton());
      fireEvent.click(getConfirmButton());
      expect(onConfirm).toHaveBeenCalledWith({ zombieCount: 1, skeletonCount: 2 });
    });

    it('does not call onConfirm when total is 0', () => {
      const { onConfirm } = renderModal({ maxTargets: 3 });
      fireEvent.click(getSkeletonMinusButton());
      fireEvent.click(getSkeletonMinusButton());
      fireEvent.click(getSkeletonMinusButton());
      const confirmBtn = getConfirmButton();
      expect(confirmBtn).toBeDisabled();
      fireEvent.click(confirmBtn);
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  // ── Cancel / Close ──

  describe('cancel / close', () => {
    it('calls onClose when Cancel button is clicked', () => {
      const { onClose } = renderModal();
      fireEvent.click(getCancelButton());
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose when clicking the overlay', () => {
      const { onClose } = renderModal();
      fireEvent.click(document.querySelector('.sp-overlay'));
      expect(onClose).not.toHaveBeenCalled();
      expect(getCancelButton()).toBeInTheDocument();
    });

    it('does not call onClose when clicking the modal content', () => {
      const { onClose } = renderModal();
      fireEvent.click(document.querySelector('.sp-modal'));
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  // ── Edge cases ──

  describe('edge cases', () => {
    it('handles maxTargets of 0 (all buttons functional, confirm disabled)', () => {
      renderModal({ maxTargets: 0 });
      expect(screen.getByText(/You can create up to/)).toHaveTextContent(/0/);
      expect(getCountDisplay()).toHaveTextContent(/Total creatures: 0 \/ 0/);
      expect(getConfirmButton()).toBeDisabled();
    });

    it('handles maxTargets of 1', () => {
      renderModal({ maxTargets: 1 });
      expect(screen.getByText(/You can create up to/)).toHaveTextContent(/1/);
      expect(getCountDisplay()).toHaveTextContent(/Total creatures: 1 \/ 1/);
      fireEvent.click(getZombiePlusButton());
      expect(getCountDisplay()).toHaveTextContent(/Total creatures: 1 \/ 1/);
      expect(getZombieCountSpan()?.textContent).toBe('1');
    });
  });
});
