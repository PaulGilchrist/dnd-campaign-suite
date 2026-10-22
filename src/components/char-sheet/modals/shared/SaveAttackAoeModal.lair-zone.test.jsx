// @maintained-by-ai
// MA-0042: area picker persisting-zone arm seam — with a zoneTe payload
// (byte-inert when null) the confirm writes a zone te per covered creature
// (`lair_insect_cloud`, source=caster, repeatTurnEnd) + caster tracking
// `_lair_insect_cloud_<caster>` {saveDc, saveType, radiusFt, repeatTurnEnd,
// damage, duration, affectedNames}, plus a GM-enforced ability_use log. The
// RAW "repeat 3d6 at turn end" clause stays advisory copy while zones
// enforcement is off — the log says so. Ordinary save math is unchanged by
// the arm (fail full / success half). Non-zone rows write zero zone state.
// Family map (#216): save-less pure arm → lair-darkness (#215); damageless
// save+zone composite → lair-sand-cloud; zoneTe data-pins → MonsterCardModal.
// MA-0610 #217 clobber-fix: pinned here — repeat-row arms must carry the
// H3 damage-derived recurringDie on every armed te (full-set + absent pins).
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
  // Mixed confirm (2 quick-roll randoms per NPC): Thug 1 fails DC 15
  // (d20 2 + con 1, full damage), Thug 2 succeeds (d20 20 + con 1, half).
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

async function openAndConfirm() {
  const utils = renderCloud();
  await waitFor(() => expect(seenTargets.current.map(t => t.name)).toEqual(['Thug 1', 'Thug 2']));
  // Pre-confirm inertness: picker open, zero writes.
  expect(runtime.store['campaign.targetEffects']).toBeFalsy();
  expect(addEntry).not.toHaveBeenCalled();
  fireEvent.click(utils.getByText('Confirm'));
  await waitFor(() => expect(applyDamageToTarget).toHaveBeenCalledTimes(2));
  return utils;
}

