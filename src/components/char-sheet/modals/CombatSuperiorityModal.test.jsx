import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CombatSuperiorityModal from './CombatSuperiorityModal.jsx';
import * as useRuntimeState from '../../../hooks/runtime/useRuntimeState.js';

// ── Test fixtures ──

const BASE_MANEUVERS = [
  { name: 'Trip Attack', actionType: 'attack_rider' },
  { name: 'Pushing Attack', actionType: 'movement' },
  { name: 'Disarming Attack', actionType: 'attack_rider' },
  { name: 'Ki-Fueled Attack', actionType: 'bonus_action' },
  { name: 'Evasive Footwork', actionType: 'reaction' },
  { name: 'Kicking Attack', actionType: 'skill_check' },
  { name: 'Rally', actionType: 'movement' },
  { name: 'Grasping Vine', actionType: 'grant_attack' },
];

function renderModal({ payload, ...rest } = {}) {
  const defaultProps = {
    payload: { allManeuvers: BASE_MANEUVERS, maxOptions: 3, knownManeuvers: [], ...payload },
    onConfirm: vi.fn(),
    onClose: vi.fn(),
    ...rest,
  };
  return render(<CombatSuperiorityModal {...defaultProps} />);
}

// ── Selection mode rendering ──

describe('CombatSuperiorityModal - selection mode rendering', () => {
  it('renders selection mode header and instruction text when selectionMode is true', () => {
    renderModal({ payload: { selectionMode: true } });
    expect(screen.getByText(/Combat Superiority — Select Maneuvers/)).toBeInTheDocument();
    expect(screen.getByText(/Choose up to 3 maneuvers/)).toBeInTheDocument();
    expect(screen.getByText(/You learn 3 at level 3/)).toBeInTheDocument();
    expect(screen.getByText(/0\/3 selected/)).toBeInTheDocument();
  });

  it('shows known maneuvers count when knownManeuvers has entries', () => {
    renderModal({
      payload: {
        selectionMode: true,
        knownManeuvers: ['Ki-Fueled Attack', 'Pushing Attack'],
      },
    });
    expect(screen.getByText(/Your known maneuvers: 2/)).toBeInTheDocument();
    expect(screen.getByText(/up to 3/)).toBeInTheDocument();
  });

  it('groups maneuvers by action type and renders each maneuver name', () => {
    renderModal({ payload: { selectionMode: true } });
    expect(screen.getByText('Attack Riders (on hit)')).toBeInTheDocument();
    expect(screen.getByText('Movement')).toBeInTheDocument();
    expect(screen.getByText('Reactions')).toBeInTheDocument();
    expect(screen.getByText('Skill Checks')).toBeInTheDocument();
    expect(screen.getByText('Bonus Actions')).toBeInTheDocument();
    expect(screen.getByText('Grant Attack')).toBeInTheDocument();
    BASE_MANEUVERS.forEach(m => {
      expect(screen.getByText(m.name)).toBeInTheDocument();
    });
  });

  it('respects maxOptions from payload', () => {
    renderModal({ payload: { selectionMode: true, maxOptions: 5 } });
    expect(screen.getByText(/up to 5/)).toBeInTheDocument();
    expect(screen.getByText(/0\/5 selected/)).toBeInTheDocument();
  });

  it('shows clear selection button when knownManeuvers has entries', () => {
    renderModal({
      payload: {
        selectionMode: true,
        knownManeuvers: ['Ki-Fueled Attack'],
      },
    });
    expect(screen.getByRole('button', { name: /Clear Selection/ })).toBeInTheDocument();
  });

  it('does not show clear selection button when knownManeuvers is empty', () => {
    renderModal({ payload: { selectionMode: true, knownManeuvers: [] } });
    expect(screen.queryByRole('button', { name: /Clear Selection/ })).not.toBeInTheDocument();
  });
});

// ── Selection mode selection behavior ──

