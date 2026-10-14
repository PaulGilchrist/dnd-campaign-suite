// @improved-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
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

function emitPrompt(prompt, campaignName = CAMPAIGN) {
  act(() => {
    mockSubscriber.handleEvent({
      key: `change-${campaignName}-${prompt.targetName}-biPrompt`,
      data: { biPrompt: prompt },
    });
  });
}

function emitCleared(targetName, promptId, campaignName = CAMPAIGN) {
  act(() => {
    mockSubscriber.handleEvent({
      key: `change-${campaignName}-${targetName}-biPromptCleared`,
      data: { promptId },
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

  it('presents a defense prompt with the attack math and both choices', async () => {
    renderModal();

    emitPrompt(defensePrompt());

    expect(await screen.findByText(/Combat Inspiration - Defense/)).toBeInTheDocument();
    expect(screen.getByText('TargetOne')).toBeInTheDocument();
    expect(screen.getByText('Goblin')).toBeInTheDocument();
    expect(screen.getByText(/Attack: d20\(14\) \+ 3 = 17 vs AC 16/)).toBeInTheDocument();
    expect(screen.getByText(/roll your Bardic Inspiration die \(d6\) and add to your AC/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Use Reaction & Roll/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
    expect(screen.queryByText(/Combat Inspiration - Offense/)).not.toBeInTheDocument();
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

  it('uses reaction on defense: rolls 1d6, reports success, clears defender prompt and consumption, closes modal', async () => {
    rollExpression.mockReturnValue({ total: 4 });
    const result = listenFor('bardic-inspiration-defense-result');
    renderModal();

    emitPrompt(defensePrompt());
    await screen.findByText(/Combat Inspiration - Defense/);

    fireEvent.click(screen.getByRole('button', { name: /Use Reaction & Roll/ }));

    expect(result).toHaveBeenCalledTimes(1);
    expect(result.mock.calls[0][0].detail).toEqual({
      promptId: 'bi-prompt-defense-1',
      used: true,
      biRoll: 4,
    });
    expect(rollExpression).toHaveBeenCalledWith('1d6');
    expect(clearBardicInspirationPrompt).toHaveBeenCalledWith(CAMPAIGN, 'TargetOne');
    expect(clearBardicInspiration).toHaveBeenCalledWith('TargetOne', CAMPAIGN);
    expect(screen.queryByText(/Combat Inspiration - Defense/)).not.toBeInTheDocument();
  });

  it('uses reaction on offense: rolls the die and clears the attacker (not the target)', async () => {
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
    const result = listenFor('bardic-inspiration-defense-result');
    renderModal();

    emitPrompt(defensePrompt());
    await screen.findByText(/Combat Inspiration - Defense/);

    fireEvent.click(screen.getByRole('button', { name: /Use Reaction & Roll/ }));

    expect(result).toHaveBeenCalledTimes(1);
    expect(result.mock.calls[0][0].detail).toEqual({
      promptId: 'bi-prompt-defense-1',
      used: true,
      biRoll: 0,
    });
  });

  // ── Skip ──

  it('skipping defense declines without rolling or consuming inspiration', async () => {
    const result = listenFor('bardic-inspiration-defense-result');
    renderModal();

    emitPrompt(defensePrompt());
    await screen.findByText(/Combat Inspiration - Defense/);

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

    expect(result).toHaveBeenCalledTimes(1);
    expect(result.mock.calls[0][0].detail).toEqual({
      promptId: 'bi-prompt-defense-1',
      used: false,
    });
    expect(rollExpression).not.toHaveBeenCalled();
    expect(clearBardicInspirationPrompt).toHaveBeenCalledWith(CAMPAIGN, 'TargetOne');
    expect(clearBardicInspiration).not.toHaveBeenCalled();
    expect(screen.queryByText(/Combat Inspiration - Defense/)).not.toBeInTheDocument();
  });

  it('skipping offense declines on the attacker and clears the attacker prompt', async () => {
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
    const defenseResult = listenFor('bardic-inspiration-defense-result');
    renderModal();

    emitPrompt(defensePrompt());
    await screen.findByText(/Combat Inspiration - Defense/);

    fireEvent.click(document.querySelector('.sp-overlay'));

    expect(defenseResult).not.toHaveBeenCalled();
    expect(clearBardicInspirationPrompt).not.toHaveBeenCalled();
    expect(clearBardicInspiration).not.toHaveBeenCalled();
    expect(screen.getByText(/Combat Inspiration - Defense/)).toBeInTheDocument();
  });

  // ── Prompt lifecycle ──

  it('shows one prompt at a time, ignoring later prompts until the active one is dismissed', async () => {
    renderModal();

    emitPrompt(defensePrompt());
    await screen.findByText(/Combat Inspiration - Defense/);

    // A second prompt while one is active must not replace the visible one.
    emitPrompt(defensePrompt({ promptId: 'bi-prompt-defense-2', targetName: 'TargetThree', attackerName: 'Orc', dieSize: 8 }));
    expect(screen.getByText('TargetOne')).toBeInTheDocument();
    expect(screen.queryByText('TargetThree')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(screen.queryByText(/Combat Inspiration - Defense/)).not.toBeInTheDocument();

    // After dismissal, new prompts are accepted again with fresh content.
    emitPrompt(defensePrompt({ promptId: 'bi-prompt-defense-2', targetName: 'TargetThree', attackerName: 'Orc', dieSize: 8 }));
    expect(await screen.findByText(/Combat Inspiration - Defense/)).toBeInTheDocument();
    expect(screen.getByText('TargetThree')).toBeInTheDocument();
    expect(screen.getByText(/roll your Bardic Inspiration die \(d8\) and add to your AC/)).toBeInTheDocument();
  });

  it('does not queue the same promptId twice — one Skip permanently dismisses it', async () => {
    const result = listenFor('bardic-inspiration-defense-result');
    renderModal();
    const prompt = defensePrompt();

    emitPrompt(prompt);
    await screen.findByText(/Combat Inspiration - Defense/);

    emitPrompt(prompt); // duplicate delivery — must be ignored

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

    expect(result).toHaveBeenCalledTimes(1);
    // If the duplicate had been queued, a second modal would reappear here.
    expect(screen.queryByText(/Combat Inspiration - Defense/)).not.toBeInTheDocument();
  });

  it('removes the prompt when a matching biPromptCleared event arrives', async () => {
    renderModal();

    emitPrompt(defensePrompt());
    await screen.findByText(/Combat Inspiration - Defense/);

    emitCleared('TargetOne', 'bi-prompt-defense-1');

    await waitFor(() => {
      expect(screen.queryByText(/Combat Inspiration - Defense/)).not.toBeInTheDocument();
    });
  });

  it('leaves the prompt visible when biPromptCleared names a different promptId', async () => {
    renderModal();

    emitPrompt(defensePrompt());
    await screen.findByText(/Combat Inspiration - Defense/);

    // Only promptId decides removal — a stale/other promptId must not dismiss it.
    emitCleared('TargetOne', 'some-other-prompt');

    expect(screen.getByText(/Combat Inspiration - Defense/)).toBeInTheDocument();
  });

  it('ignores a biPromptCleared event from another campaign', async () => {
    renderModal();

    emitPrompt(defensePrompt());
    await screen.findByText(/Combat Inspiration - Defense/);

    emitCleared('TargetOne', 'bi-prompt-defense-1', 'other-campaign');

    expect(screen.getByText(/Combat Inspiration - Defense/)).toBeInTheDocument();
  });

  it.each([
    ['no key', { data: { biPrompt: defensePrompt() } }],
    ['no data', { key: 'change-test-campaign-TargetOne-biPrompt' }],
    ['biPrompt without a promptId', { key: 'change-test-campaign-TargetOne-biPrompt', data: { biPrompt: { mode: 'defense' } } }],
    ['an unrelated key', { key: 'change-test-campaign-TargetOne-somethingElse', data: { foo: 1 } }],
    ['a biPromptCleared without promptId', { key: 'change-test-campaign-TargetOne-biPromptCleared', data: {} }],
  ])('ignores malformed SSE events (%s) without rendering or throwing', async (_label, event) => {
    const { container } = renderModal();

    act(() => {
      mockSubscriber.handleEvent(event);
    });

    expect(container.querySelector('.sp-overlay')).not.toBeInTheDocument();
    expect(clearBardicInspirationPrompt).not.toHaveBeenCalled();
  });
});
