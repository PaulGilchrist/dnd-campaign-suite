import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SingleTargetPopup from './SingleTargetPopup.jsx';

const mockSpell = { name: 'Burning Hands', level: 1 };
const mockCreatureTargets = ['Goblin', 'Skeleton', 'Orc'];
const mockOnConfirm = vi.fn();
const mockOnSkip = vi.fn();

function makeProps(overrides = {}) {
  return {
    spell: mockSpell,
    creatureTargets: mockCreatureTargets,
    onConfirm: mockOnConfirm,
    onSkip: mockOnSkip,
    icon: 'fa-solid fa-fire',
    title: 'Burning Hands',
    school: 'Evocation',
    defaultLevel: 1,
    description: 'Select a target',
    confirmLabel: 'Cast',
    cancelLabel: 'Cancel',
    ...overrides,
  };
}

describe('SingleTargetPopup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Rendering ──

  it('renders creature targets in the target selection list', () => {
    render(<SingleTargetPopup {...makeProps()} />);
    expect(screen.getByText(/Goblin/)).toBeInTheDocument();
    expect(screen.getByText(/Skeleton/)).toBeInTheDocument();
    expect(screen.getByText(/Orc/)).toBeInTheDocument();
  });

  it('renders with empty creature targets list', () => {
    render(<SingleTargetPopup {...makeProps({ creatureTargets: [] })} />);
    expect(screen.getByRole('button', { name: 'Cast' })).toBeInTheDocument();
    expect(screen.getByText('Target:')).toBeInTheDocument();
    expect(screen.queryByText('Goblin')).not.toBeInTheDocument();
  });

  it('renders gracefully with null spell', () => {
    render(<SingleTargetPopup {...makeProps({ spell: null })} />);
    expect(screen.getByText(/Spell/)).toBeInTheDocument();
  });

  it('renders gracefully with empty spell object', () => {
    render(<SingleTargetPopup {...makeProps({ spell: {} })} />);
    expect(screen.getByText(/Spell/)).toBeInTheDocument();
  });

  // ── Target selection ──

  it('selects a target when clicking a creature row', () => {
    render(<SingleTargetPopup {...makeProps()} />);
    const goblinRow = screen.getByText(/Goblin/).closest('div');
    fireEvent.click(goblinRow);
    expect(screen.getByText(/Goblin/).textContent).toContain('\u2713');
  });

  it('switches selection to a different target', () => {
    render(<SingleTargetPopup {...makeProps()} />);

    const goblinRow = screen.getByText(/Goblin/).closest('div');
    const orcRow = screen.getByText(/Orc/).closest('div');

    fireEvent.click(goblinRow);
    expect(screen.getByText(/Goblin/).textContent).toContain('\u2713');
    expect(screen.getByText(/Orc/).textContent).not.toContain('\u2713');

    fireEvent.click(orcRow);
    expect(screen.getByText(/Orc/).textContent).toContain('\u2713');
    expect(screen.getByText(/Goblin/).textContent).not.toContain('\u2713');
  });

  // ── Button behavior ──

  it('disables confirm when no target is selected and enables after selection', () => {
    render(<SingleTargetPopup {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Cast' })).toBeDisabled();

    const goblinRow = screen.getByText('Goblin').closest('div');
    fireEvent.click(goblinRow);
    expect(screen.getByRole('button', { name: 'Cast' })).not.toBeDisabled();
  });

  it('calls onConfirm with the selected target when confirm is clicked', () => {
    render(<SingleTargetPopup {...makeProps()} />);
    const orcRow = screen.getByText(/Orc/).closest('div');
    fireEvent.click(orcRow);
    fireEvent.click(screen.getByText('Cast'));
    expect(mockOnConfirm).toHaveBeenCalledWith(['Orc']);
  });

  it('does not call onConfirm when confirm is clicked without a target', () => {
    render(<SingleTargetPopup {...makeProps()} />);
    fireEvent.click(screen.getByText('Cast'));
    expect(mockOnConfirm).not.toHaveBeenCalled();
  });

  // ── Edge cases ──

  it('uses provided defaultLevel when spell has no level', () => {
    render(<SingleTargetPopup {...makeProps({ spell: {}, defaultLevel: 5, school: 'Necromancy' })} />);
    expect(screen.getByText(/Level 5/)).toBeInTheDocument();
    expect(screen.getByText(/Necromancy/)).toBeInTheDocument();
  });
});
