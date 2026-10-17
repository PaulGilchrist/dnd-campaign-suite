// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PowerWordFortifyModal from './PowerWordFortifyModal.jsx';

const mockOnConfirm = vi.fn();
const mockOnSkip = vi.fn();

const defaultTargets = [
  { name: 'Ally1', type: 'player', currentHp: 15, maxHp: 30 },
  { name: 'Ally2', type: 'player', currentHp: 30, maxHp: 30 },
  { name: 'Ally3', type: 'player', currentHp: 5, maxHp: 25 },
  { name: 'Ally4', type: 'npc', currentHp: 20, maxHp: 40 },
];

function makeProps(overrides) {
  return {
    creatureTargets: defaultTargets,
    totalTempHp: 10,
    onConfirm: mockOnConfirm,
    onSkip: mockOnSkip,
    ...(overrides || {}),
  };
}

function selectTarget(name) {
  fireEvent.click(screen.getByLabelText(name));
}

function setInput(index, value) {
  fireEvent.change(screen.getAllByRole('spinbutton')[index], { target: { value: String(value) } });
}

function clickFortify() {
  fireEvent.click(screen.getByRole('button', { name: /Fortify \(\d+\)/ }));
}

describe('PowerWordFortifyModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders pool, allocation summary, all targets, and a disabled Fortify button when empty', () => {
    render(<PowerWordFortifyModal {...makeProps({ totalTempHp: 15 })} />);
    expect(screen.getByText(/Power Word Fortify/)).toBeInTheDocument();
    expect(screen.getByText(/15 Temporary Hit Points/)).toBeInTheDocument();
    expect(screen.getByText(/chosen allies/)).toBeInTheDocument();
    expect(screen.getByText('Pool: 15 HP')).toBeInTheDocument();
    expect(screen.getByText('Allocated: 0 / 15')).toBeInTheDocument();
    expect(screen.getByText('Remaining: 15')).toBeInTheDocument();
    defaultTargets.forEach(({ name }) => {
      expect(screen.getByLabelText(name)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Fortify \(0\)/ })).toBeDisabled();
  });

  it('shows an empty-state message when there are no targets', () => {
    render(<PowerWordFortifyModal {...makeProps({ creatureTargets: [] })} />);
    expect(screen.getByText('No targets available.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Fortify \(0\)/ })).toBeDisabled();
  });

  it('tracks allocation counts, remaining pool, and the unallocated warning through a full flow', () => {
    render(<PowerWordFortifyModal {...makeProps()} />);
    selectTarget('Ally1');
    setInput(0, 5);
    expect(screen.getByRole('spinbutton')).toHaveValue(5);
    expect(screen.getByText('Allocated: 5 / 10')).toBeInTheDocument();
    expect(screen.getByText('Remaining: 5')).toBeInTheDocument();
    expect(screen.getByText(/5 HP unallocated/)).toBeInTheDocument();
    // Allocating everything hides the remaining counter and the warning
    setInput(0, 10);
    expect(screen.getByText('Allocated: 10 / 10')).toBeInTheDocument();
    expect(screen.queryByText(/Remaining:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/HP unallocated/)).not.toBeInTheDocument();
  });

  it('confirms a multi-target distribution of only the non-zero allocations', () => {
    render(<PowerWordFortifyModal {...makeProps()} />);
    selectTarget('Ally1');
    selectTarget('Ally2');
    expect(screen.getByRole('button', { name: /Fortify \(2\)/ })).toBeEnabled();
    setInput(0, 3);
    setInput(1, 4);
    expect(screen.getByText('Allocated: 7 / 10')).toBeInTheDocument();
    clickFortify();
    expect(mockOnConfirm).toHaveBeenCalledWith({ Ally1: 3, Ally2: 4 });
  });

  it('excludes zero-amount selected targets from the confirmed distribution', () => {
    render(<PowerWordFortifyModal {...makeProps()} />);
    selectTarget('Ally1');
    selectTarget('Ally2');
    setInput(0, 5);
    clickFortify();
    expect(mockOnConfirm).toHaveBeenCalledWith({ Ally1: 5 });
  });

  it('blocks confirming when targets are selected but nothing is allocated', () => {
    render(<PowerWordFortifyModal {...makeProps()} />);
    selectTarget('Ally1');
    expect(screen.getByRole('button', { name: /Fortify \(1\)/ })).toBeEnabled();
    clickFortify();
    expect(mockOnConfirm).not.toHaveBeenCalled();
  });

  it('blocks confirming after every target is deselected', () => {
    render(<PowerWordFortifyModal {...makeProps()} />);
    selectTarget('Ally1');
    selectTarget('Ally2');
    selectTarget('Ally1');
    selectTarget('Ally2');
    const btn = screen.getByRole('button', { name: /Fortify \(0\)/ });
    expect(btn).toBeDisabled();
    clickFortify();
    expect(mockOnConfirm).not.toHaveBeenCalled();
  });

  it('clamps a second target to the remaining pool, notes the cap, and confirms clamped values', () => {
    render(<PowerWordFortifyModal {...makeProps({ totalTempHp: 120 })} />);
    selectTarget('Ally1');
    selectTarget('Ally2');
    setInput(0, 100);
    setInput(1, 100);
    expect(screen.getAllByRole('spinbutton')[1]).toHaveValue(20);
    expect(screen.getByText(/Max 20 — remaining pool/)).toBeInTheDocument();
    expect(screen.getByText('Allocated: 120 / 120')).toBeInTheDocument();
    clickFortify();
    expect(mockOnConfirm).toHaveBeenCalledWith({ Ally1: 100, Ally2: 20 });
  });

  it.each([
    [999, 10],
    [-5, 0],
    ['', 0],
  ])('clamps allocation input %o to %i within the pool', (value, expected) => {
    render(<PowerWordFortifyModal {...makeProps({ totalTempHp: 10 })} />);
    selectTarget('Ally1');
    setInput(0, value);
    expect(screen.getByRole('spinbutton')).toHaveValue(expected);
  });

  it("resets a target's allocation to 0 when it is re-selected", () => {
    render(<PowerWordFortifyModal {...makeProps()} />);
    selectTarget('Ally1');
    setInput(0, 7);
    expect(screen.getByRole('spinbutton')).toHaveValue(7);
    selectTarget('Ally1'); // deselect
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    selectTarget('Ally1'); // reselect
    expect(screen.getByRole('spinbutton')).toHaveValue(0);
    expect(screen.getByText('Allocated: 0 / 10')).toBeInTheDocument();
  });

  it('enforces the maxTargets cap: locks extra checkboxes, refuses over-selection, re-enables on deselect', () => {
    const fourTargets = ['T1', 'T2', 'T3', 'T4'].map((name) => ({ name, type: 'npc' }));
    render(<PowerWordFortifyModal {...makeProps({ creatureTargets: fourTargets, maxTargets: 2 })} />);
    selectTarget('T1');
    selectTarget('T2');
    expect(screen.getByRole('button', { name: /Fortify \(2\)/ })).toBeEnabled();
    expect(screen.getByLabelText('T3')).toBeDisabled();
    expect(screen.getByLabelText('T4')).toBeDisabled();
    fireEvent.click(screen.getByLabelText('T3')); // disabled — must not select
    expect(screen.getByRole('button', { name: /Fortify \(2\)/ })).toBeInTheDocument();
    selectTarget('T1');
    expect(screen.getByLabelText('T3')).toBeEnabled();
    selectTarget('T3');
    expect(screen.getByRole('button', { name: /Fortify \(2\)/ })).toBeInTheDocument();
  });

  it('clamps +/- adjust buttons to the remaining pool and to a minimum of zero', () => {
    render(<PowerWordFortifyModal {...makeProps({ totalTempHp: 10 })} />);
    selectTarget('Ally1');
    selectTarget('Ally2');
    setInput(0, 8);
    const ally2Input = screen.getAllByRole('spinbutton')[1];
    const row = ally2Input.closest('.pwfm-allocation');
    const [minusBtn, plusBtn] = row.querySelectorAll('button');
    // Ally2 can only take the 2 HP left in the pool — extra plus-clicks clamp there
    fireEvent.click(plusBtn);
    fireEvent.click(plusBtn);
    fireEvent.click(plusBtn);
    expect(ally2Input).toHaveValue(2);
    expect(screen.getByText(/Max 2 — remaining pool/)).toBeInTheDocument();
    // Minus past zero clamps at 0 and clears the cap note
    fireEvent.click(minusBtn);
    fireEvent.click(minusBtn);
    fireEvent.click(minusBtn);
    expect(ally2Input).toHaveValue(0);
    expect(screen.queryByText(/remaining pool/)).not.toBeInTheDocument();
  });

  it('handles a zero-size pool without allowing any allocation', () => {
    render(<PowerWordFortifyModal {...makeProps({ totalTempHp: 0 })} />);
    expect(screen.getByText('Pool: 0 HP')).toBeInTheDocument();
    expect(screen.getByText('Allocated: 0 / 0')).toBeInTheDocument();
    selectTarget('Ally1');
    setInput(0, 5);
    expect(screen.getByRole('spinbutton')).toHaveValue(0);
    clickFortify();
    expect(mockOnConfirm).not.toHaveBeenCalled();
  });

  it('calls onSkip when Skip is clicked', () => {
    render(<PowerWordFortifyModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(mockOnSkip).toHaveBeenCalledTimes(1);
    expect(mockOnConfirm).not.toHaveBeenCalled();
  });
});
