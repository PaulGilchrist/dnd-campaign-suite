// @maintained-by-ai
// ConcentrationPromptModal — cross-tab resolution (bug-concentration-prompt-stale-cross-tab-double-roll)
//
// Locks the resolution contract for passive clients: once any client answers a
// concentration check, the server DELETEs `concentrationPrompt-<Target>-<promptId>`
// (per-promptId key since the multi-hit collapse fix) and
// broadcasts a null echo — every OTHER client must close its queued check for
// that target (the pre-fix component dropped the null echo at the top of
// handleEvent, leaving stale tabs a live "Roll Con Save" that spent a second
// save and logged a duplicate concentration-save row for one damage event).
// Also locks: the acting client's own result panel survives its own DELETE
// echo until Done; a resolved promptId can never re-roll (result-echo seen
// stamp); and Dismiss clears the server key instead of orphaning it.
//
// Queue/roll/outcome math lives in ConcentrationPromptModal.test.jsx — not
// repeated here.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { rollD20 } from '../../services/dice/diceRoller.js';
import { sendConcentrationResult, clearConcentrationPrompt } from '../../services/combat/conditions/savePromptService.js';
import { computeAuraBonus } from '../../services/combat/auras/auraOfProtection.js';
import ConcentrationPromptModal from './ConcentrationPromptModal.jsx';

const CAMPAIGN = 'test-campaign';
const ROLLER = 'testTarget';
const OTHER = 'testTarget2';

// ── Seams (mirrors ConcentrationPromptModal.test.jsx) ──

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

// SSE seam: buttons dispatch one campaign-scoped event each through the real
// handler chain, exactly as the production Subscriber delivers them.
vi.mock('./Subscriber.jsx', () => {
  function MockSubscriber({ handleEvent, campaignName }) {
    const handlerRef = React.useRef(handleEvent);
    handlerRef.current = handleEvent;
    const fire = (event) => handlerRef.current(event);
    const button = (testId, event) =>
      React.createElement('button', { 'data-testid': testId, onClick: () => fire(event) });
    return React.createElement(
      'div',
      { 'data-testid': 'subscriber', 'data-campaign': campaignName },
      button('prompt', {
        key: `change-${campaignName}-concentrationPrompt-${ROLLER}-test-prompt-1`,
        data: { promptId: 'test-prompt-1', targetName: ROLLER, spellName: 'Bless', dc: 10, attackerName: 'Goblin' },
      }),
      // Passive-tab mirror of another client's clearConcentrationPrompt DELETE
      // (per-promptId key since the multi-hit collapse fix).
      button('prompt-cleared', {
        key: `change-${campaignName}-concentrationPrompt-${ROLLER}-test-prompt-1`,
        data: null,
      }),
      button('other-target-cleared', {
        key: `change-${campaignName}-concentrationPrompt-${OTHER}-some-other-prompt`,
        data: null,
      }),
      // Another client's submitted result broadcast (sendConcentrationResult POST).
      button('result-echo', {
        key: `change-${campaignName}-concentrationResult-${ROLLER}`,
        data: { promptId: 'test-prompt-1', success: true, total: 27 },
      }),
    );
  }
  return { default: MockSubscriber };
});

const MockEventSource = vi.fn();
MockEventSource.prototype.close = vi.fn();

// ── Helpers ──

function makeRoller() {
  return {
    name: ROLLER,
    computedStats: { abilities: [{ name: 'Constitution', bonus: 3 }] }, // CON save +3
  };
}

async function openPrompt() {
  render(<ConcentrationPromptModal campaignName={CAMPAIGN} characters={[makeRoller()]} activeMapName={null} />);
  fireEvent.click(screen.getByTestId('prompt'));
  await waitFor(() => { expect(screen.getByText(/must make a/i)).toBeInTheDocument(); });
}

async function rollAndSeeResult() {
  fireEvent.click(screen.getByRole('button', { name: /roll con save/i }));
  await waitFor(() => { expect(screen.getByText(/CONCENTRATION (MAINTAINED|BROKEN)/i)).toBeInTheDocument(); });
}

