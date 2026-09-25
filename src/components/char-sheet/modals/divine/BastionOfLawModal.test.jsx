// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BastionOfLawModal from './BastionOfLawModal.jsx';

// ── Mocked modules ──

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
}));

// ── Re-import mocked modules ──

import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';

// ── Test fixtures ──

const baseProps = {
  featureName: 'Bastion of Law',
  creatureTargets: [
    { name: 'Sorcerer1', type: 'player', currentHp: 45, maxHp: 45 },
    { name: 'AllyWarrior', type: 'npc', currentHp: 30, maxHp: 30 },
    { name: 'AllyRogue', type: 'npc', currentHp: 25, maxHp: 25 },
  ],
  playerName: 'Sorcerer1',
  campaignName: 'test-campaign',
  auto: { maxSP: 5, minSP: 1, range: '30_ft' },
  onClose: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

function renderModal(propsOverrides) {
  return render(<BastionOfLawModal {...makeProps(propsOverrides)} />);
}

// ── Tests ──

describe('BastionOfLawModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeState.getRuntimeValue.mockImplementation((player, key, _campaign) => {
      if (key === 'sorceryPoints') return 10;
      return 10;
    });
  });

  // ── Initial render / display ──

  describe('initial render', () => {
    it('renders the modal with feature name, description, and target list', () => {
      renderModal();
      expect(screen.getByText('Bastion of Law')).toBeInTheDocument();
      expect(screen.getByText(/Choose a creature to create a magical ward on/)).toBeInTheDocument();
    });

    it('renders all creature targets in the selection list with HP and type labels', () => {
      renderModal();
      expect(screen.getByText('Sorcerer1')).toBeInTheDocument();
      expect(screen.getByText('AllyWarrior')).toBeInTheDocument();
      expect(screen.getByText('AllyRogue')).toBeInTheDocument();
      expect(screen.getByText('45/45 HP')).toBeInTheDocument();
      expect(screen.getByText('30/30 HP')).toBeInTheDocument();
      expect(screen.getByText('25/25 HP')).toBeInTheDocument();
    });

    it('renders SP input with correct min/max and defaults to min', () => {
      renderModal();
      const input = screen.getByLabelText('Sorcery Points to spend:');
      expect(input).toBeInTheDocument();
      expect(input.min).toBe('1');
      expect(input.max).toBe('5');
      expect(input.value).toBe('1');
    });

    it('renders the Create Ward button and ward details section', () => {
      renderModal();
      expect(screen.getByText(/Creates 1d8 ward/)).toBeInTheDocument();
      expect(screen.getByText(/Ward dice: 1d8/)).toBeInTheDocument();
      expect(screen.getByText(/30 ft/)).toBeInTheDocument();
      expect(screen.getByText(/Long Rest or until target uses it/)).toBeInTheDocument();
      expect(screen.getByText(/Target uses Reaction when taking damage to spend dice/)).toBeInTheDocument();
    });

    it('renders the Cancel button', () => {
      renderModal();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('disables Create Ward button when no target selected', () => {
      renderModal();
      const createBtn = screen.getByRole('button', { name: /Create Ward/ });
      expect(createBtn).toBeDisabled();
    });

    it('enables Create Ward button when a target is selected', () => {
      renderModal();
      const warriorLabel = screen.getByText('AllyWarrior');
      fireEvent.click(warriorLabel);
      const createBtn = screen.getByRole('button', { name: /Create Ward/ });
      expect(createBtn).not.toBeDisabled();
    });
  });

  // ── Target selection ──

  describe('target selection', () => {
    function getTargetOption(text) {
      const labels = document.querySelectorAll('.bastion-target-option');
      for (const label of labels) {
        if (label.textContent.includes(text)) {
          return label;
        }
      }
      return null;
    }

    it('highlights selected target with selected class and switches selection on re-click', () => {
      renderModal();
      const warriorOption = getTargetOption('AllyWarrior');
      fireEvent.click(warriorOption);
      expect(warriorOption).toHaveClass('selected');

      const rogueOption = getTargetOption('AllyRogue');
      fireEvent.click(rogueOption);
      expect(warriorOption).not.toHaveClass('selected');
      expect(rogueOption).toHaveClass('selected');
    });
  });

  // ── SP input clamping behavior ──

  describe('SP input clamping', () => {
    it('clamps to min when input is below min', () => {
      renderModal();
      const input = screen.getByLabelText('Sorcery Points to spend:');
      fireEvent.change(input, { target: { value: '0' } });
      expect(input.value).toBe('1');
    });

    it('clamps to max when input is above max', () => {
      renderModal({ auto: { maxSP: 3 } });
      const input = screen.getByLabelText('Sorcery Points to spend:');
      fireEvent.change(input, { target: { value: '10' } });
      expect(input.value).toBe('3');
    });

    it('defaults to min for empty or non-numeric input', () => {
      renderModal();
      const input = screen.getByLabelText('Sorcery Points to spend:');
      fireEvent.change(input, { target: { value: '' } });
      expect(input.value).toBe('1');
      fireEvent.change(input, { target: { value: 'abc' } });
      expect(input.value).toBe('1');
    });

    it('clamps to minSP when sorcery points are lower than maxSP', () => {
      runtimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'sorceryPoints') return 3;
        return 10;
      });
      renderModal({ auto: { maxSP: 5, minSP: 1 } });
      const input = screen.getByLabelText('Sorcery Points to spend:');
      expect(input.value).toBe('1');
    });

    it('respects minSP even when sorcery points are high', () => {
      runtimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'sorceryPoints') return 10;
        return 10;
      });
      renderModal({ auto: { maxSP: 5, minSP: 2 } });
      const input = screen.getByLabelText('Sorcery Points to spend:');
      expect(input.value).toBe('2');
    });

    it('updates the Create Ward button dice count when SP changes', () => {
      renderModal({ auto: { maxSP: 5 } });
      const input = screen.getByLabelText('Sorcery Points to spend:');
      fireEvent.change(input, { target: { value: '4' } });
      expect(screen.getByText(/Creates 4d8 ward/)).toBeInTheDocument();
    });
  });

  // ── Create Ward flow ──

  describe('create ward flow', () => {
    it('calls onConfirm with spAmount and selectedTargetName when Create Ward is clicked', async () => {
      const onConfirm = vi.fn().mockResolvedValue({ type: 'popup', payload: { description: 'Ward created' } });
      renderModal({ onConfirm, auto: { maxSP: 3 } });

      const warriorLabel = screen.getByText('AllyWarrior');
      fireEvent.click(warriorLabel);

      const input = screen.getByLabelText('Sorcery Points to spend:');
      fireEvent.change(input, { target: { value: '2' } });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create Ward/ }));
      });

      expect(onConfirm).toHaveBeenCalledWith(2, 'AllyWarrior');
    });

    it('calls onClose after successful ward creation', async () => {
      const onClose = vi.fn();
      const onConfirm = vi.fn().mockResolvedValue({ type: 'popup', payload: { description: 'Ward created' } });
      render(<BastionOfLawModal {...makeProps({ onClose, onConfirm, auto: { maxSP: 3 } })} />);

      const warriorLabel = screen.getByText('AllyWarrior');
      fireEvent.click(warriorLabel);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create Ward/ }));
      });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onConfirm when Create Ward is clicked and no target selected', async () => {
      const onConfirm = vi.fn();
      renderModal({ onConfirm });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create Ward/ }));
      });

      expect(onConfirm).not.toHaveBeenCalled();
    });

    it('calls onClose when Cancel button is clicked', async () => {
      const onClose = vi.fn();
      render(<BastionOfLawModal {...makeProps({ onClose })} />);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose or onConfirm when overlay is clicked', async () => {
      const onClose = vi.fn();
      const onConfirm = vi.fn();
      render(<BastionOfLawModal {...makeProps({ onClose, onConfirm })} />);

      const warriorLabel = screen.getByText('AllyWarrior');
      fireEvent.click(warriorLabel);

      await act(async () => {
        fireEvent.click(document.querySelector('.sp-overlay'));
      });

      expect(onClose).not.toHaveBeenCalled();
      expect(onConfirm).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });
  });

  // ── Custom auto config ──

  describe('custom auto config', () => {
    it('uses custom maxSP, minSP, and defaults to minSP value', () => {
      renderModal({ auto: { maxSP: 8, minSP: 2, range: '30_ft' } });
      const input = screen.getByLabelText('Sorcery Points to spend:');
      expect(input.max).toBe('8');
      expect(input.min).toBe('2');
      expect(input.value).toBe('2');
    });

    it('formats range by replacing underscores with spaces', () => {
      renderModal({ auto: { range: '30_ft' } });
      expect(screen.getByText(/30 ft/)).toBeInTheDocument();
    });

    it('uses default range when auto.range is null', () => {
      renderModal({ auto: { range: null } });
      expect(screen.getByText(/30 ft/)).toBeInTheDocument();
    });

    it('uses default range when auto.range is undefined', () => {
      renderModal({ auto: {} });
      expect(screen.getByText(/30 ft/)).toBeInTheDocument();
    });

    it('uses default SP values when auto is null', () => {
      renderModal({ auto: null });
      const input = screen.getByLabelText('Sorcery Points to spend:');
      expect(input.min).toBe('1');
      expect(input.max).toBe('5');
      expect(input.value).toBe('1');
    });

    it('uses default SP values when auto is undefined', () => {
      renderModal({ auto: undefined });
      const input = screen.getByLabelText('Sorcery Points to spend:');
      expect(input.min).toBe('1');
      expect(input.max).toBe('5');
      expect(input.value).toBe('1');
    });
  });

  // ── Edge cases ──

  describe('edge cases', () => {
    it('renders with empty creature targets list', () => {
      renderModal({ creatureTargets: [] });
      expect(screen.getByText('Bastion of Law')).toBeInTheDocument();
      expect(screen.getByText(/Choose a creature to create a magical ward on/)).toBeInTheDocument();
      expect(screen.queryByText(/Sorcerer|AllyWarrior|AllyRogue/)).not.toBeInTheDocument();
    });

    it('renders targets without HP gracefully', () => {
      renderModal({ creatureTargets: [{ name: 'Mystery', type: 'npc', currentHp: null, maxHp: null }] });
      expect(screen.getByText('Mystery')).toBeInTheDocument();
      expect(screen.queryByText(/HP/)).not.toBeInTheDocument();
    });
  });
});
