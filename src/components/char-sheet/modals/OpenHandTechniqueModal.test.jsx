// @improved-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import OpenHandTechniqueModal from './OpenHandTechniqueModal.jsx';

// ── Mocked modules ──

vi.mock('../../../services/automation/handlers/class-fighter-rogue/openHandTechniqueHandler.js', () => ({
  applyOpenHandTechnique: vi.fn(),
}));

// ── Re-import mocked modules ──

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
    it('renders the modal overlay, modal container, header, body, and actions', () => {
      renderModal();
      expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
      expect(document.querySelector('.sp-modal')).toBeInTheDocument();
      expect(document.querySelector('.sp-header')).toBeInTheDocument();
      expect(document.querySelector('.sp-body')).toBeInTheDocument();
      expect(document.querySelector('.sp-actions')).toBeInTheDocument();
    });

    it('renders the header with action name and hand-rock icon', () => {
      renderModal();
      expect(screen.getByText('Open Hand Technique')).toBeInTheDocument();
      expect(document.querySelector('.fa-solid.fa-hand-rock')).toBeInTheDocument();
    });

    it('renders instruction text with target name and save info', () => {
      renderModal();
      const bodyDiv = document.querySelector('.sp-body');
      expect(bodyDiv.textContent).toContain('Choose an effect against');
      expect(bodyDiv.textContent).toContain('Goblin');
      expect(bodyDiv.textContent).toMatch(/DEX saving throw \(DC 13\)/);
    });

    it('renders instruction text without target name when targetName is null', () => {
      renderModal({ targetName: null });
      expect(screen.getByText(/Choose an effect/)).toBeInTheDocument();
      expect(screen.queryByText(/against/)).not.toBeInTheDocument();
    });

    it('renders target name in bold in the instruction text', () => {
      renderModal();
      const boldEl = document.querySelector('.sp-body p b');
      expect(boldEl).toBeInTheDocument();
      expect(boldEl.textContent).toBe('Goblin');
    });

    it('does not render target name in bold when targetName is null', () => {
      renderModal({ targetName: null });
      expect(document.querySelector('.sp-body p b')).not.toBeInTheDocument();
    });
  });

  describe('options rendering', () => {
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

    it('renders no options when automation.options is empty', () => {
      renderModal({ action: { name: 'Open Hand Technique', automation: { options: [] } } });
      expect(document.querySelectorAll('input[type="radio"]')).toHaveLength(0);
    });

    it('renders no options when automation is undefined', () => {
      renderModal({ action: { name: 'Open Hand Technique' } });
      expect(document.querySelectorAll('input[type="radio"]')).toHaveLength(0);
    });

    it('renders no options when automation.options is undefined', () => {
      renderModal({ action: { name: 'Open Hand Technique', automation: {} } });
      expect(document.querySelectorAll('input[type="radio"]')).toHaveLength(0);
    });

    it('renders options with unknown effect types without effect descriptions', () => {
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

    it('deselects the previous option when a different one is selected', () => {
      renderModal();
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[0]);
      fireEvent.click(radios[2]);
      expect(radios[0].checked).toBe(false);
      expect(radios[2].checked).toBe(true);
    });

    it('applies selected style to the chosen option label', () => {
      renderModal();
      const labels = document.querySelectorAll('label');
      fireEvent.click(document.querySelectorAll('input[type="radio"]')[0]);
      expect(labels[0].style.background).toContain('rgba(255');
    });

    it('applies selected style to the chosen option border', () => {
      renderModal();
      const labels = document.querySelectorAll('label');
      fireEvent.click(document.querySelectorAll('input[type="radio"]')[0]);
      expect(labels[0].style.border).toContain('var(--color-link)');
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

    it('stays enabled after switching selection to a different option', () => {
      renderModal();
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[0]);
      fireEvent.click(radios[1]);
      expect(screen.getByRole('button', { name: /Apply Effect/ })).not.toBeDisabled();
    });

    it('renders with sp-roll-btn class', () => {
      renderModal();
      expect(screen.getByRole('button', { name: /Apply Effect/ }).classList.contains('sp-roll-btn')).toBe(true);
    });

    it('renders a hand-rock icon on the Apply button', () => {
      renderModal();
      expect(screen.getByRole('button', { name: /Apply Effect/ }).querySelector('.fa-solid.fa-hand-rock')).toBeInTheDocument();
    });
  });

  describe('cancel button', () => {
    it('is present in the initial render', () => {
      renderModal();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('has sp-dismiss-btn class', () => {
      renderModal();
      expect(screen.getByRole('button', { name: 'Cancel' }).classList.contains('sp-dismiss-btn')).toBe(true);
    });

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

    it('calls applyOpenHandTechnique with correct arguments when Apply is clicked with Knock Down selected', async () => {
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
        expect(openHandHandler.applyOpenHandTechnique).toHaveBeenCalledWith(
          defaultAction,
          mockPlayerStats,
          mockCampaignName,
          'Goblin',
          'Knock Down',
          13,
          'DEX'
        );
      });
    });

    it('calls applyOpenHandTechnique with Disrupt Attack when selected', async () => {
      openHandHandler.applyOpenHandTechnique.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Open Hand Technique',
          description: 'Disrupt Attack applied.',
        },
      });

      renderModal();
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[1]);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Apply Effect/ }));
      });

      await waitFor(() => {
        expect(openHandHandler.applyOpenHandTechnique).toHaveBeenCalledWith(
          defaultAction,
          mockPlayerStats,
          mockCampaignName,
          'Goblin',
          'Disrupt Attack',
          13,
          'DEX'
        );
      });
    });

    it('calls applyOpenHandTechnique with Seal Fates when selected', async () => {
      openHandHandler.applyOpenHandTechnique.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Open Hand Technique',
          description: 'Seal Fates applied.',
        },
      });

      renderModal();
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[2]);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Apply Effect/ }));
      });

      await waitFor(() => {
        expect(openHandHandler.applyOpenHandTechnique).toHaveBeenCalledWith(
          defaultAction,
          mockPlayerStats,
          mockCampaignName,
          'Goblin',
          'Seal Fates',
          13,
          'DEX'
        );
      });
    });

    it('renders result description after applying with a result', async () => {
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

    it('renders result payload description as HTML', async () => {
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

    it('hides selection options after applying', async () => {
      openHandHandler.applyOpenHandTechnique.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Open Hand Technique',
          description: 'Knock Down applied.',
        },
      });

      renderModal();
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[0]);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Apply Effect/ }));
      });

      await waitFor(() => {
        expect(screen.queryByText(/Choose an effect/)).not.toBeInTheDocument();
      });
    });

    it('hides the Apply Effect button after applying', async () => {
      openHandHandler.applyOpenHandTechnique.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Open Hand Technique',
          description: 'Knock Down applied.',
        },
      });

      renderModal();
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[0]);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Apply Effect/ }));
      });

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /Apply Effect/ })).not.toBeInTheDocument();
      });
    });

    it('hides the Cancel button after applying', async () => {
      openHandHandler.applyOpenHandTechnique.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Open Hand Technique',
          description: 'Knock Down applied.',
        },
      });

      renderModal();
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[0]);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Apply Effect/ }));
      });

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
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

    it('shows a Done button', async () => {
      await renderWithApplied();
      await waitFor(() => {
        expect(screen.getByText('Done')).toBeInTheDocument();
      });
    });

    it('renders the Done button with sp-roll-btn class', async () => {
      await renderWithApplied();
      await waitFor(() => {
        const doneBtn = screen.getByRole('button', { name: 'Done' });
        expect(doneBtn.classList.contains('sp-roll-btn')).toBe(true);
      });
    });

    it('renders the header with action name and hand-rock icon in applied state', async () => {
      await renderWithApplied();
      await waitFor(() => {
        expect(screen.getByText('Open Hand Technique')).toBeInTheDocument();
        expect(document.querySelector('.fa-solid.fa-hand-rock')).toBeInTheDocument();
      });
    });

    it('renders modal structure (overlay, modal, header, body, actions) in applied state', async () => {
      await renderWithApplied();
      await waitFor(() => {
        expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
        expect(document.querySelector('.sp-modal')).toBeInTheDocument();
        expect(document.querySelector('.sp-header')).toBeInTheDocument();
        expect(document.querySelector('.sp-body')).toBeInTheDocument();
        expect(document.querySelector('.sp-actions')).toBeInTheDocument();
      });
    });
  });

  describe('close behavior', () => {
    it('calls onClose when Done button is clicked in applied state', async () => {
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

    it('calls onClose when clicking the overlay background', () => {
      const onClose = vi.fn();
      renderModal({ onClose });
      fireEvent.click(document.querySelector('.sp-overlay'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when clicking inside the modal content', () => {
      const onClose = vi.fn();
      renderModal({ onClose });
      fireEvent.click(document.querySelector('.sp-modal'));
      expect(onClose).not.toHaveBeenCalled();
    });

    it('calls onClose when clicking the overlay in applied state', async () => {
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
        fireEvent.click(document.querySelector('.sp-overlay'));
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when clicking inside modal in applied state', async () => {
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
        fireEvent.click(document.querySelector('.sp-modal'));
      });
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
