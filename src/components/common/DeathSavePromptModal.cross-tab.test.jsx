// @maintained-by-ai
// DeathSavePromptModal — cross-tab resolution (bug-death-save-prompt-stale-cross-tab-double-roll)
//
// Locks the passive-client resolution contract mirrored from the
// concentration prompt (6b1800fa2): once any client adjudicates a death
// save, the acting client's clearDeathSavePrompt DELETEs
// `deathSavePrompt-<Target>` and the server broadcasts a null echo — every
// OTHER client must retire its queued prompt for that target (the pre-fix
// handleEvent dropped the null echo at the top, leaving stale tabs a live
// "Roll Death Save" that spent a second real save and logged a duplicate
// death_save row for one down event). Also locks: the acting client's own
// result panel survives its DELETE echo until Done; a remote
// deathSaveResult-<Target> echo (carrying promptId) can never be re-rolled;
// the target-wide clear leaves other targets' queues and this client's
// adjudicated panels untouched.
//
// Queue/roll/outcome math lives in DeathSavePromptModal.test.jsx — not
// repeated here.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import DeathSavePromptModal from './DeathSavePromptModal.jsx';
import { sendDeathSaveResult } from '../../services/combat/conditions/savePromptService.js';
import * as deathSaveRules from '../../services/combat/conditions/deathSaveRules.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

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
// exactly as the real Subscriber delivers them (same seam as the main test).
let emitEvent = null;

vi.mock('./Subscriber.jsx', () => ({
  default: function MockSubscriber({ handleEvent }) {
    emitEvent = handleEvent;
    return null;
  },
}));

const CAMPAIGN = 'test-campaign';
const ROLLER = 'DyingAlly';
const OTHER = 'DyingAlly2';

function emit(campaign, key, data) {
  act(() => {
    emitEvent({ key: `change-${campaign}-${key}`, data });
  });
}

const emitPrompt = (targetName, promptId = `prompt-${targetName}`) =>
  emit(CAMPAIGN, `deathSavePrompt-${targetName}`, { promptId, targetName });

// Passive-tab mirror of another client's clearDeathSavePrompt DELETE — the
// server broadcasts a null echo for the cleared key.
const emitPromptCleared = (targetName) =>
  emit(CAMPAIGN, `deathSavePrompt-${targetName}`, null);

// Another client's submitted result broadcast (sendDeathSaveResult POST).
const emitResultEcho = (targetName, promptId) =>
  emit(CAMPAIGN, `deathSaveResult-${targetName}`, { promptId, roll: 12, success: true });

async function openPrompt(targetName = ROLLER) {
  render(<DeathSavePromptModal campaignName={CAMPAIGN} />);
  emitPrompt(targetName);
  await screen.findByText(/must make a/i);
}

async function rollAndWaitForResult() {
  fireEvent.click(screen.getByRole('button', { name: 'Roll Death Save' }));
  return screen.findByText(/^Roll:/i);
}

beforeEach(() => {
  vi.clearAllMocks();
  const MockEventSource = vi.fn();
  MockEventSource.prototype.close = vi.fn();
  Object.defineProperty(globalThis, 'EventSource', {
    value: MockEventSource,
    writable: true,
    configurable: true,
  });
  deathSaveRules.rollDeathSave.mockReturnValue({
    roll: 15,
    isNat20: false,
    isNat1: false,
    result: 'success',
    newSaves: [true, false, false],
    newFailures: [false, false, false],
    restoredToHp: null,
  });
  getRuntimeValue.mockReturnValue(0); // target still at 0 HP: prompts are live
  emitEvent = null;
});

afterEach(() => {
  delete globalThis.EventSource;
});

describe('DeathSavePromptModal cross-tab resolution', () => {
  it('closes the queued prompt when the prompt key is DELETE-echoed as null', async () => {
    await openPrompt();
    emitPromptCleared(ROLLER);
    expect(screen.queryByText(/must make a/i)).not.toBeInTheDocument();
    // A closed passive client never spends the save it no longer owns.
    expect(screen.queryByRole('button', { name: 'Roll Death Save' })).not.toBeInTheDocument();
    expect(sendDeathSaveResult).not.toHaveBeenCalled();
    expect(deathSaveRules.rollDeathSave).not.toHaveBeenCalled();
  });

  it('keeps the acting client\'s result panel open through its own DELETE echo', async () => {
    await openPrompt();
    await rollAndWaitForResult();
    // The roll itself clears the server key — the echo must not wipe the
    // just-shown result before the user reads it and clicks Done.
    emitPromptCleared(ROLLER);
    expect(screen.getByText('DEATH SAVE SUCCESS')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByText(/must make a/i)).not.toBeInTheDocument();
    expect(sendDeathSaveResult).toHaveBeenCalledTimes(1);
  });

  it('ignores a null echo that names a different target', async () => {
    await openPrompt();
    emitPromptCleared(OTHER);
    expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Roll Death Save' })).toBeInTheDocument();
  });

  it('refuses to re-roll after a remote deathSaveResult echo resolves the prompt', async () => {
    await openPrompt();
    // Remote resolution broadcast lands while the stale entry is still queued
    // (echo ordering racing the DELETE-echo close must still spend one save).
    emitResultEcho(ROLLER, `prompt-${ROLLER}`);
    fireEvent.click(screen.getByRole('button', { name: 'Roll Death Save' }));
    expect(screen.queryByText(/must make a/i)).not.toBeInTheDocument();
    expect(sendDeathSaveResult).not.toHaveBeenCalled();
    expect(deathSaveRules.rollDeathSave).not.toHaveBeenCalled();
  });

  it('a remote result echo retires queue-entry races without touching an adjudicated panel', async () => {
    await openPrompt();
    await rollAndWaitForResult();
    // The acting tab's own POST echoes back here; its panel survives until Done.
    emitResultEcho(ROLLER, `prompt-${ROLLER}`);
    expect(screen.getByText('DEATH SAVE SUCCESS')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByText(/must make a/i)).not.toBeInTheDocument();
  });

  it('target-wide clear retires every un-adjudicated ghost for that target but keeps other queues', async () => {
    render(<DeathSavePromptModal campaignName={CAMPAIGN} />);
    emitPrompt(ROLLER);
    emitPrompt(ROLLER, 'ghost-of-the-same-down'); // stale accumulation face
    emitPrompt(OTHER);
    await screen.findByText('(1 of 3)');

    emitPromptCleared(ROLLER);
    // Both ROLLER entries retire; the other target's live prompt remains.
    expect(await screen.findByText('DyingAlly2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Roll Death Save' })).toBeInTheDocument();
    expect(sendDeathSaveResult).not.toHaveBeenCalled();
    expect(deathSaveRules.rollDeathSave).not.toHaveBeenCalled();
  });

  it('a fresh prompt for the same target still opens after a remote resolution', async () => {
    await openPrompt();
    emitPromptCleared(ROLLER);
    expect(screen.queryByText(/must make a/i)).not.toBeInTheDocument();
    // Next down event POSTs a new promptId — must re-arm the modal.
    emitPrompt(ROLLER, 'next-down-event');
    expect(await screen.findByText(/must make a/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Roll Death Save' }));
    expect(deathSaveRules.rollDeathSave).toHaveBeenCalledTimes(1);
  });
});
