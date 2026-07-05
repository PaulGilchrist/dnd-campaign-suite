// @cleaned-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ThirdEyeModal from './ThirdEyeModal.jsx';

// ── Mocked modules ──

vi.mock('../../../../services/automation/handlers/class-wizard/thirdEyeHandler.js', () => ({
  applyThirdEye: vi.fn(),
}));

// Re-import mocked modules after mocking
import * as thirdEyeHandler from '../../../../services/automation/handlers/class-wizard/thirdEyeHandler.js';

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

  // ── Initial render / display ──

  describe('initial render', () => {
    it('renders the modal with header, radio options, and buttons', () => {
      render(<ThirdEyeModal {...makeProps()} />);
      expect(screen.getByText('Third Eye')).toBeInTheDocument();
      expect(screen.getByText(/Choose a benefit/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Use Bonus Action/ })).toBeInTheDocument();
    });

    it('renders all three radio options with descriptions', () => {
      render(<ThirdEyeModal {...makeProps()} />);
      expect(screen.getByText(/You gain Darkvision out to a range of 120 feet/)).toBeInTheDocument();
      expect(screen.getByText(/You can read any language/)).toBeInTheDocument();
      expect(screen.getByText(/You can see invisible creatures/)).toBeInTheDocument();
    });

    it('selects the first option by default', () => {
      render(<ThirdEyeModal {...makeProps()} />);
      const radios = document.querySelectorAll('input[name="thirdEye"]');
      expect(radios).toHaveLength(3);
      expect(radios[0]).toBeChecked();
    });
  });

  // ── Radio selection ──

  describe('radio selection', () => {
    it('selects the chosen option when clicked', () => {
      render(<ThirdEyeModal {...makeProps()} />);
      const radios = document.querySelectorAll('input[name="thirdEye"]');
      fireEvent.click(radios[1]);
      expect(radios[1]).toBeChecked();
      expect(radios[0]).not.toBeChecked();
    });
  });

  // ── Cancel button ──

  describe('cancel', () => {
    it('calls onClose when Cancel button is clicked', () => {
      const onClose = vi.fn();
      render(<ThirdEyeModal {...makeProps({ onClose })} />);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  // ── Apply flow ──

  describe('apply', () => {
    it('calls applyThirdEye with the chosen option and transitions to result state', async () => {
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
    });

    it('calls applyThirdEye with a non-default option when selected', async () => {
      render(<ThirdEyeModal {...makeProps()} />);
      const radios = document.querySelectorAll('input[name="thirdEye"]');
      await act(async () => {
        fireEvent.click(radios[2]);
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Use Bonus Action/ }));
      });
      expect(thirdEyeHandler.applyThirdEye).toHaveBeenCalledWith(
        baseProps.action,
        baseProps.playerStats,
        baseProps.campaignName,
        'See Invisibility'
      );
    });

    it('displays the result description from the handler response', async () => {
      render(<ThirdEyeModal {...makeProps()} />);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Use Bonus Action/ }));
      });
      await waitFor(() => {
        expect(screen.getByText(/Darkvision out to a range of 120 feet/)).toBeInTheDocument();
      });
    });

    it('displays a custom description when the handler returns different text', async () => {
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

    it('calls onClose when Done button is clicked after apply', async () => {
      const onClose = vi.fn();
      render(<ThirdEyeModal {...makeProps({ onClose })} />);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Use Bonus Action/ }));
      });
      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
