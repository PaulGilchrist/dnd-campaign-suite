// @maintained-by-ai 2026-11-27
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
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

// featureName omitted so the header/payload fallback to "Shake Out Stupor" is
// exercised by the default-prop tests; the custom-name branch is pinned in the
// shake-success test.
const baseProps = {
  attackerName: 'Wizard1',
  campaignName: 'test-campaign',
  targets: ['Orc Warrior', 'Goblin A', 'Goblin B'],
  rangeFeet: 60,
  onClose: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('HypnoticPatternShakeModal', () => {
  it('renders header, range instructions, one radio per target, and a disabled Shake Free button; an empty target list renders no radios and stays disabled', () => {
    const { unmount } = render(<HypnoticPatternShakeModal {...makeProps()} />);
    expect(screen.getByText('Shake Out Stupor')).toBeInTheDocument();
    expect(screen.getByText(/within 60 feet/)).toBeInTheDocument();
    expect(screen.getByText(/Hypnotic Pattern/)).toBeInTheDocument();
    expect(screen.getByText(/Select a creature/)).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    ['Orc Warrior', 'Goblin A', 'Goblin B'].forEach(name => {
      expect(screen.getByText(name)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Shake Free (none)' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    unmount();

    render(<HypnoticPatternShakeModal {...makeProps({ targets: [] })} />);
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Shake Free (none)' })).toBeDisabled();
  });

  it('enables Shake Free with the selected target name and updates it when selection switches', () => {
    render(<HypnoticPatternShakeModal {...makeProps()} />);
    const radios = screen.getAllByRole('radio');

    fireEvent.click(radios[1]);
    expect(radios[1].checked).toBe(true);
    expect(screen.getByRole('button', { name: 'Shake Free (Goblin A)' })).toBeEnabled();

    fireEvent.click(radios[2]);
    expect(radios[2].checked).toBe(true);
    expect(radios[1].checked).toBe(false);
    expect(screen.getByRole('button', { name: 'Shake Free (Goblin B)' })).toBeEnabled();
  });

  it('closes when Cancel is clicked and never closes on overlay or modal clicks', () => {
    const onClose = vi.fn();
    const { container } = render(<HypnoticPatternShakeModal {...makeProps({ onClose })} />);

    fireEvent.click(container.querySelector('.sp-overlay'));
    fireEvent.click(container.querySelector('.sp-modal'));
    expect(onClose).not.toHaveBeenCalled();
    expect(container.querySelector('.sp-modal')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shakes the selected target free: custom feature name reaches header and payload, logs the ability use, and closes', async () => {
    executeHandler.mockResolvedValue({ success: true });
    const onClose = vi.fn();
    render(<HypnoticPatternShakeModal {...makeProps({ featureName: 'Custom Shake', onClose })} />);

    expect(screen.getByText('Custom Shake')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('radio')[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Shake Free (Orc Warrior)' }));
    await waitFor(() => {
      expect(executeHandler).toHaveBeenCalledWith(
        {
          automation: { type: 'hypnotic_pattern_shake', range: '60 ft' },
          name: 'Custom Shake',
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

  it('replaces the target list and action buttons with a processing message, then closes when the shake resolves', async () => {
    let resolveHandler;
    executeHandler.mockReturnValue(new Promise(resolve => { resolveHandler = resolve; }));
    const onClose = vi.fn();
    render(<HypnoticPatternShakeModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getAllByRole('radio')[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Shake Free (Orc Warrior)' }));

    expect(screen.getByText('Shaking target free...')).toBeInTheDocument();
    expect(screen.queryByText(/Select a creature/)).not.toBeInTheDocument();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /Shake Free/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();

    await act(async () => { await resolveHandler({ success: true }); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('skips the log entry but still closes when the automation returns no result', async () => {
    executeHandler.mockResolvedValue(null);
    const onClose = vi.fn();
    render(<HypnoticPatternShakeModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getAllByRole('radio')[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Shake Free (Orc Warrior)' }));
    await waitFor(() => {
      expect(executeHandler).toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('recovers from a rejected shake automation: closes exactly once, logs no ability use, and surfaces the error', async () => {
    executeHandler.mockRejectedValue(new Error('shake automation boom'));
    const onClose = vi.fn();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      render(<HypnoticPatternShakeModal {...makeProps({ onClose })} />);
      fireEvent.click(screen.getAllByRole('radio')[0]);
      fireEvent.click(screen.getByRole('button', { name: 'Shake Free (Orc Warrior)' }));

      // Processing message shows while the (doomed) automation is in flight.
      expect(screen.getByText('Shaking target free...')).toBeInTheDocument();

      // A rejection must not leave the modal stuck: it closes exactly once.
      // (An escaping rejection would fail this test on its own — no probe needed.)
      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
      });
      expect(screen.queryByText('Shaking target free...')).not.toBeInTheDocument();
      expect(addEntry).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });
});
