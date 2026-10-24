// @maintained-by-ai
// MA-0248: Ancient Silver Dragon Paralyzing Breath picker lane — stagedParalysis
// arms the multi-stage ladder seam: picker copy states the two-stage ladder
// (never half-damage / null-damage / flat "Incapacitated, Paralyzed" grant
// text), a failed save stages Incapacitated ONLY via paralyzingBreathService
// (the flat saveConditions ['incapacitated','paralyzed'] spray is superseded —
// MA-0904 clause-supersedes), a successful save grants nothing, and the row is
// damageless either way. The MA-1469 Silver Dragon Wyrmling DC 13 twin rides
// this byte-identical modal path — its data/props are pinned in
// MonsterCardModal.paralyzing-breath.test.jsx (modal reads only the
// stagedParalysis/saveDc PROPS, never action.staged_paralysis), so DC 13
// appears here only to exercise the pass side of the same seam.
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
      { name: 'Ancient Silver Dragon 1', type: 'npc', currentHp: 468, maxHp: 468, saveBonuses: {}, resistances: [], immunities: [] },
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

vi.mock('../../../../services/rules/features/paralyzingBreathService.js', () => ({
  stageParalysisTargets: vi.fn(() => Promise.resolve([])),
  PARALYZING_STAGED_TE: 'paralyzing_staged',
}));

const seenPicker = vi.hoisted(() => ({ current: null }));

vi.mock('./CreatureSelectionModal.jsx', async () => {
  const { createStaticPickerModal } = await import('./SaveAttackAoeModal.test-utils.jsx');
  return { default: createStaticPickerModal(seenPicker, { capturePicker: true, noteClass: 'sp-note', listWrapper: true, dataName: true, confirmFromParam: true }) };
});

import { applyDamageToTarget } from '../../../../services/rules/combat/applyDamage.js';
import { addEntry } from '../../../../services/ui/logService.js';
import { stageSleepTargets } from '../../../../services/rules/features/sleepService.js';
import { stageParalysisTargets } from '../../../../services/rules/features/paralyzingBreathService.js';

const ACTION = { name: 'Paralyzing Breath', save_dc: 24, save_type: 'Constitution', dc_success: 'none' };

let randomSpy;
beforeEach(() => {
  vi.clearAllMocks();
  seenPicker.current = null;
  // Flat spyRandom stream (order-independent): every d20 is nat 2, so
  // Thug 1 (constitution +2 → 4) fails any DC this lane throws at it.
  // saveBonuses uses the full-lowercase key the modal reads
  // (saveType.toLowerCase() — SaveAttackAoeModal.jsx:47).
  randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.05);
});
afterEach(() => randomSpy.mockRestore());

function renderParalysisCone(saveDc = 24) {
  return render(
    <SaveAttackAoeModal
      action={{ ...ACTION, save_dc: saveDc }}
      playerStats={{ name: 'Ancient Silver Dragon 1' }}
      campaignName="test-campaign"
      damage={null}
      damageType=""
      saveType="Constitution"
      saveDc={saveDc}
      dcSuccess="none"
      titleOverride="90-ft Cone (GM positions tokens; selection advisory)"
      excludeNames={['Ancient Silver Dragon 1']}
      rangeGateFt={90}
      storeLastAttack={false}
      saveConditions={['incapacitated', 'paralyzed']}
      stagedParalysis={{ paralyzedRounds: 10 }}
      onClose={vi.fn()}
    />
  );
}

const conditionLogs = () => addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'condition' && e.action === 'applied');
const stagedSaveLogs = () => addEntry.mock.calls.map(c => c[1]).filter(e => e.rollType === 'save');

