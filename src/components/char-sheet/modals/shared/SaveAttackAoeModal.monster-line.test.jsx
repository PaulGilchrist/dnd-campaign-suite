// MA-0035: line-shaped breath rows reuse the SAME area picker as MA-0031
// cones — multi-target picks, each picked creature rolls its OWN save at the
// authored DC 18 Dexterity; fail = full, success = half (per-target math
// untouched). Label aligned with the cone rendering ("60-ft Line ...").
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SaveAttackAoeModal from './SaveAttackAoeModal.jsx';

vi.mock('../../../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 54, rolls: [7, 2, 3, 7, 6, 5, 7, 2, 1, 6, 3, 5], modifier: 0 })),
  rollExpressionMaximized: vi.fn(() => ({ total: 54, rolls: [], modifier: 0 })),
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
      { name: 'Adult Black Dragon 1', type: 'npc', currentHp: 195, maxHp: 195, saveBonuses: {}, resistances: [], immunities: [] },
      { name: 'Thug 1', type: 'npc', currentHp: 45, maxHp: 45, saveBonuses: {}, resistances: [], immunities: [] },
      { name: 'Thug 2', type: 'npc', currentHp: 45, maxHp: 45, saveBonuses: {}, resistances: [], immunities: [] },
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
  isWithinRange: vi.fn(async () => true),
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

const ACTION = { name: 'Acid Breath (Recharge 5-6)', save_dc: 18, save_type: 'Dexterity', recharge: '5-6', damage_dice_primary: '12d8', damage_type_primary: 'Acid' };

let randomSpy;
beforeEach(() => {
  vi.clearAllMocks();
  seenTargets.current = [];
  // Thug 1 nat 2 (fails DC 18); Thug 2 nat 19 (succeeds) → half 27.
  let i = 0;
  const seq = [0.05, 0.05, 0.95, 0.95];
  randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => seq[Math.min(i++, seq.length - 1)]);
});
afterEach(() => randomSpy.mockRestore());

function renderMonsterLine() {
  return render(
    <SaveAttackAoeModal
      action={ACTION}
      playerStats={{ name: 'Adult Black Dragon 1' }}
      campaignName="test-campaign"
      damage="12d8"
      damageType="Acid"
      saveType="Dexterity"
      saveDc={18}
      dcSuccess="half"
      titleOverride="60-ft Line (GM positions tokens; selection advisory)"
      excludeNames={['Adult Black Dragon 1']}
      rangeGateFt={60}
      storeLastAttack={false}
      onClose={vi.fn()}
    />
  );
}

describe('MA-0035 area picker as monster line save', () => {
  it('labels the line picker and excludes the dragon from multi-target picks', async () => {
    renderMonsterLine();
    await waitFor(() => expect(seenTargets.current.map(t => t.name)).toEqual(['Thug 1', 'Thug 2']));
    expect(document.querySelector('.sp-header').textContent).toContain('60-ft Line (GM positions tokens; selection advisory)');
    expect(seenTargets.current.some(t => t.name === 'Adult Black Dragon 1')).toBe(false);
  });

  it('two picks → two own saves at DC 18 Dexterity: fail full 54, success half 27, no spell lastAttack', async () => {
    const { getByText } = renderMonsterLine();
    await waitFor(() => expect(seenTargets.current.length).toBe(2));
    fireEvent.click(getByText('Confirm'));
    await waitFor(() => expect(applyDamageToTarget).toHaveBeenCalledTimes(2));
    expect(storeSpellLastAttack).not.toHaveBeenCalled();
    const byTarget = Object.fromEntries(applyDamageToTarget.mock.calls.map(c => [c[1], c[2]]));
    expect(byTarget['Thug 1']).toBe(54);
    expect(byTarget['Thug 2']).toBe(27);
    const logs = addEntry.mock.calls.map(c => c[1]).filter(e => e.rollType === 'save-damage');
    expect(logs.map(l => [l.targetName, l.saveResult, l.finalDamage, l.saveDc, l.saveType].join(':')).sort()).toEqual([
      'Thug 1:failure:54:18:Dexterity',
      'Thug 2:success:27:18:Dexterity',
    ]);
    expect(logs[0].characterName).toBe('Adult Black Dragon 1');
  });
});
