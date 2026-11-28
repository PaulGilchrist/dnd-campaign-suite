// @maintained-by-ai 2026-11-27 (improved-and-trimmed)
// ConcentrationPromptModal — queue management, roll submission, and result display.
//
// Mock boundaries (true seams only): dice (determinism), the network send
// (savePromptService), the Aura of Protection service, and the SSE Subscriber
// (used solely to inject events). The roll resolution (concentrationPromptRoll)
// and every selector it uses (getAbilitySaveBonus, hasSaveModifier,
// getHolyAuraSaveAdvantage, getActiveTargetEffect, getCombatSummary) run as
// REAL code against realistic character data shapes — advantage/disadvantage
// must emerge from actual modifiers, never from a pinned mock return.
//
// Covered elsewhere, not repeated here:
// - Holy Aura te advantage end-to-end AND the advantage/disadvantage offset
//   into one plain d20: ConcentrationPromptModal.holy-aura.test.jsx
// - resolveConcentrationRoll te-disadvantage math + Starry floor on a
//   keep-low die: concentrationPromptRoll.te-disadvantage.test.js
// - cross-tab null echoes, result-echo re-roll refusal, Roll double-click
//   latch: ConcentrationPromptModal.cross-tab.test.jsx
// - same-target multi-hit promptId scoping: ConcentrationPromptModal.multi-hit.test.jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import React from 'react';
import { rollD20 } from '../../services/dice/diceRoller.js';
import { sendConcentrationResult, clearConcentrationPrompt } from '../../services/combat/conditions/savePromptService.js';
import { computeAuraBonus } from '../../services/combat/auras/auraOfProtection.js';
import ConcentrationPromptModal from './ConcentrationPromptModal.jsx';

const CAMPAIGN = 'test-campaign';
const ROLLER = 'testTarget';
const ROLLER2 = 'testTarget2';

// ── Seams ──

vi.mock('../../services/dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
}));

// Network boundary — assertions here are the client↔server contract.
vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
  sendConcentrationResult: vi.fn(),
  clearConcentrationPrompt: vi.fn(),
}));

// Aura of Protection is a separate service with its own test suite; pinned
// neutral except where a test exercises the bonus pass-through.
vi.mock('../../services/combat/auras/auraOfProtection.js', () => ({
  computeAuraBonus: vi.fn(async () => ({ bonus: 0, sourceName: null })),
}));

// SSE seam: injects runtime-store change events exactly as the real
// Subscriber would deliver them.
vi.mock('./Subscriber.jsx', () => {
  function MockSubscriber({ handleEvent, campaignName }) {
    // Hold the latest handler in a ref so events fired from any render land
    // in the live component's state (mirrors the real subscriber's semantics).
    const handlerRef = React.useRef(handleEvent);
    handlerRef.current = handleEvent;
    const fire = (event) => handlerRef.current(event);
    return React.createElement(
      'div',
      { 'data-testid': 'subscriber', 'data-campaign': campaignName },
      React.createElement('button', {
        'data-testid': 'subscriber-trigger',
        onClick: () => fire({
          key: `change-${campaignName}-concentrationPrompt-${ROLLER}-test-prompt-1`,
          data: { promptId: 'test-prompt-1', targetName: ROLLER, spellName: 'Bless', dc: 10, attackerName: 'Elarielle' },
        }),
      }),
      React.createElement('button', {
        'data-testid': 'subscriber-trigger-second',
        onClick: () => fire({
          key: `change-${campaignName}-concentrationPrompt-${ROLLER2}-test-prompt-2`,
          data: { promptId: 'test-prompt-2', targetName: ROLLER2, spellName: 'Haste', dc: 13 },
        }),
      }),
      React.createElement('button', {
        'data-testid': 'subscriber-trigger-other-channel',
        onClick: () => fire({
          key: `change-${campaignName}-savePrompt-${ROLLER}`,
          data: { promptId: 'other-1', targetName: ROLLER, saveType: 'DEX', dc: 15 },
        }),
      }),
    );
  }
  return { default: MockSubscriber };
});

// jsdom has no EventSource; the component gates <Subscriber> on its presence.
const MockEventSource = vi.fn();
MockEventSource.prototype.close = vi.fn();

// ── Fixtures (shapes the REAL selectors consume) ──

