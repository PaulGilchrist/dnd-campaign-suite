// @maintained-by-ai
// SaveAttackAoeModal damage-resolution lanes (picker route).
// Family roles kept distinct from siblings:
//   - creature-selection.test.jsx  → picker rendering / metamagic
//   - damage-edge-cases.test.jsx   → Careful Spell zeroing, multi-target rows
//   - overlay.test.jsx             → AreaEffectTargetModalBase lane
// Here: the NPC auto-resolve round trip, the PC prompt half-on-save round
// trip, CLA-109 disadvantage consume, and MA-0563 dual damage pools.
//
// Picker-lane tests use the REAL CreatureSelectionModal (proven inert in
// creature-selection.test.jsx — no campaignName/attackerName passed, its
// overlay lookup early-returns). AreaEffectTargetModalBase is never mounted
// here (requires an 'overlay-' targetName), so it is not stubbed.
//
// Determinism: computeNpcSave draws exactly TWO Math.random values per NPC
// (min taken on disadvantage), and resolvePcTarget draws one per promptId —
// the spy stream keeps promptIds unique and lets the disadvantage test prove
// min() is taken (raw 20 would beat the DC, raw 2 must not). DC 999 is the
// family unconditional-NPC-fail seam.

import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import SaveAttackAoeModal from './SaveAttackAoeModal.jsx';

// ── Mocked modules (data seams only — honest half-on-save semantics) ──

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
      { name: 'Goblin A', type: 'npc', currentHp: 5, maxHp: 10, saveBonuses: { dex: 2 }, resistances: [], immunities: [] },
      { name: 'Goblin B', type: 'npc', currentHp: 3, maxHp: 10, saveBonuses: { dex: 2 }, resistances: [], immunities: [] },
      { name: 'Player One', type: 'player', currentHp: 20, maxHp: 30, saveBonuses: { dex: 4 } },
      { name: 'Player Two', type: 'player', currentHp: 20, maxHp: 30, saveBonuses: { dex: 4 } },
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
import * as damageRollback from '../../../../services/automation/common/damageRollback.js';
import * as savePromptService from '../../../../services/combat/conditions/savePromptService.js';
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
  saveDc: 15,
  dcSuccess: 'half',
  onClose: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...overrides };
}

// ── Helpers ──

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

function rollbackRow(targetName) {
  return damageRollback.addTargetResult.mock.calls.map(c => c[1]).find(r => r && r.targetName === targetName);
}

function saveDamageLogs(targetName) {
  return logService.addEntry.mock.calls
    .map(c => c[1])
    .filter(e => e && e.rollType === 'save-damage' && (!targetName || e.targetName === targetName));
}

function dispatchSaveResult(promptId, detail) {
  return act(async () => {
    window.dispatchEvent(new CustomEvent('save-result', { detail: { promptId, ...detail } }));
  });
}

// ── RNG stream ──

let randomSpy;
let randomDraws = [];
let randomCursor = 0;

beforeEach(() => {
  vi.clearAllMocks();
  randomDraws = [];
  randomCursor = 0;
  randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => {
    if (randomDraws.length) return randomDraws.shift();
    // Raw rolls always 19; the unique decimal keeps per-prompt promptIds distinct.
    randomCursor = (randomCursor % 10) + 1;
    return 0.9 + randomCursor / 1000;
  });
  diceRoller.rollExpression.mockImplementation((f) => ({
    total: f === '8d6' ? 12 : 7,
    rolls: [f === '8d6' ? 12 : 7],
    modifier: 0,
  }));
});

afterEach(() => randomSpy.mockRestore());

// ── Tests ──

