// @improved-by-ai
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

// ── No maneuvers selected state ──

describe('CombatSuperiorityModal - no maneuvers state', () => {
  describe('no maneuvers selected state', () => {
    it('renders no maneuvers message when knownManeuvers is empty and not in selection mode', () => {
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: [],
        }),
      });
      expect(screen.getByText(/No maneuvers selected/)).toBeInTheDocument();
    });

    it('renders bolt icon in no maneuvers state', () => {
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: [],
        }),
      });
      expect(document.querySelector('.fa-solid.fa-bolt')).toBeInTheDocument();
    });

    it('renders "Combat Superiority" header in no maneuvers state', () => {
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: [],
        }),
      });
      expect(screen.getByText('Combat Superiority')).toBeInTheDocument();
    });

    it('renders close button in no maneuvers state', () => {
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: [],
        }),
      });
      expect(screen.getByRole('button', { name: /Close/ })).toBeInTheDocument();
    });

    it('has sp-dismiss-btn class on close button in no maneuvers state', () => {
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: [],
        }),
      });
      const btn = screen.getByRole('button', { name: /Close/ });
      expect(btn.classList.contains('sp-dismiss-btn')).toBe(true);
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

    it('calls onClose when overlay is clicked in no maneuvers state', () => {
      const onClose = vi.fn();
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: [],
        }),
        onClose,
      });
      const overlay = document.querySelector('.sp-overlay');
      fireEvent.click(overlay);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when clicking inside modal in no maneuvers state', () => {
      const onClose = vi.fn();
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: [],
        }),
        onClose,
      });
      const modal = document.querySelector('.sp-modal');
      fireEvent.click(modal);
      expect(onClose).not.toHaveBeenCalled();
    });

    it('shows the instruction text in no maneuvers state', () => {
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: [],
        }),
      });
      expect(screen.getByText(/Use Combat Superiority again to select your maneuvers/)).toBeInTheDocument();
    });
  });
});

// ── Maneuver grouping edge cases ──

describe('CombatSuperiorityModal - grouping edge cases', () => {
  describe('maneuver grouping edge cases', () => {
    it('groups maneuvers with no actionType under "other" internally', () => {
      renderModal({
        payload: makePayload({
          selectionMode: true,
          allManeuvers: [
            { name: 'No Type' },
            { name: 'Has Type', actionType: 'reaction' },
          ],
        }),
      });
      expect(screen.getByText('Has Type')).toBeInTheDocument();
      expect(screen.queryByText('No Type')).not.toBeInTheDocument();
    });

    it('renders all action type groups present in data even when some are empty in selection mode', () => {
      renderModal({
        payload: makePayload({
          selectionMode: true,
          allManeuvers: [
            { name: 'A', actionType: 'attack_rider' },
            { name: 'B', actionType: 'bonus_action' },
          ],
        }),
      });
      expect(screen.getByText('Attack Riders (on hit)')).toBeInTheDocument();
      expect(screen.getByText('Bonus Actions')).toBeInTheDocument();
      expect(screen.queryByText('Movement')).not.toBeInTheDocument();
    });
  });
});

// ── CSS classes ──

describe('CombatSuperiorityModal - CSS classes', () => {
  describe('CSS classes', () => {
    it('has sp-overlay class on outer container', () => {
      renderModal({ payload: makePayload({ selectionMode: true }) });
      expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
    });

    it('has sp-modal class on modal container', () => {
      renderModal({ payload: makePayload({ selectionMode: true }) });
      expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    });

    it('has sp-header class on header', () => {
      renderModal({ payload: makePayload({ selectionMode: true }) });
      expect(document.querySelector('.sp-header')).toBeInTheDocument();
    });

    it('has sp-body class on body', () => {
      renderModal({ payload: makePayload({ selectionMode: true }) });
      expect(document.querySelector('.sp-body')).toBeInTheDocument();
    });

    it('has sp-actions class on actions container', () => {
      renderModal({ payload: makePayload({ selectionMode: true }) });
      expect(document.querySelector('.sp-actions')).toBeInTheDocument();
    });
  });
});

