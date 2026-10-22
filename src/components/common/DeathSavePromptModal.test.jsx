// @maintained-by-ai
// @improved-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import DeathSavePromptModal from './DeathSavePromptModal.jsx';
import { sendDeathSaveResult, clearDeathSavePrompt } from '../../services/combat/conditions/savePromptService.js';
import * as deathSaveRules from '../../services/combat/conditions/deathSaveRules.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

// ── Mock dependencies (service/network + rules boundaries only) ──

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

// Capture the modal's SSE handler so tests can emit events directly,
// instead of the old mock rendering one trigger button per prompt.
let emitEvent = null;

vi.mock('./Subscriber.jsx', () => ({
  default: function MockSubscriber({ handleEvent }) {
    emitEvent = handleEvent;
    return null;
  },
}));

// ── Helpers ──

const CAMPAIGN = 'test-campaign';

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

/** Emit an SSE change-key event exactly as the real Subscriber would. */
function emitPrompt(targetName, promptId = `prompt-${targetName}`) {
  act(() => {
    emitEvent({
      key: `change-${CAMPAIGN}-deathSavePrompt-${targetName}`,
      data: { promptId },
    });
  });
}

function renderWithPrompt(targetName = 'target1', promptId = `prompt-${targetName}`) {
  render(<DeathSavePromptModal campaignName={CAMPAIGN} />);
  emitPrompt(targetName, promptId);
  return screen.findByText(/must make a/i);
}

async function rollAndWaitForResult() {
  fireEvent.click(screen.getByRole('button', { name: 'Roll Death Save' }));
  return screen.findByText(/^Roll:/i);
}

// ── Defaults & cleanup ──

let dispatchedResults;
const collectResults = (e) => dispatchedResults.push(e.detail);

beforeEach(() => {
  vi.clearAllMocks();
  setupEventSource();
  deathSaveRules.rollDeathSave.mockReturnValue(defaultRollResult());
  getRuntimeValue.mockReturnValue(null);
  emitEvent = null;
  dispatchedResults = [];
  window.addEventListener('death-save-result', collectResults);
});

afterEach(() => {
  window.removeEventListener('death-save-result', collectResults);
});

// ── Tests ──

