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

const defensePrompt = (overrides = {}) => ({
  promptId: 'bi-cross-defense-1',
  mode: 'defense',
  targetName: 'HeroesFeastBard',
  attackerName: 'Goblin',
  attackRoll: 12,
  bonus: 4,
  effectiveAc: 18,
  dieSize: 8,
  ...overrides,
});

const offensePrompt = (overrides = {}) => ({
  promptId: 'bi-cross-offense-1',
  mode: 'offense',
  attackerName: 'HeroesFeastBard',
  targetName: 'Goblin',
  dieSize: 8,
  ...overrides,
});

// Prompts arrive on the lane's canonical wildcard-key echo: `<name>-biPrompt`
// (`<name>` = reacting creature — defense → target, offense → attacker).
function emit(coinKey, data) {
  act(() => {
    mockSubscriber.handleEvent({ key: `change-${CAMPAIGN}-${coinKey}`, data });
  });
}

const emitPrompt = (prompt) =>
  emit(`${prompt.mode === 'offense' ? prompt.attackerName : prompt.targetName}-biPrompt`, prompt);

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

  it('a null cleared-key echo dequeues the mounted defense prompt (the stranded twin self-evicts)', async () => {
    render(<BardicInspirationReactionModal campaignName={CAMPAIGN} />);
    emitPrompt(defensePrompt());
    await screen.findByText(/Combat Inspiration - Defense/);

    emitCleared('HeroesFeastBard');

    expect(screen.queryByText(/Combat Inspiration - Defense/)).not.toBeInTheDocument();
    // Passive dequeue: the twin never DELETEs again and never consumes.
    expect(clearBardicInspirationPrompt).not.toHaveBeenCalled();
    expect(clearBardicInspiration).not.toHaveBeenCalled();
    expect(rollExpression).not.toHaveBeenCalled();
  });

  it('a null cleared-key echo dequeues an offense prompt keyed on the attacker', async () => {
    render(<BardicInspirationReactionModal campaignName={CAMPAIGN} />);
    emitPrompt(offensePrompt());
    await screen.findByText(/Combat Inspiration - Offense/);

    emitCleared('HeroesFeastBard');

    expect(screen.queryByText(/Combat Inspiration - Offense/)).not.toBeInTheDocument();
  });

  it('the cleared echo dequeues only the creature whose key was cleared', async () => {
    render(<BardicInspirationReactionModal campaignName={CAMPAIGN} />);
    emitPrompt(defensePrompt());
    await screen.findByText(/Combat Inspiration - Defense/);

    // Another creature's prompt resolved remotely — this one survives.
    emitCleared('SomeOtherBard');
    expect(screen.getByText(/Combat Inspiration - Defense/)).toBeInTheDocument();
    expect(screen.getByText('HeroesFeastBard')).toBeInTheDocument();

    // The clear for THIS prompt's key finally lands — the twin evicts.
    emitCleared('HeroesFeastBard');
    expect(screen.queryByText(/Combat Inspiration - Defense/)).not.toBeInTheDocument();
  });

  it('never re-enqueues on null (no-re-enqueue law) and lets a fresh prompt mount afterwards', async () => {
    const { container } = render(<BardicInspirationReactionModal campaignName={CAMPAIGN} />);

    // A cleared echo with nothing mounted must not MOUNT anything (pre- and
    // post-eviction, including a payload-less echo shape).
    emitCleared('HeroesFeastBard');
    emit('HeroesFeastBard-biPrompt', undefined);
    expect(container.querySelector('.sp-overlay')).not.toBeInTheDocument();

    // The lane stays healthy for the next adjudication.
    emitPrompt(defensePrompt({ promptId: 'bi-cross-defense-2' }));
    expect(await screen.findByText(/Combat Inspiration - Defense/)).toBeInTheDocument();
  });

  it('a fresh value echo after a cleared echo revives the same promptId (key revived server-side)', async () => {
    render(<BardicInspirationReactionModal campaignName={CAMPAIGN} />);
    const prompt = defensePrompt();
    emitPrompt(prompt);
    await screen.findByText(/Combat Inspiration - Defense/);

    emitCleared('HeroesFeastBard');
    expect(screen.queryByText(/Combat Inspiration - Defense/)).not.toBeInTheDocument();

    // A legitimate re-POST recreates the server key — the modal re-mounts.
    emitPrompt(prompt);
    expect(await screen.findByText(/Combat Inspiration - Defense/)).toBeInTheDocument();
    expect(screen.getByText('HeroesFeastBard')).toBeInTheDocument();
  });

  it('a cross-tab eviction frees the active slot so the next prompt surfaces without a reconnect', async () => {
    render(<BardicInspirationReactionModal campaignName={CAMPAIGN} />);
    emitPrompt(defensePrompt());
    await screen.findByText(/Combat Inspiration - Defense/);

    emitCleared('HeroesFeastBard');
    expect(screen.queryByText(/Combat Inspiration - Defense/)).not.toBeInTheDocument();

    // A different creature's prompt arrives while nothing is mounted.
    emitPrompt(defensePrompt({ promptId: 'bi-cross-defense-3', targetName: 'TargetThree', attackerName: 'Orc', dieSize: 6 }));
    expect(await screen.findByText(/Combat Inspiration - Defense/)).toBeInTheDocument();
    expect(screen.getByText('TargetThree')).toBeInTheDocument();
  });

  it('a local Skip still evicts and the resolving tab ignores its own echoed null', async () => {
    const result = listenFor('bardic-inspiration-defense-result');
    render(<BardicInspirationReactionModal campaignName={CAMPAIGN} />);
    emitPrompt(defensePrompt());
    await screen.findByText(/Combat Inspiration - Defense/);

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(result).toHaveBeenCalledTimes(1);

    // The answering tab's own DELETE echo arrives — queue already empty, inert.
    emitCleared('HeroesFeastBard');
    expect(screen.queryByText(/Combat Inspiration - Defense/)).not.toBeInTheDocument();
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
