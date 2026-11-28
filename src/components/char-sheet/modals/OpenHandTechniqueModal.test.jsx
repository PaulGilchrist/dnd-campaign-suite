// @maintained-by-ai 2026-11-27
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import OpenHandTechniqueModal from './OpenHandTechniqueModal.jsx';

// ── Mocked modules ──
// ONLY the rider-math handler is mocked (its own lane owns save prompts,
// condition writes and logging). ChooserModalFooter and
// useOverlayEntranceFocus render REAL — their behavior is owned by
// shared/ChooserModalFooter.labels.test.jsx and
// hooks/ui/useOverlayEntranceFocus.test.jsx respectively (cite-don't-restate).

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

// Exact singular label — the regex /Apply Effect/ would also bless the
// plural canon face 'Apply Effects' (Devious Strikes). This modal owes the
// singular byte from CHOOSER_FOOTER_LABELS.applyEffect.
const APPLY_BUTTON = { name: 'Apply Effect' };

// Select an option by its label and click Apply.
async function applyOption(optionName) {
  fireEvent.click(screen.getByRole('radio', { name: new RegExp(optionName) }));
  await act(async () => {
    fireEvent.click(screen.getByRole('button', APPLY_BUTTON));
  });
}

// ── Tests ──

describe('OpenHandTechniqueModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders header, target instruction, all options, and gates Apply on selection', () => {
    renderModal();
    expect(screen.getByText('Open Hand Technique')).toBeInTheDocument();
    expect(screen.getByText(/Choose an effect against/)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Knock Down/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Disrupt Attack/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Seal Fates/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', APPLY_BUTTON)).toBeDisabled();

    fireEvent.click(screen.getByRole('radio', { name: /Knock Down/ }));
    // Selection invariant (checked stays on the chosen option, nothing else).
    expect(screen.getByRole('radio', { name: /Knock Down/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Disrupt Attack/ })).not.toBeChecked();
    expect(screen.getByRole('button', APPLY_BUTTON)).toBeEnabled();
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
    expect(screen.getByRole('button', APPLY_BUTTON)).toBeDisabled();
  });

  it('renders options from the action.options fallback when automation has none', () => {
    // Component reads `action.automation?.options || action.options || []`.
    renderModal({
      action: {
        name: 'Open Hand Technique',
        options: [{ name: 'Fallback Option', effect: 'prone' }],
      },
    });
    expect(screen.getByRole('radio', { name: /Fallback Option/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: /Fallback Option/ }));
    expect(screen.getByRole('button', APPLY_BUTTON)).toBeEnabled();
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
      // The mapped copy is part of the radio's accessible name too.
      expect(screen.getByRole('radio', { name: expectedText })).toBeInTheDocument();
    } else {
      expect(screen.queryByText(/—/)).not.toBeInTheDocument();
    }
  });

  it('closes via Cancel with a zero-action witness (no handler dispatch)', () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(openHandHandler.applyOpenHandTechnique).not.toHaveBeenCalled();
  });

  it('applies the selected option, shows the result, and closes via Done', async () => {
    const onClose = vi.fn();
    const result = { payload: { description: 'Goblin failed the save. Disrupt Attack applied.' } };
    openHandHandler.applyOpenHandTechnique.mockResolvedValue(result);

    renderModal({ onClose });
    await applyOption('Disrupt Attack');

    // Full-shape payload + reference identity on the object args — the modal
    // forwards the exact props it was given, mutated by nothing.
    const arg = openHandHandler.applyOpenHandTechnique.mock.calls[0][0];
    expect(arg).toEqual({
      action: defaultAction,
      playerStats: mockPlayerStats,
      campaignName: mockCampaignName,
      targetName: 'Goblin',
      selectedOptionName: 'Disrupt Attack',
      saveDc: 13,
    });
    expect(arg.action).toBe(defaultAction);
    expect(arg.playerStats).toBe(mockPlayerStats);
    expect(openHandHandler.applyOpenHandTechnique).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(screen.getByText(/Goblin failed the save/)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    expect(screen.queryByRole('button', APPLY_BUTTON)).not.toBeInTheDocument();
    expect(screen.queryByText(/Choose an effect/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    // Done must not re-dispatch the handler (double-commit detector).
    expect(openHandHandler.applyOpenHandTechnique).toHaveBeenCalledTimes(1);
  });

  it('logs a loud error, stays in selection mode, and re-applies a fresh choice when the handler returns null', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    openHandHandler.applyOpenHandTechnique.mockResolvedValue(null);

    renderModal();
    await applyOption('Knock Down');

    expect(openHandHandler.applyOpenHandTechnique).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Knock Down'));
    expect(screen.queryByText('Done')).not.toBeInTheDocument();
    expect(screen.getByText(/Choose an effect/)).toBeInTheDocument();
    expect(screen.getByRole('button', APPLY_BUTTON)).toBeEnabled();

    // Contract breach is recoverable: the error branch latches nothing — a
    // re-selection flows through with the NEW option (no stale selection).
    await applyOption('Seal Fates');
    expect(openHandHandler.applyOpenHandTechnique).toHaveBeenCalledTimes(2);
    expect(openHandHandler.applyOpenHandTechnique.mock.calls[1][0].selectedOptionName).toBe('Seal Fates');
    expect(screen.queryByText('Done')).not.toBeInTheDocument();
    errorSpy.mockRestore();
  });

  it('routes to onConfirm with the selected option and skips the handler', async () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    renderModal({ onConfirm, onClose });

    await applyOption('Seal Fates');

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith('Seal Fates');
    expect(openHandHandler.applyOpenHandTechnique).not.toHaveBeenCalled();
    // The confirm-routing branch must not also close the modal.
    expect(onClose).not.toHaveBeenCalled();
  });
});
