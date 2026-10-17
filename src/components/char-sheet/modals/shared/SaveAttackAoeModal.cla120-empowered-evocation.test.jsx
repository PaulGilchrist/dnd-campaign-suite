// @maintained-by-ai
// CLA-120: Empowered Evocation save-AoE one-roll model — the picker rolls INT
// onto the FIRST selected target's damage roll exactly once per cast (RAW: one
// damage roll per spell); every other target rolls dice-only (CLA-279 shape).
import { render, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SaveAttackAoeModal from './SaveAttackAoeModal.jsx';

vi.mock('../../../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 10, rolls: [7, 3], modifier: 0 })),
  rollExpressionMaximized: vi.fn(() => ({ total: 10, rolls: [10], modifier: 0, maximized: true })),
}));

vi.mock('../../../../services/combat/automation/automationExpressions.js', () => ({
  resolveScaling: vi.fn(() => ({})),
}));

// Runtime store stand-in: the CLA-120 cast stamp lives here; reads are live so
// stamp/consume ordering is observable through runtimeRef.
const runtimeRef = { eePending: undefined };
vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((name, key) => {
    if (key === 'pendingEmpoweredEvocationTarget') return runtimeRef.eePending;
    if (name === 'campaign') return [];
    return null;
  }),
  setRuntimeValue: vi.fn((name, key, value) => {
    if (key === 'pendingEmpoweredEvocationTarget') runtimeRef.eePending = value;
  }),
}));

vi.mock('../../../../services/combat/conditions/savePromptService.js', () => ({
  sendSavePrompt: vi.fn(),
}));

vi.mock('../../../../services/rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(() => ({ finalDamage: 10, newHp: 0 })),
  computeDamageAfterSave: vi.fn((raw, success, dcSuccess) => (success && dcSuccess === 'half' ? Math.floor(raw / 2) : raw)),
  computeDamageAfterEvasion: vi.fn((raw, success, dcSuccess) => (dcSuccess === 'half' ? Math.floor(raw / 2) : raw)),
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
      { name: 'NPC 1', type: 'npc', currentHp: 15, maxHp: 15, saveBonuses: { dex: -1 }, resistances: [], immunities: [] },
      { name: 'NPC 2', type: 'npc', currentHp: 15, maxHp: 15, saveBonuses: { dex: -1 }, resistances: [], immunities: [] },
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

// Base never renders on this picker lane (no overlay- target), but its
// persistAndNotify util runs unconditionally after every cast — keep mocked.
vi.mock('./AreaEffectTargetModalBase.utils.jsx', () => ({
  renderTargetList: vi.fn(() => null),
  persistAndNotify: vi.fn(),
}));

vi.mock('../../../../hooks/combat/handlers/handleOverchannelSelfDamage.js', () => ({
  handleOverchannelSelfDamage: vi.fn(),
}));

vi.mock('./CreatureSelectionModal.jsx', () => {
  const { useState, useCallback } = require('react');
  function MockCreatureSelectionModal({ targets, confirmLabel, onConfirm, onSkip }) {
    const [selected, setSelected] = useState([]);
    const toggle = useCallback((name) => {
      setSelected(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
    }, []);
    return (
      <div className="sp-overlay">
        {targets.map(t => (
          <label key={t.name} className="secondary-target-row">
            <input type="checkbox" data-name={t.name} checked={selected.includes(t.name)} onChange={() => toggle(t.name)} />
            {t.name}
          </label>
        ))}
        <button className="sp-roll-btn" type="button" onClick={() => onConfirm(selected)}>{confirmLabel} ({selected.length})</button>
        <button className="sp-dismiss-btn" type="button" onClick={onSkip}>Skip</button>
      </div>
    );
  }
  return { default: MockCreatureSelectionModal };
});

const runtime = await import('../../../../hooks/runtime/useRuntimeState.js');
const diceRoller = await import('../../../../services/dice/diceRoller.js');
const logService = await import('../../../../services/ui/logService.js');

// CLA-120 adder arrives via the empoweredEvocationIntMod prop — the modal
// never re-detects the passive, so no automation payload is needed here.
const mockPlayerStats = { name: 'DivinationWizard' };

const baseProps = {
  action: { name: 'Fireball', automation: {} },
  playerStats: mockPlayerStats,
  campaignName: 'test-campaign',
  range: 150,
  damage: '8d6',
  damageType: 'Fire',
  saveType: 'DEX',
  saveDc: 19,
  dcSuccess: 'half',
  onClose: vi.fn(),
};

async function confirmTargets(names) {
  for (const n of names) {
    fireEvent.click(document.querySelector(`input[data-name="${n}"]`));
  }
  await act(async () => {
    fireEvent.click(document.querySelector('.sp-roll-btn'));
  });
}

function damageLogEntries() {
  return logService.addEntry.mock.calls
    .map(c => (c[1]?.rollType === 'save-damage' ? c[1] : c[0]?.rollType === 'save-damage' ? c[0] : null))
    .filter(Boolean);
}

describe('SaveAttackAoeModal — CLA-120 Empowered Evocation one-roll-per-cast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeRef.eePending = undefined;
  });

  it('folds +INT onto the FIRST selected target roll exactly once per cast, then consumes the cast stamp', async () => {
    render(<SaveAttackAoeModal {...baseProps} empoweredEvocationIntMod={5} />);
    await confirmTargets(['NPC 1', 'NPC 2']);

    // Dice level: two rolls for two targets — the INT-folded formula is rolled ONCE.
    const intRolls = diceRoller.rollExpression.mock.calls.filter(c => c[0] === '8d6 + 5 [Empowered Evocation]');
    expect(intRolls).toHaveLength(1);
    expect(diceRoller.rollExpression).toHaveBeenCalledTimes(2);
    expect(diceRoller.rollExpression).toHaveBeenCalledWith('8d6');

    // Log level: exactly one [Empowered Evocation] entry, and it belongs to the stamped first target.
    const entries = damageLogEntries();
    const empowered = entries.filter(e => String(e.formula).includes('[Empowered Evocation]'));
    expect(empowered).toHaveLength(1);
    expect(empowered[0]).toMatchObject({ formula: '8d6 + 5 [Empowered Evocation]', targetName: 'NPC 1' });
    const diceOnly = entries.filter(e => e.formula === '8d6');
    expect(diceOnly).toHaveLength(1);
    expect(diceOnly[0].targetName).toBe('NPC 2');

    // Stamp lifecycle: cast stamps NPC 1, application consumes it (null after).
    expect(runtime.setRuntimeValue).toHaveBeenCalledWith('DivinationWizard', 'pendingEmpoweredEvocationTarget', 'NPC 1', 'test-campaign');
    expect(runtime.setRuntimeValue).toHaveBeenCalledWith('DivinationWizard', 'pendingEmpoweredEvocationTarget', null, 'test-campaign');
    expect(runtimeRef.eePending).toBeNull();
  });

  it('non-holder control (intMod 0): every target rolls dice-only and the stamp key is never written', async () => {
    render(<SaveAttackAoeModal {...baseProps} empoweredEvocationIntMod={0} />);
    await confirmTargets(['NPC 1', 'NPC 2']);

    expect(damageLogEntries().map(e => e.formula)).toEqual(['8d6', '8d6']);
    expect(runtime.setRuntimeValue).not.toHaveBeenCalledWith('DivinationWizard', 'pendingEmpoweredEvocationTarget', expect.anything(), 'test-campaign');
    expect(runtimeRef.eePending).toBeUndefined();
  });
});