function makeRoller(extra = {}) {
  return {
    name: ROLLER,
    computedStats: { abilities: [{ name: 'Constitution', bonus: 3 }] }, // → CON save +3
    ...extra,
  };
}

const CON_ADVANTAGE_MOD = { source: 'Oath of Devotion', target: 'concentration_saving_throws', effect: 'advantage', abilities: ['CON'] };
const BREAKER_ATTACKER = {
  name: 'Elarielle',
  saveModifiers: [{ source: 'Mage Slayer', target: 'saving_throw', condition: 'concentration_breaker', effect: 'disadvantage', abilities: ['CON'] }],
};

// ── Helpers ──

async function openPrompt(characters = [makeRoller()], triggerTestId = 'subscriber-trigger') {
  render(<ConcentrationPromptModal campaignName={CAMPAIGN} characters={characters} activeMapName={null} />);
  fireEvent.click(screen.getByTestId(triggerTestId));
  await waitFor(() => { expect(screen.getByText(/must make a/i)).toBeInTheDocument(); });
}

async function rollAndSeeResult() {
  fireEvent.click(screen.getByRole('button', { name: /roll con save/i }));
  await waitFor(() => { expect(screen.getByText(/CONCENTRATION (MAINTAINED|BROKEN)/i)).toBeInTheDocument(); });
}

// ── Tests ──

