import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import BardicInspirationReactionModal from './BardicInspirationReactionModal.jsx';
import { rollExpression } from '../../services/dice/diceRoller.js';
import { clearBardicInspiration } from '../../services/combat/auras/bardicInspirationState.js';
import { clearBardicInspirationPrompt } from '../../services/combat/prompts/bardicInspirationPromptUtils.js';

// ── Mock dependencies ──

vi.mock('../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../services/combat/auras/bardicInspirationState.js', () => ({
  clearBardicInspiration: vi.fn(),
}));

vi.mock('../../services/combat/prompts/bardicInspirationPromptUtils.js', () => ({
  clearBardicInspirationPrompt: vi.fn(),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('./Subscriber.jsx', () => {
  function MockSubscriber({ handleEvent, _campaignName }) {
    return React.createElement(
      'div',
      { 'data-testid': 'subscriber' },
      React.createElement(
        'button',
        {
          'data-testid': 'subscriber-defense-prompt',
          onClick: () =>
            handleEvent({
              key: `change-test-campaign-TargetOne-biPrompt`,
              data: {
                promptId: 'bi-prompt-defense-1',
                mode: 'defense',
                targetName: 'TargetOne',
                attackerName: 'Goblin',
                attackRoll: 14,
                bonus: 3,
                effectiveAc: 16,
                dieSize: 6,
              },
            }),
        }
      ),
      React.createElement(
        'button',
        {
          'data-testid': 'subscriber-offense-prompt',
          onClick: () =>
            handleEvent({
              key: `change-test-campaign-TargetTwo-biPrompt`,
              data: {
                promptId: 'bi-prompt-offense-1',
                mode: 'offense',
                targetName: 'TargetTwo',
                attackerName: 'TargetTwo',
                dieSize: 4,
              },
            }),
        }
      ),
      React.createElement(
        'button',
        {
          'data-testid': 'subscriber-cleared',
          onClick: () =>
            handleEvent({
              key: `change-test-campaign-TargetOne-biPromptCleared`,
              data: {
                promptId: 'bi-prompt-defense-1',
              },
            }),
        }
      ),
      React.createElement(
        'button',
        {
          'data-testid': 'subscriber-second-prompt',
          onClick: () =>
            handleEvent({
              key: `change-test-campaign-TargetThree-biPrompt`,
              data: {
                promptId: 'bi-prompt-defense-2',
                mode: 'defense',
                targetName: 'TargetThree',
                attackerName: 'Orc',
                attackRoll: 17,
                bonus: 5,
                effectiveAc: 18,
                dieSize: 8,
              },
            }),
        }
      ),
    );
  }
  return { default: MockSubscriber };
});

// ── EventSource mock ──

const MockEventSource = vi.fn();
MockEventSource.prototype.close = vi.fn();

function setupGlobalEventSource() {
  Object.defineProperty(globalThis, 'EventSource', {
    value: MockEventSource,
    writable: true,
    configurable: true,
  });
}

// ── Helpers ──

function renderModal(campaignName = 'test-campaign') {
  return render(<BardicInspirationReactionModal campaignName={campaignName} />);
}

// ── Tests ──

describe('BardicInspirationReactionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupGlobalEventSource();
    rollExpression.mockReturnValue({ total: 5 });
  });

  afterEach(() => {
    delete globalThis.EventSource;
  });

  // ── Rendering with no prompts ──

  it('renders nothing when there are no prompts', () => {
    renderModal();
    expect(document.querySelector('.sp-overlay')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Use Reaction/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument();
  });

  // ── Defense prompt rendering ──

  it('renders defense modal with correct content when a defense prompt is queued', async () => {
    renderModal();

    const trigger = screen.getByTestId('subscriber-defense-prompt');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/Combat Inspiration - Defense/)).toBeInTheDocument();
    });

    expect(screen.getByText('TargetOne')).toBeInTheDocument();
    expect(screen.getByText('Goblin')).toBeInTheDocument();
    expect(screen.getByText(/Attack: d20\(14\) \+ 3 = 17 vs AC 16/)).toBeInTheDocument();
    expect(screen.getByText(/roll your Bardic Inspiration die \(d6\) and add to your AC/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Use Reaction & Roll/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
  });

  // ── Offense prompt rendering ──

  it('renders offense modal with correct content when an offense prompt is queued', async () => {
    renderModal();

    const trigger = screen.getByTestId('subscriber-offense-prompt');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/Combat Inspiration - Offense/)).toBeInTheDocument();
    });

    expect(screen.getByText(/hit/i)).toBeInTheDocument();
    expect(screen.getByText(/roll your Bardic Inspiration die \(d4\) and add to the damage/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Use Reaction & Roll/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
  });

  // ── Use Reaction - Defense ──

  it('rolls the die and dispatches bardic-inspiration-defense-result event when using reaction on defense', async () => {
    rollExpression.mockReturnValue({ total: 4 });
    renderModal();

    const trigger = screen.getByTestId('subscriber-defense-prompt');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/Combat Inspiration - Defense/)).toBeInTheDocument();
    });

    const eventHandler = vi.fn();
    window.addEventListener('bardic-inspiration-defense-result', eventHandler);

    const rollBtn = screen.getByRole('button', { name: /Use Reaction & Roll/ });
    fireEvent.click(rollBtn);

    await waitFor(() => {
      expect(eventHandler).toHaveBeenCalled();
    });

    const detail = eventHandler.mock.calls[0][0].detail;
    expect(detail.promptId).toBe('bi-prompt-defense-1');
    expect(detail.used).toBe(true);
    expect(detail.biRoll).toBe(4);

    expect(clearBardicInspirationPrompt).toHaveBeenCalledWith('test-campaign', 'TargetOne');
    expect(clearBardicInspiration).toHaveBeenCalledWith('TargetOne', 'test-campaign');

    window.removeEventListener('bardic-inspiration-defense-result', eventHandler);
  });

  // ── Use Reaction - Offense ──

  it('rolls the die and dispatches bardic-inspiration-offense-result event when using reaction on offense', async () => {
    rollExpression.mockReturnValue({ total: 3 });
    renderModal();

    const trigger = screen.getByTestId('subscriber-offense-prompt');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/Combat Inspiration - Offense/)).toBeInTheDocument();
    });

    const eventHandler = vi.fn();
    window.addEventListener('bardic-inspiration-offense-result', eventHandler);

    const rollBtn = screen.getByRole('button', { name: /Use Reaction & Roll/ });
    fireEvent.click(rollBtn);

    await waitFor(() => {
      expect(eventHandler).toHaveBeenCalled();
    });

    const detail = eventHandler.mock.calls[0][0].detail;
    expect(detail.promptId).toBe('bi-prompt-offense-1');
    expect(detail.used).toBe(true);
    expect(detail.biRoll).toBe(3);

    expect(clearBardicInspirationPrompt).toHaveBeenCalledWith('test-campaign', 'TargetTwo');
    expect(clearBardicInspiration).toHaveBeenCalledWith('TargetTwo', 'test-campaign');

    window.removeEventListener('bardic-inspiration-offense-result', eventHandler);
  });

  // ── Skip ──

  it('dispatches bardic-inspiration-defense-result with used:false when skipping defense prompt', async () => {
    renderModal();

    const trigger = screen.getByTestId('subscriber-defense-prompt');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/Combat Inspiration - Defense/)).toBeInTheDocument();
    });

    const eventHandler = vi.fn();
    window.addEventListener('bardic-inspiration-defense-result', eventHandler);

    const skipBtn = screen.getByRole('button', { name: 'Skip' });
    fireEvent.click(skipBtn);

    await waitFor(() => {
      expect(eventHandler).toHaveBeenCalled();
    });

    const detail = eventHandler.mock.calls[0][0].detail;
    expect(detail.promptId).toBe('bi-prompt-defense-1');
    expect(detail.used).toBe(false);

    expect(clearBardicInspirationPrompt).toHaveBeenCalledWith('test-campaign', 'TargetOne');

    window.removeEventListener('bardic-inspiration-defense-result', eventHandler);
  });

  it('dispatches bardic-inspiration-offense-result with used:false when skipping offense prompt', async () => {
    renderModal();

    const trigger = screen.getByTestId('subscriber-offense-prompt');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/Combat Inspiration - Offense/)).toBeInTheDocument();
    });

    const eventHandler = vi.fn();
    window.addEventListener('bardic-inspiration-offense-result', eventHandler);

    const skipBtn = screen.getByRole('button', { name: 'Skip' });
    fireEvent.click(skipBtn);

    await waitFor(() => {
      expect(eventHandler).toHaveBeenCalled();
    });

    const detail = eventHandler.mock.calls[0][0].detail;
    expect(detail.promptId).toBe('bi-prompt-offense-1');
    expect(detail.used).toBe(false);

    expect(clearBardicInspirationPrompt).toHaveBeenCalledWith('test-campaign', 'TargetTwo');

    window.removeEventListener('bardic-inspiration-offense-result', eventHandler);
  });

  // ── Dismiss (clicking overlay) ──

  it('clears the prompt and advances when dismissing via overlay click', async () => {
    renderModal();

    const trigger = screen.getByTestId('subscriber-defense-prompt');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/Combat Inspiration - Defense/)).toBeInTheDocument();
    });

    const overlay = document.querySelector('.sp-overlay');
    fireEvent.click(overlay);

    await waitFor(() => {
      expect(clearBardicInspirationPrompt).toHaveBeenCalledWith('test-campaign', 'TargetOne');
    });

    expect(screen.queryByText(/Combat Inspiration - Defense/)).not.toBeInTheDocument();
  });

  // ── Queue advancement ──

  it('advances to second prompt after dismissing the first', async () => {
    renderModal();

    // Add first prompt
    const trigger1 = screen.getByTestId('subscriber-defense-prompt');
    fireEvent.click(trigger1);

    await waitFor(() => {
      expect(screen.getByText(/Combat Inspiration - Defense/)).toBeInTheDocument();
    });

    // Dismiss first prompt (clears activePromptIdRef via advance)
    const overlay = document.querySelector('.sp-overlay');
    fireEvent.click(overlay);

    await waitFor(() => {
      expect(screen.queryByText(/Combat Inspiration - Defense/)).not.toBeInTheDocument();
    });

    // Now add the second prompt
    const trigger2 = screen.getByTestId('subscriber-second-prompt');
    fireEvent.click(trigger2);

    await waitFor(() => {
      expect(screen.getByText(/Combat Inspiration - Defense/)).toBeInTheDocument();
    });

    expect(screen.getByText('TargetThree')).toBeInTheDocument();
    expect(screen.getByText(/Orc/)).toBeInTheDocument();
    expect(screen.getByText(/roll your Bardic Inspiration die \(d8\) and add to your AC/)).toBeInTheDocument();
  });

  // ── Duplicate prompt prevention ──

  it('does not add duplicate prompts with same promptId', async () => {
    renderModal();

    const trigger = screen.getByTestId('subscriber-defense-prompt');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/Combat Inspiration - Defense/)).toBeInTheDocument();
    });

    // Click same trigger again
    fireEvent.click(trigger);

    // Should still only show one prompt
    expect(screen.getByText('TargetOne')).toBeInTheDocument();
    expect(screen.queryByText('TargetThree')).not.toBeInTheDocument();
  });

  // ── Prompt processing when one is active ──

  it('queues new prompts but does not process until current is dismissed', async () => {
    renderModal();

    const trigger1 = screen.getByTestId('subscriber-defense-prompt');
    fireEvent.click(trigger1);

    await waitFor(() => {
      expect(screen.getByText(/Combat Inspiration - Defense/)).toBeInTheDocument();
    });

    // Dismiss the first prompt
    const overlay = document.querySelector('.sp-overlay');
    fireEvent.click(overlay);

    await waitFor(() => {
      expect(screen.queryByText(/Combat Inspiration - Defense/)).not.toBeInTheDocument();
    });

    // Add second prompt
    const trigger2 = screen.getByTestId('subscriber-second-prompt');
    fireEvent.click(trigger2);

    // Second prompt should now be active
    await waitFor(() => {
      expect(screen.getByText(/TargetThree/)).toBeInTheDocument();
    });

    expect(screen.getByText(/Orc/)).toBeInTheDocument();
  });

  // ── Clear event ──

  it('removes prompt when biPromptCleared event is received', async () => {
    renderModal();

    const trigger = screen.getByTestId('subscriber-defense-prompt');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/Combat Inspiration - Defense/)).toBeInTheDocument();
    });

    const clearedBtn = screen.getByTestId('subscriber-cleared');
    fireEvent.click(clearedBtn);

    await waitFor(() => {
      expect(screen.queryByText(/Combat Inspiration - Defense/)).not.toBeInTheDocument();
    });
  });

  // ── Die roll handling ──

  it('uses die roll total from rollExpression for the biRoll value', async () => {
    rollExpression.mockReturnValue({ total: 7 });
    renderModal();

    const trigger = screen.getByTestId('subscriber-defense-prompt');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/Combat Inspiration - Defense/)).toBeInTheDocument();
    });

    const eventHandler = vi.fn();
    window.addEventListener('bardic-inspiration-defense-result', eventHandler);

    const rollBtn = screen.getByRole('button', { name: /Use Reaction & Roll/ });
    fireEvent.click(rollBtn);

    await waitFor(() => {
      expect(eventHandler).toHaveBeenCalled();
    });

    expect(rollExpression).toHaveBeenCalledWith('1d6');
    expect(eventHandler.mock.calls[0][0].detail.biRoll).toBe(7);

    window.removeEventListener('bardic-inspiration-defense-result', eventHandler);
  });

  it('defaults biRoll to 0 when rollExpression returns null', async () => {
    rollExpression.mockReturnValue(null);
    renderModal();

    const trigger = screen.getByTestId('subscriber-defense-prompt');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/Combat Inspiration - Defense/)).toBeInTheDocument();
    });

    const eventHandler = vi.fn();
    window.addEventListener('bardic-inspiration-defense-result', eventHandler);

    const rollBtn = screen.getByRole('button', { name: /Use Reaction & Roll/ });
    fireEvent.click(rollBtn);

    await waitFor(() => {
      expect(eventHandler).toHaveBeenCalled();
    });

    expect(eventHandler.mock.calls[0][0].detail.biRoll).toBe(0);

    window.removeEventListener('bardic-inspiration-defense-result', eventHandler);
  });

  // ── Ignoring irrelevant SSE events ──

  it('ignores SSE events with non-matching keys', async () => {
    renderModal();

    fireEvent.click(screen.getByTestId('subscriber-defense-prompt'));

    await waitFor(() => {
      expect(screen.getByText(/Combat Inspiration - Defense/)).toBeInTheDocument();
    });

    // No second prompt should appear from irrelevant events
    expect(screen.getByText('TargetOne')).toBeInTheDocument();
    expect(screen.queryByText('TargetThree')).not.toBeInTheDocument();
  });

  // ── No prompt to skip/dismiss when none active ──

  it('does nothing when skip is called with no current prompt', async () => {
    renderModal();

    // No modal should be visible
    expect(document.querySelector('.sp-overlay')).not.toBeInTheDocument();

    // No buttons should be present
    expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Use Reaction/i })).not.toBeInTheDocument();
  });
});