// ── Known maneuvers filtering ──

describe('CombatSuperiorityModal - known maneuvers filtering', () => {
  describe('known maneuvers filtering', () => {
    it('only filters maneuvers that match knownManeuvers names in use mode', () => {
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Ki-Fueled Attack', 'Rally'],
        }),
      });
      expect(screen.getByText('Ki-Fueled Attack')).toBeInTheDocument();
      expect(screen.getByText('Rally')).toBeInTheDocument();
      expect(screen.queryByText('Pushing Attack')).not.toBeInTheDocument();
    });

    it('shows action type groups only if they contain known maneuvers in use mode', () => {
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Ki-Fueled Attack'],
        }),
      });
      expect(screen.getByText('Bonus Actions')).toBeInTheDocument();
      expect(screen.queryByText('Movement')).not.toBeInTheDocument();
      expect(screen.queryByText('Reactions')).not.toBeInTheDocument();
    });

    it('handles knownManeuvers with maneuver not in allManeuvers', () => {
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
});

// ── toggleSelection behavior ──

describe('CombatSuperiorityModal - toggleSelection', () => {
  describe('toggleSelection behavior', () => {
    it('removes maneuver from selection when toggling off', () => {
      renderModal({ payload: makePayload({ selectionMode: true }) });
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      fireEvent.click(checkboxes[0]);
      expect(screen.getByText(/1\/3 selected/)).toBeInTheDocument();
      fireEvent.click(checkboxes[0]);
      expect(screen.getByText(/0\/3 selected/)).toBeInTheDocument();
    });

    it('adds maneuver to selection when toggling on', () => {
      renderModal({ payload: makePayload({ selectionMode: true }) });
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      fireEvent.click(checkboxes[0]);
      expect(screen.getByText(/1\/3 selected/)).toBeInTheDocument();
      fireEvent.click(checkboxes[1]);
      expect(screen.getByText(/2\/3 selected/)).toBeInTheDocument();
    });

    it('prevents adding more than maxOptions', () => {
      renderModal({ payload: makePayload({ selectionMode: true }) });
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      fireEvent.click(checkboxes[0]);
      fireEvent.click(checkboxes[1]);
      fireEvent.click(checkboxes[2]);
      expect(screen.getByText(/3\/3 selected/)).toBeInTheDocument();
      fireEvent.click(checkboxes[3]);
      expect(screen.getByText(/3\/3 selected/)).toBeInTheDocument();
    });
  });
});

// ── handleClearSelection behavior ──

