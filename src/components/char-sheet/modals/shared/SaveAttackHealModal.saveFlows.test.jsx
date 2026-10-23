// @maintained-by-ai
// Save-routing lane for SaveAttackHealModal: NPC auto-resolve vs player prompt routing,
// NPC save arithmetic (lowercase saveBonuses key, total = roll + bonus vs DC, honest
// half-on-success / full-on-failure mocks), pending-player UI, save-result event
// resolution/inertness (fix#156: adjudicated damage applies on BOTH outcomes — half
// lands on player save success per disk law, pinned at the save-result seam), roll
// logging, and combatSummary persistence (cache + storage +
// window event). Sibling lanes: SaveAttackHealModal.test.jsx owns initial render and
// target selection; healFlows.test.jsx owns heal-radio arbitration/report/Done
// (applyHealing mocked); npc-heal.test.jsx owns real HP restoration via applyHealing.js.
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SaveAttackHealModal from './SaveAttackHealModal.jsx';

// ── Mocked modules ──

vi.mock('../../../../services/rules/combat/rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(() => 10),
}));

vi.mock('../../../../services/combat/conditions/savePromptService.js', () => ({
  sendSavePrompt: vi.fn(),
  sendSaveResult: vi.fn(),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../../../services/ui/utils.js', () => {
  let counter = 0;
  return {
    default: {
      guid: vi.fn(() => `test-guid-${++counter}`),
    },
  };
});

vi.mock('../../../../services/ui/storage.js', () => ({
  default: {
    set: vi.fn(),
    get: vi.fn(() => null),
  },
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
  setCombatSummaryCache: vi.fn(),
}));

// Transport only — lastAttack POSTs are not this lane's subject.
vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

// logHealingToSSE is the only healingRoll import in this modal's graph; the heal
// itself is never clicked here (healFlows/npc-heal lanes own it).
vi.mock('../../../../services/automation/common/healingRoll.js', () => ({
  logHealingToSSE: vi.fn(),
}));

// ── Re-import mocked modules ──

import * as savePromptService from '../../../../services/combat/conditions/savePromptService.js';
import * as logService from '../../../../services/ui/logService.js';
import * as diceRoller from '../../../../services/dice/diceRoller.js';
import * as applyDamage from '../../../../services/rules/combat/applyDamage.js';
import * as combatData from '../../../../services/encounters/combatData.js';
import storage from '../../../../services/ui/storage.js';

// ── Test fixtures ──

import { makeProps, getCheckboxByName } from './SaveAttackHealModal.test-utils.js';

// ── Helpers ──

/**
 * Select the given target name(s) and click the apply button.
 */
async function applySaves(getByRole, targetNames) {
  for (const name of targetNames) {
    fireEvent.click(getCheckboxByName(name));
  }
  await act(async () => {
    fireEvent.click(getByRole('button', { name: /Divine Smite/ }));
  });
}

// Throw-on-drift dice: this lane rolls only the CON save (1d20) and feature
// damage (4d6); a heal roll here would mean the flow leaked into heal territory.
function diceFor(saveRoll) {
  return (expr) => {
    if (expr === '1d20') return { total: saveRoll, rolls: [saveRoll], modifier: 0 };
    if (expr === '4d6') return { total: 10, rolls: [1, 2, 3, 4], modifier: 0 };
    throw new Error(`Unexpected roll expression: ${expr}`);
  };
}

// ── Tests ──

describe('SaveAttackHealModal — save flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    diceRoller.rollExpression.mockImplementation(diceFor(12));
  });

  // ── Apply saves: type routing, dice scope, logging, persistence ──

  it('routes by creature type: auto-resolves NPC saves, prompts players, and persists the summary', async () => {
    const listener = vi.fn();
    window.addEventListener('combat-summary-updated', listener);
    const { getByRole } = render(<SaveAttackHealModal {...makeProps()} />);
    await applySaves(getByRole, ['Goblin A', 'Goblin B', 'Player One']);

    // NPCs self-resolve (in selection order); players get prompts instead.
    expect(savePromptService.sendSaveResult.mock.calls.map(c => c[1])).toEqual(['Goblin A', 'Goblin B']);
    expect(savePromptService.sendSavePrompt).toHaveBeenCalledTimes(1);
    expect(savePromptService.sendSavePrompt).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      promptId: expect.stringMatching(/test-guid-\d+/),
      targetName: 'Player One',
      saveType: 'CON',
      saveDc: 10,
      sourceName: 'Cleric1',
    }));

    // Dice roll only for NPC save + damage rounds — none for the prompted player.
    expect(diceRoller.rollExpression).toHaveBeenCalledTimes(4);

    // Resolved NPC rows show alongside the pending-player row.
    const resultsList = document.querySelector('.abjure-results-list');
    expect(resultsList.textContent).toContain('Saved — takes 5 Radiant damage (rolled 10, halved)');
    expect(resultsList.textContent).toContain('Player One');
    expect(resultsList.textContent).toContain('Waiting for save roll');

    // One save log + one damage log per NPC; nothing logged for pending players.
    const rollLogs = logService.addEntry.mock.calls.filter(c => c[1].type === 'roll');
    expect(rollLogs).toHaveLength(4);
    expect(rollLogs.filter(c => c[1].targetName === 'Player One')).toHaveLength(0);

    // Combat summary persists at the apply seam: cache + storage (dispatch of the
    // broadcast itself is pinned by AreaEffectTargetModalBase.utils.test.jsx; the
    // real damage engine also fires it per NPC, so no count pin here).
    expect(combatData.setCombatSummaryCache).toHaveBeenCalledTimes(1);
    expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.any(Object), 'test-campaign');
    expect(listener).toHaveBeenCalled();
    window.removeEventListener('combat-summary-updated', listener);
  });

  // ── NPC save arithmetic (saveBonuses lookup, DC comparison, damage halving) ──

  it.each([
    { label: 'meets DC exactly', roll: 7, saveBonus: 3, expectedSuccess: true, expectedText: 'Saved — takes 5 Radiant damage (rolled 10, halved)' },
    { label: 'misses DC', roll: 6, saveBonus: 3, expectedSuccess: false, expectedText: 'Failed — takes 10 Radiant damage (rolled 10)' },
  ])('NPC save %s: total = roll + saveBonus vs DC 10', async ({ roll, saveBonus, expectedSuccess, expectedText }) => {
    diceRoller.rollExpression.mockImplementation(diceFor(roll));
    const { getByRole } = render(<SaveAttackHealModal {...makeProps({
      // saveBonuses keys are lowercase by contract — uppercase 'CON' lookup must not silently +0.
      combatSummary: { creatures: [{ name: 'Goblin A', type: 'npc', maxHp: 82, saveBonuses: { con: saveBonus } }] },
    })} />);
    await applySaves(getByRole, ['Goblin A']);

    expect(savePromptService.sendSaveResult).toHaveBeenCalledTimes(1);
    expect(savePromptService.sendSaveResult).toHaveBeenCalledWith('test-campaign', 'Goblin A', expect.objectContaining({
      promptId: expect.stringMatching(/test-guid-\d+/),
      success: expectedSuccess,
      total: roll + saveBonus,
      saveBonus,
    }));

    expect(document.querySelector('.abjure-results-list').textContent).toContain(expectedText);

    expect(logService.addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      type: 'roll',
      rollType: 'save-damage',
      name: 'Divine Smite',
      characterName: 'Cleric1',
      targetName: 'Goblin A',
      saveType: 'CON',
      saveDc: 10,
      saveResult: expectedSuccess ? 'success' : 'failure',
    }));
  });

  // ── Apply button flow: selection UI replaced by results view ──

  it('replaces the selection UI with the results view after apply', async () => {
    const { getByRole } = render(<SaveAttackHealModal {...makeProps()} />);
    await applySaves(getByRole, ['Goblin A']);

    expect(screen.getByText(/Resolving.*CON.*saving throws/)).toBeInTheDocument();
    expect(document.querySelectorAll('input[type="checkbox"]').length).toBe(0);
    expect(screen.queryByRole('button', { name: /Divine Smite/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  // ── Save-result events: pending player resolution ──

  it.each([
    { label: 'success', success: true, expectedText: 'Saved — takes 5 Radiant damage (rolled 10, halved)', expectedApplied: 5 },
    { label: 'failure', success: false, expectedText: 'Failed — takes 10 Radiant damage (rolled 10)', expectedApplied: 10 },
  ])('resolves a pending player on save-result event (%s)', async ({ success, expectedText, expectedApplied }) => {
    // Deterministic damage sink — the resistance engine is not this lane's subject
    // (npc-heal.test.jsx covers its write-back integration).
    const applySpy = vi.spyOn(applyDamage, 'applyDamageToTarget').mockReturnValue({ finalDamage: expectedApplied });

    const { getByRole } = render(<SaveAttackHealModal {...makeProps()} />);
    await applySaves(getByRole, ['Player One']);
    const promptId = savePromptService.sendSavePrompt.mock.calls[0][1].promptId;
    // Flush apply-phase calls so every assertion below is caused by the event alone.
    vi.clearAllMocks();

    await act(async () => {
      window.dispatchEvent(new CustomEvent('save-result', {
        detail: { promptId, success, total: success ? 12 : 8, roll: success ? 9 : 5, saveBonus: 3 },
      }));
    });

    await waitFor(() => {
      const resultsList = document.querySelector('.abjure-results-list');
      expect(resultsList.textContent).toContain('Player One');
      expect(resultsList.textContent).toContain(expectedText);
      expect(screen.queryByText(/Waiting for save roll/)).not.toBeInTheDocument();
    });

    // Save logged with the event's numbers, and the summary persists at this seam.
    expect(logService.addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      type: 'roll',
      rollType: 'save-damage',
      targetName: 'Player One',
      saveResult: success ? 'success' : 'failure',
      total: success ? 12 : 8,
      bonus: 3,
    }));
    expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.any(Object), 'test-campaign');
    expect(combatData.setCombatSummaryCache).toHaveBeenCalledTimes(1);

    // fix#156: adjudicated damage lands on BOTH outcomes — disk law (Land's Aid,
    // public/data/2024/classes.json: "taking 2d6 Necrotic damage on a failed save
    // or half on success") grants half on a successful save. Success pays
    // floor(10/2)=5 through the SAME apply lane that pays a failure's full 10;
    // the pre-fix engine applied nothing on success while the view displayed the
    // halved number (ledger :252 split-brain).
    expect(applySpy).toHaveBeenCalledTimes(1);
    expect(applySpy).toHaveBeenCalledWith(expect.any(Object), 'Player One', expectedApplied, ['Radiant'], expect.objectContaining({ campaignName: 'test-campaign' }));

    // Damage ledger entry reports the honest result and the adjudicated amount.
    expect(logService.addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      rollType: 'save-damage',
      targetName: 'Player One',
      saveResult: success ? 'success' : 'failure',
      dcSuccess: 'half',
      finalDamage: expectedApplied,
    }));

    if (success) {
      expect(screen.getByText('All targets resolved.')).toBeInTheDocument();
    }
    applySpy.mockRestore();
  });

  it('ignores a save-result event with an unknown promptId — player stays pending and nothing fires', async () => {
    const { getByRole } = render(<SaveAttackHealModal {...makeProps()} />);
    await applySaves(getByRole, ['Player One']);
    vi.clearAllMocks();

    await act(async () => {
      window.dispatchEvent(new CustomEvent('save-result', {
        detail: { promptId: 'wrong-id', success: false, total: 5, roll: 3, saveBonus: 2 },
      }));
    });

    expect(document.querySelector('.abjure-results-list').textContent).toContain('Waiting for save roll');
    // Inert: the stale event must not log or persist anything.
    expect(logService.addEntry).not.toHaveBeenCalled();
    expect(storage.set).not.toHaveBeenCalled();
    expect(combatData.setCombatSummaryCache).not.toHaveBeenCalled();
  });

  // ── Pending-prompt edge cases ──

  it('treats a creature with no type as a player (pending prompt), never an auto-resolved NPC', async () => {
    const { getByRole } = render(<SaveAttackHealModal {...makeProps({
      combatSummary: { creatures: [{ name: 'Mystery Creature' }] },
    })} />);
    await applySaves(getByRole, ['Mystery Creature']);

    expect(savePromptService.sendSavePrompt).toHaveBeenCalledTimes(1);
    expect(savePromptService.sendSavePrompt).toHaveBeenCalledWith('test-campaign', expect.objectContaining({ targetName: 'Mystery Creature' }));
    expect(savePromptService.sendSaveResult).not.toHaveBeenCalled();
    expect(diceRoller.rollExpression).not.toHaveBeenCalled();
    expect(screen.getByText(/Waiting for save roll/)).toBeInTheDocument();
  });

  it('keeps an unanswered player pending while another player responds', async () => {
    // Deterministic damage sink (saveFlows house pattern) — the adjudicated
    // half-on-success must land on the RESPONDING target only, never the pending one.
    const applySpy = vi.spyOn(applyDamage, 'applyDamageToTarget').mockReturnValue({ finalDamage: 5 });
    const { getByRole } = render(<SaveAttackHealModal {...makeProps({
      combatSummary: {
        creatures: [
          { name: 'Player One', type: 'player' },
          { name: 'Player Two', type: 'player' },
        ],
      },
    })} />);
    await applySaves(getByRole, ['Player One', 'Player Two']);
    const promptId1 = savePromptService.sendSavePrompt.mock.calls[0][1].promptId;
    vi.clearAllMocks();

    await act(async () => {
      window.dispatchEvent(new CustomEvent('save-result', {
        detail: { promptId: promptId1, success: true, total: 12, roll: 9, saveBonus: 3 },
      }));
    });

    await waitFor(() => {
      const resultsList = document.querySelector('.abjure-results-list');
      expect(resultsList.textContent).toContain('Saved');
      expect(resultsList.textContent).toContain('Player Two');
      expect(resultsList.textContent).toContain('Waiting for save roll');
    });
    // fix#156: success-half applies — to Player One only (4d6 rolled 10 → floor-half 5).
    expect(applySpy).toHaveBeenCalledTimes(1);
    expect(applySpy).toHaveBeenCalledWith(expect.any(Object), 'Player One', 5, ['Radiant'], expect.any(Object));
    expect(screen.queryByText('All targets resolved.')).not.toBeInTheDocument();
    expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.any(Object), 'test-campaign');
    applySpy.mockRestore();
  });
});