describe('MA-0042 area picker persisting-zone arm', () => {
  it('mixed confirm arms the zone: te per creature + caster tracking + honest arm log; save math halves damage only', async () => {
    await openAndConfirm();

    // Zone te: one per covered creature, source=caster, DC/radius carried,
    // persistent (until_end_of_zone) with the Constitution repeat-save
    // descriptor riding on the te for the turn-end consumer.
    const tes = runtime.store['campaign.targetEffects'].filter(t => t.effect === 'lair_insect_cloud');
    expect(tes.map(t => t.target).sort()).toEqual(['Thug 1', 'Thug 2']);
    expect(tes.every(t => (
      t.source === 'Adult Black Dragon 1'
      && t.dc === 15
      && t.radiusFt === 20
      && t.repeatTurnEnd === true
      && t.duration === 'until_end_of_zone'
      && t.saveType === 'Constitution'
    ))).toBe(true);

    // MA-0610 #217 clobber-fix, strongest form: exact full-set on EVERY armed
    // zone te — the H3 damage-derived recurringDie '3d6' (from zoneTe.damage,
    // insect-cloud's ONLY authored die) must SURVIVE the ma0610TeDescriptors
    // spread. Pre-fix the unconditional `recurringDie: zoneTe.recurringDie ||
    // undefined` key spread AFTER h3TeRepeatDescriptors clobbered it to
    // undefined, so zoneRepeatTurnEndService.resolveZoneDice saw nothing on
    // the te. toEqual treats the still-inert undefined recurringType/
    // repeatSave/noun keys as absent — identical to the on-disk JSON shape.
    const armedByName = Object.fromEntries(tes.map(t => [t.target, t]));
    expect(armedByName['Thug 1']).toEqual({
      target: 'Thug 1',
      effect: 'lair_insect_cloud',
      source: 'Adult Black Dragon 1',
      duration: 'until_end_of_zone',
      dc: 15,
      radiusFt: 20,
      repeatTurnEnd: true,
      saveType: 'Constitution',
      recurringDie: '3d6',
    });
    expect(armedByName['Thug 2']).toEqual({
      target: 'Thug 2',
      effect: 'lair_insect_cloud',
      source: 'Adult Black Dragon 1',
      duration: 'until_end_of_zone',
      dc: 15,
      radiusFt: 20,
      repeatTurnEnd: true,
      saveType: 'Constitution',
      recurringDie: '3d6',
    });

    // Caster tracking blob for any future zone consumer.
    const tracking = runtime.store['Adult Black Dragon 1._lair_insect_cloud_Adult_Black_Dragon_1'];
    expect(tracking).toMatchObject({
      saveDc: 15,
      saveType: 'Constitution',
      radiusFt: 20,
      repeatTurnEnd: true,
      damage: '3d6',
      duration: 'until dismissed or used again (advisory)',
    });
    expect([...tracking.affectedNames].sort()).toEqual(['Thug 1', 'Thug 2']);

    // Arm log naming the zone with radius + DC, and the honest adjudication
    // copy (H3 §17: repeat is engine-consumed only while enforcement is on).
    const log = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && (e.description || '').includes('lair_insect_cloud zone armed'));
    expect(log).toBeTruthy();
    expect(log.description).toMatch(/radius 20 ft.*Constitution save DC 15/);
    expect(log.description).toMatch(/Repeat 3d6 at turn end — engine-consumed while zones enforcement is on \(currently off — GM-adjudicated\)/);

    // Ordinary save math untouched by the arm: the save-success leg halves
    // damage only — Thug 1 pays full 10 Piercing, Thug 2 half 5.
    const byTarget = Object.fromEntries(applyDamageToTarget.mock.calls.map(c => [c[1], c[2]]));
    expect(byTarget['Thug 1']).toBe(10);
    expect(byTarget['Thug 2']).toBe(5);
    const logs = addEntry.mock.calls.map(c => c[1]).filter(e => e.rollType === 'save-damage');
    expect(logs.map(l => [l.targetName, l.saveResult, l.finalDamage].join(':')).sort()).toEqual(['Thug 1:failure:10', 'Thug 2:success:5']);
  });

  // MA-0610 #217 negative (bytes that ship): repeat zoneTe WITHOUT damage
  // and WITHOUT recurringDie ⇒ recurringDie key stays ABSENT on every armed
  // te (never fabricated; pre-fix it was present-as-undefined, which is
  // JSON-invisible on disk but contradicted the te-carried contract). The
  // consumer chain (zoneRepeatTurnEndService.resolveZoneDice) then falls
  // back to the caster tracking stamp and, unresolvable there too, skips
  // with a loud console.error — never invents a die.
  it('repeat zoneTe with no damage and no recurringDie → recurringDie stays absent, repeat contract keys still ride', async () => {
    const { getByText } = renderCloud({ zoneTe: { ...ZONE_TE, damage: null } });
    await waitFor(() => expect(seenTargets.current.length).toBe(2));
    fireEvent.click(getByText('Confirm'));
    await waitFor(() => expect(applyDamageToTarget).toHaveBeenCalledTimes(2));
    const tes = runtime.store['campaign.targetEffects'].filter(t => t.effect === 'lair_insect_cloud');
    expect(tes).toHaveLength(2);
    tes.forEach(t => {
      expect(t).not.toHaveProperty('recurringDie');
      expect(t.repeatTurnEnd).toBe(true);
      expect(t.saveType).toBe('Constitution');
    });
    expect(runtime.store['Adult Black Dragon 1._lair_insect_cloud_Adult_Black_Dragon_1'].damage).toBeNull();
  });

  it('zoneTe null (all other consumers) → zero zone state written, ordinary save/damage flow intact', async () => {
    const { getByText } = renderCloud({ zoneTe: null });
    await waitFor(() => expect(seenTargets.current.length).toBe(2));
    fireEvent.click(getByText('Confirm'));
    await waitFor(() => expect(applyDamageToTarget).toHaveBeenCalledTimes(2));
    expect(runtime.store['campaign.targetEffects'] || []).toEqual([]);
    expect(Object.keys(runtime.store).some(k => k.includes('lair_insect_cloud'))).toBe(false);
    expect(addEntry.mock.calls.map(c => c[1]).some(e => (e.description || '').includes('lair_insect_cloud'))).toBe(false);
    // Byte-inert means zone-only: both save-damage legs still resolve normally.
    expect(addEntry.mock.calls.map(c => c[1]).filter(e => e.rollType === 'save-damage')).toHaveLength(2);
  });
});