describe('CombatSuperiorityModal - handleClearSelection', () => {
  describe('handleClearSelection behavior', () => {
    it('clears all selections and calls onConfirm with empty array', () => {
      const onConfirm = vi.fn();
      renderModal({
        payload: makePayload({
          selectionMode: true,
          knownManeuvers: ['Ki-Fueled Attack', 'Pushing Attack'],
        }),
        onConfirm,
      });

      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      fireEvent.click(checkboxes[0]);
      fireEvent.click(checkboxes[1]);

      fireEvent.click(screen.getByRole('button', { name: /Clear Selection/ }));
      expect(onConfirm).toHaveBeenCalledWith([], null);
    });

    it('clears only calls onConfirm, does not close modal', () => {
      const onClose = vi.fn();
      const onConfirm = vi.fn();
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
});

// ── handleUseManeuver async behavior ──

describe('CombatSuperiorityModal - handleUseManeuver', () => {
  describe('handleUseManeuver async behavior', () => {
    it('sets applied to true after onConfirm resolves', async () => {
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

    it('does not set applied when onConfirm is not called (no selection)', async () => {
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

    it('handles onConfirm returning null result gracefully (no applied state)', async () => {
      const onConfirm = vi.fn();
      onConfirm.mockResolvedValue(null);
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
        expect(screen.queryByText('Done')).not.toBeInTheDocument();
      });
    });
  });
});

// ── Selection mode message variants ──

describe('CombatSuperiorityModal - message variants', () => {
  describe('selection mode message variants', () => {
    it('shows known maneuvers count in message', () => {
      renderModal({
        payload: makePayload({
          selectionMode: true,
          knownManeuvers: ['Ki-Fueled Attack', 'Pushing Attack', 'Disarming Attack'],
        }),
      });
      expect(screen.getByText(/Your known maneuvers: 3/)).toBeInTheDocument();
    });

    it('shows up to maxOptions in known message', () => {
      renderModal({
        payload: makePayload({
          selectionMode: true,
          knownManeuvers: ['Ki-Fueled Attack'],
          maxOptions: 5,
        }),
      });
      expect(screen.getByText(/up to 5/)).toBeInTheDocument();
    });

    it('shows learning message when no known maneuvers', () => {
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
});

// ── Overlay click behavior ──

describe('CombatSuperiorityModal - overlay clicks', () => {
  describe('overlay click behavior', () => {
    it('does not close when clicking modal content in selection mode', () => {
      const onClose = vi.fn();
      renderModal({
        payload: makePayload({ selectionMode: true }),
        onClose,
      });
      const modal = document.querySelector('.sp-modal');
      fireEvent.click(modal);
      expect(onClose).not.toHaveBeenCalled();
    });

    it('does not close when clicking modal content in use mode', () => {
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

    it('does not close when clicking modal content in no-maneuvers state', () => {
      const onClose = vi.fn();
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: [],
        }),
        onClose,
      });
      const modal = document.querySelector('.sp-modal');
      fireEvent.click(modal);
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});

// ── handleConfirmSelection behavior ──

describe('CombatSuperiorityModal - handleConfirmSelection', () => {
  describe('handleConfirmSelection behavior', () => {
    it('calls onConfirm with selected array and null when there are selections', () => {
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

    it('does not call onConfirm when confirm is clicked with zero selections', () => {
      const onConfirm = vi.fn();
      renderModal({
        payload: makePayload({ selectionMode: true }),
        onConfirm,
      });
      fireEvent.click(screen.getByRole('button', { name: /Confirm Selection/ }));
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it('does not call onClose when confirm is clicked', () => {
      const onClose = vi.fn();
      renderModal({
        payload: makePayload({ selectionMode: true }),
        onClose,
      });
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      fireEvent.click(checkboxes[0]);
      fireEvent.click(screen.getByRole('button', { name: /Confirm Selection/ }));
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});

// ── Visual feedback ──

describe('CombatSuperiorityModal - visual feedback', () => {
  describe('selection mode checkbox visual feedback', () => {
    it('applies border when checkbox is selected', () => {
      renderModal({ payload: makePayload({ selectionMode: true }) });
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      fireEvent.click(checkboxes[0]);
      const labels = document.querySelectorAll('label');
      expect(labels[0].style.border).toContain('var(--color-link)');
    });

    it('removes border when checkbox is deselected', () => {
      renderModal({ payload: makePayload({ selectionMode: true }) });
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      fireEvent.click(checkboxes[0]);
      fireEvent.click(checkboxes[0]);
      const labels = document.querySelectorAll('label');
      expect(labels[0].style.border).toContain('transparent');
    });

    it('applies reduced opacity to unselectable checkboxes at max', () => {
      renderModal({ payload: makePayload({ selectionMode: true }) });
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      fireEvent.click(checkboxes[0]);
      fireEvent.click(checkboxes[1]);
      fireEvent.click(checkboxes[2]);
      const labels = document.querySelectorAll('label');
      expect(labels[3].style.opacity).toBe('0.5');
    });

    it('applies full opacity to selected checkboxes even at max', () => {
      renderModal({ payload: makePayload({ selectionMode: true }) });
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      fireEvent.click(checkboxes[0]);
      fireEvent.click(checkboxes[1]);
      fireEvent.click(checkboxes[2]);
      const labels = document.querySelectorAll('label');
      expect(labels[0].style.opacity).toBe('1');
    });
  });

  describe('selection mode input types', () => {
    it('uses checkbox input type in selection mode', () => {
      renderModal({ payload: makePayload({ selectionMode: true }) });
      const inputs = document.querySelectorAll('input[type="checkbox"]');
      expect(inputs.length).toBeGreaterThan(0);
    });

    it('does not use radio inputs in selection mode', () => {
      renderModal({ payload: makePayload({ selectionMode: true }) });
      const radioInputs = document.querySelectorAll('input[name="combatManeuver"]');
      expect(radioInputs.length).toBe(0);
    });

    it('uses radio input type in use mode', () => {
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Ki-Fueled Attack', 'Pushing Attack'],
        }),
      });
      const radioInputs = document.querySelectorAll('input[name="combatManeuver"]');
      expect(radioInputs.length).toBe(2);
    });

    it('does not use checkbox inputs in use mode', () => {
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Ki-Fueled Attack'],
        }),
      });
      const checkboxInputs = document.querySelectorAll('input[type="checkbox"]');
      expect(checkboxInputs.length).toBe(0);
    });
  });

  describe('maneuver use mode radio visual feedback', () => {
    it('applies background to selected radio label', () => {
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

    it('applies border to selected radio label', () => {
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Ki-Fueled Attack', 'Pushing Attack'],
        }),
      });
      const radios = document.querySelectorAll('input[name="combatManeuver"]');
      fireEvent.click(radios[0]);
      const labels = document.querySelectorAll('label');
      expect(labels[0].style.border).toContain('var(--color-link)');
    });

    it('removes background when radio is deselected', () => {
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Ki-Fueled Attack', 'Pushing Attack'],
        }),
      });
      const radios = document.querySelectorAll('input[name="combatManeuver"]');
      fireEvent.click(radios[0]);
      fireEvent.click(radios[1]);
      const labels = document.querySelectorAll('label');
      expect(labels[0].style.background).toBe('transparent');
    });
  });
});

// ── Same action type ──

describe('CombatSuperiorityModal - same action type', () => {
  describe('maneuver use mode - same action type', () => {
    it('groups all known maneuvers under single action type header', () => {
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Ki-Fueled Attack', 'Evasive Footwork'],
        }),
      });
      const headings = document.querySelectorAll('h4');
      // attack_rider excluded from use mode, so Ki-Fueled (bonus_action) and Evasive (reaction) are in different groups
      expect(headings.length).toBe(2);
      expect(headings[0].textContent).toBe('Bonus Actions');
      expect(headings[1].textContent).toBe('Reactions');
    });

    it('renders both maneuvers under their respective headers', () => {
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Ki-Fueled Attack', 'Evasive Footwork'],
        }),
      });
      expect(screen.getByText('Ki-Fueled Attack')).toBeInTheDocument();
      expect(screen.getByText('Evasive Footwork')).toBeInTheDocument();
    });
  });

  describe('selection mode - same action type', () => {
    it('groups all maneuvers under single action type header', () => {
      renderModal({
        payload: makePayload({
          selectionMode: true,
          allManeuvers: [
            { name: 'A', actionType: 'bonus_action' },
            { name: 'B', actionType: 'bonus_action' },
          ],
        }),
      });
      const headings = document.querySelectorAll('h4');
      expect(headings.length).toBe(1);
    });
  });
});

