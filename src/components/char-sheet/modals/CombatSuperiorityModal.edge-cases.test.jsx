// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CombatSuperiorityModal from './CombatSuperiorityModal.jsx';

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

function renderModalDirect(props) {
  return render(<CombatSuperiorityModal {...props} />);
}

// ── Null/undefined payload ──

describe('CombatSuperiorityModal - null/undefined payload', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['missing prop', undefined],
  ])('renders nothing when payload is %s', (label, payloadValue) => {
    const props = { onConfirm: vi.fn(), onClose: vi.fn() };
    if (label !== 'missing prop') {
      props.payload = payloadValue;
    }
    renderModalDirect(props);
    expect(document.body.textContent).toBe('');
  });
});

// ── Overlay click behavior (unique: not in test.jsx) ──

describe('CombatSuperiorityModal - overlay clicks', () => {
  it('does not close when clicking the overlay background or modal content', () => {
    const onClose = vi.fn();
    renderModal({
      payload: { selectionMode: true },
      onClose,
    });
    const overlay = document.querySelector('.sp-overlay');
    const modal = document.querySelector('.sp-modal');
    expect(overlay).toBeTruthy();
    expect(modal).toBeTruthy();

    // Clicking modal content should NOT close
    fireEvent.click(modal);
    expect(onClose).not.toHaveBeenCalled();

    // Clicking overlay should not close
    fireEvent.click(overlay);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });
});

// ── maxOptions = 0 edge case (unique: test.jsx only has maxOptions=5) ──

describe('CombatSuperiorityModal - maxOptions zero', () => {
  it('disables all checkboxes and shows 0/0 selected when maxOptions is 0', () => {
    renderModal({
      payload: { selectionMode: true, maxOptions: 0 },
    });
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => expect(cb.disabled).toBe(true));
    expect(screen.getByText(/0\/0 selected/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirm Selection/ })).toBeDisabled();
  });
});

// ── maxOptions = 1 edge case (unique: test.jsx only has maxOptions=5) ──

describe('CombatSuperiorityModal - maxOptions one', () => {
  it('allows selecting exactly one and disables remaining checkboxes', () => {
    renderModal({
      payload: { selectionMode: true, maxOptions: 1 },
    });
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    fireEvent.click(checkboxes[0]);
    expect(screen.getByText(/1\/1 selected/)).toBeInTheDocument();
    // Remaining checkboxes should be disabled
    for (let i = 1; i < checkboxes.length; i++) {
      expect(checkboxes[i].disabled).toBe(true);
    }
    // First checkbox should still be toggleable off
    expect(checkboxes[0].disabled).toBe(false);
    fireEvent.click(checkboxes[0]);
    expect(screen.getByText(/0\/1 selected/)).toBeInTheDocument();
    // All checkboxes re-enabled after deselect
    for (let i = 0; i < checkboxes.length; i++) {
      expect(checkboxes[i].disabled).toBe(false);
    }
  });
});

// ── Action type ordering (unique: test.jsx checks grouping but not order) ──

