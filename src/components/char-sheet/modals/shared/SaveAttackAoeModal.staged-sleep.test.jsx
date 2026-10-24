// @maintained-by-ai
// MA-0068: Adult Brass Dragon Sleep Breath picker behavior — sleepStaging
// arms the SP-107 staging seams on a failed save (first fail = Incapacitated
// staged, NOT Unconscious; zero damage; roll + condition-applied logs).
// Damageless picker copy never prints "half damage" / "null null damage".
// Save-success seam: roll logged, nothing staged. Data byte-pins and the
// turn-END ladder live in MonsterCardModal.sleep-breath / sleepService tests.
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
      // saveBonuses uses the full-lowercase key the modal reads
      // (saveType.toLowerCase() === 'constitution'), so the +2 really lands.
      { name: 'Thug 1', type: 'npc', currentHp: 45, maxHp: 45, saveBonuses: { constitution: 2 }, resistances: [], immunities: [] },
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

vi.mock('./CreatureSelectionModal.jsx', async () => {
  const { createStaticPickerModal } = await import('./SaveAttackAoeModal.test-utils.jsx');
  return { default: createStaticPickerModal(seenPicker, { capturePicker: true, noteClass: 'sp-note', listWrapper: true, dataName: true, confirmFromParam: true }) };
});

import { applyDamageToTarget } from '../../../../services/rules/combat/applyDamage.js';
import { addEntry } from '../../../../services/ui/logService.js';
import { stageSleepTargets } from '../../../../services/rules/features/sleepService.js';

const ACTION = { name: 'Sleep Breath', save_dc: 18, save_type: 'Constitution', recharge: '5-6', dc_success: 'none' };

let randomSpy;
beforeEach(() => {
  vi.clearAllMocks();
  seenPicker.current = null;
  // Thug 1 constitution +2, nat 2 → total 4 < DC 18 fails.
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
  it('picker copy states the staged sleep ladder, never half-damage/null-damage, inert until Confirm', () => {
    renderSleepCone();
    expect(seenPicker.current.note).toContain('Incapacitated until the end of its next turn');
    expect(seenPicker.current.note).toContain('Unconscious for 10 minutes');
    expect(seenPicker.current.note).toContain('ends if the target takes damage');
    expect(seenPicker.current.note.toLowerCase()).not.toContain('half damage');
    expect(seenPicker.current.note).not.toContain('null');
    // Caster excluded; advisory lane stages nothing before Confirm.
    expect(seenPicker.current.targets).toHaveLength(1);
    expect(seenPicker.current.targets.map(t => t.name)).toEqual(['Thug 1']);
    expect(stageSleepTargets).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
    expect(applyDamageToTarget).not.toHaveBeenCalled();
  });

  it('failed NPC save stages Incapacitated via sleepService (CON +2 pinned, no concentration, 100 rounds) — no damage, no Unconscious grant', async () => {
    const { getByText, container } = renderSleepCone();
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
    expect(rollLog.rolls).toEqual([2]);
    expect(rollLog.bonus).toBe(2);

    const conditionLogs = entries.filter(e => e.type === 'condition');
    expect(conditionLogs).toHaveLength(1);
    expect(conditionLogs[0].condition).toBe('Incapacitated');
    expect(conditionLogs[0].characterName).toBe('Thug 1');
    expect(conditionLogs[0].description).toContain('until the end of its next turn');
    expect(conditionLogs[0].description).toContain('repeats the save');
    expect(conditionLogs[0].description).toContain('Unconscious for 10 minutes');
    // Staged lane never grants Unconscious directly (MA-0063 one-shot superseded).
    expect(conditionLogs.some(e => e.condition === 'Unconscious')).toBe(false);

    // Result row reads the staged ladder — no null-damage text.
    await waitFor(() => expect(container.textContent).toContain('Incapacitated until the end of its next turn, then repeats the save'));
    expect(container.textContent).not.toContain('null null');
  });

  it('successful save logs the roll but stages nothing', async () => {
    randomSpy.mockReturnValue(0.99);
    const { getByText, container } = renderSleepCone();
    await waitFor(() => expect(seenPicker.current.targets.length).toBe(1));
    fireEvent.click(getByText('Confirm'));

    await waitFor(() => expect(container.textContent).toContain('Saved — takes no damage'));
    expect(stageSleepTargets).not.toHaveBeenCalled();
    expect(applyDamageToTarget).not.toHaveBeenCalled();

    const entries = addEntry.mock.calls.map(c => c[1]);
    const rollLog = entries.find(e => e.rollType === 'save' && e.targetName === 'Thug 1');
    expect(rollLog.saveResult).toBe('success');
    expect(rollLog.saveDc).toBe(18);
    expect(rollLog.rolls).toEqual([20]);
    expect(rollLog.bonus).toBe(2);
    expect(entries.some(e => e.type === 'condition')).toBe(false);
  });
});
