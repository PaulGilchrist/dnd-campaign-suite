// @improved-by-ai
// @cleaned-by-ai
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

vi.mock('./Subscriber.jsx', () => {
  function MockSubscriber({ handleEvent }) {
    return (
      <div data-testid="subscriber">
        <button
          data-testid="subscriber-defense-prompt"
          onClick={() =>
            handleEvent({
              key: 'change-test-campaign-TargetOne-biPrompt',
              data: {
                biPrompt: {
                  promptId: 'bi-prompt-defense-1',
                  mode: 'defense',
                  targetName: 'TargetOne',
                  attackerName: 'Goblin',
                  attackRoll: 14,
                  bonus: 3,
                  effectiveAc: 16,
                  dieSize: 6,
                },
              },
            })
          }
        />
        <button
          data-testid="subscriber-offense-prompt"
          onClick={() =>
            handleEvent({
              key: 'change-test-campaign-TargetTwo-biPrompt',
              data: {
                biPrompt: {
                  promptId: 'bi-prompt-offense-1',
                  mode: 'offense',
                  targetName: 'TargetTwo',
                  attackerName: 'TargetTwo',
                  dieSize: 4,
                },
              },
            })
          }
        />
        <button
          data-testid="subscriber-cleared"
          onClick={() =>
            handleEvent({
              key: 'change-test-campaign-TargetOne-biPromptCleared',
              data: { promptId: 'bi-prompt-defense-1' },
            })
          }
        />
        <button
          data-testid="subscriber-second-prompt"
          onClick={() =>
            handleEvent({
              key: 'change-test-campaign-TargetThree-biPrompt',
              data: {
                biPrompt: {
                  promptId: 'bi-prompt-defense-2',
                  mode: 'defense',
                  targetName: 'TargetThree',
                  attackerName: 'Orc',
                  attackRoll: 17,
                  bonus: 5,
                  effectiveAc: 18,
                  dieSize: 8,
                },
              },
            })
          }
        />
      </div>
    );
  }
  return { default: MockSubscriber };
});

// ── EventSource mock (required because component gates Subscriber on EventSource existence) ──

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

