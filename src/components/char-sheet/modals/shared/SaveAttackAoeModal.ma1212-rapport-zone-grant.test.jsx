// MA-1212: zoneOnly picker CONFIRM with the rapport_spores zoneTe — te
// registered per picker-SELECTED creature (effect rapport_spores, source=
// caster, dc null), caster tracking `_rapport_spores_<caster>` with duration
// '1 hour', GM-enforced. NO save rolled, NO damage applied, NO expression
// rolled (saveDc null → saveNote "no save"). MA-0042/MA-0595 byte-twin
// consumer path, untouched code — this pins the rapport payload through it.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SaveAttackAoeModal from './SaveAttackAoeModal.jsx';
import monstersData from '../../../../../public/data/monsters.json';
import { zoneTeForAction } from '../../../encounter/MonsterCardModal.jsx';

vi.mock('../../../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 10, rolls: [3, 3, 4], modifier: 0 })),
  rollExpressionMaximized: vi.fn(() => ({ total: 10, rolls: [], modifier: 0 })),
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
vi.mock('../../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({
    creatures: [
      { name: 'Myconid Adult 1', type: 'npc', currentHp: 16, maxHp: 16, saveBonuses: {}, resistances: [], immunities: [] },
      { name: 'Bandit', type: 'npc', currentHp: 11, maxHp: 11, saveBonuses: {}, resistances: [], immunities: [] },
      { name: 'Thug 1', type: 'npc', currentHp: 45, maxHp: 45, saveBonuses: {}, resistances: [], immunities: [] },
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

import { applyDamageToTarget } from '../../../../services/rules/combat/applyDamage.js';
import { addEntry } from '../../../../services/ui/logService.js';
import { rollExpression } from '../../../../services/dice/diceRoller.js';

const RAPPORT = monstersData.find(m => m.index === 'myconid-adult').actions[2];
const ACTION = { ...RAPPORT, save_dc: null };
const ZONE_TE = zoneTeForAction(RAPPORT);

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  seenTargets.current = [];
});

function renderRapportZone() {
  return render(
    <SaveAttackAoeModal
      action={ACTION}
      playerStats={{ name: 'Myconid Adult 1' }}
      campaignName="test-campaign"
      range={30}
      damage={null}
      damageType={null}
      saveType={null}
      saveDc={null}
      dcSuccess={null}
      titleOverride="30-foot radius (GM positions; selection advisory)"
      excludeNames={['Myconid Adult 1']}
      rangeGateFt={null}
      zoneTe={ZONE_TE}
      zoneOnly={true}
      storeLastAttack={false}
      onClose={vi.fn()}
    />
  );
}

describe('MA-1212 rapport_spores zoneOnly confirm: te grant, zero rolls, zero damage', () => {
  it('confirm registers rapport_spores te per selected creature (dc null, radius 30) with NO save/attack/damage rolls', async () => {
    const { getByText } = renderRapportZone();
    await waitFor(() => expect(seenTargets.current.map(t => t.name)).toEqual(['Bandit', 'Thug 1']));
    fireEvent.click(getByText('Confirm'));
    await waitFor(() => expect(runtime.store['campaign.targetEffects']).toBeTruthy());
    const te = runtime.store['campaign.targetEffects'].filter(t => t.effect === 'rapport_spores');
    expect(te.map(t => t.target).sort()).toEqual(['Bandit', 'Thug 1']);
    expect(te[0].source).toBe('Myconid Adult 1');
    expect(te[0].dc ?? null).toBeNull();
    expect(te[0].radiusFt).toBe(30);
    expect(applyDamageToTarget).not.toHaveBeenCalled();
    expect(rollExpression).not.toHaveBeenCalled();
  });

  it('caster tracking `_rapport_spores_Myconid_Adult_1` carries affectedNames + duration 1 hour; log says "no save" + GM-enforced clause', async () => {
    const { getByText } = renderRapportZone();
    await waitFor(() => expect(seenTargets.current.length).toBe(2));
    fireEvent.click(getByText('Confirm'));
    await waitFor(() => expect(runtime.store['Myconid Adult 1._rapport_spores_Myconid_Adult_1']).toBeTruthy());
    const tracking = runtime.store['Myconid Adult 1._rapport_spores_Myconid_Adult_1'];
    expect(tracking.saveDc).toBeNull();
    expect(tracking.radiusFt).toBe(30);
    expect(tracking.damage).toBeNull();
    expect(tracking.duration).toBe('1 hour');
    expect(tracking.affectedNames.sort()).toEqual(['Bandit', 'Thug 1']);
    const log = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && (e.description || '').includes('rapport_spores zone armed'));
    expect(log).toBeTruthy();
    expect(log.description).toMatch(/no save/);
    expect(log.description).toMatch(/Duration 1 hour — GM-enforced/);
    expect(log.description).toMatch(/GM-enforced/);
  });
});
