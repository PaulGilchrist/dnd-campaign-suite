// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import DeathSavePromptModal from './DeathSavePromptModal.jsx';
import { sendDeathSaveResult, clearDeathSavePrompt } from '../../services/combat/conditions/savePromptService.js';
import * as deathSaveRules from '../../services/combat/conditions/deathSaveRules.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

// ── Mock dependencies ──

vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
  sendDeathSaveResult: vi.fn(),
  clearDeathSavePrompt: vi.fn(),
}));

vi.mock('../../services/combat/conditions/deathSaveRules.js', () => ({
  rollDeathSave: vi.fn(),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('./Subscriber.jsx', () => {
  function MockSubscriber({ handleEvent, campaignName }) {
    return React.createElement(
      'div',
      { 'data-testid': 'subscriber-wrapper' },
      React.createElement('button', {
        'data-testid': 'trigger-prompt-1',
        onClick: () =>
          handleEvent({
            key: `change-${campaignName}-deathSavePrompt-target1`,
            data: { promptId: 'prompt-1', targetName: 'target1' },
          }),
      }, 'Trigger Prompt 1'),
      React.createElement('button', {
        'data-testid': 'trigger-prompt-2',
        onClick: () =>
          handleEvent({
            key: `change-${campaignName}-deathSavePrompt-target2`,
            data: { promptId: 'prompt-2', targetName: 'target2' },
          }),
      }, 'Trigger Prompt 2'),
      React.createElement('button', {
        'data-testid': 'trigger-prompt-3',
        onClick: () =>
          handleEvent({
            key: `change-${campaignName}-deathSavePrompt-target3`,
            data: { promptId: 'prompt-3', targetName: 'target3' },
          }),
      }, 'Trigger Prompt 3'),
    );
  }
  return { default: MockSubscriber };
});

// ── Helpers ──

function setupEventSource() {
  const MockEventSource = vi.fn();
  MockEventSource.prototype.close = vi.fn();
  Object.defineProperty(globalThis, 'EventSource', {
    value: MockEventSource,
    writable: true,
    configurable: true,
  });
}

function defaultRollResult(overrides = {}) {
  return {
    roll: 15,
    isNat20: false,
    isNat1: false,
    result: 'success',
    newSaves: [true, false, false],
    newFailures: [false, false, false],
    restoredToHp: null,
    ...overrides,
  };
}

function waitForPromptVisible() {
  return waitFor(() => {
    expect(screen.getByText(/must make a/i)).toBeInTheDocument();
  });
}

function waitForResultVisible() {
  return waitFor(() => {
    expect(screen.getByText(/Roll:/i)).toBeInTheDocument();
  });
}

// ── Defaults ──

beforeEach(() => {
  vi.clearAllMocks();
  setupEventSource();
  deathSaveRules.rollDeathSave.mockReturnValue(defaultRollResult());
  getRuntimeValue.mockReturnValue(null);
});

// ── Tests ──

describe('DeathSavePromptModal', () => {
  // ── Rendering ──

  it('renders nothing when there are no prompts', () => {
    render(<DeathSavePromptModal campaignName="test-campaign" />);
    expect(document.querySelector('.dsp-overlay')).not.toBeInTheDocument();
  });

  // ── Prompt queuing ──

  it('shows modal with target name and roll button when a prompt arrives', async () => {
    render(<DeathSavePromptModal campaignName="test-campaign" />);
    fireEvent.click(screen.getByTestId('trigger-prompt-1'));
    await waitForPromptVisible();
    expect(screen.getByText('target1')).toBeInTheDocument();
    expect(document.querySelector('.dsp-header')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Roll Death Save' })).toBeInTheDocument();
  });

  it('prevents advancing when clicking inside the modal body', async () => {
    render(<DeathSavePromptModal campaignName="test-campaign" />);
    fireEvent.click(screen.getByTestId('trigger-prompt-1'));
    await waitForPromptVisible();
    const modal = document.querySelector('.dsp-modal');
    if (modal) fireEvent.click(modal);
    // Modal should still be visible — clicking inside does NOT dismiss it
    expect(screen.getByText(/must make a/i)).toBeInTheDocument();
  });

  // ── Queue count ──

  it('does not show queue count for a single prompt', async () => {
    render(<DeathSavePromptModal campaignName="test-campaign" />);
    fireEvent.click(screen.getByTestId('trigger-prompt-1'));
    await waitForPromptVisible();
    expect(screen.queryByText(/\(1 of/)).not.toBeInTheDocument();
  });

  it('shows queue count "(1 of 2)" when two prompts are queued', async () => {
    render(<DeathSavePromptModal campaignName="test-campaign" />);
    fireEvent.click(screen.getByTestId('trigger-prompt-1'));
    await waitForPromptVisible();
    fireEvent.click(screen.getByTestId('trigger-prompt-2'));
    await waitFor(() => {
      expect(screen.getByText(/\(1 of 2\)/)).toBeInTheDocument();
    });
  });

  it('updates queue count when advancing through multiple prompts', async () => {
    render(<DeathSavePromptModal campaignName="test-campaign" />);
    fireEvent.click(screen.getByTestId('trigger-prompt-1'));
    fireEvent.click(screen.getByTestId('trigger-prompt-2'));
    fireEvent.click(screen.getByTestId('trigger-prompt-3'));
    await waitFor(() => {
      expect(screen.getByText(/\(1 of 3\)/)).toBeInTheDocument();
    });
    // Roll, then advance via the Next button
    fireEvent.click(screen.getByRole('button', { name: 'Roll Death Save' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => {
      expect(screen.getByText(/\(1 of 2\)/)).toBeInTheDocument();
    });
  });

  it('prevents duplicate prompts with the same promptId', async () => {
    render(<DeathSavePromptModal campaignName="test-campaign" />);
    fireEvent.click(screen.getByTestId('trigger-prompt-1'));
    await waitForPromptVisible();
    // Trigger the same prompt again
    fireEvent.click(screen.getByTestId('trigger-prompt-1'));
    await waitForPromptVisible();
    // Should still show no queue count (only 1 unique prompt)
    expect(screen.queryByText(/\(2 of/)).not.toBeInTheDocument();
  });

  // ── Roll death save — basic behavior ──

  it('displays success result text after rolling', async () => {
    render(<DeathSavePromptModal campaignName="test-campaign" />);
    fireEvent.click(screen.getByTestId('trigger-prompt-1'));
    await waitForPromptVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Roll Death Save' }));
    await waitForResultVisible();
    expect(screen.getByText('DEATH SAVE SUCCESS')).toBeInTheDocument();
  });

  it('dispatches death-save-result custom event with correct detail after rolling', async () => {
    const eventHandler = vi.fn();
    window.addEventListener('death-save-result', eventHandler);
    render(<DeathSavePromptModal campaignName="test-campaign" />);
    fireEvent.click(screen.getByTestId('trigger-prompt-1'));
    await waitForPromptVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Roll Death Save' }));
    await waitForResultVisible();
    expect(eventHandler).toHaveBeenCalledOnce();
    const detail = eventHandler.mock.calls[0][0].detail;
    expect(detail).toMatchObject({
      promptId: 'prompt-1',
      targetName: 'target1',
      roll: 15,
      isNat20: false,
      isNat1: false,
      success: true,
      result: 'success',
      newSaves: [true, false, false],
      newFailures: [false, false, false],
      restoredToHp: null,
    });
    window.removeEventListener('death-save-result', eventHandler);
  });

  it('calls sendDeathSaveResult with full payload when rolling', async () => {
    render(<DeathSavePromptModal campaignName="test-campaign" />);
    fireEvent.click(screen.getByTestId('trigger-prompt-1'));
    await waitForPromptVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Roll Death Save' }));
    await waitForResultVisible();
    expect(sendDeathSaveResult).toHaveBeenCalledWith('test-campaign', 'target1', {
      promptId: 'prompt-1',
      roll: 15,
      isNat20: false,
      isNat1: false,
      success: true,
      result: 'success',
      newSaves: [true, false, false],
      newFailures: [false, false, false],
      restoredToHp: null,
    });
  });

  it('calls clearDeathSavePrompt when rolling', async () => {
    render(<DeathSavePromptModal campaignName="test-campaign" />);
    fireEvent.click(screen.getByTestId('trigger-prompt-1'));
    await waitForPromptVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Roll Death Save' }));
    await waitForResultVisible();
    expect(clearDeathSavePrompt).toHaveBeenCalledWith('test-campaign', 'target1');
  });

  it('updates runtime state for deathSaves and deathFailures after rolling', async () => {
    render(<DeathSavePromptModal campaignName="test-campaign" />);
    fireEvent.click(screen.getByTestId('trigger-prompt-1'));
    await waitForPromptVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Roll Death Save' }));
    await waitForResultVisible();
    expect(setRuntimeValue).toHaveBeenCalledWith('target1', 'deathSaves', [true, false, false], 'test-campaign');
    expect(setRuntimeValue).toHaveBeenCalledWith('target1', 'deathFailures', [false, false, false], 'test-campaign');
  });

  it('sets isDead in runtime state when the roll results in death', async () => {
    deathSaveRules.rollDeathSave.mockReturnValue(defaultRollResult({
      roll: 3,
      result: 'dead',
      newSaves: [false, false, false],
      newFailures: [true, true, true],
    }));
    render(<DeathSavePromptModal campaignName="test-campaign" />);
    fireEvent.click(screen.getByTestId('trigger-prompt-1'));
    await waitForPromptVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Roll Death Save' }));
    await waitForResultVisible();
    expect(setRuntimeValue).toHaveBeenCalledWith('target1', 'isDead', 1, 'test-campaign');
  });

  it('reads saved death saves from runtime state before rolling', async () => {
    getRuntimeValue.mockImplementation((targetName, prop) => {
      if (targetName === 'target1' && prop === 'deathSaves') return [true, false, false];
      if (targetName === 'target1' && prop === 'deathFailures') return [false, true, false];
      return null;
    });
    render(<DeathSavePromptModal campaignName="test-campaign" />);
    fireEvent.click(screen.getByTestId('trigger-prompt-1'));
    await waitForPromptVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Roll Death Save' }));
    await waitForResultVisible();
    expect(deathSaveRules.rollDeathSave).toHaveBeenCalledWith(
      [true, false, false],
      [false, true, false],
    );
  });

  // ── Button states & advancement ──

  it('shows Roll button before rolling, Done after rolling with single prompt', async () => {
    render(<DeathSavePromptModal campaignName="test-campaign" />);
    fireEvent.click(screen.getByTestId('trigger-prompt-1'));
    await waitForPromptVisible();
    expect(screen.getByRole('button', { name: 'Roll Death Save' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Roll Death Save' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Roll Death Save' })).not.toBeInTheDocument();
    });
  });

  it('shows Next button when multiple prompts are queued', async () => {
    render(<DeathSavePromptModal campaignName="test-campaign" />);
    fireEvent.click(screen.getByTestId('trigger-prompt-1'));
    fireEvent.click(screen.getByTestId('trigger-prompt-2'));
    await waitFor(() => {
      expect(screen.getByText(/\(1 of 2\)/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Roll Death Save' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
    });
  });

  it('advances to next prompt when Next button is clicked', async () => {
    render(<DeathSavePromptModal campaignName="test-campaign" />);
    fireEvent.click(screen.getByTestId('trigger-prompt-1'));
    fireEvent.click(screen.getByTestId('trigger-prompt-2'));
    await waitFor(() => {
      expect(screen.getByText(/\(1 of 2\)/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Roll Death Save' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => {
      expect(screen.getByText('target2')).toBeInTheDocument();
      expect(screen.queryByText(/\(1 of/)).not.toBeInTheDocument();
    });
  });

  it('does not advance when the overlay is clicked', async () => {
    render(<DeathSavePromptModal campaignName="test-campaign" />);
    fireEvent.click(screen.getByTestId('trigger-prompt-1'));
    await waitForPromptVisible();
    fireEvent.click(screen.getByTestId('trigger-prompt-2'));
    await waitFor(() => {
      expect(screen.getByText(/\(1 of 2\)/)).toBeInTheDocument();
    });
    const overlay = document.querySelector('.dsp-overlay');
    if (overlay) fireEvent.click(overlay);
    expect(screen.getByText(/\(1 of 2\)/)).toBeInTheDocument();
    expect(screen.getByText('target1')).toBeInTheDocument();
  });

  it('keeps the modal open when the overlay is clicked with a single prompt', async () => {
    render(<DeathSavePromptModal campaignName="test-campaign" />);
    fireEvent.click(screen.getByTestId('trigger-prompt-1'));
    await waitForPromptVisible();
    const overlay = document.querySelector('.dsp-overlay');
    if (overlay) fireEvent.click(overlay);
    expect(screen.getByText(/must make a/i)).toBeInTheDocument();
  });

  // ── Roll result variants ──

  describe('roll result variants', () => {
    const testCases = [
      {
        name: 'natural 20',
        overrides: { roll: 20, isNat20: true, result: 'nat20', restoredToHp: 1 },
        expectedLabel: /NATURAL 20 — STABILIZED!/i,
        showsHp: true,
      },
      {
        name: 'natural 1',
        overrides: { roll: 1, isNat1: true, result: 'failure', newFailures: [true, true, false] },
        expectedLabel: /NATURAL 1 — DOUBLE FAILURE/i,
        showsHp: false,
      },
      {
        name: 'stable',
        overrides: { roll: 15, result: 'stable' },
        expectedLabel: /STABILIZED!/i,
        showsHp: false,
      },
      {
        name: 'dead',
        overrides: { roll: 5, result: 'dead', newSaves: [false, false, false], newFailures: [false, false, false] },
        expectedLabel: /DEAD/,
        showsHp: false,
      },
      {
        name: 'failure',
        overrides: { roll: 5, result: 'failure', newFailures: [true, false, false] },
        expectedLabel: /DEATH SAVE FAILURE/,
        showsHp: false,
      },
    ];

    for (const tc of testCases) {
      it(`displays correct result label for ${tc.name}`, async () => {
        deathSaveRules.rollDeathSave.mockReturnValue(defaultRollResult(tc.overrides));
        render(<DeathSavePromptModal campaignName="test-campaign" />);
        fireEvent.click(screen.getByTestId('trigger-prompt-1'));
        await waitForPromptVisible();
        fireEvent.click(screen.getByRole('button', { name: 'Roll Death Save' }));
        await waitForResultVisible();
        expect(screen.getByText(tc.expectedLabel)).toBeInTheDocument();
      });

      it(`shows HP restoration text for ${tc.name} when applicable`, async () => {
        deathSaveRules.rollDeathSave.mockReturnValue(defaultRollResult(tc.overrides));
        render(<DeathSavePromptModal campaignName="test-campaign" />);
        fireEvent.click(screen.getByTestId('trigger-prompt-1'));
        await waitForPromptVisible();
        fireEvent.click(screen.getByRole('button', { name: 'Roll Death Save' }));
        await waitForResultVisible();
        if (tc.showsHp) {
          expect(screen.getByText(/Restored to 1 HP/)).toBeInTheDocument();
        } else {
          expect(screen.queryByText(/Restored to.*HP/)).not.toBeInTheDocument();
        }
      });
    }
  });

  // ── HP restoration side effects ──

  it('sets currentHitPoints when roll restores HP', async () => {
    deathSaveRules.rollDeathSave.mockReturnValue(defaultRollResult({
      roll: 20, isNat20: true, result: 'nat20', restoredToHp: 1,
    }));
    render(<DeathSavePromptModal campaignName="test-campaign" />);
    fireEvent.click(screen.getByTestId('trigger-prompt-1'));
    await waitForPromptVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Roll Death Save' }));
    await waitForResultVisible();
    expect(setRuntimeValue).toHaveBeenCalledWith('target1', 'currentHitPoints', 1, 'test-campaign');
  });

});
