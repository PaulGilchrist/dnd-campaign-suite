// @cleaned-by-ai
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

  describe('initial render', () => {
    it('renders modal with header, body messages, and action buttons', () => {
      renderModal();
      expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
      expect(document.querySelector('.sp-modal')).toBeInTheDocument();
      expect(screen.getByText('Elder Champion Restore')).toBeInTheDocument();
      expect(
        screen.getByText('Elder Champion has already been used this long rest.')
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Restore its use by expending a level 5 spell slot/)
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Expend Level 5 Slot/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('displays available level 5 spell slot count from runtime value', () => {
      getRuntimeValue.mockReturnValue(3);
      renderModal();
      expect(screen.getByText(/3 available/)).toBeInTheDocument();
    });
  });

  describe('spell slot display and button state', () => {
    it('displays 0 available and disables expend button when slots are unavailable', () => {
      getRuntimeValue.mockReturnValue(0);
      renderModal();
      expect(screen.getByText(/0 available/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Expend Level 5 Slot/ })).toBeDisabled();
    });

    it('displays available count and enables expend button when slots are available', () => {
      getRuntimeValue.mockReturnValue(2);
      renderModal();
      expect(screen.getByText(/2 available/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Expend Level 5 Slot/ })).toBeEnabled();
    });
  });

  describe('confirm behavior', () => {
    it('calls onConfirm when Expend Level 5 Slot button is clicked with slots available', () => {
      const onConfirm = vi.fn();
      getRuntimeValue.mockReturnValue(1);
      renderModal({ onConfirm });
      fireEvent.click(screen.getByRole('button', { name: /Expend Level 5 Slot/ }));
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('does not call onConfirm when expend button is disabled', () => {
      const onConfirm = vi.fn();
      getRuntimeValue.mockReturnValue(0);
      renderModal({ onConfirm });
      fireEvent.click(screen.getByRole('button', { name: /Expend Level 5 Slot/ }));
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

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
  });
});
