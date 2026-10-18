// @maintained-by-ai
// SaveAttackAoeModal OVERLAY lane: the branch at SaveAttackAoeModal.jsx:1972
// (`isOverlayTargeted && activeOverlay`) is the only place in the family that
// mounts AreaEffectTargetModalBase — so the base is mounted LIVE here (its own
// wiring to renderBody/renderActions/handleApplyOverride is the behavior under
// test). The picker lane it competes with is also live (real CreatureSelectionModal,
// proven deterministic by creature-selection/damage-resolution siblings).
//
// Owned here (not duplicated in siblings):
//   1. overlay- + activeOverlay → base lane renders AND round-trips an NPC
//      save through the base ctx.apply seam (honest full-on-fail damage).
//   2. either operand falsy → fallback to the CreatureSelectionModal picker.
// NPC auto-resolve details (lastAttack stamp shape, CLA-109 disadvantage,
// MA-0563 dual pools, PC prompt halves) are owned by damage-resolution.test.jsx
// and never re-litigated here.
//
// persistAndNotify stays LIVE (#225) — combatData cache setter mocked, storage
// backed by the inert localStorage/fetch from src/test/setup.js.

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
  // Honest save semantics: failed save pays FULL damage, successful save
  // takes floor-half, Evasion on a successful half-damage save takes 0.
  computeDamageAfterEvasion: vi.fn((raw, success, dcSuccess, evasionActive) => {
    if (dcSuccess !== 'half') return raw;
    if (!success) return raw;
    return evasionActive ? 0 : Math.floor(raw / 2);
  }),
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
      { name: 'Goblin A', type: 'npc', currentHp: 5, maxHp: 10, saveBonuses: { dex: 2 }, resistances: [], immunities: [] },
      { name: 'Goblin B', type: 'npc', currentHp: 3, maxHp: 10, saveBonuses: { dex: 2 }, resistances: [], immunities: [] },
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

import * as diceRoller from '../../../../services/dice/diceRoller.js';
import * as damageRollback from '../../../../services/automation/common/damageRollback.js';
import * as savePromptService from '../../../../services/combat/conditions/savePromptService.js';
import * as logService from '../../../../services/ui/logService.js';
import * as applyDamage from '../../../../services/rules/combat/applyDamage.js';

// ── Fixtures ──

const baseProps = {
  action: { name: 'Fireball', automation: { scaling: { damage: '8d6' } } },
  campaignName: 'test-campaign',
  range: 20,
  damage: '8d6',
  damageType: 'Fire',
  saveType: 'DEX',
  saveDc: 15,
  dcSuccess: 'half',
  onClose: vi.fn(),
};

function overlayProps(overrides) {
  return {
    ...baseProps,
    playerStats: { name: 'Cleric1', level: 12, targetName: 'overlay-1' },
    activeOverlay: true,
    ...overrides,
  };
}

// ── Helpers ──

function baseLaneCheckbox(name) {
  const row = [...document.querySelectorAll('.abjure-target-row')].find(r => r.textContent.includes(name));
  return row.querySelector('input[type="checkbox"]');
}

function npcSaveDamageLogs(targetName) {
  return logService.addEntry.mock.calls
    .map(c => c[1])
    .filter(e => e && e.rollType === 'save-damage' && e.targetName === targetName);
}

// ── RNG stream: computeNpcSave draws exactly TWO Math.random per NPC
// (raw1, raw2; min only taken under disadvantage). 0.01 ⇒ raw roll
// Math.floor(0.01 * 20) + 1 = 1 → 1 + 2 dex = 3 fails DC 15 honestly.

let randomSpy;
let randomDraws = [];

beforeEach(() => {
  vi.clearAllMocks();
  randomDraws = [];
  randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => (randomDraws.length ? randomDraws.shift() : 0.99));
  diceRoller.rollExpression.mockImplementation((f) => ({ total: 12, rolls: [12], modifier: 0, formula: f }));
});

afterEach(() => randomSpy.mockRestore());

// ── Tests ──

describe('SaveAttackAoeModal - overlay targeting path', () => {
  it('overlay- target + activeOverlay mounts the base lane and round-trips the NPC save: full damage on a failed save', async () => {
    randomDraws = [0.01, 0.01]; // NPC draws two dice; no disadvantage → raw1=1 decides
    const onClose = vi.fn();
    render(<SaveAttackAoeModal {...overlayProps({ onClose })} />);

    // Base lane chrome (renderBody/renderActions rendered live through the base):
    expect(screen.getByText('Targets selected: 0/3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull();
    // Inert before confirm: nothing rolled, no prompts, no damage applied.
    expect(diceRoller.rollExpression).not.toHaveBeenCalled();
    expect(applyDamage.applyDamageToTarget).not.toHaveBeenCalled();
    expect(savePromptService.sendSavePrompt).not.toHaveBeenCalled();

    fireEvent.click(baseLaneCheckbox('Goblin A'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Fireball \(1 target\)/ }));
    });

    // Failed save (rolled 1 + 2 vs DC 15) pays the FULL 12 — honest dice.
    expect(applyDamage.applyDamageToTarget).toHaveBeenCalledWith(
      expect.anything(), 'Goblin A', 12, ['Fire'], expect.objectContaining({ attackerName: 'Cleric1' }));

    const logs = npcSaveDamageLogs('Goblin A');
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      formula: '8d6', damageType: 'Fire', saveResult: 'failure',
      saveRoll: 1, saveBonus: 2, mode: 'normal', finalDamage: 12,
    });
    expect(logService.addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      type: 'ability_use',
      abilityName: 'Fireball',
      description: 'Fireball: Selecting 1 target(s) for save (DC 15 DEX)',
    }));
    const rollbackRow = damageRollback.addTargetResult.mock.calls.map(c => c[1]).find(r => r && r.targetName === 'Goblin A');
    expect(rollbackRow).toMatchObject({ saveResult: 'failure', roll: 1, total: 3, appliedDamage: 12 });

    // Results view replaces the base picker; Close dismisses.
    // NOTE (source bug filed 2026-10-17, not enshrined): the summary ROWS do
    // not render on this lane — extraState overrides ctx.selected with the
    // parent's Set (AreaEffectTargetModalBase.jsx:214) so the base's internal
    // selected stays empty, allResolved flips true on the setProcessing(true)
    // flush, and renderActions commits setSummary with results still []. The
    // header + Close seam is asserted; row content is intentionally NOT pinned.
    await waitFor(() => expect(screen.getByText(/Fireball — Results/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('falls back to the CreatureSelectionModal picker lane when either overlay operand is falsy', () => {
    // Operand 1: overlay- target but no active overlay.
    const { unmount } = render(<SaveAttackAoeModal {...overlayProps({ activeOverlay: false })} />);
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
    expect(screen.getByText('On a failed save, target takes 8d6 Fire damage. On a successful save, target takes half damage.')).toBeInTheDocument();
    unmount();

    // Operand 2: active overlay but the target is not an overlay target.
    render(<SaveAttackAoeModal {...overlayProps({ playerStats: { name: 'Cleric1', level: 12, targetName: 'normal-target' } })} />);
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
  });
});
