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
const logService = await import('../../../../services/ui/logService.js');

const mockPlayerStats = {
  name: 'DivinationWizard',
  level: 20,
  abilities: [{ name: 'Intelligence', bonus: 5 }],
  automation: { passives: [{ type: 'empowered_evocation' }], actions: [] },
};

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

function damageLogFormulas() {
  return logService.addEntry.mock.calls
    .map(c => (c[1]?.rollType === 'save-damage' ? c[1] : c[0]?.rollType === 'save-damage' ? c[0] : null))
    .filter(Boolean)
    .map(e => e.formula);
}

describe('SaveAttackAoeModal — CLA-120 Empowered Evocation one-roll-per-cast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeRef.eePending = undefined;
    runtime.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'pendingEmpoweredEvocationTarget') return runtimeRef.eePending;
      if (name === 'campaign') return [];
      return null;
    });
    runtime.setRuntimeValue.mockImplementation((name, key, value) => {
      if (key === 'pendingEmpoweredEvocationTarget') runtimeRef.eePending = value;
    });
  });

  it('folds +INT onto the FIRST selected target roll only — one [Empowered Evocation] term across both rolls', async () => {
    render(<SaveAttackAoeModal {...baseProps} empoweredEvocationIntMod={5} />);
    await confirmTargets(['NPC 1', 'NPC 2']);

    const formulas = damageLogFormulas();
    expect(formulas).toContain('8d6 + 5 [Empowered Evocation]');
    expect(formulas.filter(f => f === '8d6')).toHaveLength(1);
    expect(formulas.join(' ').match(/\[Empowered Evocation\]/g)).toHaveLength(1);
  });

  it('stamps pendingEmpoweredEvocationTarget on the first target for the cast and consumes it at application', async () => {
    render(<SaveAttackAoeModal {...baseProps} empoweredEvocationIntMod={5} />);
    await confirmTargets(['NPC 1', 'NPC 2']);

    expect(runtime.setRuntimeValue).toHaveBeenCalledWith('DivinationWizard', 'pendingEmpoweredEvocationTarget', 'NPC 1', 'test-campaign');
    expect(runtime.setRuntimeValue).toHaveBeenCalledWith('DivinationWizard', 'pendingEmpoweredEvocationTarget', null, 'test-campaign');
    expect(runtimeRef.eePending).toBeNull();
  });

  it('int mod 0 (non-holder / non-evocation control): dice-only formula on every target, stamp never written', async () => {
    render(<SaveAttackAoeModal {...baseProps} empoweredEvocationIntMod={0} />);
    await confirmTargets(['NPC 1', 'NPC 2']);

    const formulas = damageLogFormulas();
    expect(formulas.length).toBeGreaterThan(0);
    expect(formulas.every(f => f === '8d6')).toBe(true);
    expect(runtimeRef.eePending).toBeUndefined();
  });
});
