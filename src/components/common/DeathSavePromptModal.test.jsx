// @improved-by-ai
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
      { 'data-testid': 'subscriber', 'data-campaign': campaignName },
      React.createElement('button', {
        'data-testid': 'subscriber-trigger',
        onClick: () =>
          handleEvent({
            key: `change-${campaignName}-deathSavePrompt-testTarget`,
            data: { promptId: 'test-prompt-1', targetName: 'testTarget' },
          }),
      }),
      React.createElement('button', {
        'data-testid': 'subscriber-trigger-second',
        onClick: () =>
          handleEvent({
            key: `change-${campaignName}-deathSavePrompt-testTarget2`,
            data: { promptId: 'test-prompt-2', targetName: 'testTarget2' },
          }),
      }),
      React.createElement('button', {
        'data-testid': 'subscriber-trigger-queue',
        onClick: () =>
          handleEvent({
            key: `change-${campaignName}-deathSavePrompt-testTarget3`,
            data: { promptId: 'test-prompt-3', targetName: 'testTarget3' },
          }),
      }),
    );
  }
  return { default: MockSubscriber };
});

// ── Global setup ──

const MockEventSource = vi.fn();
MockEventSource.prototype.close = vi.fn();

function setupGlobalEventSource() {
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

function triggerPrompt(campaignName, triggerTestId) {
  const trigger = screen.getByTestId(triggerTestId);
  fireEvent.click(trigger);
}

function waitForPrompt() {
  return waitFor(() => {
    expect(screen.getByText(/must make a/i)).toBeInTheDocument();
  });
}

function waitForResult() {
  return waitFor(() => {
    expect(screen.getByText(/Roll:/i)).toBeInTheDocument();
  });
}

// ── Defaults ──

beforeEach(() => {
  vi.clearAllMocks();
  setupGlobalEventSource();
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

  it('renders Subscriber with campaignName when EventSource is available', () => {
    render(<DeathSavePromptModal campaignName="my-campaign" />);
    expect(screen.getByTestId('subscriber')).toHaveAttribute('data-campaign', 'my-campaign');
  });

  // ── Prompt queuing ──

  it('renders modal when a prompt is received', async () => {
    render(<DeathSavePromptModal campaignName="test-campaign" />);
    triggerPrompt('test-campaign', 'subscriber-trigger');
    await waitForPrompt();
    expect(screen.getByText('testTarget')).toBeInTheDocument();
    expect(document.querySelector('.dsp-header')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Roll Death Save' })).toBeInTheDocument();
  });

  it('does not advance when clicking inside the modal', async () => {
    render(<DeathSavePromptModal campaignName="test-campaign" />);
    triggerPrompt('test-campaign', 'subscriber-trigger');
    await waitForPrompt();
    const modal = document.querySelector('.dsp-modal');
    if (modal) fireEvent.click(modal);
    await waitForPrompt();
  });

  // ── Queue count ──

  it('does not show queue count for a single prompt', async () => {
    render(<DeathSavePromptModal campaignName="test-campaign" />);
    triggerPrompt('test-campaign', 'subscriber-trigger');
    await waitForPrompt();
    expect(screen.queryByText(/\(1 of/)).not.toBeInTheDocument();
  });

  it('shows queue count when multiple prompts are queued', async () => {
    render(<DeathSavePromptModal campaignName="test-campaign" />);
    triggerPrompt('test-campaign', 'subscriber-trigger');
    await waitForPrompt();
    triggerPrompt('test-campaign', 'subscriber-trigger-second');
    await waitFor(() => {
      expect(screen.getByText(/\(1 of 2\)/)).toBeInTheDocument();
    });
  });

  it('updates queue count when advancing through prompts', async () => {
    render(<DeathSavePromptModal campaignName="test-campaign" />);
    triggerPrompt('test-campaign', 'subscriber-trigger');
    triggerPrompt('test-campaign', 'subscriber-trigger-second');
    triggerPrompt('test-campaign', 'subscriber-trigger-queue');
    await waitFor(() => {
      expect(screen.getByText(/\(1 of 3\)/)).toBeInTheDocument();
    });
    const overlay = document.querySelector('.dsp-overlay');
    if (overlay) fireEvent.click(overlay);
    await waitFor(() => {
      expect(screen.getByText(/\(1 of 2\)/)).toBeInTheDocument();
    });
  });

  it('does not add duplicate prompts with the same promptId', async () => {
    render(<DeathSavePromptModal campaignName="test-campaign" />);
    triggerPrompt('test-campaign', 'subscriber-trigger');
    await waitForPrompt();
    fireEvent.click(screen.getByTestId('subscriber-trigger'));
    await waitForPrompt();
    expect(screen.queryByText(/\(2 of/)).not.toBeInTheDocument();
  });

  // ── Roll death save — basic behavior ──

  it('shows result after rolling a death save (success)', async () => {
    render(<DeathSavePromptModal campaignName="test-campaign" />);
    triggerPrompt('test-campaign', 'subscriber-trigger');
    await waitForPrompt();
    fireEvent.click(screen.getByRole('button', { name: 'Roll Death Save' }));
    await waitForResult();
    expect(screen.getByText('DEATH SAVE SUCCESS')).toBeInTheDocument();
  });

  it('dispatches death-save-result custom event with correct detail after rolling', async () => {
    const eventHandler = vi.fn();
    window.addEventListener('death-save-result', eventHandler);
    render(<DeathSavePromptModal campaignName="test-campaign" />);
    triggerPrompt('test-campaign', 'subscriber-trigger');
    await waitForPrompt();
    fireEvent.click(screen.getByRole('button', { name: 'Roll Death Save' }));
    await waitForResult();
    expect(eventHandler).toHaveBeenCalled();
    const detail = eventHandler.mock.calls[0][0].detail;
    expect(detail).toMatchObject({
      promptId: 'test-prompt-1',
      targetName: 'testTarget',
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
    triggerPrompt('test-campaign', 'subscriber-trigger');
    await waitForPrompt();
    fireEvent.click(screen.getByRole('button', { name: 'Roll Death Save' }));
    await waitForResult();
    expect(sendDeathSaveResult).toHaveBeenCalledWith('test-campaign', 'testTarget', {
      promptId: 'test-prompt-1',
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
    triggerPrompt('test-campaign', 'subscriber-trigger');
    await waitForPrompt();
    fireEvent.click(screen.getByRole('button', { name: 'Roll Death Save' }));
    await waitForResult();
    expect(clearDeathSavePrompt).toHaveBeenCalledWith('test-campaign', 'testTarget');
  });

  it('updates runtime state for deathSaves and deathFailures after rolling', async () => {
    render(<DeathSavePromptModal campaignName="test-campaign" />);
    triggerPrompt('test-campaign', 'subscriber-trigger');
    await waitForPrompt();
    fireEvent.click(screen.getByRole('button', { name: 'Roll Death Save' }));
    await waitForResult();
    expect(setRuntimeValue).toHaveBeenCalledWith('testTarget', 'deathSaves', [true, false, false], 'test-campaign');
    expect(setRuntimeValue).toHaveBeenCalledWith('testTarget', 'deathFailures', [false, false, false], 'test-campaign');
  });

  it('reads saved death saves from runtime state before rolling', async () => {
    getRuntimeValue.mockImplementation((targetName, prop) => {
      if (targetName === 'testTarget' && prop === 'deathSaves') return [true, false, false];
      if (targetName === 'testTarget' && prop === 'deathFailures') return [false, false, false];
      return null;
    });
    render(<DeathSavePromptModal campaignName="test-campaign" />);
    triggerPrompt('test-campaign', 'subscriber-trigger');
    await waitForPrompt();
    fireEvent.click(screen.getByRole('button', { name: 'Roll Death Save' }));
    await waitForResult();
    expect(deathSaveRules.rollDeathSave).toHaveBeenCalledWith(
      [true, false, false],
      [false, false, false],
    );
  });

  // ── Button states & advancement ──

  it('shows Roll button before rolling, Done/Next after rolling', async () => {
    render(<DeathSavePromptModal campaignName="test-campaign" />);
    triggerPrompt('test-campaign', 'subscriber-trigger');
    await waitForPrompt();
    expect(screen.getByRole('button', { name: 'Roll Death Save' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Roll Death Save' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });
  });

  it('shows Next button when multiple prompts are queued', async () => {
    render(<DeathSavePromptModal campaignName="test-campaign" />);
    triggerPrompt('test-campaign', 'subscriber-trigger');
    triggerPrompt('test-campaign', 'subscriber-trigger-second');
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
    triggerPrompt('test-campaign', 'subscriber-trigger');
    triggerPrompt('test-campaign', 'subscriber-trigger-second');
    await waitFor(() => {
      expect(screen.getByText(/\(1 of 2\)/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Roll Death Save' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => {
      expect(screen.getByText(/testTarget2/)).toBeInTheDocument();
      expect(screen.queryByText(/\(1 of/)).not.toBeInTheDocument();
    });
  });

  it('advances to next prompt when overlay is clicked, dismisses on single prompt', async () => {
    render(<DeathSavePromptModal campaignName="test-campaign" />);
    triggerPrompt('test-campaign', 'subscriber-trigger');
    await waitForPrompt();
    triggerPrompt('test-campaign', 'subscriber-trigger-second');
    await waitFor(() => {
      expect(screen.getByText(/\(1 of 2\)/)).toBeInTheDocument();
    });
    const overlay = document.querySelector('.dsp-overlay');
    if (overlay) fireEvent.click(overlay);
    await waitFor(() => {
      expect(screen.getByText(/testTarget2/)).toBeInTheDocument();
    });
  });

  it('dismisses modal entirely when overlay is clicked with single prompt', async () => {
    render(<DeathSavePromptModal campaignName="test-campaign" />);
    triggerPrompt('test-campaign', 'subscriber-trigger');
    await waitForPrompt();
    const overlay = document.querySelector('.dsp-overlay');
    if (overlay) fireEvent.click(overlay);
    await waitFor(() => {
      expect(screen.queryByText(/must make a/i)).not.toBeInTheDocument();
    });
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
        triggerPrompt('test-campaign', 'subscriber-trigger');
        await waitForPrompt();
        fireEvent.click(screen.getByRole('button', { name: 'Roll Death Save' }));
        await waitForResult();
        expect(screen.getByText(tc.expectedLabel)).toBeInTheDocument();
      });

      it(`shows HP restoration text for ${tc.name} when applicable`, async () => {
        deathSaveRules.rollDeathSave.mockReturnValue(defaultRollResult(tc.overrides));
        render(<DeathSavePromptModal campaignName="test-campaign" />);
        triggerPrompt('test-campaign', 'subscriber-trigger');
        await waitForPrompt();
        fireEvent.click(screen.getByRole('button', { name: 'Roll Death Save' }));
        await waitForResult();
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
    triggerPrompt('test-campaign', 'subscriber-trigger');
    await waitForPrompt();
    fireEvent.click(screen.getByRole('button', { name: 'Roll Death Save' }));
    await waitForResult();
    expect(setRuntimeValue).toHaveBeenCalledWith('testTarget', 'currentHitPoints', 1, 'test-campaign');
  });

  it('does not set currentHitPoints when roll does not restore HP', async () => {
    deathSaveRules.rollDeathSave.mockReturnValue(defaultRollResult({ restoredToHp: null }));
    render(<DeathSavePromptModal campaignName="test-campaign" />);
    triggerPrompt('test-campaign', 'subscriber-trigger');
    await waitForPrompt();
    fireEvent.click(screen.getByRole('button', { name: 'Roll Death Save' }));
    await waitForResult();
    const hpCalls = setRuntimeValue.mock.calls.filter(
      (call) => call[1] === 'currentHitPoints',
    );
    expect(hpCalls).toHaveLength(0);
  });
});
// @cleaned-by-ai
