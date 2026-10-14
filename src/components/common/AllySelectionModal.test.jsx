import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AllySelectionModal from './AllySelectionModal.jsx';

describe('AllySelectionModal', () => {
  const defaultCreatures = [
    { name: 'Goblin', type: 'npc', currentHp: 15, maxHp: 20 },
    { name: 'Player Character', type: 'player', currentHp: 30, maxHp: 30 },
    { name: 'Orc', type: 'npc', currentHp: 0, maxHp: 25 },
  ];

  let onConfirm;
  let onCancel;

  beforeEach(() => {
    onConfirm = vi.fn();
    onCancel = vi.fn();
  });

  function getProps(overrides = {}) {
    return {
      title: 'Select Allies',
      icon: 'fa-shield-halved',
      creatures: defaultCreatures,
      currentAllies: [],
      onConfirm,
      onCancel,
      ...overrides,
    };
  }

  // ── Rendering ──

  it('renders the modal overlay with the title and icon', () => {
    render(<AllySelectionModal {...getProps()} />);

    expect(screen.getByText('Select Allies')).toBeInTheDocument();
    expect(document.querySelector('.fa-solid.fa-shield-halved')).toBeInTheDocument();
  });

  it('renders all creatures in the list', () => {
    render(<AllySelectionModal {...getProps()} />);

    expect(screen.getByText('Goblin')).toBeInTheDocument();
    expect(screen.getByText('Player Character')).toBeInTheDocument();
    expect(screen.getByText('Orc')).toBeInTheDocument();
  });

  it('labels player creatures with (Player) and NPCs with (NPC)', () => {
    render(<AllySelectionModal {...getProps()} />);

    expect(screen.getByText('(Player)')).toBeInTheDocument();
    expect(screen.getAllByText('(NPC)').length).toBe(2);
  });

  it('displays HP percentage for non-player creatures', () => {
    render(<AllySelectionModal {...getProps()} />);

    expect(screen.getByText('(75% HP)')).toBeInTheDocument();
    expect(screen.getByText('(0% HP)')).toBeInTheDocument();
  });

  it('does not display HP for player creatures', () => {
    render(<AllySelectionModal {...getProps()} />);

    const playerCheckbox = screen.getByRole('checkbox', { name: 'Player Character(Player)' });
    const playerRow = playerCheckbox.closest('.secondary-target-row');
    expect(playerRow.querySelector('.secondary-target-hp')).toBeNull();
  });

  it('renders the empty state when no creatures are provided', () => {
    render(<AllySelectionModal {...getProps({ creatures: [] })} />);

    expect(screen.getByText('No creatures available.')).toBeInTheDocument();
  });

  // ── Selection ──

  it('toggles creature selection when its row is clicked', () => {
    render(<AllySelectionModal {...getProps()} />);

    const rows = document.querySelectorAll('.secondary-target-row');
    const checkbox = rows[0].querySelector('input[type="checkbox"]');

    expect(checkbox).not.toBeChecked();
    expect(screen.getByText('0 selected')).toBeInTheDocument();

    fireEvent.click(rows[0]);
    expect(checkbox).toBeChecked();
    expect(rows[0]).toHaveClass('secondary-target-selected');
    expect(screen.getByText('1 selected')).toBeInTheDocument();

    fireEvent.click(rows[0]);
    expect(checkbox).not.toBeChecked();
    expect(rows[0]).not.toHaveClass('secondary-target-selected');
    expect(screen.getByText('0 selected')).toBeInTheDocument();
  });

  it('selects all creatures when Select All is clicked', () => {
    render(<AllySelectionModal {...getProps()} />);

    fireEvent.click(screen.getByText('Select All'));

    expect(screen.getByText('3 selected')).toBeInTheDocument();
    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach(cb => expect(cb).toBeChecked());
  });

  it('clears all selections when Clear All is clicked', () => {
    render(<AllySelectionModal {...getProps()} />);

    fireEvent.click(screen.getByText('Select All'));
    expect(screen.getByText('3 selected')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Clear All'));
    expect(screen.getByText('0 selected')).toBeInTheDocument();
    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach(cb => expect(cb).not.toBeChecked());
  });

  it('pre-selects allies from currentAllies prop', () => {
    render(<AllySelectionModal {...getProps({ currentAllies: ['Goblin', 'Orc'] })} />);

    expect(screen.getByText('2 selected')).toBeInTheDocument();
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[1]).not.toBeChecked();
    expect(checkboxes[2]).toBeChecked();
  });

  // ── Confirm ──

  it('calls onConfirm with selected allies when confirm is clicked', () => {
    render(<AllySelectionModal {...getProps()} />);

    fireEvent.click(screen.getByText('Select All'));
    fireEvent.click(screen.getByRole('button', { name: /Confirm Allies/ }));

    expect(onConfirm).toHaveBeenCalledWith(['Goblin', 'Player Character', 'Orc']);
  });

  it('does not call onConfirm when no allies are selected', () => {
    render(<AllySelectionModal {...getProps()} />);

    fireEvent.click(screen.getByRole('button', { name: /Confirm Allies/ }));

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('disables confirm button when no allies are selected and enables it when one is selected', () => {
    render(<AllySelectionModal {...getProps()} />);

    const confirmBtn = screen.getByRole('button', { name: /Confirm Allies \(0\)/ });
    expect(confirmBtn).toBeDisabled();

    const rows = document.querySelectorAll('.secondary-target-row');
    fireEvent.click(rows[0]);

    const updatedBtn = screen.getByRole('button', { name: /Confirm Allies \(1\)/ });
    expect(updatedBtn).not.toBeDisabled();
  });

  // ── Cancel ──

  it('calls onCancel when cancel button is clicked', () => {
    render(<AllySelectionModal {...getProps()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledOnce();
  });

  // ── Edge cases ──

  it('does not display HP when currentHp or maxHp is null', () => {
    const creatures = [
      { name: 'Mysterious Creature', type: 'npc' },
    ];
    render(<AllySelectionModal {...getProps({ creatures })} />);

    expect(screen.getByText('Mysterious Creature')).toBeInTheDocument();
    expect(screen.queryByText(/HP/i)).not.toBeInTheDocument();
  });
});
