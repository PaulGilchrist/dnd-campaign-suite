// @cleaned-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CombatSuperiorityModal from './CombatSuperiorityModal.jsx';

// ── Test fixtures (shared) ──

const basePayload = {
  allManeuvers: [
    { name: 'Trip Attack', actionType: 'attack_rider' },
    { name: 'Pushing Attack', actionType: 'movement' },
    { name: 'Disarming Attack', actionType: 'attack_rider' },
    { name: 'Ki-Fueled Attack', actionType: 'bonus_action' },
    { name: 'Evasive Footwork', actionType: 'reaction' },
    { name: 'Kicking Attack', actionType: 'skill_check' },
    { name: 'Rally', actionType: 'movement' },
    { name: 'Grasping Vine', actionType: 'grant_attack' },
  ],
  maxOptions: 3,
  knownManeuvers: [],
};

function makePayload(overrides = {}) {
  return { ...basePayload, ...overrides };
}

function makeProps(overrides = {}) {
  return {
    payload: makePayload(),
    onConfirm: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

function renderModal(overrides = {}) {
  return render(<CombatSuperiorityModal {...makeProps(overrides)} />);
}

// ── No maneuvers state (consolidated from 5 tests) ──

describe('CombatSuperiorityModal - no maneuvers state', () => {
  it('renders no maneuvers message, header, close button, and instruction text when knownManeuvers is empty', () => {
    renderModal({
      payload: makePayload({
        selectionMode: false,
        knownManeuvers: [],
      }),
    });
    expect(screen.getByText('Combat Superiority')).toBeInTheDocument();
    expect(screen.getByText(/No maneuvers selected/)).toBeInTheDocument();
    expect(screen.getByText(/Use Combat Superiority again to select your maneuvers/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Close/ })).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked in no maneuvers state', () => {
    const onClose = vi.fn();
    renderModal({
      payload: makePayload({
        selectionMode: false,
        knownManeuvers: [],
      }),
      onClose,
    });
    fireEvent.click(screen.getByRole('button', { name: /Close/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ── Maneuver filtering (consolidated from 3 tests) ──

describe('CombatSuperiorityModal - known maneuvers filtering', () => {
  it('filters to only known maneuvers in use mode and hides empty action type groups', () => {
    renderModal({
      payload: makePayload({
        selectionMode: false,
        knownManeuvers: ['Ki-Fueled Attack'],
      }),
    });
    expect(screen.getByText('Ki-Fueled Attack')).toBeInTheDocument();
    expect(screen.getByText('Bonus Actions')).toBeInTheDocument();
    expect(screen.queryByText('Pushing Attack')).not.toBeInTheDocument();
    expect(screen.queryByText('Movement')).not.toBeInTheDocument();
  });

  it('shows no maneuvers when knownManeuvers contains maneuvers not in allManeuvers', () => {
    renderModal({
      payload: makePayload({
        selectionMode: false,
        knownManeuvers: ['Nonexistent Maneuver'],
        allManeuvers: [{ name: 'Real Maneuver', actionType: 'bonus_action' }],
      }),
    });
    expect(screen.getByText(/No maneuvers selected/)).toBeInTheDocument();
  });
});

// ── Selection toggle (consolidated from 2 tests) ──

describe('CombatSuperiorityModal - toggleSelection', () => {
  it('toggles selection on and off and enforces maxOptions', () => {
    renderModal({ payload: makePayload({ selectionMode: true }) });
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    fireEvent.click(checkboxes[0]);
    expect(screen.getByText(/1\/3 selected/)).toBeInTheDocument();
    fireEvent.click(checkboxes[0]);
    expect(screen.getByText(/0\/3 selected/)).toBeInTheDocument();
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    fireEvent.click(checkboxes[2]);
    expect(screen.getByText(/3\/3 selected/)).toBeInTheDocument();
    fireEvent.click(checkboxes[3]);
    expect(screen.getByText(/3\/3 selected/)).toBeInTheDocument();
  });
});

// ── Clear selection (consolidated from 2 tests) ──

describe('CombatSuperiorityModal - handleClearSelection', () => {
  it('clears all selections, calls onConfirm with empty array, and does not close modal', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    renderModal({
      payload: makePayload({
        selectionMode: true,
        knownManeuvers: ['Ki-Fueled Attack'],
      }),
      onConfirm,
      onClose,
    });
    fireEvent.click(screen.getByRole('button', { name: /Clear Selection/ }));
    expect(onConfirm).toHaveBeenCalledWith([], null);
    expect(onClose).not.toHaveBeenCalled();
  });
});

// ── Use maneuver (consolidated from 3 tests) ──

describe('CombatSuperiorityModal - handleUseManeuver', () => {
  it('sets applied state and shows result when onConfirm resolves with data', async () => {
    const onConfirm = vi.fn();
    onConfirm.mockResolvedValue({ payload: { name: 'X', description: 'Y' } });
    renderModal({
      payload: makePayload({
        selectionMode: false,
        knownManeuvers: ['Ki-Fueled Attack'],
      }),
      onConfirm,
    });
    const radios = document.querySelectorAll('input[name="combatManeuver"]');
    fireEvent.click(radios[0]);
    fireEvent.click(screen.getByRole('button', { name: /Use Maneuver/ }));
    await waitFor(() => {
      expect(screen.getByText('Ki-Fueled Attack')).toBeInTheDocument();
    });
  });

  it('does not show result state when onConfirm returns null', async () => {
    const onConfirm = vi.fn();
    onConfirm.mockResolvedValue(null);
    render(<CombatSuperiorityModal
      payload={makePayload({ selectionMode: false, knownManeuvers: ['Ki-Fueled Attack'] })}
      onConfirm={onConfirm}
    />);
    const radios = document.querySelectorAll('input[name="combatManeuver"]');
    fireEvent.click(radios[0]);
    fireEvent.click(screen.getByRole('button', { name: /Use Maneuver/ }));
    await waitFor(() => {
      expect(screen.queryByText('Done')).not.toBeInTheDocument();
    });
  });

  it('does not call onConfirm when use maneuver is clicked with no selection', async () => {
    const onConfirm = vi.fn();
    renderModal({
      payload: makePayload({
        selectionMode: false,
        knownManeuvers: ['Ki-Fueled Attack'],
      }),
      onConfirm,
    });
    fireEvent.click(screen.getByRole('button', { name: /Use Maneuver/ }));
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

// ── Message variants (consolidated from 3 tests) ──

describe('CombatSuperiorityModal - message variants', () => {
  it('shows correct messages for known maneuvers, maxOptions, and learning states', () => {
    // Known maneuvers count
    renderModal({
      payload: makePayload({
        selectionMode: true,
        knownManeuvers: ['Ki-Fueled Attack', 'Pushing Attack', 'Disarming Attack'],
      }),
    });
    expect(screen.getByText(/Your known maneuvers: 3/)).toBeInTheDocument();

    // maxOptions in message
    renderModal({
      payload: makePayload({
        selectionMode: true,
        knownManeuvers: ['Ki-Fueled Attack'],
        maxOptions: 5,
      }),
    });
    expect(screen.getByText(/up to 5/)).toBeInTheDocument();

    // Learning message when no known maneuvers
    renderModal({
      payload: makePayload({
        selectionMode: true,
        knownManeuvers: [],
      }),
    });
    expect(screen.getByText(/You learn 3 at level 3/)).toBeInTheDocument();
    expect(screen.getByText(/levels 7, 10, and 15/)).toBeInTheDocument();
  });
});

// ── Overlay click (consolidated from 3 tests into 1) ──

describe('CombatSuperiorityModal - overlay clicks', () => {
  it('does not close when clicking modal content in any mode, but closes when clicking overlay', () => {
    const onClose = vi.fn();
    renderModal({
      payload: makePayload({ selectionMode: true }),
      onClose,
    });
    const modal = document.querySelector('.sp-modal');
    fireEvent.click(modal);
    expect(onClose).not.toHaveBeenCalled();

    const overlay = document.querySelector('.sp-overlay');
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ── Confirm selection (consolidated from 3 tests) ──

describe('CombatSuperiorityModal - handleConfirmSelection', () => {
  it('calls onConfirm with selected names when selections exist and does not close modal', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    renderModal({
      payload: makePayload({ selectionMode: true }),
      onConfirm,
      onClose,
    });
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[3]);
    fireEvent.click(screen.getByRole('button', { name: /Confirm Selection/ }));
    expect(onConfirm).toHaveBeenCalledWith(['Trip Attack', 'Evasive Footwork'], null);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not call onConfirm when confirm is clicked with zero selections', () => {
    const onConfirm = vi.fn();
    renderModal({
      payload: makePayload({ selectionMode: true }),
      onConfirm,
    });
    fireEvent.click(screen.getByRole('button', { name: /Confirm Selection/ }));
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

// ── Duplicate maneuver names (kept - unique behavioral coverage) ──

describe('CombatSuperiorityModal - duplicate names', () => {
  it('treats duplicate maneuver names as same maneuver (selecting one deselects the other)', () => {
    renderModal({
      payload: makePayload({
        selectionMode: true,
        allManeuvers: [
          { name: 'Same Name', actionType: 'bonus_action' },
          { name: 'Same Name', actionType: 'movement' },
        ],
      }),
    });
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBe(2);
    fireEvent.click(checkboxes[0]);
    expect(checkboxes[0].checked).toBe(true);
    expect(screen.getByText(/1\/3 selected/)).toBeInTheDocument();
    fireEvent.click(checkboxes[1]);
    expect(checkboxes[1].checked).toBe(false);
    expect(screen.getByText(/0\/3 selected/)).toBeInTheDocument();
  });
});

// ── maxOptions edge cases (consolidated from 6 tests into 2) ──

describe('CombatSuperiorityModal - maxOptions edge cases', () => {
  it('prevents any selection when maxOptions is 0', () => {
    renderModal({
      payload: makePayload({
        selectionMode: true,
        maxOptions: 0,
      }),
    });
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => expect(cb.disabled).toBe(true));
    expect(screen.getByText(/0\/0 selected/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirm Selection/ })).toBeDisabled();
  });

  it('allows selecting exactly one maneuver when maxOptions is 1 and allows toggling off', () => {
    renderModal({
      payload: makePayload({
        selectionMode: true,
        maxOptions: 1,
      }),
    });
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    fireEvent.click(checkboxes[0]);
    expect(screen.getByText(/1\/1 selected/)).toBeInTheDocument();
    expect(checkboxes[1].disabled).toBe(true);
    expect(checkboxes[0].disabled).toBe(false);
    fireEvent.click(checkboxes[0]);
    expect(screen.getByText(/0\/1 selected/)).toBeInTheDocument();
  });
});

// ── Action type ordering (consolidated from 2 tests) ──

describe('CombatSuperiorityModal - ordering', () => {
  it('renders action types in the defined order in selection mode', () => {
    renderModal({ payload: makePayload({ selectionMode: true }) });
    const headings = document.querySelectorAll('h4');
    const headingTexts = Array.from(headings).map(h => h.textContent);
    const expectedOrder = [
      'Attack Riders (on hit)',
      'Bonus Actions',
      'Reactions',
      'Skill Checks',
      'Movement',
      'Grant Attack',
    ];
    expectedOrder.forEach((text, i) => {
      expect(headingTexts[i]).toBe(text);
    });
  });

  it('renders action types in the defined order in use mode (excluding attack_rider)', () => {
    renderModal({
      payload: makePayload({
        selectionMode: false,
        knownManeuvers: ['Ki-Fueled Attack', 'Evasive Footwork'],
      }),
    });
    const headings = document.querySelectorAll('h4');
    const headingTexts = Array.from(headings).map(h => h.textContent);
    expect(headingTexts[0]).toBe('Bonus Actions');
    expect(headingTexts[1]).toBe('Reactions');
  });
});

// ── Single maneuver (consolidated from 4 tests into 1) ──

describe('CombatSuperiorityModal - single maneuver', () => {
  it('renders and allows selecting a single maneuver in selection mode', () => {
    renderModal({
      payload: makePayload({
        selectionMode: true,
        allManeuvers: [{ name: 'Only Maneuver', actionType: 'bonus_action' }],
      }),
    });
    expect(screen.getByText('Only Maneuver')).toBeInTheDocument();
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBe(1);
    fireEvent.click(checkboxes[0]);
    expect(screen.getByText(/1\/3 selected/)).toBeInTheDocument();
  });

  it('renders and allows selecting a single maneuver in use mode', () => {
    renderModal({
      payload: makePayload({
        selectionMode: false,
        knownManeuvers: ['Only Maneuver'],
        allManeuvers: [{ name: 'Only Maneuver', actionType: 'bonus_action' }],
      }),
    });
    expect(screen.getByText('Only Maneuver')).toBeInTheDocument();
    const radios = document.querySelectorAll('input[name="combatManeuver"]');
    expect(radios.length).toBe(1);
    fireEvent.click(radios[0]);
    expect(radios[0].checked).toBe(true);
  });
});
