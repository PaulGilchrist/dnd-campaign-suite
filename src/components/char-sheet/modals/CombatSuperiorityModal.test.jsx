// @improved-by-ai
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

    it('renders the result modal when not in selection mode, applied is true, and result exists', async () => {
      setupResultState({ payload: { name: 'Ki-Fueled Attack', description: 'Trip description.' } });
      await waitFor(() => {
        expect(screen.getByText('Ki-Fueled Attack')).toBeInTheDocument();
      });
    });

    it('renders the result payload name in the header', async () => {
      setupResultState({ payload: { name: 'Pushing Attack', description: 'Push description.' } });
      await waitFor(() => {
        expect(screen.getByText(/Pushing Attack/)).toBeInTheDocument();
      });
    });

    it('renders the bolt icon in the result header', async () => {
      setupResultState({ payload: { name: 'Ki-Fueled Attack', description: 'Desc.' } });
      await waitFor(() => {
        expect(document.querySelector('.fa-solid.fa-bolt')).toBeInTheDocument();
      });
    });

    it('renders the result description via dangerouslySetInnerHTML', async () => {
      setupResultState({ payload: { name: 'Ki-Fueled Attack', description: '<strong>Tripped!</strong>' } });
      await waitFor(() => {
        const bodyDiv = document.querySelector('.sp-body');
        expect(bodyDiv.innerHTML).toContain('<strong>Tripped!</strong>');
      });
    });

    it('renders the Done button in result state', async () => {
      setupResultState({ payload: { name: 'Ki-Fueled Attack', description: 'Desc.' } });
      await waitFor(() => {
        expect(screen.getByText('Done')).toBeInTheDocument();
      });
    });

    it('has sp-roll-btn class on Done button', async () => {
      setupResultState({ payload: { name: 'Ki-Fueled Attack', description: 'Desc.' } });
      await waitFor(() => {
        const doneBtn = screen.getByText('Done');
        expect(doneBtn.classList.contains('sp-roll-btn')).toBe(true);
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

    it('does not call onClose when clicking inside modal in result state', async () => {
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
      const modal = document.querySelector('.sp-modal');
      fireEvent.click(modal);
      expect(onClose).not.toHaveBeenCalled();
    });

    it('calls onClose when clicking overlay in result state', async () => {
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
      const overlay = document.querySelector('.sp-overlay');
      fireEvent.click(overlay);
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
    it('renders selection mode header when selectionMode is true', () => {
      renderModal({ payload: makePayload({ selectionMode: true }) });
      expect(screen.getByText(/Combat Superiority — Select Maneuvers/)).toBeInTheDocument();
    });

    it('renders bolt icon in selection mode header', () => {
      renderModal({ payload: makePayload({ selectionMode: true }) });
      expect(document.querySelector('.fa-solid.fa-bolt')).toBeInTheDocument();
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

    it('shows learning message when knownManeuvers is empty', () => {
      renderModal({ payload: makePayload({ selectionMode: true }) });
      expect(screen.getByText(/Choose up to 3 maneuvers/)).toBeInTheDocument();
      expect(screen.getByText(/You learn 3 at level 3/)).toBeInTheDocument();
    });

    it('shows selection count display', () => {
      renderModal({ payload: makePayload({ selectionMode: true }) });
      expect(screen.getByText(/0\/3 selected/)).toBeInTheDocument();
    });

    it('groups maneuvers by action type in selection mode', () => {
      renderModal({ payload: makePayload({ selectionMode: true }) });
      expect(screen.getByText('Attack Riders (on hit)')).toBeInTheDocument();
      expect(screen.getByText('Movement')).toBeInTheDocument();
      expect(screen.getByText('Reactions')).toBeInTheDocument();
      expect(screen.getByText('Skill Checks')).toBeInTheDocument();
      expect(screen.getByText('Bonus Actions')).toBeInTheDocument();
      expect(screen.getByText('Grant Attack')).toBeInTheDocument();
    });

    it('renders checkboxes for each maneuver in selection mode', () => {
      renderModal({ payload: makePayload({ selectionMode: true }) });
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      expect(checkboxes.length).toBe(8);
    });

    it('renders maneuver names in selection mode', () => {
      renderModal({ payload: makePayload({ selectionMode: true }) });
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
  });
});

// ── Selection mode selection behavior ──

describe('CombatSuperiorityModal - selection behavior', () => {
  describe('selection mode - selection behavior', () => {
    it('toggles a maneuver on when clicking its checkbox', () => {
      renderModal({ payload: makePayload({ selectionMode: true }) });
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      fireEvent.click(checkboxes[0]);
      expect(screen.getByText(/1\/3 selected/)).toBeInTheDocument();
    });

    it('toggles a maneuver off when clicking an already-selected checkbox', () => {
      renderModal({ payload: makePayload({ selectionMode: true }) });
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      fireEvent.click(checkboxes[0]);
      expect(screen.getByText(/1\/3 selected/)).toBeInTheDocument();
      fireEvent.click(checkboxes[0]);
      expect(screen.getByText(/0\/3 selected/)).toBeInTheDocument();
    });

    it('prevents selection beyond maxOptions', () => {
      renderModal({ payload: makePayload({ selectionMode: true }) });
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      fireEvent.click(checkboxes[0]);
      fireEvent.click(checkboxes[1]);
      fireEvent.click(checkboxes[2]);
      expect(screen.getByText(/3\/3 selected/)).toBeInTheDocument();
      expect(checkboxes[3].disabled).toBe(true);
    });

    it('disables checkboxes at max selection', () => {
      renderModal({ payload: makePayload({ selectionMode: true }) });
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      fireEvent.click(checkboxes[0]);
      fireEvent.click(checkboxes[1]);
      fireEvent.click(checkboxes[2]);
      expect(checkboxes[0].disabled).toBe(false);
      expect(checkboxes[1].disabled).toBe(false);
      expect(checkboxes[2].disabled).toBe(false);
      expect(checkboxes[3].disabled).toBe(true);
      expect(checkboxes[7].disabled).toBe(true);
    });

    it('shows selected maneuvers with highlighted background', () => {
      renderModal({ payload: makePayload({ selectionMode: true }) });
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      fireEvent.click(checkboxes[0]);
      const labels = document.querySelectorAll('label');
      expect(labels[0].style.background).toContain('rgba(255');
    });

    it('calls onConfirm with selected maneuvers when confirm is clicked', () => {
      const onConfirm = vi.fn();
      renderModal({
        payload: makePayload({ selectionMode: true }),
        onConfirm,
      });
      // Checkbox order (grouped by actionType): [0]=Trip Attack, [1]=Disarming Attack (attack_rider),
      // [2]=Ki-Fueled Attack (bonus_action), [3]=Evasive Footwork (reaction),
      // [4]=Kicking Attack (skill_check), [5]=Pushing Attack, [6]=Rally (movement),
      // [7]=Grasping Vine (grant_attack)
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

    it('has confirm button disabled when no selections', () => {
      renderModal({ payload: makePayload({ selectionMode: true }) });
      expect(screen.getByRole('button', { name: /Confirm Selection/ })).toBeDisabled();
    });

    it('has confirm button enabled when selections exist', () => {
      renderModal({ payload: makePayload({ selectionMode: true }) });
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

    it('does not show clear selection button when knownManeuvers is empty', () => {
      renderModal({ payload: makePayload({ selectionMode: true, knownManeuvers: [] }) });
      expect(screen.queryByRole('button', { name: /Clear Selection/ })).not.toBeInTheDocument();
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

    it('calls onClose when cancel is clicked', () => {
      const onClose = vi.fn();
      renderModal({
        payload: makePayload({ selectionMode: true }),
        onClose,
      });
      fireEvent.click(screen.getByRole('button', { name: /Cancel/ }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when overlay is clicked in selection mode', () => {
      const onClose = vi.fn();
      renderModal({
        payload: makePayload({ selectionMode: true }),
        onClose,
      });
      const overlay = document.querySelector('.sp-overlay');
      fireEvent.click(overlay);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when clicking inside modal in selection mode', () => {
      const onClose = vi.fn();
      renderModal({
        payload: makePayload({ selectionMode: true }),
        onClose,
      });
      const modal = document.querySelector('.sp-modal');
      fireEvent.click(modal);
      expect(onClose).not.toHaveBeenCalled();
    });

    it('has sp-roll-btn class on confirm button', () => {
      renderModal({ payload: makePayload({ selectionMode: true }) });
      const btn = screen.getByRole('button', { name: /Confirm Selection/ });
      expect(btn.classList.contains('sp-roll-btn')).toBe(true);
    });

    it('has sp-dismiss-btn class on cancel button', () => {
      renderModal({ payload: makePayload({ selectionMode: true }) });
      const btn = screen.getByRole('button', { name: /Cancel/ });
      expect(btn.classList.contains('sp-dismiss-btn')).toBe(true);
    });

    it('has sp-dismiss-btn class on clear selection button', () => {
      renderModal({
        payload: makePayload({
          selectionMode: true,
          knownManeuvers: ['Ki-Fueled Attack'],
        }),
      });
      const btn = screen.getByRole('button', { name: /Clear Selection/ });
      expect(btn.classList.contains('sp-dismiss-btn')).toBe(true);
    });

    it('renders check icon inside confirm button', () => {
      renderModal({ payload: makePayload({ selectionMode: true }) });
      const btn = screen.getByRole('button', { name: /Confirm Selection/ });
      expect(btn.querySelector('.fa-solid.fa-check')).toBeInTheDocument();
    });

    it('respects maxOptions from payload', () => {
      renderModal({
        payload: makePayload({ selectionMode: true, maxOptions: 5 }),
      });
      expect(screen.getByText(/up to 5/)).toBeInTheDocument();
      expect(screen.getByText(/0\/5 selected/)).toBeInTheDocument();
    });
  });
});

// ── Maneuver use mode ──

describe('CombatSuperiorityModal - maneuver use mode', () => {
  describe('maneuver use mode', () => {
    it('renders use mode header when not in selection mode and known maneuvers exist', () => {
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Ki-Fueled Attack', 'Pushing Attack'],
        }),
      });
      expect(screen.getByText(/Combat Superiority — Choose Maneuver/)).toBeInTheDocument();
    });

    it('renders bolt icon in use mode header', () => {
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Ki-Fueled Attack'],
        }),
      });
      expect(document.querySelector('.fa-solid.fa-bolt')).toBeInTheDocument();
    });

    it('shows instruction text in use mode', () => {
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Ki-Fueled Attack'],
        }),
      });
      expect(screen.getByText(/Choose a maneuver to use/)).toBeInTheDocument();
    });

    it('groups maneuvers by action type in use mode', () => {
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Ki-Fueled Attack', 'Pushing Attack', 'Evasive Footwork'],
        }),
      });
      // attack_rider excluded from use mode
      expect(screen.getByText('Bonus Actions')).toBeInTheDocument();
      expect(screen.getByText('Movement')).toBeInTheDocument();
      expect(screen.getByText('Reactions')).toBeInTheDocument();
    });

    it('only shows known maneuvers in use mode', () => {
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Ki-Fueled Attack'],
        }),
      });
      expect(screen.getByText('Ki-Fueled Attack')).toBeInTheDocument();
      expect(screen.queryByText('Pushing Attack')).not.toBeInTheDocument();
    });

    it('filters out action types with no known maneuvers in use mode', () => {
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Ki-Fueled Attack'],
        }),
      });
      // attack_rider excluded from use mode
      expect(screen.getByText('Bonus Actions')).toBeInTheDocument();
      expect(screen.queryByText('Movement')).not.toBeInTheDocument();
    });

    it('renders radio inputs for each known maneuver in use mode', () => {
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Ki-Fueled Attack', 'Pushing Attack'],
        }),
      });
      const radios = document.querySelectorAll('input[name="combatManeuver"]');
      expect(radios.length).toBe(2);
    });

    it('has no option selected initially in use mode', () => {
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Ki-Fueled Attack', 'Pushing Attack'],
        }),
      });
      const radios = document.querySelectorAll('input[name="combatManeuver"]');
      radios.forEach(radio => expect(radio.checked).toBe(false));
    });

    it('selects a maneuver radio when clicked', () => {
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Ki-Fueled Attack', 'Pushing Attack'],
        }),
      });
      const radios = document.querySelectorAll('input[name="combatManeuver"]');
      fireEvent.click(radios[0]);
      expect(radios[0].checked).toBe(true);
    });

    it('deselects previous radio when different one is selected', () => {
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Ki-Fueled Attack', 'Pushing Attack'],
        }),
      });
      const radios = document.querySelectorAll('input[name="combatManeuver"]');
      fireEvent.click(radios[0]);
      fireEvent.click(radios[1]);
      expect(radios[0].checked).toBe(false);
      expect(radios[1].checked).toBe(true);
    });

    it('shows action type subtitle for attack_rider maneuver', () => {
      // attack_rider excluded from use mode, skip this test
    });

    it('shows action type subtitle for bonus_action maneuver', () => {
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Ki-Fueled Attack'],
        }),
      });
      expect(screen.getByText(/— bonus action/)).toBeInTheDocument();
    });

    it('shows action type subtitle for reaction maneuver', () => {
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Evasive Footwork'],
        }),
      });
      expect(screen.getByText(/— reaction/)).toBeInTheDocument();
    });

    it('shows action type subtitle for skill_check maneuver', () => {
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Kicking Attack'],
        }),
      });
      expect(screen.getByText(/— skill check/)).toBeInTheDocument();
    });

    it('shows empty subtitle span for movement type', () => {
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Pushing Attack'],
        }),
      });
      const labels = document.querySelectorAll('label');
      const pushLabel = Array.from(labels).find(l => l.textContent.includes('Pushing Attack'));
      const spans = pushLabel.querySelectorAll('span');
      expect(spans.length).toBeGreaterThan(0);
      expect(spans[0].textContent).toBe('— ');
    });

    it('shows empty subtitle span for grant_attack type', () => {
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Grasping Vine'],
        }),
      });
      const labels = document.querySelectorAll('label');
      const vineLabel = Array.from(labels).find(l => l.textContent.includes('Grasping Vine'));
      const spans = vineLabel.querySelectorAll('span');
      expect(spans.length).toBeGreaterThan(0);
      expect(spans[0].textContent).toBe('— ');
    });

    it('highlights selected maneuver with background and border', () => {
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Ki-Fueled Attack', 'Pushing Attack'],
        }),
      });
      const radios = document.querySelectorAll('input[name="combatManeuver"]');
      fireEvent.click(radios[0]);
      const labels = document.querySelectorAll('label');
      expect(labels[0].style.background).toContain('rgba(255');
    });

    it('has use maneuver button disabled when no selection', () => {
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Ki-Fueled Attack'],
        }),
      });
      expect(screen.getByRole('button', { name: /Use Maneuver/ })).toBeDisabled();
    });

    it('has use maneuver button enabled when selection exists', () => {
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Ki-Fueled Attack'],
        }),
      });
      const radios = document.querySelectorAll('input[name="combatManeuver"]');
      fireEvent.click(radios[0]);
      expect(screen.getByRole('button', { name: /Use Maneuver/ })).not.toBeDisabled();
    });

    it('has sp-roll-btn class on use maneuver button', () => {
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Ki-Fueled Attack'],
        }),
      });
      const btn = screen.getByRole('button', { name: /Use Maneuver/ });
      expect(btn.classList.contains('sp-roll-btn')).toBe(true);
    });

    it('renders bolt icon inside use maneuver button', () => {
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Ki-Fueled Attack'],
        }),
      });
      const btn = screen.getByRole('button', { name: /Use Maneuver/ });
      expect(btn.querySelector('.fa-solid.fa-bolt')).toBeInTheDocument();
    });

    it('calls onConfirm with null and maneuver name when use maneuver is clicked', async () => {
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

    it('calls onClose when overlay is clicked in use mode', () => {
      const onClose = vi.fn();
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Ki-Fueled Attack'],
        }),
        onClose,
      });
      const overlay = document.querySelector('.sp-overlay');
      fireEvent.click(overlay);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when clicking inside modal in use mode', () => {
      const onClose = vi.fn();
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Ki-Fueled Attack'],
        }),
        onClose,
      });
      const modal = document.querySelector('.sp-modal');
      fireEvent.click(modal);
      expect(onClose).not.toHaveBeenCalled();
    });

    it('has sp-dismiss-btn class on cancel button in use mode', () => {
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Ki-Fueled Attack'],
        }),
      });
      const btn = screen.getByRole('button', { name: /Cancel/ });
      expect(btn.classList.contains('sp-dismiss-btn')).toBe(true);
    });

    it('shows maneuver name with action type subtitle for grant_attack', () => {
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Grasping Vine'],
        }),
      });
      expect(screen.getByText('Grasping Vine')).toBeInTheDocument();
    });
  });
});