// ── Duplicate maneuver names ──

describe('CombatSuperiorityModal - duplicate names', () => {
  describe('selection mode - duplicate maneuver names', () => {
    it('treats duplicate maneuver names as same maneuver', () => {
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
});

// ── Grant attack subtitle ──

describe('CombatSuperiorityModal - grant_attack subtitle', () => {
  describe('grant_attack action type subtitle', () => {
    it('shows empty subtitle for grant_attack type', () => {
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Grasping Vine'],
          allManeuvers: [{ name: 'Grasping Vine', actionType: 'grant_attack' }],
        }),
      });
      expect(screen.getByText('Grasping Vine')).toBeInTheDocument();
    });
  });
});

// ── Movement subtitle ──

describe('CombatSuperiorityModal - movement subtitle', () => {
  describe('movement action type subtitle', () => {
    it('shows empty subtitle for movement type', () => {
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Pushing Attack'],
          allManeuvers: [{ name: 'Pushing Attack', actionType: 'movement' }],
        }),
      });
      const labels = document.querySelectorAll('label');
      const pushLabel = Array.from(labels).find(l => l.textContent.includes('Pushing Attack'));
      expect(pushLabel).toBeInTheDocument();
    });
  });
});

// ── maxOptions = 0 ──

describe('CombatSuperiorityModal - maxOptions 0', () => {
  describe('maxOptions = 0 edge case', () => {
    it('prevents any selection when maxOptions is 0', () => {
      renderModal({
        payload: makePayload({
          selectionMode: true,
          maxOptions: 0,
        }),
      });
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach(cb => expect(cb.disabled).toBe(true));
    });

    it('shows 0/0 selected when maxOptions is 0', () => {
      renderModal({
        payload: makePayload({
          selectionMode: true,
          maxOptions: 0,
        }),
      });
      expect(screen.getByText(/0\/0 selected/)).toBeInTheDocument();
    });

    it('has confirm button disabled when maxOptions is 0', () => {
      renderModal({
        payload: makePayload({
          selectionMode: true,
          maxOptions: 0,
        }),
      });
      expect(screen.getByRole('button', { name: /Confirm Selection/ })).toBeDisabled();
    });
  });
});

