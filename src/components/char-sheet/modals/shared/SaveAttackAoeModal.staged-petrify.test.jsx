// MA-0904: Gorgon "Petrifying Breath" 30-ft Cone picker — the MA-0501
// staged-petrify ladder (cockatricePetrifyService, ONE shared ladder, no
// fork) rides the cone picker via the structured staged_petrify key.
// First failed CON save (DC 15) grants RESTRAINED ONLY — the generic
// saveConditions auto-grant (extractor word-scan yields Petrified+Restrained,
// the REAL double-grant defect) is SUPPRESSED while the ladder is armed
// (§108 clause-supersedes precedent) — plus the petrifying_bite_staged te
// (label discriminator 'Petrifying Breath', dc 15, petrifiedRounds 14400 =
// 24h×600, CLA-334) that the existing MA-0501 turn-END repeater consumes.
// Successful saves grant nothing. Non-ladder rows stay byte-inert.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SaveAttackAoeModal from './SaveAttackAoeModal.jsx';
import monstersData from '../../../../../public/data/monsters.json';
import { extractConditionsFromSaveEffect } from '../../../encounter/MonsterCardHelpers.js';
import { buildSaveOptions, parseStagedPetrifyClause } from '../../../encounter/MonsterCardModal.jsx';

vi.mock('../../../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn((f) => (f ? { total: 10, rolls: [5, 5], modifier: 0 } : null)),
  rollExpressionMaximized: vi.fn((f) => (f ? { total: 10, rolls: [], modifier: 0 } : null)),
}));
vi.mock('../../../../services/combat/automation/automationExpressions.js', () => ({ resolveScaling: vi.fn(() => null) }));

const runtime = vi.hoisted(() => {
  const store = {};
  return {
    store,
    getRuntimeValue: vi.fn((k, p) => store[`${k}.${p}`] ?? null),
    setRuntimeValue: vi.fn((k, p, v) => { store[`${k}.${p}`] = v; }),
  };
});
vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: runtime.getRuntimeValue,
  setRuntimeValue: runtime.setRuntimeValue,
}));

vi.mock('../../../../services/combat/conditions/savePromptService.js', () => ({ sendSavePrompt: vi.fn() }));
vi.mock('../../../../services/rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(),
  computeDamageAfterSave: vi.fn((raw, success, dcSuccess) => (success && dcSuccess === 'half' ? Math.floor(raw / 2) : raw)),
  computeDamageAfterEvasion: vi.fn((raw, success, dcSuccess) => (success && dcSuccess === 'half' ? Math.floor(raw / 2) : raw)),
  computeDamageAfterResistancesWithDetails: vi.fn(({ rawDamage }) => ({ finalDamage: rawDamage })),
  hasEvasionForSave: vi.fn(() => false),
  normalizeSaveType: vi.fn((t) => t),
}));
vi.mock('../../../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));

const csFixture = vi.hoisted(() => ({ conBonus: -19 }));
vi.mock('../../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({
    creatures: [
      { name: 'Gorgon 1', type: 'npc', currentHp: 50, maxHp: 50, saveBonuses: {}, resistances: [], immunities: [] },
      { name: 'Bandit 1', type: 'npc', currentHp: 999, maxHp: 999, saveBonuses: { constitution: csFixture.conBonus, con: csFixture.conBonus }, resistances: [], immunities: [] },
    ],
  })),
  setCombatSummaryCache: vi.fn(),
}));
vi.mock('../../../../hooks/useAllySelection.js', () => ({ getAllyList: vi.fn(() => null) }));
vi.mock('../../../../services/automation/common/damageRollback.js', () => ({ storeSpellLastAttack: vi.fn(), addTargetResult: vi.fn() }));
vi.mock('../../../../services/rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn(async () => true),
  isDistanceInRange: vi.fn(() => true),
}));
vi.mock('../../../../services/rules/features/sleepService.js', () => ({ stageSleepTargets: vi.fn() }));
vi.mock('../../../../services/rules/features/paralyzingBreathService.js', () => ({ stageParalysisTargets: vi.fn() }));
vi.mock('../../../../services/rules/features/weakeningBreathService.js', () => ({ grantWeakeningBreath: vi.fn() }));

const seenTargets = vi.hoisted(() => ({ current: [] }));
vi.mock('./CreatureSelectionModal.jsx', () => ({
  default: ({ title, targets, onConfirm, onSkip }) => {
    seenTargets.current = targets;
    return (
      <div className="sp-overlay">
        <div className="sp-header">{title}</div>
        {targets.map(t => (<label key={t.name} className="secondary-target-row"><input type="checkbox" />{t.name}</label>))}
        <button className="sp-roll-btn" onClick={() => onConfirm(seenTargets.current.map(t => t.name))} type="button">Confirm</button>
        <button className="sp-dismiss-btn" onClick={onSkip} type="button">Skip</button>
      </div>
    );
  },
}));

import { addEntry } from '../../../../services/ui/logService.js';

const GORGON = 'Gorgon 1';
const gorgonRow = () => monstersData.find(m => m.name === 'Gorgon').actions.find(a => a.name === 'Petrifying Breath');