describe('MA-0248 Paralyzing Breath staged picker', () => {
  it('picker copy states the staged ladder and the picker is inert until Confirm', () => {
    renderParalysisCone();
    // Positive leg first: the picker rendered with the full ladder copy.
    expect(seenPicker.current).toBeTruthy();
    expect(seenPicker.current.note).toContain('Incapacitated until the end of its next turn');
    expect(seenPicker.current.note).toContain('Second failure: Paralyzed');
    expect(seenPicker.current.note).toContain('automatically succeeds after 1 minute');
    // Damageless ladder copy: never half-damage, never "null", never the
    // flat both-conditions grant, never the sleep ladder's Unconscious.
    expect(seenPicker.current.note.toLowerCase()).not.toContain('half damage');
    expect(seenPicker.current.note).not.toContain('null');
    expect(seenPicker.current.note).not.toContain('target is Incapacitated, Paralyzed');
    expect(seenPicker.current.note).not.toContain('Unconscious');
    // Pre-confirm inertness: nothing staged, no rolls, no logs, no damage.
    expect(stageParalysisTargets).not.toHaveBeenCalled();
    expect(stageSleepTargets).not.toHaveBeenCalled();
    expect(applyDamageToTarget).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('failed save stages Incapacitated ONLY via paralyzingBreathService — flat spray superseded, sleep lane inert, zero damage', async () => {
    const { getByText, container } = renderParalysisCone();
    await waitFor(() => expect(seenPicker.current.targets.map(t => t.name)).toEqual(['Thug 1']));
    fireEvent.click(getByText('Confirm'));

    await waitFor(() => expect(stageParalysisTargets).toHaveBeenCalledWith(
      'test-campaign', 'Ancient Silver Dragon 1', ['Thug 1'], 24,
      { saveType: 'Constitution', label: 'Paralyzing Breath', logLabel: 'Paralyzing Breath', paralyzedRounds: 10 },
    ));
    expect(stageParalysisTargets).toHaveBeenCalledTimes(1);
    expect(stageSleepTargets).not.toHaveBeenCalled();
    expect(applyDamageToTarget).not.toHaveBeenCalled();

    // Honest roll log: nat 2 + constitution +2 = 4, well under DC 24.
    const rollLogs = stagedSaveLogs();
    expect(rollLogs).toHaveLength(1);
    expect(rollLogs[0]).toMatchObject({ targetName: 'Thug 1', saveResult: 'failure', saveDc: 24, rolls: [2], bonus: 2 });

    // One condition grant only (the flat ['incapacitated','paralyzed'] spray
    // never ran): Incapacitated with the repeat-save ladder prose, and the
    // 10-rounds → 1-minute auto-success clock spelled out.
    const conds = conditionLogs();
    expect(conds).toHaveLength(1);
    expect(conds[0]).toMatchObject({ condition: 'Incapacitated', characterName: 'Thug 1' });
    expect(conds[0].description).toContain('repeats the save');
    expect(conds[0].description).toContain('second failure Paralyzes');
    expect(conds[0].description).toContain('auto-succeeds after 1 minute');

    // Results row shows the staged copy — no null-damage cosmetics.
    await waitFor(() => expect(container.textContent).toContain('Incapacitated until the end of its next turn, then repeats the save (rolled 2)'));
    expect(container.textContent).not.toContain('null null');
  });

  // The ladder's other half: applyStagedParalysisSave logs the successful
  // save roll, then grants NOTHING (no staging te, no conditions, no clock).
  // DC 13 chosen so the +2 CON Thug's nat 20 (22) passes the same combat mock.
  it('successful save logs the roll but stages nothing', async () => {
    randomSpy.mockReturnValue(0.99);
    const { getByText, container } = renderParalysisCone(13);
    await waitFor(() => expect(seenPicker.current.targets.map(t => t.name)).toEqual(['Thug 1']));
    fireEvent.click(getByText('Confirm'));

    // Positive leg first: the staged seam ran and honestly logged the pass.
    await waitFor(() => expect(stagedSaveLogs()).toHaveLength(1));
    expect(stagedSaveLogs()[0]).toMatchObject({ targetName: 'Thug 1', saveResult: 'success', saveDc: 13, rolls: [20], bonus: 2 });

    // Then the absences: no staging, no condition grants, no damage.
    expect(stageParalysisTargets).not.toHaveBeenCalled();
    expect(stageSleepTargets).not.toHaveBeenCalled();
    expect(conditionLogs()).toHaveLength(0);
    expect(applyDamageToTarget).not.toHaveBeenCalled();
    await waitFor(() => expect(container.textContent).toContain('Saved — takes no damage (rolled 20)'));
  });
});
