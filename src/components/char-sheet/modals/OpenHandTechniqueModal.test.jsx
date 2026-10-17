// @maintained-by-ai
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

function singleOptionAction(effect) {
  return {
    name: 'Open Hand Technique',
    automation: { options: [{ name: 'Test Option', effect }] },
  };
}

// Select an option by its label and click Apply.
async function applyOption(optionName) {
  fireEvent.click(screen.getByRole('radio', { name: new RegExp(optionName) }));
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Apply Effect/ }));
  });
}

// ── Tests ──

describe('OpenHandTechniqueModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders header, target instruction, all options, and a disabled Apply until selected', () => {
    renderModal();
    expect(screen.getByText('Open Hand Technique')).toBeInTheDocument();
    expect(screen.getByText(/Choose an effect against/)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Knock Down/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Disrupt Attack/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Seal Fates/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Apply Effect/ })).toBeDisabled();

    fireEvent.click(screen.getByRole('radio', { name: /Knock Down/ }));
    expect(screen.getByRole('button', { name: /Apply Effect/ })).toBeEnabled();
  });

  it('omits the target reference when targetName is null', () => {
    renderModal({ targetName: null });
    expect(screen.getByText('Choose an effect.')).toBeInTheDocument();
    expect(screen.queryByText(/against/i)).not.toBeInTheDocument();
  });

  it.each([
    ['missing automation', { name: 'Open Hand Technique' }],
    ['empty options array', { name: 'Open Hand Technique', automation: { options: [] } }],
  ])('renders no options and a disabled Apply with %s', (_label, action) => {
    renderModal({ action });
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.getByRole('button', { name: /Apply Effect/ })).toBeDisabled();
  });

  it.each([
    ['push_15ft', /Push 15 ft away/],
    ['prone', /Gain Prone condition/],
    ['addled', /Cannot make Opportunity Attacks/],
    ['disadvantage_next_attack', /Disadvantage on next attack roll/],
    ['no_reactions', /Can't take Reactions until start of your next turn/],
    ['unknown_type', null],
  ])('maps effect "%s" to its description (null = none)', async (effect, expectedText) => {
    renderModal({ action: singleOptionAction(effect) });
    expect(screen.getAllByRole('radio')).toHaveLength(1);
    expect(screen.getByText('Test Option')).toBeInTheDocument();
    if (expectedText) {
      expect(screen.getByText(expectedText)).toBeInTheDocument();
    } else {
      expect(screen.queryByText(/—/)).not.toBeInTheDocument();
    }
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('applies the selected option, shows the result, and closes via Done', async () => {
    const onClose = vi.fn();
    openHandHandler.applyOpenHandTechnique.mockResolvedValue({
      payload: { description: 'Goblin failed the save. Disrupt Attack applied.' },
    });

    renderModal({ onClose });
    await applyOption('Disrupt Attack');

    expect(openHandHandler.applyOpenHandTechnique).toHaveBeenCalledWith({
      action: defaultAction,
      playerStats: mockPlayerStats,
      campaignName: mockCampaignName,
      targetName: 'Goblin',
      selectedOptionName: 'Disrupt Attack',
      saveDc: 13,
    });

    await waitFor(() => {
      expect(screen.getByText(/Goblin failed the save/)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Apply Effect/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Choose an effect/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('stays in selection mode when the handler returns null', async () => {
    openHandHandler.applyOpenHandTechnique.mockResolvedValue(null);

    renderModal();
    await applyOption('Knock Down');

    expect(openHandHandler.applyOpenHandTechnique).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Done')).not.toBeInTheDocument();
    expect(screen.getByText(/Choose an effect/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Apply Effect/ })).toBeEnabled();
  });

  it('routes to onConfirm with the selected option and skips the handler', async () => {
    const onConfirm = vi.fn();
    renderModal({ onConfirm });

    await applyOption('Seal Fates');

    expect(onConfirm).toHaveBeenCalledWith('Seal Fates');
    expect(openHandHandler.applyOpenHandTechnique).not.toHaveBeenCalled();
  });
});
