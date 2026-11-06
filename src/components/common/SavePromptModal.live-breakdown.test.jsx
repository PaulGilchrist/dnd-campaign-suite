// @maintained-by-ai
// SavePromptModal — LIVE mid-prompt save-bonus breakdown (DG 2026-11-06 header lie).
// A mid-prompt activeBuffs change (e.g. stamping a warding_bond saveBonus on the
// victim's runtime bucket) used to be read only at roll time while the header
// kept its stale prompt-open sum ("= +16" vs an actual "+ -3"). These tests drive
// the REAL runtime-store module (vi does NOT mock useRuntimeState here): buffs
// are stamped through setRuntimeObject → notify() → the useRuntimeValue
// subscription, exactly the SSE-echo adoption path a live tab takes. The header
// must re-render BEFORE rolling, and the resolved bonus must equal it.
// Prompt-open base+aura math lives in .pre-roll-bonus; roll dispatch/queues in
// the .rolling/.actions lanes — not re-tested here.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
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
  getAbilitySaveBonus: vi.fn(() => 2),
}));

// NOTE: ../../hooks/runtime/useRuntimeState.js is deliberately NOT mocked —
// these tests need the real in-memory store + notify() subscription so a
// mid-prompt buff stamp re-renders the header through the same listener the
// live SSE echo adopts.

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
  function MockSubscriber({ handleEvent, campaignName }) {
    return React.createElement('div', { 'data-testid': 'subscriber', 'data-campaign': campaignName },
      React.createElement('button', {
        'data-testid': 'trigger-live',
        onClick: () => handleEvent({
          key: `change-${campaignName}-savePrompt-FeyRanger-p-live`,
          data: { promptId: 'p-live', targetName: 'FeyRanger', saveType: 'dex', saveDc: 12 },
        }),
      }),
    );
  }
  return { default: MockSubscriber };
});

// ── Re-import mocked modules ──

import { rollD20 } from '../../services/dice/diceRoller.js';
import { sendSaveResult } from '../../services/combat/conditions/savePromptService.js';
import { computeAuraBonus } from '../../services/combat/auras/auraOfProtection.js';
import { getAbilitySaveBonus } from '../../services/combat/conditions/conditionUtils.js';
import storage from '../../services/ui/storage.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import { setRuntimeObject, clearRuntimeState } from '../../hooks/runtime/useRuntimeState.js';
import { createCharacter, setupGlobalEventSource, teardownGlobalEventSource } from './SavePromptModal.test-utils.jsx';

// ── Helpers ──

const FEY_RANGER = createCharacter('FeyRanger');

function renderModal(props = {}) {
  return render(
    <SavePromptModal
      campaignName="test-campaign"
      characters={[FEY_RANGER]}
      activeMapName="battle-arena"
      {...props}
    />
  );
}

async function openBreakdown() {
  fireEvent.click(screen.getByTestId('trigger-live'));
  await waitFor(() => {
    expect(screen.getByTestId('sp-preroll-bonus')).toBeInTheDocument();
  });
  return within(screen.getByTestId('sp-preroll-bonus'));
}

// Mid-prompt stamp: writes the target's activeBuffs bucket and notifies the
// runtime store — the same adoption a `change-<campaign>-<Target>` SSE echo
// performs (replaceRuntimeObject → notify) in a live tab.
function stampTargetBuffs(buffs) {
  act(() => {
    setRuntimeObject('FeyRanger', { activeBuffs: buffs });
  });
}

function breakdownModal() {
  return within(document.querySelector('.sp-modal'));
}

