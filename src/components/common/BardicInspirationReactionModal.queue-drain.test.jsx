// @maintained-by-ai
// BardicInspirationReactionModal — drain-on-close queue (backlog HL 2026-11-17)
//
// Locks the fix for the silently DEFERRED second prompt: with prompt A mounted,
// prompt B (a second attacker-keyed `<attacker>-biPrompt` with a non-null
// payload) sits on its campaign-store key while enqueuePrompt's active-guard
// drops its arrival echo — pre-fix NOTHING re-enqueued it in-session (old law:
// "defer to the next SSE connect"). The drain-on-close effect re-reads the
// REMAINING `*-biPrompt` keys from the campaign store whenever the queue
// empties, so B mounts in the SAME tab on every close path (Skip, Use-Reaction,
// cross-tab cleared echo) with no reload and no SSE reconnect. A prompt whose
// arrival echo was missed entirely (direct store write) is covered by the same
// re-read. The dedupe law (no double-mount across replay echoes), the
// no-re-enqueue law (null never mounts), the defense-shape refusal, and the
// entrance-focus pull all still gate the drained mount.
//
// Unlike the sibling lifecycle files (which mock the prompt-utils module),
// this lane is pinned against the REAL bardicInspirationPromptUtils + the REAL
// useRuntimeState campaign store with fetch stubbed at the network boundary —
// the drain IS a store read, so a mocked seam would pin nothing.
// Presentation/clear mechanics stay in .test.jsx; cross-tab echo doctrine in
// .cross-tab.test.jsx — not repeated here.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import BardicInspirationReactionModal from './BardicInspirationReactionModal.jsx';
import { rollExpression } from '../../services/dice/diceRoller.js';
import { clearBardicInspiration } from '../../services/combat/auras/bardicInspirationState.js';
import {
  sendBardicInspirationOffensePrompt,
} from '../../services/combat/prompts/bardicInspirationPromptUtils.js';
import {
  clearRuntimeState,
  getAllStoreKeys,
  getStore,
  listeners,
} from '../../hooks/runtime/useRuntimeState.js';

// ── Mocks (network-adjacent seams only — prompt-utils/store stay REAL) ──

vi.mock('../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../services/combat/auras/bardicInspirationState.js', () => ({
  clearBardicInspiration: vi.fn(),
}));

const mockSubscriber = vi.hoisted(() => ({ handleEvent: null }));

vi.mock('./Subscriber.jsx', () => ({
  default: ({ handleEvent }) => {
    mockSubscriber.handleEvent = handleEvent;
    return null;
  },
}));

// ── Fixtures & helpers ──

const CAMPAIGN = 'test-campaign';

const offensePrompt = (attackerName, promptId, dieSize = 8) => ({
  mode: 'offense',
  promptId,
  attackerName,
  targetName: 'Goblin',
  dieSize,
});

const promptA = () => offensePrompt('AttackerOne', 'bi-drain-A', 8);
const promptB = () => offensePrompt('AttackerTwo', 'bi-drain-B', 10);

// Server-side write: mirrors the value into the campaign store (exactly what
// App.jsx applyStoreUpdate does for a registered biPrompt echo — the shape the
// drain re-read consults). Fetch is stubbed, so only the store lane is real.
function seed(prompt) {
  sendBardicInspirationOffensePrompt(
    CAMPAIGN, prompt.attackerName, prompt.targetName, prompt.dieSize, prompt.promptId,
  );
}

// Full arrival echo: the prompt lands on the server store AND its echo reaches
// the modal (the production pair for a second prompt seeded while A is mounted).
function deliver(prompt) {
  seed(prompt);
  act(() => {
    mockSubscriber.handleEvent({
      key: `change-${CAMPAIGN}-${prompt.attackerName}-biPrompt`,
      data: prompt,
    });
  });
}

function emitCleared(name) {
  act(() => {
    // App.jsx mirror-evicts the key on the null echo; do the same here so the
    // drain-on-close never sees the resolved prompt.
    getStore('campaign').delete(`${name}-biPrompt`);
    mockSubscriber.handleEvent({ key: `change-${CAMPAIGN}-${name}-biPrompt`, data: null });
  });
}

function clearAllStores() {
  for (const key of getAllStoreKeys()) {
    clearRuntimeState(key);
  }
  listeners.clear();
}

// ── Tests ──

