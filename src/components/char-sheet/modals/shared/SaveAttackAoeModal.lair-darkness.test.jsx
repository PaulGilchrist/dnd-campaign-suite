// MA-0043: zoneOnly picker seam — Shroud of Darkness (canonical darkness lair
// action, NO save). Confirm writes a zone te per covered creature
// (`lair_darkness`, source=caster, dc null), the caster tracking key
// `_lair_darkness_<caster>` {radiusFt:15, no save}, and an ability_use log
// carrying the advisory light/dispel clause ("dispel only by 2nd-level+
// light — GM-enforced"). ZERO save prompts, ZERO damage writes, ZERO
// lastAttack stamp. Saves stay canonically absent, not silently resolved.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

const savePrompts = vi.hoisted(() => ({ sendSavePrompt: vi.fn() }));
vi.mock('../../../../services/combat/conditions/savePromptService.js', () => ({ sendSavePrompt: savePrompts.sendSavePrompt }));
vi.mock('../../../../services/rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(),
  computeDamageAfterEvasion: vi.fn((raw) => raw),
  computeDamageAfterResistancesWithDetails: vi.fn(({ rawDamage }) => ({ finalDamage: rawDamage })),
  hasEvasionForSave: vi.fn(() => false),
  normalizeSaveType: vi.fn((t) => t),
}));
vi.mock('../../../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({
    creatures: [
      { name: 'Adult Black Dragon 1', type: 'npc', currentHp: 195, maxHp: 195, saveBonuses: {}, resistances: [], immunities: [] },
      { name: 'Thug 1', type: 'npc', currentHp: 45, maxHp: 45, saveBonuses: {}, resistances: [], immunities: [] },
      { name: 'ElderPaladin', type: 'player', currentHp: 60, maxHp: 60, saveBonuses: {}, resistances: [], immunities: [] },
    ],
  })),
  setCombatSummaryCache: vi.fn(),
}));
vi.mock('../../../../hooks/useAllySelection.js', () => ({ getAllyList: vi.fn(() => null) }));
const lastAttacks = vi.hoisted(() => ({ storeSpellLastAttack: vi.fn() }));
vi.mock('../../../../services/automation/common/damageRollback.js', () => ({ storeSpellLastAttack: lastAttacks.storeSpellLastAttack, addTargetResult: vi.fn() }));
vi.mock('../../../../services/rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn(async () => true),
  isDistanceInRange: vi.fn(() => true),
}));

const seen = vi.hoisted(() => ({ targets: [], description: '', note: '' }));
vi.mock('./CreatureSelectionModal.jsx', () => ({
  default: ({ title, targets, description, note, onConfirm, onSkip }) => {
    seen.targets = targets;
    seen.description = description;
    seen.note = note;
    return (
      <div className="sp-overlay">
        <div className="sp-header">{title}</div>
        {targets.map(t => (<label key={t.name} className="secondary-target-row"><input type="checkbox" />{t.name}</label>))}
        <button className="sp-roll-btn" onClick={() => onConfirm(seen.targets.map(t => t.name))} type="button">Confirm</button>
        <button className="sp-dismiss-btn" onClick={onSkip} type="button">Skip</button>
      </div>
    );
  },
}));

import { applyDamageToTarget } from '../../../../services/rules/combat/applyDamage.js';
import { addEntry } from '../../../../services/ui/logService.js';

const ACTION = { name: 'Shroud of Darkness' };
const ZONE_TE = {
  effectKey: 'lair_darkness',
  trackingPrefix: 'lair_darkness',
  radiusFt: 15,
  repeatTurnEnd: false,
  damage: null,
  duration: 'until dismissed or used again (advisory)',
  clause: 'No saving throw (canonical darkness lair action). Darkvision blocking and light-spell overlap — dispel only by 2nd-level+ light — GM-enforced (no light model in this engine).',
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  seen.targets = [];
  seen.description = '';
  seen.note = '';
});

function renderDarkness() {
  return render(
    <SaveAttackAoeModal
      action={ACTION}
      playerStats={{ name: 'Adult Black Dragon 1' }}
      campaignName="test-campaign"
      range={15}
      damage={null}
      damageType={null}
      saveType={null}
      saveDc={null}
      dcSuccess={null}
      titleOverride="15-ft radius (GM positions; selection advisory)"
      excludeNames={['Adult Black Dragon 1']}
      rangeGateFt={null}
      zoneTe={ZONE_TE}
      zoneOnly={true}
      storeLastAttack={false}
      onClose={vi.fn()}
    />
  );
}

describe('MA-0043 zoneOnly darkness picker', () => {
  it('picker shows the 15-ft advisory text, no save/DC wording', async () => {
    renderDarkness();
    await waitFor(() => expect(seen.targets.map(t => t.name)).toEqual(['Thug 1', 'ElderPaladin']));
    expect(seen.description).toMatch(/15-foot.*darkness/i);
    expect(seen.description).toMatch(/No saving throw/i);
    expect(seen.description).not.toMatch(/DC/);
    expect(seen.note).toMatch(/dispel only by 2nd-level\+ light — GM-enforced/);
  });

  it('confirm arms lair_darkness te per covered creature + tracking key, zero saves, zero damage', async () => {
    const { getByText } = renderDarkness();
    await waitFor(() => expect(seen.targets.length).toBe(2));
    fireEvent.click(getByText('Confirm'));
    await waitFor(() => expect(runtime.store['campaign.targetEffects']).toBeTruthy());
    const te = runtime.store['campaign.targetEffects'];
    expect(te.filter(t => t.effect === 'lair_darkness').map(t => t.target).sort()).toEqual(['ElderPaladin', 'Thug 1']);
    const darkTe = te.find(t => t.effect === 'lair_darkness');
    expect(darkTe.source).toBe('Adult Black Dragon 1');
    expect(darkTe.dc).toBeNull();
    expect(darkTe.radiusFt).toBe(15);
    expect(darkTe.duration).toBe('until_end_of_zone');
    expect(savePrompts.sendSavePrompt).not.toHaveBeenCalled();
    expect(applyDamageToTarget).not.toHaveBeenCalled();
    expect(lastAttacks.storeSpellLastAttack).not.toHaveBeenCalled();
    const tracking = runtime.store['Adult Black Dragon 1._lair_darkness_Adult_Black_Dragon_1'];
    expect(tracking.saveDc).toBeNull();
    expect(tracking.radiusFt).toBe(15);
    expect(tracking.repeatTurnEnd).toBe(false);
    expect(tracking.affectedNames.sort()).toEqual(['ElderPaladin', 'Thug 1']);
  });

  it('spell-named ability_use log carries radius, no-save note, and the GM-enforced dispel clause', async () => {
    const { getByText } = renderDarkness();
    await waitFor(() => expect(seen.targets.length).toBe(2));
    fireEvent.click(getByText('Confirm'));
    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    const logs = addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'ability_use');
    expect(logs.length).toBe(1);
    const log = logs[0];
    expect(log.characterName).toBe('Adult Black Dragon 1');
    expect(log.abilityName).toBe('Shroud of Darkness');
    expect(log.description).toMatch(/lair_darkness zone armed \(radius 15 ft, no save\)/);
    expect(log.description).toMatch(/dispel only by 2nd-level\+ light — GM-enforced/);
    expect(log.description).toMatch(/Duration until dismissed or used again \(advisory\) — GM-enforced/);
  });
});