describe('SavePromptModal — live mid-prompt bonus breakdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupGlobalEventSource();
    rollD20.mockReset().mockReturnValue(15);
    computeAuraBonus.mockReset().mockResolvedValue({ bonus: 5, sourceName: 'ElderPaladin' });
    getAbilitySaveBonus.mockReset().mockReturnValue(2);
  });
  afterEach(() => {
    teardownGlobalEventSource();
    clearRuntimeState('FeyRanger');
  });

  it('stable case (no mid-prompt change): prompt-open breakdown renders as before', async () => {
    renderModal();
    const breakdown = await openBreakdown();
    expect(breakdown.getByText('DEX +2')).toBeInTheDocument();
    expect(breakdown.getByText('+5 (Aura of Protection)')).toBeInTheDocument();
    expect(breakdown.getByText('= +7')).toBeInTheDocument();
    expect(breakdown.queryByText(/Warding Bond/)).not.toBeInTheDocument();
  });

  it('mid-prompt warding_bond saveBonus:-19 stamp re-renders the header BEFORE rolling', async () => {
    renderModal();
    const breakdown = await openBreakdown();
    expect(breakdown.getByText('= +7')).toBeInTheDocument();

    // DG rig reproduction: scoped PATCH lands the buff on the victim's bucket;
    // the SSE echo updates the runtime store while the prompt stays open.
    stampTargetBuffs([{ effect: 'warding_bond', saveBonus: -19, name: 'Warding Bond' }]);

    await waitFor(() => {
      expect(breakdown.getByText('-19 (Warding Bond)')).toBeInTheDocument();
    });
    // The sum moves WITHOUT reopening: 2 base + 5 aura − 19 = -12.
    expect(breakdown.getByText('= -12')).toBeInTheDocument();
    expect(breakdown.getByText('DEX +2')).toBeInTheDocument();
    expect(breakdown.getByText('+5 (Aura of Protection)')).toBeInTheDocument();
    // Debuff stamp renders with the semantic debuff class (no inline styling).
    expect(breakdown.getByText('-19 (Warding Bond)').closest('.creature-badge')).toHaveClass('effect-debuff');
  });

  it('resolved save bonus equals the live breakdown shown pre-roll (no header/record divergence)', async () => {
    getCombatSummary.mockReturnValue({ creatures: [] });
    renderModal();
    const breakdown = await openBreakdown();
    stampTargetBuffs([{ effect: 'warding_bond', saveBonus: -19, name: 'Warding Bond' }]);
    await waitFor(() => {
      expect(breakdown.getByText('= -12')).toBeInTheDocument();
    });

    // Roll: the roll seam reads the same store — d20 15 + (2 + 5 − 19) = 3 < DC 12.
    fireEvent.click(screen.getByRole('button', { name: /Roll Save/ }));
    const modal = breakdownModal();
    await waitFor(() => {
      expect(modal.getByText('SAVE FAILURE')).toBeInTheDocument();
    });
    // Post-roll panel bonus equals the pre-roll header sum (-12), and the
    // header stays honest while the result is shown.
    expect(modal.getByText('d20 (15) + -12 (+5 aura from ElderPaladin)')).toBeInTheDocument();
    expect(breakdown.getByText('= -12')).toBeInTheDocument();
    // The persisted lastAttack record folds the SAME bonus the header showed
    // (d20 + bonus === total) — no 8-vs--11 under-report divergence.
    expect(storage.set).toHaveBeenCalledWith('lastAttack',
      expect.objectContaining({ bonus: -12, d20: 15, total: 3, rollType: 'save' }), 'test-campaign');

    // Done dispatches the machine-truth row: its saveBonus matches the shown
    // breakdown (AC2 — the log row can no longer say -12 beside a "+7" header).
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(sendSaveResult).toHaveBeenCalledWith('test-campaign', 'FeyRanger',
      expect.objectContaining({ promptId: 'p-live', success: false, saveBonus: -12, total: 3 }));
  });

  it('removing the buff mid-prompt restores the original sum (never sticky)', async () => {
    renderModal();
    const breakdown = await openBreakdown();
    stampTargetBuffs([{ effect: 'warding_bond', saveBonus: -19, name: 'Warding Bond' }]);
    await waitFor(() => expect(breakdown.getByText('= -12')).toBeInTheDocument());

    stampTargetBuffs([]);
    await waitFor(() => expect(breakdown.getByText('= +7')).toBeInTheDocument());
    expect(breakdown.queryByText(/Warding Bond/)).not.toBeInTheDocument();
  });

  it('mid-prompt Burst of Ingenuity stamp folds +2 and agrees with the rolled bonus', async () => {
    renderModal();
    const breakdown = await openBreakdown();
    stampTargetBuffs([{ effect: 'burst_of_ingenuity', saveBonus: 2, oneShot: true }]);
    await waitFor(() => expect(breakdown.getByText('= +9')).toBeInTheDocument());
    expect(breakdown.getByText('+2 (Burst of Ingenuity)')).toBeInTheDocument();

    // Roll consumes the one-shot: 15 + (2 + 5 + 2) = 24 ≥ DC 12 → success, and
    // the committed bonus equals the live sum shown before the click.
    fireEvent.click(screen.getByRole('button', { name: /Roll Save/ }));
    const modal = breakdownModal();
    await waitFor(() => expect(modal.getByText('SAVE SUCCESS')).toBeInTheDocument());
    expect(modal.getByText('d20 (15) + 9 (+5 aura from ElderPaladin) +2 [Burst of Ingenuity]')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(sendSaveResult).toHaveBeenCalledWith('test-campaign', 'FeyRanger',
      expect.objectContaining({ promptId: 'p-live', success: true, saveBonus: 9, total: 24 }));
  });

  it('warding_bond without saveBonus adds no chip and never changes the sum', async () => {
    renderModal();
    const breakdown = await openBreakdown();
    stampTargetBuffs([{ effect: 'warding_bond', name: 'Warding Bond' }]);
    // Let any echo settle — the sum must byte-stay at the prompt-open value.
    await Promise.resolve();
    expect(breakdown.getByText('= +7')).toBeInTheDocument();
    expect(breakdown.queryByText(/Warding Bond/)).not.toBeInTheDocument();
  });
});
