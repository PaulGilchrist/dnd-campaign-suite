import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BastionOfLawModal from './BastionOfLawModal.jsx';

// ── Mocked modules ──

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((player, key) => {
    if (key === 'bastionOfLawWardDice') return [];
    return 10;
  }),
}));

vi.mock('../../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 15, rolls: [8, 7], modifier: 0, formula: '2d8' })),
}));

// ── Re-import mocked modules ──

import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';
import * as diceRoller from '../../../services/dice/diceRoller.js';

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

// ── Tests ──

describe('BastionOfLawModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeState.getRuntimeValue.mockImplementation((player, key) => {
      if (key === 'bastionOfLawWardDice') return [];
      return 10;
    });
    diceRoller.rollExpression.mockReturnValue({ total: 15, rolls: [8, 7], modifier: 0, formula: '2d8' });
    localStorage.clear();
  });

  // ── Initial render / display ──

  it('renders modal overlay and header with feature name', () => {
    render(<BastionOfLawModal {...makeProps()} />);
    expect(screen.getByText('Bastion of Law')).toBeInTheDocument();
    expect(document.querySelector('.bastion-of-law-overlay')).toBeInTheDocument();
  });

  it('displays target name in the modal body', () => {
    render(<BastionOfLawModal {...makeProps()} />);
    expect(screen.getByText(/Target:/)).toBeInTheDocument();
    expect(screen.getByText(/Ally Warrior/)).toBeInTheDocument();
  });

  it('renders Font Awesome shield icon in header', () => {
    render(<BastionOfLawModal {...makeProps()} />);
    const icon = document.querySelector('.fa-shield-halved');
    expect(icon).toBeInTheDocument();
  });

  it('renders sorcery points input with correct min/max', () => {
    render(<BastionOfLawModal {...makeProps()} />);
    const input = document.querySelector('input[type="number"]');
    expect(input).toBeInTheDocument();
    expect(input.min).toBe('1');
    expect(input.max).toBe('5');
    expect(input.value).toBe('1');
  });

  it('renders Create Ward button with dice count', () => {
    render(<BastionOfLawModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: /Create Ward \(1d8\)/ })).toBeInTheDocument();
  });

  it('displays ward details list', () => {
    render(<BastionOfLawModal {...makeProps()} />);
    expect(screen.getByText(/Ward dice:/)).toBeInTheDocument();
    expect(screen.getByText(/30 ft/)).toBeInTheDocument();
    expect(screen.getByText(/Long Rest/)).toBeInTheDocument();
    expect(screen.getByText(/As a Reaction/)).toBeInTheDocument();
  });

  it('renders Cancel button', () => {
    render(<BastionOfLawModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('renders with default auto values (maxSP=5, minSP=1)', () => {
    render(<BastionOfLawModal {...makeProps()} />);
    const input = document.querySelector('input[type="number"]');
    expect(input.max).toBe('5');
    expect(input.min).toBe('1');
    expect(input.value).toBe('1');
  });

  it('renders with custom auto maxSP and minSP', () => {
    render(<BastionOfLawModal {...makeProps({ auto: { maxSP: 8, minSP: 2, range: '30_ft' } })} />);
    const input = document.querySelector('input[type="number"]');
    expect(input.max).toBe('8');
    expect(input.min).toBe('2');
    expect(input.value).toBe('2');
  });

  it('formats range with underscores replaced by spaces', () => {
    render(<BastionOfLawModal {...makeProps({ auto: { range: '30_ft' } })} />);
    expect(screen.getByText(/30 ft/)).toBeInTheDocument();
  });

  it('uses default range when auto.range is null', () => {
    render(<BastionOfLawModal {...makeProps({ auto: { range: null } })} />);
    expect(screen.getByText(/30 ft/)).toBeInTheDocument();
  });

  // ── Overlay click behavior ──

  it('calls onClose when clicking the overlay background', () => {
    const onClose = vi.fn();
    render(<BastionOfLawModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.bastion-of-law-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking inside the modal content', () => {
    const onClose = vi.fn();
    render(<BastionOfLawModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.bastion-of-law-modal'));
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Cancel button ──

  it('calls onClose when Cancel button is clicked', () => {
    const onClose = vi.fn();
    render(<BastionOfLawModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Escape key ──

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn();
    render(<BastionOfLawModal {...makeProps({ onClose })} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose for other key presses', () => {
    const onClose = vi.fn();
    render(<BastionOfLawModal {...makeProps({ onClose })} />);
    fireEvent.keyDown(document, { key: 'a' });
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Sorcery point input changes ──

  it('updates SP amount when input value changes', () => {
    render(<BastionOfLawModal {...makeProps()} />);
    const input = document.querySelector('input[type="number"]');
    fireEvent.change(input, { target: { value: '3' } });
    expect(input.value).toBe('3');
  });

  it('clamps SP amount to min when input is below min', () => {
    render(<BastionOfLawModal {...makeProps()} />);
    const input = document.querySelector('input[type="number"]');
    fireEvent.change(input, { target: { value: '0' } });
    expect(input.value).toBe('1');
  });

  it('clamps SP amount to max when input is above max', () => {
    render(<BastionOfLawModal {...makeProps({ auto: { maxSP: 3 } })} />);
    const input = document.querySelector('input[type="number"]');
    fireEvent.change(input, { target: { value: '10' } });
    expect(input.value).toBe('3');
  });

  it('defaults to min when input is empty/invalid', () => {
    render(<BastionOfLawModal {...makeProps()} />);
    const input = document.querySelector('input[type="number"]');
    fireEvent.change(input, { target: { value: '' } });
    expect(input.value).toBe('1');
  });

  // ── Activate ward flow ──

  it('calls onConfirm with spAmount and targetName when Create Ward is clicked', async () => {
    const onConfirm = vi.fn().mockResolvedValue({ type: 'popup', payload: { description: 'Ward created' } });
    render(<BastionOfLawModal {...makeProps({ onConfirm, auto: { maxSP: 3 } })} />);
    const input = document.querySelector('input[type="number"]');
    fireEvent.change(input, { target: { value: '2' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Create Ward \(2d8\)/ }));
    });
    expect(onConfirm).toHaveBeenCalledWith(2, 'Ally Warrior');
  });

  it('does not call onConfirm when it is not provided', async () => {
    render(<BastionOfLawModal {...makeProps({ onConfirm: undefined })} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Create Ward/ }));
    });
  });

  it('switches to ward-active mode after successful activation', async () => {
    const onConfirm = vi.fn().mockResolvedValue({ type: 'popup', payload: { description: 'Ward created' } });
    render(<BastionOfLawModal {...makeProps({ onConfirm })} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Create Ward/ }));
    });
    expect(screen.getByText(/Ward active on/)).toBeInTheDocument();
  });

  it('does not switch to ward-active mode when onConfirm returns "Not enough" error', async () => {
    const onConfirm = vi.fn().mockResolvedValue({ type: 'popup', payload: { description: 'Not enough sorcery points' } });
    render(<BastionOfLawModal {...makeProps({ onConfirm })} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Create Ward/ }));
    });
    expect(screen.queryByText(/Ward active on/)).not.toBeInTheDocument();
  });

  it('switches to ward-active mode even when onConfirm returns null', async () => {
    const onConfirm = vi.fn().mockResolvedValue(null);
    render(<BastionOfLawModal {...makeProps({ onConfirm })} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Create Ward/ }));
    });
    expect(screen.getByText(/Ward active on/)).toBeInTheDocument();
  });

  // ── Ward-active mode rendering ──

  it('renders ward-active mode with dice pool display', async () => {
    const onConfirm = vi.fn().mockResolvedValue({ type: 'popup', payload: { description: 'Ward created' } });
    render(<BastionOfLawModal {...makeProps({ onConfirm })} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Create Ward/ }));
    });
    expect(screen.getByText(/Ward Dice Pool/)).toBeInTheDocument();
  });

  it('shows spend dice section when ward dice are available', async () => {
    runtimeState.getRuntimeValue.mockImplementation((player, key) => {
      if (key === 'bastionOfLawWardDice') return [{ value: 8 }];
      return 10;
    });
    const onConfirm = vi.fn().mockResolvedValue({ type: 'popup', payload: { description: 'Ward created' } });
    render(<BastionOfLawModal {...makeProps({ onConfirm })} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Create Ward/ }));
    });
    expect(screen.getByText(/Spend Dice as Reaction/)).toBeInTheDocument();
  });

  it('hides spend dice section when ward dice are empty', async () => {
    const onConfirm = vi.fn().mockResolvedValue({ type: 'popup', payload: { description: 'Ward created' } });
    render(<BastionOfLawModal {...makeProps({ onConfirm })} />);
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
    const onConfirm = vi.fn().mockResolvedValue({ type: 'popup', payload: { description: 'Ward created' } });
    render(<BastionOfLawModal {...makeProps({ onConfirm })} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Create Ward/ }));
    });
    expect(screen.getByText(/When Ally Warrior takes damage/)).toBeInTheDocument();
  });

  // ── Spend dice flow ──

  it('renders dice spend input and roll button in ward-active mode', async () => {
    runtimeState.getRuntimeValue.mockImplementation((player, key) => {
      if (key === 'bastionOfLawWardDice') return [{ value: 8 }, { value: 8 }, { value: 8 }];
      return 10;
    });
    const onConfirm = vi.fn().mockResolvedValue({ type: 'popup', payload: { description: 'Ward created' } });
    render(<BastionOfLawModal {...makeProps({ onConfirm })} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Create Ward/ }));
    });
    expect(screen.getByText(/Dice to spend:/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Roll & Reduce Damage/ })).toBeInTheDocument();
  });

  it('calls rollExpression with correct formula when spending dice', async () => {
    runtimeState.getRuntimeValue.mockImplementation((player, key) => {
      if (key === 'bastionOfLawWardDice') return [{ value: 8 }, { value: 8 }, { value: 8 }];
      return 10;
    });
    const onConfirm = vi.fn().mockResolvedValue({ type: 'popup', payload: { description: 'Ward created' } });
    render(<BastionOfLawModal {...makeProps({ onConfirm })} />);
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
    runtimeState.getRuntimeValue.mockImplementation((player, key) => {
      if (key === 'bastionOfLawWardDice') return [{ value: 8 }, { value: 8 }];
      return 10;
    });
    const onConfirm = vi.fn().mockResolvedValue({ type: 'popup', payload: { description: 'Ward created' } });
    render(<BastionOfLawModal {...makeProps({ onConfirm })} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Create Ward/ }));
    });
    const input = document.querySelector('.bastion-spend-controls input[type="number"]');
    fireEvent.change(input, { target: { value: '1' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Roll & Reduce Damage/ }));
    });
    expect(onConfirm).toHaveBeenCalledWith(null, null, 1);
  });

  it('displays roll result after spending dice', async () => {
    runtimeState.getRuntimeValue.mockImplementation((player, key) => {
      if (key === 'bastionOfLawWardDice') return [{ value: 8 }, { value: 8 }];
      return 10;
    });
    const onConfirm = vi.fn().mockResolvedValue({ type: 'popup', payload: { description: 'Ward created' } });
    render(<BastionOfLawModal {...makeProps({ onConfirm })} />);
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

  it('displays roll formula and total in result', async () => {
    runtimeState.getRuntimeValue.mockImplementation((player, key) => {
      if (key === 'bastionOfLawWardDice') return [{ value: 8 }, { value: 8 }];
      return 10;
    });
    const onConfirm = vi.fn().mockResolvedValue({ type: 'popup', payload: { description: 'Ward created' } });
    render(<BastionOfLawModal {...makeProps({ onConfirm })} />);
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

  it('displays remaining dice count in roll result', async () => {
    runtimeState.getRuntimeValue.mockImplementation((player, key) => {
      if (key === 'bastionOfLawWardDice') return [{ value: 8 }, { value: 8 }, { value: 8 }];
      return 10;
    });
    const onConfirm = vi.fn().mockResolvedValue({ type: 'popup', payload: { description: 'Ward created' } });
    render(<BastionOfLawModal {...makeProps({ onConfirm })} />);
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

  it('hides roll result after 3 seconds', async () => {
    runtimeState.getRuntimeValue.mockImplementation((player, key) => {
      if (key === 'bastionOfLawWardDice') return [{ value: 8 }];
      return 10;
    });
    const onConfirm = vi.fn().mockResolvedValue({ type: 'popup', payload: { description: 'Ward created' } });
    render(<BastionOfLawModal {...makeProps({ onConfirm })} />);
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
      await new Promise(r => setTimeout(r, 3500));
    });
    expect(screen.queryByText(/Roll Result/)).not.toBeInTheDocument();
  });

  it('clamps dice spend input to ward dice count max', async () => {
    runtimeState.getRuntimeValue.mockImplementation((player, key) => {
      if (key === 'bastionOfLawWardDice') return [{ value: 8 }, { value: 8 }];
      return 10;
    });
    const onConfirm = vi.fn().mockResolvedValue({ type: 'popup', payload: { description: 'Ward created' } });
    render(<BastionOfLawModal {...makeProps({ onConfirm })} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Create Ward/ }));
    });
    const input = document.querySelector('.bastion-spend-controls input[type="number"]');
    fireEvent.change(input, { target: { value: '10' } });
    expect(input.value).toBe('2');
  });

  it('clamps dice spend input to minimum of 1', async () => {
    runtimeState.getRuntimeValue.mockImplementation((player, key) => {
      if (key === 'bastionOfLawWardDice') return [{ value: 8 }, { value: 8 }];
      return 10;
    });
    const onConfirm = vi.fn().mockResolvedValue({ type: 'popup', payload: { description: 'Ward created' } });
    render(<BastionOfLawModal {...makeProps({ onConfirm })} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Create Ward/ }));
    });
    const input = document.querySelector('.bastion-spend-controls input[type="number"]');
    fireEvent.change(input, { target: { value: '0' } });
    expect(input.value).toBe('1');
  });

  it('shows dice spend input max attribute equal to ward dice count', async () => {
    runtimeState.getRuntimeValue.mockImplementation((player, key) => {
      if (key === 'bastionOfLawWardDice') return [{ value: 8 }, { value: 8 }, { value: 8 }];
      return 10;
    });
    const onConfirm = vi.fn().mockResolvedValue({ type: 'popup', payload: { description: 'Ward created' } });
    render(<BastionOfLawModal {...makeProps({ onConfirm })} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Create Ward/ }));
    });
    const input = document.querySelector('.bastion-spend-controls input[type="number"]');
    expect(input.max).toBe('3');
  });

  // ── Clear ward flow ──

  it('calls onConfirm with clear flag when Clear Ward is clicked', async () => {
    runtimeState.getRuntimeValue.mockImplementation((player, key) => {
      if (key === 'bastionOfLawWardDice') return [{ value: 8 }];
      return 10;
    });
    const onConfirm = vi.fn().mockResolvedValue({ type: 'popup', payload: { description: 'Ward created' } });
    render(<BastionOfLawModal {...makeProps({ onConfirm })} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Create Ward/ }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Clear Ward' }));
    });
    expect(onConfirm).toHaveBeenCalledWith(null, null, null, true);
  });

  it('resets mode back to activate after clearing ward', async () => {
    runtimeState.getRuntimeValue.mockImplementation((player, key) => {
      if (key === 'bastionOfLawWardDice') return [{ value: 8 }];
      return 10;
    });
    const onConfirm = vi.fn().mockResolvedValue({ type: 'popup', payload: { description: 'Ward created' } });
    render(<BastionOfLawModal {...makeProps({ onConfirm })} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Create Ward/ }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Clear Ward' }));
    });
    expect(screen.getByText(/Target:/)).toBeInTheDocument();
    expect(screen.queryByText(/Ward active on/)).not.toBeInTheDocument();
  });

  it('clears the ward dice display after clearing', async () => {
    runtimeState.getRuntimeValue.mockImplementation((player, key) => {
      if (key === 'bastionOfLawWardDice') return [{ value: 8 }];
      return 10;
    });
    const onConfirm = vi.fn().mockResolvedValue({ type: 'popup', payload: { description: 'Ward created' } });
    render(<BastionOfLawModal {...makeProps({ onConfirm })} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Create Ward/ }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Clear Ward' }));
    });
    expect(screen.queryByText(/Ward Dice Pool/)).not.toBeInTheDocument();
  });

  // ── Done button ──

  it('renders Done button with check icon in ward-active mode', async () => {
    runtimeState.getRuntimeValue.mockImplementation((player, key) => {
      if (key === 'bastionOfLawWardDice') return [{ value: 8 }];
      return 10;
    });
    const onConfirm = vi.fn().mockResolvedValue({ type: 'popup', payload: { description: 'Ward created' } });
    render(<BastionOfLawModal {...makeProps({ onConfirm })} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Create Ward/ }));
    });
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
  });

  // ── Runtime state integration ──

  it('clamps SP amount state when sorcery points are lower than maxSP', () => {
    runtimeState.getRuntimeValue.mockImplementation((player, key) => {
      if (key === 'sorceryPoints') return 3;
      if (key === 'bastionOfLawWardDice') return [];
      return 10;
    });
    render(<BastionOfLawModal {...makeProps({ auto: { maxSP: 5, minSP: 1 } })} />);
    const input = document.querySelector('input[type="number"]');
    expect(input.value).toBe('1');
  });

  it('respects minSP even when sorcery points are high', () => {
    runtimeState.getRuntimeValue.mockReturnValueOnce(10);
    render(<BastionOfLawModal {...makeProps({ auto: { maxSP: 5, minSP: 2 } })} />);
    const input = document.querySelector('input[type="number"]');
    expect(input.value).toBe('2');
  });

  it('initializes ward dice from runtime state on mount', () => {
    runtimeState.getRuntimeValue.mockImplementation((player, key) => {
      if (key === 'bastionOfLawWardDice') return [{ value: 8 }, { value: 8 }, { value: 8 }];
      return 10;
    });
    const onConfirm = vi.fn().mockResolvedValue({ type: 'popup', payload: { description: 'Ward created' } });
    render(<BastionOfLawModal {...makeProps({ onConfirm })} />);
    expect(screen.getByText('Bastion of Law')).toBeInTheDocument();
  });

  // ── Edge cases ──

  it('does not show result or active ward on initial render', () => {
    render(<BastionOfLawModal {...makeProps()} />);
    expect(screen.queryByText(/Ward active on/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Ward Dice Pool/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Roll Result/)).not.toBeInTheDocument();
  });

  it('renders with proper CSS classes', () => {
    render(<BastionOfLawModal {...makeProps()} />);
    expect(document.querySelector('.bastion-of-law-overlay')).toBeInTheDocument();
    expect(document.querySelector('.bastion-of-law-modal')).toBeInTheDocument();
    expect(document.querySelector('.bastion-section')).toBeInTheDocument();
    expect(document.querySelector('.bastion-actions')).toBeInTheDocument();
  });

  it('renders Font Awesome shield icon on Create Ward button', () => {
    render(<BastionOfLawModal {...makeProps()} />);
    const icon = document.querySelector('.bastion-sp-controls .fa-shield-halved');
    expect(icon).toBeInTheDocument();
  });

  it('renders Font Awesome dice icon on spend button', async () => {
    runtimeState.getRuntimeValue.mockImplementation((player, key) => {
      if (key === 'bastionOfLawWardDice') return [{ value: 8 }];
      return 10;
    });
    const onConfirm = vi.fn().mockResolvedValue({ type: 'popup', payload: { description: 'Ward created' } });
    render(<BastionOfLawModal {...makeProps({ onConfirm })} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Create Ward/ }));
    });
    const icon = document.querySelector('.bastion-spend-controls .fa-dice');
    expect(icon).toBeInTheDocument();
  });

  it('renders Font Awesome xmark icon on Clear Ward button', async () => {
    runtimeState.getRuntimeValue.mockImplementation((player, key) => {
      if (key === 'bastionOfLawWardDice') return [{ value: 8 }];
      return 10;
    });
    const onConfirm = vi.fn().mockResolvedValue({ type: 'popup', payload: { description: 'Ward created' } });
    render(<BastionOfLawModal {...makeProps({ onConfirm })} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Create Ward/ }));
    });
    const icon = document.querySelector('.bastion-actions .fa-xmark');
    expect(icon).toBeInTheDocument();
  });

  it('renders Font Awesome check icon on Done button', async () => {
    runtimeState.getRuntimeValue.mockImplementation((player, key) => {
      if (key === 'bastionOfLawWardDice') return [{ value: 8 }];
      return 10;
    });
    const onConfirm = vi.fn().mockResolvedValue({ type: 'popup', payload: { description: 'Ward created' } });
    render(<BastionOfLawModal {...makeProps({ onConfirm })} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Create Ward/ }));
    });
    const icon = document.querySelector('.bastion-actions .fa-check');
    expect(icon).toBeInTheDocument();
  });

  it('renders Font Awesome dice icon in roll result header', async () => {
    runtimeState.getRuntimeValue.mockImplementation((player, key) => {
      if (key === 'bastionOfLawWardDice') return [{ value: 8 }];
      return 10;
    });
    const onConfirm = vi.fn().mockResolvedValue({ type: 'popup', payload: { description: 'Ward created' } });
    render(<BastionOfLawModal {...makeProps({ onConfirm })} />);
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

  it('updates Create Ward button dice count when SP amount changes', () => {
    render(<BastionOfLawModal {...makeProps({ auto: { maxSP: 5 } })} />);
    const input = document.querySelector('input[type="number"]');
    fireEvent.change(input, { target: { value: '4' } });
    expect(screen.getByRole('button', { name: /Create Ward \(4d8\)/ })).toBeInTheDocument();
  });

  it('does not spend dice when ward dice length is 0', async () => {
    runtimeState.getRuntimeValue.mockReturnValueOnce(10).mockReturnValueOnce([]);
    const onConfirm = vi.fn().mockResolvedValue({ type: 'popup', payload: { description: 'Ward created' } });
    render(<BastionOfLawModal {...makeProps({ onConfirm })} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Create Ward/ }));
    });
    expect(screen.queryByRole('button', { name: /Roll & Reduce Damage/ })).not.toBeInTheDocument();
  });

  it('uses default total of 0 when rollExpression returns null', async () => {
    runtimeState.getRuntimeValue.mockImplementation((player, key) => {
      if (key === 'bastionOfLawWardDice') return [{ value: 8 }];
      return 10;
    });
    diceRoller.rollExpression.mockReturnValue(null);
    const onConfirm = vi.fn().mockResolvedValue({ type: 'popup', payload: { description: 'Ward created' } });
    render(<BastionOfLawModal {...makeProps({ onConfirm })} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Create Ward/ }));
    });
    const input = document.querySelector('.bastion-spend-controls input[type="number"]');
    fireEvent.change(input, { target: { value: '1' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Roll & Reduce Damage/ }));
    });
    await waitFor(() => {
      expect(screen.getByText(/Remaining: 0d8/)).toBeInTheDocument();
    });
  });
});