describe('ConcentrationPromptModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(globalThis, 'EventSource', { value: MockEventSource, writable: true, configurable: true });
    vi.mocked(rollD20).mockReturnValue(10);
    vi.mocked(computeAuraBonus).mockResolvedValue({ bonus: 0, sourceName: null });
  });

  afterEach(() => {
    delete globalThis.EventSource;
  });

  // ── Rendering / event filtering ──

  it('renders nothing when no prompt has arrived', () => {
    render(<ConcentrationPromptModal campaignName={CAMPAIGN} characters={[makeRoller()]} activeMapName={null} />);
    expect(screen.queryByText(/must make a/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /roll con save/i })).not.toBeInTheDocument();
  });

  // (The `typeof EventSource` feature gate is not pinned: every production
  // browser has EventSource, the app requires SSE, and the only observable
  // it changes — "no modal ever appears" — is already the no-prompt baseline
  // above. Its assertion keyed off the mock's own testid, not app output.)

  it('ignores runtime events from channels other than concentrationPrompt', async () => {
    render(<ConcentrationPromptModal campaignName={CAMPAIGN} characters={[makeRoller()]} activeMapName={null} />);
    fireEvent.click(screen.getByTestId('subscriber-trigger-other-channel'));
    expect(screen.queryByText(/must make a/i)).not.toBeInTheDocument();
  });

  it('shows the full prompt when a concentration check is queued', async () => {
    await openPrompt();
    expect(screen.getByText(/Concentration Check/i)).toBeInTheDocument();
    expect(screen.getByText(ROLLER)).toBeInTheDocument();
    expect(screen.getByText(/CONSTITUTION/i)).toBeInTheDocument();
    expect(screen.getByText('Bless')).toBeInTheDocument();
    expect(screen.getByText('DC 10')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /roll con save/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
    // single-prompt queue shows no progress counter
    expect(screen.queryByText(/\d+ of \d+/)).not.toBeInTheDocument();
  });

  // ── Queue semantics ──

  it('deduplicates repeated events for the same promptId into one check', async () => {
    await openPrompt();
    fireEvent.click(screen.getByTestId('subscriber-trigger'));
    fireEvent.click(screen.getByTestId('subscriber-trigger'));
    expect(screen.queryByText(/\d+ of \d+/)).not.toBeInTheDocument();

    await rollAndSeeResult();
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    expect(sendConcentrationResult).toHaveBeenCalledTimes(1);
    expect(sendConcentrationResult).toHaveBeenCalledWith(CAMPAIGN, ROLLER, expect.objectContaining({ promptId: 'test-prompt-1' }));
  });

  it('dismisses the prompt without submitting any result', async () => {
    await openPrompt();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    await waitFor(() => { expect(screen.queryByText(/must make a/i)).not.toBeInTheDocument(); });
    expect(sendConcentrationResult).not.toHaveBeenCalled();
    expect(rollD20).not.toHaveBeenCalled();
  });

  it('resolved head with a waiting sibling reads "(1 remaining)" — never the frozen "(1 of 2)"', async () => {
    // Resolved-face counter honesty (QE 2026-11-19 backlog), same pattern as
    // SavePromptModal: the answered head leaves the pending tally. The
    // shared promptQueueCounterText helper has no unit coverage, so this
    // modal-level mount is what pins the resolved-face copy.
    await openPrompt();
    fireEvent.click(screen.getByTestId('subscriber-trigger-second'));
    await waitFor(() => { expect(screen.getByText('(1 of 2)')).toBeInTheDocument(); });

    await rollAndSeeResult();

    expect(screen.getByText('(1 remaining)')).toBeInTheDocument();
    expect(screen.queryByText(/\d+ of \d+/)).not.toBeInTheDocument();
  });

  it('dismiss advances to the next queued prompt', async () => {
    await openPrompt();
    fireEvent.click(screen.getByTestId('subscriber-trigger-second'));
    await waitFor(() => { expect(screen.getByText('(1 of 2)')).toBeInTheDocument(); });

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    await waitFor(() => { expect(screen.getByText(ROLLER2)).toBeInTheDocument(); });
    expect(screen.getByText('Haste')).toBeInTheDocument();
    expect(screen.getByText('DC 13')).toBeInTheDocument();
    expect(sendConcentrationResult).not.toHaveBeenCalled();
  });

  it('walks the whole queue, submitting one result per prompt', async () => {
    await openPrompt();
    fireEvent.click(screen.getByTestId('subscriber-trigger-second'));
    await waitFor(() => { expect(screen.getByText('(1 of 2)')).toBeInTheDocument(); });

    await rollAndSeeResult();
    const next = screen.getByRole('button', { name: 'Next Check' });
    fireEvent.click(next);
    await waitFor(() => {
      expect(screen.getByText(ROLLER2)).toBeInTheDocument();
      expect(screen.getByText('Haste')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /roll con save/i })).toBeInTheDocument();
    });

    await rollAndSeeResult();
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    expect(sendConcentrationResult).toHaveBeenCalledTimes(2);
    expect(sendConcentrationResult.mock.calls.map(([campaign, target]) => [campaign, target])).toEqual([
      [CAMPAIGN, ROLLER],
      [CAMPAIGN, ROLLER2],
    ]);
  });

  // ── Outcome display (total vs DC, boundary inclusive) ──

  it.each([
    { roll: 7, expected: 'MAINTAINED', label: 'met exactly (7 + 3 vs DC 10)' },
    { roll: 6, expected: 'BROKEN', label: 'missed by one (6 + 3 vs DC 10)' },
  ])('reports CONCENTRATION $expected when the save total $label', async ({ roll, expected }) => {
    rollD20.mockReturnValue(roll);
    await openPrompt();
    await rollAndSeeResult();
    expect(screen.getByText(new RegExp(`CONCENTRATION ${expected}`, 'i'))).toBeInTheDocument();
    expect(within(screen.getByText(/total:/i)).getByText(String(roll + 3))).toBeInTheDocument();
    expect(sendConcentrationResult).toHaveBeenCalledWith(CAMPAIGN, ROLLER, expect.objectContaining({
      roll,
      total: roll + 3,
      success: expected === 'MAINTAINED',
    }));
  });

  // ── Submission contract ──

  it('sends the complete result payload and clears only the adjudicated promptId', async () => {
    await openPrompt();
    await rollAndSeeResult();
    expect(sendConcentrationResult).toHaveBeenCalledTimes(1);
    expect(sendConcentrationResult).toHaveBeenCalledWith(CAMPAIGN, ROLLER, {
      promptId: 'test-prompt-1',
      success: true,
      roll: 10,
      total: 13, // 10 + real CON save bonus +3
      saveBonus: 3,
      spellName: 'Bless',
      dc: 10,
      mode: 'normal',
      rawRolls: [10],
      advantageSources: [],
      disadvantageSource: null,
    });
    // promptId-scoped clear: only the adjudicated prompt's key leaves the
    // store — a sibling multi-hit prompt keeps its own.
    expect(clearConcentrationPrompt).toHaveBeenCalledTimes(1);
    expect(clearConcentrationPrompt).toHaveBeenCalledWith(CAMPAIGN, ROLLER, 'test-prompt-1');
  });

  it('dispatches the complete concentration-result detail and renders the aura-inclusive breakdown', async () => {
    // One aura fixture (bonus 2, 'Paladin') pins BOTH the full local
    // broadcast shape AND its rendered breakdown line in one harness.
    vi.mocked(computeAuraBonus).mockResolvedValue({ bonus: 2, sourceName: 'Paladin' });
    const eventHandler = vi.fn();
    window.addEventListener('concentration-result', eventHandler);
    try {
      await openPrompt();
      await rollAndSeeResult();
      await waitFor(() => { expect(eventHandler).toHaveBeenCalledTimes(1); });
      expect(eventHandler.mock.calls[0][0].detail).toEqual({
        promptId: 'test-prompt-1',
        targetName: ROLLER,
        success: true,
        roll: 10,
        total: 15, // 10 + CON +3 + aura +2
        saveBonus: 5,
        bonusDetail: '(+2 aura from Paladin)',
        spellName: 'Bless',
        dc: 10,
        mode: 'normal',
        rawRolls: [10],
        advantageSources: [],
        disadvantageSource: null,
      });
      expect(screen.getByText(/d20 \(10\) \+ 5 \(\+2 aura from Paladin\)/)).toBeInTheDocument();
    } finally {
      window.removeEventListener('concentration-result', eventHandler);
    }
  });

  // ── Advantage / disadvantage from real modifiers ──

  it('rolls 2d20 keep-low when the attacker is a concentration breaker', async () => {
    rollD20.mockReturnValueOnce(14).mockReturnValueOnce(8);
    await openPrompt([makeRoller(), BREAKER_ATTACKER]);
    await rollAndSeeResult();

    expect(rollD20).toHaveBeenCalledTimes(2);
    expect(screen.getByText('DISADVANTAGE')).toBeInTheDocument();
    expect(screen.getByText('d20: 8 (kept)')).toBeInTheDocument();
    expect(screen.getByText('d20: 14 (discarded)')).toBeInTheDocument();
    expect(sendConcentrationResult).toHaveBeenCalledWith(CAMPAIGN, ROLLER, expect.objectContaining({
      mode: 'disadvantage',
      rawRolls: [14, 8],
      roll: 8,
      total: 11,
      success: true,
    }));
  });

  it('rolls 2d20 keep-high and attributes the source when the roller has a concentration save advantage', async () => {
    rollD20.mockReturnValueOnce(5).mockReturnValueOnce(12);
    await openPrompt([makeRoller({ saveModifiers: [CON_ADVANTAGE_MOD] })]);
    await rollAndSeeResult();

    expect(rollD20).toHaveBeenCalledTimes(2);
    expect(screen.getByText('ADVANTAGE')).toBeInTheDocument();
    expect(screen.getByText('d20: 12 (kept)')).toBeInTheDocument();
    expect(screen.getByText('d20: 5 (discarded)')).toBeInTheDocument();
    expect(sendConcentrationResult).toHaveBeenCalledWith(CAMPAIGN, ROLLER, expect.objectContaining({
      mode: 'advantage',
      rawRolls: [5, 12],
      roll: 12,
      total: 15,
      advantageSources: ['Oath of Devotion'],
    }));
  });

  // (The advantage+disadvantage → single plain d20 offset branch is pinned
  // twice already — modal-level in holy-aura.test.jsx and unit-level in
  // concentrationPromptRoll.te-disadvantage.test.js — never a third time.)

  // ── Starry Form (Dragon) floor ──

  it.each([
    { roll: 4, expectedRoll: 10, label: 'low roll is raised to 10' },
    { roll: 15, expectedRoll: 15, label: 'roll above 9 is left alone' },
  ])('Starry Form (Dragon): $label', async ({ roll, expectedRoll }) => {
    rollD20.mockReturnValue(roll);
    await openPrompt([makeRoller({
      saveModifiers: [{ source: 'Starry Form', target: 'ability_check', effect: 'bonus', abilities: ['Constitution'] }],
      activeBuffs: [{ name: 'Starry Form', constellation: 'Dragon' }],
    })]);
    await rollAndSeeResult();

    expect(sendConcentrationResult).toHaveBeenCalledWith(CAMPAIGN, ROLLER, expect.objectContaining({
      roll: expectedRoll,
      total: expectedRoll + 3,
      mode: 'normal',
    }));
  });
});
