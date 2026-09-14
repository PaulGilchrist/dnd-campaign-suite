// MA-0031: monster cone rows reuse the PC-spell AoE area picker — each
// picked creature rolls its OWN save at DC 18; fail = full, success = half
// (existing per-target math untouched); attacker excluded; advisory
// isWithinRange coverage gate filters; no spell-origin lastAttack stamped.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SaveAttackAoeModal from './SaveAttackAoeModal.jsx';

vi.mock('../../../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 40, rolls: [4, 5, 8, 6, 7, 2, 8, 1, 5, 3, 9, 2], modifier: 0 })),
  rollExpressionMaximized: vi.fn(() => ({ total: 40, rolls: [], modifier: 0 })),
}));

vi.mock('../../../../services/combat/automation/automationExpressions.js', () => ({
  resolveScaling: vi.fn(() => null),
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
      { name: 'Abominable Yeti 1', type: 'npc', currentHp: 137, maxHp: 137, saveBonuses: {}, resistances: [], immunities: [] },
      { name: 'Thug 1', type: 'npc', currentHp: 45, maxHp: 45, saveBonuses: { con: 2 }, resistances: [], immunities: [] },
      { name: 'Thug 2', type: 'npc', currentHp: 45, maxHp: 45, saveBonuses: { con: 2 }, resistances: [], immunities: [] },
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

vi.mock('../../../../services/rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn(async (_src, name) => name === 'Thug 1'),
  isDistanceInRange: vi.fn(() => true),
}));

const seenTargets = vi.hoisted(() => ({ current: [] }));

vi.mock('./CreatureSelectionModal.jsx', () => ({
  default: ({ title, targets, onConfirm, onSkip }) => {
    seenTargets.current = targets;
    return (
      <div className="sp-overlay">
        <div className="sp-header">{title}</div>
        <div className="secondary-target-list">
          {targets.map(t => (
            <label key={t.name} className="secondary-target-row">
              <input type="checkbox" data-name={t.name} />
              {t.name}
            </label>
          ))}
        </div>
        <button className="sp-roll-btn" onClick={() => onConfirm(seenTargets.current.map(t => t.name))} type="button">Confirm</button>
        <button className="sp-dismiss-btn" onClick={onSkip} type="button">Skip</button>
      </div>
    );
  },
}));

import { applyDamageToTarget } from '../../../../services/rules/combat/applyDamage.js';
import { addEntry } from '../../../../services/ui/logService.js';
import { storeSpellLastAttack } from '../../../../services/automation/common/damageRollback.js';

const ACTION = { name: 'Cold Breath (Recharge 6)', save_dc: 18, save_type: 'Constitution', recharge: '6', damage_dice_primary: '10d8', damage_type_primary: 'Cold' };

let randomSpy;
beforeEach(() => {
  vi.clearAllMocks();
  seenTargets.current = [];
  // Thug 1 nat 2 (fails DC 18 with +2); Thug 2 nat 19 (21 ≥ 18 succeeds).
  let i = 0;
  const seq = [0.05, 0.05, 0.95, 0.95];
  randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => seq[Math.min(i++, seq.length - 1)]);
});
afterEach(() => randomSpy.mockRestore());

function renderMonsterCone() {
  return render(
    <SaveAttackAoeModal
      action={ACTION}
      playerStats={{ name: 'Abominable Yeti 1' }}
      campaignName="test-campaign"
      damage="10d8"
      damageType="Cold"
      saveType="Constitution"
      saveDc={18}
      dcSuccess="half"
      titleOverride="30-ft Cone (GM positions tokens; selection advisory)"
      excludeNames={['Abominable Yeti 1']}
      rangeGateFt={30}
      storeLastAttack={false}
      onClose={vi.fn()}
    />
  );
}

describe('MA-0031 area picker as monster cone save', () => {
  it('labels the cone picker, excludes the attacker, range-gate filters out-of-coverage creature', async () => {
    renderMonsterCone();
    await waitFor(() => expect(seenTargets.current.map(t => t.name)).toEqual(['Thug 1']));
    expect(document.querySelector('.sp-header').textContent).toContain('30-ft Cone (GM positions tokens; selection advisory)');
    expect(seenTargets.current.some(t => t.name === 'Abominable Yeti 1')).toBe(false);
  });

  it('N picks → N own saves at DC 18: fail full 40, success half 20, per-target logs, no spell lastAttack', async () => {
    const { getByText } = renderMonsterCone();
    await waitFor(() => expect(seenTargets.current.length).toBe(1));
    fireEvent.click(getByText('Confirm'));
    await waitFor(() => expect(applyDamageToTarget).toHaveBeenCalledTimes(1));
    expect(storeSpellLastAttack).not.toHaveBeenCalled();
    // Thug 1 fails: full 40 Cold
    const call = applyDamageToTarget.mock.calls[0];
    expect(call[1]).toBe('Thug 1');
    expect(call[2]).toBe(40);
    const logs = addEntry.mock.calls.map(c => c[1]).filter(e => e.rollType === 'save-damage');
    expect(logs.length).toBe(1);
    expect(logs[0].saveDc).toBe(18);
    expect(logs[0].saveResult).toBe('failure');
    expect(logs[0].finalDamage).toBe(40);
    expect(logs[0].characterName).toBe('Abominable Yeti 1');
    expect(logs[0].targetName).toBe('Thug 1');
  });

  it('save-success target takes exactly half (floor)', async () => {
    // coverage gate open for both → pick both, second succeeds.
    const rangeCheck = await import('../../../../services/rules/combat/rangeCheck.js');
    rangeCheck.isWithinRange.mockImplementation(async () => true);
    let i = 0;
    const seq = [0.05, 0.05, 0.95, 0.95];
    randomSpy.mockImplementation(() => seq[Math.min(i++, seq.length - 1)]);
    const { getByText } = renderMonsterCone();
    await waitFor(() => expect(seenTargets.current.map(t => t.name)).toEqual(['Thug 1', 'Thug 2']));
    fireEvent.click(getByText('Confirm'));
    await waitFor(() => expect(applyDamageToTarget).toHaveBeenCalledTimes(2));
    const byTarget = Object.fromEntries(applyDamageToTarget.mock.calls.map(c => [c[1], c[2]]));
    expect(byTarget['Thug 1']).toBe(40);
    expect(byTarget['Thug 2']).toBe(20);
    const logs = addEntry.mock.calls.map(c => c[1]).filter(e => e.rollType === 'save-damage');
    expect(logs.map(l => [l.targetName, l.saveResult, l.finalDamage].join(':')).sort()).toEqual(['Thug 1:failure:40', 'Thug 2:success:20']);
  });
});
