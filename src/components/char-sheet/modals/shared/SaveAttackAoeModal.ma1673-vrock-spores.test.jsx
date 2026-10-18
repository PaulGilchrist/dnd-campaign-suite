// @maintained-by-ai
// MA-1673/MA-1674: Vrock "Spores" and "Stunning Scream" (both DC 15
// Constitution, 20-ft Emanation) ride the SaveAttackAoeModal picker via the
// MA-0590 emanation parse with the FIX DATA dc_success:"none" — success pays
// ZERO (applyDamageToTarget never fires on that leg — §279 picker zero-leg
// fingerprint), fail pays FULL dice + the authored condition (MA-0063
// fail-grant shape with {dc, ability, source} meta for the PC badge re-save
// seam). Pre-fix the absent dc_success let resolveBlockSaveDcSuccess
// (action.dc_success ?? 'half', §456/:523) default the picker to 'half' —
// live fingerprint: "Saved — takes 3 Poison damage (rolled 18, halved)" +
// fabricated "takes half damage" copy (§1191). One mixed confirm per row
// adjudicates BOTH faces in a single pass: Bandit 1 nat 1 (< DC 15 even at
// bonus 0) FAILS, Bandit 2 nat 20 SUCCEEDS. Rigs keep saveBonuses EMPTY and
// the dice decisive so the outcome holds under either key spelling
// (live cs carries abbr keys, computeNpcSave reads full-word — §163) and the
// lane stays green across the fix instead of enshrining the mismatch.
// Owned elsewhere: key-order/data pins (MonsterCardModal.legendary-uses-*),
// usage-counter spend chips (MonsterAction/MonsterCardModal usage lanes),
// copy-honesty family canon (thunderclap-sphere), skip/cancel
// (creature-selection lane).
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SaveAttackAoeModal from './SaveAttackAoeModal.jsx';
import monstersData from '../../../../../public/data/monsters.json';

const vrockRow = (name) => monstersData.find(m => m.index === 'vrock').actions.find(a => a.name === name);

const pickerCopy = vi.hoisted(() => ({ current: null }));
const runtimeStore = vi.hoisted(() => ({}));

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