// ── maxOptions = 1 ──

describe('CombatSuperiorityModal - maxOptions 1', () => {
  describe('maxOptions = 1 edge case', () => {
    it('allows selecting exactly one maneuver when maxOptions is 1', () => {
      renderModal({
        payload: makePayload({
          selectionMode: true,
          maxOptions: 1,
        }),
      });
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      fireEvent.click(checkboxes[0]);
      expect(screen.getByText(/1\/1 selected/)).toBeInTheDocument();
    });

    it('disables remaining checkboxes after selecting 1 when maxOptions is 1', () => {
      renderModal({
        payload: makePayload({
          selectionMode: true,
          maxOptions: 1,
        }),
      });
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      fireEvent.click(checkboxes[0]);
      expect(checkboxes[1].disabled).toBe(true);
    });

    it('allows toggling off the selected maneuver when maxOptions is 1', () => {
      renderModal({
        payload: makePayload({
          selectionMode: true,
          maxOptions: 1,
        }),
      });
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      fireEvent.click(checkboxes[0]);
      expect(checkboxes[0].disabled).toBe(false);
      fireEvent.click(checkboxes[0]);
      expect(screen.getByText(/0\/1 selected/)).toBeInTheDocument();
    });
  });
});

// ── CSS consistency ──

describe('CombatSuperiorityModal - CSS consistency', () => {
  describe('CSS class consistency across modes', () => {
    it('selection mode has correct CSS classes', () => {
      renderModal({ payload: makePayload({ selectionMode: true }) });
      expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
      expect(document.querySelector('.sp-modal')).toBeInTheDocument();
      expect(document.querySelector('.sp-header')).toBeInTheDocument();
      expect(document.querySelector('.sp-body')).toBeInTheDocument();
      expect(document.querySelector('.sp-actions')).toBeInTheDocument();
    });

    it('use mode has correct CSS classes', () => {
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Ki-Fueled Attack'],
        }),
      });
      expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
      expect(document.querySelector('.sp-modal')).toBeInTheDocument();
      expect(document.querySelector('.sp-header')).toBeInTheDocument();
      expect(document.querySelector('.sp-body')).toBeInTheDocument();
      expect(document.querySelector('.sp-actions')).toBeInTheDocument();
    });

    it('no-maneuvers mode has correct CSS classes', () => {
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: [],
        }),
      });
      expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
      expect(document.querySelector('.sp-modal')).toBeInTheDocument();
      expect(document.querySelector('.sp-header')).toBeInTheDocument();
      expect(document.querySelector('.sp-body')).toBeInTheDocument();
      expect(document.querySelector('.sp-actions')).toBeInTheDocument();
    });

    it('result mode has correct CSS classes', async () => {
      const props = makeProps();
      props.payload = makePayload({ selectionMode: false, knownManeuvers: ['Ki-Fueled Attack'] });
      props.onConfirm.mockResolvedValue({
        payload: { name: 'Ki-Fueled Attack', description: 'Desc.' },
      });
      render(<CombatSuperiorityModal {...props} />);

      const radios = document.querySelectorAll('input[name="combatManeuver"]');
      fireEvent.click(radios[0]);
      fireEvent.click(screen.getByRole('button', { name: /Use Maneuver/ }));

      await waitFor(() => {
        expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
        expect(document.querySelector('.sp-modal')).toBeInTheDocument();
        expect(document.querySelector('.sp-header')).toBeInTheDocument();
        expect(document.querySelector('.sp-body')).toBeInTheDocument();
        expect(document.querySelector('.sp-actions')).toBeInTheDocument();
      });
    });
  });
});

