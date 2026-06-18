// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ElderChampionRestoreModal from './ElderChampionRestoreModal.jsx';

// ── Mocked modules ──

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
}));

// ── Re-import mocked modules ──

import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

// ── Test fixtures ──

const baseProps = {
  action: { name: 'Elder Champion Restore' },
  playerStats: { name: 'Wizard1' },
  campaignName: 'test-campaign',
  onConfirm: vi.fn(),
  onClose: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

function renderModal(overrides) {
  return render(<ElderChampionRestoreModal {...makeProps(overrides)} />);
}

// ── Tests ──

describe('ElderChampionRestoreModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Initial render / display ──

  describe('initial render', () => {
    it('renders modal overlay and container with proper CSS classes', () => {
      renderModal();
      expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
      expect(document.querySelector('.sp-modal')).toBeInTheDocument();
      expect(document.querySelector('.sp-header')).toBeInTheDocument();
      expect(document.querySelector('.sp-body')).toBeInTheDocument();
      expect(document.querySelector('.sp-actions')).toBeInTheDocument();
    });

    it('renders header with fire icon and action name', () => {
      renderModal();
      expect(document.querySelector('.fa-fire')).toBeInTheDocument();
      expect(screen.getByText('Elder Champion Restore')).toBeInTheDocument();
    });

    it('renders body messages explaining Elder Champion rest usage and slot cost', () => {
      renderModal();
      expect(
        screen.getByText('Elder Champion has already been used this long rest.')
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Restore its use by expending a level 5 spell slot/)
      ).toBeInTheDocument();
    });

    it('displays available level 5 spell slot count from runtime value', () => {
      getRuntimeValue.mockReturnValue(3);
      renderModal();
      expect(screen.getByText(/3 available/)).toBeInTheDocument();
    });

    it('renders Expend Level 5 Slot button with xmark icon', () => {
      renderModal();
      expect(document.querySelector('.fa-xmark')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Expend Level 5 Slot/ })
      ).toBeInTheDocument();
    });

    it('renders Cancel button', () => {
      renderModal();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });
  });

  // ── Spell slot display and button disabled state ──

  describe('spell slot display and button state', () => {
    const assertExpendButton = () =>
      screen.getByRole('button', { name: /Expend Level 5 Slot/ });

    it('displays 0 available when runtime value is null', () => {
      getRuntimeValue.mockReturnValue(null);
      renderModal();
      expect(screen.getByText(/0 available/)).toBeInTheDocument();
      expect(assertExpendButton()).toBeDisabled();
    });

    it('displays 0 available when runtime value is 0', () => {
      getRuntimeValue.mockReturnValue(0);
      renderModal();
      expect(screen.getByText(/0 available/)).toBeInTheDocument();
      expect(assertExpendButton()).toBeDisabled();
    });

    it('displays negative value and disables expend button when runtime value is negative', () => {
      getRuntimeValue.mockReturnValue(-1);
      renderModal();
      expect(screen.getByText(/-1 available/)).toBeInTheDocument();
      expect(assertExpendButton()).toBeDisabled();
    });

    it('enables expend button when level 5 slots are available', () => {
      getRuntimeValue.mockReturnValue(2);
      renderModal();
      expect(screen.getByText(/2 available/)).toBeInTheDocument();
      expect(assertExpendButton()).toBeEnabled();
    });

    it('enables expend button when exactly 1 level 5 slot is available', () => {
      getRuntimeValue.mockReturnValue(1);
      renderModal();
      expect(screen.getByText(/1 available/)).toBeInTheDocument();
      expect(assertExpendButton()).toBeEnabled();
    });

    it('handles string numeric runtime value via Number() coercion', () => {
      getRuntimeValue.mockReturnValue('5');
      renderModal();
      expect(screen.getByText(/5 available/)).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Expend Level 5 Slot/ })
      ).toBeEnabled();
    });
  });

  // ── Close behavior ──

  describe('close behavior', () => {
    it('calls onClose when clicking the overlay background', () => {
      const onClose = vi.fn();
      renderModal({ onClose });
      fireEvent.click(document.querySelector('.sp-overlay'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when clicking inside the modal content', () => {
      const onClose = vi.fn();
      renderModal({ onClose });
      fireEvent.click(document.querySelector('.sp-modal'));
      expect(onClose).not.toHaveBeenCalled();
    });

    it('calls onClose when Cancel button is clicked', () => {
      const onClose = vi.fn();
      renderModal({ onClose });
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  // ── Confirm behavior ──

  describe('confirm behavior', () => {
    it('calls onConfirm when Expend Level 5 Slot button is clicked with slots available', () => {
      const onConfirm = vi.fn();
      getRuntimeValue.mockReturnValue(1);
      renderModal({ onConfirm });
      fireEvent.click(
        screen.getByRole('button', { name: /Expend Level 5 Slot/ })
      );
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('does not call onConfirm when expend button is disabled', () => {
      const onConfirm = vi.fn();
      getRuntimeValue.mockReturnValue(0);
      renderModal({ onConfirm });
      fireEvent.click(
        screen.getByRole('button', { name: /Expend Level 5 Slot/ })
      );
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it('does not call onConfirm when runtime value is null', () => {
      const onConfirm = vi.fn();
      getRuntimeValue.mockReturnValue(null);
      renderModal({ onConfirm });
      fireEvent.click(
        screen.getByRole('button', { name: /Expend Level 5 Slot/ })
      );
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  // ── Props integration ──

  describe('props integration', () => {
    it('passes playerStats.name and campaignName to getRuntimeValue', () => {
      getRuntimeValue.mockReturnValue(1);
      renderModal({
        playerStats: { name: 'Sorcerer2' },
        campaignName: 'my-campaign',
      });
      expect(getRuntimeValue).toHaveBeenCalledWith(
        'Sorcerer2',
        'spellSlotLevel5',
        'my-campaign'
      );
    });

    it('uses default campaignName from props when rendering', () => {
      getRuntimeValue.mockReturnValue(1);
      renderModal({ campaignName: 'test-campaign' });
      expect(getRuntimeValue).toHaveBeenCalledWith(
        'Wizard1',
        'spellSlotLevel5',
        'test-campaign'
      );
    });
  });
});