describe('BardicInspirationReactionModal drain-on-close queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAllStores();
    rollExpression.mockReturnValue({ total: 5 });
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true, status: 200 });
    global.fetch.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearAllStores();
  });

  const fetchMethods = () => global.fetch.mock.calls.map(([, init]) => init?.method || 'GET');

  it('Skip closes A and the deferred B mounts in-session from the store (no echo, no reload, no reconnect)', async () => {
    render(<BardicInspirationReactionModal campaignName={CAMPAIGN} />);
    deliver(promptA());
    await screen.findByText(/Combat Inspiration - Offense/);
    expect(screen.getByText('AttackerOne')).toBeInTheDocument();

    deliver(promptB()); // arrival echo dropped by the active-guard — deferred
    expect(screen.queryByText('AttackerTwo')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

    // B surfaces without any further echo: same tab, no reconnect.
    expect(await screen.findByText(/Combat Inspiration - Offense/)).toBeInTheDocument();
    expect(screen.getByText('AttackerTwo')).toBeInTheDocument();
    expect(screen.getByText(/roll your Bardic Inspiration die \(d10\)/)).toBeInTheDocument();
    // Invariant: Skip still wildcard-DELETEs its OWN key (and drains nothing else).
    expect(global.fetch.mock.calls.map(([url]) => url)).toContain(
      `/api/campaigns/${CAMPAIGN}/AttackerOne-biPrompt`,
    );
    expect(fetchMethods()).toContain('DELETE');
  });

  it('Use-Reaction closes A and drains B from the store', async () => {
    const result = listenFor('bardic-inspiration-offense-result');
    rollExpression.mockReturnValue({ total: 4 });
    render(<BardicInspirationReactionModal campaignName={CAMPAIGN} />);
    deliver(promptA());
    await screen.findByText(/Combat Inspiration - Offense/);
    deliver(promptB());

    fireEvent.click(screen.getByRole('button', { name: /Use Reaction & Roll/ }));

    expect(result).toHaveBeenCalledTimes(1);
    expect(result.mock.calls[0][0].detail).toEqual({ promptId: 'bi-drain-A', used: true, biRoll: 4 });
    expect(clearBardicInspiration).toHaveBeenCalledWith('AttackerOne', CAMPAIGN);
    expect(await screen.findByText('AttackerTwo')).toBeInTheDocument();
    expect(fetchMethods()).toContain('DELETE');
  });

  it('a cross-tab cleared echo closing A also drains B (the non-answering tab advances its queue too)', async () => {
    render(<BardicInspirationReactionModal campaignName={CAMPAIGN} />);
    deliver(promptA());
    await screen.findByText(/Combat Inspiration - Offense/);
    deliver(promptB());
    global.fetch.mockClear(); // the two seed POSTs are not this tab's evictions

    emitCleared('AttackerOne'); // another tab answered A — its DELETE echo evicts here

    expect(await screen.findByText(/Combat Inspiration - Offense/)).toBeInTheDocument();
    expect(screen.getByText('AttackerTwo')).toBeInTheDocument();
    // Passive tab self-evicts and advances WITHOUT issuing its own DELETE for A.
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('a prompt whose arrival echo was missed entirely still surfaces on close (drain covers silent loss)', async () => {
    render(<BardicInspirationReactionModal campaignName={CAMPAIGN} />);
    deliver(promptA());
    await screen.findByText(/Combat Inspiration - Offense/);

    seed(promptB()); // landed on the server key but its echo never reached the modal
    expect(screen.queryByText('AttackerTwo')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

    expect(await screen.findByText('AttackerTwo')).toBeInTheDocument();
  });

  it('drain chains: three deferred prompts surface one per close, in key order', async () => {
    const promptC = offensePrompt('AttackerThree', 'bi-drain-C', 12);
    seed(promptA()); // prompt already pending at connect — the mount-time drain covers it
    render(<BardicInspirationReactionModal campaignName={CAMPAIGN} />);
    await screen.findByText('AttackerOne');
    seed(promptB());
    seed(promptC);

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(await screen.findByText('AttackerTwo')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(await screen.findByText('AttackerThree')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(screen.queryByText(/Combat Inspiration - Offense/)).not.toBeInTheDocument();
  });

  it('dedupe law: a drained mount swallows its own later replay echo and never double-mounts', async () => {
    seed(promptA()); // drained straight from the store at mount (no echo)
    const { container } = render(<BardicInspirationReactionModal campaignName={CAMPAIGN} />);
    await screen.findByText('AttackerOne');

    act(() => {
      mockSubscriber.handleEvent({
        key: `change-${CAMPAIGN}-AttackerOne-biPrompt`,
        data: promptA(), // SSE replay of the SAME promptId
      });
    });
    expect(container.querySelectorAll('.sp-overlay')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    // Its key is DELETEd (store evicted), so the drain finds nothing — no
    // resurrection of the answered prompt.
    expect(screen.queryByText(/Combat Inspiration - Offense/)).not.toBeInTheDocument();
  });

  it('a defense-shape payload waiting on the key lane is refused by the drain too (dead-shape lock)', async () => {
    const { container } = render(<BardicInspirationReactionModal campaignName={CAMPAIGN} />);
    getStore('campaign').set('Goblin-biPrompt', {
      promptId: 'bi-drain-dead',
      mode: 'defense',
      targetName: 'Goblin',
      attackerName: 'Orc',
      dieSize: 8,
    });
    expect(container.querySelector('.sp-overlay')).not.toBeInTheDocument();

    deliver(promptA());
    await screen.findByText(/Combat Inspiration - Offense/);
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

    // A closes; the drain re-reads and STILL refuses the defense payload.
    expect(screen.queryByText(/Combat Inspiration - Offense/)).not.toBeInTheDocument();
  });

  it('the drained mount pulls entrance focus to its Roll button', async () => {
    render(<BardicInspirationReactionModal campaignName={CAMPAIGN} />);
    deliver(promptA());
    await screen.findByText(/Combat Inspiration - Offense/);
    seed(promptB());

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    await act(async () => { await Promise.resolve(); }); // flush the stranded-close restore microtask

    expect(await screen.findByText('AttackerTwo')).toBeInTheDocument();
    const focused = document.activeElement;
    expect(focused).toHaveClass('sp-roll-btn');
    expect(focused.closest('.sp-modal')).toHaveTextContent('AttackerTwo');
  });
});

// Window event listeners are removed automatically after each test.
let removeListeners = [];

function listenFor(eventName) {
  const handler = vi.fn();
  window.addEventListener(eventName, handler);
  removeListeners.push(() => window.removeEventListener(eventName, handler));
  return handler;
}

afterEach(() => {
  removeListeners.forEach((fn) => fn());
  removeListeners = [];
});
