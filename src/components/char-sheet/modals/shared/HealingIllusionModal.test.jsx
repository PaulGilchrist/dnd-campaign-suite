// @improved-by-ai
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
    it('renders the overlay, modal container, header, body, and action buttons', () => {
      render(<HealingIllusionModal {...makeProps()} />);
      expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
      expect(document.querySelector('.sp-modal')).toBeInTheDocument();
      expect(document.querySelector('.sp-header')).toBeInTheDocument();
      expect(document.querySelector('.sp-body')).toBeInTheDocument();
      expect(document.querySelector('.sp-actions')).toBeInTheDocument();
    });

    it('displays the header title and heart icon', () => {
      render(<HealingIllusionModal {...makeProps()} />);
      expect(screen.getByText('Healing Illusion')).toBeInTheDocument();
      expect(document.querySelector('.fa-solid.fa-heart')).toBeInTheDocument();
    });

    it('shows instruction text with the correct heal amount based on player level', () => {
      render(<HealingIllusionModal {...makeProps()} />);
      expect(screen.getByText(/Choose a target within 5 feet to regain 5 HP/)).toBeInTheDocument();
    });

    it('uses player level as the heal amount', () => {
      render(<HealingIllusionModal {...makeProps({ playerStats: { ...mockPlayerStats, level: 10 } })} />);
      expect(screen.getByText(/Choose a target within 5 feet to regain 10 HP/)).toBeInTheDocument();
    });

    it('defaults to 1 HP heal amount when level is falsy', () => {
      render(<HealingIllusionModal {...makeProps({ playerStats: { ...mockPlayerStats, level: 0 } })} />);
      expect(screen.getByText(/Choose a target within 5 feet to regain 1 HP/)).toBeInTheDocument();
    });

    it('defaults to 1 HP heal amount when level is undefined', () => {
      render(<HealingIllusionModal {...makeProps({ playerStats: { name: 'Test' } })} />);
      expect(screen.getByText(/Choose a target within 5 feet to regain 1 HP/)).toBeInTheDocument();
    });

    it('renders self target radio option with player name and self label', () => {
      render(<HealingIllusionModal {...makeProps()} />);
      expect(document.querySelector(`input[type="radio"][value="${mockPlayerStats.name}"]`)).toBeInTheDocument();
      expect(screen.getByText(/Paladin1 \(self\)/)).toBeInTheDocument();
    });

    it('selects self target by default', () => {
      render(<HealingIllusionModal {...makeProps()} />);
      const selfRadio = document.querySelector(`input[type="radio"][value="${mockPlayerStats.name}"]`);
      expect(selfRadio.checked).toBe(true);
    });

    it('renders custom target radio option and disabled text input', () => {
      render(<HealingIllusionModal {...makeProps()} />);
      const customRadio = document.querySelector('input[type="radio"][value="custom"]');
      expect(customRadio).toBeInTheDocument();
      expect(customRadio.checked).toBe(false);
      const customInput = document.querySelector('input[type="text"]');
      expect(customInput).toBeInTheDocument();
      expect(customInput).toHaveAttribute('placeholder', 'creature name');
      expect(customInput.disabled).toBe(true);
    });
  });

  describe('target selection', () => {
    it('enables the custom name input when custom target is selected', () => {
      render(<HealingIllusionModal {...makeProps()} />);
      const customRadio = document.querySelector('input[type="radio"][value="custom"]');
      fireEvent.click(customRadio);
      const customInput = document.querySelector('input[type="text"]');
      expect(customInput.disabled).toBe(false);
    });

    it('updates the custom name input value on text change', () => {
      render(<HealingIllusionModal {...makeProps()} />);
      const customInput = document.querySelector('input[type="text"]');
      fireEvent.change(customInput, { target: { value: 'Orc Warrior' } });
      expect(customInput.value).toBe('Orc Warrior');
    });

    it('switches from self to custom target selection', () => {
      render(<HealingIllusionModal {...makeProps()} />);
      const selfRadio = document.querySelector(`input[type="radio"][value="${mockPlayerStats.name}"]`);
      const customRadio = document.querySelector('input[type="radio"][value="custom"]');
      expect(selfRadio.checked).toBe(true);
      expect(customRadio.checked).toBe(false);

      fireEvent.click(customRadio);
      expect(selfRadio.checked).toBe(false);
      expect(customRadio.checked).toBe(true);
    });

    it('switches from custom back to self target selection', () => {
      render(<HealingIllusionModal {...makeProps()} />);
      const selfRadio = document.querySelector(`input[type="radio"][value="${mockPlayerStats.name}"]`);
      const customRadio = document.querySelector('input[type="radio"][value="custom"]');

      fireEvent.click(customRadio);
      expect(customRadio.checked).toBe(true);

      fireEvent.click(selfRadio);
      expect(selfRadio.checked).toBe(true);
      expect(customRadio.checked).toBe(false);
    });
  });

  describe('close behavior', () => {
    it('calls onClose when Skip button is clicked', () => {
      render(<HealingIllusionModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when clicking the overlay background', () => {
      render(<HealingIllusionModal {...makeProps()} />);
      const overlay = document.querySelector('.sp-overlay');
      fireEvent.click(overlay);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose when clicking inside the modal content', () => {
      render(<HealingIllusionModal {...makeProps()} />);
      const modal = document.querySelector('.sp-modal');
      fireEvent.click(modal);
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('healing action', () => {
    it('sets the target current HP to current + heal amount for self', async () => {
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
      });
    });

    it('caps the target current HP to max HP when healing would exceed it', async () => {
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
      });
    });

    it('logs healing to SSE with correct self-target details', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'currentHitPoints') return 20;
        return null;
      });

      render(<HealingIllusionModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /Heal/ }));

      await waitFor(() => {
        expect(healingRoll.logHealingToSSE).toHaveBeenCalledWith(campaignName, {
          targetName: mockPlayerStats.name,
          sourceName: 'Healing Illusion',
          actualHeal: 5,
          newHp: 25,
          maxHp: 40,
        });
      });
    });

    it('dispatches a combat-summary-updated event after healing', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'currentHitPoints') return 20;
        return null;
      });

      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

      render(<HealingIllusionModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /Heal/ }));

      await waitFor(() => {
        expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'combat-summary-updated' }));
      });
      dispatchSpy.mockRestore();
    });

    it('sets the applied state and result message after healing self', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'currentHitPoints') return 20;
        return null;
      });

      render(<HealingIllusionModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /Heal/ }));

      await waitFor(() => {
        expect(screen.getByText(/Healing Illusion restored 5 HP to Paladin1/)).toBeInTheDocument();
        expect(screen.getByText(/Cleric level 5/)).toBeInTheDocument();
      });
    });

    it('shows the actual heal amount in the result when capped', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'currentHitPoints') return 38;
        return null;
      });

      render(<HealingIllusionModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /Heal/ }));

      await waitFor(() => {
        expect(screen.getByText(/Healing Illusion restored 2 HP to Paladin1/)).toBeInTheDocument();
      });
    });

    it('hides selection options and action buttons after healing', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'currentHitPoints') return 20;
        return null;
      });

      render(<HealingIllusionModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /Heal/ }));

      await waitFor(() => {
        expect(screen.queryByText(/Choose a target within 5 feet/)).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Heal/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument();
      });
    });

    it('renders a Done button in the applied state', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'currentHitPoints') return 20;
        return null;
      });

      render(<HealingIllusionModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /Heal/ }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
      });
    });

    it('calls onClose when Done button is clicked', async () => {
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

    it('calls onClose when clicking the overlay in the applied state', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'currentHitPoints') return 20;
        return null;
      });

      render(<HealingIllusionModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /Heal/ }));

      await waitFor(() => {
        const overlay = document.querySelector('.sp-overlay');
        fireEvent.click(overlay);
      });
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('does not close the modal when clicking inside it in the applied state', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'currentHitPoints') return 20;
        return null;
      });

      render(<HealingIllusionModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /Heal/ }));

      await waitFor(() => {
        const modal = document.querySelector('.sp-modal');
        fireEvent.click(modal);
      });
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('renders the heart icon in the result state header', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'currentHitPoints') return 20;
        return null;
      });

      render(<HealingIllusionModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /Heal/ }));

      await waitFor(() => {
        expect(document.querySelector('.sp-header .fa-solid.fa-heart')).toBeInTheDocument();
      });
    });
  });

  describe('healing action — custom target', () => {
    it('sets the custom target current HP to current + heal amount', async () => {
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
      });
    });

    it('caps the custom target current HP to max HP', async () => {
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
      });
    });

    it('logs healing to SSE with correct custom-target details', async () => {
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
        expect(healingRoll.logHealingToSSE).toHaveBeenCalledWith(campaignName, {
          targetName: 'Orc Warrior',
          sourceName: 'Healing Illusion',
          actualHeal: 5,
          newHp: 15,
          maxHp: 30,
        });
      });
    });

    it('shows the result message for a custom target', async () => {
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
        expect(screen.getByText(/Healing Illusion restored 5 HP to Orc Warrior/)).toBeInTheDocument();
      });
    });
  });

  describe('validation — empty custom name', () => {
    it('does not heal, set state, or log when custom name is empty', async () => {
      render(<HealingIllusionModal {...makeProps()} />);
      const customRadio = document.querySelector('input[type="radio"][value="custom"]');
      fireEvent.click(customRadio);
      fireEvent.click(screen.getByRole('button', { name: /Heal/ }));

      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(healingRoll.logHealingToSSE).not.toHaveBeenCalled();
    });

    it('does not heal when custom name is whitespace only', async () => {
      render(<HealingIllusionModal {...makeProps()} />);
      const customRadio = document.querySelector('input[type="radio"][value="custom"]');
      fireEvent.click(customRadio);
      const customInput = document.querySelector('input[type="text"]');
      fireEvent.change(customInput, { target: { value: '   ' } });
      fireEvent.click(screen.getByRole('button', { name: /Heal/ }));

      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(healingRoll.logHealingToSSE).not.toHaveBeenCalled();
    });
  });

  describe('edge cases — runtime values', () => {
    it('defaults currentHitPoints to 0 when getRuntimeValue returns null', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(null);

      render(<HealingIllusionModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /Heal/ }));

      await waitFor(() => {
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
          mockPlayerStats.name,
          'currentHitPoints',
          5,
          campaignName
        );
      });
    });

    it('defaults currentHitPoints to 0 when getRuntimeValue returns a non-numeric string', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue('not-a-number');

      render(<HealingIllusionModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /Heal/ }));

      await waitFor(() => {
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
          mockPlayerStats.name,
          'currentHitPoints',
          5,
          campaignName
        );
      });
    });

    it('defaults custom target hitPoints to 0 when missing from runtime', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'currentHitPoints') return 10;
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
          0,
          campaignName
        );
      });
    });

    it('defaults custom target hitPoints to 0 when it is non-numeric', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'currentHitPoints') return 10;
        return 'bad';
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
          0,
          campaignName
        );
      });
    });

    it('heals to max with actualHeal of 0 when already at max HP', async () => {
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
  });
});
