// CLA-279: Radiant Soul save-AoE one-target model — CHA adder lands on the FIRST eligible
// selected target's damage roll only, and the once-per-turn flag is consumed at application.
import { render, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SaveAttackAoeModal from './SaveAttackAoeModal.jsx';

vi.mock('../../../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 10, rolls: [10], modifier: 0 })),
  rollExpressionMaximized: vi.fn(() => ({ total: 10, rolls: [10], modifier: 0, maximized: true })),
}));

vi.mock('../../../../services/combat/automation/automationExpressions.js', () => ({
  resolveScaling: vi.fn(() => ({})),
}));

const runtimeRef = { radiantFlag: null, pendingTarget: undefined };
vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((name, key) => {
    if (key === '_radiantSoul_HexWarlock_oncePerTurn') return runtimeRef.radiantFlag;
    if (key === 'pendingRadiantSoulTarget') return runtimeRef.pendingTarget;
    if (key === 'campaign') return [];
    return null;
  }),
  setRuntimeValue: vi.fn((name, key, value) => {
    if (key === '_radiantSoul_HexWarlock_oncePerTurn') runtimeRef.radiantFlag = value;
    if (key === 'pendingRadiantSoulTarget') runtimeRef.pendingTarget = value;
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
      { name: 'Zombie 1', type: 'npc', currentHp: 15, maxHp: 15, saveBonuses: { dex: -1 }, resistances: [], immunities: [] },
      { name: 'Zombie 2', type: 'npc', currentHp: 15, maxHp: 15, saveBonuses: { dex: -1 }, resistances: [], immunities: [] },
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

const { rollExpression } = await import('../../../../services/dice/diceRoller.js');
const runtime = await import('../../../../hooks/runtime/useRuntimeState.js');
const logService = await import('../../../../services/ui/logService.js');

const mockPlayerStats = {
  name: 'HexWarlock',
  level: 14,
  abilities: [{ name: 'Charisma', bonus: 3 }],
  automation: { passives: [{ type: 'radiant_soul', hasAutomation: true, damageTypes: ['Radiant', 'Fire'] }], actions: [] },
};

const baseProps = {
  action: { name: 'Burning Hands', automation: {} },
  playerStats: mockPlayerStats,
  campaignName: 'test-campaign',
  range: 15,
  damage: '7d6',
  damageType: 'Fire',
  saveType: 'DEX',
  saveDc: 16,
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

function damageLogCalls() {
  return logService.addEntry.mock.calls.filter(c => c[1]?.rollType === 'save-damage' || c[0]?.rollType === 'save-damage');
}

function entryOf(c) {
  return c[1]?.rollType || c[1]?.type ? c[1] : c[0];
}

describe('SaveAttackAoeModal — CLA-279 Radiant Soul one-target model', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeRef.radiantFlag = null;
    runtimeRef.pendingTarget = undefined;
    rollExpression.mockReturnValue({ total: 10, rolls: [7, 3], modifier: 0 });
    runtime.getRuntimeValue.mockImplementation((name, key) => {
      if (key === '_radiantSoul_HexWarlock_oncePerTurn') return runtimeRef.radiantFlag;
      if (key === 'pendingRadiantSoulTarget') return runtimeRef.pendingTarget;
      if (key === 'campaign') return [];
      return null;
    });
    runtime.setRuntimeValue.mockImplementation((name, key, value) => {
      if (key === '_radiantSoul_HexWarlock_oncePerTurn') runtimeRef.radiantFlag = value;
      if (key === 'pendingRadiantSoulTarget') runtimeRef.pendingTarget = value;
    });
  });

  it('adds +CHA to the FIRST selected target only, others roll raw', async () => {
    render(<SaveAttackAoeModal {...baseProps} radiantSoulChaMod={3} />);
    await confirmTargets(['Zombie 1', 'Zombie 2']);

    const formulas = damageLogCalls().map(c => entryOf(c).formula);
    expect(formulas).toContain('7d6 + 3 [Radiant Soul]');
    expect(formulas.filter(f => f === '7d6')).toHaveLength(1);
    const rolled = rollExpression.mock.calls.map(c => c[0]);
    expect(rolled).toContain('7d6 + 3 [Radiant Soul]');
    expect(rolled).toContain('7d6');
  });

  it('writes once-per-turn flag and cites Radiant Soul in log on the chosen target', async () => {
    render(<SaveAttackAoeModal {...baseProps} radiantSoulChaMod={3} />);
    await confirmTargets(['Zombie 1']);

    expect(runtime.setRuntimeValue).toHaveBeenCalledWith('HexWarlock', '_radiantSoul_HexWarlock_oncePerTurn', true, 'test-campaign');
    const radiantLog = logService.addEntry.mock.calls.map(c => entryOf(c)).find(e => e?.abilityName === 'Radiant Soul');
    expect(radiantLog).toBeTruthy();
    expect(radiantLog.description).toContain('+3');
    expect(radiantLog.description).toContain('Zombie 1');
    // stamp consumed
    expect(runtime.setRuntimeValue).toHaveBeenCalledWith('HexWarlock', 'pendingRadiantSoulTarget', null, 'test-campaign');
  });

  it('flag armed at cast resolution → no target gains the adder', async () => {
    runtimeRef.radiantFlag = true;
    render(<SaveAttackAoeModal {...baseProps} radiantSoulChaMod={3} />);
    await confirmTargets(['Zombie 1', 'Zombie 2']);

    expect(damageLogCalls().every(c => entryOf(c).formula === '7d6')).toBe(true);
    expect(runtime.setRuntimeValue).not.toHaveBeenCalledWith('HexWarlock', '_radiantSoul_HexWarlock_oncePerTurn', true, 'test-campaign');
  });

  it('non-holder cast (radiantSoulChaMod=0) never adds', async () => {
    render(<SaveAttackAoeModal {...baseProps} radiantSoulChaMod={0} />);
    await confirmTargets(['Zombie 1', 'Zombie 2']);

    expect(damageLogCalls().every(c => entryOf(c).formula === '7d6')).toBe(true);
    expect(runtimeRef.pendingTarget).toBeFalsy();
  });
});
