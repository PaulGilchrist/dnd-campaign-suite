// MA-1673: Vrock "Spores" (DC 15 Constitution, "20-foot Emanation", 1d10
// Poison, Poisoned fail-only) rides the SaveAttackAoeModal picker via the
// MA-0590 emanation-range parse. Pre-fix the absent dc_success let
// resolveBlockSaveDcSuccess (action.dc_success ?? 'half', §456/:523) default
// the picker to 'half' — live proof: +19 save SUCCESS paid rolls [7] → fd 3,
// hp_change −3, results modal "Saved — takes 3 Poison damage (rolled 18,
// halved)", picker copy fabricated "takes half damage" (§1191). Fix DATA
// dc_success:"none" → success pays ZERO (applyDamageToTarget never even
// fires — §279 picker zero-leg fingerprint), fail pays FULL 1d10 + Poisoned.
// Rigs ride FULL-word saveBonuses.constitution (§163: computeNpcSave reads
// cs.saveBonuses[saveType.toLowerCase()] = 'constitution'; -19 = always-fail
// floor, +19 = always-success even on nat 1).
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SaveAttackAoeModal from './SaveAttackAoeModal.jsx';
import monstersData from '../../../../../public/data/monsters.json';

const sporesRow = () => monstersData.find(m => m.index === 'vrock').actions.find(a => a.name === 'Spores');

const pickerCopy = vi.hoisted(() => ({ current: null }));
const runtimeStore = vi.hoisted(() => ({}));

const combatSummary = vi.hoisted(() => ({
  current: {
    creatures: [
      { name: 'Vrock 1', type: 'npc', currentHp: 152, maxHp: 152, ac: 15, saveBonuses: { con: 4 }, resistances: ['Cold', 'Fire', 'Lightning'], immunities: [], conditions: [] },
      { name: 'Bandit 1', type: 'npc', currentHp: 999, maxHp: 999, ac: 12, saveBonuses: { constitution: -19, con: 1 }, resistances: [], immunities: [], conditions: [] },
    ],
  },
}));

vi.mock('../../../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 7, rolls: [7], modifier: 0 })),
  rollExpressionMaximized: vi.fn(() => ({ total: 7, rolls: [7], modifier: 0 })),
}));

vi.mock('../../../../services/combat/automation/automationExpressions.js', () => ({
  resolveScaling: vi.fn(() => ({})),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((name, key) => runtimeStore[`${name}.${key}`] ?? null),
  setRuntimeValue: vi.fn((name, key, value) => { runtimeStore[`${name}.${key}`] = value; return Promise.resolve(); }),
}));

vi.mock('../../../../services/combat/conditions/savePromptService.js', () => ({
  sendSavePrompt: vi.fn(),
}));

// Faithful computeDamageAfterSave semantics (§87/MA-0367 three-mode):
// fail → raw, 'half' → floor, 'full' → raw, 'none' → 0. The pre-fix leak
// shape is exactly what the row WITHOUT dc_success produced ('half').
vi.mock('../../../../services/rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(async (_cs, _t, fd) => ({ finalDamage: fd, newHp: 999 - fd })),
  computeDamageAfterSave: vi.fn((raw, success, dcSuccess) => {
    if (!success) return raw;
    if (dcSuccess === 'half') return Math.floor(raw / 2);
    if (dcSuccess === 'full') return raw;
    return 0;
  }),
  computeDamageAfterEvasion: vi.fn((raw, success, dcSuccess, evasionActive) => {
    if (evasionActive && dcSuccess === 'half') return success ? 0 : Math.floor(raw / 2);
    if (!success) return raw;
    if (dcSuccess === 'half') return Math.floor(raw / 2);
    if (dcSuccess === 'full') return raw;
    return 0;
  }),
  computeDamageAfterResistancesWithDetails: vi.fn(({ rawDamage }) => ({ finalDamage: rawDamage })),
  hasEvasionForSave: vi.fn(() => false),
  normalizeSaveType: vi.fn((t) => String(t || '').toLowerCase()),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => combatSummary.current),
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

