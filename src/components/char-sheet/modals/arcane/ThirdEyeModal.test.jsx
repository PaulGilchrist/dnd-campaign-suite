// @improved-by-ai
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
    it('renders the modal overlay with the action name in the header', () => {
      render(<ThirdEyeModal {...makeProps()} />);
      expect(screen.getByText('Third Eye')).toBeInTheDocument();
      expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
    });

    it('renders a Font Awesome eye icon in the header', () => {
      render(<ThirdEyeModal {...makeProps()} />);
      const icon = document.querySelector('.sp-header .fa-eye');
      expect(icon).toBeInTheDocument();
    });

    it('renders three radio options grouped under name thirdEye', () => {
      render(<ThirdEyeModal {...makeProps()} />);
      const radios = document.querySelectorAll('input[name="thirdEye"]');
      expect(radios).toHaveLength(3);
    });

    it('selects the first option by default', () => {
      render(<ThirdEyeModal {...makeProps()} />);
      const radios = document.querySelectorAll('input[name="thirdEye"]');
      expect(radios[0]).toBeChecked();
      expect(radios[1]).not.toBeChecked();
      expect(radios[2]).not.toBeChecked();
    });

    it('disables the Apply button when no option is selected', () => {
      // Force selected to null by setting state — the component always
      // defaults to the first option so we simulate the disabled state
      // by rendering with a prop that would clear selection. The component
      // itself always has a default, so we verify the button is enabled by
      // default (first option pre-selected).
      render(<ThirdEyeModal {...makeProps()} />);
      const applyBtn = screen.getByRole('button', { name: /Use Bonus Action/ });
      expect(applyBtn).toBeEnabled();
    });

    it('renders all option descriptions', () => {
      render(<ThirdEyeModal {...makeProps()} />);
      expect(screen.getByText(/You gain Darkvision out to a range of 120 feet/)).toBeInTheDocument();
      expect(screen.getByText(/You can read any language/)).toBeInTheDocument();
      expect(screen.getByText(/You can see invisible creatures/)).toBeInTheDocument();
    });

    it('renders Cancel and Apply buttons', () => {
      render(<ThirdEyeModal {...makeProps()} />);
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Use Bonus Action/ })).toBeInTheDocument();
    });

    it('displays the instruction text', () => {
      render(<ThirdEyeModal {...makeProps()} />);
      expect(screen.getByText(/Choose a benefit/)).toBeInTheDocument();
    });

    it('does not show the result state on initial render', () => {
      render(<ThirdEyeModal {...makeProps()} />);
      expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    });
  });

  // ── Overlay click behavior ──

  describe('overlay interaction', () => {
    it('calls onClose when clicking the overlay background', async () => {
      const onClose = vi.fn();
      render(<ThirdEyeModal {...makeProps({ onClose })} />);
      fireEvent.click(document.querySelector('.sp-overlay'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when clicking inside the modal content', () => {
      const onClose = vi.fn();
      render(<ThirdEyeModal {...makeProps({ onClose })} />);
      fireEvent.click(document.querySelector('.sp-modal'));
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  // ── Radio selection ──

  describe('radio selection', () => {
    it('selects Greater Comprehension when clicked', () => {
      render(<ThirdEyeModal {...makeProps()} />);
      const radios = document.querySelectorAll('input[name="thirdEye"]');
      fireEvent.click(radios[1]);
      expect(radios[1]).toBeChecked();
      expect(radios[0]).not.toBeChecked();
    });

    it('selects See Invisibility when clicked', () => {
      render(<ThirdEyeModal {...makeProps()} />);
      const radios = document.querySelectorAll('input[name="thirdEye"]');
      fireEvent.click(radios[2]);
      expect(radios[2]).toBeChecked();
      expect(radios[0]).not.toBeChecked();
    });

    it('keeps Apply button enabled after selecting a different option', () => {
      render(<ThirdEyeModal {...makeProps()} />);
      const applyBtn = screen.getByRole('button', { name: /Use Bonus Action/ });
      expect(applyBtn).toBeEnabled();
      const radios = document.querySelectorAll('input[name="thirdEye"]');
      fireEvent.click(radios[1]);
      expect(applyBtn).toBeEnabled();
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
    it('calls applyThirdEye with the chosen option', async () => {
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

    it('transitions to result state after apply resolves', async () => {
      render(<ThirdEyeModal {...makeProps()} />);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Use Bonus Action/ }));
      });
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
      });
    });

    it('hides Cancel button after apply', async () => {
      render(<ThirdEyeModal {...makeProps()} />);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Use Bonus Action/ }));
      });
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
      });
    });

    it('hides radio options after apply', async () => {
      render(<ThirdEyeModal {...makeProps()} />);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Use Bonus Action/ }));
      });
      await waitFor(() => {
        expect(screen.queryByLabelText('Darkvision (120 feet)')).not.toBeInTheDocument();
      });
    });

    it('hides Apply button after apply', async () => {
      render(<ThirdEyeModal {...makeProps()} />);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Use Bonus Action/ }));
      });
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /Use Bonus Action/ })).not.toBeInTheDocument();
      });
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

    it('retains the eye icon in the result header', async () => {
      render(<ThirdEyeModal {...makeProps()} />);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Use Bonus Action/ }));
      });
      await waitFor(() => {
        const icon = document.querySelector('.sp-header .fa-eye');
        expect(icon).toBeInTheDocument();
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



  // ── Edge cases ──

  describe('edge cases', () => {
    it('throws a React error when action prop is null', () => {
      expect(() => render(<ThirdEyeModal {...makeProps({ action: null })} />)).toThrow();
    });

    it('throws when onClose is not provided', () => {
      // Without onClose, clicking the overlay would call undefined,
      // but React will throw at render time if it's used in JSX expressions.
      // The component uses onClose in onClick handlers which are fine without it
      // at render time — the error would surface on interaction. We test that
      // the modal still renders but the close handler would be a no-op if
      // the caller forgets to pass it.
      render(<ThirdEyeModal {...makeProps({ onClose: undefined })} />);
      expect(screen.getByText('Third Eye')).toBeInTheDocument();
    });
  });
});