describe('DeathSavePromptModal', () => {
  it('renders nothing until a death-save prompt arrives', () => {
    render(<DeathSavePromptModal campaignName={CAMPAIGN} />);
    expect(screen.queryByText(/must make a/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Roll Death Save' })).not.toBeInTheDocument();
  });

  it('shows the target from the event key with a Roll Death Save button', async () => {
    // data carries only promptId — the displayed name must come from the key
    await renderWithPrompt('InjuredAlly');
    expect(screen.getByText('InjuredAlly')).toBeInTheDocument();
    expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Roll Death Save' })).toBeInTheDocument();
  });

  it('ignores SSE events that are not this campaign\'s death-save prompts', async () => {
    render(<DeathSavePromptModal campaignName={CAMPAIGN} />);
    const invalidEvents = [
      { key: undefined, data: { promptId: 'p' } },
      { key: `change-${CAMPAIGN}-deathSavePrompt-target1`, data: null },
      { key: `change-${CAMPAIGN}-someOtherKey-target1`, data: { promptId: 'p' } },
      { key: 'change-other-campaign-deathSavePrompt-target1', data: { promptId: 'p' } },
      { key: `change-${CAMPAIGN}-deathSavePrompt-`, data: { promptId: 'p' } },
    ];
    for (const event of invalidEvents) {
      act(() => emitEvent(event));
    }
    expect(screen.queryByText(/must make a/i)).not.toBeInTheDocument();
    // a valid event still opens the modal afterwards
    emitPrompt('InjuredAlly');
    expect(await screen.findByText(/must make a/i)).toBeInTheDocument();
  });

  // ── Queue display ──

  it('shows a queue counter only when a second prompt is waiting', async () => {
    await renderWithPrompt('target1');
    expect(screen.queryByText(/\(\d+ of \d+\)/)).not.toBeInTheDocument();
    emitPrompt('target2');
    expect(await screen.findByText('(1 of 2)')).toBeInTheDocument();
  });

  it('ignores a repeated prompt with the same promptId', async () => {
    await renderWithPrompt('target1');
    emitPrompt('target1');
    expect(screen.queryByText(/\(2 of/)).not.toBeInTheDocument();
    // proving nothing extra was queued: rolling + Done closes the modal entirely
    await rollAndWaitForResult();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByText(/must make a/i)).not.toBeInTheDocument();
  });

  it('drains queued prompts in order, rolling each target with its own payload', async () => {
    await renderWithPrompt('target1');
    emitPrompt('target2');
    await screen.findByText('(1 of 2)');

    await rollAndWaitForResult();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    // advanced to a fresh prompt for target2 (counter hidden, Roll restored)
    expect(await screen.findByText('target2')).toBeInTheDocument();
    expect(screen.queryByText(/\(\d+ of \d+\)/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Roll Death Save' }));
    await screen.findByText('DEATH SAVE SUCCESS');
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByText(/must make a/i)).not.toBeInTheDocument();

    expect(sendDeathSaveResult).toHaveBeenCalledTimes(2);
    expect(sendDeathSaveResult.mock.calls[0][1]).toBe('target1');
    expect(sendDeathSaveResult.mock.calls[1][1]).toBe('target2');
  });

  it('cannot be dismissed by clicking the modal or its backdrop', async () => {
    await renderWithPrompt('target1');
    emitPrompt('target2');
    await screen.findByText('(1 of 2)');

    // The overlay/modal are plain divs, so class selectors are the only handles.
    fireEvent.click(document.querySelector('.dsp-modal'));
    fireEvent.click(document.querySelector('.dsp-overlay'));

    expect(screen.getByText('target1')).toBeInTheDocument();
    expect(screen.getByText('(1 of 2)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Roll Death Save' })).toBeInTheDocument();
  });

  // ── Rolling and committing the result ──

  it('replaces Roll with Done after rolling a single prompt', async () => {
    await renderWithPrompt('target1');
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    await rollAndWaitForResult();
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Roll Death Save' })).not.toBeInTheDocument();
  });

  it('broadcasts a death-save-result event and posts the same payload to the server', async () => {
    await renderWithPrompt('target1');
    await rollAndWaitForResult();

    const expectedPayload = {
      promptId: 'prompt-target1',
      roll: 15,
      isNat20: false,
      isNat1: false,
      success: true,
      result: 'success',
      newSaves: [true, false, false],
      newFailures: [false, false, false],
      restoredToHp: null,
    };
    expect(dispatchedResults).toHaveLength(1);
    expect(dispatchedResults[0]).toEqual({ ...expectedPayload, targetName: 'target1' });
    expect(sendDeathSaveResult).toHaveBeenCalledWith(CAMPAIGN, 'target1', expectedPayload);
  });

  it('writes new saves and failures to the runtime store and clears the prompt', async () => {
    await renderWithPrompt('target1');
    await rollAndWaitForResult();

    expect(setRuntimeValue).toHaveBeenCalledWith('target1', 'deathSaves', [true, false, false], CAMPAIGN);
    expect(setRuntimeValue).toHaveBeenCalledWith('target1', 'deathFailures', [false, false, false], CAMPAIGN);
    expect(clearDeathSavePrompt).toHaveBeenCalledWith(CAMPAIGN, 'target1');
    // a plain success must not kill or heal the target
    expect(setRuntimeValue).not.toHaveBeenCalledWith('target1', 'isDead', expect.anything(), CAMPAIGN);
    expect(setRuntimeValue).not.toHaveBeenCalledWith('target1', 'currentHitPoints', expect.anything(), CAMPAIGN);
  });

  it('reads saved death saves from the runtime store before rolling', async () => {
    getRuntimeValue.mockImplementation((targetName, prop) => {
      if (targetName !== 'target1') return null;
      return prop === 'deathSaves' ? [true, false, false] : [false, true, false];
    });
    await renderWithPrompt('target1');
    await rollAndWaitForResult();
    expect(deathSaveRules.rollDeathSave).toHaveBeenCalledWith([true, false, false], [false, true, false]);
  });

  it('defaults to three empty save slots when nothing is stored yet', async () => {
    await renderWithPrompt('target1');
    await rollAndWaitForResult();
    expect(deathSaveRules.rollDeathSave).toHaveBeenCalledWith([false, false, false], [false, false, false]);
  });

  it('marks the target dead when the roll results in death', async () => {
    deathSaveRules.rollDeathSave.mockReturnValue(defaultRollResult({
      roll: 3,
      result: 'dead',
      newSaves: [false, false, false],
      newFailures: [true, true, true],
    }));
    await renderWithPrompt('target1');
    await rollAndWaitForResult();
    expect(setRuntimeValue).toHaveBeenCalledWith('target1', 'isDead', 1, CAMPAIGN);
  });

  it('restores current hit points when the roll restores HP', async () => {
    deathSaveRules.rollDeathSave.mockReturnValue(defaultRollResult({
      roll: 20, isNat20: true, result: 'nat20', restoredToHp: 1,
    }));
    await renderWithPrompt('target1');
    await rollAndWaitForResult();
    expect(setRuntimeValue).toHaveBeenCalledWith('target1', 'currentHitPoints', 1, CAMPAIGN);
  });

  // ── Roll outcome display (label, roll value, HP line, broadcast flag) ──

  describe('roll outcomes', () => {
    const outcomes = [
      {
        name: 'success',
        roll: { roll: 15, result: 'success' },
        label: 'DEATH SAVE SUCCESS',
        success: true,
      },
      {
        name: 'natural 20',
        roll: { roll: 20, isNat20: true, result: 'nat20', restoredToHp: 1 },
        label: 'NATURAL 20 — STABILIZED!',
        success: true,
        restoredHp: 1,
      },
      {
        name: 'natural 1',
        roll: { roll: 1, isNat1: true, result: 'failure', newFailures: [true, true, false] },
        label: 'NATURAL 1 — DOUBLE FAILURE',
        success: false,
      },
      {
        name: 'stable',
        roll: { roll: 15, result: 'stable' },
        label: 'STABILIZED!',
        success: true,
      },
      {
        name: 'failure',
        roll: { roll: 5, result: 'failure', newFailures: [true, false, false] },
        label: 'DEATH SAVE FAILURE',
        success: false,
      },
      {
        name: 'dead',
        roll: { roll: 5, result: 'dead', newSaves: [false, false, false], newFailures: [false, false, false] },
        label: 'DEAD',
        success: false,
      },
    ];

    for (const outcome of outcomes) {
      it(`displays the ${outcome.name} outcome in full`, async () => {
        deathSaveRules.rollDeathSave.mockReturnValue(defaultRollResult(outcome.roll));
        await renderWithPrompt('target1');
        const resultLine = await rollAndWaitForResult();

        expect(screen.getByText(outcome.label)).toBeInTheDocument();
        expect(resultLine).toHaveTextContent(String(outcome.roll.roll));
        if (outcome.restoredHp != null) {
          expect(screen.getByText(`Restored to ${outcome.restoredHp} HP`)).toBeInTheDocument();
        } else {
          expect(screen.queryByText(/Restored to .* HP/)).not.toBeInTheDocument();
        }
        expect(dispatchedResults[0]).toMatchObject({
          promptId: 'prompt-target1',
          targetName: 'target1',
          success: outcome.success,
          result: outcome.roll.result,
        });
      });
    }
  });

  // ── #1400 voided-prompt guard (single-producer law, 2026-10-22) ──
  // relentlessRageService (and heals) may lift a target off 0 HP while a
  // death-save prompt sits queued HERE. The service commits HP >= 1 BEFORE
  // clearing deathSaves/deathFailures (fix#105 order, pinned by the
  // saveResults lane's writes[0] census). A roll clicked after that point
  // is VOID: this modal must not resurrect counters (or POST the outcome)
  // onto a standing creature. Key ownership: modal = sole producer of
  // counter ACCUMULATION on live dying targets; service = one-shot reset.

  describe('#1400 voided-prompt guard', () => {
    it('rolls normally while the target is at 0 HP — counters written exactly once each', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'currentHitPoints') return 0; // still dying: valid prompt
        return null;
      });
      await renderWithPrompt('target1');
      await rollAndWaitForResult();

      // Full-state complete writes at own write-time (#1348 shape):
      const counterWrites = setRuntimeValue.mock.calls.filter(
        c => c[1] === 'deathSaves' || c[1] === 'deathFailures'
      );
      expect(counterWrites).toEqual([
        ['target1', 'deathSaves', [true, false, false], CAMPAIGN],
        ['target1', 'deathFailures', [false, false, false], CAMPAIGN],
      ]);
      expect(sendDeathSaveResult).toHaveBeenCalledTimes(1);
    });

    it('voids the roll when rage/heal already lifted HP above 0 — ZERO counter writes, no POST, prompt cleared', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'currentHitPoints') return 1; // relentless rage landed
        return null;
      });
      const opens = [];
      const collectOpen = (e) => opens.push(e.detail);
      window.addEventListener('open-death-saving-throw', collectOpen);

      await renderWithPrompt('target1');
      fireEvent.click(screen.getByRole('button', { name: 'Roll Death Save' }));

      // No roll is consumed and NOTHING is written to foreign-state keys:
      expect(deathSaveRules.rollDeathSave).not.toHaveBeenCalled();
      expect(sendDeathSaveResult).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
      // The stale prompt is cleared and the queue advances with no result view.
      expect(clearDeathSavePrompt).toHaveBeenCalledWith(CAMPAIGN, 'target1');
      // Queue advanced: the modal is gone and NO result view was rendered.
      expect(screen.queryByText(/must make a/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/^Roll:/i)).not.toBeInTheDocument();
      expect(opens.length).toBeGreaterThan(0);

      window.removeEventListener('open-death-saving-throw', collectOpen);
    });

    it('does not stamp isDead from a voided prompt even when the queued roll outcome would be dead', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'currentHitPoints') return 5; // healed past dying
        return null;
      });
      deathSaveRules.rollDeathSave.mockReturnValue(defaultRollResult({
        result: 'dead', newFailures: [true, true, true],
      }));
      await renderWithPrompt('target1');
      fireEvent.click(screen.getByRole('button', { name: 'Roll Death Save' }));

      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(screen.queryByText('DEAD')).not.toBeInTheDocument();
    });
  });
});
