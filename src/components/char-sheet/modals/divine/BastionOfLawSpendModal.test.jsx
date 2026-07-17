// @cleaned-by-ai
// @improved-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BastionOfLawSpendModal from './BastionOfLawSpendModal.jsx';

// ── Mocked modules ──

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => 10),
  useRuntimeValue: vi.fn((_name, key, _campaign) => {
    if (key === 'bastionOfLawWardDice') return ['1d8', '1d8', '1d8'];
    return undefined;
  }),
}));

vi.mock('../../../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 15, rolls: [8, 7], modifier: 0, formula: '2d8' })),
}));

// ── Re-import mocked modules ──

import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as diceRoller from '../../../../services/dice/diceRoller.js';

// ── Test fixtures ──

const baseProps = {
  featureName: 'Bastion of Law',
  playerName: 'AllyWarrior',
  campaignName: 'test-campaign',
  onClose: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

function renderModal(propsOverrides) {
  return render(<BastionOfLawSpendModal {...makeProps(propsOverrides)} />);
}

// ── Tests ──

describe('BastionOfLawSpendModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeState.getRuntimeValue.mockImplementation((player, key) => {
      if (key === 'bastionOfLawWardDice') return ['1d8', '1d8', '1d8'];
      return 10;
    });
    runtimeState.useRuntimeValue.mockImplementation((_name, key, _campaign) => {
      if (key === 'bastionOfLawWardDice') return ['1d8', '1d8', '1d8'];
      return undefined;
    });
    diceRoller.rollExpression.mockReturnValue({ total: 15, rolls: [8, 7], modifier: 0, formula: '2d8' });
  });

  // ── Initial render / display ──

  describe('initial render', () => {
    it('renders the overlay, modal, feature name, and ward info', () => {
      renderModal();
      expect(screen.getByText('Bastion of Law')).toBeInTheDocument();
      expect(screen.getByText(/Your magical ward is active/)).toBeInTheDocument();
    });

    it('renders the shield icon in the header', () => {
      renderModal();
      expect(document.querySelector('.fa-shield-halved')).toBeInTheDocument();
    });

    it('renders CSS structural classes on overlay, modal, section, and actions', () => {
      renderModal();
      expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
      expect(document.querySelector('.sp-modal')).toBeInTheDocument();
      expect(document.querySelector('.sp-header')).toBeInTheDocument();
      expect(document.querySelector('.sp-body')).toBeInTheDocument();
      expect(document.querySelector('.sp-actions')).toBeInTheDocument();
    });

    it('renders the ward dice count display', () => {
      renderModal();
      expect(screen.getByText('3d8')).toBeInTheDocument();
      expect(screen.getByText(/dice remaining/)).toBeInTheDocument();
    });

    it('renders the roll button', () => {
      renderModal();
      expect(screen.getByRole('button', { name: /Roll & Reduce Damage/ })).toBeInTheDocument();
    });

    it('renders the Done button', () => {
      renderModal();
      expect(screen.getByRole('button', { name: /Done/ })).toBeInTheDocument();
    });
  });

  // ── Roll result display ──

  describe('roll result display', () => {
    it('displays the roll result section with formula, rolls, total, and remaining dice', async () => {
      renderModal();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Roll & Reduce Damage/ }));
      });
      await waitFor(() => {
        const body = document.querySelector('.bastion-roll-result');
        expect(body).toBeInTheDocument();
        expect(body.textContent).toContain('15');
        expect(body.textContent).toContain('8, 7');
        expect(screen.getByText(/Remaining: 2d8/)).toBeInTheDocument();
      });
    });

    it('calls rollExpression with 1d8', async () => {
      renderModal();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Roll & Reduce Damage/ }));
      });
      expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d8');
    });
  });

  // ── Spend dice flow ──

  describe('spend dice flow', () => {
    it('calls onConfirm with 1 die and rollResultData when Roll & Reduce is clicked', async () => {
      const onConfirm = vi.fn().mockResolvedValue({ type: 'popup', payload: { description: 'Ward used' } });
      render(<BastionOfLawSpendModal {...makeProps({ onConfirm })} />);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Roll & Reduce Damage/ }));
      });

      expect(onConfirm).toHaveBeenCalledWith(1, expect.objectContaining({ total: 15, rolls: [8, 7] }));
    });

    it('does not call onConfirm when it is not provided', async () => {
      renderModal({ onConfirm: undefined });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Roll & Reduce Damage/ }));
      });
    });
  });

  // ── Ward empty state ──

  describe('ward empty state', () => {
    it('shows 0d8 when ward dice are empty', () => {
      runtimeState.useRuntimeValue.mockReturnValueOnce([]);
      renderModal();
      expect(screen.getByText('0d8')).toBeInTheDocument();
    });

    it('hides the roll button when ward dice count is 0', () => {
      runtimeState.useRuntimeValue.mockReturnValueOnce([]);
      renderModal();
      expect(screen.queryByRole('button', { name: /Roll & Reduce Damage/ })).not.toBeInTheDocument();
    });
  });

  // ── Close flows ──

  describe('close flows', () => {
    it('calls onClose when Done button is clicked', async () => {
      const onClose = vi.fn();
      render(<BastionOfLawSpendModal {...makeProps({ onClose })} />);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Done/ }));
      });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when overlay is clicked', async () => {
      const onClose = vi.fn();
      render(<BastionOfLawSpendModal {...makeProps({ onClose })} />);

      await act(async () => {
        fireEvent.click(document.querySelector('.sp-overlay'));
      });

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
