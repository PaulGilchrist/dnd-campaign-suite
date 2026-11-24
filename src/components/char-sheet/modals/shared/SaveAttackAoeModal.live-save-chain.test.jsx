// @maintained-by-ai
// SaveAttackAoeModal picker-lane LIVE save chain (bug-aoe-live-save-stamped-reload-lapse).
// A fully-live, same-page AoE save resolution used to write a contradictory
// log cluster: SavePromptModal's Done seam ran resolveConsumerlessSavePrompt,
// whose page-local registry only knew createSaveListener consumers, so the
// modal's own pendingSaveListenerPrompts-arm read as "chain died with the
// previous page" — a FALSE `save_lapsed` "resolved after a page reload —
// effect not applied" row (plus its generic save_result twin) landed beside
// the real damage the same modal applied milliseconds later. The same commit
// carried the TARGET's save equation (`1d20+<bonus>` save total) as a
// `save-damage` row attributed to the CASTER — "Caster rolls <spell> damage:
// 21 (1d20+8)" — a phantom damage roll duplicating the honest one below it.
// Locks:
//  • while the modal's save-result listener is mounted, resolveConsumerlessSavePrompt
//    (what the Done seam calls BEFORE dispatching) is byte-inert: ZERO rows, no
//    save_lapsed pair, no stash restore;
//  • the prompt's save audit row is rollType 'save', attributed to the TARGET
//    (attackerName names the caster) and NEVER prints the d20 save equation as
//    spell damage; the only save-damage row carries the damage formula/total;
//  • after unmount (chain genuinely detached — reload/close face) the honest
//    lapse pair still writes (no silent void), proving the suppression is
//    registration-scoped, not a removal of the rescue lane.
//
// Rig mirrors SaveAttackAoeModal.damage-resolution.test.jsx (picker route,
// real CreatureSelectionModal, honest half-on-save semantics).

import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SaveAttackAoeModal from './SaveAttackAoeModal.jsx';

// ── Mocked modules (data seams only — honest save semantics) ──

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
      { name: 'Player One', type: 'player', currentHp: 20, maxHp: 30, saveBonuses: { dex: 4 } },
    ],
  })),
  setCombatSummaryCache: vi.fn(),
}));

vi.mock('../../../../hooks/useAllySelection.js', () => ({
  getAllyList: vi.fn(() => null),
}));

vi.mock('../../../../services/automation/common/damageRollback.js', () => ({
  storeSpellLastAttack: vi.fn(),
  addTargetResult: vi.fn(),
}));

// ── Re-import mocked modules ──

import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as diceRoller from '../../../../services/dice/diceRoller.js';
import * as savePromptService from '../../../../services/combat/conditions/savePromptService.js';
import * as logService from '../../../../services/ui/logService.js';
import * as applyDamage from '../../../../services/rules/combat/applyDamage.js';

// The REAL consumerless-resolution seam — the very call SavePromptModal's
// Done/Dismiss submits before dispatching save-result (modules above keep
// its store/log/fetch lanes mocked, same convention as the sibling rigs).
import { resolveConsumerlessSavePrompt } from '../../../../services/automation/common/savePrompt.js';

// ── Fixtures ──

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

function makeProps(overrides) {
  return { ...baseProps, ...overrides };
}

// Listener-ledger doctrine: unique promptIds per ride — the RNG stream stamps
// distinct decimals into the `${Date.now()}-${random}` prompt id, and a
// shared id poisons later live-save-listener registrations.
let randomCursor = 0;
let randomSpy;

function armPcPrompt() {
  const row = [...document.querySelectorAll('.secondary-target-row')].find(r => r.textContent.includes('Player One'));
  fireEvent.click(row.querySelector('input[type="checkbox"]'));
  const confirmBtn = screen.getByRole('button', { name: /Fireball \(1\)/ });
  return act(async () => {
    fireEvent.click(confirmBtn);
  });
}

function dispatchSaveResult(promptId, detail) {
  return act(async () => {
    window.dispatchEvent(new CustomEvent('save-result', { detail: { promptId, ...detail } }));
  });
}

const logRows = () => logService.addEntry.mock.calls.map(c => c[1]).filter(Boolean);

// The prompt as it sits armed on the campaign books at Done-time (SavePromptModal
// resolves with the arrival row's fields).
function armedPrompt(promptId) {
  return {
    promptId,
    targetName: 'Player One',
    attackerName: 'Cleric1',
    saveType: 'DEX',
    saveDc: 15,
    dcSuccess: 'half',
    sourceName: 'Fireball',
  };
}

const FAILED_DETAIL = { promptId: 'unused', success: false, roll: 3, total: 7, saveBonus: 4 };

