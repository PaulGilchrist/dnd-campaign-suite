// @maintained-by-ai
// MA-0035 monster LINE breath row — modal-side consumption ONLY: header
// shows the "60-ft Line" label, the row's 60-ft line geometry flows through
// the canonical isWithinRange gate from the attacker (the mock passes ONLY
// at exactly 60 ft, so a dropped or mis-sized gate empties the candidate
// list), excludeNames drops the dragon, browsing stays inert. Generic
// confirm-time adjudication (own save each, fail=full/success=half,
// per-target logs, no spell lastAttack) is owned by monster-cone.test.jsx
// (#223) — shape is label-only in the modal (_shape is unused at :1418).
// Row→picker data pins (saveDc/saveType/damage/props) are owned by
// MonsterCardModal.line-breath.test.jsx.
import { render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

// Line-geometry-specific gate: candidates survive ONLY when the modal asks
// isWithinRange at the row's authored 60-ft line length. Dropping the gate
// (never called) or mis-sizing it empties the picker → non-vacuous pin.
vi.mock('../../../../services/rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn(async (_src, _name, ft) => ft === 60),
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
import { isWithinRange } from '../../../../services/rules/combat/rangeCheck.js';

const ACTION = { name: 'Acid Breath (Recharge 5-6)', save_dc: 18, save_type: 'Dexterity', recharge: '5-6', damage_dice_primary: '12d8', damage_type_primary: 'Acid' };

beforeEach(() => {
  vi.clearAllMocks();
  seenTargets.current = [];
});

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
  it('opens the labelled 60-ft Line picker: gate queried from the dragon at 60 ft, attacker excluded, inert until confirm', async () => {
    renderMonsterLine();
    // Survivors prove the 60-ft line gate fired at exactly the authored range.
    await waitFor(() => expect(seenTargets.current.map(t => t.name)).toEqual(['Thug 1', 'Thug 2']));
    expect(document.querySelector('.sp-header').textContent).toContain('60-ft Line (GM positions tokens; selection advisory)');
    expect(isWithinRange).toHaveBeenCalledTimes(2);
    expect(isWithinRange.mock.calls).toEqual(expect.arrayContaining([
      ['Adult Black Dragon 1', 'Thug 1', 60],
      ['Adult Black Dragon 1', 'Thug 2', 60],
    ]));
    // Both thug rows must carry the attacker-exclusion (dragon never queried, never listed).
    expect(isWithinRange.mock.calls.every(c => c[1] !== 'Adult Black Dragon 1')).toBe(true);
    expect(seenTargets.current.some(t => t.name === 'Adult Black Dragon 1')).toBe(false);
    // Browsing the picker rolls, logs and damages nothing.
    expect(applyDamageToTarget).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });
});