// ── Tests ──

describe('ConcentrationPromptModal cross-tab resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(globalThis, 'EventSource', { value: MockEventSource, writable: true, configurable: true });
    vi.mocked(rollD20).mockReturnValue(10);
    vi.mocked(computeAuraBonus).mockResolvedValue({ bonus: 0, sourceName: null });
  });

  afterEach(() => {
    delete globalThis.EventSource;
  });

  it('closes the queued check when the prompt key is DELETE-echoed as null', async () => {
    await openPrompt();
    fireEvent.click(screen.getByTestId('prompt-cleared'));
    await waitFor(() => { expect(screen.queryByText(/must make a/i)).not.toBeInTheDocument(); });
    // A closed passive client never spends the save it no longer owns.
    expect(screen.queryByRole('button', { name: /roll con save/i })).not.toBeInTheDocument();
    expect(sendConcentrationResult).not.toHaveBeenCalled();
    expect(rollD20).not.toHaveBeenCalled();
  });

  it('keeps the acting client\'s result panel open through its own DELETE echo', async () => {
    await openPrompt();
    await rollAndSeeResult();
    // The roll itself clears the server key — the echo must not wipe the
    // just-shown result before the user reads it and clicks Done.
    fireEvent.click(screen.getByTestId('prompt-cleared'));
    await waitFor(() => { expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument(); });
    expect(screen.getByText(/CONCENTRATION MAINTAINED/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => { expect(screen.queryByText(/must make a/i)).not.toBeInTheDocument(); });
    expect(sendConcentrationResult).toHaveBeenCalledTimes(1);
  });

  it('ignores a null echo that names a different target', async () => {
    await openPrompt();
    fireEvent.click(screen.getByTestId('other-target-cleared'));
    expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /roll con save/i })).toBeInTheDocument();
  });

  it('refuses to re-roll after a remote concentrationResult echo resolves the prompt', async () => {
    await openPrompt();
    // Remote resolution broadcast lands while the stale entry is still queued
    // (echo ordering racing the DELETE-echo close must still spend one save).
    fireEvent.click(screen.getByTestId('result-echo'));
    fireEvent.click(screen.getByRole('button', { name: /roll con save/i }));
    await waitFor(() => { expect(screen.queryByText(/must make a/i)).not.toBeInTheDocument(); });
    expect(sendConcentrationResult).not.toHaveBeenCalled();
    expect(rollD20).not.toHaveBeenCalled();
  });

  it('submits exactly one result when the Roll button is double-clicked', async () => {
    render(<ConcentrationPromptModal campaignName={CAMPAIGN} characters={[makeRoller()]} activeMapName={null} />);
    fireEvent.click(screen.getByTestId('prompt'));
    await waitFor(() => { expect(screen.getByText(/must make a/i)).toBeInTheDocument(); });
    const rollBtn = screen.getByRole('button', { name: /roll con save/i });
    // Both clicks land in the same tick — before the async roll settles — so
    // only the resolved-promptId stamp keeps the second click inert.
    fireEvent.click(rollBtn);
    fireEvent.click(rollBtn);
    await waitFor(() => { expect(screen.getByText(/CONCENTRATION MAINTAINED/i)).toBeInTheDocument(); });
    expect(sendConcentrationResult).toHaveBeenCalledTimes(1);
    expect(rollD20).toHaveBeenCalledTimes(1);
  });

  it('dismiss clears the server prompt key (no stale orphan for other clients)', async () => {
    await openPrompt();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    await waitFor(() => { expect(screen.queryByText(/must make a/i)).not.toBeInTheDocument(); });
    expect(clearConcentrationPrompt).toHaveBeenCalledWith(CAMPAIGN, ROLLER, 'test-prompt-1');
    expect(sendConcentrationResult).not.toHaveBeenCalled();
    expect(rollD20).not.toHaveBeenCalled();
  });
});
