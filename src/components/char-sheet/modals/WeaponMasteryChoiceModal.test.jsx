// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WeaponMasteryChoiceModal from './WeaponMasteryChoiceModal.jsx';

vi.mock('../../../services/automation/index.js', () => ({
  applyWeaponMasteryChoice: vi.fn(),
}));

import * as automation from '../../../services/automation/index.js';

const baseProps = {
  playerStats: { name: 'Fighter1', level: 5 },
  campaignName: 'test-campaign',
  masteryProperties: ['Piercing', 'Slashing', 'Heavy'],
  onClose: vi.fn(),
  onConfirm: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('WeaponMasteryChoiceModal', () => {
  // ── Initial render ──

  describe('initial render', () => {
    it('renders the modal with header, instruction text, mastery options, and action buttons', () => {
      render(<WeaponMasteryChoiceModal {...makeProps()} />);
      expect(screen.getByText('Weapon Master — Choose Mastery')).toBeInTheDocument();
      expect(screen.getByText(/Choose a mastery property to activate/)).toBeInTheDocument();
      expect(screen.getByText('Piercing')).toBeInTheDocument();
      expect(screen.getByText('Slashing')).toBeInTheDocument();
      expect(screen.getByText('Heavy')).toBeInTheDocument();
      expect(screen.getAllByRole('radio')).toHaveLength(3);
      expect(screen.getByRole('button', { name: 'Select' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Select' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Skip' })).toBeEnabled();
    });

    it('renders no radio buttons when masteryProperties is empty', () => {
      render(<WeaponMasteryChoiceModal {...makeProps({ masteryProperties: [] })} />);
      expect(screen.getByText(/Choose a mastery property/)).toBeInTheDocument();
      expect(screen.queryAllByRole('radio')).toHaveLength(0);
    });
  });

  // ── Selection behavior ──

  describe('selection behavior', () => {
    it('enables the Select button after a mastery option is clicked', () => {
      render(<WeaponMasteryChoiceModal {...makeProps()} />);
      expect(screen.getByRole('button', { name: 'Select' })).toBeDisabled();
      fireEvent.click(screen.getByText('Piercing'));
      expect(screen.getByRole('button', { name: 'Select' })).not.toBeDisabled();
    });

    it('switches selection when a different mastery option is clicked', () => {
      render(<WeaponMasteryChoiceModal {...makeProps()} />);
      fireEvent.click(screen.getByText('Piercing'));
      expect(screen.getByRole('radio', { name: 'Piercing' })).toBeChecked();
      fireEvent.click(screen.getByText('Heavy'));
      expect(screen.getByRole('radio', { name: 'Heavy' })).toBeChecked();
      expect(screen.getByRole('radio', { name: 'Piercing' })).not.toBeChecked();
    });

    it('allows skipping even when a mastery is selected', () => {
      const onClose = vi.fn();
      render(<WeaponMasteryChoiceModal {...makeProps({ onClose })} />);
      fireEvent.click(screen.getByText('Slashing'));
      expect(screen.getByRole('radio', { name: 'Slashing' })).toBeChecked();
      fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(automation.applyWeaponMasteryChoice).not.toHaveBeenCalled();
    });
  });

  // ── Select button — no selection ──

  describe('select button without selection', () => {
    it('does not call applyWeaponMasteryChoice or onConfirm when Select is clicked without a selection', () => {
      render(<WeaponMasteryChoiceModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: 'Select' }));
      expect(automation.applyWeaponMasteryChoice).not.toHaveBeenCalled();
      expect(baseProps.onConfirm).not.toHaveBeenCalled();
    });
  });

  // ── Select button — with selection ──

  describe('select button with selection', () => {
    it('calls applyWeaponMasteryChoice with the selected mastery, playerStats, and campaignName', async () => {
      automation.applyWeaponMasteryChoice.mockResolvedValue({
        type: 'popup',
        payload: { description: 'Mastery property set to: Piercing.' },
      });
      render(<WeaponMasteryChoiceModal {...makeProps()} />);
      fireEvent.click(screen.getByText('Piercing'));
      fireEvent.click(screen.getByRole('button', { name: 'Select' }));
      await waitFor(() => {
        expect(automation.applyWeaponMasteryChoice).toHaveBeenCalledWith(
          'Piercing',
          baseProps.playerStats,
          baseProps.campaignName
        );
      });
    });

    it('calls onConfirm with the selected mastery after applyWeaponMasteryChoice', async () => {
      automation.applyWeaponMasteryChoice.mockResolvedValue({
        type: 'popup',
        payload: { description: 'Mastery property set to: Slashing.' },
      });
      const onConfirm = vi.fn();
      render(<WeaponMasteryChoiceModal {...makeProps({ onConfirm })} />);
      fireEvent.click(screen.getByText('Slashing'));
      fireEvent.click(screen.getByRole('button', { name: 'Select' }));
      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalledWith('Slashing');
      });
    });
  });

  // ── Result state ──

  describe('result state', () => {
    it('shows the result state with mastery name, Done button, and hides choice options after selection', async () => {
      automation.applyWeaponMasteryChoice.mockResolvedValue({
        type: 'popup',
        payload: { description: 'Mastery property set to: Heavy.' },
      });
      render(<WeaponMasteryChoiceModal {...makeProps()} />);
      fireEvent.click(screen.getByText('Heavy'));
      fireEvent.click(screen.getByRole('button', { name: 'Select' }));
      await waitFor(() => {
        expect(screen.getByText('Weapon Master')).toBeInTheDocument();
        expect(screen.getByText(/Heavy/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
        expect(screen.queryByText(/Choose a mastery property/)).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Select' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument();
      });
    });

    it('renders HTML content in the result body', async () => {
      automation.applyWeaponMasteryChoice.mockResolvedValue({
        type: 'popup',
        payload: { description: '<p>Mastery property set to: Piercing.</p>' },
      });
      render(<WeaponMasteryChoiceModal {...makeProps()} />);
      fireEvent.click(screen.getByText('Piercing'));
      fireEvent.click(screen.getByRole('button', { name: 'Select' }));
      await waitFor(() => {
        expect(screen.getByText('Mastery property set to: Piercing.')).toBeInTheDocument();
      });
    });
  });

  // ── Close behavior ──

  describe('close behavior', () => {
    it('calls onClose and onConfirm when Done is clicked after a selection', async () => {
      const onClose = vi.fn();
      const onConfirm = vi.fn();
      automation.applyWeaponMasteryChoice.mockResolvedValue({
        type: 'popup',
        payload: { description: 'Mastery property set to: Piercing.' },
      });
      render(<WeaponMasteryChoiceModal {...makeProps({ onClose, onConfirm })} />);
      fireEvent.click(screen.getByText('Piercing'));
      fireEvent.click(screen.getByRole('button', { name: 'Select' }));
      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      });
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onConfirm).toHaveBeenCalledWith('Piercing');
    });

    it('does not close when clicking inside the modal', () => {
      const onClose = vi.fn();
      render(<WeaponMasteryChoiceModal {...makeProps({ onClose })} />);
      fireEvent.click(screen.getByText('Piercing'));
      expect(onClose).not.toHaveBeenCalled();
    });

    it('does not call onClose when clicking the overlay background', () => {
      const onClose = vi.fn();
      render(<WeaponMasteryChoiceModal {...makeProps({ onClose })} />);
      fireEvent.click(document.querySelector('.sp-overlay'));
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
    });
  });
});
