// @maintained-by-ai
// BardicInspirationReactionModal — cross-tab eviction (bug-bi-prompt-stranded-twin-survives-cross-tab-evict)
//
// Locks the cleared-key doctrine mirrored from the save-prompt lane
// (SavePromptModal's clearedPromptKeysRef branch, shipped 77cf70cd0): when any
// tab answers a Combat Inspiration prompt, its clearBardicInspirationPrompt
// wildcard DELETE broadcasts a null echo for `<name>-biPrompt` — every OTHER
// tab that has that prompt mounted must DE-QUEUE it (pre-fix, handleEvent
// dropped the null echo at the top, so the stranded twin stayed open
// indefinitely and its "Use Reaction & Roll" spent a second Bardic
// Inspiration die on an already-resolved adjudication). Also locks the
// no-re-enqueue law (null never MOUNTS a modal — the resurrection face of
// bug-bi-prompt-skip-never-evicts-server-key stays dead), key-exact matching
// (another creature's prompt survives), revival on a fresh value echo, and
// that an evicted active slot lets the next prompt surface.
//
// All pins ride the OFFENSE shape post bug-bi-defense-prompt-producer-orphaned
// (owner decision 2026-11-17): the defense branch of this lane was deleted, so
// offense prompts (keyed on the attacking creature) are the only mountable payload.
//
// Presentation/roll/skip mechanics live in BardicInspirationReactionModal.test.jsx
// — not repeated here.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import BardicInspirationReactionModal from './BardicInspirationReactionModal.jsx';
import { rollExpression } from '../../services/dice/diceRoller.js';
import { clearBardicInspiration } from '../../services/combat/auras/bardicInspirationState.js';
import { clearBardicInspirationPrompt } from '../../services/combat/prompts/bardicInspirationPromptUtils.js';

// ── Mocks (same seams as the main test file) ──

vi.mock('../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../services/combat/auras/bardicInspirationState.js', () => ({
  clearBardicInspiration: vi.fn(),
}));

