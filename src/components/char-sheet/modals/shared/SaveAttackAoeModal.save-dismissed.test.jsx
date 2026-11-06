// @maintained-by-ai
// SaveAttackAoeModal — dismiss-softlock regression (save-dismissed sweep
// family, 2026-11-05, playbook §66 named suspect). The picker lane parks on
// pendingPrompts drained only by save-result; the GM's un-rolled Dismiss
// never dispatches one, stranding the "Waiting for save roll..." view. The
// lane opts into the promptId-keyed `save-dismissed` broadcast: the target is
// neutral (NO damage adjudicated — never treated as a failed save), a
// save_dismissed log row lands, the neutral dismissed row feeds the same
// drain-to-summary commit, and the summary's Close works. The overlay lane
// shares handleSaveDismissed through the base's handleSaveDismissedOverride
// (forwarding pinned in AreaEffectTargetModalBase.save-dismissed.test.jsx).
// Mock kit mirrors SaveAttackAoeModal.corona.test.jsx.
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SaveAttackAoeModal from './SaveAttackAoeModal.jsx';

vi.mock('../../../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
  rollExpressionMaximized: vi.fn(),
}));

vi.mock('../../../../services/combat/automation/automationExpressions.js', () => ({
  resolveScaling: vi.fn(() => ({})),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../services/combat/conditions/savePromptService.js', () => ({
  sendSavePrompt: vi.fn(),
}));

vi.mock('../../../../services/rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(),
  computeDamageAfterEvasion: vi.fn((raw, success, dcSuccess) => (success && dcSuccess === 'half' ? Math.floor(raw / 2) : raw)),
  computeDamageAfterResistancesWithDetails: vi.fn(({ rawDamage }) => ({ finalDamage: rawDamage })),
  hasEvasionForSave: vi.fn(() => false),
  normalizeSaveType: vi.fn((t) => t),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({
    creatures: [
      { name: 'Cleric1', type: 'player', currentHp: 30, maxHp: 30, saveBonuses: { dex: 2 } },
      { name: 'Player One', type: 'player', currentHp: 20, maxHp: 30, saveBonuses: { dex: 4 } },
    ],
  })),
  getCombatContext: vi.fn(),
  setCombatSummaryCache: vi.fn(),
}));

vi.mock('../../../../hooks/useAllySelection.js', () => ({
  getAllyList: vi.fn(() => null),
}));

vi.mock('../../../../services/automation/common/damageRollback.js', () => ({
  storeSpellLastAttack: vi.fn(),
  addTargetResult: vi.fn(),
}));

import * as diceRoller from '../../../../services/dice/diceRoller.js';
import * as applyDamage from '../../../../services/rules/combat/applyDamage.js';
import * as savePromptService from '../../../../services/combat/conditions/savePromptService.js';
import * as logService from '../../../../services/ui/logService.js';
import { addTargetResult } from '../../../../services/automation/common/damageRollback.js';

const baseProps = {
  action: { name: 'Fireball', automation: { scaling: { damage: '8d6' } } },
  playerStats: { name: 'Cleric1', level: 12 },
  campaignName: 'test-campaign',
  range: 20,
  damage: '8d6',
  damageType: 'Fire',
  saveType: 'DEX',
  saveDc: 15,
  dcSuccess: 'half',
  onClose: vi.fn(),
};

function checkboxFor(name) {
  const row = [...document.querySelectorAll('.secondary-target-row')].find(r => r.textContent.includes(name));
  return row.querySelector('input[type="checkbox"]');
}

async function pick(name) {
  fireEvent.click(checkboxFor(name));
  const confirmBtn = screen.getByRole('button', { name: new RegExp(`Fireball \\(1\\)`) });
  await act(async () => { fireEvent.click(confirmBtn); });
  await act(async () => { await new Promise(r => setTimeout(r, 0)); });
  expect(savePromptService.sendSavePrompt).toHaveBeenCalledTimes(1);
  return savePromptService.sendSavePrompt.mock.calls[0][1].promptId;
}

function trackSaveLedger() {
  const ledger = { open: 0 };
  const realAdd = window.addEventListener.bind(window);
  const realRemove = window.removeEventListener.bind(window);
  vi.spyOn(window, 'addEventListener').mockImplementation((type, fn, opts) => {
    if (type === 'save-result' || type === 'save-dismissed') ledger.open += 1;
    return realAdd(type, fn, opts);
  });
  vi.spyOn(window, 'removeEventListener').mockImplementation((type, fn, opts) => {
    if (type === 'save-result' || type === 'save-dismissed') ledger.open -= 1;
    return realRemove(type, fn, opts);
  });
  return ledger;
}

const dispatchDismissed = (promptId) => act(async () => {
  window.dispatchEvent(new CustomEvent('save-dismissed', { detail: { promptId } }));
  await new Promise(r => setTimeout(r, 0));
});

const automationRows = () => logService.addEntry.mock.calls.map(c => c[1]).filter(e => e && e.type === 'automation');

describe('SaveAttackAoeModal — dismissed save prompt (picker lane)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    diceRoller.rollExpression.mockImplementation(() => ({ total: 12, rolls: [12], modifier: 0 }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('a matching save-dismissed drains neutral: no damage row, save_dismissed log, dismissed row in summary with working Close, listeners detached', async () => {
    const ledger = trackSaveLedger();
    const props = { ...baseProps, onClose: vi.fn() };
    render(<SaveAttackAoeModal {...props} />);
    const promptId = await pick('Player One');
    expect(ledger.open).toBe(2); // save-result + save-dismissed companions
    expect(document.body.textContent).not.toMatch(/Results/);

    await dispatchDismissed(promptId);

    // Neutral: no damage applied, no fabricated save-damage row, one honest
    // save_dismissed automation row.
    expect(applyDamage.applyDamageToTarget).not.toHaveBeenCalled();
    expect(addTargetResult).not.toHaveBeenCalled();
    expect(logService.addEntry.mock.calls.map(c => c[1]).some(e => e && e.rollType === 'save-damage')).toBe(false);
    expect(automationRows()).toHaveLength(1);
    expect(automationRows()[0]).toMatchObject({
      automationType: 'save_dismissed',
      characterName: 'Cleric1',
      abilityName: 'Fireball',
      targetName: 'Player One',
    });

    // The modal un-strands into the Results summary with a working Close.
    const close = await screen.findByRole('button', { name: /Close/ });
    expect(document.body.textContent).toMatch(/Save dismissed — unaffected/);
    fireEvent.click(close);
    expect(props.onClose).toHaveBeenCalledTimes(1);

    await waitFor(() => expect(ledger.open).toBe(0)); // pendingPrompts drained → effect cleanup
  });

  it('a save-dismissed for a DIFFERENT promptId stays inert (mismatch guard)', async () => {
    const props = { ...baseProps, onClose: vi.fn() };
    render(<SaveAttackAoeModal {...props} />);
    await pick('Player One');

    await dispatchDismissed('someone-else-prompt');

    expect(automationRows()).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /Close/ })).not.toBeInTheDocument();
    expect(props.onClose).not.toHaveBeenCalled();
  });
});