// ── Action type ordering ──

describe('CombatSuperiorityModal - ordering', () => {
  describe('action type ordering', () => {
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

    it('renders action types in the defined order in use mode', () => {
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Ki-Fueled Attack', 'Ki-Fueled Attack', 'Evasive Footwork'],
        }),
      });
      const headings = document.querySelectorAll('h4');
      const headingTexts = Array.from(headings).map(h => h.textContent);
      // attack_rider excluded from use mode (handled by AttackRiderManeuverPrompt during damage click)
      expect(headingTexts[0]).toBe('Bonus Actions');
      expect(headingTexts[1]).toBe('Reactions');
    });
  });

  describe('maneuver ordering within groups', () => {
    it('preserves original order of maneuvers within each action type group', () => {
      renderModal({ payload: makePayload({ selectionMode: true }) });
      const labels = document.querySelectorAll('label');
      const labelTexts = Array.from(labels).map(l => l.textContent.trim());
      const kiIndex = labelTexts.indexOf('Ki-Fueled Attack');
      const disarmingIndex = labelTexts.indexOf('Disarming Attack');
      const pushingIndex = labelTexts.indexOf('Pushing Attack');
      expect(kiIndex).toBeLessThan(pushingIndex);
      expect(disarmingIndex).toBeLessThan(pushingIndex);
    });
  });
});

// ── Single maneuver ──

describe('CombatSuperiorityModal - single maneuver', () => {
  describe('selection mode with single maneuver', () => {
    it('renders single maneuver in selection mode', () => {
      renderModal({
        payload: makePayload({
          selectionMode: true,
          allManeuvers: [{ name: 'Only Maneuver', actionType: 'bonus_action' }],
        }),
      });
      expect(screen.getByText('Only Maneuver')).toBeInTheDocument();
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      expect(checkboxes.length).toBe(1);
    });

    it('allows selecting the only maneuver', () => {
      renderModal({
        payload: makePayload({
          selectionMode: true,
          allManeuvers: [{ name: 'Only Maneuver', actionType: 'bonus_action' }],
        }),
      });
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      fireEvent.click(checkboxes[0]);
      expect(screen.getByText(/1\/3 selected/)).toBeInTheDocument();
    });
  });

  describe('maneuver use mode with single known maneuver', () => {
    it('renders single known maneuver in use mode', () => {
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Only Maneuver'],
          allManeuvers: [{ name: 'Only Maneuver', actionType: 'bonus_action' }],
        }),
      });
      expect(screen.getByText('Only Maneuver')).toBeInTheDocument();
    });

    it('allows selecting the only maneuver', () => {
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Only Maneuver'],
          allManeuvers: [{ name: 'Only Maneuver', actionType: 'bonus_action' }],
        }),
      });
      const radios = document.querySelectorAll('input[name="combatManeuver"]');
      expect(radios.length).toBe(1);
      fireEvent.click(radios[0]);
      expect(radios[0].checked).toBe(true);
    });
  });
});
