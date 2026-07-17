// @cleaned-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RevelationInFleshModal from './RevelationInFleshModal.jsx';

vi.mock(
  '../../../services/automation/handlers/class-warlock/revelationInFleshHandler.js',
  () => ({
    applyRevelationOptions: vi.fn(),
  })
);

import * as revelationHandler from '../../../services/automation/handlers/class-warlock/revelationInFleshHandler.js';

const mockOnClose = vi.fn();

const defaultResult = {
  type: 'popup',
  payload: {
    type: 'automation_info',
    name: 'Revelation in Flesh',
    description: 'Revelation in Flesh: Charm Person, Detect Thoughts chosen. (2 SP spent, duration: 10 minutes)',
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
    revelationHandler.applyRevelationOptions.mockResolvedValue(defaultResult);
  });

  describe('initial render', () => {
    it('renders the action name, selection prompt, options with descriptions, and buttons', () => {
      render(<RevelationInFleshModal {...makeProps()} />);
      expect(screen.getByText('Revelation in Flesh')).toBeInTheDocument();
      expect(screen.getByText(/Choose bodily alterations/)).toBeInTheDocument();
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
        screen.getByText(/Choose bodily alterations/)
      ).toBeInTheDocument();
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();

      const actionEmptyOptions = {
        name: 'Revelation in Flesh',
        automation: { options: [] },
      };
      render(<RevelationInFleshModal {...makeProps({ action: actionEmptyOptions })} />);
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });
  });

  describe('selection behavior', () => {
    it('enables the Activate button after selecting an option and allows multiple selections', () => {
      render(<RevelationInFleshModal {...makeProps()} />);
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');

      fireEvent.click(checkboxes[0]);
      expect(checkboxes[0]).toBeChecked();
      expect(screen.getByRole('button', { name: /Activate/ })).toBeEnabled();

      fireEvent.click(checkboxes[2]);
      expect(checkboxes[0]).toBeChecked();
      expect(checkboxes[2]).toBeChecked();
    });

    it('allows toggling options on and off', () => {
      render(<RevelationInFleshModal {...makeProps()} />);
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');

      fireEvent.click(checkboxes[0]);
      expect(checkboxes[0]).toBeChecked();

      fireEvent.click(checkboxes[0]);
      expect(checkboxes[0]).not.toBeChecked();
    });
  });

  describe('activation flow', () => {
    it('calls applyRevelationOptions with correct arguments when options are selected', async () => {
      render(<RevelationInFleshModal {...makeProps()} />);
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      fireEvent.click(checkboxes[0]);
      fireEvent.click(checkboxes[1]);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Activate/ }));
      });
      expect(revelationHandler.applyRevelationOptions).toHaveBeenCalledWith(
        baseProps.action,
        baseProps.playerStats,
        baseProps.campaignName,
        ['Charm Person', 'Detect Thoughts']
      );
    });

    it('does not call applyRevelationOptions when no option is selected', async () => {
      render(<RevelationInFleshModal {...makeProps()} />);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Activate/ }));
      });
      expect(revelationHandler.applyRevelationOptions).not.toHaveBeenCalled();
    });

    it('renders the handler-provided description in the result body', async () => {
      const desc =
        'Revelation in Flesh: Charm Person, Detect Thoughts chosen. (2 SP spent, duration: 10 minutes)';
      revelationHandler.applyRevelationOptions.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Revelation in Flesh',
          description: desc,
        },
      });
      render(<RevelationInFleshModal {...makeProps()} />);
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      fireEvent.click(checkboxes[0]);
      fireEvent.click(checkboxes[1]);
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
      revelationHandler.applyRevelationOptions.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'My Custom Revelation',
          description: 'Result',
        },
      });
      render(<RevelationInFleshModal {...makeProps({ action })} />);
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      fireEvent.click(checkboxes[0]);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Activate/ }));
      });
      await waitFor(() => {
        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
      });
      await waitFor(() => {
        expect(screen.queryByText(/Choose bodily alterations/)).not.toBeInTheDocument();
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
      revelationHandler.applyRevelationOptions.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Revelation in Flesh',
          description: '<p>Special <strong>ability</strong> activated</p>',
        },
      });
      render(<RevelationInFleshModal {...makeProps()} />);
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      fireEvent.click(checkboxes[0]);
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
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      fireEvent.click(checkboxes[0]);
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
