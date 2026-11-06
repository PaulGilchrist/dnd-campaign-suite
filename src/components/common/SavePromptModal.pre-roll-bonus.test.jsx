// @maintained-by-ai
// SavePromptModal — pre-roll save-bonus breakdown (backlog 2026-11-03)
// Locks the panel's pre-Roll chip lane: base ability-save bonus, an
// "Aura of Protection" pad shown separately via computeAuraBonus (the SAME
// seam the resolve lane uses), the summed total, agreement with the
// post-Roll bonus line, and staleness eviction across prompt swaps.
// Roll math, rerolls, and dismissal live in the sibling .rolling/.bonuses/
// .rerolls/.actions lanes — not re-tested here.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import React from 'react';
import SavePromptModal from './SavePromptModal.jsx';

// ── Mocks ──

vi.mock('../../services/ui/utils.js', () => ({
  default: {
    getName: (name) => name || 'Unknown',
  },
}));

vi.mock('../../services/dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
  rollExpression: vi.fn(),
}));

vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
  sendSaveResult: vi.fn(),
  clearSavePrompt: vi.fn(),
}));

vi.mock('../../services/combat/auras/auraOfProtection.js', () => ({
  computeAuraBonus: vi.fn(async () => ({ bonus: 0, sourceName: null })),
}));

vi.mock('../../services/combat/conditions/conditionUtils.js', () => ({
  getAbilitySaveBonus: vi.fn(() => 0),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(() => null),
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/storage.js', () => ({
  default: {
    set: vi.fn(() => Promise.resolve()),
    get: vi.fn(() => Promise.resolve(null)),
  },
}));

vi.mock('../../hooks/useAllySelection.js', () => ({
  getAllyList: vi.fn(() => []),
}));

vi.mock('../../services/automation/handlers/buffs/circleOfPowerHandler.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    isCircleOfPowerActive: vi.fn(() => false),
  };
});

// Test-event feeder: dispatches SSE-shaped prompt events through the real
// handleEvent (per-prompt arrival key shape '<Target>-<promptId>').
vi.mock('./Subscriber.jsx', () => {
  const promptEvent = (handleEvent, testId, campaign, data) =>
    React.createElement('button', {
      'data-testid': testId,
      onClick: () => handleEvent({ key: `change-${campaign}-savePrompt-${data.targetName}-${data.promptId}`, data }),
    });
  function MockSubscriber({ handleEvent, campaignName }) {
    return React.createElement('div', { 'data-testid': 'subscriber', 'data-campaign': campaignName },
      promptEvent(handleEvent, 'trigger-aura-target', campaignName, {
        promptId: 'p-aura', targetName: 'FeyRanger', saveType: 'dex', saveDc: 12,
      }),
      promptEvent(handleEvent, 'trigger-zero-target', campaignName, {
        promptId: 'p-zero', targetName: 'ZeroBearer', saveType: 'dex', saveDc: 12,
      }),
    );
  }
  return { default: MockSubscriber };
});

// ── Re-import mocked modules ──

import { rollD20 } from '../../services/dice/diceRoller.js';
import { computeAuraBonus } from '../../services/combat/auras/auraOfProtection.js';
import { getAbilitySaveBonus } from '../../services/combat/conditions/conditionUtils.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { setupDefaults, cleanupDefaults, createCharacter } from './SavePromptModal.test-utils.jsx';

// ── Helpers ──

const FEY_RANGER = createCharacter('FeyRanger');
const ZERO_BEARER = createCharacter('ZeroBearer');

function renderModal(props = {}) {
  return render(
    <SavePromptModal
      campaignName="test-campaign"
      characters={[FEY_RANGER, ZERO_BEARER]}
      activeMapName="battle-arena"
      {...props}
    />
  );
}

async function openPrompt(testId) {
  fireEvent.click(screen.getByTestId(testId));
  await waitFor(() => {
    expect(screen.getByText(/must make a/i)).toBeInTheDocument();
  });
  return within(document.querySelector('.sp-modal'));
}

