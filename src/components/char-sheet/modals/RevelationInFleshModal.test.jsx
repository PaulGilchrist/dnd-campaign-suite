// @improved-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RevelationInFleshModal from './RevelationInFleshModal.jsx';

vi.mock(
  '../../../services/automation/handlers/class-warlock/revelationInFleshHandler.js',
  () => ({
    applyRevelationOption: vi.fn(),
  })
);

import * as revelationHandler from '../../../services/automation/handlers/class-warlock/revelationInFleshHandler.js';

const mockOnClose = vi.fn();

const defaultResult = {
  type: 'popup',
  payload: {
    type: 'automation_info',
    name: 'Revelation in Flesh',
    description: 'Charm Person chosen. Gain the ability to charm others. (1 SP spent, duration: 10 minutes)',
  },
};

const baseProps = {
  action: {
    name: 'Revelation in Flesh',
    automation: {
      type: 'revelation',
      options: [
        { name: 'Charm Person', description: 'Gain the ability to charm others' },
        { name: 'Detect Thoughts', description: 'Read the thoughts of others' },
        { name: 'Elongated Fingers', description: 'Your fingers stretch and become prehensile' },
      ],
      duration: '10_minutes',
    },
  },
  playerStats: { name: 'Warlock1', level: 5, hitPoints: 30 },
  campaignName: 'test-campaign',
  onClose: mockOnClose,
};

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