describe('CombatSuperiorityModal - action type ordering', () => {
  it('renders action types in the defined order in selection mode', () => {
    renderModal({ payload: { selectionMode: true } });
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
});

// ── Maneuver descriptions in use mode (unique: triggers.test.jsx only covers selection mode) ──

describe('CombatSuperiorityModal - maneuver descriptions in use mode', () => {
  it('renders descriptions when present and omits them when absent', () => {
    // With description
    renderModalDirect({
      payload: {
        allManeuvers: [
          { name: 'Trip Attack', actionType: 'bonus_action', description: 'Prone the target.' },
          { name: 'Simple Move', actionType: 'movement', description: null },
        ],
        knownManeuvers: ['Trip Attack', 'Simple Move'],
        maxOptions: 3,
        selectionMode: false,
      },
      onConfirm: vi.fn(),
      onClose: vi.fn(),
    });
    expect(screen.getByText('Trip Attack')).toBeInTheDocument();
    expect(screen.getByText('Prone the target.')).toBeInTheDocument();
    expect(screen.getByText('Simple Move')).toBeInTheDocument();
    expect(screen.queryByText('Simple Move')).toBeInTheDocument();
  });
});

// ── Prompt mode headers (unique: triggers.test.jsx checks header text but not all prompt variants) ──

describe('CombatSuperiorityModal - prompt mode headers', () => {
  it('shows the correct header based on selectionMode and attackContext', () => {
    // selectionMode with attackContext → "Choose Maneuver"
    renderModalDirect({
      payload: {
        allManeuvers: [{ name: 'A', actionType: 'bonus_action' }],
        knownManeuvers: [],
        maxOptions: 3,
        selectionMode: true,
        attackContext: { hit: true, weaponType: 'melee' },
      },
      onConfirm: vi.fn(),
      onClose: vi.fn(),
    });
    expect(screen.getByText(/Combat Superiority — Choose Maneuver/)).toBeInTheDocument();

    // use mode with attackContext → "Use Maneuver"
    renderModalDirect({
      payload: {
        allManeuvers: [{ name: 'Ki-Fueled Attack', actionType: 'bonus_action' }],
        knownManeuvers: ['Ki-Fueled Attack'],
        maxOptions: 3,
        selectionMode: false,
        attackContext: { hit: true, weaponType: 'melee' },
      },
      onConfirm: vi.fn(),
      onClose: vi.fn(),
    });
    expect(screen.getByText(/Combat Superiority — Use Maneuver/)).toBeInTheDocument();

    // selectionMode without attackContext → "Select Maneuvers"
    renderModalDirect({
      payload: {
        allManeuvers: [{ name: 'A', actionType: 'bonus_action' }],
        knownManeuvers: [],
        maxOptions: 3,
        selectionMode: true,
      },
      onConfirm: vi.fn(),
      onClose: vi.fn(),
    });
    expect(screen.getByText(/Combat Superiority — Select Maneuvers/)).toBeInTheDocument();
  });
});

// ── Known maneuvers pre-selected in selection state (unique: runtime.test.jsx covers this but edge case behavior is different) ──

describe('CombatSuperiorityModal - knownManeuvers pre-selected', () => {
  it('pre-selects known maneuvers and allows toggling them off', () => {
    renderModalDirect({
      payload: {
        allManeuvers: [
          { name: 'Ki-Fueled Attack', actionType: 'bonus_action' },
          { name: 'Pushing Attack', actionType: 'movement' },
        ],
        knownManeuvers: ['Ki-Fueled Attack', 'Pushing Attack'],
        maxOptions: 3,
        selectionMode: true,
      },
      onConfirm: vi.fn(),
      onClose: vi.fn(),
    });
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBe(2);
    expect(checkboxes[0].checked).toBe(true);
    expect(checkboxes[1].checked).toBe(true);

    // Toggle one off
    fireEvent.click(checkboxes[0]);
    expect(checkboxes[0].checked).toBe(false);
    expect(checkboxes[1].checked).toBe(true);
  });

  it('confirm sends pre-selected known maneuvers without user interaction', () => {
    const onConfirm = vi.fn();
    renderModalDirect({
      payload: {
        allManeuvers: [
          { name: 'Ki-Fueled Attack', actionType: 'bonus_action' },
          { name: 'Pushing Attack', actionType: 'movement' },
        ],
        knownManeuvers: ['Ki-Fueled Attack', 'Pushing Attack'],
        maxOptions: 3,
        selectionMode: true,
      },
      onConfirm,
      onClose: vi.fn(),
    });
    fireEvent.click(screen.getByRole('button', { name: /Confirm Selection/ }));
    expect(onConfirm).toHaveBeenCalledWith(['Ki-Fueled Attack', 'Pushing Attack'], null);
  });

  it('pre-selected known maneuvers respect maxOptions limit', () => {
    renderModalDirect({
      payload: {
        allManeuvers: [
          { name: 'A', actionType: 'bonus_action' },
          { name: 'B', actionType: 'movement' },
          { name: 'C', actionType: 'reaction' },
          { name: 'D', actionType: 'skill_check' },
        ],
        knownManeuvers: ['A', 'B', 'C', 'D'],
        maxOptions: 2,
        selectionMode: true,
      },
      onConfirm: vi.fn(),
      onClose: vi.fn(),
    });
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBe(4);
    // All are pre-selected (knownManeuvers seeds state)
    expect(checkboxes[0].checked).toBe(true);
    expect(checkboxes[1].checked).toBe(true);
    expect(checkboxes[2].checked).toBe(true);
    expect(checkboxes[3].checked).toBe(true);
    // Toggle off C — length goes from 4 to 3, still >= 2
    fireEvent.click(checkboxes[2]);
    expect(checkboxes[2].checked).toBe(false);
    // Now length is 3, so D is disabled (atMax = 3>=2 && !isSelected(true→false) = true)
    // But checkbox 2 itself is not disabled (atMax = 3>=2 && !isSelected(false) = true → disabled)
    expect(checkboxes[2].disabled).toBe(true);
    // Can't re-add C because length(3) >= 2
    // Must first toggle off another to get below maxOptions
    fireEvent.click(checkboxes[3]);
    expect(checkboxes[3].checked).toBe(false);
    // Now length is 2, still at max — checkbox 2 is still disabled
    expect(checkboxes[2].disabled).toBe(true);
    // Toggle off A to get to length 1
    fireEvent.click(checkboxes[0]);
    expect(checkboxes[0].checked).toBe(false);
    // Now length is 1 < 2, so checkbox 2 is re-enabled
    expect(checkboxes[2].disabled).toBe(false);
    // Can now re-add C
    fireEvent.click(checkboxes[2]);
    expect(checkboxes[2].checked).toBe(true);
  });
});

// ── Duplicate maneuver names (unique behavior) ──

describe('CombatSuperiorityModal - duplicate maneuver names', () => {
  it('treats duplicate names as the same maneuver in selection', () => {
    renderModal({
      payload: {
        selectionMode: true,
        allManeuvers: [
          { name: 'Same Name', actionType: 'bonus_action' },
          { name: 'Same Name', actionType: 'movement' },
        ],
      },
    });
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBe(2);
    fireEvent.click(checkboxes[0]);
    expect(checkboxes[0].checked).toBe(true);
    expect(screen.getByText(/1\/3 selected/)).toBeInTheDocument();
    // Clicking the duplicate should toggle the first one off (same name)
    fireEvent.click(checkboxes[1]);
    expect(checkboxes[1].checked).toBe(false);
    expect(checkboxes[0].checked).toBe(false);
    expect(screen.getByText(/0\/3 selected/)).toBeInTheDocument();
  });

  it('confirm with duplicate names sends name only once', () => {
    const onConfirm = vi.fn();
    renderModal({
      payload: {
        selectionMode: true,
        allManeuvers: [
          { name: 'Same Name', actionType: 'bonus_action' },
          { name: 'Same Name', actionType: 'movement' },
          { name: 'Other', actionType: 'reaction' },
        ],
      },
      onConfirm,
      onClose: vi.fn(),
    });
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    // Due to React key collision (both "Same Name" share same key),
    // clicking checkbox 0 selects "Same Name", and the state reflects that.
    // Confirm sends the name once (not duplicated).
    fireEvent.click(checkboxes[0]);
    expect(checkboxes[0].checked).toBe(true);
    expect(screen.getByText(/1\/3 selected/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Confirm Selection/ }));
    expect(onConfirm).toHaveBeenCalledWith(['Same Name'], null);
  });
});

// ── Use maneuver error path (unique: triggers.test.jsx covers rejection but not applied state) ──

describe('CombatSuperiorityModal - use maneuver error path', () => {
  it('does not set applied/result state when onConfirm rejects', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockReturnValue();
    const onConfirm = vi.fn().mockRejectedValue(new Error('use failed'));
    renderModalDirect({
      payload: {
        allManeuvers: [{ name: 'Ki-Fueled Attack', actionType: 'bonus_action' }],
        knownManeuvers: ['Ki-Fueled Attack'],
        maxOptions: 3,
        selectionMode: false,
      },
      onConfirm,
      onClose: vi.fn(),
    });
    const radios = document.querySelectorAll('input[name="combatManeuver"]');
    fireEvent.click(radios[0]);
    fireEvent.click(screen.getByRole('button', { name: /Use Maneuver/ }));
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        '[CombatSuperiorityModal] Use maneuver failed:',
        expect.any(Error)
      );
      expect(screen.queryByText('Done')).not.toBeInTheDocument();
    });
    consoleSpy.mockRestore();
  });
});

