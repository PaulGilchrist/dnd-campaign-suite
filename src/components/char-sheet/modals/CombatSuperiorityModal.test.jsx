// @cleaned-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CombatSuperiorityModal from './CombatSuperiorityModal.jsx';

// ── Test fixtures (from helpers) ──

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

// ── Result display state ──

describe('CombatSuperiorityModal - result display', () => {
  describe('result display (non-selection mode, applied, has result)', () => {
    function setupResultState(result) {
      const props = makeProps({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Ki-Fueled Attack'],
        }),
        onConfirm: vi.fn(),
      });
      props.onConfirm.mockResolvedValue(result);
      render(<CombatSuperiorityModal {...props} />);
      const radios = document.querySelectorAll('input[name="combatManeuver"]');
      fireEvent.click(radios[0]);
      fireEvent.click(screen.getByRole('button', { name: /Use Maneuver/ }));
    }

    it('renders the result modal with maneuver name and description when not in selection mode, applied is true, and result exists', async () => {
      setupResultState({ payload: { name: 'Ki-Fueled Attack', description: '<strong>Tripped!</strong>' } });
      await waitFor(() => {
        expect(screen.getByText('Ki-Fueled Attack')).toBeInTheDocument();
        const bodyDiv = document.querySelector('.sp-body');
        expect(bodyDiv.innerHTML).toContain('<strong>Tripped!</strong>');
        expect(screen.getByText('Done')).toBeInTheDocument();
      });
    });

    it('renders result with fallback name when payload.name is missing', async () => {
      setupResultState({ payload: { description: 'No name description.' } });
      await waitFor(() => {
        expect(screen.getByText('Maneuver')).toBeInTheDocument();
      });
    });

    it('calls onClose when Done button is clicked in result state', async () => {
      const onClose = vi.fn();
      const props = makeProps({
        payload: makePayload({ selectionMode: false, knownManeuvers: ['Ki-Fueled Attack'] }),
        onClose,
        onConfirm: vi.fn().mockResolvedValue({ payload: { name: 'Ki-Fueled Attack', description: 'Desc.' } }),
      });
      render(<CombatSuperiorityModal {...props} />);
      const radios = document.querySelectorAll('input[name="combatManeuver"]');
      fireEvent.click(radios[0]);
      fireEvent.click(screen.getByRole('button', { name: /Use Maneuver/ }));
      await waitFor(() => {
        expect(screen.getByText('Done')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Done'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not show result state when result is null', async () => {
      const props = makeProps({
        payload: makePayload({ selectionMode: false, knownManeuvers: ['Ki-Fueled Attack'] }),
        onConfirm: vi.fn().mockResolvedValue(null),
      });
      render(<CombatSuperiorityModal {...props} />);
      const radios = document.querySelectorAll('input[name="combatManeuver"]');
      fireEvent.click(radios[0]);
      fireEvent.click(screen.getByRole('button', { name: /Use Maneuver/ }));
      await waitFor(() => {
        expect(screen.queryByText('Done')).not.toBeInTheDocument();
      });
    });

    it('does not show result state when applied is false', async () => {
      const props = makeProps({
        payload: makePayload({ selectionMode: false, knownManeuvers: ['Ki-Fueled Attack'] }),
        onConfirm: vi.fn().mockResolvedValue({ payload: { name: 'Ki-Fueled Attack', description: 'Desc.' } }),
      });
      render(<CombatSuperiorityModal {...props} />);
      expect(screen.queryByText('Done')).not.toBeInTheDocument();
    });
  });
});

// ── Selection mode rendering ──

describe('CombatSuperiorityModal - selection mode rendering', () => {
  describe('selection mode', () => {
    it('renders selection mode header and instruction text when selectionMode is true', () => {
      renderModal({ payload: makePayload({ selectionMode: true }) });
      expect(screen.getByText(/Combat Superiority — Select Maneuvers/)).toBeInTheDocument();
      expect(screen.getByText(/Choose up to 3 maneuvers/)).toBeInTheDocument();
      expect(screen.getByText(/You learn 3 at level 3/)).toBeInTheDocument();
      expect(screen.getByText(/0\/3 selected/)).toBeInTheDocument();
    });

    it('shows known maneuvers message when knownManeuvers has entries', () => {
      renderModal({
        payload: makePayload({
          selectionMode: true,
          knownManeuvers: ['Ki-Fueled Attack', 'Pushing Attack'],
        }),
      });
      expect(screen.getByText(/Your known maneuvers: 2/)).toBeInTheDocument();
      expect(screen.getByText(/up to 3/)).toBeInTheDocument();
    });

    it('groups maneuvers by action type and renders checkboxes for each maneuver', () => {
      renderModal({ payload: makePayload({ selectionMode: true }) });
      expect(screen.getByText('Attack Riders (on hit)')).toBeInTheDocument();
      expect(screen.getByText('Movement')).toBeInTheDocument();
      expect(screen.getByText('Reactions')).toBeInTheDocument();
      expect(screen.getByText('Skill Checks')).toBeInTheDocument();
      expect(screen.getByText('Bonus Actions')).toBeInTheDocument();
      expect(screen.getByText('Grant Attack')).toBeInTheDocument();
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      expect(checkboxes.length).toBe(8);
      expect(screen.getByText('Ki-Fueled Attack')).toBeInTheDocument();
      expect(screen.getByText('Pushing Attack')).toBeInTheDocument();
      expect(screen.getByText('Disarming Attack')).toBeInTheDocument();
    });

    it('filters out action types with no maneuvers', () => {
      renderModal({
        payload: makePayload({
          selectionMode: true,
          allManeuvers: [{ name: 'Only One', actionType: 'bonus_action' }],
        }),
      });
      expect(screen.getByText('Bonus Actions')).toBeInTheDocument();
      expect(screen.queryByText('Attack Riders (on hit)')).not.toBeInTheDocument();
    });

    it('respects maxOptions from payload', () => {
      renderModal({
        payload: makePayload({ selectionMode: true, maxOptions: 5 }),
      });
      expect(screen.getByText(/up to 5/)).toBeInTheDocument();
      expect(screen.getByText(/0\/5 selected/)).toBeInTheDocument();
    });

    it('shows clear selection button when knownManeuvers has entries', () => {
      renderModal({
        payload: makePayload({
          selectionMode: true,
          knownManeuvers: ['Ki-Fueled Attack'],
        }),
      });
      expect(screen.getByRole('button', { name: /Clear Selection/ })).toBeInTheDocument();
    });

    it('does not show clear selection button when knownManeuvers is empty', () => {
      renderModal({ payload: makePayload({ selectionMode: true, knownManeuvers: [] }) });
      expect(screen.queryByRole('button', { name: /Clear Selection/ })).not.toBeInTheDocument();
    });
  });
});

// ── Selection mode selection behavior ──

describe('CombatSuperiorityModal - selection behavior', () => {
  describe('selection mode - selection behavior', () => {
    it('toggles a maneuver on and off and enforces maxOptions', () => {
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
      expect(checkboxes[3].disabled).toBe(true);
      expect(checkboxes[7].disabled).toBe(true);
    });

    it('calls onConfirm with selected maneuvers when confirm is clicked', () => {
      const onConfirm = vi.fn();
      renderModal({
        payload: makePayload({ selectionMode: true }),
        onConfirm,
      });
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      fireEvent.click(checkboxes[0]);
      fireEvent.click(checkboxes[3]);
      fireEvent.click(screen.getByRole('button', { name: /Confirm Selection/ }));
      expect(onConfirm).toHaveBeenCalledWith(['Trip Attack', 'Evasive Footwork'], null);
    });

    it('does not call onConfirm when confirm is clicked with no selections', () => {
      const onConfirm = vi.fn();
      renderModal({
        payload: makePayload({ selectionMode: true }),
        onConfirm,
      });
      fireEvent.click(screen.getByRole('button', { name: /Confirm Selection/ }));
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it('has confirm button disabled when no selections and enabled when selections exist', () => {
      renderModal({ payload: makePayload({ selectionMode: true }) });
      expect(screen.getByRole('button', { name: /Confirm Selection/ })).toBeDisabled();
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      fireEvent.click(checkboxes[0]);
      expect(screen.getByRole('button', { name: /Confirm Selection/ })).not.toBeDisabled();
    });

    it('calls onConfirm with empty array when clear selection is clicked', () => {
      const onConfirm = vi.fn();
      renderModal({
        payload: makePayload({
          selectionMode: true,
          knownManeuvers: ['Ki-Fueled Attack'],
        }),
        onConfirm,
      });
      fireEvent.click(screen.getByRole('button', { name: /Clear Selection/ }));
      expect(onConfirm).toHaveBeenCalledWith([], null);
    });

    it('calls onClose when cancel is clicked', () => {
      const onClose = vi.fn();
      renderModal({
        payload: makePayload({ selectionMode: true }),
        onClose,
      });
      fireEvent.click(screen.getByRole('button', { name: /Cancel/ }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});

// ── Maneuver use mode ──

describe('CombatSuperiorityModal - maneuver use mode', () => {
  describe('maneuver use mode', () => {
    it('renders use mode header, instruction text, and radio inputs when not in selection mode and known maneuvers exist', () => {
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Ki-Fueled Attack', 'Pushing Attack'],
        }),
      });
      expect(screen.getByText(/Combat Superiority — Choose Maneuver/)).toBeInTheDocument();
      expect(screen.getByText(/Choose a maneuver to use/)).toBeInTheDocument();
      const radios = document.querySelectorAll('input[name="combatManeuver"]');
      expect(radios.length).toBe(2);
      radios.forEach(radio => expect(radio.checked).toBe(false));
    });

    it('groups maneuvers by action type in use mode and only shows known maneuvers', () => {
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Ki-Fueled Attack', 'Pushing Attack', 'Evasive Footwork'],
        }),
      });
      expect(screen.getByText('Bonus Actions')).toBeInTheDocument();
      expect(screen.getByText('Movement')).toBeInTheDocument();
      expect(screen.getByText('Reactions')).toBeInTheDocument();
      expect(screen.getByText('Ki-Fueled Attack')).toBeInTheDocument();
      expect(screen.getByText('Pushing Attack')).toBeInTheDocument();
    });

    it('filters out action types with no known maneuvers in use mode', () => {
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Ki-Fueled Attack'],
        }),
      });
      expect(screen.getByText('Bonus Actions')).toBeInTheDocument();
      expect(screen.queryByText('Movement')).not.toBeInTheDocument();
    });

    it('selects a maneuver radio when clicked and deselects the previous one', () => {
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Ki-Fueled Attack', 'Pushing Attack'],
        }),
      });
      const radios = document.querySelectorAll('input[name="combatManeuver"]');
      fireEvent.click(radios[0]);
      expect(radios[0].checked).toBe(true);
      fireEvent.click(radios[1]);
      expect(radios[0].checked).toBe(false);
      expect(radios[1].checked).toBe(true);
    });

    it('shows action type subtitle for bonus_action and reaction maneuvers', () => {
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Ki-Fueled Attack', 'Evasive Footwork'],
        }),
      });
      expect(screen.getByText(/— bonus action/)).toBeInTheDocument();
      expect(screen.getByText(/— reaction/)).toBeInTheDocument();
    });

    it('has use maneuver button disabled when no selection and enabled when selection exists', () => {
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Ki-Fueled Attack'],
        }),
      });
      expect(screen.getByRole('button', { name: /Use Maneuver/ })).toBeDisabled();
      const radios = document.querySelectorAll('input[name="combatManeuver"]');
      fireEvent.click(radios[0]);
      expect(screen.getByRole('button', { name: /Use Maneuver/ })).not.toBeDisabled();
    });

    it('calls onConfirm with maneuver name when use maneuver is clicked', async () => {
      const onConfirm = vi.fn();
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
      expect(onConfirm).toHaveBeenCalledWith(null, 'Ki-Fueled Attack');
    });

    it('does not call onConfirm when use maneuver is clicked with no selection', () => {
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

    it('sets result and applied state when use maneuver resolves', async () => {
      const onConfirm = vi.fn();
      onConfirm.mockResolvedValue({
        payload: { name: 'Ki-Fueled Attack', description: 'Tripped!' },
      });
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

    it('calls onClose when cancel is clicked in use mode', () => {
      const onClose = vi.fn();
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Ki-Fueled Attack'],
        }),
        onClose,
      });
      fireEvent.click(screen.getByRole('button', { name: /Cancel/ }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
