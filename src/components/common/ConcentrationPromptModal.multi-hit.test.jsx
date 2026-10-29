// @maintained-by-ai
// ConcentrationPromptModal — same-target MULTI-HIT prompts (bug-concentration-multi-hit-prompt-collapse)
//
// RAW: multiple damage instances on a concentrating target = multiple CON
// saves. Pre-fix, every hit POSTed the SAME `concentrationPrompt-<Target>`
// change-data key (N hits collapsed to 1 stored prompt) and answering any
// prompt DELETEd the key by target name — the null echo then dropped EVERY
// un-adjudicated entry for that target on every client. Result: the second
// save never appeared, never rolled, and produced no roll:concentration-save
// log row while the concentration (wrongly) persisted.
//
// Fix contract locked here (promptId-scoped lane):
// - prompts arrive under `concentrationPrompt-<Target>-<promptId>` keys, so
//   two same-target hits queue TWO checks ((1 of 2) header);
// - resolving A (Roll + Done) ADVANCES to B — B gets its own roll and its
//   own sendConcentrationResult submission (one save per damage event);
// - clears are promptId-scoped: answering A never DELETEs B's key;
// - a passive tab's null echo for `<Target>-<promptIdA>` drops only A, so
//   B stays live and rollable there too;
// - legacy target-wide clears (key suffix = bare target name, e.g. staged
//   rig writes) still drop that target's un-adjudicated checks
//   (the 6b1800fa2 cross-tab contract).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';
import { rollD20 } from '../../services/dice/diceRoller.js';
import { sendConcentrationResult, clearConcentrationPrompt } from '../../services/combat/conditions/savePromptService.js';
import { computeAuraBonus } from '../../services/combat/auras/auraOfProtection.js';
import ConcentrationPromptModal from './ConcentrationPromptModal.jsx';

const CAMPAIGN = 'test-campaign';
const TARGET = 'testTarget';
const PROMPT_A = 'multi-hit-1';
const PROMPT_B = 'multi-hit-2';

// ── Seams (mirrors ConcentrationPromptModal.cross-tab.test.jsx) ──

vi.mock('../../services/dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
}));

vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
  sendConcentrationResult: vi.fn(),
  clearConcentrationPrompt: vi.fn(),
}));

vi.mock('../../services/combat/auras/auraOfProtection.js', () => ({
  computeAuraBonus: vi.fn(async () => ({ bonus: 0, sourceName: null })),
}));

// SSE seam: keep the live handleEvent on a global so tests fire arbitrary
// events into the mounted component (same semantics as the button-based mocks
// in the sibling suites — events land in the current render's state).
vi.mock('./Subscriber.jsx', () => {
  function MockSubscriber({ handleEvent, campaignName }) {
    const handlerRef = React.useRef(handleEvent);
    handlerRef.current = handleEvent;
    globalThis.__fireConcentrationEvent = (event) => handlerRef.current(event);
    return React.createElement('div', { 'data-testid': 'subscriber', 'data-campaign': campaignName });
  }
  return { default: MockSubscriber };
});

const MockEventSource = vi.fn();
MockEventSource.prototype.close = vi.fn();

// ── Helpers ──

function promptEvent(promptId, extra = {}) {
  return {
    key: `change-${CAMPAIGN}-concentrationPrompt-${TARGET}-${promptId}`,
    data: { promptId, targetName: TARGET, spellName: 'Hex', dc: 10, attackerName: 'Goblin', ...extra },
  };
}

function clearedEvent(suffix) {
  return { key: `change-${CAMPAIGN}-concentrationPrompt-${suffix}`, data: null };
}

function makeRoller() {
  return {
    name: TARGET,
    computedStats: { abilities: [{ name: 'Constitution', bonus: 3 }] }, // CON save +3
  };
}

function fire(event) {
  act(() => {
    globalThis.__fireConcentrationEvent(event);
  });
}

async function rollAndSeeResult(buttonName = /roll con save/i) {
  fireEvent.click(screen.getByRole('button', { name: buttonName }));
  await waitFor(() => { expect(screen.getByText(/CONCENTRATION (MAINTAINED|BROKEN)/i)).toBeInTheDocument(); });
}

// ── Tests ──