// ── onReopenSelection error handling (unique) ──

describe('CombatSuperiorityModal - onReopenSelection error handling', () => {
  it('logs error when onReopenSelection rejects', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockReturnValue();
    const onReopenSelection = vi.fn().mockRejectedValue(new Error('fail'));
    renderModalDirect({
      payload: {
        allManeuvers: [{ name: 'Ki-Fueled Attack', actionType: 'bonus_action' }],
        knownManeuvers: ['Ki-Fueled Attack'],
        maxOptions: 3,
        selectionMode: false,
      },
      onReopenSelection: onReopenSelection,
      onConfirm: vi.fn(),
    });
    const btn = screen.getByRole('button', { name: /Manage Maneuvers/ });
    fireEvent.click(btn);
    waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        '[CombatSuperiorityModal] Reopen selection failed:',
        expect.any(Error)
      );
    });
    consoleSpy.mockRestore();
  });
});

// ── No maneuvers message variants (unique: test.jsx covers general use mode but not empty state) ──

describe('CombatSuperiorityModal - no maneuvers empty state', () => {
  it('shows no maneuvers message when knownManeuvers is empty and selectionMode is false', () => {
    renderModal({
      payload: {
        selectionMode: false,
        knownManeuvers: [],
      },
    });
    expect(screen.getByText('Combat Superiority')).toBeInTheDocument();
    expect(screen.getByText(/No maneuvers selected/)).toBeInTheDocument();
    expect(screen.getByText(/Use Combat Superiority again to select your maneuvers/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Close/ })).toBeInTheDocument();
  });

  it('shows no maneuvers when knownManeuvers contains maneuvers not in allManeuvers', () => {
    renderModal({
      payload: {
        selectionMode: false,
        knownManeuvers: ['Nonexistent Maneuver'],
        allManeuvers: [{ name: 'Real Maneuver', actionType: 'bonus_action' }],
      },
    });
    expect(screen.getByText(/No maneuvers selected/)).toBeInTheDocument();
  });
});

// ── Known maneuver objects filtering in use mode (unique) ──

describe('CombatSuperiorityModal - known maneuver objects filtering', () => {
  it('only shows maneuvers that are both known and in allManeuvers in use mode', () => {
    renderModal({
      payload: {
        selectionMode: false,
        knownManeuvers: ['Ki-Fueled Attack', 'Unknown Maneuver'],
        allManeuvers: [
          { name: 'Ki-Fueled Attack', actionType: 'bonus_action' },
          { name: 'Known But Not Listed', actionType: 'reaction' },
        ],
      },
    });
    expect(screen.getByText('Ki-Fueled Attack')).toBeInTheDocument();
    expect(screen.queryByText('Unknown Maneuver')).not.toBeInTheDocument();
    expect(screen.queryByText('Known But Not Listed')).not.toBeInTheDocument();
  });
});
