// @maintained-by-ai
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
import { addEntry } from '../../../services/ui/logService.js';

const mockOnClose = vi.fn();

const baseAction = {
  name: 'Revelation in Flesh',
  automation: {
    options: [
      { name: 'Charm Person', description: 'Gain the ability to charm others' },
      { name: 'Detect Thoughts', description: 'Read the thoughts of others' },
      { name: 'Elongated Fingers', description: 'Your fingers stretch and become prehensile' },
    ],
    duration: '10_minutes',
  },
};

const baseProps = {
  action: baseAction,
  playerStats: { name: 'Warlock1', level: 5, hitPoints: 30 },
  campaignName: 'test-campaign',
  onClose: mockOnClose,
};

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

function successResult(description, logEntries) {
  return {
    type: 'popup',
    payload: {
      type: 'automation_info',
      name: baseAction.name,
      description,
    },
    logEntries,
  };
}

async function selectAndActivate(...indices) {
  const checkboxes = screen.getAllByRole('checkbox');
  indices.forEach((i) => fireEvent.click(checkboxes[i]));
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Activate/ }));
  });
}

describe('RevelationInFleshModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addEntry.mockResolvedValue(undefined);
    revelationHandler.applyRevelationOptions.mockResolvedValue(
      successResult('Revelation in Flesh: chosen.', [])
    );
  });

  it('renders prompt, every option with its description, a disabled Activate until something is selected, and Cancel', () => {
    const { container } = render(<RevelationInFleshModal {...makeProps()} />);
    expect(screen.getByText('Revelation in Flesh')).toBeInTheDocument();
    expect(screen.getByText(/Choose bodily alterations/)).toBeInTheDocument();
    baseAction.automation.options.forEach((opt) => {
      expect(screen.getByText(opt.name)).toBeInTheDocument();
      expect(screen.getByText(new RegExp(opt.description))).toBeInTheDocument();
    });
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    expect(screen.getByRole('button', { name: /Activate Revelation in Flesh/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(container.querySelector('.sp-overlay')).toBeInTheDocument();
  });

  it('toggles options and enables Activate only while at least one option is selected', () => {
    render(<RevelationInFleshModal {...makeProps()} />);
    const [first] = screen.getAllByRole('checkbox');
    const activate = screen.getByRole('button', { name: /Activate/ });

    fireEvent.click(first);
    expect(first).toBeChecked();
    expect(activate).toBeEnabled();

    fireEvent.click(first);
    expect(first).not.toBeChecked();
    expect(activate).toBeDisabled();
  });

  it('renders a usable modal with no checkboxes when options are absent, and omits missing descriptions', () => {
    const { unmount } = render(
      <RevelationInFleshModal {...makeProps({ action: { name: 'Revelation in Flesh' } })} />
    );
    expect(screen.getByText(/Choose bodily alterations/)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    unmount();

    render(
      <RevelationInFleshModal
        {...makeProps({
          action: {
            name: 'Revelation in Flesh',
            automation: { options: [{ name: 'Without Desc' }] },
          },
        })}
      />
    );
    const nameOnly = screen.getByText('Without Desc');
    expect(nameOnly).toBeInTheDocument();
    expect(nameOnly.closest('label').querySelector('span')).toBeNull();
  });

  it('activates with the selected names, logs each returned logEntry, then swaps the selection UI for an HTML result screen closed by Done', async () => {
    const description = '<p>Charm Person <strong>activated</strong></p>';
    const logEntry = { characterName: 'Warlock1', type: 'ability_use', description: 'Charm Person chosen. (1 SP spent, duration: 10 minutes)' };
    revelationHandler.applyRevelationOptions.mockResolvedValue(
      successResult(description, [logEntry, { ...logEntry, description: 'Detect Thoughts chosen. (1 SP spent, duration: 10 minutes)' }])
    );

    render(<RevelationInFleshModal {...makeProps()} />);
    await selectAndActivate(0, 1);

    expect(revelationHandler.applyRevelationOptions).toHaveBeenCalledWith(
      baseProps.action,
      baseProps.playerStats,
      baseProps.campaignName,
      ['Charm Person', 'Detect Thoughts']
    );
    expect(addEntry).toHaveBeenCalledTimes(2);
    expect(addEntry).toHaveBeenCalledWith(baseProps.campaignName, logEntry);
    expect(addEntry).toHaveBeenCalledWith(
      baseProps.campaignName,
      expect.objectContaining({ description: 'Detect Thoughts chosen. (1 SP spent, duration: 10 minutes)' })
    );

    await waitFor(() => {
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
      expect(screen.queryByText(/Choose bodily alterations/)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    });
    expect(screen.getByText('activated').tagName).toBe('STRONG');
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('shows the handler description without logging when the handler returns no logEntries (e.g. insufficient SP)', async () => {
    revelationHandler.applyRevelationOptions.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: baseAction.name,
        description: 'Revelation in Flesh: Not enough Sorcery Points. Need 2, have 1.',
      },
    });

    render(<RevelationInFleshModal {...makeProps()} />);
    await selectAndActivate(0);

    await waitFor(() => {
      expect(screen.getByText(/Not enough Sorcery Points/)).toBeInTheDocument();
    });
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('still shows the result screen when a campaign log write fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    addEntry.mockRejectedValueOnce(new Error('log write failed'));
    revelationHandler.applyRevelationOptions.mockResolvedValue(
      successResult('One option chosen.', [{ description: 'Charm Person chosen.' }])
    );

    render(<RevelationInFleshModal {...makeProps()} />);
    await selectAndActivate(0);

    await waitFor(() => {
      expect(screen.getByText('One option chosen.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });
    expect(consoleSpy).toHaveBeenCalledWith(
      '[revelationInFleshModal:log-error]',
      expect.any(Error)
    );
    consoleSpy.mockRestore();
  });

  it('closes via Cancel but ignores overlay clicks', () => {
    const { container } = render(<RevelationInFleshModal {...makeProps()} />);

    fireEvent.click(container.querySelector('.sp-overlay'));
    expect(mockOnClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
