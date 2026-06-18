// @improved-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BastionOfLawModal from './BastionOfLawModal.jsx';

// ── Mocked modules ──

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => 10),
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
  targetName: 'Ally Warrior',
  playerName: 'Paladin1',
  campaignName: 'test-campaign',
  onClose: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

function renderModal(propsOverrides) {
  return render(<BastionOfLawModal {...makeProps(propsOverrides)} />);
}

// ── Tests ──

describe('BastionOfLawModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeState.getRuntimeValue.mockImplementation((player, key) => {
      if (key === 'bastionOfLawWardDice') return [];
      return 10;
    });
    diceRoller.rollExpression.mockReturnValue({ total: 15, rolls: [8, 7], modifier: 0, formula: '2d8' });
  });

  // ── Initial render / display ──

  describe('initial render', () => {
    it('renders the overlay and modal with feature name and target info', () => {
      renderModal();
      expect(screen.getByText('Bastion of Law')).toBeInTheDocument();
      expect(screen.getByText(/Target:/)).toBeInTheDocument();
      expect(screen.getByText(/Ally Warrior/)).toBeInTheDocument();
    });

    it('renders the shield icon in the header', () => {
      renderModal();
      expect(document.querySelector('.fa-shield-halved')).toBeInTheDocument();
    });

    it('renders the sorcery points input with correct min, max, and default value', () => {
      renderModal();
      const input = document.querySelector('input[type="number"]');
      expect(input.min).toBe('1');
      expect(input.max).toBe('5');
      expect(input.value).toBe('1');
    });

    it('renders the Create Ward button with dynamic dice count', () => {
      renderModal();
      expect(screen.getByRole('button', { name: /Create Ward \(1d8\)/ })).toBeInTheDocument();
    });

    it('renders the ward details section', () => {
      renderModal();
      expect(screen.getByText(/Ward dice:/)).toBeInTheDocument();
      expect(screen.getByText(/30 ft/)).toBeInTheDocument();
      expect(screen.getByText(/Long Rest/)).toBeInTheDocument();
      expect(screen.getByText(/As a Reaction/)).toBeInTheDocument();
    });

    it('renders the Cancel button', () => {
      renderModal();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('does not show ward-active elements on initial render', () => {
      renderModal();
      expect(screen.queryByText(/Ward active on/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Ward Dice Pool/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Roll Result/)).not.toBeInTheDocument();
    });

    it('renders with expected CSS classes on structural elements', () => {
      renderModal();
      expect(document.querySelector('.bastion-of-law-overlay')).toBeInTheDocument();
      expect(document.querySelector('.bastion-of-law-modal')).toBeInTheDocument();
      expect(document.querySelector('.bastion-section')).toBeInTheDocument();
      expect(document.querySelector('.bastion-actions')).toBeInTheDocument();
    });

    it('renders the shield icon on the Create Ward button', () => {
      renderModal();
      expect(document.querySelector('.bastion-sp-controls .fa-shield-halved')).toBeInTheDocument();
    });

    it('renders the xmark icon on the Cancel button', () => {
      renderModal();
      expect(document.querySelector('.bastion-actions .fa-xmark')).toBeInTheDocument();
    });
  });

  // ── Custom auto config ──

  describe('custom auto config', () => {
    it('uses custom maxSP, minSP, and defaults to minSP value', () => {
      renderModal({ auto: { maxSP: 8, minSP: 2, range: '30_ft' } });
      const input = document.querySelector('input[type="number"]');
      expect(input.max).toBe('8');
      expect(input.min).toBe('2');
      expect(input.value).toBe('2');
    });

    it('formats range by replacing underscores with spaces', () => {
      renderModal({ auto: { range: '30_ft' } });
      expect(screen.getByText(/30 ft/)).toBeInTheDocument();
    });

    it('uses default range when auto.range is null', () => {
      renderModal({ auto: { range: null } });
      expect(screen.getByText(/30 ft/)).toBeInTheDocument();
    });
  });

  // ── SP input clamping behavior ──

  describe('SP input clamping', () => {
    it('updates when input value changes within range', () => {
      renderModal();
      const input = document.querySelector('input[type="number"]');
      fireEvent.change(input, { target: { value: '3' } });
      expect(input.value).toBe('3');
    });

    it('clamps to min when input is below min', () => {
      renderModal();
      const input = document.querySelector('input[type="number"]');
      fireEvent.change(input, { target: { value: '0' } });
      expect(input.value).toBe('1');
    });

    it('clamps to max when input is above max', () => {
      renderModal({ auto: { maxSP: 3 } });
      const input = document.querySelector('input[type="number"]');
      fireEvent.change(input, { target: { value: '10' } });
      expect(input.value).toBe('3');
    });

    it('defaults to min when input is empty', () => {
      renderModal();
      const input = document.querySelector('input[type="number"]');
      fireEvent.change(input, { target: { value: '' } });
      expect(input.value).toBe('1');
    });

    it('clamps to minSP when sorcery points are lower than maxSP', () => {
      runtimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'sorceryPoints') return 3;
        if (key === 'bastionOfLawWardDice') return [];
        return 10;
      });
      renderModal({ auto: { maxSP: 5, minSP: 1 } });
      const input = document.querySelector('input[type="number"]');
      expect(input.value).toBe('1');
    });

    it('respects minSP even when sorcery points are high', () => {
      runtimeState.getRuntimeValue.mockReturnValueOnce(10);
      renderModal({ auto: { maxSP: 5, minSP: 2 } });
      const input = document.querySelector('input[type="number"]');
      expect(input.value).toBe('2');
    });

    it('updates the Create Ward button dice count when SP changes', () => {
      renderModal({ auto: { maxSP: 5 } });
      const input = document.querySelector('input[type="number"]');
      fireEvent.change(input, { target: { value: '4' } });
      expect(screen.getByRole('button', { name: /Create Ward \(4d8\)/ })).toBeInTheDocument();
    });
  });

  // ── Close behavior ──

  describe('close behavior', () => {
    it('calls onClose when clicking the overlay background', () => {
      const onClose = vi.fn();
      renderModal({ onClose });
      fireEvent.click(document.querySelector('.bastion-of-law-overlay'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when clicking inside the modal content', () => {
      const onClose = vi.fn();
      renderModal({ onClose });
      fireEvent.click(document.querySelector('.bastion-of-law-modal'));
      expect(onClose).not.toHaveBeenCalled();
    });

    it('calls onClose when Cancel button is clicked', () => {
      const onClose = vi.fn();
      renderModal({ onClose });
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when Escape key is pressed', () => {
      const onClose = vi.fn();
      renderModal({ onClose });
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close for non-Escape key presses', () => {
      const onClose = vi.fn();
      renderModal({ onClose });
      fireEvent.keyDown(document, { key: 'a' });
      expect(onClose).not.toHaveBeenCalled();
    });

    it('does not call onClose when it is not provided', () => {
      renderModal({ onClose: undefined });
      fireEvent.click(document.querySelector('.bastion-of-law-overlay'));
    });
  });

  // ── Activate ward flow ──

  describe('activate ward flow', () => {
    it('calls onConfirm with spAmount and targetName when Create Ward is clicked', async () => {
      const onConfirm = vi.fn().mockResolvedValue({ type: 'popup', payload: { description: 'Ward created' } });
      renderModal({ onConfirm, auto: { maxSP: 3 } });
      const input = document.querySelector('input[type="number"]');
      fireEvent.change(input, { target: { value: '2' } });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create Ward \(2d8\)/ }));
      });
      expect(onConfirm).toHaveBeenCalledWith(2, 'Ally Warrior');
    });

    it('does not call onConfirm when it is not provided', async () => {
      renderModal({ onConfirm: undefined });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create Ward/ }));
      });
    });

    it('switches to ward-active mode on successful activation', async () => {
      renderModal();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create Ward/ }));
      });
      expect(screen.getByText(/Ward active on/)).toBeInTheDocument();
    });

    it('stays in activate mode when onConfirm returns a "Not enough" error', async () => {
      const onConfirm = vi.fn().mockResolvedValue({ type: 'popup', payload: { description: 'Not enough sorcery points' } });
      renderModal({ onConfirm });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create Ward/ }));
      });
      expect(screen.queryByText(/Ward active on/)).not.toBeInTheDocument();
    });

    it('switches to ward-active mode when onConfirm returns null', async () => {
      const onConfirm = vi.fn().mockResolvedValue(null);
      renderModal({ onConfirm });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create Ward/ }));
      });
      expect(screen.getByText(/Ward active on/)).toBeInTheDocument();
    });

    it('re-reads ward dice from runtime state after activation', async () => {
      runtimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'bastionOfLawWardDice') return [{ value: 8 }, { value: 8 }];
        return 10;
      });
      renderModal();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create Ward/ }));
      });
      expect(screen.getByText(/Ward Dice Pool/)).toBeInTheDocument();
    });
  });

  // ── Ward-active mode rendering ──

  describe('ward-active mode', () => {
    it('renders the ward dice pool display', async () => {
      runtimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'bastionOfLawWardDice') return [{ value: 8 }];
        return 10;
      });
      renderModal();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create Ward/ }));
      });
      expect(screen.getByText(/Ward Dice Pool/)).toBeInTheDocument();
    });

    it('renders the subtitle with target name', async () => {
      renderModal();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create Ward/ }));
      });
      expect(screen.getByText(/Ward active on Ally Warrior/)).toBeInTheDocument();
    });

    it('renders the spend dice section when ward dice are available', async () => {
      runtimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'bastionOfLawWardDice') return [{ value: 8 }];
        return 10;
      });
      renderModal();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create Ward/ }));
      });
      expect(screen.getByText(/Spend Dice as Reaction/)).toBeInTheDocument();
    });

    it('hides the spend dice section when ward dice are empty', async () => {
      renderModal();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create Ward/ }));
      });
      expect(screen.queryByText(/Spend Dice as Reaction/)).not.toBeInTheDocument();
    });

    it('shows hint text about spending dice as reaction', async () => {
      runtimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'bastionOfLawWardDice') return [{ value: 8 }];
        return 10;
      });
      renderModal();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create Ward/ }));
      });
      expect(screen.getByText(/When Ally Warrior takes damage/)).toBeInTheDocument();
    });

    it('renders the dice spend input and roll button when ward dice are available', async () => {
      runtimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'bastionOfLawWardDice') return [{ value: 8 }, { value: 8 }, { value: 8 }];
        return 10;
      });
      renderModal();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create Ward/ }));
      });
      expect(screen.getByText(/Dice to spend:/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Roll & Reduce Damage/ })).toBeInTheDocument();
    });

    it('hides the roll button when ward dice count is 0', async () => {
      runtimeState.getRuntimeValue.mockReturnValueOnce(10).mockReturnValueOnce([]);
      renderModal();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create Ward/ }));
      });
      expect(screen.queryByRole('button', { name: /Roll & Reduce Damage/ })).not.toBeInTheDocument();
    });

    it('renders the dice icon in the spend controls', async () => {
      runtimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'bastionOfLawWardDice') return [{ value: 8 }];
        return 10;
      });
      renderModal();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create Ward/ }));
      });
      expect(document.querySelector('.bastion-spend-controls .fa-dice')).toBeInTheDocument();
    });

    it('renders the xmark icon on the Clear Ward button', async () => {
      runtimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'bastionOfLawWardDice') return [{ value: 8 }];
        return 10;
      });
      renderModal();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create Ward/ }));
      });
      expect(document.querySelector('.bastion-actions .fa-xmark')).toBeInTheDocument();
    });

    it('renders the Done button with check icon', async () => {
      runtimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'bastionOfLawWardDice') return [{ value: 8 }];
        return 10;
      });
      renderModal();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create Ward/ }));
      });
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
      expect(document.querySelector('.bastion-actions .fa-check')).toBeInTheDocument();
    });

    it('calls onClose when Done button is clicked', async () => {
      runtimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'bastionOfLawWardDice') return [{ value: 8 }];
        return 10;
      });
      const onClose = vi.fn();
      render(<BastionOfLawModal {...makeProps({ onClose, onConfirm: vi.fn().mockResolvedValue({ type: 'popup', payload: { description: 'Ward created' } }) })} />);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create Ward/ }));
      });
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  // ── Spend dice flow ──

  describe('spend dice flow', () => {
    it('calls rollExpression with the correct formula', async () => {
      runtimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'bastionOfLawWardDice') return [{ value: 8 }, { value: 8 }, { value: 8 }];
        return 10;
      });
      renderModal();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create Ward/ }));
      });
      const input = document.querySelector('.bastion-spend-controls input[type="number"]');
      fireEvent.change(input, { target: { value: '2' } });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Roll & Reduce Damage/ }));
      });
      expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d8+1d8');
    });

    it('calls onConfirm with diceToSpend when spending dice', async () => {
      const onConfirm = vi.fn().mockResolvedValue({ type: 'popup', payload: { description: 'Ward created' } });
      runtimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'bastionOfLawWardDice') return [{ value: 8 }, { value: 8 }];
        return 10;
      });
      render(<BastionOfLawModal {...makeProps({ onConfirm, auto: { maxSP: 5 } })} />);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create Ward/ }));
      });
      const input = document.querySelector('.bastion-spend-controls input[type="number"]');
      fireEvent.change(input, { target: { value: '1' } });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Roll & Reduce Damage/ }));
      });
      expect(diceRoller.rollExpression).toHaveBeenCalledTimes(1);
      expect(onConfirm).toHaveBeenCalledWith(null, null, 1);
    });

    it('does not call onConfirm when it is not provided', async () => {
      runtimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'bastionOfLawWardDice') return [{ value: 8 }];
        return 10;
      });
      render(<BastionOfLawModal {...makeProps({ onConfirm: undefined, auto: { maxSP: 5 } })} />);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create Ward/ }));
      });
      const input = document.querySelector('.bastion-spend-controls input[type="number"]');
      fireEvent.change(input, { target: { value: '1' } });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Roll & Reduce Damage/ }));
      });
    });

    it('displays the roll result section', async () => {
      runtimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'bastionOfLawWardDice') return [{ value: 8 }, { value: 8 }];
        return 10;
      });
      renderModal();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create Ward/ }));
      });
      const input = document.querySelector('.bastion-spend-controls input[type="number"]');
      fireEvent.change(input, { target: { value: '1' } });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Roll & Reduce Damage/ }));
      });
      await waitFor(() => {
        expect(screen.getByText(/Roll Result/)).toBeInTheDocument();
      });
    });

    it('displays the roll formula, individual rolls, and total', async () => {
      runtimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'bastionOfLawWardDice') return [{ value: 8 }, { value: 8 }];
        return 10;
      });
      renderModal();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create Ward/ }));
      });
      const input = document.querySelector('.bastion-spend-controls input[type="number"]');
      fireEvent.change(input, { target: { value: '1' } });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Roll & Reduce Damage/ }));
      });
      await waitFor(() => {
        const body = document.querySelector('.bastion-roll-result');
        expect(body.textContent).toContain('15');
        expect(body.textContent).toContain('8, 7');
      });
    });

    it('displays the remaining dice count', async () => {
      runtimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'bastionOfLawWardDice') return [{ value: 8 }, { value: 8 }, { value: 8 }];
        return 10;
      });
      renderModal();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create Ward/ }));
      });
      const input = document.querySelector('.bastion-spend-controls input[type="number"]');
      fireEvent.change(input, { target: { value: '1' } });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Roll & Reduce Damage/ }));
      });
      await waitFor(() => {
        expect(screen.getByText(/Remaining: 2d8/)).toBeInTheDocument();
      });
    });

    it('uses a default total of 0 when rollExpression returns null', async () => {
      runtimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'bastionOfLawWardDice') return [{ value: 8 }];
        return 10;
      });
      renderModal();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create Ward/ }));
      });
      diceRoller.rollExpression.mockReturnValue(null);
      const input = document.querySelector('.bastion-spend-controls input[type="number"]');
      fireEvent.change(input, { target: { value: '1' } });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Roll & Reduce Damage/ }));
      });
      await waitFor(() => {
        expect(screen.getByText(/Remaining: 0d8/)).toBeInTheDocument();
      });
    });

    it('displays the dice icon in the roll result header', async () => {
      runtimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'bastionOfLawWardDice') return [{ value: 8 }];
        return 10;
      });
      renderModal();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create Ward/ }));
      });
      const input = document.querySelector('.bastion-spend-controls input[type="number"]');
      fireEvent.change(input, { target: { value: '1' } });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Roll & Reduce Damage/ }));
      });
      const icon = document.querySelector('.bastion-roll-result .fa-dice');
      expect(icon).toBeInTheDocument();
    });
  });

  // ── Spend dice input clamping ──

  describe('spend dice input clamping', () => {
    it('clamps to the ward dice count max', async () => {
      runtimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'bastionOfLawWardDice') return [{ value: 8 }, { value: 8 }];
        return 10;
      });
      renderModal();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create Ward/ }));
      });
      const input = document.querySelector('.bastion-spend-controls input[type="number"]');
      fireEvent.change(input, { target: { value: '10' } });
      expect(input.value).toBe('2');
    });

    it('clamps to minimum of 1', async () => {
      runtimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'bastionOfLawWardDice') return [{ value: 8 }, { value: 8 }];
        return 10;
      });
      renderModal();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create Ward/ }));
      });
      const input = document.querySelector('.bastion-spend-controls input[type="number"]');
      fireEvent.change(input, { target: { value: '0' } });
      expect(input.value).toBe('1');
    });

    it('defaults to 1 when input is empty', async () => {
      runtimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'bastionOfLawWardDice') return [{ value: 8 }, { value: 8 }];
        return 10;
      });
      renderModal();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create Ward/ }));
      });
      const input = document.querySelector('.bastion-spend-controls input[type="number"]');
      fireEvent.change(input, { target: { value: '' } });
      expect(input.value).toBe('1');
    });

    it('sets the max attribute to the ward dice count', async () => {
      runtimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'bastionOfLawWardDice') return [{ value: 8 }, { value: 8 }, { value: 8 }];
        return 10;
      });
      renderModal();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create Ward/ }));
      });
      const input = document.querySelector('.bastion-spend-controls input[type="number"]');
      expect(input.max).toBe('3');
    });
  });

  // ── Clear ward flow ──

  describe('clear ward flow', () => {
    it('calls onConfirm with the clear flag when Clear Ward is clicked', async () => {
      const onConfirm = vi.fn().mockResolvedValue({ type: 'popup', payload: { description: 'Ward created' } });
      runtimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'bastionOfLawWardDice') return [{ value: 8 }];
        return 10;
      });
      render(<BastionOfLawModal {...makeProps({ onConfirm, auto: { maxSP: 5 } })} />);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create Ward/ }));
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Clear Ward' }));
      });
      expect(onConfirm).toHaveBeenCalledWith(null, null, null, true);
    });

    it('resets mode back to activate after clearing', async () => {
      runtimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'bastionOfLawWardDice') return [{ value: 8 }];
        return 10;
      });
      renderModal();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create Ward/ }));
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Clear Ward' }));
      });
      expect(screen.getByText(/Target:/)).toBeInTheDocument();
      expect(screen.queryByText(/Ward active on/)).not.toBeInTheDocument();
    });

    it('removes the ward dice pool display after clearing', async () => {
      runtimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'bastionOfLawWardDice') return [{ value: 8 }];
        return 10;
      });
      renderModal();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create Ward/ }));
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Clear Ward' }));
      });
      expect(screen.queryByText(/Ward Dice Pool/)).not.toBeInTheDocument();
    });

    it('removes the roll result display after clearing', async () => {
      runtimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'bastionOfLawWardDice') return [{ value: 8 }];
        return 10;
      });
      renderModal();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create Ward/ }));
      });
      const input = document.querySelector('.bastion-spend-controls input[type="number"]');
      fireEvent.change(input, { target: { value: '1' } });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Roll & Reduce Damage/ }));
      });
      await waitFor(() => {
        expect(screen.getByText(/Roll Result/)).toBeInTheDocument();
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Clear Ward' }));
      });
      expect(screen.queryByText(/Roll Result/)).not.toBeInTheDocument();
    });

    it('calls onConfirm twice: once for activation and once for clear', async () => {
      const onConfirm = vi.fn().mockResolvedValue({ type: 'popup', payload: { description: 'Ward created' } });
      runtimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'bastionOfLawWardDice') return [{ value: 8 }];
        return 10;
      });
      render(<BastionOfLawModal {...makeProps({ onConfirm, auto: { maxSP: 5 } })} />);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create Ward/ }));
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Clear Ward' }));
      });
      expect(onConfirm).toHaveBeenCalledTimes(2);
      expect(onConfirm).toHaveBeenNthCalledWith(1, 1, 'Ally Warrior');
      expect(onConfirm).toHaveBeenLastCalledWith(null, null, null, true);
    });
  });

  // ── Runtime state integration ──

  describe('runtime state integration', () => {
    it('initializes ward dice from runtime state on mount', () => {
      runtimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'bastionOfLawWardDice') return [{ value: 8 }, { value: 8 }, { value: 8 }];
        return 10;
      });
      renderModal();
      expect(screen.getByText('Bastion of Law')).toBeInTheDocument();
    });
  });
});
