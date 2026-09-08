// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ThirdEyeModal from './ThirdEyeModal.jsx';

// ── Mocked modules ──

vi.mock('../../../../services/automation/handlers/class-wizard/thirdEyeHandler.js', () => ({
  applyThirdEye: vi.fn(),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue({}),
}));

// Re-import mocked modules after mocking
import * as thirdEyeHandler from '../../../../services/automation/handlers/class-wizard/thirdEyeHandler.js';
import { addEntry } from '../../../../services/ui/logService.js';

// ── Test fixtures ──

const defaultResult = {
  type: 'popup',
  payload: {
    type: 'automation_info',
    name: 'Third Eye',
    description: 'Third Eye: Darkvision (120 feet) chosen. You gain Darkvision out to a range of 120 feet. (Duration: until start of Short or Long Rest)',
  },
};

const baseProps = {
  action: { name: 'Third Eye', automation: { duration: 'short_or_long_rest' } },
  playerStats: { name: 'Wizard1', level: 14 },
  campaignName: 'test-campaign',
  onClose: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

// ── Tests ──

describe('ThirdEyeModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    thirdEyeHandler.applyThirdEye.mockResolvedValue(defaultResult);
  });

  describe('initial render', () => {
    it('renders the modal with header, radio options, and buttons', () => {
      render(<ThirdEyeModal {...makeProps()} />);
      expect(screen.getByText('Third Eye')).toBeInTheDocument();
      expect(screen.getByText(/Choose a benefit/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Use Bonus Action/ })).toBeInTheDocument();
      expect(screen.getByText(/You gain Darkvision out to a range of 120 feet/)).toBeInTheDocument();
      expect(screen.getByText(/You can read any language/)).toBeInTheDocument();
      expect(screen.getByText(/You can see invisible creatures/)).toBeInTheDocument();
      const radios = document.querySelectorAll('input[name="thirdEye"]');
      expect(radios).toHaveLength(3);
      expect(radios[0]).toBeChecked();
    });
  });

  describe('cancel', () => {
    it('calls onClose when Cancel button is clicked', () => {
      const onClose = vi.fn();
      render(<ThirdEyeModal {...makeProps({ onClose })} />);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when overlay outside the modal is clicked', () => {
      const onClose = vi.fn();
      render(<ThirdEyeModal {...makeProps({ onClose })} />);
      const overlay = document.querySelector('.sp-overlay');
      fireEvent.click(overlay);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when clicking inside the modal content', () => {
      const onClose = vi.fn();
      render(<ThirdEyeModal {...makeProps({ onClose })} />);
      const header = document.querySelector('.sp-header');
      fireEvent.click(header);
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('apply', () => {
    it('calls applyThirdEye with the default option and transitions to result state', async () => {
      render(<ThirdEyeModal {...makeProps()} />);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Use Bonus Action/ }));
      });
      expect(thirdEyeHandler.applyThirdEye).toHaveBeenCalledWith(
        baseProps.action,
        baseProps.playerStats,
        baseProps.campaignName,
        'Darkvision (120 feet)'
      );
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
      });
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Use Bonus Action/ })).not.toBeInTheDocument();
    });

    it('calls applyThirdEye with a non-default option when selected', async () => {
      render(<ThirdEyeModal {...makeProps()} />);
      const radios = document.querySelectorAll('input[name="thirdEye"]');
      await act(async () => {
        fireEvent.click(radios[1]);
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Use Bonus Action/ }));
      });
      expect(thirdEyeHandler.applyThirdEye).toHaveBeenCalledWith(
        baseProps.action,
        baseProps.playerStats,
        baseProps.campaignName,
        'Greater Comprehension'
      );
    });

    it('displays the handler result description and closes on Done', async () => {
      const onClose = vi.fn();
      render(<ThirdEyeModal {...makeProps({ onClose })} />);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Use Bonus Action/ }));
      });
      await waitFor(() => {
        expect(screen.getByText(/Darkvision out to a range of 120 feet/)).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('displays custom description from handler response', async () => {
      thirdEyeHandler.applyThirdEye.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Third Eye',
          description: 'Custom description text',
        },
      });
      render(<ThirdEyeModal {...makeProps()} />);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Use Bonus Action/ }));
      });
      await waitFor(() => {
        expect(screen.getByText('Custom description text')).toBeInTheDocument();
      });
    });

    it('flushes handler logEntries to the campaign log via addEntry', async () => {
      thirdEyeHandler.applyThirdEye.mockResolvedValue({
        ...defaultResult,
        logEntries: [{
          characterName: 'Wizard1',
          type: 'ability_use',
          abilityName: 'The Third Eye',
          description: 'Wizard1 uses The Third Eye, choosing Darkvision (120 feet).',
          timestamp: 123,
        }],
      });
      render(<ThirdEyeModal {...makeProps()} />);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Use Bonus Action/ }));
      });
      await waitFor(() => {
        expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
          type: 'ability_use',
          abilityName: 'The Third Eye',
          characterName: 'Wizard1',
        }));
      });
    });

    it('does not call addEntry when handler returns no logEntries', async () => {
      render(<ThirdEyeModal {...makeProps()} />);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Use Bonus Action/ }));
      });
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
      });
      expect(addEntry).not.toHaveBeenCalled();
    });
  });
});
