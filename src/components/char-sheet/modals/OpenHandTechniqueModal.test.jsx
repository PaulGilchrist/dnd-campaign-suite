// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import OpenHandTechniqueModal from './OpenHandTechniqueModal.jsx';

// ── Mocked modules ──

vi.mock('../../../services/automation/handlers/class-fighter-rogue/openHandTechniqueHandler.js', () => ({
  applyOpenHandTechnique: vi.fn(),
}));

import * as openHandHandler from '../../../services/automation/handlers/class-fighter-rogue/openHandTechniqueHandler.js';

// ── Test fixtures ──

const mockPlayerStats = { name: 'Monk1', level: 5 };
const mockCampaignName = 'test-campaign';

const defaultAction = {
  name: 'Open Hand Technique',
  automation: {
    options: [
      { name: 'Knock Down', effect: 'push_15ft', value: 15 },
      { name: 'Disrupt Attack', effect: 'disadvantage_next_attack' },
      { name: 'Seal Fates', effect: 'no_reactions' },
    ],
    saveType: 'DEX',
  },
};

function makeProps(overrides) {
  return {
    action: defaultAction,
    playerStats: mockPlayerStats,
    campaignName: mockCampaignName,
    onClose: vi.fn(),
    targetName: 'Goblin',
    saveDc: 13,
    saveType: 'DEX',
    ...(overrides || {}),
  };
}

function renderModal(props) {
  return render(<OpenHandTechniqueModal {...makeProps(props)} />);
}

// ── Tests ──

describe('OpenHandTechniqueModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('initial render', () => {
    it('renders the modal with header, instruction text, and action buttons', () => {
      renderModal();
      expect(screen.getByText('Open Hand Technique')).toBeInTheDocument();
      expect(screen.getByText(/Choose an effect against/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Apply Effect/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('omits target reference when targetName is null', () => {
      renderModal({ targetName: null });
      expect(screen.getByText('Choose an effect.')).toBeInTheDocument();
      expect(screen.queryByText(/against/)).not.toBeInTheDocument();
    });

    it('renders all options with names and effect descriptions', () => {
      renderModal();
      expect(screen.getByText('Knock Down')).toBeInTheDocument();
      expect(screen.getByText(/Push 15 ft away/)).toBeInTheDocument();
      expect(screen.getByText('Disrupt Attack')).toBeInTheDocument();
      expect(screen.getByText(/Disadvantage on next attack roll/)).toBeInTheDocument();
      expect(screen.getByText('Seal Fates')).toBeInTheDocument();
      expect(screen.getByText(/Can't take Reactions until start of your next turn/)).toBeInTheDocument();
    });

    it.each([
      [{ action: { name: 'Open Hand Technique' } }, 'disabled apply button'],
      [{ action: { name: 'Open Hand Technique', automation: { options: [] } } }, 'no options rendered'],
    ])('renders %s when automation config is missing or options array is empty', (overrides) => {
      renderModal(overrides);
      expect(document.querySelectorAll('input[type="radio"]')).toHaveLength(0);
      if (overrides.action.automation === undefined || !overrides.action.automation.options) {
        expect(screen.getByRole('button', { name: /Apply Effect/ })).toBeDisabled();
      }
    });

    it('renders unknown effect types without effect descriptions', () => {
      renderModal({
        action: {
          name: 'Open Hand Technique',
          automation: { options: [{ name: 'Unknown Effect', effect: 'unknown_type' }] },
        },
      });
      expect(screen.getByText('Unknown Effect')).toBeInTheDocument();
      expect(document.querySelectorAll('input[type="radio"]')).toHaveLength(1);
    });
  });

  describe('selection behavior', () => {
    it('has no option selected initially', () => {
      renderModal();
      expect(screen.getByRole('button', { name: /Apply Effect/ })).toBeDisabled();
    });

    it('enables the apply button after selecting an option', () => {
      renderModal();
      fireEvent.click(document.querySelectorAll('input[type="radio"]')[0]);
      expect(screen.getByRole('button', { name: /Apply Effect/ })).not.toBeDisabled();
    });
  });

  describe('cancel button', () => {
    it('calls onClose when clicked', () => {
      const onClose = vi.fn();
      renderModal({ onClose });
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('apply action', () => {
    it('does not call applyOpenHandTechnique when Apply is clicked without selection', async () => {
      renderModal();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Apply Effect/ }));
      });
      expect(openHandHandler.applyOpenHandTechnique).not.toHaveBeenCalled();
    });

    it.each([
      ['Knock Down', 0],
      ['Disrupt Attack', 1],
      ['Seal Fates', 2],
    ])('calls applyOpenHandTechnique with %s when selected', async (optionName, radioIndex) => {
      openHandHandler.applyOpenHandTechnique.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Open Hand Technique',
          description: `${optionName} applied.`,
        },
      });

      renderModal();
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[radioIndex]);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Apply Effect/ }));
      });

      await waitFor(() => {
        expect(openHandHandler.applyOpenHandTechnique).toHaveBeenCalledWith({
          action: defaultAction,
          playerStats: mockPlayerStats,
          campaignName: mockCampaignName,
          targetName: 'Goblin',
          selectedOptionName: optionName,
          saveDc: 13,
        });
      });
    });

    it('calls onConfirm with selected option name and does not call the handler when onConfirm is provided', async () => {
      const onConfirm = vi.fn();

      renderModal({ onConfirm });
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[1]);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Apply Effect/ }));
      });

      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalledWith('Disrupt Attack');
        expect(openHandHandler.applyOpenHandTechnique).not.toHaveBeenCalled();
      });
    });

    it('renders the result description after applying', async () => {
      openHandHandler.applyOpenHandTechnique.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Open Hand Technique',
          description: 'Goblin failed the save. Knock Down applied.',
        },
      });

      renderModal();
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[0]);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Apply Effect/ }));
      });

      await waitFor(() => {
        expect(screen.getByText(/Goblin failed the save/)).toBeInTheDocument();
      });
    });

    it('does not show applied state when result is null', async () => {
      openHandHandler.applyOpenHandTechnique.mockResolvedValue(null);

      renderModal();
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[0]);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Apply Effect/ }));
      });

      await waitFor(() => {
        expect(screen.queryByText('Done')).not.toBeInTheDocument();
      });
    });
  });

  describe('applied state', () => {
    it('shows a Done button and hides selection controls', async () => {
      openHandHandler.applyOpenHandTechnique.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Open Hand Technique',
          description: 'Done.',
        },
      });

      renderModal();
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[0]);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Apply Effect/ }));
      });

      await waitFor(() => {
        expect(screen.getByText('Done')).toBeInTheDocument();
        expect(screen.queryByText(/Choose an effect/)).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Apply Effect/ })).not.toBeInTheDocument();
      });
    });

    it('calls onClose when Done button is clicked', async () => {
      const onClose = vi.fn();
      openHandHandler.applyOpenHandTechnique.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Open Hand Technique',
          description: 'Done.',
        },
      });

      renderModal({ onClose });
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[0]);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Apply Effect/ }));
      });

      await waitFor(() => {
        fireEvent.click(screen.getByText('Done'));
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