describe('ConcentrationPromptModal same-target multi-hit queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(globalThis, 'EventSource', { value: MockEventSource, writable: true, configurable: true });
    vi.mocked(rollD20).mockReturnValue(10);
    vi.mocked(computeAuraBonus).mockResolvedValue({ bonus: 0, sourceName: null });
  });

  afterEach(() => {
    delete globalThis.EventSource;
  });

  it('queues one check per same-target damage event and advances A → B so each gets its own save', async () => {
    render(<ConcentrationPromptModal campaignName={CAMPAIGN} characters={[makeRoller()]} activeMapName={null} />);

    fire(promptEvent(PROMPT_A));
    await waitFor(() => { expect(screen.getByText(/must make a/i)).toBeInTheDocument(); });
    fire(promptEvent(PROMPT_B));
    await waitFor(() => { expect(screen.getByText('(1 of 2)')).toBeInTheDocument(); });

    // Adjudicate A: success (10 + 3 ≥ DC 10).
    await rollAndSeeResult();
    expect(sendConcentrationResult).toHaveBeenCalledTimes(1);
    expect(sendConcentrationResult.mock.calls[0][2].promptId).toBe(PROMPT_A);
    // A's clear is promptId-scoped — it must not touch the target-wide key.
    expect(clearConcentrationPrompt).toHaveBeenCalledWith(CAMPAIGN, TARGET, PROMPT_A);

    fireEvent.click(screen.getByRole('button', { name: 'Next Check' }));

    // B survives A's resolution: its own prompt is up with a fresh Roll.
    await waitFor(() => { expect(screen.getByRole('button', { name: /roll con save/i })).toBeInTheDocument(); });
    expect(screen.getByText(/CONSTITUTION/i)).toBeInTheDocument();

    await rollAndSeeResult();
    expect(sendConcentrationResult).toHaveBeenCalledTimes(2);
    expect(sendConcentrationResult.mock.calls[1][2].promptId).toBe(PROMPT_B);
    expect(clearConcentrationPrompt).toHaveBeenCalledWith(CAMPAIGN, TARGET, PROMPT_B);
    // One roll per damage event — two saves for two hits.
    expect(rollD20).toHaveBeenCalledTimes(2);
  });

  it('a per-promptId null echo drops only that prompt, keeping the sibling save live', async () => {
    render(<ConcentrationPromptModal campaignName={CAMPAIGN} characters={[makeRoller()]} activeMapName={null} />);

    fire(promptEvent(PROMPT_A));
    fire(promptEvent(PROMPT_B));
    await waitFor(() => { expect(screen.getByText('(1 of 2)')).toBeInTheDocument(); });

    // Another client answered A: DELETE echo on A's key only.
    fire(clearedEvent(`${TARGET}-${PROMPT_A}`));

    // B advances and stays rollable — never silently voided.
    await waitFor(() => { expect(screen.getByRole('button', { name: /roll con save/i })).toBeInTheDocument(); });
    expect(sendConcentrationResult).not.toHaveBeenCalled();
    expect(rollD20).not.toHaveBeenCalled();

    await rollAndSeeResult();
    expect(sendConcentrationResult).toHaveBeenCalledTimes(1);
    expect(sendConcentrationResult.mock.calls[0][2].promptId).toBe(PROMPT_B);
  });

  it('a legacy target-only null echo still drops every un-adjudicated check for that target', async () => {
    render(<ConcentrationPromptModal campaignName={CAMPAIGN} characters={[makeRoller()]} activeMapName={null} />);

    fire(promptEvent(PROMPT_A));
    fire(promptEvent(PROMPT_B));
    await waitFor(() => { expect(screen.getByText('(1 of 2)')).toBeInTheDocument(); });

    // Staged/legacy clear lane: key without a promptId suffix.
    fire(clearedEvent(TARGET));
    await waitFor(() => { expect(screen.queryByText(/must make a/i)).not.toBeInTheDocument(); });
    expect(sendConcentrationResult).not.toHaveBeenCalled();
    expect(rollD20).not.toHaveBeenCalled();
  });

  it('dismisses A promptId-scoped and advances to B without spending a save', async () => {
    render(<ConcentrationPromptModal campaignName={CAMPAIGN} characters={[makeRoller()]} activeMapName={null} />);

    fire(promptEvent(PROMPT_A));
    fire(promptEvent(PROMPT_B));
    await waitFor(() => { expect(screen.getByText('(1 of 2)')).toBeInTheDocument(); });

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    await waitFor(() => { expect(screen.getByRole('button', { name: /roll con save/i })).toBeInTheDocument(); });
    expect(clearConcentrationPrompt).toHaveBeenCalledWith(CAMPAIGN, TARGET, PROMPT_A);
    expect(sendConcentrationResult).not.toHaveBeenCalled();
  });
});