beforeEach(() => {
  vi.clearAllMocks();
  randomCursor = (randomCursor % 10) + 1;
  randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => {
    randomCursor = (randomCursor % 10) + 1;
    return 0.9 + randomCursor / 1000;
  });
  diceRoller.rollExpression.mockReturnValue({ total: 12, rolls: [12], modifier: 0 });
  // The listener-armed promptId is present in the campaign bucket exactly as
  // the live arming wrote it; everything else reads unseeded.
  useRuntimeState.getRuntimeValue.mockImplementation((key, prop) => {
    if (key === 'campaign' && prop === 'pendingSaveListenerPrompts') {
      return savePromptService.sendSavePrompt.mock.calls.map(c => c[1].promptId);
    }
    return null;
  });
});

afterEach(() => randomSpy.mockRestore());

describe('SaveAttackAoeModal — live same-page AoE save resolution', () => {
  it('suppresses resolveConsumerlessSavePrompt while the modal listener owns the queue: zero save_lapsed rows', async () => {
    render(<SaveAttackAoeModal {...makeProps({ characters: [{ name: 'Player One' }] })} />);
    await armPcPrompt();

    expect(savePromptService.sendSavePrompt).toHaveBeenCalledTimes(1);
    const { promptId } = savePromptService.sendSavePrompt.mock.calls[0][1];

    logService.addEntry.mockClear();
    // This is what SavePromptModal's Done seam runs BEFORE dispatching
    // save-result — on a same-page live chain it must write NOTHING.
    resolveConsumerlessSavePrompt('test-campaign', armedPrompt(promptId), { ...FAILED_DETAIL, promptId });
    await act(async () => {});

    const rows = logRows();
    expect(rows.filter(e => e.automationType === 'save_lapsed')).toHaveLength(0);
    expect(rows.some(e => e.type === 'save_result')).toBe(false);
    expect(logService.addEntry).not.toHaveBeenCalled();
  });

  it('attributes the prompt save to the target as a rollType:save row and never prints the save equation as caster damage', async () => {
    render(<SaveAttackAoeModal {...makeProps({ characters: [{ name: 'Player One' }] })} />);
    await armPcPrompt();
    const { promptId } = savePromptService.sendSavePrompt.mock.calls[0][1];

    await dispatchSaveResult(promptId, { success: false, saveBonus: 4, rawDamage: 12, total: 7, roll: 3, saveType: 'DEX', dcSuccess: 'half' });

    await waitFor(() => expect(applyDamage.applyDamageToTarget).toHaveBeenCalled());

    const rows = logRows();
    // The save equation rides an honest save row owned by the TARGET.
    const saveRow = rows.find(e => e.rollType === 'save' && e.targetName === 'Player One');
    expect(saveRow).toMatchObject({
      type: 'roll',
      characterName: 'Player One',
      attackerName: 'Cleric1',
      name: 'Fireball',
      saveType: 'DEX',
      saveDc: 15,
      saveResult: 'failure',
      total: 7,
      rolls: [3],
      bonus: 4,
    });

    // No save-damage row may carry the d20 save formula attributed to the
    // caster — the phantom "Cleric1 rolls Fireball damage: 7 (1d20+4)" class.
    const saveDamageRows = rows.filter(e => e.rollType === 'save-damage');
    expect(saveDamageRows.every(e => !/^1d20/.test(String(e.formula || '')))).toBe(true);
    expect(saveDamageRows.every(e => e.formula === '8d6')).toBe(true);
    // ...and the one real damage row stays caster-attributed with the damage dice.
    expect(saveDamageRows).toHaveLength(1);
    expect(saveDamageRows[0]).toMatchObject({
      characterName: 'Cleric1',
      total: 12,
      finalDamage: 12,
      damageType: 'Fire',
    });
  });

  it('keeps the honest lapse pair for a detached chain (unmount = reload face, no silent void)', async () => {
    const { unmount } = render(<SaveAttackAoeModal {...makeProps({ characters: [{ name: 'Player One' }] })} />);
    await armPcPrompt();
    const { promptId } = savePromptService.sendSavePrompt.mock.calls[0][1];

    unmount(); // consumer leaves with the page/view — the replayed prompt now has NO live chain

    logService.addEntry.mockClear();
    resolveConsumerlessSavePrompt('test-campaign', armedPrompt(promptId), { ...FAILED_DETAIL, promptId });
    await act(async () => {});

    const rows = logRows();
    expect(rows.some(e => e.type === 'save_result')).toBe(true);
    const lapseRows = rows.filter(e => e.automationType === 'save_lapsed');
    expect(lapseRows).toHaveLength(1);
    expect(lapseRows[0].description).toContain('was resolved after a page reload');
  });
});
