// @cleaned-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AttackRiderModal from './AttackRiderModal.jsx';

// ── Mocked modules ──

vi.mock('../../../../services/automation/handlers/combat/attackRiderHandler.js', () => ({
  applyRiderOption: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../services/automation/handlers/class-fighter-rogue/versatileTricksterHandler.js', () => ({
  applyVersatileTrickster: vi.fn(),
}));

// ── Re-import mocked modules ──

import { applyRiderOption } from '../../../../services/automation/handlers/combat/attackRiderHandler.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

// ── Test fixtures ──

const defaultPlayerStats = { name: 'TestCharacter' };
const defaultCampaignName = 'test-campaign';
const defaultTargetName = 'Goblin A';

function makeProps(overrides) {
  return {
    action: makeSingleSelectAction(),
    playerStats: { ...defaultPlayerStats },
    campaignName: defaultCampaignName,
    targetName: defaultTargetName,
    onClose: vi.fn(),
    ...(overrides || {}),
  };
}

function makeSingleSelectAction(overrides) {
  return {
    name: 'Divine Smite',
    automation: {
      type: 'attack_rider',
      options: [
        { name: 'Burning Hands', effect: 'next_attack_advantage', value: 5 },
        { name: 'Push Back', effect: 'push_15ft' },
      ],
      maxEffects: 1,
      ...overrides,
    },
    ...overrides,
  };
}

const defaultResult = {
  type: 'popup',
  payload: {
    type: 'automation_info',
    name: 'Test Action',
    description: 'Effect applied successfully.',
  },
};

// ── Helpers ──

function selectSingleOption(labelText) {
  const optionLabel = screen.getByText(labelText).parentElement;
  fireEvent.click(optionLabel);
  return optionLabel;
}

function clickApplySingle() {
  return fireEvent.click(screen.getByRole('button', { name: /Apply Effect$/ }));
}

// ── Tests ──

describe('AttackRiderModal - Versatile Trickster', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('versatile trickster flow', () => {
    const mockSecondaryTargets = [
      { name: 'Orc A', size: 'Medium' },
      { name: 'Orc B', size: 'Medium' },
    ];

    beforeEach(() => {
      applyRiderOption.mockResolvedValue(defaultResult);
      getRuntimeValue.mockImplementation((charName, key) => {
        if (key === 'versatileTricksterSecondaryTargets') return mockSecondaryTargets;
        if (key === 'versatileTricksterAction') return { name: 'Trip' };
        return null;
      });
    });

    it('shows Versatile Trickster target selection after apply when secondary targets exist', async () => {
      const onClose = vi.fn();
      render(<AttackRiderModal {...makeProps({ onClose })} />);
      selectSingleOption('Burning Hands');
      clickApplySingle();

      await waitFor(() => {
        expect(screen.getByText('Versatile Trickster')).toBeInTheDocument();
        expect(screen.getByText('Orc A')).toBeInTheDocument();
        expect(screen.getByText('Orc B')).toBeInTheDocument();
      });
    });

    it('selects a Versatile Trickster target and enables the confirm button', async () => {
      render(<AttackRiderModal {...makeProps()} />);
      selectSingleOption('Burning Hands');
      clickApplySingle();

      await waitFor(() => {
        const labels = document.querySelectorAll('label.secondary-target-row');
        const orcLabel = Array.from(labels).find(l => l.textContent.includes('Orc A'));
        fireEvent.click(orcLabel);
      });

      await waitFor(() => {
        const tripBtn = screen.getByRole('button', { name: /Trip Secondary Target/ });
        expect(tripBtn).not.toBeDisabled();
      });
    });

    it('calls applyVersatileTrickster when Trip Secondary Target is clicked and closes on Done', async () => {
      const onClose = vi.fn();
      const { applyVersatileTrickster } = await import('../../../../services/automation/handlers/class-fighter-rogue/versatileTricksterHandler.js');
      applyVersatileTrickster.mockResolvedValue({
        type: 'popup',
        payload: { type: 'automation_info', name: 'Trip', description: 'Secondary target tripped.' },
      });

      render(<AttackRiderModal {...makeProps({ onClose })} />);
      selectSingleOption('Burning Hands');
      clickApplySingle();

      await waitFor(() => {
        const labels = document.querySelectorAll('label.secondary-target-row');
        const orcLabel = Array.from(labels).find(l => l.textContent.includes('Orc A'));
        fireEvent.click(orcLabel);
      });

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /Trip Secondary Target/ }));
      });

      await waitFor(() => {
        expect(applyVersatileTrickster).toHaveBeenCalled();
        expect(screen.getByText('Done')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Done'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('skips Versatile Trickster when Skip is clicked', async () => {
      const onClose = vi.fn();
      render(<AttackRiderModal {...makeProps({ onClose })} />);
      selectSingleOption('Burning Hands');
      clickApplySingle();

      await waitFor(() => {
        expect(screen.getByText('Skip')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Skip'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does NOT show Versatile Trickster when no secondary targets exist', async () => {
      getRuntimeValue.mockReturnValue(null);
      applyRiderOption.mockResolvedValue(defaultResult);

      render(<AttackRiderModal {...makeProps()} />);
      selectSingleOption('Burning Hands');
      clickApplySingle();

      await waitFor(() => {
        expect(screen.getByText('Effect applied successfully.')).toBeInTheDocument();
        expect(screen.queryByText('Versatile Trickster')).not.toBeInTheDocument();
      });
    });
  });
});
