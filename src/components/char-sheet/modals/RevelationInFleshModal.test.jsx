// @cleaned-by-ai
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
    it('renders the action name, selection prompt, options with descriptions, and buttons', () => {
      render(<RevelationInFleshModal {...makeProps()} />);
      expect(screen.getByText('Revelation in Flesh')).toBeInTheDocument();
      expect(screen.getByText(/Choose a bodily alteration/)).toBeInTheDocument();
      expect(screen.getByText('Charm Person')).toBeInTheDocument();
      expect(screen.getByText(/Gain the ability to charm others/)).toBeInTheDocument();
      expect(screen.getByText('Detect Thoughts')).toBeInTheDocument();
      expect(screen.getByText(/Read the thoughts of others/)).toBeInTheDocument();
      expect(screen.getByText('Elongated Fingers')).toBeInTheDocument();
      expect(
        screen.getByText(/Your fingers stretch and become prehensile/)
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Activate Revelation in Flesh/ })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('renders options when description is missing or options are mixed', () => {
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

    it('renders no options when automation is missing or options array is empty', () => {
      const actionNoAutomation = { name: 'Revelation in Flesh' };
      render(<RevelationInFleshModal {...makeProps({ action: actionNoAutomation })} />);
      expect(
        screen.getByText(/Choose a bodily alteration/)
      ).toBeInTheDocument();
      expect(screen.queryByRole('radio')).not.toBeInTheDocument();

      const actionEmptyOptions = {
        name: 'Revelation in Flesh',
        automation: { options: [] },
      };
      render(<RevelationInFleshModal {...makeProps({ action: actionEmptyOptions })} />);
      expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    });
  });

  describe('selection behavior', () => {
    it('enables the Activate button after selecting an option and switches between options', () => {
      render(<RevelationInFleshModal {...makeProps()} />);
      const radios = document.querySelectorAll('input[name="revelationOption"]');
      fireEvent.click(radios[0]);
      expect(radios[0]).toBeChecked();
      expect(screen.getByRole('button', { name: /Activate/ })).toBeEnabled();

      fireEvent.click(radios[2]);
      expect(radios[0]).not.toBeChecked();
      expect(radios[2]).toBeChecked();
    });
  });

  describe('activation flow', () => {
    it('calls applyRevelationOption with correct arguments when an option is selected', async () => {
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

    it('renders the handler-provided description in the result body', async () => {
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
  });

  describe('result state', () => {
    it('replaces selection UI with result description, custom action name, and Done button', async () => {
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
        expect(screen.queryByRole('radio')).not.toBeInTheDocument();
      });
      await waitFor(() => {
        expect(screen.queryByText(/Choose a bodily alteration/)).not.toBeInTheDocument();
      });
      await waitFor(() => {
        expect(screen.getByText('My Custom Revelation')).toBeInTheDocument();
      });
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
      });
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
      });
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /Activate/ })).not.toBeInTheDocument();
      });
    });

    it('renders HTML in the result body via dangerouslySetInnerHTML', async () => {
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
  });

  describe('after apply', () => {
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
  });
});
