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
    type: 'openHandTechnique',
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

    it('renders instruction text with target name', () => {
      renderModal();
      expect(screen.getByText('Goblin')).toBeInTheDocument();
      expect(screen.getByText(/Choose an effect against/)).toBeInTheDocument();
    });

    it('omits target reference when targetName is null', () => {
      renderModal({ targetName: null });
      expect(screen.getByText(/Choose an effect/)).toBeInTheDocument();
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

    it('renders a radio input for each option', () => {
      renderModal();
      expect(document.querySelectorAll('input[type="radio"]')).toHaveLength(3);
    });

    it('renders no options when automation config is missing or empty', () => {
      renderModal({ action: { name: 'Open Hand Technique', automation: { options: [] } } });
      expect(document.querySelectorAll('input[type="radio"]')).toHaveLength(0);

      renderModal({ action: { name: 'Open Hand Technique' } });
      expect(document.querySelectorAll('input[type="radio"]')).toHaveLength(0);
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
      const radios = document.querySelectorAll('input[type="radio"]');
      radios.forEach(radio => expect(radio.checked).toBe(false));
    });

    it('selects an option when its radio is clicked', () => {
      renderModal();
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[1]);
      expect(radios[1].checked).toBe(true);
    });
  });

  describe('apply button', () => {
    it('is disabled when no option is selected', () => {
      renderModal();
      expect(screen.getByRole('button', { name: /Apply Effect/ })).toBeDisabled();
    });

    it('is enabled after selecting an option', () => {
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
        expect(openHandHandler.applyOpenHandTechnique).toHaveBeenCalledWith(
          defaultAction,
          mockPlayerStats,
          mockCampaignName,
          'Goblin',
          optionName,
          13,
          'DEX'
        );
      });
    });

    it('calls onConfirm with selected option name when onConfirm is provided', async () => {
      const onConfirm = vi.fn();

      renderModal({ onConfirm });
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[1]);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Apply Effect/ }));
      });

      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalledWith('Disrupt Attack');
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

    it('renders the result description as HTML', async () => {
      openHandHandler.applyOpenHandTechnique.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Open Hand Technique',
          description: '<strong>Knock Down</strong> applied to Goblin.',
        },
      });

      renderModal();
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[0]);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Apply Effect/ }));
      });

      await waitFor(() => {
        const bodyDiv = document.querySelector('.sp-body');
        expect(bodyDiv.innerHTML).toContain('<strong>Knock Down</strong>');
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
    function renderWithApplied() {
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

      return act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Apply Effect/ }));
      });
    }

    it('shows a Done button and hides selection controls', async () => {
      await renderWithApplied();
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
