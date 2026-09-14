// MA-0063: Adult Blue Dragon Sand Cloud picker — damageless save+zone row.
// Confirming the 20-ft picker arms the persisting-zone te (`lair_sand_cloud`,
// source=caster, dc) over every covered creature + caster tracking, grants the
// Blinded condition on each FAILED Constitution save (activeConditions +
// activeConditionMeta {dc, ability} so the PC badge can re-save), logs a named
// condition-applied entry, and applies ZERO damage (dc_success none). saveConditions
// empty for every existing consumer → byte-inert (see SaveAttackAoeModal.lair-zone).
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

const ACTION = { name: 'Sand Cloud', save_dc: 15, save_type: 'Constitution', dc_success: 'none', zone: { radius_ft: 20, effect_key: 'lair_sand_cloud', repeat_save: true } };
const ZONE_TE = { effectKey: 'lair_sand_cloud', trackingPrefix: 'lair_sand_cloud', radiusFt: 20, repeatTurnEnd: false, damage: null, duration: 'blinded 1 minute (repeat save ends early; advisory)' };

let randomSpy;
beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  seenTargets.current = [];
  let i = 0;
  // Both thugs fail DC 15 (low d20 + con +1 < 15).
  const seq = [0.05, 0.05, 0.05, 0.05];
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

describe('MA-0063 Sand Cloud picker — damageless save + blinded grant', () => {
  it('arms lair_sand_cloud te over every covered creature + caster tracking', async () => {
    const { getByText } = renderCloud();
    await waitFor(() => expect(seenTargets.current.map(t => t.name)).toEqual(['Thug 1', 'Thug 2']));
    fireEvent.click(getByText('Confirm'));
    await waitFor(() => expect(runtime.store['campaign.targetEffects']).toBeTruthy());
    const te = runtime.store['campaign.targetEffects'];
    expect(te.filter(t => t.effect === 'lair_sand_cloud').map(t => t.target).sort()).toEqual(['Thug 1', 'Thug 2']);
    const cloudTe = te.find(t => t.effect === 'lair_sand_cloud');
    expect(cloudTe.source).toBe('Adult Blue Dragon 1');
    expect(cloudTe.dc).toBe(15);
    expect(runtime.store['Adult Blue Dragon 1._lair_sand_cloud_Adult_Blue_Dragon_1']).toBeTruthy();
  });

  it('grants Blinded on failed saves with dc+ability meta (badge re-save seam)', async () => {
    const { getByText } = renderCloud();
    await waitFor(() => expect(seenTargets.current.length).toBe(2));
    fireEvent.click(getByText('Confirm'));
    await waitFor(() => expect(runtime.store['Thug 1.activeConditions']).toBeTruthy());
    expect(runtime.store['Thug 1.activeConditions']).toContain('blinded');
    const meta = runtime.store['Thug 1.activeConditionMeta'];
    expect(meta.blinded.dc).toBe(15);
    expect(meta.blinded.ability).toBe('con');
    expect(meta.blinded.source).toBe('Adult Blue Dragon 1');
  });

  it('applies ZERO damage (dc_success none) and logs the named condition-applied entry', async () => {
    const { getByText } = renderCloud();
    await waitFor(() => expect(seenTargets.current.length).toBe(2));
    fireEvent.click(getByText('Confirm'));
    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    expect(applyDamageToTarget).not.toHaveBeenCalled();
    const log = addEntry.mock.calls.map(c => c[1]).find(e => (e.description || '').includes('Blinded 1 minute'));
    expect(log).toBeTruthy();
    expect(log.description).toMatch(/failed the Constitution save \(DC 15\)/);
    expect(log.description).toMatch(/NPC turn-end auto-repeat and 1-minute expiry GM-enforced/);
  });
});
