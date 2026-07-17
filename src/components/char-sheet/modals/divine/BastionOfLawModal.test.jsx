// @cleaned-by-ai
// @improved-by-ai
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BastionOfLawModal from './BastionOfLawModal.jsx';

// ── Mocked modules ──

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => 10),
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
    runtimeState.getRuntimeValue.mockImplementation((player, key) => {
      if (key === 'sorceryPoints') return 10;
      return 10;
    });
  });

  // ── Initial render / display ──

  describe('initial render', () => {
    it('renders the overlay, modal, feature name, and target list', () => {
      renderModal();
      expect(screen.getByText('Bastion of Law')).toBeInTheDocument();
      expect(screen.getByText(/Choose a creature to create a magical ward on/)).toBeInTheDocument();
    });

    it('renders the shield icon in the header', () => {
      renderModal();
      expect(document.querySelector('.fa-shield-halved')).toBeInTheDocument();
    });

    it('renders CSS structural classes on overlay, modal, section, and actions', () => {
      renderModal();
      expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
      expect(document.querySelector('.sp-modal')).toBeInTheDocument();
      expect(document.querySelector('.sp-header')).toBeInTheDocument();
      expect(document.querySelector('.sp-body')).toBeInTheDocument();
      expect(document.querySelector('.sp-actions')).toBeInTheDocument();
    });

    it('renders all creature targets in the selection list', () => {
      renderModal();
      expect(screen.getByText('Sorcerer1')).toBeInTheDocument();
      expect(screen.getByText('AllyWarrior')).toBeInTheDocument();
      expect(screen.getByText('AllyRogue')).toBeInTheDocument();
      expect(document.querySelector('.target-type')).toHaveTextContent('player');
      expect(document.querySelectorAll('.target-type')[1]).toHaveTextContent('npc');
    });

    it('renders SP input with correct min/max', () => {
      renderModal();
      const input = document.querySelector('input[type="number"]');
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
      const warriorLabel = screen.getByText('AllyWarrior').parentElement;
      fireEvent.click(warriorLabel);
      const createBtn = screen.getByRole('button', { name: /Create Ward/ });
      expect(createBtn).not.toBeDisabled();
    });
  });

  // ── Target selection ──

  describe('target selection', () => {
    it('highlights selected target with selected class', () => {
      renderModal();
      const warriorLabel = screen.getByText('AllyWarrior').parentElement;
      fireEvent.click(warriorLabel);
      expect(warriorLabel).toHaveClass('selected');

      const rogueLabel = screen.getByText('AllyRogue').parentElement;
      fireEvent.click(rogueLabel);
      expect(warriorLabel).not.toHaveClass('selected');
      expect(rogueLabel).toHaveClass('selected');
    });

    it('includes HP display for targets', () => {
      renderModal();
      expect(screen.getByText('45/45 HP')).toBeInTheDocument();
      expect(screen.getByText('30/30 HP')).toBeInTheDocument();
      expect(screen.getByText('25/25 HP')).toBeInTheDocument();
    });
  });

  // ── SP input clamping behavior ──

  describe('SP input clamping', () => {
    it('clamps to min when input is below min', () => {
      renderModal();
      const input = document.querySelector('input[type="number"]');
      fireEvent.change(input, { target: { value: '0' } });
      expect(input.value).toBe('1');
    });

    it('clamps to max when input is above max', () => {
      renderModal({ auto: { maxSP: 3 } });
      const input = document.querySelector('input[type="number"]');
      fireEvent.change(input, { target: { value: '10' } });
      expect(input.value).toBe('3');
    });

    it('defaults to min when input is empty', () => {
      renderModal();
      const input = document.querySelector('input[type="number"]');
      fireEvent.change(input, { target: { value: '' } });
      expect(input.value).toBe('1');
    });

    it('clamps to minSP when sorcery points are lower than maxSP', () => {
      runtimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'sorceryPoints') return 3;
        return 10;
      });
      renderModal({ auto: { maxSP: 5, minSP: 1 } });
      const input = document.querySelector('input[type="number"]');
      expect(input.value).toBe('1');
    });

    it('respects minSP even when sorcery points are high', () => {
      runtimeState.getRuntimeValue.mockReturnValueOnce(10);
      renderModal({ auto: { maxSP: 5, minSP: 2 } });
      const input = document.querySelector('input[type="number"]');
      expect(input.value).toBe('2');
    });

    it('updates the Create Ward button dice count when SP changes', () => {
      renderModal({ auto: { maxSP: 5 } });
      const input = document.querySelector('input[type="number"]');
      fireEvent.change(input, { target: { value: '4' } });
      expect(screen.getByText(/Creates 4d8 ward/)).toBeInTheDocument();
    });
  });

  // ── Create Ward flow ──

  describe('create ward flow', () => {
    it('calls onConfirm with spAmount and selectedTargetName when Create Ward is clicked', async () => {
      const onConfirm = vi.fn().mockResolvedValue({ type: 'popup', payload: { description: 'Ward created' } });
      renderModal({ onConfirm, auto: { maxSP: 3 } });

      const warriorLabel = screen.getByText('AllyWarrior').parentElement;
      fireEvent.click(warriorLabel);

      const input = document.querySelector('input[type="number"]');
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

      const warriorLabel = screen.getByText('AllyWarrior').parentElement;
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

    it('calls onClose when overlay is clicked', async () => {
      const onClose = vi.fn();
      render(<BastionOfLawModal {...makeProps({ onClose })} />);

      await act(async () => {
        fireEvent.click(document.querySelector('.sp-overlay'));
      });

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  // ── Custom auto config ──

  describe('custom auto config', () => {
    it('uses custom maxSP, minSP, and defaults to minSP value', () => {
      renderModal({ auto: { maxSP: 8, minSP: 2, range: '30_ft' } });
      const input = document.querySelector('input[type="number"]');
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
  });
});
