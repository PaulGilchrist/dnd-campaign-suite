// @improved-by-ai
// CLA-124 + CLA-125 (twins): Evasion on the caster-AoE prompt lane must fold
// 0-on-success / floor-half-on-failure for Monk (2024 lv7+) and Rogue lv14+
// holders. The lane previously read combatSummary player STUBS' computedStats
// (never populated, CLA-119 family) → evasionActive always false → success
// still half, fail still full. Eligibility now sources from full PlayerStats
// (characters prop), honors detail.evasionActive, exempts Incapacitated, and
// emits rollType:'evasion' ledger entries. Combat-summary stubs keep their
// CLA-124 real-data shape (no computedStats) throughout.
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SaveAttackAoeModal from './SaveAttackAoeModal.jsx';

// ── Mocked modules ──

vi.mock('../../../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 35, rolls: [5, 5, 4, 3, 3, 2, 6, 1, 6], modifier: 0, formula: '8d6' })),
  rollExpressionMaximized: vi.fn(() => ({ total: 48, rolls: [], modifier: 0, formula: '8d6', maximized: true })),
}));

vi.mock('../../../../services/combat/automation/automationExpressions.js', () => ({
  resolveScaling: vi.fn(() => ({})),
}));

const runtimeRef = { activeConditions: [] };
vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((name, key) => {
    if (name === 'campaign') return [];
    if (key === 'activeConditions') return runtimeRef.activeConditions;
    return null;
  }),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../services/combat/conditions/savePromptService.js', () => ({
  sendSavePrompt: vi.fn(),
}));

