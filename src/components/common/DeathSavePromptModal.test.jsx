// @maintained-by-ai 2026-11-27 (improved-and-trimmed)
// DeathSavePromptModal — SSE queue management, roll dispatch payloads, and
// outcome display. Mock boundaries: the network send/clear (savePromptService),
// the rules roll (determinism), the log lane, the runtime-store reads/writes,
// and the SSE Subscriber (captured to inject events directly).
//
// Covered elsewhere in this file family, NOT repeated here:
// - cross-tab null echoes, result-echo re-roll refusal, acting-tab panel
//   survival: DeathSavePromptModal.cross-tab.test.jsx
// - merged single-batch wire shape (isDead / HP restore / one POST per roll)
//   on the REAL store + service: DeathSavePromptModal.roll-single-write.test.jsx
// - stable/dead finality-row shapes: DeathSavePromptModal.finality-rows.test.jsx
// - GM-only Cancel render + zero-write lane: DeathSavePromptModal.gm-cancel.test.jsx
// - mount-side stale re-verdict (player-roster auto-evict):
//   DeathSavePromptModal.stale-mount-recheck.test.jsx
// The #1400 void-guard's positive leg (HP<=0 rolls normally) is exercised by
// every roll in this file — the default getRuntimeValue mock leaves the target
// at 0 HP — so it has no dedicated case.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import DeathSavePromptModal from './DeathSavePromptModal.jsx';
import { sendDeathSaveResult, clearDeathSavePrompt } from '../../services/combat/conditions/savePromptService.js';
import * as deathSaveRules from '../../services/combat/conditions/deathSaveRules.js';
import { getRuntimeValue, setRuntimeBatch } from '../../hooks/runtime/useRuntimeState.js';

// ── Mock dependencies (service/network + rules boundaries only) ──

vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
  sendDeathSaveResult: vi.fn(),
  clearDeathSavePrompt: vi.fn(),
}));

vi.mock('../../services/combat/conditions/deathSaveRules.js', () => ({
  rollDeathSave: vi.fn(),
}));

// Finality summary rows (stable/dead) go straight to the log service —
// capture instead of fetch. Row-shape pins live in
// DeathSavePromptModal.finality-rows.test.jsx.
vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// Cancel render-gating (isGmHost) is owned by the gm-cancel lane — not mocked
// or asserted here.

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeBatch: vi.fn(),
  // Mount-side stale re-verdict's bucket subscription (no characters roster
  // is passed in this file, so the verdict stays gated off — the hook reads
  // the inert campaign fallback and never fires the evict lane).
  useRuntimeValue: vi.fn(() => null),
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
  delete globalThis.EventSource;
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
    // other-campaign and other-key share the one prefix guard; null data is
    // the legitimate clear-echo branch, pinned in the cross-tab lane.
    render(<DeathSavePromptModal campaignName={CAMPAIGN} />);
    const invalidEvents = [
      { key: undefined, data: { promptId: 'p' } },
      { key: `change-${CAMPAIGN}-someOtherKey-target1`, data: { promptId: 'p' } },
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

  // ── Queue display (pins promptQueueCounterText's two faces via mount) ──

  it('shows a queue counter only when a second prompt is waiting', async () => {
    await renderWithPrompt('target1');
    expect(screen.queryByText(/\(\d+ of \d+\)/)).not.toBeInTheDocument();
    emitPrompt('target2');
    expect(await screen.findByText('(1 of 2)')).toBeInTheDocument();
  });

  it('resolved head with a waiting sibling reads "(1 remaining)" — never the frozen "(1 of 2)"', async () => {
    // Resolved-face counter honesty (QE 2026-11-19 backlog), same pattern as
    // SavePromptModal: the answered head leaves the pending tally.
    await renderWithPrompt('target1');
    emitPrompt('target2');
    await screen.findByText('(1 of 2)');

    await rollAndWaitForResult();

    expect(screen.getByText('(1 remaining)')).toBeInTheDocument();
    expect(screen.queryByText(/\(\d+ of \d+\)/)).not.toBeInTheDocument();
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
    expect(clearDeathSavePrompt).not.toHaveBeenCalled();
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
    const resultLine = await rollAndWaitForResult();

    // plain "success" face: label, roll value, and NO HP-restore line
    expect(screen.getByText('DEATH SAVE SUCCESS')).toBeInTheDocument();
    expect(resultLine).toHaveTextContent('15');
    expect(screen.queryByText(/Restored to .* HP/)).not.toBeInTheDocument();

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
    expect(sendDeathSaveResult).toHaveBeenCalledTimes(1);
    expect(sendDeathSaveResult).toHaveBeenCalledWith(CAMPAIGN, 'target1', expectedPayload);
    expect(clearDeathSavePrompt).toHaveBeenCalledWith(CAMPAIGN, 'target1');
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

  // ── Roll outcome display (merged isDead/HP batch shapes are pinned on the
  // real wire by roll-single-write.test.jsx — not repeated here) ──

  describe('roll outcomes', () => {
    const outcomes = [
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
  // clearing deathSaves/deathFailures (fix#105 order), so a roll clicked
  // after that point is VOID: this modal must not resurrect counters (or
  // POST the outcome) onto a standing creature. The positive leg (still at
  // 0 HP → roll proceeds) is the default face of every other test here —
  // this is the negative leg only.

  it('#1400 voids the roll when rage/heal already lifted HP above 0 — ZERO counter writes, no POST, prompt cleared', async () => {
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
    expect(setRuntimeBatch).not.toHaveBeenCalled();
    // The stale prompt is cleared and the queue advances with no result view.
    expect(clearDeathSavePrompt).toHaveBeenCalledWith(CAMPAIGN, 'target1');
    // Queue advanced: the modal is gone and NO result view was rendered —
    // including no DEAD stamp from a would-be-fatal queued outcome.
    expect(screen.queryByText(/must make a/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Roll:/i)).not.toBeInTheDocument();
    expect(screen.queryByText('DEAD')).not.toBeInTheDocument();
    expect(opens.length).toBeGreaterThan(0);

    window.removeEventListener('open-death-saving-throw', collectOpen);
  });
});
