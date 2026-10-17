// @maintained-by-ai
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AnimateDeadModal from './AnimateDeadModal.jsx';

// ── Fixtures & helpers ──

function renderModal(overrides) {
  const props = {
    maxTargets: 3,
    onConfirm: vi.fn(),
    onClose: vi.fn(),
    ...(overrides || {}),
  };
  render(<AnimateDeadModal {...props} />);
  return props;
}

function getTotalDisplay() {
  return screen.getByText(/Total creatures:/);
}

function getConfirmButton() {
  return screen.getByRole('button', { name: /Animate Dead \(\d+\)/ });
}

// Locate a row's +/- button by its FontAwesome icon, scoped to the row
// containing the creature label (mirrors CreateUndeadModal.test-utils style).
function adjustButton(creature, dir) {
  const row = screen.getByText(`${creature}(s)`).closest('div');
  const btn = within(row)
    .getAllByRole('button')
    .find((b) => b.querySelector(`i.fa-${dir}`));
  if (!btn) throw new Error(`${dir} button for ${creature} not found`);
  return btn;
}

// The count is the only plain-number text node in a creature row.
function countFor(creature) {
  const row = screen.getByText(`${creature}(s)`).closest('div');
  return within(row).getByText(/^\d+$/).textContent;
}

// ── Tests ──

describe('AnimateDeadModal', () => {
  // ── Rendering ──

  describe('initial render', () => {
    it('renders header, capacity text, both creature rows, totals, and buttons', () => {
      renderModal({ maxTargets: 3 });
      expect(screen.getByText('Animate Dead')).toBeInTheDocument();
      expect(screen.getByText(/You can create up to/)).toHaveTextContent('3');
      expect(countFor('Zombie')).toBe('0');
      expect(countFor('Skeleton')).toBe('3');
      expect(getTotalDisplay()).toHaveTextContent('Total creatures: 3 / 3');
      expect(getConfirmButton()).toHaveTextContent('Animate Dead (3)');
      expect(getConfirmButton()).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });
  });

  // ── Count adjustment ──

  describe('count adjustment', () => {
    it.each([1, 3])(
      'zombie plus raises zombies and pushes skeletons down, total stays at maxTargets=%i even past the cap',
      (maxTargets) => {
        renderModal({ maxTargets });
        fireEvent.click(adjustButton('Zombie', 'plus'));
        expect(countFor('Zombie')).toBe('1');
        expect(getTotalDisplay()).toHaveTextContent(
          `Total creatures: ${maxTargets} / ${maxTargets}`
        );

        // Keep clicking past the cap: zombies clamp at max, skeletons at 0.
        for (let i = 0; i < maxTargets; i++) {
          fireEvent.click(adjustButton('Zombie', 'plus'));
        }
        expect(countFor('Zombie')).toBe(String(maxTargets));
        expect(countFor('Skeleton')).toBe('0');
        expect(getTotalDisplay()).toHaveTextContent(
          `Total creatures: ${maxTargets} / ${maxTargets}`
        );
      }
    );

    it.each(['Zombie', 'Skeleton'])('%s minus floors at 0', (creature) => {
      renderModal({ maxTargets: 2 });
      for (let i = 0; i < 3; i++) {
        fireEvent.click(adjustButton(creature, 'minus'));
      }
      expect(countFor(creature)).toBe('0');
    });

    it('skeleton minus lowers the total, plus restores it, and the confirm label tracks the total', () => {
      renderModal({ maxTargets: 3 });
      fireEvent.click(adjustButton('Skeleton', 'minus'));
      fireEvent.click(adjustButton('Skeleton', 'minus'));
      expect(countFor('Skeleton')).toBe('1');
      expect(getTotalDisplay()).toHaveTextContent('Total creatures: 1 / 3');
      expect(getConfirmButton()).toHaveTextContent('Animate Dead (1)');

      fireEvent.click(adjustButton('Skeleton', 'plus'));
      fireEvent.click(adjustButton('Skeleton', 'plus'));
      expect(countFor('Skeleton')).toBe('3');
      expect(getTotalDisplay()).toHaveTextContent('Total creatures: 3 / 3');
      expect(getConfirmButton()).toHaveTextContent('Animate Dead (3)');
    });

    it('skeleton plus trims zombies back under the cap', () => {
      renderModal({ maxTargets: 3 });
      fireEvent.click(adjustButton('Zombie', 'plus'));
      fireEvent.click(adjustButton('Zombie', 'plus')); // z=2, s=1, total=3
      fireEvent.click(adjustButton('Skeleton', 'plus')); // s=2 would exceed cap → zombie trimmed
      expect(countFor('Zombie')).toBe('1');
      expect(countFor('Skeleton')).toBe('2');
      expect(getTotalDisplay()).toHaveTextContent('Total creatures: 3 / 3');
    });
  });

  // ── Confirm ──

  describe('confirm', () => {
    it('calls onConfirm with the exact chosen creature counts', () => {
      const { onConfirm } = renderModal({ maxTargets: 3 });
      fireEvent.click(adjustButton('Zombie', 'plus'));
      fireEvent.click(adjustButton('Zombie', 'plus')); // z=2, s=1
      expect(countFor('Zombie')).toBe('2');
      expect(countFor('Skeleton')).toBe('1');
      fireEvent.click(getConfirmButton());
      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onConfirm).toHaveBeenCalledWith({ zombieCount: 2, skeletonCount: 1 });
    });

    it('is disabled at zero total, inert when clicked, and re-arms after adding creatures', () => {
      const { onConfirm } = renderModal({ maxTargets: 2 });
      fireEvent.click(adjustButton('Skeleton', 'minus'));
      fireEvent.click(adjustButton('Skeleton', 'minus'));
      expect(getTotalDisplay()).toHaveTextContent('Total creatures: 0 / 2');
      const confirm = getConfirmButton();
      expect(confirm).toBeDisabled();
      fireEvent.click(confirm);
      expect(onConfirm).not.toHaveBeenCalled();

      fireEvent.click(adjustButton('Zombie', 'plus'));
      const rearmed = getConfirmButton();
      expect(rearmed).toBeEnabled();
      fireEvent.click(rearmed);
      expect(onConfirm).toHaveBeenCalledWith({ zombieCount: 1, skeletonCount: 0 });
    });
  });

  // ── Cancel / Close ──

  describe('cancel / close', () => {
    it('calls onClose once when Cancel is clicked and never touches onConfirm', () => {
      const { onClose, onConfirm } = renderModal();
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it('is inert when clicking the overlay or modal content', () => {
      const { onClose } = renderModal();
      fireEvent.click(document.querySelector('.sp-overlay'));
      fireEvent.click(document.querySelector('.sp-modal'));
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });
  });

  // ── Edge cases ──

  describe('edge cases', () => {
    it('handles maxTargets of 0: zero totals, disabled and inert controls', () => {
      const { onConfirm } = renderModal({ maxTargets: 0 });
      expect(screen.getByText(/You can create up to/)).toHaveTextContent('0');
      expect(getTotalDisplay()).toHaveTextContent('Total creatures: 0 / 0');
      const confirm = getConfirmButton();
      expect(confirm).toBeDisabled();
      fireEvent.click(adjustButton('Zombie', 'plus'));
      fireEvent.click(adjustButton('Skeleton', 'plus'));
      expect(getTotalDisplay()).toHaveTextContent('Total creatures: 0 / 0');
      fireEvent.click(confirm);
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });
});