// Canonical damage folds are MIRRORED here (applyDamage.js:89-128) so the
// evasion math under test is the real formula; only the apply seam is stubbed.
vi.mock('../../../../services/rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn((cs, name, dmg) => ({ finalDamage: dmg, newHp: 100 - dmg })),
  computeDamageAfterSave: vi.fn((raw, success, dcSuccess) => {
    if (!success) return raw;
    if (dcSuccess === 'half') return Math.floor(raw / 2);
    if (dcSuccess === 'full') return raw;
    return 0;
  }),
  computeDamageAfterEvasion: vi.fn((raw, success, dcSuccess, evasionActive) => {
    if (evasionActive && dcSuccess === 'half') {
      if (success) return 0;
      return Math.floor(raw / 2);
    }
    if (!success) return raw;
    if (dcSuccess === 'half') return Math.floor(raw / 2);
    if (dcSuccess === 'full') return raw;
    return 0;
  }),
  computeDamageAfterResistancesWithDetails: vi.fn(({ rawDamage }) => ({ finalDamage: rawDamage })),
  hasEvasionForSave: vi.fn((effects, st) => Array.isArray(effects) && effects.some(e => e.saveType === st)),
  normalizeSaveType: vi.fn((t) => {
    const upper = String(t || '').toUpperCase();
    return { STRENGTH: 'STR', DEXTERITY: 'DEX', CONSTITUTION: 'CON', INTELLIGENCE: 'INT', WISDOM: 'WIS', CHARISMA: 'CHA' }[upper] || upper;
  }),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// CLA-124 real-data shape: persisted player entries are MINIMAL STUBS
// {concentration,currentHp,initiative,maxHp,name,targetName,type} — NO
// computedStats, ever.
vi.mock('../../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({
    creatures: [
      { name: 'DivinationWizard', type: 'player', currentHp: 82, maxHp: 82 },
      { name: 'AasimarTest', type: 'player', currentHp: 143, maxHp: 143 },
      { name: 'Disciplined_Monk', type: 'player', currentHp: 183, maxHp: 183 },
      { name: 'DwarfTest', type: 'player', currentHp: 120, maxHp: 31 },
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

vi.mock('./AreaEffectTargetModalBase.utils.jsx', () => ({
  renderTargetList: vi.fn(() => null),
  persistAndNotify: vi.fn(),
}));

vi.mock('../../../../hooks/combat/handlers/handleOverchannelSelfDamage.js', () => ({
  handleOverchannelSelfDamage: vi.fn(async () => {}),
}));

vi.mock('../../../../hooks/combat/loggedDiceRollUtils.js', () => ({
  getGuardianProtectionAcBonus: vi.fn(() => 0),
  hasSoulstitchProtection: vi.fn(() => false),
  clearSoulstitchStamp: vi.fn(),
}));

vi.mock('./CreatureSelectionModal.jsx', () => {
  const { useState, useCallback } = require('react');
  function MockCreatureSelectionModal({ targets, onConfirm, onSkip, confirmLabel }) {
    const [selected, setSelected] = useState(new Set());
    const toggleTarget = useCallback((name) => {
      setSelected(prev => {
        const next = new Set(prev);
        next.has(name) ? next.delete(name) : next.add(name);
        return next;
      });
    }, []);
    return (
      <div className="sp-overlay">
        <div className="sp-modal">
          {targets.map((t) => (
            <label key={t.name} className="secondary-target-row">
              <input type="checkbox" data-name={t.name} checked={selected.has(t.name)} onChange={() => toggleTarget(t.name)} />
              {t.name}
            </label>
          ))}
          <button className="sp-roll-btn" onClick={() => onConfirm(Array.from(selected))} disabled={selected.size === 0} type="button">
            {confirmLabel} ({selected.size})
          </button>
          <button className="sp-dismiss-btn" onClick={onSkip} type="button">Skip</button>
        </div>
      </div>
    );
  }
  return { default: MockCreatureSelectionModal };
});

// ── Re-import mocked modules ──

import { addEntry } from '../../../../services/ui/logService.js';
import { applyDamageToTarget } from '../../../../services/rules/combat/applyDamage.js';
import { sendSavePrompt } from '../../../../services/combat/conditions/savePromptService.js';

const wizardCaster = { name: 'DivinationWizard', level: 20, automation: { actions: [], passives: [] } };

const EVASION = [{ source: 'Evasion', saveType: 'DEX', shareable: false, shareRange: 0 }];
const fullCharacters = [
  { name: 'DivinationWizard', type: 'player', computedStats: { evasionEffects: [] } },
  { name: 'AasimarTest', type: 'player', computedStats: { evasionEffects: EVASION } },
  { name: 'Disciplined_Monk', type: 'player', computedStats: { evasionEffects: EVASION } },
  { name: 'DwarfTest', type: 'player', computedStats: { evasionEffects: [] } },
];

const baseProps = {
  action: { name: 'Fireball', automation: {} },
  playerStats: wizardCaster,
  campaignName: 'test-campaign',
  range: 150,
  damage: '8d6',
  damageType: 'Fire',
  saveType: 'DEX',
  saveDc: 19,
  dcSuccess: 'half',
  onClose: vi.fn(),
};

async function castOn(targetName) {
  await act(async () => {
    render(<SaveAttackAoeModal {...baseProps} characters={fullCharacters} />);
  });
  await act(async () => {
    fireEvent.click(document.querySelector(`input[data-name="${targetName}"]`));
    fireEvent.click(screen.getByRole('button', { name: /Fireball \(1\)/ }));
  });
  expect(sendSavePrompt).toHaveBeenCalledTimes(1);
}

async function rollAndSubmit(detail) {
  const promptId = sendSavePrompt.mock.calls[0][1].promptId;
  await act(async () => {
    window.dispatchEvent(new CustomEvent('save-result', { detail: { promptId, ...detail } }));
  });
  await waitFor(() => {
    expect(addEntry.mock.calls.length).toBeGreaterThan(0);
  });
}

const logs = (filterFn) => addEntry.mock.calls.map(c => c[1]).filter(e => e && filterFn(e));
const appliedTo = (name) => applyDamageToTarget.mock.calls.filter(c => c[1] === name).map(c => c[2]);

describe('SaveAttackAoeModal — CLA-124/CLA-125 evasion fold (monk + rogue twins)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeRef.activeConditions = [];
  });

  it('CLA-125 rogue NATURAL SUCCESS vs DC19: 0 damage applied + rollType:evasion ledger (success), was half pre-fix', async () => {
    await castOn('AasimarTest');
    await rollAndSubmit({
      targetName: 'AasimarTest',
      success: true,
      roll: 19,
      rawRolls: [19],
      mode: 'normal',
      saveBonus: 8,
      saveType: 'DEX',
      saveDc: 19,
      dcSuccess: 'half',
      rawDamage: 31,
      total: 27,
      evasionActive: true,
    });

    expect(appliedTo('AasimarTest')).toHaveLength(0);
    const evasionLogs = logs(e => e.rollType === 'evasion' && e.targetName === 'AasimarTest');
    expect(evasionLogs).toHaveLength(1);
    expect(evasionLogs[0].name).toBe('Evasion');
    expect(evasionLogs[0].saveResult).toBe('success');
    expect(evasionLogs[0].dcSuccess).toBe('half');
    expect(evasionLogs[0].finalDamage).toBe(0);
    const damageLog = logs(e => e.rollType === 'save-damage' && e.targetName === 'AasimarTest').find(e => e.total === 31);
    expect(damageLog.finalDamage).toBe(0);
    expect(damageLog.note).toBe('Evasion');
  });

  it('CLA-125 rogue FAIL: floor(raw/2) applied + rollType:evasion ledger (failure), was FULL pre-fix', async () => {
    await castOn('AasimarTest');
    await rollAndSubmit({
      targetName: 'AasimarTest',
      success: false,
      roll: 4,
      rawRolls: [4],
      mode: 'normal',
      saveBonus: 8,
      saveType: 'DEX',
      saveDc: 19,
      dcSuccess: 'half',
      rawDamage: 31,
      total: 12,
      evasionActive: true,
    });

    expect(appliedTo('AasimarTest')).toEqual([15]);
    const evasionLogs = logs(e => e.rollType === 'evasion' && e.targetName === 'AasimarTest');
    expect(evasionLogs).toHaveLength(1);
    expect(evasionLogs[0].saveResult).toBe('failure');
    expect(evasionLogs[0].finalDamage).toBe(15);
  });

  it('CLA-124 monk NATURAL SUCCESS: 0 damage (was 18 "halved" pre-fix); remote-shape dispatch without evasionActive still folds from characters', async () => {
    await castOn('Disciplined_Monk');
    await rollAndSubmit({
      targetName: 'Disciplined_Monk',
      success: true,
      roll: 19,
      rawRolls: [19],
      mode: 'normal',
      saveBonus: 7,
      saveType: 'DEX',
      saveDc: 19,
      dcSuccess: 'half',
      rawDamage: 35,
      total: 26,
    });

    expect(appliedTo('Disciplined_Monk')).toHaveLength(0);
    const evasionLogs = logs(e => e.rollType === 'evasion' && e.targetName === 'Disciplined_Monk');
    expect(evasionLogs).toHaveLength(1);
    expect(evasionLogs[0].name).toBe('Evasion');
    expect(evasionLogs[0].finalDamage).toBe(0);
  });

  it('CLA-124 monk FAIL: floor(raw/2) applied (was FULL pre-fix)', async () => {
    await castOn('Disciplined_Monk');
    await rollAndSubmit({
      targetName: 'Disciplined_Monk',
      success: false,
      roll: 7,
      rawRolls: [7],
      mode: 'normal',
      saveBonus: 7,
      saveType: 'DEX',
      saveDc: 19,
      dcSuccess: 'half',
      rawDamage: 35,
      total: 14,
    });

    expect(appliedTo('Disciplined_Monk')).toEqual([17]);
    const evasionLogs = logs(e => e.rollType === 'evasion' && e.targetName === 'Disciplined_Monk');
    expect(evasionLogs).toHaveLength(1);
    expect(evasionLogs[0].saveResult).toBe('failure');
    expect(evasionLogs[0].finalDamage).toBe(17);
  });

  it('control DwarfTest lv3 (no Evasion): success still HALF, fail still FULL, zero evasion ledger', async () => {
    await castOn('DwarfTest');
    await rollAndSubmit({
      targetName: 'DwarfTest',
      success: true,
      roll: 18,
      rawRolls: [18],
      mode: 'normal',
      saveBonus: 1,
      saveType: 'DEX',
      saveDc: 19,
      dcSuccess: 'half',
      rawDamage: 35,
      total: 19,
    });

    expect(appliedTo('DwarfTest')).toEqual([17]);
    expect(logs(e => e.rollType === 'evasion')).toHaveLength(0);
  });

  it('Incapacitated exemption: monk with evasion is Incapacitated → success pays HALF (exempt), no evasion ledger', async () => {
    runtimeRef.activeConditions = ['Incapacitated'];
    await castOn('Disciplined_Monk');
    await rollAndSubmit({
      targetName: 'Disciplined_Monk',
      success: true,
      roll: 19,
      rawRolls: [19],
      mode: 'normal',
      saveBonus: 7,
      saveType: 'DEX',
      saveDc: 19,
      dcSuccess: 'half',
      rawDamage: 35,
      total: 26,
    });

    expect(appliedTo('Disciplined_Monk')).toEqual([17]);
    expect(logs(e => e.rollType === 'evasion')).toHaveLength(0);
  });

  it('no-computedStats stub still works: characters entry shaped like persisted change-data (no computedStats) → half-on-success, no crash, no evasion ledger', async () => {
    await act(async () => {
      render(<SaveAttackAoeModal {...baseProps} characters={[{ name: 'Disciplined_Monk', type: 'player', currentHp: 183, maxHp: 183 }]} />);
    });
    await act(async () => {
      fireEvent.click(document.querySelector('input[data-name="Disciplined_Monk"]'));
      fireEvent.click(screen.getByRole('button', { name: /Fireball \(1\)/ }));
    });
    await rollAndSubmit({
      targetName: 'Disciplined_Monk',
      success: true,
      roll: 19,
      rawRolls: [19],
      mode: 'normal',
      saveBonus: 7,
      saveType: 'DEX',
      saveDc: 19,
      dcSuccess: 'half',
      rawDamage: 35,
      total: 26,
    });

    expect(appliedTo('Disciplined_Monk')).toEqual([17]);
    expect(logs(e => e.rollType === 'evasion')).toHaveLength(0);
  });
});
