// @cleaned-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import HypnoticPatternShakeModal from './HypnoticPatternShakeModal.jsx';

vi.mock('../../../../services/automation/index.js', () => ({
  executeHandler: vi.fn(),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

import { executeHandler } from '../../../../services/automation/index.js';
import { addEntry } from '../../../../services/ui/logService.js';

const baseProps = {
  attackerName: 'Wizard1',
  campaignName: 'test-campaign',
  targets: ['Orc Warrior', 'Goblin A', 'Goblin B'],
  rangeFeet: 60,
  featureName: 'Shake Out Stupor',
  onClose: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

beforeEach(() => {
  vi.resetAllMocks();
  executeHandler.mockClear();
  addEntry.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('HypnoticPatternShakeModal', () => {
  describe('initial render', () => {
    it('renders the modal with header, body text, target list, and action buttons', () => {
      render(<HypnoticPatternShakeModal {...makeProps()} />);
      expect(screen.getByText('Shake Out Stupor')).toBeInTheDocument();
      expect(screen.getByText(/within 60 feet/)).toBeInTheDocument();
      expect(screen.getByText(/Hypnotic Pattern/)).toBeInTheDocument();
      expect(screen.getByText(/Select a creature/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Shake Free/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('renders all targets as selectable options', () => {
      render(<HypnoticPatternShakeModal {...makeProps()} />);
      expect(screen.getByText('Orc Warrior')).toBeInTheDocument();
      expect(screen.getByText('Goblin A')).toBeInTheDocument();
      expect(screen.getByText('Goblin B')).toBeInTheDocument();
    });

    it('disables the Shake Free button when no target is selected', () => {
      render(<HypnoticPatternShakeModal {...makeProps()} />);
      expect(screen.getByRole('button', { name: 'Shake Free (none)' })).toBeDisabled();
    });

    it('shows a custom feature name when provided', () => {
      render(<HypnoticPatternShakeModal {...makeProps({ featureName: 'Custom Shake' })} />);
      expect(screen.getByText('Custom Shake')).toBeInTheDocument();
    });

    it('uses a default feature name when featureName is undefined', () => {
      render(<HypnoticPatternShakeModal {...makeProps({ featureName: undefined })} />);
      expect(screen.getByText('Shake Out Stupor')).toBeInTheDocument();
    });
  });

  describe('radio selection', () => {
    it('selects a target when its radio is clicked and enables the Shake Free button', () => {
      render(<HypnoticPatternShakeModal {...makeProps()} />);
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[1]);
      expect(radios[1].checked).toBe(true);
      expect(radios[0].checked).toBe(false);
      expect(screen.getByRole('button', { name: 'Shake Free (Goblin A)' })).toBeEnabled();
    });

    it('switches selection to a different target', () => {
      render(<HypnoticPatternShakeModal {...makeProps()} />);
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[0]);
      fireEvent.click(radios[2]);
      expect(radios[0].checked).toBe(false);
      expect(radios[2].checked).toBe(true);
    });

    it('applies the selected visual class to the chosen target row', () => {
      render(<HypnoticPatternShakeModal {...makeProps()} />);
      fireEvent.click(document.querySelectorAll('input[type="radio"]')[1]);
      const selectedRow = document.querySelector('.abjure-target-selected');
      expect(selectedRow).toBeInTheDocument();
      expect(selectedRow.textContent).toContain('Goblin A');
    });
  });

  describe('close behavior', () => {
    it('closes when the Cancel button is clicked', () => {
      const onClose = vi.fn();
      render(<HypnoticPatternShakeModal {...makeProps({ onClose })} />);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('shake action', () => {
    it('does not call executeHandler when shaking with no target selected', async () => {
      render(<HypnoticPatternShakeModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: 'Shake Free (none)' }));
      await waitFor(() => {
        expect(executeHandler).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
      });
    });

    it('calls executeHandler with correct params and closes on success', async () => {
      executeHandler.mockResolvedValue({ success: true });
      const onClose = vi.fn();
      render(<HypnoticPatternShakeModal {...makeProps({ onClose })} />);
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[0]);
      fireEvent.click(screen.getByRole('button', { name: 'Shake Free (Orc Warrior)' }));
      await waitFor(() => {
        expect(executeHandler).toHaveBeenCalledWith(
          {
            automation: { type: 'hypnotic_pattern_shake', range: '60 ft' },
            name: 'Shake Out Stupor',
          },
          { name: 'Wizard1' },
          'test-campaign',
          null
        );
        expect(onClose).toHaveBeenCalledTimes(1);
      });
    });

    it('calls addEntry with correct log data on success', async () => {
      executeHandler.mockResolvedValue({ success: true });
      render(<HypnoticPatternShakeModal {...makeProps()} />);
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[2]);
      fireEvent.click(screen.getByRole('button', { name: 'Shake Free (Goblin B)' }));
      await waitFor(() => {
        expect(addEntry).toHaveBeenCalledWith('test-campaign', {
          type: 'ability_use',
          characterName: 'Wizard1',
          abilityName: 'Shake Out Stupor',
          description: 'Wizard1 used an action to shake Goblin B out of its hypnotic stupor.',
          targetName: 'Goblin B',
          timestamp: expect.any(Number),
        });
      });
    });

    it('uses custom props (campaignName, attackerName, featureName, range) in executeHandler and log', async () => {
      executeHandler.mockResolvedValue({ success: true });
      render(<HypnoticPatternShakeModal {...makeProps({
        campaignName: 'my-campaign',
        attackerName: 'Sorcerer3',
        featureName: 'Custom Shake',
        rangeFeet: 45,
      })} />);
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[0]);
      fireEvent.click(screen.getByRole('button', { name: 'Shake Free (Orc Warrior)' }));
      await waitFor(() => {
        expect(executeHandler).toHaveBeenCalledWith(
          {
            automation: { type: 'hypnotic_pattern_shake', range: '45 ft' },
            name: 'Custom Shake',
          },
          { name: 'Sorcerer3' },
          'my-campaign',
          null
        );
        expect(addEntry).toHaveBeenCalledWith('my-campaign', expect.objectContaining({
          characterName: 'Sorcerer3',
          abilityName: 'Shake Out Stupor',
          targetName: 'Orc Warrior',
        }));
      });
    });

    it('includes the target name in the log description', async () => {
      executeHandler.mockResolvedValue({ success: true });
      render(<HypnoticPatternShakeModal {...makeProps()} />);
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[1]);
      fireEvent.click(screen.getByRole('button', { name: 'Shake Free (Goblin A)' }));
      await waitFor(() => {
        const logCall = addEntry.mock.calls[0][1];
        expect(logCall.description).toContain('Goblin A');
        expect(logCall.description).toContain('hypnotic stupor');
        expect(logCall.targetName).toBe('Goblin A');
      });
    });

    it('shows processing state during the async operation', async () => {
      let resolveHandler;
      executeHandler.mockReturnValue(new Promise(resolve => { resolveHandler = resolve; }));
      render(<HypnoticPatternShakeModal {...makeProps()} />);
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[0]);
      fireEvent.click(screen.getByRole('button', { name: 'Shake Free (Orc Warrior)' }));
      expect(screen.getByText('Shaking target free...')).toBeInTheDocument();
      expect(screen.queryByText(/Select a creature/)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Orc Warrior' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Shake Free/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
      await resolveHandler({});
    });

    it('does not call addEntry when executeHandler resolves to falsy', async () => {
      executeHandler.mockResolvedValue(null);
      render(<HypnoticPatternShakeModal {...makeProps()} />);
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[0]);
      fireEvent.click(screen.getByRole('button', { name: 'Shake Free (Orc Warrior)' }));
      await waitFor(() => {
        expect(addEntry).not.toHaveBeenCalled();
      });
    });
  });

  describe('edge cases - targets', () => {
    it('renders an empty target list when targets is empty', () => {
      render(<HypnoticPatternShakeModal {...makeProps({ targets: [] })} />);
      expect(document.querySelector('.abjure-targets-list')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Shake Free (none)' })).toBeDisabled();
    });

    it('renders a single target correctly', () => {
      render(<HypnoticPatternShakeModal {...makeProps({ targets: ['Orc Warrior'] })} />);
      expect(screen.getByText('Orc Warrior')).toBeInTheDocument();
      expect(document.querySelectorAll('input[type="radio"]')).toHaveLength(1);
    });

    it('renders with a long target name containing spaces and numbers', () => {
      render(<HypnoticPatternShakeModal {...makeProps({ targets: ['Dragon #1 Ancient Red'] })} />);
      expect(screen.getByText('Dragon #1 Ancient Red')).toBeInTheDocument();
      fireEvent.click(document.querySelectorAll('input[type="radio"]')[0]);
      expect(screen.getByRole('button', { name: 'Shake Free (Dragon #1 Ancient Red)' })).toBeInTheDocument();
    });
  });
});
