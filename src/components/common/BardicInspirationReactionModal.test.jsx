// @maintained-by-ai
// @improved-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import BardicInspirationReactionModal from './BardicInspirationReactionModal.jsx';
import { rollExpression } from '../../services/dice/diceRoller.js';
import { clearBardicInspiration } from '../../services/combat/auras/bardicInspirationState.js';
import { clearBardicInspirationPrompt } from '../../services/combat/prompts/bardicInspirationPromptUtils.js';

// ── Mocks ──
// The component talks to the world through three services and the SSE
// Subscriber; tests emit SSE-shaped events through the captured handleEvent
// and assert on dispatched result events + service calls.

vi.mock('../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../services/combat/auras/bardicInspirationState.js', () => ({
  clearBardicInspiration: vi.fn(),
}));

vi.mock('../../services/combat/prompts/bardicInspirationPromptUtils.js', () => ({
  clearBardicInspirationPrompt: vi.fn(),
  // Drain-on-close re-read seam: these lifecycle tests drive prompts through
  // the SSE echo lane only — an empty drain keeps the store invisible here
  // (the real store-driven drain is pinned in .queue-drain.test.jsx).
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

// Dead shape (bug-bi-defense-prompt-producer-orphaned, owner decision
// 2026-11-17): the producer was deleted and the modal refuses to mount any
// non-offense payload — the defense adjudication's single source of truth is
// the popup-inline `Bardic Inspiration - Defense (dN)` button (AttackResultPopup,
// fed by hitResolution.js applyBardicInspirationDefense). This fixture exists
// ONLY to pin that refusal.
const deadDefensePrompt = (overrides = {}) => ({
  promptId: 'bi-prompt-defense-1',
  mode: 'defense',
  targetName: 'TargetOne',
  attackerName: 'Goblin',
  attackRoll: 14,
  bonus: 3,
  effectiveAc: 16,
  dieSize: 6,
  ...overrides,
});

const offensePrompt = (overrides = {}) => ({
  promptId: 'bi-prompt-offense-1',
  mode: 'offense',
  // Distinct attacker/target so mode-dependent name handling is observable.
  attackerName: 'TargetOne',
  targetName: 'Goblin',
  dieSize: 8,
  ...overrides,
});

// Prompts arrive on the lane's canonical wildcard-key echo: `<attackerName>-biPrompt`
// carrying the RAW offense prompt payload (bardicInspirationPromptUtils routes every
// prompt through the campaign store, keyed on the ATTACKING creature; the modal is
// the sole consumer and mounts offense payloads only).
function emitPrompt(prompt, campaignName = CAMPAIGN) {
  act(() => {
    mockSubscriber.handleEvent({
      key: `change-${campaignName}-${prompt.attackerName}-biPrompt`,
      data: prompt,
    });
  });
}

function renderModal(campaignName = CAMPAIGN) {
  return render(<BardicInspirationReactionModal campaignName={campaignName} />);
}

// Window event listeners are removed automatically after each test.
let removeListeners = [];

function listenFor(eventName) {
  const handler = vi.fn();
  window.addEventListener(eventName, handler);
  removeListeners.push(() => window.removeEventListener(eventName, handler));
  return handler;
}

// ── Tests ──

describe('BardicInspirationReactionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rollExpression.mockReturnValue({ total: 5 });
  });

  afterEach(() => {
    removeListeners.forEach((fn) => fn());
    removeListeners = [];
  });

  // ── Presentation ──

  it('renders nothing until a prompt arrives', () => {
    renderModal();
    expect(document.querySelector('.sp-overlay')).not.toBeInTheDocument();
  });

  it('never mounts a defense-mode payload — the dead shared lane stays inert (single-shape lock)', async () => {
    const { container } = renderModal();

    emitPrompt(deadDefensePrompt());
    // A synthetic/API-seeded defense payload (the only way this shape ever
    // reached the key lane) must mount NOTHING: no overlay, no clear traffic.
    expect(container.querySelector('.sp-overlay')).not.toBeInTheDocument();
    expect(clearBardicInspirationPrompt).not.toHaveBeenCalled();
    expect(clearBardicInspiration).not.toHaveBeenCalled();

    // A malformed mode value is refused the same way.
    emitPrompt(offensePrompt({ promptId: 'bi-bogus-mode', mode: 'whatever' }));
    expect(container.querySelector('.sp-overlay')).not.toBeInTheDocument();

    // The lane stays healthy for the real offense shape afterwards.
    emitPrompt(offensePrompt());
    expect(await screen.findByText(/Combat Inspiration - Offense/)).toBeInTheDocument();
  });

  it('presents an offense prompt naming the attacker who hit, offering the damage die', async () => {
    renderModal();

    emitPrompt(offensePrompt());

    expect(await screen.findByText(/Combat Inspiration - Offense/)).toBeInTheDocument();
    expect(screen.getByText('TargetOne')).toBeInTheDocument();
    expect(screen.getByText(/hit/)).toBeInTheDocument();
    expect(screen.getByText(/roll your Bardic Inspiration die \(d8\) and add to the damage/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Use Reaction & Roll/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
    expect(screen.queryByText(/vs AC/)).not.toBeInTheDocument();
  });

  // ── Use reaction ──

  it('uses reaction on offense: rolls the die, reports success, clears the attacker (not the target) prompt and consumption, closes modal', async () => {
    rollExpression.mockReturnValue({ total: 3 });
    const result = listenFor('bardic-inspiration-offense-result');
    renderModal();

    emitPrompt(offensePrompt());
    await screen.findByText(/Combat Inspiration - Offense/);

    fireEvent.click(screen.getByRole('button', { name: /Use Reaction & Roll/ }));

    expect(result).toHaveBeenCalledTimes(1);
    expect(result.mock.calls[0][0].detail).toEqual({
      promptId: 'bi-prompt-offense-1',
      used: true,
      biRoll: 3,
    });
    expect(rollExpression).toHaveBeenCalledWith('1d8');
    // The attacker spends their own inspiration — the attacker's prompt/uses clear.
    expect(clearBardicInspirationPrompt).toHaveBeenCalledWith(CAMPAIGN, 'TargetOne');
    expect(clearBardicInspirationPrompt).not.toHaveBeenCalledWith(CAMPAIGN, 'Goblin');
    expect(clearBardicInspiration).toHaveBeenCalledWith('TargetOne', CAMPAIGN);
    expect(clearBardicInspiration).not.toHaveBeenCalledWith('Goblin', CAMPAIGN);
    expect(screen.queryByText(/Combat Inspiration - Offense/)).not.toBeInTheDocument();
  });

  it.each([
    ['null', null],
    ['an object without a total', {}],
  ])('treats a failed roll (%s) as biRoll 0 but still reports the reaction as used', async (_label, rollResult) => {
    rollExpression.mockReturnValue(rollResult);
    const result = listenFor('bardic-inspiration-offense-result');
    renderModal();

    emitPrompt(offensePrompt());
    await screen.findByText(/Combat Inspiration - Offense/);

    fireEvent.click(screen.getByRole('button', { name: /Use Reaction & Roll/ }));

    expect(result).toHaveBeenCalledTimes(1);
    expect(result.mock.calls[0][0].detail).toEqual({
      promptId: 'bi-prompt-offense-1',
      used: true,
      biRoll: 0,
    });
  });

  // ── Skip ──

  it('skipping offense declines without rolling, evicts the attacker prompt and consumes nothing', async () => {
    const result = listenFor('bardic-inspiration-offense-result');
    renderModal();

    emitPrompt(offensePrompt());
    await screen.findByText(/Combat Inspiration - Offense/);

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

    expect(result).toHaveBeenCalledTimes(1);
    expect(result.mock.calls[0][0].detail).toEqual({
      promptId: 'bi-prompt-offense-1',
      used: false,
    });
    expect(rollExpression).not.toHaveBeenCalled();
    expect(clearBardicInspirationPrompt).toHaveBeenCalledWith(CAMPAIGN, 'TargetOne');
    expect(clearBardicInspirationPrompt).not.toHaveBeenCalledWith(CAMPAIGN, 'Goblin');
    expect(clearBardicInspiration).not.toHaveBeenCalled();
    expect(screen.queryByText(/Combat Inspiration - Offense/)).not.toBeInTheDocument();
  });

  // ── Overlay is inert (adjudication prompts wait indefinitely) ──

  it('does nothing when the overlay backdrop is clicked', async () => {
    const offenseResult = listenFor('bardic-inspiration-offense-result');
    renderModal();

    emitPrompt(offensePrompt());
    await screen.findByText(/Combat Inspiration - Offense/);

    fireEvent.click(document.querySelector('.sp-overlay'));

    expect(offenseResult).not.toHaveBeenCalled();
    expect(clearBardicInspirationPrompt).not.toHaveBeenCalled();
    expect(clearBardicInspiration).not.toHaveBeenCalled();
    expect(screen.getByText(/Combat Inspiration - Offense/)).toBeInTheDocument();
  });

  // ── Prompt lifecycle ──

  it('shows one prompt at a time, ignoring later prompts until the active one is dismissed', async () => {
    renderModal();

    emitPrompt(offensePrompt());
    await screen.findByText(/Combat Inspiration - Offense/);

    // A second prompt while one is active must not replace the visible one.
    emitPrompt(offensePrompt({ promptId: 'bi-prompt-offense-2', attackerName: 'AttackerThree', targetName: 'Orc', dieSize: 10 }));
    expect(screen.getByText('TargetOne')).toBeInTheDocument();
    expect(screen.queryByText('AttackerThree')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(screen.queryByText(/Combat Inspiration - Offense/)).not.toBeInTheDocument();

    // After dismissal, new prompts are accepted again with fresh content.
    emitPrompt(offensePrompt({ promptId: 'bi-prompt-offense-2', attackerName: 'AttackerThree', targetName: 'Orc', dieSize: 10 }));
    expect(await screen.findByText(/Combat Inspiration - Offense/)).toBeInTheDocument();
    expect(screen.getByText('AttackerThree')).toBeInTheDocument();
    expect(screen.getByText(/roll your Bardic Inspiration die \(d10\) and add to the damage/)).toBeInTheDocument();
  });

  it('does not queue the same promptId twice — one Skip permanently dismisses it', async () => {
    const result = listenFor('bardic-inspiration-offense-result');
    renderModal();
    const prompt = offensePrompt();

    emitPrompt(prompt);
    await screen.findByText(/Combat Inspiration - Offense/);

    emitPrompt(prompt); // duplicate delivery — must be ignored

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

    expect(result).toHaveBeenCalledTimes(1);
    // If the duplicate had been queued, a second modal would reappear here.
    expect(screen.queryByText(/Combat Inspiration - Offense/)).not.toBeInTheDocument();
  });

  // ── Eviction is the clear lane's job (see bardicInspirationPromptUtils.test.js):
  // Skip/Resolve route through clearBardicInspirationPrompt (asserted above); its
  // wildcard DELETE answers with a null echo the listener must treat as inert —
  // never a re-enqueue (the resurrection face of bug-bi-prompt-skip-never-evicts-server-key).

  it.each([
    ['no key', { data: offensePrompt() }],
    ['no data', { key: 'change-test-campaign-TargetOne-biPrompt' }],
    ['a null payload (the DELETE eviction echo)', { key: 'change-test-campaign-TargetOne-biPrompt', data: null }],
    ['a prompt payload without a promptId', { key: 'change-test-campaign-TargetOne-biPrompt', data: { mode: 'offense' } }],
    ['an unrelated key', { key: 'change-test-campaign-TargetOne-somethingElse', data: { foo: 1 } }],
    ['the retired biPromptCleared handshake shape', { key: 'change-test-campaign-TargetOne-biPromptCleared', data: { promptId: 'bi-prompt-offense-1' } }],
  ])('ignores malformed SSE events (%s) without rendering or throwing', async (_label, event) => {
    const { container } = renderModal();

    act(() => {
      mockSubscriber.handleEvent(event);
    });

    expect(container.querySelector('.sp-overlay')).not.toBeInTheDocument();
    expect(clearBardicInspirationPrompt).not.toHaveBeenCalled();
  });
});