describe('RevelationInFleshModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    revelationHandler.applyRevelationOption.mockResolvedValue(defaultResult);
  });

  describe('initial render', () => {
    it('renders the overlay and modal structure', () => {
      render(<RevelationInFleshModal {...makeProps()} />);
      expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
      expect(document.querySelector('.sp-modal')).toBeInTheDocument();
      expect(document.querySelector('.sp-header')).toBeInTheDocument();
      expect(document.querySelector('.sp-body')).toBeInTheDocument();
      expect(document.querySelector('.sp-actions')).toBeInTheDocument();
    });

    it('renders the action name in the header', () => {
      render(<RevelationInFleshModal {...makeProps()} />);
      expect(screen.getByText('Revelation in Flesh')).toBeInTheDocument();
    });

    it('renders a Font Awesome DNA icon in the header', () => {
      render(<RevelationInFleshModal {...makeProps()} />);
      expect(document.querySelector('.sp-header .fa-dna')).toBeInTheDocument();
    });

    it('displays the selection prompt text', () => {
      render(<RevelationInFleshModal {...makeProps()} />);
      expect(
        screen.getByText(/Choose a bodily alteration/)
      ).toBeInTheDocument();
    });

    it('renders all options as radio buttons with descriptions', () => {
      render(<RevelationInFleshModal {...makeProps()} />);
      const radios = document.querySelectorAll('input[name="revelationOption"]');
      expect(radios).toHaveLength(3);
      expect(screen.getByText('Charm Person')).toBeInTheDocument();
      expect(screen.getByText(/Gain the ability to charm others/)).toBeInTheDocument();
      expect(screen.getByText('Detect Thoughts')).toBeInTheDocument();
      expect(screen.getByText(/Read the thoughts of others/)).toBeInTheDocument();
      expect(screen.getByText('Elongated Fingers')).toBeInTheDocument();
      expect(
        screen.getByText(/Your fingers stretch and become prehensile/)
      ).toBeInTheDocument();
    });

    it('renders disabled Activate and Cancel buttons', () => {
      render(<RevelationInFleshModal {...makeProps()} />);
      const activateBtn = screen.getByRole('button', {
        name: /Activate Revelation in Flesh/,
      });
      expect(activateBtn).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('renders a Font Awesome DNA icon on the Activate button', () => {
      render(<RevelationInFleshModal {...makeProps()} />);
      expect(document.querySelector('.sp-roll-btn .fa-dna')).toBeInTheDocument();
    });

    it('does not show a result on initial render', () => {
      render(<RevelationInFleshModal {...makeProps()} />);
      expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    });

    it('shows selection UI on initial render', () => {
      render(<RevelationInFleshModal {...makeProps()} />);
      expect(screen.getByText(/Choose a bodily alteration/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Activate/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('renders radio buttons with the correct name attribute', () => {
      render(<RevelationInFleshModal {...makeProps()} />);
      const radios = document.querySelectorAll('input[name="revelationOption"]');
      expect(radios).toHaveLength(3);
    });
  });

  describe('options without descriptions', () => {
    it('renders options when description is missing', () => {
      const action = {
        name: 'Revelation in Flesh',
        automation: { options: [{ name: 'Option No Description' }] },
      };
      render(<RevelationInFleshModal {...makeProps({ action })} />);
      expect(screen.getByText('Option No Description')).toBeInTheDocument();
    });

    it('renders mixed options with and without descriptions', () => {
      const action = {
        name: 'Revelation in Flesh',
        automation: {
          options: [
            { name: 'With Desc', description: 'Has description' },
            { name: 'Without Desc' },
          ],
        },
      };
      render(<RevelationInFleshModal {...makeProps({ action })} />);
      expect(screen.getByText('With Desc')).toBeInTheDocument();
      expect(screen.getByText('Without Desc')).toBeInTheDocument();
    });
  });

  describe('options edge cases', () => {
    it('renders no options when automation is missing', () => {
      const action = { name: 'Revelation in Flesh' };
      render(<RevelationInFleshModal {...makeProps({ action })} />);
      expect(screen.queryByLabelText('Charm Person')).not.toBeInTheDocument();
      expect(
        screen.getByText(/Choose a bodily alteration/)
      ).toBeInTheDocument();
    });

    it('renders no options when options array is empty', () => {
      const action = {
        name: 'Revelation in Flesh',
        automation: { options: [] },
      };
      render(<RevelationInFleshModal {...makeProps({ action })} />);
      expect(
        screen.getByText(/Choose a bodily alteration/)
      ).toBeInTheDocument();
      expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    });
  });

  describe('selection behavior', () => {
    it('selects an option when its radio button is clicked', () => {
      render(<RevelationInFleshModal {...makeProps()} />);
      const radios = document.querySelectorAll('input[name="revelationOption"]');
      fireEvent.click(radios[1]);
      expect(radios[1]).toBeChecked();
    });

    it('enables the Activate button after selecting an option', () => {
      render(<RevelationInFleshModal {...makeProps()} />);
      fireEvent.click(document.querySelectorAll('input[name="revelationOption"]')[0]);
      expect(screen.getByRole('button', { name: /Activate/ })).toBeEnabled();
    });

    it('switches selection to a different option', () => {
      render(<RevelationInFleshModal {...makeProps()} />);
      const radios = document.querySelectorAll('input[name="revelationOption"]');
      fireEvent.click(radios[0]);
      expect(radios[0]).toBeChecked();
      fireEvent.click(radios[2]);
      expect(radios[0]).not.toBeChecked();
      expect(radios[2]).toBeChecked();
    });
  });

  describe('activation flow', () => {
    it('calls applyRevelationOption with correct arguments', async () => {
      render(<RevelationInFleshModal {...makeProps()} />);
      fireEvent.click(document.querySelectorAll('input[name="revelationOption"]')[0]);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Activate/ }));
      });
      expect(revelationHandler.applyRevelationOption).toHaveBeenCalledWith(
        baseProps.action,
        baseProps.playerStats,
        baseProps.campaignName,
        'Charm Person'
      );
    });

    it('does not call applyRevelationOption when no option is selected', async () => {
      render(<RevelationInFleshModal {...makeProps()} />);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Activate/ }));
      });
      expect(revelationHandler.applyRevelationOption).not.toHaveBeenCalled();
    });

    it('keeps the Activate button enabled while applying (disabled is based on selected)', async () => {
      let resolveFn;
      revelationHandler.applyRevelationOption.mockImplementation(
        () => new Promise((resolve) => { resolveFn = resolve; })
      );
      render(<RevelationInFleshModal {...makeProps()} />);
      fireEvent.click(document.querySelectorAll('input[name="revelationOption"]')[0]);
      const activateBtn = screen.getByRole('button', { name: /Activate/ });
      expect(activateBtn).toBeEnabled();
      await act(async () => {
        fireEvent.click(activateBtn);
      });
      resolveFn?.(defaultResult);
      await act(async () => {
        await new Promise(r => setTimeout(r, 0));
      });
      expect(activateBtn).toBeEnabled();
    });

    it('updates result state when handler returns a different result', async () => {
      revelationHandler.applyRevelationOption.mockResolvedValueOnce({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Revelation in Flesh',
          description: 'First result',
        },
      });
      render(<RevelationInFleshModal {...makeProps()} />);
      fireEvent.click(document.querySelectorAll('input[name="revelationOption"]')[0]);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Activate/ }));
      });
      await waitFor(() => {
        expect(screen.getByText('First result')).toBeInTheDocument();
      });
    });
  });

  describe('result state', () => {
    it('replaces selection UI with result description', async () => {
      render(<RevelationInFleshModal {...makeProps()} />);
      fireEvent.click(document.querySelectorAll('input[name="revelationOption"]')[0]);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Activate/ }));
      });
      await waitFor(() => {
        expect(
          document.querySelector('input[name="revelationOption"]')
        ).not.toBeInTheDocument();
      });
      await waitFor(() => {
        expect(screen.queryByText(/Choose a bodily alteration/)).not.toBeInTheDocument();
      });
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
      });
    });

    it('shows the action name in the result header', async () => {
      render(<RevelationInFleshModal {...makeProps()} />);
      fireEvent.click(document.querySelectorAll('input[name="revelationOption"]')[0]);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Activate/ }));
      });
      await waitFor(() => {
        expect(screen.getByText('Revelation in Flesh')).toBeInTheDocument();
      });
    });

    it('renders a Font Awesome DNA icon in the result header', async () => {
      render(<RevelationInFleshModal {...makeProps()} />);
      fireEvent.click(document.querySelectorAll('input[name="revelationOption"]')[0]);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Activate/ }));
      });
      await waitFor(() => {
        expect(document.querySelector('.sp-header .fa-dna')).toBeInTheDocument();
      });
    });

    it('renders the handler-provided description in the body', async () => {
      const desc =
        'Revelation in Flesh: Detect Thoughts chosen. Read the thoughts of others. (1 SP spent, duration: 10 minutes)';
      revelationHandler.applyRevelationOption.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Revelation in Flesh',
          description: desc,
        },
      });
      render(<RevelationInFleshModal {...makeProps()} />);
      fireEvent.click(document.querySelectorAll('input[name="revelationOption"]')[1]);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Activate/ }));
      });
      await waitFor(() => {
        expect(screen.getByText(desc)).toBeInTheDocument();
      });
    });

    it('renders the description via dangerouslySetInnerHTML', async () => {
      revelationHandler.applyRevelationOption.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Revelation in Flesh',
          description: '<p>Special <strong>ability</strong> activated</p>',
        },
      });
      render(<RevelationInFleshModal {...makeProps()} />);
      fireEvent.click(document.querySelectorAll('input[name="revelationOption"]')[0]);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Activate/ }));
      });
      await waitFor(() => {
        const body = document.querySelector('.sp-body');
        expect(body.querySelector('p strong')).toBeInTheDocument();
      });
    });

    it('hides the Cancel button in the result state', async () => {
      render(<RevelationInFleshModal {...makeProps()} />);
      fireEvent.click(document.querySelectorAll('input[name="revelationOption"]')[0]);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Activate/ }));
      });
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
      });
    });

    it('hides the Activate button in the result state', async () => {
      render(<RevelationInFleshModal {...makeProps()} />);
      fireEvent.click(document.querySelectorAll('input[name="revelationOption"]')[0]);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Activate/ }));
      });
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /Activate/ })).not.toBeInTheDocument();
      });
    });

    it('displays a custom action name in the result header', async () => {
      const action = {
        name: 'My Custom Revelation',
        automation: {
          options: [{ name: 'Option A', description: 'Desc A' }],
        },
      };
      revelationHandler.applyRevelationOption.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'My Custom Revelation',
          description: 'Result',
        },
      });
      render(<RevelationInFleshModal {...makeProps({ action })} />);
      fireEvent.click(document.querySelectorAll('input[name="revelationOption"]')[0]);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Activate/ }));
      });
      await waitFor(() => {
        expect(screen.getByText('My Custom Revelation')).toBeInTheDocument();
      });
    });
  });

  describe('closing the modal', () => {
    it('calls onClose when clicking the overlay background', () => {
      render(<RevelationInFleshModal {...makeProps()} />);
      fireEvent.click(document.querySelector('.sp-overlay'));
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when clicking inside the modal content', () => {
      render(<RevelationInFleshModal {...makeProps()} />);
      fireEvent.click(document.querySelector('.sp-modal'));
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('calls onClose when Cancel button is clicked', () => {
      render(<RevelationInFleshModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when Done button is clicked after apply', async () => {
      render(<RevelationInFleshModal {...makeProps()} />);
      fireEvent.click(document.querySelectorAll('input[name="revelationOption"]')[0]);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Activate/ }));
      });
      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      });
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when clicking overlay in result state', async () => {
      render(<RevelationInFleshModal {...makeProps()} />);
      fireEvent.click(document.querySelectorAll('input[name="revelationOption"]')[0]);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Activate/ }));
      });
      await waitFor(() => {
        fireEvent.click(document.querySelector('.sp-overlay'));
      });
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });
});
