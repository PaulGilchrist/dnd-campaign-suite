import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import OpenHandTechniqueModal from './OpenHandTechniqueModal.jsx';

// ── Mocked modules (before the component import) ──

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

// ── Tests ──

describe('OpenHandTechniqueModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  // ── Initial render ──

  it('renders the modal overlay', () => {
    render(<OpenHandTechniqueModal {...makeProps()} />);
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
  });

  it('renders the modal structure (overlay, modal, header, body, actions)', () => {
    render(<OpenHandTechniqueModal {...makeProps()} />);
    expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    expect(document.querySelector('.sp-header')).toBeInTheDocument();
    expect(document.querySelector('.sp-body')).toBeInTheDocument();
    expect(document.querySelector('.sp-actions')).toBeInTheDocument();
  });

  it('renders the header with action name and hand-rock icon', () => {
    render(<OpenHandTechniqueModal {...makeProps()} />);
    expect(screen.getByText('Open Hand Technique')).toBeInTheDocument();
    const icon = document.querySelector('.fa-solid.fa-hand-rock');
    expect(icon).toBeInTheDocument();
  });

  it('renders instruction text with target name', () => {
    render(<OpenHandTechniqueModal {...makeProps()} />);
    const bodyDiv = document.querySelector('.sp-body');
    expect(bodyDiv.textContent).toContain('Choose an effect against');
    expect(bodyDiv.textContent).toContain('Goblin');
    expect(bodyDiv.textContent).toMatch(/DEX saving throw \(DC 13\)/);
  });

  it('renders instruction text without target name when targetName is null', () => {
    render(<OpenHandTechniqueModal {...makeProps({ targetName: null })} />);
    expect(screen.getByText(/Choose an effect/)).toBeInTheDocument();
    expect(screen.queryByText(/against/)).not.toBeInTheDocument();
  });

  // ── Options rendering ──

  it('renders all options from action.automation.options', () => {
    render(<OpenHandTechniqueModal {...makeProps()} />);
    expect(screen.getByText('Knock Down')).toBeInTheDocument();
    expect(screen.getByText('Disrupt Attack')).toBeInTheDocument();
    expect(screen.getByText('Seal Fates')).toBeInTheDocument();
  });

  it('renders radio inputs for each option', () => {
    render(<OpenHandTechniqueModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    expect(radios).toHaveLength(3);
  });

  it('shows effect description for push_15ft option', () => {
    render(<OpenHandTechniqueModal {...makeProps()} />);
    expect(screen.getByText(/Push 15 ft away/)).toBeInTheDocument();
  });

  it('shows effect description for disadvantage_next_attack option', () => {
    render(<OpenHandTechniqueModal {...makeProps()} />);
    expect(screen.getByText(/Disadvantage on next attack roll/)).toBeInTheDocument();
  });

  it('shows effect description for no_reactions option', () => {
    render(<OpenHandTechniqueModal {...makeProps()} />);
    expect(screen.getByText(/Can't take Reactions until start of your next turn/)).toBeInTheDocument();
  });

  // ── Selection behavior ──

  it('has no option selected initially', () => {
    render(<OpenHandTechniqueModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    radios.forEach(radio => expect(radio.checked).toBe(false));
  });

  it('selects an option when its radio is clicked', () => {
    render(<OpenHandTechniqueModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[1]); // Disrupt Attack
    expect(radios[1].checked).toBe(true);
  });

  it('deselects previous option when a different one is selected', () => {
    render(<OpenHandTechniqueModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[0]); // Knock Down
    fireEvent.click(radios[2]); // Seal Fates
    expect(radios[0].checked).toBe(false);
    expect(radios[2].checked).toBe(true);
  });

  it('applies selected style (background) to the chosen option label', () => {
    render(<OpenHandTechniqueModal {...makeProps()} />);
    const labels = document.querySelectorAll('label');
    expect(labels[0].style.background).not.toContain('rgba(255,255,255,0.15)');
    fireEvent.click(document.querySelectorAll('input[type="radio"]')[0]);
    expect(labels[0].style.background).toContain('rgba(255');
  });

  // ── Apply button ──

  it('disables the Apply Effect button when no option is selected', () => {
    render(<OpenHandTechniqueModal {...makeProps()} />);
    const btn = screen.getByRole('button', { name: /Apply Effect/ });
    expect(btn).toBeDisabled();
  });

  it('enables the Apply Effect button after selecting an option', () => {
    render(<OpenHandTechniqueModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[0]);
    const btn = screen.getByRole('button', { name: /Apply Effect/ });
    expect(btn).not.toBeDisabled();
  });

  it('does not call applyOpenHandTechnique when Apply is clicked without selection', async () => {
    render(<OpenHandTechniqueModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Apply Effect/ }));
    expect(openHandHandler.applyOpenHandTechnique).not.toHaveBeenCalled();
  });

  it('calls applyOpenHandTechnique with correct arguments when Apply is clicked with selection', async () => {
    openHandHandler.applyOpenHandTechnique.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Open Hand Technique',
        description: 'Goblin failed the save. Knock Down applied.',
      },
    });

    render(<OpenHandTechniqueModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[0]); // Knock Down
    fireEvent.click(screen.getByRole('button', { name: /Apply Effect/ }));

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

  // ── Applied / result state ──

  it('shows result description after applying with a result', async () => {
    openHandHandler.applyOpenHandTechnique.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Open Hand Technique',
        description: 'Goblin failed the save. Knock Down applied.',
      },
    });

    render(<OpenHandTechniqueModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[0]);
    fireEvent.click(screen.getByRole('button', { name: /Apply Effect/ }));

    await waitFor(() => {
      expect(screen.getByText(/Goblin failed the save/)).toBeInTheDocument();
    });
  });

  it('renders Done button in the applied state', async () => {
    openHandHandler.applyOpenHandTechnique.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Open Hand Technique',
        description: 'Done.',
      },
    });

    render(<OpenHandTechniqueModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[0]);
    fireEvent.click(screen.getByRole('button', { name: /Apply Effect/ }));

    await waitFor(() => {
      expect(screen.getByText('Done')).toBeInTheDocument();
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

    render(<OpenHandTechniqueModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[0]);
    fireEvent.click(screen.getByRole('button', { name: /Apply Effect/ }));

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

    render(<OpenHandTechniqueModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[0]);
    fireEvent.click(screen.getByRole('button', { name: /Apply Effect/ }));

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

    render(<OpenHandTechniqueModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[0]);
    fireEvent.click(screen.getByRole('button', { name: /Apply Effect/ }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
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

    render(<OpenHandTechniqueModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[0]);
    fireEvent.click(screen.getByRole('button', { name: /Apply Effect/ }));

    await waitFor(() => {
      const bodyDiv = document.querySelector('.sp-body');
      expect(bodyDiv.innerHTML).toContain('<strong>Knock Down</strong>');
    });
  });

  // ── Applied state with no result ──

  it('does not show applied state when result is null', async () => {
    openHandHandler.applyOpenHandTechnique.mockResolvedValue(null);

    render(<OpenHandTechniqueModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[0]);
    fireEvent.click(screen.getByRole('button', { name: /Apply Effect/ }));

    await waitFor(() => {
      expect(screen.queryByText('Done')).not.toBeInTheDocument();
    });
  });

  // ── Close behavior ──

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

    render(<OpenHandTechniqueModal {...makeProps({ onClose })} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[0]);
    fireEvent.click(screen.getByRole('button', { name: /Apply Effect/ }));

    await waitFor(() => {
      expect(screen.getByText('Done')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Done'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Cancel button is clicked', () => {
    const onClose = vi.fn();
    render(<OpenHandTechniqueModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking the overlay background', () => {
    const onClose = vi.fn();
    render(<OpenHandTechniqueModal {...makeProps({ onClose })} />);
    const overlay = document.querySelector('.sp-overlay');
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does NOT close when clicking inside the modal content', () => {
    const onClose = vi.fn();
    render(<OpenHandTechniqueModal {...makeProps({ onClose })} />);
    const modal = document.querySelector('.sp-modal');
    fireEvent.click(modal);
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Applied state overlay click ──

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

    render(<OpenHandTechniqueModal {...makeProps({ onClose })} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[0]);
    fireEvent.click(screen.getByRole('button', { name: /Apply Effect/ }));

    await waitFor(() => {
      expect(screen.getByText('Done')).toBeInTheDocument();
    });

    const overlay = document.querySelector('.sp-overlay');
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does NOT close when clicking inside modal in applied state', async () => {
    const onClose = vi.fn();
    openHandHandler.applyOpenHandTechnique.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Open Hand Technique',
        description: 'Done.',
      },
    });

    render(<OpenHandTechniqueModal {...makeProps({ onClose })} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[0]);
    fireEvent.click(screen.getByRole('button', { name: /Apply Effect/ }));

    await waitFor(() => {
      expect(screen.getByText('Done')).toBeInTheDocument();
    });

    const modal = document.querySelector('.sp-modal');
    fireEvent.click(modal);
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Empty options edge case ──

  it('renders with no options when automation.options is empty', () => {
    render(<OpenHandTechniqueModal {...makeProps({
      action: { name: 'Open Hand Technique', automation: { options: [] } }
    })} />);
    expect(screen.getByText('Open Hand Technique')).toBeInTheDocument();
    const radios = document.querySelectorAll('input[type="radio"]');
    expect(radios).toHaveLength(0);
  });

  it('disables apply button when options array is empty', () => {
    render(<OpenHandTechniqueModal {...makeProps({
      action: { name: 'Open Hand Technique', automation: { options: [] } }
    })} />);
    const btn = screen.getByRole('button', { name: /Apply Effect/ });
    expect(btn).toBeDisabled();
  });

  it('renders with no options when automation is missing', () => {
    render(<OpenHandTechniqueModal {...makeProps({
      action: { name: 'Open Hand Technique' }
    })} />);
    expect(screen.getByText('Open Hand Technique')).toBeInTheDocument();
    const radios = document.querySelectorAll('input[type="radio"]');
    expect(radios).toHaveLength(0);
  });

  // ── Label text with targetName using bold HTML ──

  it('renders target name in bold in the instruction text', () => {
    render(<OpenHandTechniqueModal {...makeProps()} />);
    const boldEl = document.querySelector('.sp-body p b');
    expect(boldEl).toBeInTheDocument();
    expect(boldEl.textContent).toBe('Goblin');
  });

  // ── Button classes ──

  it('renders Apply Effect button with sp-roll-btn class', () => {
    render(<OpenHandTechniqueModal {...makeProps()} />);
    const btn = screen.getByRole('button', { name: /Apply Effect/ });
    expect(btn.classList.contains('sp-roll-btn')).toBe(true);
  });

  it('renders Cancel button with sp-dismiss-btn class', () => {
    render(<OpenHandTechniqueModal {...makeProps()} />);
    const btn = screen.getByRole('button', { name: 'Cancel' });
    expect(btn.classList.contains('sp-dismiss-btn')).toBe(true);
  });

  it('renders hand-rock icon on Apply Effect button', () => {
    render(<OpenHandTechniqueModal {...makeProps()} />);
    const btn = screen.getByRole('button', { name: /Apply Effect/ });
    expect(btn.querySelector('.fa-solid.fa-hand-rock')).toBeInTheDocument();
  });

  it('renders Done button with sp-roll-btn class in applied state', async () => {
    openHandHandler.applyOpenHandTechnique.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Open Hand Technique',
        description: 'Done.',
      },
    });

    render(<OpenHandTechniqueModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[0]);
    fireEvent.click(screen.getByRole('button', { name: /Apply Effect/ }));

    await waitFor(() => {
      const doneBtn = screen.getByRole('button', { name: 'Done' });
      expect(doneBtn.classList.contains('sp-roll-btn')).toBe(true);
    });
  });

  // ── Selecting different options ──

  it('selects Disrupt Attack option', () => {
    render(<OpenHandTechniqueModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[1]); // Disrupt Attack
    expect(radios[1].checked).toBe(true);
  });

  it('selects Seal Fates option', () => {
    render(<OpenHandTechniqueModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[2]); // Seal Fates
    expect(radios[2].checked).toBe(true);
  });

  // ── Selecting an option and then calling apply ──

  it('calls applyOpenHandTechnique with Disrupt Attack selection', async () => {
    openHandHandler.applyOpenHandTechnique.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Open Hand Technique',
        description: 'Disrupt Attack applied.',
      },
    });

    render(<OpenHandTechniqueModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[1]); // Disrupt Attack
    fireEvent.click(screen.getByRole('button', { name: /Apply Effect/ }));

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

  it('calls applyOpenHandTechnique with Seal Fates selection', async () => {
    openHandHandler.applyOpenHandTechnique.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Open Hand Technique',
        description: 'Seal Fates applied.',
      },
    });

    render(<OpenHandTechniqueModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[2]); // Seal Fates
    fireEvent.click(screen.getByRole('button', { name: /Apply Effect/ }));

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

  // ── Modal structure classes ──

  it('renders sp-overlay, sp-modal, sp-header, sp-body, sp-actions structure', () => {
    render(<OpenHandTechniqueModal {...makeProps()} />);
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
    expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    expect(document.querySelector('.sp-header')).toBeInTheDocument();
    expect(document.querySelector('.sp-body')).toBeInTheDocument();
    expect(document.querySelector('.sp-actions')).toBeInTheDocument();
  });
});
