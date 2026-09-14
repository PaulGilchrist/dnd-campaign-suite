// MA-0068: Adult Brass Dragon Sleep Breath picker behavior — sleepStaging
// arms the SP-107 staging seams on a failed save (first fail = Incapacitated
// staged, NOT Unconscious; zero damage; roll + condition-applied logs).
// Damageless picker copy never prints "half damage" / "null null damage".
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SaveAttackAoeModal from './SaveAttackAoeModal.jsx';

vi.mock('../../../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 0, rolls: [], modifier: 0 })),
  rollExpressionMaximized: vi.fn(() => ({ total: 0, rolls: [], modifier: 0 })),
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
      { name: 'Adult Brass Dragon 1', type: 'npc', currentHp: 172, maxHp: 172, saveBonuses: {}, resistances: [], immunities: [] },
      { name: 'Thug 1', type: 'npc', currentHp: 45, maxHp: 45, saveBonuses: { con: 2 }, resistances: [], immunities: [] },
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

vi.mock('../../../../services/rules/features/sleepService.js', () => ({
  stageSleepTargets: vi.fn(() => Promise.resolve([])),
  SLEEP_TE_EFFECT: 'sleep_staged',
}));

const seenPicker = vi.hoisted(() => ({ current: null }));

vi.mock('./CreatureSelectionModal.jsx', () => ({
  default: ({ title, note, targets, onConfirm, onSkip }) => {
    seenPicker.current = { title, note, targets };
    return (
      <div className="sp-overlay">
        <div className="sp-header">{title}</div>
        <div className="sp-note">{note}</div>
        <div className="secondary-target-list">
          {targets.map(t => (
            <label key={t.name} className="secondary-target-row">
              <input type="checkbox" data-name={t.name} />
              {t.name}
            </label>
          ))}
        </div>
        <button className="sp-roll-btn" onClick={() => onConfirm(targets.map(t => t.name))} type="button">Confirm</button>
        <button className="sp-dismiss-btn" onClick={onSkip} type="button">Skip</button>
      </div>
    );
  },
}));

import { applyDamageToTarget } from '../../../../services/rules/combat/applyDamage.js';
import { addEntry } from '../../../../services/ui/logService.js';
import { stageSleepTargets } from '../../../../services/rules/features/sleepService.js';

const ACTION = { name: 'Sleep Breath', save_dc: 18, save_type: 'Constitution', recharge: '5-6', dc_success: 'none' };

let randomSpy;
beforeEach(() => {
  vi.clearAllMocks();
  seenPicker.current = null;
  // Thug 1 con +2, nat 2 → 4 < 18 fails.
  randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.05);
});
afterEach(() => randomSpy.mockRestore());

function renderSleepCone() {
  return render(
    <SaveAttackAoeModal
      action={ACTION}
      playerStats={{ name: 'Adult Brass Dragon 1' }}
      campaignName="test-campaign"
      damage={null}
      damageType=""
      saveType="Constitution"
      saveDc={18}
      dcSuccess="none"
      titleOverride="60-ft Cone (GM positions tokens; selection advisory)"
      excludeNames={['Adult Brass Dragon 1']}
      rangeGateFt={60}
      storeLastAttack={false}
      saveConditions={['incapacitated', 'unconscious']}
      sleepStaging={{ unconsciousRounds: 100 }}
      onClose={vi.fn()}
    />
  );
}

describe('MA-0068 Sleep Breath staged picker', () => {
  it('picker copy states staged sleep, never half-damage/null-damage', () => {
    renderSleepCone();
    expect(seenPicker.current.note).toContain('Incapacitated until the end of its next turn');
    expect(seenPicker.current.note).toContain('Unconscious for 10 minutes');
    expect(seenPicker.current.note.toLowerCase()).not.toContain('half damage');
    expect(seenPicker.current.note).not.toContain('null');
  });

  it('failed NPC save stages Incapacitated via sleepService (CON, no concentration, 100 rounds) — no damage, no Unconscious grant', async () => {
    const { getByText } = renderSleepCone();
    await waitFor(() => expect(seenPicker.current.targets.map(t => t.name)).toEqual(['Thug 1']));
    fireEvent.click(getByText('Confirm'));

    await waitFor(() => expect(stageSleepTargets).toHaveBeenCalledWith(
      'test-campaign', 'Adult Brass Dragon 1', ['Thug 1'], 18,
      { saveType: 'Constitution', concentrate: false, label: 'Sleep Breath', logLabel: 'Sleep Breath', unconsciousRounds: 100 },
    ));

    expect(applyDamageToTarget).not.toHaveBeenCalled();

    const entries = addEntry.mock.calls.map(c => c[1]);
    const rollLog = entries.find(e => e.rollType === 'save' && e.targetName === 'Thug 1');
    expect(rollLog.saveResult).toBe('failure');
    expect(rollLog.saveDc).toBe(18);
    const condLog = entries.find(e => e.type === 'condition' && e.action === 'applied');
    expect(condLog.condition).toBe('Incapacitated');
    expect(condLog.characterName).toBe('Thug 1');
    expect(condLog.description).toContain('repeats the save');
    expect(entries.some(e => e.type === 'condition' && e.condition === 'Unconscious')).toBe(false);
  });

  it('result rows show staged Incapacitated copy on fail (no null-damage text)', async () => {
    const { getByText, container } = renderSleepCone();
    await waitFor(() => expect(seenPicker.current.targets.length).toBe(1));
    fireEvent.click(getByText('Confirm'));
    await waitFor(() => expect(stageSleepTargets).toHaveBeenCalled());
    await waitFor(() => expect(container.textContent).toContain('Incapacitated until the end of its next turn, then repeats the save'));
    expect(container.textContent).not.toContain('null null');
  });
});