describe('SaveAttackAoeModal - Damage resolution', () => {
  it('auto-resolves an NPC save: lastAttack stamp, full damage applied, rollback row, results summary closes', async () => {
    const onClose = vi.fn();
    // DC 999: unconditional fail (family RNG seam) — fail pays the FULL 12.
    render(<SaveAttackAoeModal {...makeProps({ onClose, saveDc: 999 })} />);
    await pick('Goblin A');

    expect(damageRollback.storeSpellLastAttack).toHaveBeenCalledWith('test-campaign', {
      casterName: 'Cleric1',
      spellName: 'Fireball',
      saveType: 'DEX',
      saveDc: 999,
      attackScope: 'aoe',
      spellSchool: null,
    });
    expect(applyDamage.applyDamageToTarget).toHaveBeenCalledWith(expect.anything(), 'Goblin A', 12, ['Fire'], expect.anything());

    const logs = saveDamageLogs('Goblin A');
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ formula: '8d6', damageType: 'Fire', saveResult: 'failure', mode: 'normal', finalDamage: 12 });
    expect(rollbackRow('Goblin A')).toMatchObject({ saveResult: 'failure', roll: 19, total: 21, appliedDamage: 12 });

    // Every automation logs its cast to the campaign log.
    expect(logService.addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      type: 'ability_use',
      abilityName: 'Fireball',
    }));

    // Summary replaces the picker with the resolved row, Close dismisses.
    await waitFor(() => expect(screen.getByText(/Fireball — Results/)).toBeInTheDocument());
    expect(screen.getByText('Goblin A').closest('.abjure-result').textContent).toContain('Failed — takes 12 Fire damage');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('prompts each PC and halves on a successful save / pays full on a failed save, per target', async () => {
    render(<SaveAttackAoeModal {...makeProps({ characters: [{ name: 'Player One' }, { name: 'Player Two' }] })} />);
    await pick('Player One', 'Player Two');

    expect(savePromptService.sendSavePrompt).toHaveBeenCalledTimes(2);
    expect(savePromptService.sendSavePrompt).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      targetName: 'Player One',
      saveType: 'DEX',
      saveDc: 15,
      sourceName: 'Cleric1',
      rawDamage: 12,
      dcSuccess: 'half',
      disadvantage: false,
    }));

    const [p1, p2] = savePromptService.sendSavePrompt.mock.calls.map(c => c[1]);
    await dispatchSaveResult(p1.promptId, { success: false, saveBonus: 4, rawDamage: 12, total: 5, roll: 1, saveType: 'DEX', dcSuccess: 'half' });
    await dispatchSaveResult(p2.promptId, { success: true, saveBonus: 4, rawDamage: 12, total: 19, roll: 19, saveType: 'DEX', dcSuccess: 'half' });

    expect(applyDamage.applyDamageToTarget).toHaveBeenCalledWith(expect.anything(), 'Player One', 12, ['Fire'], expect.anything());
    expect(applyDamage.applyDamageToTarget).toHaveBeenCalledWith(expect.anything(), 'Player Two', 6, ['Fire'], expect.anything());
    expect(rollbackRow('Player One')).toMatchObject({ saveResult: 'failure', appliedDamage: 12 });
    expect(rollbackRow('Player Two')).toMatchObject({ saveResult: 'success', appliedDamage: 6 });

    await waitFor(() => expect(screen.getByText(/Fireball — Results/)).toBeInTheDocument());
    expect(screen.getByText('Player One').closest('.abjure-result').textContent).toContain('Failed — takes 12 Fire damage');
    expect(screen.getByText('Player Two').closest('.abjure-result').textContent).toContain('Saved — takes 6 Fire damage');
  });

  it('CLA-109 disadvantage_on_next_save: NPC rolls two dice at min (would-pass roll becomes fail), pays full, effect consumed', async () => {
    // raw1=20 (20+2 beats DC 15) then raw2=2 — min(20,2)=2 fails, proving
    // the disadvantage branch is live, not just that a roll happened.
    randomDraws = [0.95, 0.05];
    useRuntimeState.getRuntimeValue.mockImplementation((key, prop) => (
      key === 'campaign' && prop === 'targetEffects'
        ? [{ target: 'Goblin A', effect: 'disadvantage_on_next_save' }]
        : null
    ));

    render(<SaveAttackAoeModal {...makeProps()} />);
    await pick('Goblin A');

    const logs = saveDamageLogs('Goblin A');
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      saveResult: 'failure',
      mode: 'disadvantage',
      saveRawRolls: [20, 2],
      saveRoll: 2,
      finalDamage: 12,
    });
    expect(applyDamage.applyDamageToTarget).toHaveBeenCalledWith(expect.anything(), 'Goblin A', 12, ['Fire'], expect.anything());

    // One-shot effect: the te is stripped after the save.
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [], 'test-campaign');
  });

  // ── MA-0563: dual-pool AoE save rows (Death Knight Hellfire Orb) ──

  describe('MA-0563 secondary damage pool', () => {
    function dualProps(overrides) {
      return makeProps({ damage: '8d6', damageType: 'Fire', secondaryDamage: '10d6', secondaryDamageType: 'Necrotic', ...overrides });
    }

    function damageLogCalls() {
      return logService.addEntry.mock.calls.map(c => c[1]).filter(e => e && e.rollType === 'save-damage' && e.formula);
    }

    it('failed save rolls BOTH pools full, applies each type separately, logs one save-damage entry per type', async () => {
      // DC 999 → guaranteed NPC fail, both legs full (floor-halving untaken).
      render(<SaveAttackAoeModal {...dualProps({ saveDc: 999 })} />);
      await pick('Goblin A');

      const targetCalls = applyDamage.applyDamageToTarget.mock.calls.filter(c => c[1] === 'Goblin A');
      expect(targetCalls).toHaveLength(2);
      expect(applyDamage.applyDamageToTarget).toHaveBeenCalledWith(expect.anything(), 'Goblin A', 12, ['Fire'], expect.anything());
      expect(applyDamage.applyDamageToTarget).toHaveBeenCalledWith(expect.anything(), 'Goblin A', 7, ['Necrotic'], expect.anything());

      const logs = damageLogCalls();
      const primary = logs.find(e => e.formula === '8d6');
      const secondary = logs.find(e => e.formula === '10d6');
      expect(primary).toMatchObject({ damageType: 'Fire', finalDamage: 12, saveResult: 'failure' });
      expect(secondary).toMatchObject({ damageType: 'Necrotic', finalDamage: 7, saveResult: 'failure' });

      expect(rollbackRow('Goblin A').appliedDamage).toBe(19);

      await waitFor(() => {
        expect(screen.getByText(/takes 12 Fire \+ 7 Necrotic damage/)).toBeInTheDocument();
      });
    });

    it('PC prompt carries both raw pools and a successful save halves EACH pool independently (floor each leg)', async () => {
      render(<SaveAttackAoeModal {...dualProps({ characters: [{ name: 'Player One' }] })} />);
      await pick('Player One');

      expect(savePromptService.sendSavePrompt).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
        targetName: 'Player One',
        rawDamage: 12,
        secondaryRawDamage: 7,
        secondaryDamageType: 'Necrotic',
      }));

      const promptCall = savePromptService.sendSavePrompt.mock.calls[0][1];
      await dispatchSaveResult(promptCall.promptId, { success: true, saveBonus: 4, rawDamage: 12, total: 16, roll: 16, saveType: 'DEX', dcSuccess: 'half' });

      await waitFor(() => {
        expect(applyDamage.applyDamageToTarget).toHaveBeenCalledWith(expect.anything(), 'Player One', 6, ['Fire'], expect.anything());
        expect(applyDamage.applyDamageToTarget).toHaveBeenCalledWith(expect.anything(), 'Player One', 3, ['Necrotic'], expect.anything());
      });

      const logs = damageLogCalls();
      expect(logs.some(e => e.formula === '8d6' && e.finalDamage === 6 && e.saveResult === 'success')).toBe(true);
      expect(logs.some(e => e.formula === '10d6' && e.finalDamage === 3 && e.saveResult === 'success')).toBe(true);
      expect(rollbackRow('Player One').appliedDamage).toBe(9);
    });

    it('single-damage rows stay byte-identical: one roll, one type, one log, no secondary fields', async () => {
      render(<SaveAttackAoeModal {...makeProps({ saveDc: 999 })} />);
      // picker copy byte-check BEFORE confirm swaps the view to the summary.
      expect(screen.getByText('On a failed save, target takes 8d6 Fire damage. On a successful save, target takes half damage.')).toBeInTheDocument();
      expect(screen.queryByText(/plus 10d6/)).toBeNull();
      await pick('Goblin A');

      const targetCalls = applyDamage.applyDamageToTarget.mock.calls.filter(c => c[1] === 'Goblin A');
      expect(targetCalls).toHaveLength(1);
      expect(targetCalls[0][2]).toBe(12);
      expect(targetCalls[0][3]).toEqual(['Fire']);

      const logs = damageLogCalls();
      expect(logs.every(e => e.formula === '8d6')).toBe(true);
      expect(logs.every(e => e.damageType === 'Fire')).toBe(true);
      expect(logs.every(e => !('secondaryFinalDamage' in e) && !('secondaryDamageType' in e))).toBe(true);

      expect(rollbackRow('Goblin A').appliedDamage).toBe(12);
      expect('secondaryFinalDamage' in rollbackRow('Goblin A')).toBe(false);
    });

    it('Death Knight + Aspirant twin data-lock: Hellfire Orb dual pools on disk', () => {
      const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
      const dk = monsters.find(m => m.name === 'Death Knight');
      const orb = dk.actions.find(a => a.name === 'Hellfire Orb');
      expect(orb.damage_dice_primary).toBe('10d6');
      expect(orb.damage_type_primary).toBe('Fire');
      expect(orb.damage_dice_secondary).toBe('10d6');
      expect(orb.damage_type_secondary).toBe('Necrotic');
      expect(orb.save_dc).toBe(18);
      expect(orb.save_type).toBe('Dexterity');
      expect(orb.recharge).toBe('5-6');
      expect(orb.dc_success).toBeUndefined();

      const asp = monsters.find(m => m.name === 'Death Knight Aspirant');
      const aspOrb = asp.actions.find(a => a.name === 'Hellfire Orb');
      expect(aspOrb.damage_dice_secondary).toBe('6d6');
      expect(aspOrb.damage_type_secondary).toBe('Necrotic');
      expect(aspOrb.save_dc).toBe(15);
    });
  });
});