describe('CombatSuperiorityModal - selection behavior', () => {
  it('toggles a maneuver on and off and enforces maxOptions', () => {
    renderModal({ payload: { selectionMode: true } });
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    expect(screen.getByText(/1\/3 selected/)).toBeInTheDocument();
    fireEvent.click(checkboxes[0]);
    expect(screen.getByText(/0\/3 selected/)).toBeInTheDocument();
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    fireEvent.click(checkboxes[2]);
    expect(screen.getByText(/3\/3 selected/)).toBeInTheDocument();
    // Additional checkboxes should be disabled at max
    checkboxes.forEach((cb, i) => {
      if (i > 2) expect(cb.disabled).toBe(true);
    });
  });

  it('calls onConfirm with selected maneuvers when confirm is clicked', () => {
    const onConfirm = vi.fn();
    renderModal({
      payload: { selectionMode: true },
      onConfirm,
    });
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[3]);
    fireEvent.click(screen.getByRole('button', { name: /Confirm Selection/ }));
    expect(onConfirm).toHaveBeenCalledWith(['Trip Attack', 'Evasive Footwork'], null);
  });

  it('does not call onConfirm when confirm is clicked with no selections (button is also disabled)', () => {
    const onConfirm = vi.fn();
    renderModal({
      payload: { selectionMode: true },
      onConfirm,
    });
    expect(screen.getByRole('button', { name: /Confirm Selection/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Confirm Selection/ }));
    expect(onConfirm).not.toHaveBeenCalled();
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    expect(screen.getByRole('button', { name: /Confirm Selection/ })).not.toBeDisabled();
  });

  it('calls onConfirm with empty array when clear selection is clicked', () => {
    const onConfirm = vi.fn();
    renderModal({
      payload: {
        selectionMode: true,
        knownManeuvers: ['Ki-Fueled Attack'],
      },
      onConfirm,
    });
    fireEvent.click(screen.getByRole('button', { name: /Clear Selection/ }));
    expect(onConfirm).toHaveBeenCalledWith([], null);
  });

  it('calls onClose when cancel is clicked', () => {
    const onClose = vi.fn();
    renderModal({
      payload: { selectionMode: true },
      onClose,
    });
    fireEvent.click(screen.getByRole('button', { name: /Cancel/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ── Maneuver use mode ──

describe('CombatSuperiorityModal - maneuver use mode', () => {
  it('renders use mode header, instruction text, and radio inputs when not in selection mode and known maneuvers exist', () => {
    renderModal({
      payload: {
        selectionMode: false,
        knownManeuvers: ['Ki-Fueled Attack', 'Pushing Attack'],
      },
    });
    expect(screen.getByText(/Combat Superiority — Choose Maneuver/)).toBeInTheDocument();
    expect(screen.getByText(/Choose a maneuver to use/)).toBeInTheDocument();
    const radios = screen.getAllByRole('radio', { name: /Ki-Fueled Attack|Pushing Attack/ });
    expect(radios.length).toBe(2);
    expect(radios[0]).not.toBeChecked();
  });

  it('selects a maneuver radio when clicked and deselects the previous one', () => {
    renderModal({
      payload: {
        selectionMode: false,
        knownManeuvers: ['Ki-Fueled Attack', 'Pushing Attack'],
      },
    });
    const radios = screen.getAllByRole('radio', { name: /Ki-Fueled Attack|Pushing Attack/ });
    fireEvent.click(radios[0]);
    expect(radios[0]).toBeChecked();
    expect(radios[1]).not.toBeChecked();
    fireEvent.click(radios[1]);
    expect(radios[0]).not.toBeChecked();
    expect(radios[1]).toBeChecked();
  });

  it('calls onConfirm with maneuver name when use maneuver is clicked', () => {
    const onConfirm = vi.fn();
    renderModal({
      payload: {
        selectionMode: false,
        knownManeuvers: ['Ki-Fueled Attack'],
      },
      onConfirm,
    });
    const radios = screen.getAllByRole('radio', { name: /Ki-Fueled Attack/ });
    fireEvent.click(radios[0]);
    fireEvent.click(screen.getByRole('button', { name: /Use Maneuver/ }));
    expect(onConfirm).toHaveBeenCalledWith(null, 'Ki-Fueled Attack');
  });

  it('does not call onConfirm when use maneuver is clicked with no selection (button is also disabled)', () => {
    const onConfirm = vi.fn();
    renderModal({
      payload: {
        selectionMode: false,
        knownManeuvers: ['Ki-Fueled Attack'],
      },
      onConfirm,
    });
    expect(screen.getByRole('button', { name: /Use Maneuver/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Use Maneuver/ }));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('calls onReopenSelection when manage maneuvers button is clicked', () => {
    const onReopenSelection = vi.fn().mockResolvedValue(undefined);
    renderModal({
      payload: {
        selectionMode: false,
        knownManeuvers: ['Ki-Fueled Attack'],
      },
      onReopenSelection,
    });
    fireEvent.click(screen.getByRole('button', { name: /Manage Maneuvers/ }));
    expect(onReopenSelection).toHaveBeenCalledTimes(1);
  });

  it('calls onConfirm with current selection when onReopenSelection is not provided', () => {
    const onConfirm = vi.fn();
    renderModal({
      payload: {
        selectionMode: false,
        knownManeuvers: ['Ki-Fueled Attack'],
      },
      onConfirm,
    });
    const radios = screen.getAllByRole('radio', { name: /Ki-Fueled Attack/ });
    fireEvent.click(radios[0]);
    fireEvent.click(screen.getByRole('button', { name: /Manage Maneuvers/ }));
    expect(onConfirm).toHaveBeenCalledWith(['Ki-Fueled Attack'], null);
  });
});

// ── Empty known maneuvers in use mode ──

describe('CombatSuperiorityModal - no known maneuvers in use mode', () => {
  it('shows "no maneuvers selected" message when knownManeuvers is empty in use mode', () => {
    renderModal({
      payload: {
        selectionMode: false,
        knownManeuvers: [],
      },
    });
    expect(screen.getByText(/No maneuvers selected/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Close/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Use Maneuver/ })).not.toBeInTheDocument();
  });
});

// ── Prompt mode filtering ──

describe('CombatSuperiorityModal - prompt mode filtering', () => {
  beforeEach(() => {
    vi.spyOn(useRuntimeState, 'getRuntimeValue').mockImplementation((_name, key) => {
      if (key === 'superiorityDice') return 3;
      return undefined;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('filters maneuvers by trigger and shows only matching ones in prompt mode', () => {
    renderModal({
      payload: {
        selectionMode: false,
        allManeuvers: [
          { name: 'Parry', actionType: 'reaction', trigger: 'melee_damage_taken' },
          { name: 'Rally', actionType: 'movement' },
          { name: 'Trip Attack', actionType: 'attack_rider' },
        ],
        knownManeuvers: ['Parry', 'Rally', 'Trip Attack'],
        attackContext: { hit: true, weaponType: 'melee', attackerName: 'PC', targetName: 'Enemy' },
        playerStats: { name: 'PC' },
      },
    });
    expect(screen.getByText(/Combat Superiority — Use Maneuver/)).toBeInTheDocument();
    expect(screen.getByText('Rally')).toBeInTheDocument();
    expect(screen.getByText('Trip Attack')).toBeInTheDocument();
    expect(screen.queryByText('Parry')).not.toBeInTheDocument();
  });
});