// Faithful computeDamageAfterSave/Evasion three-mode semantics (§87/MA-0367):
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
  getCombatSummary: vi.fn(() => ({
    creatures: [
      { name: 'Vrock 1', type: 'npc', currentHp: 152, maxHp: 152, ac: 15, saveBonuses: {}, resistances: ['Cold', 'Fire', 'Lightning'], immunities: [], conditions: [] },
      { name: 'Bandit 1', type: 'npc', currentHp: 999, maxHp: 999, ac: 12, saveBonuses: {}, resistances: [], immunities: [], conditions: [] },
      { name: 'Bandit 2', type: 'npc', currentHp: 999, maxHp: 999, ac: 12, saveBonuses: {}, resistances: [], immunities: [], conditions: [] },
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
import { sendSavePrompt } from '../../../../services/combat/conditions/savePromptService.js';

function renderRowPicker(row, { damageType, saveConditions }) {
  // dc_success flows exactly as MonsterCardModal.resolveBlockSaveDcSuccess
  // computes it for the live chip: Number(save_dc) > 0 ? dc_success ?? 'half'.
  const dcSuccess = Number(row.save_dc) > 0 ? (row.dc_success ?? 'half') : null;
  return render(
    <SaveAttackAoeModal
      action={row}
      playerStats={{ name: 'Vrock 1' }}
      campaignName="test-campaign"
      damage={row.damage_dice_primary}
      damageType={damageType}
      saveType={row.save_type}
      saveDc={row.save_dc}
      dcSuccess={dcSuccess}
      saveConditions={saveConditions}
      titleOverride=" 20-ft Radius (GM positions tokens; selection advisory)"
      excludeNames={['Vrock 1']}
      rangeGateFt={20}
      storeLastAttack={false}
      onClose={vi.fn()}
    />
  );
}

let randomSpy;
beforeEach(() => {
  vi.clearAllMocks();
  for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
  // Mixed-confirm seam (2 quick-roll randoms per NPC, target order):
  // Bandit 1 nat 1 → total 1 < DC 15 FAIL; Bandit 2 nat 20 ≥ DC 15 SAVE.
  const seq = [0.01, 0.01, 0.99, 0.99];
  let i = 0;
  randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => seq[Math.min(i++, seq.length - 1)]);
});
afterEach(() => randomSpy.mockRestore());

async function mixedConfirm({ row, damageType, condition }) {
  const { getByText } = renderRowPicker(row, { damageType, saveConditions: [condition] });
  await waitFor(() => expect(document.querySelector('.sp-roll-btn')).toBeTruthy());

  const conditionLabel = condition.charAt(0).toUpperCase() + condition.slice(1);

  // Picker surface before confirm: excludeNames leaves exactly the two
  // bandits (never the caster) and dc_success:'none' copy is honest (§1191).
  expect([...document.querySelectorAll('.secondary-target-row input')].map(i => i.dataset.name)).toEqual(['Bandit 1', 'Bandit 2']);
  expect(pickerCopy.current).toMatch(/takes no damage/i);
  expect(pickerCopy.current).not.toMatch(/half damage/i);
  // Pre-confirm inertness: nothing resolved, prompted, or logged.
  expect(applyDamageToTarget).not.toHaveBeenCalled();
  expect(addTargetResult).not.toHaveBeenCalled();
  expect(addEntry).not.toHaveBeenCalled();

  fireEvent.click(getByText('Confirm'));
  await waitFor(() => expect(addTargetResult).toHaveBeenCalledTimes(2));

  const saveLogs = addEntry.mock.calls.map(c => c[1]).filter(e => e && e.rollType === 'save-damage');
  const failLog = saveLogs.find(e => e.targetName === 'Bandit 1');

  // FAIL face: FULL raw roll, byte-formula from the live row, condition +
  // {dc, ability, source} meta granted for the badge re-save seam.
  expect(applyDamageToTarget).toHaveBeenCalledTimes(1); // zero-leg never applies (§279)
  const call = applyDamageToTarget.mock.calls[0];
  expect(call[1]).toBe('Bandit 1');
  expect(call[2]).toBe(7);
  expect(call[3]).toEqual([damageType]);
  expect(failLog).toMatchObject({ formula: row.damage_dice_primary, rolls: [7], finalDamage: 7, saveResult: 'failure', saveRoll: 1, saveDc: 15, dcSuccess: 'none', targetName: 'Bandit 1' });
  expect(runtimeStore['Bandit 1.activeConditions']).toContain(condition);
  expect(runtimeStore['Bandit 1.activeConditionMeta'][condition]).toMatchObject({ dc: 15, ability: 'con', source: 'Vrock 1' });
  const condLog = addEntry.mock.calls.map(c => c[1]).find(e => e && e.type === 'condition' && e.action === 'applied' && e.characterName === 'Bandit 1');
  expect(condLog.description).toMatch(new RegExp(conditionLabel));

  // SAVE face (dc_success:'none'): ZERO damage, nothing granted, no PC
  // prompt on this all-NPC emanation route — the picker auto-adjudicates.
  expect(sendSavePrompt).not.toHaveBeenCalled();
  expect(runtimeStore['Bandit 2.activeConditions'] ?? []).not.toContain(condition);
  const rows = addTargetResult.mock.calls.map(c => c[1]);
  expect(rows.find(r => r.targetName === 'Bandit 1')).toMatchObject({ saveResult: 'failure', appliedDamage: 7 });
  expect(rows.find(r => r.targetName === 'Bandit 2')).toMatchObject({ saveResult: 'success', appliedDamage: 0 });
}

describe('MA-1673/MA-1674 Vrock emanation picker seam (live monsters.json rows)', () => {
  it('Spores mixed confirm: nat 1 FAIL pays FULL 1d10 Poison + Poisoned w/ meta; nat 20 SAVE pays ZERO, grants nothing', async () => {
    const row = vrockRow('Spores');
    expect(row.dc_success).toBe('none'); // the fix data — never the 'half' default
    await mixedConfirm({ row, damageType: 'Poison', condition: 'poisoned' });
  });

  it('Stunning Scream mixed confirm: nat 1 FAIL pays FULL 3d6 Thunder + Stunned w/ meta; nat 20 SAVE pays ZERO, grants nothing', async () => {
    const row = vrockRow('Stunning Scream');
    expect(row.dc_success).toBe('none');
    expect(row).toMatchObject({ usage: '1/Day', uses: 1, maxUses: 1 }); // MA-0633 numeric triple (no NaN string gate)
    await mixedConfirm({ row, damageType: 'Thunder', condition: 'stunned' });
  });
});
