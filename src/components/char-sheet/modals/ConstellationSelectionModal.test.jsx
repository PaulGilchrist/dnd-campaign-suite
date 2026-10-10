// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ConstellationSelectionModal from './ConstellationSelectionModal.jsx';

vi.mock('../../../services/automation/handlers/class-sorcerer/starryFormHandler.js', () => ({
  applyConstellationOption: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
}));

import * as starryFormHandler from '../../../services/automation/handlers/class-sorcerer/starryFormHandler.js';
import * as useRuntimeState from '../../../hooks/runtime/useRuntimeState.js';

const baseProps = {
  action: { name: 'Starry Form', automation: { type: 'constellation_selection' } },
  playerStats: { name: 'Sorcerer1', level: 5 },
  campaignName: 'test-campaign',
  isTwinkled: false,
  onConfirm: vi.fn(),
  onClose: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

const defaultResult = {
  type: 'popup',
  payload: {
    type: 'automation_info',
    name: 'Starry Form',
    automationType: 'constellation_selection',
    description: 'Archer constellation chosen. Ranged Spell Attack: 1d8 + Wisdom Modifier Radiant damage.',
    automation: { type: 'constellation_selection' },
  },
};

describe('ConstellationSelectionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    starryFormHandler.applyConstellationOption.mockResolvedValue(defaultResult);
    useRuntimeState.getRuntimeValue.mockReturnValue([]);
  });

  describe('initial render', () => {
    it('renders the modal with all constellation options and action buttons', () => {
      render(<ConstellationSelectionModal {...makeProps()} />);
      expect(screen.getByText('Starry Form')).toBeInTheDocument();
      expect(screen.getByText('Choose a constellation:')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Archer/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Chalice/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Dragon/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Choose' })).toBeDisabled();
    });

  });

  describe('constellation option descriptions', () => {
    it('shows correct descriptions for all constellation options', () => {
      render(<ConstellationSelectionModal {...makeProps({ isTwinkled: false })} />);
      expect(screen.getByText(/Ranged Spell Attack: 1d8 \+ Wisdom Modifier Radiant damage/)).toBeInTheDocument();
      expect(screen.getByText(/Healing Spell: 1d8 \+ Wisdom Modifier HP to ally within 30 feet/)).toBeInTheDocument();
      expect(screen.getByText(/Concentration: Treat d20 rolls of 9 or lower as 10/)).toBeInTheDocument();
    });

    it('shows enhanced descriptions when twinkled', () => {
      render(<ConstellationSelectionModal {...makeProps({ isTwinkled: true })} />);
      expect(screen.getByText(/Ranged Spell Attack: 2d8/)).toBeInTheDocument();
      expect(screen.getByText(/Healing Spell: 2d8/)).toBeInTheDocument();
      expect(screen.getByText(/Fly Speed 20 feet \(hover\)/)).toBeInTheDocument();
    });
  });

  describe('selection behavior', () => {
    it.each(['Archer', 'Chalice', 'Dragon'])('selects %s when clicked', () => {
      render(<ConstellationSelectionModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /^Archer/ }));
      expect(screen.getByRole('button', { name: 'Choose' })).toBeEnabled();
    });
  });

  describe('choosing a constellation', () => {
    it.each(['Archer', 'Chalice', 'Dragon'])('calls applyConstellationOption and onConfirm with %s', async (constellation) => {
      render(<ConstellationSelectionModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: new RegExp(constellation) }));
      fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
      await vi.waitFor(() => {
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
      });
      expect(starryFormHandler.applyConstellationOption).toHaveBeenCalledWith(
        baseProps.action,
        baseProps.playerStats,
        baseProps.campaignName,
        constellation
      );
      expect(starryFormHandler.applyConstellationOption).toHaveBeenCalledTimes(1);
      expect(baseProps.onConfirm).toHaveBeenCalledWith(constellation);
    });

    it('does not call applyConstellationOption when no constellation is selected', async () => {
      render(<ConstellationSelectionModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
      expect(starryFormHandler.applyConstellationOption).not.toHaveBeenCalled();
      expect(baseProps.onConfirm).not.toHaveBeenCalled();
    });

    it('calls onClose when Cancel button is clicked', () => {
      const onClose = vi.fn();
      render(<ConstellationSelectionModal {...makeProps({ onClose })} />);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    // CLA-368: CharActions lane wires the modal with autoApply={false} — the
    // parent lane owns the single application, so the modal must not apply.
    it('does not apply when autoApply is false, only confirms once', async () => {
      const applyOption = vi.fn();
      const onConfirm = vi.fn();
      render(<ConstellationSelectionModal {...makeProps({ autoApply: false, applyOption, onConfirm })} />);
      fireEvent.click(screen.getByRole('button', { name: /Dragon/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
      await vi.waitFor(() => {
        expect(onConfirm).toHaveBeenCalledWith('Dragon');
      });
      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(applyOption).not.toHaveBeenCalled();
      expect(starryFormHandler.applyConstellationOption).not.toHaveBeenCalled();
    });
  });

  describe('result state', () => {
    it('replaces constellation options with result description, Done button, and hides Cancel/Choose buttons', async () => {
      render(<ConstellationSelectionModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /Archer/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
      await vi.waitFor(() => {
        expect(screen.queryByText('Choose a constellation:')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Choose' })).not.toBeInTheDocument();
        expect(screen.getByText('Starry Form')).toBeInTheDocument();
        expect(screen.getByText(/Archer constellation chosen/)).toBeInTheDocument();
      });
    });

    it('calls onClose when Done button is clicked', async () => {
      const onClose = vi.fn();
      render(<ConstellationSelectionModal {...makeProps({ onClose })} />);
      fireEvent.click(screen.getByRole('button', { name: /Archer/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
      await vi.waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('displays custom action name in result header', async () => {
      render(<ConstellationSelectionModal {...makeProps({ action: { name: 'My Custom Starry Form', automation: { type: 'constellation_selection' } } })} />);
      fireEvent.click(screen.getByRole('button', { name: /Archer/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
      await vi.waitFor(() => {
        expect(screen.getByText('My Custom Starry Form')).toBeInTheDocument();
      });
    });
  });

  describe('runtime state restoration', () => {
    it('restores selected constellation from activeBuffs on mount', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue([
        { name: 'Starry Form', constellation: 'Chalice' },
      ]);
      render(<ConstellationSelectionModal {...makeProps()} />);
      expect(screen.getByRole('button', { name: 'Choose' })).toBeEnabled();
    });

    it('does not restore selection when activeBuffs is empty', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue([]);
      render(<ConstellationSelectionModal {...makeProps()} />);
      expect(screen.getByRole('button', { name: 'Choose' })).toBeDisabled();
    });

    it('does not restore selection when activeBuffs is not an array', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      render(<ConstellationSelectionModal {...makeProps()} />);
      expect(screen.getByRole('button', { name: 'Choose' })).toBeDisabled();
    });
  });
});