vi.mock('./CreatureSelectionModal.jsx', () => ({
  default: ({ title, description, note, targets, onConfirm, onSkip }) => {
    pickerCopy.current = `${title || ''} ${description || ''} ${note || ''}`;
    return (
      <div className="sp-overlay">
        <div className="sp-header">{title}</div>
        <div className="sp-body" dangerouslySetInnerHTML={{ __html: description || '' }} />
        {note && <p className="sp-note">{note}</p>}
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
import { addTargetResult } from '../../../../services/automation/common/damageRollback.js';

function renderSporesPicker() {
  const row = sporesRow();
  // dc_success flows exactly as MonsterCardModal.resolveBlockSaveDcSuccess
  // computes it for the live chip: Number(save_dc) > 0 ? dc_success ?? 'half'.
  const dcSuccess = Number(row.save_dc) > 0 ? (row.dc_success ?? 'half') : null;
  return render(
    <SaveAttackAoeModal
      action={row}
      playerStats={{ name: 'Vrock 1' }}
      campaignName="test-campaign"
      damage={row.damage_dice_primary}
      damageType="Poison"
      saveType={row.save_type}
      saveDc={row.save_dc}
      dcSuccess={dcSuccess}
      saveConditions={['poisoned']}
      titleOverride=" 20-ft Radius (GM positions tokens; selection advisory)"
      excludeNames={['Vrock 1']}
      rangeGateFt={20}
      storeLastAttack={false}
      onClose={vi.fn()}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
  combatSummary.current.creatures[1].currentHp = 999;
});

describe('MA-1673 Vrock Spores picker seam (live emanation route)', () => {
  it('dc_success resolves to none, never the half-default', () => {
    const row = sporesRow();
    expect(row.dc_success).toBe('none');
    expect(Number(row.save_dc) > 0 ? (row.dc_success ?? 'half') : null).toBe('none');
  });

  it('FAIL face (constitution −19 always-fail floor): FULL 1d10 byte "1d10" rolls [7] + Poisoned granted with source meta', async () => {
    const { getByText } = renderSporesPicker();
    await waitFor(() => expect(document.querySelector('.sp-roll-btn')).toBeTruthy());
    fireEvent.click(getByText('Confirm'));
    await waitFor(() => expect(applyDamageToTarget).toHaveBeenCalledTimes(1));
    const call = applyDamageToTarget.mock.calls[0];
    expect(call[1]).toBe('Bandit 1');
    expect(call[2]).toBe(7);
    expect(call[3]).toEqual(['Poison']);
    const saveLog = addEntry.mock.calls.map(c => c[1]).find(e => e && e.rollType === 'save-damage');
    expect(saveLog).toMatchObject({ formula: '1d10', rolls: [7], finalDamage: 7, saveResult: 'failure', saveDc: 15, dcSuccess: 'none', targetName: 'Bandit 1' });
    expect(runtimeStore['Bandit 1.activeConditions']).toContain('poisoned');
    expect(runtimeStore['Bandit 1.activeConditionMeta'].poisoned).toMatchObject({ dc: 15, ability: 'con', source: 'Vrock 1' });
    const condLog = addEntry.mock.calls.map(c => c[1]).find(e => e && e.type === 'condition' && e.action === 'applied');
    expect(condLog.description).toMatch(/Poisoned/);
  });

  it('SUCCESS face (constitution +19 always-success): ZERO damage — no applyDamageToTarget, no hp_change, no Poisoned grant', async () => {
    combatSummary.current.creatures[1].saveBonuses = { constitution: 19, con: 1 };
    const { getByText } = renderSporesPicker();
    await waitFor(() => expect(document.querySelector('.sp-roll-btn')).toBeTruthy());
    fireEvent.click(getByText('Confirm'));
    await waitFor(() => expect(addTargetResult).toHaveBeenCalled());
    expect(applyDamageToTarget).not.toHaveBeenCalled();
    expect(runtimeStore['Bandit 1.activeConditions'] ?? []).not.toContain('poisoned');
    const dmgLogs = addEntry.mock.calls.map(c => c[1]).filter(e => e && e.rollType === 'save-damage');
    expect(dmgLogs.every(e => e.finalDamage === 0)).toBe(true);
    // Picker copy honesty (§1191): dc_success:'none' prints "no damage", never half.
    expect(pickerCopy.current).toMatch(/takes no damage/i);
    expect(pickerCopy.current).not.toMatch(/half damage/i);
  });
});