vi.mock('../../services/combat/prompts/bardicInspirationPromptUtils.js', () => ({
  clearBardicInspirationPrompt: vi.fn(),
  // Drain-on-close re-read seam: cross-tab pins here drive the echo lane only
  // (the store-driven drain is pinned in .queue-drain.test.jsx).
  getPendingBardicInspirationPrompts: vi.fn(() => []),
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

const offensePrompt = (overrides = {}) => ({
  promptId: 'bi-cross-offense-1',
  mode: 'offense',
  attackerName: 'HeroesFeastBard',
  targetName: 'Goblin',
  dieSize: 8,
  ...overrides,
});

// Prompts arrive on the lane's canonical wildcard-key echo: `<name>-biPrompt`
// (`<name>` = the attacking creature — offense-only since the defense
// producer/branch deletion, bug-bi-defense-prompt-producer-orphaned).
function emit(coinKey, data) {
  act(() => {
    mockSubscriber.handleEvent({ key: `change-${CAMPAIGN}-${coinKey}`, data });
  });
}

const emitPrompt = (prompt) => emit(`${prompt.attackerName}-biPrompt`, prompt);

// Remote tab's clearBardicInspirationPrompt DELETE — the server broadcasts a
// null echo for the cleared key (the drain-to-evict broadcast).
const emitCleared = (name) => emit(`${name}-biPrompt`, null);

// ── Tests ──

describe('BardicInspirationReactionModal cross-tab eviction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rollExpression.mockReturnValue({ total: 5 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('a null cleared-key echo dequeues the mounted offense prompt (the stranded twin self-evicts)', async () => {
    render(<BardicInspirationReactionModal campaignName={CAMPAIGN} />);
    emitPrompt(offensePrompt());
    await screen.findByText(/Combat Inspiration - Offense/);

    emitCleared('HeroesFeastBard');

    expect(screen.queryByText(/Combat Inspiration - Offense/)).not.toBeInTheDocument();
    // Passive dequeue: the twin never DELETEs again and never consumes.
    expect(clearBardicInspirationPrompt).not.toHaveBeenCalled();
    expect(clearBardicInspiration).not.toHaveBeenCalled();
    expect(rollExpression).not.toHaveBeenCalled();
  });

  it('a defense-mode payload never mounts, so a later cleared echo stays inert (dead lane)', () => {
    const { container } = render(<BardicInspirationReactionModal campaignName={CAMPAIGN} />);

    // The orphaned defense shape (only reachable via manual seed after
    // bug-bi-defense-prompt-producer-orphaned) must not mount...
    emit('Goblin-biPrompt', {
      promptId: 'bi-cross-dead-1',
      mode: 'defense',
      targetName: 'Goblin',
      attackerName: 'Orc',
      attackRoll: 12,
      bonus: 4,
      effectiveAc: 18,
      dieSize: 8,
    });
    expect(container.querySelector('.sp-overlay')).not.toBeInTheDocument();

    // ...and its eviction echo dequeues nothing it never mounted.
    emitCleared('Goblin');
    expect(container.querySelector('.sp-overlay')).not.toBeInTheDocument();
  });

  it('the cleared echo dequeues only the creature whose key was cleared', async () => {
    render(<BardicInspirationReactionModal campaignName={CAMPAIGN} />);
    emitPrompt(offensePrompt());
    await screen.findByText(/Combat Inspiration - Offense/);

    // Another creature's prompt resolved remotely — this one survives.
    emitCleared('SomeOtherBard');
    expect(screen.getByText(/Combat Inspiration - Offense/)).toBeInTheDocument();
    expect(screen.getByText('HeroesFeastBard')).toBeInTheDocument();

    // The clear for THIS prompt's key finally lands — the twin evicts.
    emitCleared('HeroesFeastBard');
    expect(screen.queryByText(/Combat Inspiration - Offense/)).not.toBeInTheDocument();
  });

  it('never re-enqueues on null (no-re-enqueue law) and lets a fresh prompt mount afterwards', async () => {
    const { container } = render(<BardicInspirationReactionModal campaignName={CAMPAIGN} />);

    // A cleared echo with nothing mounted must not MOUNT anything (pre- and
    // post-eviction, including a payload-less echo shape).
    emitCleared('HeroesFeastBard');
    emit('HeroesFeastBard-biPrompt', undefined);
    expect(container.querySelector('.sp-overlay')).not.toBeInTheDocument();

    // The lane stays healthy for the next adjudication.
    emitPrompt(offensePrompt({ promptId: 'bi-cross-offense-2' }));
    expect(await screen.findByText(/Combat Inspiration - Offense/)).toBeInTheDocument();
  });

  it('a fresh value echo after a cleared echo revives the same promptId (key revived server-side)', async () => {
    render(<BardicInspirationReactionModal campaignName={CAMPAIGN} />);
    const prompt = offensePrompt();
    emitPrompt(prompt);
    await screen.findByText(/Combat Inspiration - Offense/);

    emitCleared('HeroesFeastBard');
    expect(screen.queryByText(/Combat Inspiration - Offense/)).not.toBeInTheDocument();

    // A legitimate re-POST recreates the server key — the modal re-mounts.
    emitPrompt(prompt);
    expect(await screen.findByText(/Combat Inspiration - Offense/)).toBeInTheDocument();
    expect(screen.getByText('HeroesFeastBard')).toBeInTheDocument();
  });

  it('a cross-tab eviction frees the active slot so the next prompt surfaces without a reconnect', async () => {
    render(<BardicInspirationReactionModal campaignName={CAMPAIGN} />);
    emitPrompt(offensePrompt());
    await screen.findByText(/Combat Inspiration - Offense/);

    emitCleared('HeroesFeastBard');
    expect(screen.queryByText(/Combat Inspiration - Offense/)).not.toBeInTheDocument();

    // A different creature's prompt arrives while nothing is mounted.
    emitPrompt(offensePrompt({ promptId: 'bi-cross-offense-3', attackerName: 'AttackerThree', targetName: 'Orc', dieSize: 6 }));
    expect(await screen.findByText(/Combat Inspiration - Offense/)).toBeInTheDocument();
    expect(screen.getByText('AttackerThree')).toBeInTheDocument();
  });

  it('a local Skip still evicts and the resolving tab ignores its own echoed null', async () => {
    const result = listenFor('bardic-inspiration-offense-result');
    render(<BardicInspirationReactionModal campaignName={CAMPAIGN} />);
    emitPrompt(offensePrompt());
    await screen.findByText(/Combat Inspiration - Offense/);

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(result).toHaveBeenCalledTimes(1);

    // The answering tab's own DELETE echo arrives — queue already empty, inert.
    emitCleared('HeroesFeastBard');
    expect(screen.queryByText(/Combat Inspiration - Offense/)).not.toBeInTheDocument();
    expect(result).toHaveBeenCalledTimes(1);
    expect(rollExpression).not.toHaveBeenCalled();
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
