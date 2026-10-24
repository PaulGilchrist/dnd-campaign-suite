// @maintained-by-ai
// MA-0063 Sand Cloud picker — the damageless save+zone COMPOSITE seam. This
// lane owns the asymmetric adjudication other lanes cannot pin together: one
// mixed confirm where the Blinded condition lands ONLY on failed Constitution
// saves (activeConditions + activeConditionMeta {dc, ability, source} for the
// PC badge re-save seam) while the persisting-zone te (`lair_sand_cloud`,
// source=caster, dc) mirrors over EVERY covered creature including the save
// success — with ZERO damage on both legs (null formula, dc_success none).
// Owned elsewhere: zone-arm tracking/log copy (SaveAttackAoeModal.lair-zone),
// save-less pure arm (#215 lair-darkness), flat-grant log-copy + meta shapes
// (thunderclap-sphere / kraken-toxic-ink), zoneTe data-pins
// (MonsterCardModal.lair-sand-cloud*). Skip/cancel stays with the
// creature-selection lane.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SaveAttackAoeModal from './SaveAttackAoeModal.jsx';

vi.mock('../../../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn((f) => (f ? { total: 10, rolls: [3, 3, 4], modifier: 0 } : null)),
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

const savePrompts = vi.hoisted(() => ({ sendSavePrompt: vi.fn() }));
vi.mock('../../../../services/combat/conditions/savePromptService.js', () => ({ sendSavePrompt: savePrompts.sendSavePrompt }));
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
      { name: 'Adult Blue Dragon 1', type: 'npc', currentHp: 225, maxHp: 225, saveBonuses: {}, resistances: [], immunities: [] },
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
vi.mock('./CreatureSelectionModal.jsx', async () => {
  const { createStaticPickerModal } = await import('./SaveAttackAoeModal.test-utils.jsx');
  return { default: createStaticPickerModal(seenTargets) };
});

import { applyDamageToTarget } from '../../../../services/rules/combat/applyDamage.js';
import { addEntry } from '../../../../services/ui/logService.js';
import { rollExpression, rollExpressionMaximized } from '../../../../services/dice/diceRoller.js';

const ACTION = { name: 'Sand Cloud', save_dc: 15, save_type: 'Constitution', dc_success: 'none', zone: { radius_ft: 20, effect_key: 'lair_sand_cloud', repeat_save: true } };
const ZONE_TE = { effectKey: 'lair_sand_cloud', trackingPrefix: 'lair_sand_cloud', radiusFt: 20, repeatTurnEnd: false, damage: null, duration: 'blinded 1 minute (repeat save ends early; advisory)' };

let randomSpy;
beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  seenTargets.current = [];
  // Mixed confirm (2 quick-roll randoms per NPC): Thug 1 fails DC 15
  // (d20 2 + con 1), Thug 2 succeeds (d20 20 + con 1).
  const seq = [0.05, 0.05, 0.95, 0.95];
  let i = 0;
  randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => seq[Math.min(i++, seq.length - 1)]);
});
afterEach(() => randomSpy.mockRestore());

function renderCloud() {
  return render(
    <SaveAttackAoeModal
      action={ACTION}
      playerStats={{ name: 'Adult Blue Dragon 1' }}
      campaignName="test-campaign"
      range={20}
      damage={null}
      damageType=""
      saveType="Constitution"
      saveDc={15}
      dcSuccess="none"
      titleOverride="20-ft Radius (GM positions tokens; selection advisory)"
      excludeNames={['Adult Blue Dragon 1']}
      rangeGateFt={null}
      zoneTe={ZONE_TE}
      saveConditions={['blinded']}
      storeLastAttack={false}
      onClose={vi.fn()}
    />
  );
}

async function confirmMixedPicker() {
  const { getByText } = renderCloud();
  await waitFor(() => expect(seenTargets.current.map(t => t.name)).toEqual(['Thug 1', 'Thug 2']));
  fireEvent.click(getByText('Confirm'));
}

describe('MA-0063 Sand Cloud picker — damageless save + zone composite', () => {
  it('mixed confirm: Blinded lands ONLY on the failed CON save with dc+ability+source meta; success stays clean, zero damage, one named condition log', async () => {
    const { getByText } = renderCloud();
    await waitFor(() => expect(seenTargets.current.map(t => t.name)).toEqual(['Thug 1', 'Thug 2']));
    // Pre-confirm inertness: picker open, nothing written yet.
    expect(runtime.store['campaign.targetEffects']).toBeFalsy();
    expect(addEntry).not.toHaveBeenCalled();
    expect(applyDamageToTarget).not.toHaveBeenCalled();
    fireEvent.click(getByText('Confirm'));

    await waitFor(() => expect(runtime.store['Thug 1.activeConditions']).toContain('blinded'));
    expect(runtime.store['Thug 1.activeConditionMeta'].blinded).toMatchObject({ dc: 15, ability: 'con', source: 'Adult Blue Dragon 1' });
    // The failed-save leg grants zero damage (null formula, dc_success none).
    expect(applyDamageToTarget).not.toHaveBeenCalled();

    // Negative leg: the save SUCCESS stays untouched — no condition, no meta.
    expect(runtime.store['Thug 2.activeConditions']).toBeUndefined();
    expect(runtime.store['Thug 2.activeConditionMeta']).toBeUndefined();

    // Exactly ONE condition-applied log, naming the failer + honest advisory copy.
    const condLogs = addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'condition');
    expect(condLogs.length).toBe(1);
    expect(condLogs[0].description).toMatch(/Thug 1 failed the Constitution save \(DC 15\) in Adult Blue Dragon 1's Sand Cloud — Blinded 1 minute/);
    expect(condLogs[0].description).toMatch(/NPC turn-end auto-repeat and 1-minute expiry GM-enforced/);
  });

  it('zone te mirrors every covered creature INCLUDING the save success — persistent arm is outcome-independent; zero damage dice rolled, zero prompts', async () => {
    await confirmMixedPicker();
    await waitFor(() => expect(runtime.store['campaign.targetEffects']).toBeTruthy());

    const cloudTes = runtime.store['campaign.targetEffects'].filter(t => t.effect === 'lair_sand_cloud');
    expect(cloudTes.map(t => t.target).sort()).toEqual(['Thug 1', 'Thug 2']);
    expect(cloudTes.every(t => t.source === 'Adult Blue Dragon 1' && t.dc === 15)).toBe(true);
    // The zone survives the successful save that dodged the condition.
    expect(runtime.store['Thug 2.activeConditions']).toBeUndefined();

    // Tracking: damageless zone WITH a save (dc 15 — distinct from save-less darkness).
    const tracking = runtime.store['Adult Blue Dragon 1._lair_sand_cloud_Adult_Blue_Dragon_1'];
    expect(tracking).toBeTruthy();
    expect(tracking.saveDc).toBe(15);
    expect(tracking.damage).toBeNull();

    const zoneLog = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && (e.description || '').includes('lair_sand_cloud zone armed'));
    expect(zoneLog).toBeTruthy();

    // Honest zero-dice pin: every damage roll attempted carried no formula.
    expect(rollExpression.mock.calls.every(([f]) => !f)).toBe(true);
    expect(rollExpressionMaximized).not.toHaveBeenCalled();
    expect(applyDamageToTarget).not.toHaveBeenCalled();
    expect(savePrompts.sendSavePrompt).not.toHaveBeenCalled();
  });
});
