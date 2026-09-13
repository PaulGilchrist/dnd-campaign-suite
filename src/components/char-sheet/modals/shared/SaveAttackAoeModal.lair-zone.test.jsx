// MA-0042: area picker persisting-zone arm seam — with a zoneTe payload
// (byte-inert when null) the confirm writes a zone te per covered creature
// (`lair_insect_cloud`, source=caster, repeatTurnEnd) + caster tracking
// `_lair_insect_cloud_<caster>` {saveDc, saveType, radiusFt, repeatTurnEnd,
// affectedNames}, plus a GM-enforced ability_use log. The RAW "repeat 3d6 at
// turn end" clause is advisory (no turn-END zone-damage consumer in this
// engine) — the log says so. Non-zone rows write zero zone state.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SaveAttackAoeModal from './SaveAttackAoeModal.jsx';

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
      { name: 'Adult Black Dragon 1', type: 'npc', currentHp: 195, maxHp: 195, saveBonuses: {}, resistances: [], immunities: [] },
      { name: 'Thug 1', type: 'npc', currentHp: 45, maxHp: 45, saveBonuses: { con: 1 }, resistances: [], immunities: [] },
      { name: 'Thug 2', type: 'npc', currentHp: 45, maxHp: 45, saveBonuses: { con: 1 }, resistances: [], immunities: [] },
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

const ACTION = { name: 'Insect Cloud', save_dc: 15, save_type: 'Constitution', damage_dice_primary: '3d6', damage_type_primary: 'Piercing', dc_success: 'half' };
const ZONE_TE = { effectKey: 'lair_insect_cloud', trackingPrefix: 'lair_insect_cloud', radiusFt: 20, repeatTurnEnd: true, damage: '3d6', duration: 'until dismissed or used again (advisory)' };

let randomSpy;
beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  seenTargets.current = [];
  let i = 0;
  const seq = [0.05, 0.05, 0.95, 0.95];
  randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => seq[Math.min(i++, seq.length - 1)]);
});
afterEach(() => randomSpy.mockRestore());

function renderCloud({ zoneTe = ZONE_TE } = {}) {
  return render(
    <SaveAttackAoeModal
      action={ACTION}
      playerStats={{ name: 'Adult Black Dragon 1' }}
      campaignName="test-campaign"
      range={20}
      damage="3d6"
      damageType="Piercing"
      saveType="Constitution"
      saveDc={15}
      dcSuccess="half"
      titleOverride="20-ft Radius (GM positions tokens; selection advisory)"
      excludeNames={['Adult Black Dragon 1']}
      rangeGateFt={null}
      zoneTe={zoneTe}
      storeLastAttack={false}
      onClose={vi.fn()}
    />
  );
}

describe('MA-0042 area picker persisting-zone arm', () => {
  it('confirm writes a zone te per covered creature (source=caster, repeatTurnEnd) + GM-enforced turn-end log', async () => {
    const { getByText } = renderCloud();
    await waitFor(() => expect(seenTargets.current.map(t => t.name)).toEqual(['Thug 1', 'Thug 2']));
    fireEvent.click(getByText('Confirm'));
    await waitFor(() => expect(applyDamageToTarget).toHaveBeenCalled());
    const te = runtime.store['campaign.targetEffects'];
    expect(te.filter(t => t.effect === 'lair_insect_cloud').map(t => t.target).sort()).toEqual(['Thug 1', 'Thug 2']);
    const cloudTe = te.find(t => t.effect === 'lair_insect_cloud');
    expect(cloudTe.source).toBe('Adult Black Dragon 1');
    expect(cloudTe.dc).toBe(15);
    expect(cloudTe.radiusFt).toBe(20);
    expect(cloudTe.repeatTurnEnd).toBe(true);
    const log = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && (e.description || '').includes('lair_insect_cloud zone armed'));
    expect(log).toBeTruthy();
    expect(log.description).toMatch(/radius 20 ft.*Constitution save DC 15/);
    expect(log.description).toMatch(/Repeat 3d6 at turn end — GM-enforced/);
  });

  it('stamps caster tracking `_lair_insect_cloud_<caster>` with saveDc/radius/affectedNames', async () => {
    const { getByText } = renderCloud();
    await waitFor(() => expect(seenTargets.current.length).toBe(2));
    fireEvent.click(getByText('Confirm'));
    await waitFor(() => expect(runtime.store['Adult Black Dragon 1._lair_insect_cloud_Adult_Black_Dragon_1']).toBeTruthy());
    const tracking = runtime.store['Adult Black Dragon 1._lair_insect_cloud_Adult_Black_Dragon_1'];
    expect(tracking.saveDc).toBe(15);
    expect(tracking.saveType).toBe('Constitution');
    expect(tracking.radiusFt).toBe(20);
    expect(tracking.repeatTurnEnd).toBe(true);
    expect(tracking.damage).toBe('3d6');
    expect(tracking.affectedNames.sort()).toEqual(['Thug 1', 'Thug 2']);
  });

  it('save math untouched: fail full 10 Piercing, success half 5, both flagged zone te', async () => {
    const { getByText } = renderCloud();
    await waitFor(() => expect(seenTargets.current.length).toBe(2));
    fireEvent.click(getByText('Confirm'));
    await waitFor(() => expect(applyDamageToTarget).toHaveBeenCalledTimes(2));
    const byTarget = Object.fromEntries(applyDamageToTarget.mock.calls.map(c => [c[1], c[2]]));
    expect(byTarget['Thug 1']).toBe(10);
    expect(byTarget['Thug 2']).toBe(5);
    const logs = addEntry.mock.calls.map(c => c[1]).filter(e => e.rollType === 'save-damage');
    expect(logs.map(l => [l.targetName, l.saveResult, l.finalDamage].join(':')).sort()).toEqual(['Thug 1:failure:10', 'Thug 2:success:5']);
  });

  it('zoneTe null (all other consumers) → zero zone state written', async () => {
    const { getByText } = renderCloud({ zoneTe: null });
    await waitFor(() => expect(seenTargets.current.length).toBe(2));
    fireEvent.click(getByText('Confirm'));
    await waitFor(() => expect(applyDamageToTarget).toHaveBeenCalled());
    expect(runtime.store['campaign.targetEffects'] || []).toEqual([]);
    expect(Object.keys(runtime.store).some(k => k.includes('lair_insect_cloud'))).toBe(false);
    expect(addEntry.mock.calls.map(c => c[1]).some(e => (e.description || '').includes('lair_insect_cloud'))).toBe(false);
  });
});
