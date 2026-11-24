// @maintained-by-ai
// Results-face save-equation law (bug-spell-results-face-save-total-contradicts-saved-verdict).
// The per-target rows used to print ONLY the raw d20 in `(rolled M)` while the verdict
// and the halving were adjudicated on the hidden TOTAL (d20 + save bonus), so a Saved
// face could print a number BELOW the DC it announced (live-captured Burning Hands:
// "Saved — takes 12 Fire damage (rolled 10, halved)" vs DC 17). The row now prints the
// same equation the save_result log rows carry — `rolled R + B = T vs DC D` — pinned
// here on BOTH faces at arithmetic seams where the old face contradicted itself:
//   · SAVED with the total EXACTLY meeting DC (raw d20 15 < DC 17) — the old `(rolled 15)`
//     sat under DC 17 next to the Saved verdict.
//   · FAILED by exactly 1 with a NEGATIVE bonus (raw d20 17 ≥ DC 17) — the old
//     `(rolled 17)` sat at/over DC 17 next to the Failed verdict.
// Machine truth stays untouched: the rollback ledger and the save-damage log row keep
// carrying the RAW saveRoll and the saveBonus separately; only the face copy changed.
//
// Harness mirrors damage-resolution.test.jsx (picker route, real CreatureSelectionModal,
// honest half-on-save semantics; base lane never mounted).

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
  // Honest half-on-save semantics (fail pays full).
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
      // saveBonuses keys are lowercase by contract (computeNpcSave lookup).
      { name: 'Goblin A', type: 'npc', currentHp: 40, maxHp: 40, saveBonuses: { dex: 2 }, resistances: [], immunities: [] },
      { name: 'Zombie 1', type: 'npc', currentHp: 40, maxHp: 40, saveBonuses: { dex: -1 }, resistances: [], immunities: [] },
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

import * as diceRoller from '../../../../services/dice/diceRoller.js';
import * as damageRollback from '../../../../services/automation/common/damageRollback.js';
import * as logService from '../../../../services/ui/logService.js';
import * as applyDamage from '../../../../services/rules/combat/applyDamage.js';

// ── Fixtures ──

const baseProps = {
  action: { name: 'Fireball', automation: { scaling: { damage: '8d6' } } },
  playerStats: { name: 'Cleric1', level: 12 },
  campaignName: 'test-campaign',
  range: 20,
  damage: '8d6',
  damageType: 'Fire',
  saveType: 'DEX',
  saveDc: 17,
  dcSuccess: 'half',
  onClose: vi.fn(),
};

function checkboxFor(name) {
  const row = [...document.querySelectorAll('.secondary-target-row')].find(r => r.textContent.includes(name));
  return row.querySelector('input[type="checkbox"]');
}

function pick(...names) {
  names.forEach(n => fireEvent.click(checkboxFor(n)));
  const confirmBtn = screen.getByRole('button', { name: new RegExp(`Fireball \\(${names.length}\\)`) });
  return act(async () => {
    fireEvent.click(confirmBtn);
  });
}

function saveDamageLogs(targetName) {
  return logService.addEntry.mock.calls
    .map(c => c[1])
    .filter(e => e && e.rollType === 'save-damage' && e.targetName === targetName);
}

function rollbackRow(targetName) {
  return damageRollback.addTargetResult.mock.calls.map(c => c[1]).find(r => r && r.targetName === targetName);
}

// ── RNG stream: computeNpcSave draws exactly TWO Math.random per NPC
// (raw1, raw2; min only under disadvantage). Goblin A draws 0.7 twice →
// d20 floor(0.7*20)+1 = 15; Zombie 1 draws 0.8 twice → d20 17. ──

let randomSpy;
let randomDraws = [];

beforeEach(() => {
  vi.clearAllMocks();
  randomDraws = [0.7, 0.7, 0.8, 0.8];
  randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => (randomDraws.length ? randomDraws.shift() : 0.5));
  // Deterministic damage pool: 8d6 rolls 12 (half-on-save floor → 6).
  diceRoller.rollExpression.mockImplementation((f) => ({ total: 12, rolls: [12], modifier: 0, formula: f }));
});

