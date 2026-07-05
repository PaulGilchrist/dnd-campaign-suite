// @cleaned-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import HealingIllusionModal from './HealingIllusionModal.jsx';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../services/automation/common/healingRoll.js', () => ({
  logHealingToSSE: vi.fn(),
}));

import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as healingRoll from '../../../../services/automation/common/healingRoll.js';

const mockPlayerStats = { name: 'Paladin1', level: 5, hitPoints: 40 };
const campaignName = 'test-campaign';
const mockOnClose = vi.fn();

function makeProps(overrides) {
  return {
    action: { name: 'Healing Illusion' },
    playerStats: mockPlayerStats,
    campaignName,
    onClose: mockOnClose,
    ...(overrides || {}),
  };
}

describe('HealingIllusionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRuntimeState.getRuntimeValue.mockReturnValue(null);
    useRuntimeState.setRuntimeValue.mockResolvedValue();
  });

  describe('initial render', () => {
    it('renders the overlay, modal, header, body, and action buttons with correct heal amount', () => {
      render(<HealingIllusionModal {...makeProps()} />);
      expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
      expect(document.querySelector('.sp-modal')).toBeInTheDocument();
      expect(document.querySelector('.sp-header')).toBeInTheDocument();
      expect(document.querySelector('.sp-body')).toBeInTheDocument();
      expect(document.querySelector('.sp-actions')).toBeInTheDocument();
      expect(screen.getByText('Healing Illusion')).toBeInTheDocument();
      expect(screen.getByText(/Choose a target within 5 feet to regain 5 HP/)).toBeInTheDocument();
    });

    it('shows the correct heal amount based on player level', () => {
      render(<HealingIllusionModal {...makeProps({ playerStats: { ...mockPlayerStats, level: 10 } })} />);
      expect(screen.getByText(/Choose a target within 5 feet to regain 10 HP/)).toBeInTheDocument();
    });

    it('defaults to 1 HP when level is falsy', () => {
      render(<HealingIllusionModal {...makeProps({ playerStats: { ...mockPlayerStats, level: 0 } })} />);
      expect(screen.getByText(/Choose a target within 5 feet to regain 1 HP/)).toBeInTheDocument();
    });

    it('renders self target radio selected by default and a disabled custom input', () => {
      render(<HealingIllusionModal {...makeProps()} />);
      const selfRadio = document.querySelector(`input[type="radio"][value="${mockPlayerStats.name}"]`);
      expect(selfRadio).toBeInTheDocument();
      expect(selfRadio.checked).toBe(true);
      expect(screen.getByText(/Paladin1 \(self\)/)).toBeInTheDocument();
      const customInput = document.querySelector('input[type="text"]');
      expect(customInput).toBeInTheDocument();
      expect(customInput.disabled).toBe(true);
      expect(customInput).toHaveAttribute('placeholder', 'creature name');
    });

    it('toggles target selection between self and custom', () => {
      render(<HealingIllusionModal {...makeProps()} />);
      const selfRadio = document.querySelector(`input[type="radio"][value="${mockPlayerStats.name}"]`);
      const customRadio = document.querySelector('input[type="radio"][value="custom"]');
      expect(selfRadio.checked).toBe(true);
      expect(customRadio.checked).toBe(false);

      fireEvent.click(customRadio);
      expect(selfRadio.checked).toBe(false);
      expect(customRadio.checked).toBe(true);

      fireEvent.click(selfRadio);
      expect(selfRadio.checked).toBe(true);
      expect(customRadio.checked).toBe(false);
    });

    it('enables the custom name input when custom target is selected and updates its value', () => {
      render(<HealingIllusionModal {...makeProps()} />);
      const customRadio = document.querySelector('input[type="radio"][value="custom"]');
      fireEvent.click(customRadio);
      const customInput = document.querySelector('input[type="text"]');
      expect(customInput.disabled).toBe(false);
      fireEvent.change(customInput, { target: { value: 'Orc Warrior' } });
      expect(customInput.value).toBe('Orc Warrior');
    });
  });

  describe('close behavior', () => {
    it('calls onClose when the overlay is clicked', () => {
      render(<HealingIllusionModal {...makeProps()} />);
      fireEvent.click(document.querySelector('.sp-overlay'));
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when clicking inside the modal', () => {
      render(<HealingIllusionModal {...makeProps()} />);
      fireEvent.click(document.querySelector('.sp-modal'));
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('healing action — self target', () => {
    it('heals the self target and applies the result state', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'currentHitPoints') return 20;
        return null;
      });

      render(<HealingIllusionModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /Heal/ }));

      await waitFor(() => {
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
          mockPlayerStats.name,
          'currentHitPoints',
          25,
          campaignName
        );
        expect(healingRoll.logHealingToSSE).toHaveBeenCalledWith(campaignName, {
          targetName: mockPlayerStats.name,
          sourceName: 'Healing Illusion',
          actualHeal: 5,
          newHp: 25,
          maxHp: 40,
        });
        expect(screen.getByText(/Healing Illusion restored 5 HP to Paladin1/)).toBeInTheDocument();
        expect(screen.getByText(/Cleric level 5/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Heal/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument();
      });
    });

    it('caps healing at max HP and shows the actual heal amount', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'currentHitPoints') return 38;
        return null;
      });

      render(<HealingIllusionModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /Heal/ }));

      await waitFor(() => {
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
          mockPlayerStats.name,
          'currentHitPoints',
          40,
          campaignName
        );
        expect(healingRoll.logHealingToSSE).toHaveBeenCalledWith(campaignName, {
          targetName: mockPlayerStats.name,
          sourceName: 'Healing Illusion',
          actualHeal: 2,
          newHp: 40,
          maxHp: 40,
        });
        expect(screen.getByText(/Healing Illusion restored 2 HP to Paladin1/)).toBeInTheDocument();
      });
    });

    it('uses playerStats.hitPoints as max HP for self-healing', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'currentHitPoints') return 20;
        return null;
      });

      render(<HealingIllusionModal {...makeProps({ playerStats: { ...mockPlayerStats, hitPoints: 50 } })} />);
      fireEvent.click(screen.getByRole('button', { name: /Heal/ }));

      await waitFor(() => {
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
          mockPlayerStats.name,
          'currentHitPoints',
          25,
          campaignName
        );
        expect(healingRoll.logHealingToSSE).toHaveBeenCalledWith(campaignName, {
          targetName: mockPlayerStats.name,
          sourceName: 'Healing Illusion',
          actualHeal: 5,
          newHp: 25,
          maxHp: 50,
        });
      });
    });

    it('disables the Heal button when already at max HP', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'currentHitPoints') return 40;
        return null;
      });

      render(<HealingIllusionModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /Heal/ }));

      await waitFor(() => {
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
          mockPlayerStats.name,
          'currentHitPoints',
          40,
          campaignName
        );
        expect(healingRoll.logHealingToSSE).toHaveBeenCalledWith(campaignName, {
          targetName: mockPlayerStats.name,
          sourceName: 'Healing Illusion',
          actualHeal: 0,
          newHp: 40,
          maxHp: 40,
        });
      });
    });

    it('closes the modal when Done is clicked or overlay is clicked in the applied state', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'currentHitPoints') return 20;
        return null;
      });

      render(<HealingIllusionModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /Heal/ }));

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      });
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('healing action — custom target', () => {
    it('heals a custom target and applies the result state', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'currentHitPoints') return 10;
        if (key === 'hitPoints') return 30;
        return null;
      });

      render(<HealingIllusionModal {...makeProps()} />);
      const customRadio = document.querySelector('input[type="radio"][value="custom"]');
      fireEvent.click(customRadio);
      const customInput = document.querySelector('input[type="text"]');
      fireEvent.change(customInput, { target: { value: 'Orc Warrior' } });
      fireEvent.click(screen.getByRole('button', { name: /Heal/ }));

      await waitFor(() => {
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
          'Orc Warrior',
          'currentHitPoints',
          15,
          campaignName
        );
        expect(healingRoll.logHealingToSSE).toHaveBeenCalledWith(campaignName, {
          targetName: 'Orc Warrior',
          sourceName: 'Healing Illusion',
          actualHeal: 5,
          newHp: 15,
          maxHp: 30,
        });
        expect(screen.getByText(/Healing Illusion restored 5 HP to Orc Warrior/)).toBeInTheDocument();
      });
    });

    it('caps custom target healing at max HP', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'currentHitPoints') return 28;
        if (key === 'hitPoints') return 30;
        return null;
      });

      render(<HealingIllusionModal {...makeProps()} />);
      const customRadio = document.querySelector('input[type="radio"][value="custom"]');
      fireEvent.click(customRadio);
      const customInput = document.querySelector('input[type="text"]');
      fireEvent.change(customInput, { target: { value: 'Orc Warrior' } });
      fireEvent.click(screen.getByRole('button', { name: /Heal/ }));

      await waitFor(() => {
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
          'Orc Warrior',
          'currentHitPoints',
          30,
          campaignName
        );
        expect(healingRoll.logHealingToSSE).toHaveBeenCalledWith(campaignName, {
          targetName: 'Orc Warrior',
          sourceName: 'Healing Illusion',
          actualHeal: 2,
          newHp: 30,
          maxHp: 30,
        });
      });
    });
  });

  describe('validation', () => {
    it('does not heal when custom name is empty or whitespace-only', async () => {
      render(<HealingIllusionModal {...makeProps()} />);
      const customRadio = document.querySelector('input[type="radio"][value="custom"]');
      fireEvent.click(customRadio);

      fireEvent.click(screen.getByRole('button', { name: /Heal/ }));
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(healingRoll.logHealingToSSE).not.toHaveBeenCalled();

      vi.clearAllMocks();
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      useRuntimeState.setRuntimeValue.mockResolvedValue();

      const customRadio2 = document.querySelector('input[type="radio"][value="custom"]');
      fireEvent.click(customRadio2);
      const customInput = document.querySelector('input[type="text"]');
      fireEvent.change(customInput, { target: { value: '   ' } });
      fireEvent.click(screen.getByRole('button', { name: /Heal/ }));

      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(healingRoll.logHealingToSSE).not.toHaveBeenCalled();
    });
  });
});