async function openBreakdown(testId) {
  const modal = await openPrompt(testId);
  await waitFor(() => {
    expect(modal.getByTestId('sp-preroll-bonus')).toBeInTheDocument();
  });
  return modal.getByTestId('sp-preroll-bonus');
}

describe('SavePromptModal — pre-roll save-bonus breakdown', () => {
  beforeEach(() => {
    setupDefaults(rollD20, computeAuraBonus, getRuntimeValue);
    getAbilitySaveBonus.mockReset().mockReturnValue(2);
  });
  afterEach(cleanupDefaults);

  it('shows base-only breakdown (no aura chip) before Roll when no aura applies', async () => {
    computeAuraBonus.mockResolvedValue({ bonus: 0, sourceName: null });
    renderModal();

    const breakdown = await openBreakdown('trigger-aura-target');
    expect(within(breakdown).getByText('DEX +2')).toBeInTheDocument();
    expect(within(breakdown).getByText('= +2')).toBeInTheDocument();
    expect(within(breakdown).queryByText(/Aura of Protection/)).not.toBeInTheDocument();
    // Breakdown renders while the Roll button is still the action (pre-commit).
    expect(screen.getByRole('button', { name: /Roll Save/ })).toBeInTheDocument();
  });

  it('shows base + separately-labeled Aura of Protection pad summing to the live total', async () => {
    computeAuraBonus.mockResolvedValue({ bonus: 5, sourceName: 'ElderPaladin' });
    renderModal();

    const breakdown = await openBreakdown('trigger-aura-target');
    expect(within(breakdown).getByText('DEX +2')).toBeInTheDocument();
    expect(within(breakdown).getByText('+5 (Aura of Protection)')).toBeInTheDocument();
    expect(within(breakdown).getByText('= +7')).toBeInTheDocument();
    const chip = within(breakdown).getByTestId('creature-badge');
    expect(chip).toHaveAttribute('title', 'Aura of Protection from ElderPaladin');
    // Same seam the resolve lane commits through — not a re-derivation.
    expect(computeAuraBonus).toHaveBeenCalledWith(expect.objectContaining({
      targetName: 'FeyRanger',
      campaignName: 'test-campaign',
      activeMapName: 'battle-arena',
    }));
  });

  // Backlog 2026-11-06 (DA): phantom-bearer display honesty. When
  // computeAuraBonus reports assumedCoPresent (active map exists, bearer has
  // no token on it, not a board member) the tooltip caveats the assumption.
  // The pad value/labels are IDENTICAL to the flag-absent face above.
  it('caveats a phantom bearer\'s tooltip with "assumed co-present (no token)"', async () => {
    computeAuraBonus.mockResolvedValue({ bonus: 5, sourceName: 'ElderPaladin', assumedCoPresent: true });
    renderModal();

    const breakdown = await openBreakdown('trigger-aura-target');
    expect(within(breakdown).getByText('+5 (Aura of Protection)')).toBeInTheDocument();
    expect(within(breakdown).getByText('= +7')).toBeInTheDocument();
    const chip = within(breakdown).getByTestId('creature-badge');
    expect(chip).toHaveAttribute('title', 'Aura of Protection from ElderPaladin — assumed co-present (no token)');
  });

  // Backlog 2026-11-06 (DB): tokened-bearer vs unpositioned-target display lane.
  // The aura bonus is NOT applied (total byte-identical to the no-aura face) —
  // the breakdown gains an explicit note naming the bearer/aura so the dropped
  // chip is explained instead of silently vanishing.
  it('notes an unmeasured aura instead of a chip when the target has no token', async () => {
    computeAuraBonus.mockResolvedValue({ bonus: 0, sourceName: null, targetUnpositionedBearer: 'ElderPaladin' });
    renderModal();

    const breakdown = await openBreakdown('trigger-aura-target');
    expect(within(breakdown).getByText('DEX +2')).toBeInTheDocument();
    expect(within(breakdown).getByText('= +2')).toBeInTheDocument();
    expect(within(breakdown).queryByTestId('creature-badge')).not.toBeInTheDocument();
    expect(screen.getByTestId('sp-aura-unmeasured')).toHaveTextContent(
      'Aura of Protection from ElderPaladin — target not positioned, unmeasured'
    );
  });

  it('keeps the unmeasured note visible post-Roll with unchanged bonus math', async () => {
    computeAuraBonus.mockResolvedValue({ bonus: 0, sourceName: null, targetUnpositionedBearer: 'ElderPaladin' });
    rollD20.mockReturnValue(15);
    renderModal();

    const modal = await openPrompt('trigger-aura-target');
    await openBreakdown('trigger-aura-target');
    fireEvent.click(screen.getByRole('button', { name: /Roll Save/ }));
    await waitFor(() => {
      expect(modal.getByText(/SAVE (SUCCESS|FAILURE)/)).toBeInTheDocument();
    });
    // Bonus is exactly the base (+2, no aura pad) — the note explains, never pays.
    expect(modal.getByText('d20 (15) + 2')).toBeInTheDocument();
    expect(screen.getByTestId('sp-aura-unmeasured')).toBeInTheDocument();
  });

  it('shows no unmeasured note on the plain zero-bonus face (no flag)', async () => {
    computeAuraBonus.mockResolvedValue({ bonus: 0, sourceName: null });
    renderModal();

    await openBreakdown('trigger-aura-target');
    expect(screen.queryByTestId('sp-aura-unmeasured')).not.toBeInTheDocument();
  });

  it('shows zero-bonus breakdown (= +0) without an aura chip', async () => {
    computeAuraBonus.mockResolvedValue({ bonus: 0, sourceName: null });
    getAbilitySaveBonus.mockReturnValue(0);
    renderModal();

    const breakdown = await openBreakdown('trigger-zero-target');
    expect(within(breakdown).getByText('DEX +0')).toBeInTheDocument();
    expect(within(breakdown).getByText('= +0')).toBeInTheDocument();
    expect(within(breakdown).queryByText(/Aura of Protection/)).not.toBeInTheDocument();
  });

  it('pre-roll total agrees with the post-Roll bonus line (both visible after rolling)', async () => {
    computeAuraBonus.mockResolvedValue({ bonus: 5, sourceName: 'ElderPaladin' });
    rollD20.mockReturnValue(15);
    renderModal();

    const modal = await openPrompt('trigger-aura-target');
    const breakdown = await openBreakdown('trigger-aura-target');
    expect(within(breakdown).getByText('= +7')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Roll Save/ }));
    await waitFor(() => {
      expect(modal.getByText(/SAVE (SUCCESS|FAILURE)/)).toBeInTheDocument();
    });
    // Post-roll breakdown: d20 (15) + 7 (+5 aura from ElderPaladin) — the
    // committed bonus matches the pre-roll = +7, still displayed.
    expect(modal.getByText('d20 (15) + 7 (+5 aura from ElderPaladin)')).toBeInTheDocument();
    expect(within(document.querySelector('[data-testid="sp-preroll-bonus"]')).getByText('= +7')).toBeInTheDocument();
  });

  it('evicts a pending aura pad that resolves after the prompt was replaced (never stale)', async () => {
    let resolveAura;
    computeAuraBonus.mockImplementation(({ targetName }) =>
      targetName === 'FeyRanger'
        ? new Promise((resolve) => { resolveAura = resolve; })
        : Promise.resolve({ bonus: 0, sourceName: null })
    );
    renderModal();

    await openPrompt('trigger-aura-target');
    // Queue the second prompt, then advance to it BEFORE the first aura read
    // resolves.
    fireEvent.click(screen.getByTestId('trigger-zero-target'));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    await waitFor(() => {
      expect(screen.getByText('ZeroBearer')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByTestId('sp-preroll-bonus')).toBeInTheDocument();
    });
    resolveAura({ bonus: 5, sourceName: 'ElderPaladin' });
    // Flush the discarded read's continuations deterministically (microtasks
    // after `await computeAuraBonus(...)` in the effect).
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(screen.queryByText('+5 (Aura of Protection)')).not.toBeInTheDocument();
    expect(within(screen.getByTestId('sp-preroll-bonus')).getByText('= +2')).toBeInTheDocument();
  });
});