afterEach(() => randomSpy.mockRestore());

// ── Tests ──

describe('SaveAttackAoeModal — Results face prints the adjudicated save equation', () => {
  it('SAVED face with the total exactly meeting DC shows the full equation, never the bare raw d20', async () => {
    render(<SaveAttackAoeModal {...baseProps} />);
    await pick('Goblin A');

    await waitFor(() => expect(screen.getByText(/Fireball — Results/)).toBeInTheDocument());
    const row = screen.getByText('Goblin A').closest('.abjure-result');
    // Engine truth: d20 15 + dex 2 = 17 meets DC 17 → Saved, 12 floor-halved to 6.
    // The PRE-FIX face printed '(rolled 15, halved)' — a Saved verdict beside a
    // number below the DC (the captured contradiction).
    expect(row.textContent).toBe('Goblin A: Saved — takes 6 Fire damage (rolled 15 + 2 = 17 vs DC 17, halved)');
    // The legacy bare-raw faces must never render on this lane again.
    expect(row.textContent).not.toContain('(rolled 15)');
    expect(row.textContent).not.toContain('(rolled 15, halved)');
  });

  it('FAILED face losing by 1 with a negative bonus shows the full equation, never the bare raw d20', async () => {
    randomDraws = [0.8, 0.8];
    render(<SaveAttackAoeModal {...baseProps} />);
    await pick('Zombie 1');

    await waitFor(() => expect(screen.getByText(/Fireball — Results/)).toBeInTheDocument());
    const row = screen.getByText('Zombie 1').closest('.abjure-result');
    // Engine truth: d20 17 + dex -1 = 16, exactly 1 short of DC 17 → Failed, full 12.
    // The PRE-FIX face printed '(rolled 17)' — a raw die at DC beside a Failed verdict,
    // the mirror-image contradiction.
    expect(row.textContent).toBe('Zombie 1: Failed — takes 12 Fire damage (rolled 17 + -1 = 16 vs DC 17)');
    expect(row.textContent).not.toContain('(rolled 17)');
  });

  it('machine truth is display-only changed: rollback ledger + save-damage log row still carry the RAW saveRoll and saveBonus', async () => {
    render(<SaveAttackAoeModal {...baseProps} />);
    await pick('Goblin A', 'Zombie 1');

    await waitFor(() => expect(screen.getByText(/Fireball — Results/)).toBeInTheDocument());
    const rows = [...document.querySelectorAll('.abjure-results-list .abjure-result')].map(r => r.textContent);
    expect(rows).toContain('Goblin A: Saved — takes 6 Fire damage (rolled 15 + 2 = 17 vs DC 17, halved)');
    expect(rows).toContain('Zombie 1: Failed — takes 12 Fire damage (rolled 17 + -1 = 16 vs DC 17)');

    expect(applyDamage.applyDamageToTarget).toHaveBeenCalledWith(expect.anything(), 'Goblin A', 6, ['Fire'], expect.anything());
    expect(applyDamage.applyDamageToTarget).toHaveBeenCalledWith(expect.anything(), 'Zombie 1', 12, ['Fire'], expect.anything());

    // Rollback ledger: roll stays the RAW d20, total is the adjudicated save total.
    expect(rollbackRow('Goblin A')).toMatchObject({ saveResult: 'success', roll: 15, total: 17, appliedDamage: 6 });
    expect(rollbackRow('Zombie 1')).toMatchObject({ saveResult: 'failure', roll: 17, total: 16, appliedDamage: 12 });

    // Campaign log rows unchanged by the face-copy fix.
    expect(saveDamageLogs('Goblin A')[0]).toMatchObject({
      saveResult: 'success', saveRoll: 15, saveBonus: 2, saveDc: 17, finalDamage: 6, mode: 'normal',
    });
    expect(saveDamageLogs('Zombie 1')[0]).toMatchObject({
      saveResult: 'failure', saveRoll: 17, saveBonus: -1, saveDc: 17, finalDamage: 12, mode: 'normal',
    });
  });
});
