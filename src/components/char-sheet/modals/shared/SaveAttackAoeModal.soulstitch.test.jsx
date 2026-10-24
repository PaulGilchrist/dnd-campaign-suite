// @maintained-by-ai
// CLA-321: SaveAttackAoeModal must enforce the Soulstitch Spells stamp on the live sheet AoE path.
// Three lanes: (1) NPC auto-resolve at confirm (protected zeroed, unprotected normal, stamp consumed
// once, popup row); (2) PC auto-resolve at confirm (no prompt); (3) stamp applied mid-prompt is
// enforced by the save-result handler.
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SaveAttackAoeModal from './SaveAttackAoeModal.jsx';

// ── Mocked modules ──

vi.mock('../../../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 20, rolls: [20], modifier: 0, formula: '8d6' })),
  rollExpressionMaximized: vi.fn(() => ({ total: 20, rolls: [20], modifier: 0, formula: '8d6', maximized: true })),
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
  applyDamageToTarget: vi.fn(() => ({ finalDamage: 20, newHp: 12 })),
  computeDamageAfterSave: vi.fn((raw, success, dcSuccess) => (success && dcSuccess === 'half' ? Math.floor(raw / 2) : raw)),
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
      { name: 'Thug 1', type: 'npc', currentHp: 32, maxHp: 32, saveBonuses: { dex: 1 }, resistances: [], immunities: [] },
      { name: 'Zombie 1', type: 'npc', currentHp: 15, maxHp: 15, saveBonuses: { dex: -1 }, resistances: [], immunities: [] },
      { name: 'Player One', type: 'player', currentHp: 20, maxHp: 30, saveBonuses: { dex: 3 } },
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

vi.mock('../../../../hooks/combat/handlers/handleOverchannelSelfDamage.js', () => ({
  handleOverchannelSelfDamage: vi.fn(async () => {}),
}));

vi.mock('../../../../hooks/combat/loggedDiceRollUtils.js', () => ({
    getGuardianProtectionAcBonus: vi.fn(() => 0),
  hasSoulstitchProtection: vi.fn(),
  clearSoulstitchStamp: vi.fn(),
}));

vi.mock('./CreatureSelectionModal.jsx', async () => {
  const { createInteractivePickerModal } = await import('./SaveAttackAoeModal.test-utils.jsx');
  return { default: createInteractivePickerModal() };
});

// ── Re-import mocked modules ──

import { addEntry } from '../../../../services/ui/logService.js';
import { applyDamageToTarget } from '../../../../services/rules/combat/applyDamage.js';
import { sendSavePrompt } from '../../../../services/combat/conditions/savePromptService.js';
import { hasSoulstitchProtection, clearSoulstitchStamp } from '../../../../hooks/combat/loggedDiceRollUtils.js';
import { addTargetResult } from '../../../../services/automation/common/damageRollback.js';

const baseAction = { name: 'Fireball', automation: {} };
const basePlayerStats = { name: 'DivinationWizard', level: 20 };

const baseProps = {
  action: baseAction,
  playerStats: basePlayerStats,
  campaignName: 'test-campaign',
  damage: '8d6',
  damageType: 'Fire',
  saveType: 'DEX',
  saveDc: 17,
  dcSuccess: 'half',
  onClose: vi.fn(),
};

async function renderAndConfirm(names) {
  await act(async () => {
    render(<SaveAttackAoeModal {...baseProps} />);
  });
  await act(async () => {
    for (const name of names) {
      const input = screen.getByText(name).closest('label').querySelector('input[type="checkbox"]');
      fireEvent.click(input);
    }
    fireEvent.click(screen.getByRole('button', { name: /Fireball/ }));
  });
}

function soulstitchLogCalls() {
  return addEntry.mock.calls
    .map(c => c[1])
    .filter(e => e && e.rollType === 'save-damage' && String(e.name).includes('(Soulstitch)'));
}

describe('SaveAttackAoeModal — CLA-321 Soulstitch enforcement', () => {
  let randomSpy;
  beforeEach(() => {
    vi.clearAllMocks();
    hasSoulstitchProtection.mockReturnValue(false);
    // Deterministic save dice: every d20 draw lands 1 (floor(0.01*20)+1).
    randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.01);
  });

  afterEach(() => {
    randomSpy.mockRestore();
  });

  it('NPC lane: protected creature auto-succeeds for 0 damage while unprotected creatures take normal damage, the stamp clears once, and the popup marks the protected row', async () => {
    hasSoulstitchProtection.mockImplementation((targetName) => targetName === 'Thug 1');

    await renderAndConfirm(['Thug 1', 'Zombie 1']);

    // Thug 1: auto-success log — no roll dice, 0 damage, soulstitch-labelled.
    const autoLogs = soulstitchLogCalls();
    expect(autoLogs).toHaveLength(1);
    expect(autoLogs[0]).toMatchObject({
      name: 'Fireball (Soulstitch)',
      targetName: 'Thug 1',
      saveResult: 'soulstitch_auto_success',
      saveRoll: null,
      rolls: [],
      finalDamage: 0,
    });

    // Thug 1 never receives an applyDamage write; the rollback ledger records 0.
    const appliedTargets = applyDamageToTarget.mock.calls.map(c => c[1]);
    expect(appliedTargets).not.toContain('Thug 1');
    const thugResults = addTargetResult.mock.calls.map(c => c[1]).filter(r => r.targetName === 'Thug 1');
    expect(thugResults).toHaveLength(1);
    expect(thugResults[0]).toMatchObject({ saveResult: 'soulstitch_auto_success', appliedDamage: 0 });

    // Zombie 1: unprotected, normal path — pinned roll 1 + (-1) = 0 fails DC 17 and pays full 20.
    const normalLogs = addEntry.mock.calls
      .map(c => c[1])
      .filter(e => e && e.rollType === 'save-damage' && e.targetName === 'Zombie 1');
    expect(normalLogs).toHaveLength(1);
    expect(normalLogs[0]).toMatchObject({
      name: 'Fireball',
      saveResult: 'failure',
      saveRoll: 1,
      saveBonus: -1,
      finalDamage: 20,
    });
    const zombieApply = applyDamageToTarget.mock.calls.filter(c => c[1] === 'Zombie 1');
    expect(zombieApply).toHaveLength(1);
    expect(zombieApply[0][2]).toBe(20);

    // Stamp lasts only the cast that wrote it — cleared exactly once after all saves resolve.
    expect(clearSoulstitchStamp).toHaveBeenCalledTimes(1);
    expect(clearSoulstitchStamp).toHaveBeenCalledWith('DivinationWizard', 'test-campaign');

    // Result popup: exactly one soulstitch row (the protected creature), normal row for the rest.
    await waitFor(() => {
      expect(screen.getAllByText(/Soulstitch — automatically succeeds, takes no damage/)).toHaveLength(1);
    });
    expect(screen.getByText(/Failed — takes 20 Fire damage \(rolled 1\)/)).toBeInTheDocument();
  });

  it('PC lane: chosen player auto-resolves at confirm — no save prompt, auto-success log, zero damage written', async () => {
    hasSoulstitchProtection.mockImplementation((targetName) => targetName === 'Player One');

    await renderAndConfirm(['Player One']);

    expect(sendSavePrompt).not.toHaveBeenCalled();

    const autoLogs = soulstitchLogCalls();
    expect(autoLogs).toHaveLength(1);
    expect(autoLogs[0]).toMatchObject({
      name: 'Fireball (Soulstitch)',
      targetName: 'Player One',
      saveResult: 'soulstitch_auto_success',
      saveRoll: null,
      finalDamage: 0,
    });

    // The PC lane writes a 0-damage apply (HP-tracking stub), never a positive amount.
    const pcApply = applyDamageToTarget.mock.calls.filter(c => c[1] === 'Player One');
    expect(pcApply).toHaveLength(1);
    expect(pcApply[0][2]).toBe(0);

    const pcResults = addTargetResult.mock.calls.map(c => c[1]).filter(r => r.targetName === 'Player One');
    expect(pcResults).toHaveLength(1);
    expect(pcResults[0]).toMatchObject({ saveResult: 'soulstitch_auto_success', appliedDamage: 0 });
  });

  it('PC prompt lane: stamp applied mid-cast forces auto-success 0 damage on the save-result, bypassing the failed roll', async () => {
    // Unprotected at confirm → prompt is sent for Player One.
    await renderAndConfirm(['Player One']);
    expect(sendSavePrompt).toHaveBeenCalledTimes(1);

    // Stamp lands mid-cast (chooser re-confirm); the modal-local save-result handler must enforce it
    // even though the player's rolled save (3 + 3 = 6) failed DC 17.
    hasSoulstitchProtection.mockReturnValue(true);
    await act(async () => {
      window.dispatchEvent(new CustomEvent('save-result', {
        detail: {
          promptId: sendSavePrompt.mock.calls[0][1].promptId,
          targetName: 'Player One',
          success: false,
          roll: 3,
          total: 6,
          saveBonus: 3,
          saveType: 'DEX',
          saveDc: 17,
          dcSuccess: 'half',
          rawDamage: 20,
        },
      }));
    });

    await waitFor(() => {
      const autoLogs = soulstitchLogCalls().filter(e => e.targetName === 'Player One');
      expect(autoLogs).toHaveLength(1);
      expect(autoLogs[0]).toMatchObject({ saveResult: 'soulstitch_auto_success', finalDamage: 0 });
    });

    // The failed-roll damage path must not run: no apply writes, no non-soulstitch save-damage log.
    expect(applyDamageToTarget.mock.calls.filter(c => c[1] === 'Player One')).toHaveLength(0);
    const normalLogs = addEntry.mock.calls
      .map(c => c[1])
      .filter(e => e && e.rollType === 'save-damage' && e.targetName === 'Player One' && !String(e.name).includes('(Soulstitch)'));
    expect(normalLogs).toHaveLength(0);

    const pcResults = addTargetResult.mock.calls.map(c => c[1]).filter(r => r.targetName === 'Player One');
    expect(pcResults).toHaveLength(1);
    expect(pcResults[0]).toMatchObject({ saveResult: 'soulstitch_auto_success', appliedDamage: 0 });
  });
});
