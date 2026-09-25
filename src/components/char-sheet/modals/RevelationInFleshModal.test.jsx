// @improved-by-ai
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

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn().mockImplementation(() => Promise.resolve()),
}));

import * as revelationHandler from '../../../services/automation/handlers/class-warlock/revelationInFleshHandler.js';
import * as logService from '../../../services/ui/logService.js';

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

    it('renders options with and without descriptions', () => {
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

    it('renders no checkboxes when automation is missing', () => {
      const actionNoAutomation = { name: 'Revelation in Flesh' };
      render(<RevelationInFleshModal {...makeProps({ action: actionNoAutomation })} />);
      expect(
        screen.getByText(/Choose bodily alterations/)
      ).toBeInTheDocument();
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    it('renders no checkboxes when options array is empty', () => {
      const actionEmptyOptions = {
        name: 'Revelation in Flesh',
        automation: { options: [] },
      };
      render(<RevelationInFleshModal {...makeProps({ action: actionEmptyOptions })} />);
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });
  });

  describe('selection behavior', () => {
    it('toggles options and enables/disables the Activate button accordingly', () => {
      render(<RevelationInFleshModal {...makeProps()} />);
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');

      fireEvent.click(checkboxes[0]);
      expect(checkboxes[0]).toBeChecked();
      expect(screen.getByRole('button', { name: /Activate/ })).toBeEnabled();

      fireEvent.click(checkboxes[0]);
      expect(checkboxes[0]).not.toBeChecked();
      expect(screen.getByRole('button', { name: /Activate/ })).toBeDisabled();
    });

    it('allows selecting multiple options simultaneously', () => {
      render(<RevelationInFleshModal {...makeProps()} />);
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');

      fireEvent.click(checkboxes[0]);
      fireEvent.click(checkboxes[2]);
      expect(checkboxes[0]).toBeChecked();
      expect(checkboxes[2]).toBeChecked();
    });
  });

  describe('activation flow', () => {
    it('calls applyRevelationOptions with selected option names', async () => {
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

    it('calls addEntry for each logEntry returned by the handler', async () => {
      const logEntry = { text: 'Charm Person activated' };
      revelationHandler.applyRevelationOptions.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Revelation in Flesh',
          description: 'Charm Person chosen.',
        },
        logEntries: [logEntry],
      });
      render(<RevelationInFleshModal {...makeProps()} />);
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      fireEvent.click(checkboxes[0]);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Activate/ }));
      });
      await waitFor(() => {
        expect(logService.addEntry).toHaveBeenCalledWith(
          baseProps.campaignName,
          logEntry
        );
      });
    });

    it('renders description and skips logging when handler returns no logEntries', async () => {
      revelationHandler.applyRevelationOptions.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Revelation in Flesh',
          description: 'Charm Person chosen.',
        },
      });
      render(<RevelationInFleshModal {...makeProps()} />);
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      fireEvent.click(checkboxes[0]);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Activate/ }));
      });
      await waitFor(() => {
        expect(screen.getByText('Charm Person chosen.')).toBeInTheDocument();
      });
      expect(logService.addEntry).not.toHaveBeenCalled();
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
        expect(screen.queryByText(/Choose bodily alterations/)).not.toBeInTheDocument();
        expect(screen.getByText('My Custom Revelation')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Activate/ })).not.toBeInTheDocument();
      });
    });

    it('renders HTML content from the handler description', async () => {
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
        expect(screen.getByText('ability')).toBeInTheDocument();
      });
    });
  });

  describe('after apply', () => {
    it('calls onClose when Done button is clicked', async () => {
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

  describe('dismissal', () => {
    it('calls onClose when Cancel button is clicked', () => {
      render(<RevelationInFleshModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose when clicking outside the modal overlay', () => {
      render(<RevelationInFleshModal {...makeProps()} />);
      const overlay = document.querySelector('.sp-overlay');
      fireEvent.click(overlay);
      expect(mockOnClose).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });
  });
});
