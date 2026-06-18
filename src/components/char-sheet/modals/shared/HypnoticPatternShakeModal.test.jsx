// @improved-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
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

afterEach(() => {
  vi.clearAllMocks();
});

describe('HypnoticPatternShakeModal', () => {
  describe('initial render', () => {
    it('renders the modal overlay with header, body, and actions sections', () => {
      render(<HypnoticPatternShakeModal {...makeProps()} />);
      expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
      expect(document.querySelector('.sp-modal')).toBeInTheDocument();
      expect(document.querySelector('.sp-header')).toBeInTheDocument();
      expect(document.querySelector('.sp-body')).toBeInTheDocument();
      expect(document.querySelector('.sp-actions')).toBeInTheDocument();
    });

    it('renders the feature name and brain icon in the header', () => {
      render(<HypnoticPatternShakeModal {...makeProps()} />);
      expect(screen.getByText('Shake Out Stupor')).toBeInTheDocument();
      expect(document.querySelector('.fa-solid.fa-brain')).toBeInTheDocument();
    });

    it('displays the target selection prompt with range', () => {
      render(<HypnoticPatternShakeModal {...makeProps()} />);
      expect(screen.getByText(/within 60 feet/)).toBeInTheDocument();
      expect(screen.getByText(/Hypnotic Pattern/)).toBeInTheDocument();
    });

    it('renders all targets as selectable radio options', () => {
      render(<HypnoticPatternShakeModal {...makeProps()} />);
      expect(screen.getByText('Orc Warrior')).toBeInTheDocument();
      expect(screen.getByText('Goblin A')).toBeInTheDocument();
      expect(screen.getByText('Goblin B')).toBeInTheDocument();
    });

    it('renders the Shake Free and Cancel buttons', () => {
      render(<HypnoticPatternShakeModal {...makeProps()} />);
      expect(screen.getByRole('button', { name: /Shake Free/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('renders a hand icon on the Shake Free button', () => {
      render(<HypnoticPatternShakeModal {...makeProps()} />);
      const shakeBtn = document.querySelector('.sp-roll-btn');
      expect(shakeBtn.querySelector('.fa-solid.fa-hand')).toBeInTheDocument();
    });
  });

  describe('default feature name', () => {
    it('shows "Shake Out Stupor" when featureName is undefined', () => {
      render(<HypnoticPatternShakeModal {...makeProps({ featureName: undefined })} />);
      expect(screen.getByText('Shake Out Stupor')).toBeInTheDocument();
    });

    it('shows "Shake Out Stupor" when featureName is omitted entirely', () => {
      const props = { ...baseProps };
      delete props.featureName;
      render(<HypnoticPatternShakeModal {...props} />);
      expect(screen.getByText('Shake Out Stupor')).toBeInTheDocument();
    });

    it('uses a custom feature name when provided', () => {
      render(<HypnoticPatternShakeModal {...makeProps({ featureName: 'Custom Shake' })} />);
      expect(screen.getByText('Custom Shake')).toBeInTheDocument();
    });
  });

  describe('radio selection', () => {
    it('has no target selected on initial render', () => {
      render(<HypnoticPatternShakeModal {...makeProps()} />);
      const radios = document.querySelectorAll('input[type="radio"]');
      radios.forEach(radio => expect(radio.checked).toBe(false));
    });

    it('renders radio inputs with the correct name attribute', () => {
      render(<HypnoticPatternShakeModal {...makeProps()} />);
      const radios = document.querySelectorAll('input[type="radio"]');
      expect(radios.length).toBe(3);
      radios.forEach(radio => expect(radio.name).toBe('hypnoticShakeTarget'));
    });

    it('selects a target when its radio is clicked', () => {
      render(<HypnoticPatternShakeModal {...makeProps()} />);
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[1]);
      expect(radios[1].checked).toBe(true);
      expect(radios[0].checked).toBe(false);
      expect(radios[2].checked).toBe(false);
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

    it('removes the selected class from the previous target', () => {
      render(<HypnoticPatternShakeModal {...makeProps()} />);
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[0]);
      fireEvent.click(radios[2]);
      const selectedRows = document.querySelectorAll('.abjure-target-selected');
      expect(selectedRows.length).toBe(1);
      expect(selectedRows[0].textContent).toContain('Goblin B');
    });
  });

  describe('button state', () => {
    it('disables the Shake Free button when no target is selected', () => {
      render(<HypnoticPatternShakeModal {...makeProps()} />);
      expect(screen.getByRole('button', { name: 'Shake Free (none)' })).toBeDisabled();
    });

    it('enables the Shake Free button after a target is selected', () => {
      render(<HypnoticPatternShakeModal {...makeProps()} />);
      fireEvent.click(document.querySelectorAll('input[type="radio"]')[0]);
      expect(screen.getByRole('button', { name: 'Shake Free (Orc Warrior)' })).toBeEnabled();
    });

    it('updates the Shake Free button text to show the selected target', () => {
      render(<HypnoticPatternShakeModal {...makeProps()} />);
      fireEvent.click(document.querySelectorAll('input[type="radio"]')[1]);
      expect(screen.getByRole('button', { name: 'Shake Free (Goblin A)' })).toBeInTheDocument();
    });
  });

  describe('close behavior', () => {
    it('closes when the Cancel button is clicked', () => {
      const onClose = vi.fn();
      render(<HypnoticPatternShakeModal {...makeProps({ onClose })} />);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('closes when clicking the overlay background', () => {
      const onClose = vi.fn();
      render(<HypnoticPatternShakeModal {...makeProps({ onClose })} />);
      fireEvent.click(document.querySelector('.sp-overlay'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when clicking inside the modal', () => {
      const onClose = vi.fn();
      render(<HypnoticPatternShakeModal {...makeProps({ onClose })} />);
      fireEvent.click(document.querySelector('.sp-modal'));
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('shake action - no selection', () => {
    it('does not call executeHandler, addEntry, or onClose when shaking with no target', async () => {
      render(<HypnoticPatternShakeModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: 'Shake Free (none)' }));
      await waitFor(() => {
        expect(executeHandler).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
      });
    });
  });

  describe('shake action - successful', () => {
    beforeEach(() => {
      executeHandler.mockResolvedValue({ success: true });
    });

    it('calls executeHandler with the correct action and campaign', async () => {
      render(<HypnoticPatternShakeModal {...makeProps()} />);
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
      });
    });

    it('calls addEntry with the correct log data', async () => {
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

    it('closes the modal after successful shake', async () => {
      const onClose = vi.fn();
      render(<HypnoticPatternShakeModal {...makeProps({ onClose })} />);
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[0]);
      fireEvent.click(screen.getByRole('button', { name: 'Shake Free (Orc Warrior)' }));
      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
      });
    });

    it('passes custom campaignName to both executeHandler and addEntry', async () => {
      render(<HypnoticPatternShakeModal {...makeProps({ campaignName: 'my-campaign' })} />);
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[0]);
      fireEvent.click(screen.getByRole('button', { name: 'Shake Free (Orc Warrior)' }));
      await waitFor(() => {
        expect(executeHandler).toHaveBeenCalledWith(
          expect.any(Object),
          expect.any(Object),
          'my-campaign',
          null
        );
        expect(addEntry).toHaveBeenCalledWith('my-campaign', expect.any(Object));
      });
    });

    it('uses attackerName in both executeHandler and log entry', async () => {
      render(<HypnoticPatternShakeModal {...makeProps({ attackerName: 'Sorcerer3' })} />);
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[0]);
      fireEvent.click(screen.getByRole('button', { name: 'Shake Free (Orc Warrior)' }));
      await waitFor(() => {
        expect(executeHandler).toHaveBeenCalledWith(
          expect.any(Object),
          { name: 'Sorcerer3' },
          expect.any(String),
          null
        );
        const logCall = addEntry.mock.calls[0][1];
        expect(logCall.characterName).toBe('Sorcerer3');
      });
    });

    it('uses the custom feature name in executeHandler', async () => {
      render(<HypnoticPatternShakeModal {...makeProps({ featureName: 'Custom Shake' })} />);
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[0]);
      fireEvent.click(screen.getByRole('button', { name: 'Shake Free (Orc Warrior)' }));
      await waitFor(() => {
        expect(executeHandler).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'Custom Shake' }),
          expect.any(Object),
          expect.any(String),
          null
        );
      });
    });

    it('uses the custom range in executeHandler', async () => {
      render(<HypnoticPatternShakeModal {...makeProps({ rangeFeet: 45 })} />);
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[0]);
      fireEvent.click(screen.getByRole('button', { name: 'Shake Free (Orc Warrior)' }));
      await waitFor(() => {
        expect(executeHandler).toHaveBeenCalledWith(
          expect.objectContaining({ automation: expect.objectContaining({ range: '45 ft' }) }),
          expect.any(Object),
          expect.any(String),
          null
        );
      });
    });

    it('includes the target name in the log description', async () => {
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
  });

  describe('shake action - processing state', () => {
    it('shows processing text during the async operation', async () => {
      let resolveHandler;
      executeHandler.mockReturnValue(new Promise(resolve => { resolveHandler = resolve; }));
      render(<HypnoticPatternShakeModal {...makeProps()} />);
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[0]);
      fireEvent.click(screen.getByRole('button', { name: 'Shake Free (Orc Warrior)' }));
      expect(screen.getByText('Shaking target free...')).toBeInTheDocument();
      await resolveHandler({});
    });

    it('hides target selection UI during processing', async () => {
      executeHandler.mockReturnValue(new Promise(() => {}));
      render(<HypnoticPatternShakeModal {...makeProps()} />);
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[0]);
      fireEvent.click(screen.getByRole('button', { name: 'Shake Free (Orc Warrior)' }));
      await waitFor(() => {
        expect(screen.queryByText(/Select a creature/)).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Orc Warrior' })).not.toBeInTheDocument();
      });
    });

    it('hides the action buttons during processing', async () => {
      executeHandler.mockReturnValue(new Promise(() => {}));
      render(<HypnoticPatternShakeModal {...makeProps()} />);
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[0]);
      fireEvent.click(screen.getByRole('button', { name: 'Shake Free (Orc Warrior)' }));
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /Shake Free/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
      });
    });
  });

  describe('shake action - error handling', () => {
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
      expect(document.querySelectorAll('.abjure-target-row')).toHaveLength(0);
      expect(screen.getByRole('button', { name: 'Shake Free (none)' })).toBeDisabled();
    });

    it('renders a single target correctly', () => {
      render(<HypnoticPatternShakeModal {...makeProps({ targets: ['Orc Warrior'] })} />);
      expect(screen.getByText('Orc Warrior')).toBeInTheDocument();
      expect(document.querySelectorAll('input[type="radio"]')).toHaveLength(1);
    });

    it('calls executeHandler correctly with a single target', async () => {
      executeHandler.mockResolvedValue({});
      render(<HypnoticPatternShakeModal {...makeProps({ targets: ['Orc Warrior'] })} />);
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[0]);
      fireEvent.click(screen.getByRole('button', { name: 'Shake Free (Orc Warrior)' }));
      await waitFor(() => {
        expect(executeHandler).toHaveBeenCalledWith(
          expect.objectContaining({ automation: expect.objectContaining({ range: '60 ft' }) }),
          expect.any(Object),
          expect.any(String),
          null
        );
      });
    });
  });

  describe('edge cases - props', () => {
    it('renders with 30-foot range', () => {
      render(<HypnoticPatternShakeModal {...makeProps({ rangeFeet: 30 })} />);
      expect(screen.getByText(/within 30 feet/)).toBeInTheDocument();
    });

    it('passes the correct range to executeHandler', async () => {
      render(<HypnoticPatternShakeModal {...makeProps({ rangeFeet: 30 })} />);
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[0]);
      fireEvent.click(screen.getByRole('button', { name: 'Shake Free (Orc Warrior)' }));
      await waitFor(() => {
        expect(executeHandler).toHaveBeenCalledWith(
          expect.objectContaining({ automation: expect.objectContaining({ range: '30 ft' }) }),
          expect.any(Object),
          expect.any(String),
          null
        );
      });
    });

    it('renders with a long target name containing spaces and numbers', () => {
      render(<HypnoticPatternShakeModal {...makeProps({ targets: ['Dragon #1 Ancient Red'] })} />);
      expect(screen.getByText('Dragon #1 Ancient Red')).toBeInTheDocument();
      fireEvent.click(document.querySelectorAll('input[type="radio"]')[0]);
      expect(screen.getByRole('button', { name: 'Shake Free (Dragon #1 Ancient Red)' })).toBeInTheDocument();
    });
  });
});