let randomSpy;
function spyRandom(seq) {
  let i = 0;
  randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => seq[Math.min(i++, seq.length - 1)]);
}
afterEach(() => randomSpy?.mockRestore());

function renderBreath(stagedPetrify = parseStagedPetrifyClause(gorgonRow())) {
  return render(
    <SaveAttackAoeModal
      action={gorgonRow()}
      playerStats={{ name: GORGON }}
      campaignName="test-campaign"
      range={30}
      damage={null}
      damageType={null}
      saveType="Constitution"
      saveDc={15}
      dcSuccess={null}
      titleOverride="30-ft Cone (GM positions tokens; selection advisory)"
      excludeNames={[GORGON]}
      rangeGateFt={null}
      saveConditions={extractConditionsFromSaveEffect(gorgonRow().save_effect)}
      stagedPetrify={stagedPetrify}
      storeLastAttack={false}
      onClose={vi.fn()}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  seenTargets.current = [];
  csFixture.conBonus = -19;
});

describe('MA-0904 Gorgon Petrifying Breath picker — MA-0501 shared ladder', () => {
  it('DATA LOCK: gorgon actions[1] authors staged_petrify{petrified_hours:24} → parse arms petrifiedRounds 14400; no repeat_save key invented', () => {
    const row = gorgonRow();
    expect(row.staged_petrify).toEqual({ petrified_hours: 24 });
    expect(row.repeat_save).toBeUndefined();
    expect(row.save_dc).toBe(15);
    expect(row.save_type).toBe('Constitution');
    expect(row.damage_dice_primary).toBeUndefined();
    expect(parseStagedPetrifyClause(row)).toEqual({ petrifiedRounds: 14400 });
    expect(buildSaveOptions(row).stagedPetrify).toEqual({ petrifiedRounds: 14400 });
  });

  it('EXTRACTOR byte-invariant: word-scan still yields Petrified+Restrained — suppression is via ladder arm, not the extractor', () => {
    expect(extractConditionsFromSaveEffect(gorgonRow().save_effect)).toEqual(expect.arrayContaining(['petrified', 'restrained']));
  });

  it('failed NPC Con save: RESTRAINED ONLY (no Petrified) + petrifying_bite_staged te dc15 + ladder-armed log; no fabricated 1-minute petrified', async () => {
    spyRandom([0.01, 0.01, 0.01, 0.01]);
    const { getByText } = renderBreath();
    await waitFor(() => expect(seenTargets.current.length).toBe(1));
    fireEvent.click(getByText('Confirm'));
    await waitFor(() => expect(runtime.store['Bandit 1.activeConditions']).toBeTruthy());

    expect(runtime.store['Bandit 1.activeConditions']).toEqual(['restrained']);
    const tes = runtime.store['campaign.targetEffects'] || [];
    const te = tes.find(t => t.effect === 'petrifying_bite_staged');
    expect(te).toBeTruthy();
    expect(te).toMatchObject({
      target: 'Bandit 1',
      effect: 'petrifying_bite_staged',
      stage: 'restrained',
      condition: 'restrained',
      source: GORGON,
      dc: 15,
      saveType: 'CON',
      duration: 'ladder_until_second_failure',
      label: 'Petrifying Breath',
      petrifiedRounds: 14400,
    });
    const condLog = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'condition' && e.action === 'applied');
    expect(condLog.condition).toBe('Restrained');
    expect(condLog.reason).toBe('Petrifying Breath (failed save)');
    expect(condLog.note).toContain('second failure Petrifies');
    // No MA-0063 flat-condition stamp for petrified anywhere.
    const stamps = addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'condition' && e.condition === 'Petrified');
    expect(stamps).toHaveLength(0);
  });

  it('successful NPC Con save: zero conditions, zero ladder te, ladder stays unarmed', async () => {
    csFixture.conBonus = 19;
    spyRandom([0.99, 0.99, 0.99, 0.99]);
    const { getByText } = renderBreath();
    await waitFor(() => expect(seenTargets.current.length).toBe(1));
    fireEvent.click(getByText('Confirm'));
    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    expect(runtime.store['Bandit 1.activeConditions']).toBeUndefined();
    expect((runtime.store['campaign.targetEffects'] || []).find(t => t.effect === 'petrifying_bite_staged')).toBeFalsy();
  });

  it('byte-inert non-ladder rows: stagedPetrify null keeps the MA-0063 flat saveConditions grant untouched', async () => {
    spyRandom([0.01, 0.01, 0.01, 0.01]);
    const { getByText } = renderBreath(null);
    await waitFor(() => expect(seenTargets.current.length).toBe(1));
    fireEvent.click(getByText('Confirm'));
    await waitFor(() => expect(runtime.store['Bandit 1.activeConditions']).toBeTruthy());
    // Unsuppressed extractor grant: both conditions land (pre-fix behavior).
    expect(runtime.store['Bandit 1.activeConditions']).toEqual(expect.arrayContaining(['petrified', 'restrained']));
    expect((runtime.store['campaign.targetEffects'] || []).find(t => t.effect === 'petrifying_bite_staged')).toBeFalsy();
  });
});