function listenForEvent(eventName) {
  const handler = vi.fn();
  window.addEventListener(eventName, handler);
  return {
    handler,
    cleanup: () => window.removeEventListener(eventName, handler),
  };
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

  // ── Rendering ──

  it('renders nothing when there are no prompts', () => {
    renderModal();
    expect(document.querySelector('.sp-overlay')).not.toBeInTheDocument();
  });

  // ── Defense prompt rendering ──

  it('renders defense modal with correct content when a defense prompt is queued', async () => {
    renderModal();

    fireEvent.click(screen.getByTestId('subscriber-defense-prompt'));

    await waitFor(() => {
      expect(screen.getByText(/Combat Inspiration - Defense/)).toBeInTheDocument();
    });

    expect(screen.getByText('TargetOne')).toBeInTheDocument();
    expect(screen.getByText('Goblin')).toBeInTheDocument();
    expect(screen.getByText(/roll your Bardic Inspiration die \(d6\) and add to your AC/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Use Reaction & Roll/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
  });

  it('renders offense modal with correct content when an offense prompt is queued', async () => {
    renderModal();

    fireEvent.click(screen.getByTestId('subscriber-offense-prompt'));

    await waitFor(() => {
      expect(screen.getByText(/Combat Inspiration - Offense/)).toBeInTheDocument();
    });

    expect(screen.getByText(/hit/i)).toBeInTheDocument();
    expect(screen.getByText(/roll your Bardic Inspiration die \(d4\) and add to the damage/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Use Reaction & Roll/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
  });

  // ── Use Reaction - Defense ──

  it('rolls the die and dispatches defense-result event when using reaction on defense', async () => {
    rollExpression.mockReturnValue({ total: 4 });
    renderModal();

    fireEvent.click(screen.getByTestId('subscriber-defense-prompt'));

    await waitFor(() => {
      expect(screen.getByText(/Combat Inspiration - Defense/)).toBeInTheDocument();
    });

    const { handler, cleanup } = listenForEvent('bardic-inspiration-defense-result');

    fireEvent.click(screen.getByRole('button', { name: /Use Reaction & Roll/ }));

    await waitFor(() => {
      expect(handler).toHaveBeenCalled();
    });

    const detail = handler.mock.calls[0][0].detail;
    expect(detail.promptId).toBe('bi-prompt-defense-1');
    expect(detail.used).toBe(true);
    expect(detail.biRoll).toBe(4);
    expect(clearBardicInspirationPrompt).toHaveBeenCalledWith('test-campaign', 'TargetOne');
    expect(clearBardicInspiration).toHaveBeenCalledWith('TargetOne', 'test-campaign');

    cleanup();
  });

  // ── Use Reaction - Offense ──

  it('rolls the die and dispatches offense-result event when using reaction on offense', async () => {
    rollExpression.mockReturnValue({ total: 3 });
    renderModal();

    fireEvent.click(screen.getByTestId('subscriber-offense-prompt'));

    await waitFor(() => {
      expect(screen.getByText(/Combat Inspiration - Offense/)).toBeInTheDocument();
    });

    const { handler, cleanup } = listenForEvent('bardic-inspiration-offense-result');

    fireEvent.click(screen.getByRole('button', { name: /Use Reaction & Roll/ }));

    await waitFor(() => {
      expect(handler).toHaveBeenCalled();
    });

    const detail = handler.mock.calls[0][0].detail;
    expect(detail.promptId).toBe('bi-prompt-offense-1');
    expect(detail.used).toBe(true);
    expect(detail.biRoll).toBe(3);
    expect(clearBardicInspirationPrompt).toHaveBeenCalledWith('test-campaign', 'TargetTwo');
    expect(clearBardicInspiration).toHaveBeenCalledWith('TargetTwo', 'test-campaign');

    cleanup();
  });

  // ── Skip ──

  it('dispatches defense-result with used:false when skipping defense prompt', async () => {
    renderModal();

    fireEvent.click(screen.getByTestId('subscriber-defense-prompt'));

    await waitFor(() => {
      expect(screen.getByText(/Combat Inspiration - Defense/)).toBeInTheDocument();
    });

    const { handler, cleanup } = listenForEvent('bardic-inspiration-defense-result');

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

    await waitFor(() => {
      expect(handler).toHaveBeenCalled();
    });

    const detail = handler.mock.calls[0][0].detail;
    expect(detail.promptId).toBe('bi-prompt-defense-1');
    expect(detail.used).toBe(false);
    expect(clearBardicInspirationPrompt).toHaveBeenCalledWith('test-campaign', 'TargetOne');
    expect(clearBardicInspiration).not.toHaveBeenCalled();

    cleanup();
  });

  // ── Overlay click is inert ──

  it('does not clear or advance the prompt when the overlay is clicked', async () => {
    renderModal();

    fireEvent.click(screen.getByTestId('subscriber-defense-prompt'));

    await waitFor(() => {
      expect(screen.getByText(/Combat Inspiration - Defense/)).toBeInTheDocument();
    });

    const overlay = document.querySelector('.sp-overlay');
    fireEvent.click(overlay);

    expect(clearBardicInspirationPrompt).not.toHaveBeenCalled();
    expect(screen.getByText(/Combat Inspiration - Defense/)).toBeInTheDocument();
  });

  it('does not clear bardicInspiration state on overlay click (only on useReaction)', async () => {
    renderModal();

    fireEvent.click(screen.getByTestId('subscriber-defense-prompt'));

    await waitFor(() => {
      expect(screen.getByText(/Combat Inspiration - Defense/)).toBeInTheDocument();
    });

    const overlay = document.querySelector('.sp-overlay');
    fireEvent.click(overlay);

    expect(clearBardicInspiration).not.toHaveBeenCalled();
    expect(screen.getByText(/Combat Inspiration - Defense/)).toBeInTheDocument();
  });

  // ── Queue advancement ──

  it('advances to second prompt after dismissing the first', async () => {
    renderModal();

    fireEvent.click(screen.getByTestId('subscriber-defense-prompt'));

    await waitFor(() => {
      expect(screen.getByText(/Combat Inspiration - Defense/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

    await waitFor(() => {
      expect(screen.queryByText(/Combat Inspiration - Defense/)).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('subscriber-second-prompt'));

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

    fireEvent.click(screen.getByTestId('subscriber-defense-prompt'));

    await waitFor(() => {
      expect(screen.getByText(/Combat Inspiration - Defense/)).toBeInTheDocument();
    });

    // Click same trigger again — should be ignored
    fireEvent.click(screen.getByTestId('subscriber-defense-prompt'));

    expect(screen.getByText('TargetOne')).toBeInTheDocument();
    expect(screen.queryByText('TargetThree')).not.toBeInTheDocument();
  });

  // ── Clear event ──

  it('removes prompt when biPromptCleared event is received', async () => {
    renderModal();

    fireEvent.click(screen.getByTestId('subscriber-defense-prompt'));

    await waitFor(() => {
      expect(screen.getByText(/Combat Inspiration - Defense/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('subscriber-cleared'));

    await waitFor(() => {
      expect(screen.queryByText(/Combat Inspiration - Defense/)).not.toBeInTheDocument();
    });
  });

  // ── Die roll handling ──

  it('defaults biRoll to 0 when rollExpression returns null or object without total', async () => {
    rollExpression.mockReturnValue(null);
    renderModal();

    fireEvent.click(screen.getByTestId('subscriber-defense-prompt'));

    await waitFor(() => {
      expect(screen.getByText(/Combat Inspiration - Defense/)).toBeInTheDocument();
    });

    const { handler, cleanup } = listenForEvent('bardic-inspiration-defense-result');

    fireEvent.click(screen.getByRole('button', { name: /Use Reaction & Roll/ }));

    await waitFor(() => {
      expect(handler).toHaveBeenCalled();
    });

    expect(handler.mock.calls[0][0].detail.biRoll).toBe(0);

    cleanup();
  });
});
