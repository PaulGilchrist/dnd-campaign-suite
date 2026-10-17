// @maintained-by-ai
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CreateUndeadModal from './CreateUndeadModal.jsx';

// Single-counter modal: the [1, maxTargets] clamp on one ghoul counter is
// owned here. Multi-creature cap-crossing clamping (zombie⇄skeleton trims)
// and the disabled-at-zero confirm are owned by AnimateDeadModal.test.jsx;
// checkbox target selection, row-disable-at-cap, overlay pre-selection and
// distance badges are owned by shared/CreatureSelectionModal.test.jsx —
// this modal has none of those mechanics (one counter, never-disabled confirm).

// ── Fixtures & helpers ──

function renderModal(overrides) {
  const props = {
    maxTargets: 3,
    onConfirm: vi.fn(),
    onClose: vi.fn(),
    ...(overrides || {}),
  };
  render(<CreateUndeadModal {...props} />);
  return props;
}

function getTotalDisplay() {
  return screen.getByText(/Total creatures:/);
}

function getConfirmButton() {
  return screen.getByRole('button', { name: /Create Undead \(\d+\)/ });
}

// Locate the row's +/- button by its FontAwesome icon, scoped to the row
// containing the creature label (AnimateDeadModal.test.jsx convention).
function adjustButton(dir) {
  const row = screen.getByText('Ghoul(s)').closest('div');
  const btn = within(row)
    .getAllByRole('button')
    .find((b) => b.querySelector(`i.fa-${dir}`));
  if (!btn) throw new Error(`${dir} button for Ghoul not found`);
  return btn;
}

// The count is the only plain-number text node in the creature row.
function countFor() {
  const row = screen.getByText('Ghoul(s)').closest('div');
  return within(row).getByText(/^\d+$/).textContent;
}

// ── Tests ──

describe('CreateUndeadModal', () => {
  // ── Rendering ──

  describe('initial render', () => {
    it('renders header, capacity text, ghoul row, totals, and buttons', () => {
      renderModal({ maxTargets: 5 });
      expect(screen.getByText('Create Undead')).toBeInTheDocument();
      expect(screen.getByText(/You can create up to/)).toHaveTextContent(
        'You can create up to 5 ghoul(s). Choose how many to summon.'
      );
      expect(countFor()).toBe('1');
      expect(getTotalDisplay()).toHaveTextContent('Total creatures: 1 / 5');
      expect(getConfirmButton()).toHaveTextContent('Create Undead (1)');
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });
  });

  // ── Count adjustment ──

  describe('count adjustment', () => {
    it('plus raises the count and minus lowers it; total and confirm label track it', () => {
      renderModal({ maxTargets: 5 });
      fireEvent.click(adjustButton('plus'));
      expect(countFor()).toBe('2');
      expect(getTotalDisplay()).toHaveTextContent('Total creatures: 2 / 5');
      expect(getConfirmButton()).toHaveTextContent('Create Undead (2)');

      fireEvent.click(adjustButton('minus'));
      expect(countFor()).toBe('1');
      expect(getTotalDisplay()).toHaveTextContent('Total creatures: 1 / 5');
      expect(getConfirmButton()).toHaveTextContent('Create Undead (1)');
    });

    it('minus floors at 1 even when maxTargets is 0 (min clamp beats zero cap)', () => {
      renderModal({ maxTargets: 0 });
      fireEvent.click(adjustButton('minus'));
      fireEvent.click(adjustButton('minus'));
      expect(countFor()).toBe('1');
      expect(getTotalDisplay()).toHaveTextContent('Total creatures: 1 / 0');
    });

    it('plus clamps at maxTargets and stays inert past the cap', () => {
      renderModal({ maxTargets: 2 });
      fireEvent.click(adjustButton('plus')); // 1 → 2
      fireEvent.click(adjustButton('plus')); // inert at cap
      fireEvent.click(adjustButton('plus')); // inert at cap
      expect(countFor()).toBe('2');
      expect(getTotalDisplay()).toHaveTextContent('Total creatures: 2 / 2');
      expect(getConfirmButton()).toHaveTextContent('Create Undead (2)');
    });
  });

  // ── Confirm ──

  describe('confirm', () => {
    it.each([0, 2, 4])(
      'calls onConfirm once with the exact ghoulCount after %i plus clicks',
      (clicks) => {
        const { onConfirm } = renderModal({ maxTargets: 5 });
        for (let i = 0; i < clicks; i++) {
          fireEvent.click(adjustButton('plus'));
        }
        expect(countFor()).toBe(String(1 + clicks));
        fireEvent.click(getConfirmButton());
        expect(onConfirm).toHaveBeenCalledTimes(1);
        expect(onConfirm).toHaveBeenCalledWith({ ghoulCount: 1 + clicks });
      }
    );
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
    // Pins current product behaviour: unlike AnimateDeadModal, confirm is
    // never disabled and the min-1 clamp lets a zero-cap confirm through.
    it('handles maxTargets of 0: inert controls, enabled confirm summing one ghoul', () => {
      const { onConfirm } = renderModal({ maxTargets: 0 });
      expect(screen.getByText(/You can create up to/)).toHaveTextContent('0');
      expect(getTotalDisplay()).toHaveTextContent('Total creatures: 1 / 0');
      fireEvent.click(adjustButton('plus'));
      expect(countFor()).toBe('1');
      const confirm = getConfirmButton();
      expect(confirm).toBeEnabled();
      fireEvent.click(confirm);
      expect(onConfirm).toHaveBeenCalledWith({ ghoulCount: 1 });
    });
  });
});
