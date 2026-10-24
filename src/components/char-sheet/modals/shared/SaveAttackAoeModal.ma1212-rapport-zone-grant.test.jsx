// @maintained-by-ai
// MA-1212/1217/1220: zoneOnly picker CONFIRM through the rapport_spores lane.
// Rapport-specific semantics pinned here (zone fundamentals live in lair-zone
// #217, save-less zero-roll guard in lair-darkness #215): the ONLY engine
// exemption is the caster (INT≥2 / non-Construct/Elemental/Undead inclusion
// stays GM-advisory — every board creature is selectable); te is registered
// per picker-SELECTED creature (effect rapport_spores, source=caster, dc
// null, duration until_end_of_zone); caster tracking `_rapport_spores_<caster>`
// carries duration '1 hour' + affectedNames; log is honest ("no save",
// "Duration 1 hour — GM-enforced"). NO save prompt, NO rolls, NO damage.
// Sovereign/sprout rows are disk byte-twins of adult (identical zone object)
// — run as one parameterized twin lane to prove caster-name derivation.
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
vi.mock('./CreatureSelectionModal.jsx', async () => {
  const { createStaticPickerModal } = await import('./SaveAttackAoeModal.test-utils.jsx');
  return { default: createStaticPickerModal(seenTargets) };
});

import { applyDamageToTarget } from '../../../../services/rules/combat/applyDamage.js';
import { sendSavePrompt } from '../../../../services/combat/conditions/savePromptService.js';
import { addEntry } from '../../../../services/ui/logService.js';
import { rollExpression } from '../../../../services/dice/diceRoller.js';

function rapportAction(meta) {
  return { ...monstersData.find(m => m.index === meta.index).actions[meta.actionIdx], save_dc: null };
}

function renderRapportZone(action, caster) {
  return render(
    <SaveAttackAoeModal
      action={action}
      playerStats={{ name: caster }}
      campaignName="test-campaign"
      range={30}
      damage={null}
      damageType={null}
      saveType={null}
      saveDc={null}
      dcSuccess={null}
      titleOverride="30-foot radius (GM positions; selection advisory)"
      excludeNames={[caster]}
      rangeGateFt={null}
      zoneTe={zoneTeForAction(action)}
      zoneOnly={true}
      storeLastAttack={false}
      onClose={vi.fn()}
    />
  );
}

function armedLog() {
  return addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && (e.description || '').includes('rapport_spores zone armed'));
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  seenTargets.current = [];
});

const ADULT = { index: 'myconid-adult', actionIdx: 2, caster: 'Myconid Adult 1' };
const TWINS = [
  { index: 'myconid-sovereign', actionIdx: 4, caster: 'Myconid Sovereign 1' },
  { index: 'myconid-sprout', actionIdx: 1, caster: 'Myconid Sprout 1' },
];

describe('MA-1212 rapport_spores zoneOnly confirm: te grant, zero rolls, zero damage', () => {
  it('adult caster is the only exemption — confirm grants dc-null te to every selected creature, writes 1-hour tracking + honest "no save" log, zero prompts/rolls/damage', async () => {
    const { getByText } = renderRapportZone(rapportAction(ADULT), ADULT.caster);
    // Rapport inclusion is GM-advisory (INT/type exclusions NOT engine-enforced):
    // every board creature is selectable except the caster.
    await waitFor(() => expect(seenTargets.current.map(t => t.name)).toEqual(['Bandit', 'Thug 1']));
    // Pre-confirm inertness: picker open, zero writes, zero rolls.
    expect(runtime.store['campaign.targetEffects']).toBeFalsy();
    expect(addEntry).not.toHaveBeenCalled();

    fireEvent.click(getByText('Confirm'));
    await waitFor(() => expect(runtime.store['campaign.targetEffects']).toBeTruthy());
    const tes = runtime.store['campaign.targetEffects'].filter(t => t.effect === 'rapport_spores');
    expect(tes.map(t => t.target).sort()).toEqual(['Bandit', 'Thug 1']);
    expect(tes.every(t => t.source === ADULT.caster && (t.dc ?? null) === null && t.radiusFt === 30 && t.duration === 'until_end_of_zone')).toBe(true);

    // Caster tracking: save-less, damageless, 1-hour duration, affected roster.
    const tracking = runtime.store['Myconid Adult 1._rapport_spores_Myconid_Adult_1'];
    expect(tracking).toMatchObject({ saveDc: null, damage: null, radiusFt: 30, duration: '1 hour' });
    expect(tracking.affectedNames.sort()).toEqual(['Bandit', 'Thug 1']);

    // Honest arm log: no save, duration clause is GM-enforced (no clock).
    const log = armedLog();
    expect(log).toBeTruthy();
    expect(log.description).toMatch(/no save/);
    expect(log.description).toMatch(/Duration 1 hour — GM-enforced/);

    expect(sendSavePrompt).not.toHaveBeenCalled();
    expect(rollExpression).not.toHaveBeenCalled();
    expect(applyDamageToTarget).not.toHaveBeenCalled();
  });

  // MA-1217/MA-1220: sovereign + sprout are disk byte-twins of adult (identical
  // zone object). Twin lane: caster is off the mocked board so nothing is
  // excluded (all 3 granted); source and tracking key derive from caster name.
  for (const twin of TWINS) {
    it(`${twin.caster} confirm: all 3 selectable, te/tracking derive from caster name, zero rolls/damage`, async () => {
      const { getByText } = renderRapportZone(rapportAction(twin), twin.caster);
      await waitFor(() => expect(seenTargets.current.map(t => t.name)).toEqual(['Myconid Adult 1', 'Bandit', 'Thug 1']));
      fireEvent.click(getByText('Confirm'));
      const trackingKey = `${twin.caster}._rapport_spores_${twin.caster.replace(/\s+/g, '_')}`;
      await waitFor(() => expect(runtime.store[trackingKey]).toBeTruthy());
      const tes = runtime.store['campaign.targetEffects'].filter(t => t.effect === 'rapport_spores');
      expect(tes.map(t => t.target).sort()).toEqual(['Bandit', 'Myconid Adult 1', 'Thug 1']);
      expect(tes.every(t => t.source === twin.caster && (t.dc ?? null) === null && t.radiusFt === 30 && t.duration === 'until_end_of_zone')).toBe(true);
      const tracking = runtime.store[trackingKey];
      expect(tracking).toMatchObject({ saveDc: null, damage: null, radiusFt: 30, duration: '1 hour' });
      expect(tracking.affectedNames.sort()).toEqual(['Bandit', 'Myconid Adult 1', 'Thug 1']);
      expect(armedLog().description).toMatch(/no save/);
      expect(armedLog().description).toMatch(/GM-enforced/);
      expect(sendSavePrompt).not.toHaveBeenCalled();
      expect(rollExpression).not.toHaveBeenCalled();
      expect(applyDamageToTarget).not.toHaveBeenCalled();
    });
  }
});
