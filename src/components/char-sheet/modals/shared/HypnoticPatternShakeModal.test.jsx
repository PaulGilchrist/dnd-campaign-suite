// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import HypnoticPatternShakeModal from './HypnoticPatternShakeModal.jsx';

vi.mock('../../../../services/automation/index.js', () => ({
  executeHandler: vi.fn(),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../services/ui/consoleLogger.js', () => ({}));

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
      expect(screen.getByText('Orc Warrior')).toBeInTheDocument();
      expect(screen.getByText('Goblin A')).toBeInTheDocument();
      expect(screen.getByText('Goblin B')).toBeInTheDocument();
    });

    it('renders no targets and disables Shake Free when targets array is empty', () => {
      render(<HypnoticPatternShakeModal {...makeProps({ targets: [] })} />);
      expect(screen.getByText(/Select a creature/)).toBeInTheDocument();
      expect(screen.queryAllByRole('radio')).toHaveLength(0);
      expect(screen.getByRole('button', { name: 'Shake Free (none)' })).toBeDisabled();
    });

    it('disables the Shake Free button when no target is selected', () => {
      render(<HypnoticPatternShakeModal {...makeProps()} />);
      expect(screen.getByRole('button', { name: 'Shake Free (none)' })).toBeDisabled();
    });

    it('renders the feature name header, using custom name when provided or default otherwise', () => {
      render(<HypnoticPatternShakeModal {...makeProps({ featureName: 'Custom Shake' })} />);
      expect(screen.getByText('Custom Shake')).toBeInTheDocument();

      render(<HypnoticPatternShakeModal {...makeProps({ featureName: undefined })} />);
      expect(screen.getByText('Shake Out Stupor')).toBeInTheDocument();
    });
  });

  describe('radio selection', () => {
    it('selects a target when its radio is clicked and enables the Shake Free button with target name', () => {
      render(<HypnoticPatternShakeModal {...makeProps()} />);
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[1]);
      expect(radios[1].checked).toBe(true);
      expect(radios[0].checked).toBe(false);
      expect(screen.getByRole('button', { name: 'Shake Free (Goblin A)' })).toBeEnabled();
    });

    it('switches selection to a different target and updates button label', () => {
      render(<HypnoticPatternShakeModal {...makeProps()} />);
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[0]);
      expect(radios[0].checked).toBe(true);
      expect(screen.getByRole('button', { name: 'Shake Free (Orc Warrior)' })).toBeEnabled();
      fireEvent.click(radios[2]);
      expect(radios[2].checked).toBe(true);
      expect(radios[0].checked).toBe(false);
      expect(screen.getByRole('button', { name: 'Shake Free (Goblin B)' })).toBeEnabled();
    });
  });

  describe('close behavior', () => {
    it('closes when the Cancel button is clicked', () => {
      const onClose = vi.fn();
      render(<HypnoticPatternShakeModal {...makeProps({ onClose })} />);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when the overlay background is clicked', () => {
      const onClose = vi.fn();
      const { container } = render(<HypnoticPatternShakeModal {...makeProps({ onClose })} />);
      const overlay = container.querySelector('.sp-overlay');
      fireEvent.click(overlay);
      expect(onClose).not.toHaveBeenCalled();
      expect(container.querySelector('.sp-modal')).toBeInTheDocument();
    });

    it('does not close when the modal inner content is clicked', () => {
      const onClose = vi.fn();
      const { container } = render(<HypnoticPatternShakeModal {...makeProps({ onClose })} />);
      const modal = container.querySelector('.sp-modal');
      fireEvent.click(modal);
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('shake action', () => {
    it('does not call executeHandler or addEntry when shaking with no target selected', async () => {
      render(<HypnoticPatternShakeModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: 'Shake Free (none)' }));
      await waitFor(() => {
        expect(executeHandler).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
      });
    });

    it('calls executeHandler with correct params, logs the ability use, and closes on success', async () => {
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
        expect(addEntry).toHaveBeenCalledWith('test-campaign', {
          type: 'ability_use',
          characterName: 'Wizard1',
          abilityName: 'Shake Out Stupor',
          description: 'Wizard1 used an action to shake Orc Warrior out of its hypnotic stupor.',
          targetName: 'Orc Warrior',
          timestamp: expect.any(Number),
        });
        expect(onClose).toHaveBeenCalledTimes(1);
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
      const onClose = vi.fn();
      render(<HypnoticPatternShakeModal {...makeProps({ onClose })} />);
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[0]);
      fireEvent.click(screen.getByRole('button', { name: 'Shake Free (Orc Warrior)' }));
      await waitFor(() => {
        expect(addEntry).not.toHaveBeenCalled();
      });
    });
  });
});
