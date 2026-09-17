// MA-0260: Ancient White Dragon Freezing Burst sphere picker — CON DC 20,
// canonical 4d6 Cold (data drift: save_effect previously said 17/5d6 and
// omitted the Speed-0 clause). Confirms the authored row: canonical
// save_effect text byte-carries "Speed is 0 until the end of the target's
// next turn", arms parseSpeedZeroClause, and the picker grants speed_zero te
// + activeCondition + rounds:2 clock + Speed 0 log on each failed save only;
// successful saves take exact floor-half damage and grant no speed effect.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SaveAttackAoeModal from './SaveAttackAoeModal.jsx';
import monstersData from '../../../../../public/data/monsters.json';

vi.mock('../../../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn((f) => (f ? { total: 7, rolls: [2, 5], modifier: 0 } : null)),
  rollExpressionMaximized: vi.fn((f) => (f ? { total: 7, rolls: [], modifier: 0 } : null)),
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

vi.mock('../../../../services/combat/conditions/savePromptService.js', () => ({
  sendSavePrompt: vi.fn(),
}));
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
      { name: 'Ancient White Dragon 1', type: 'npc', currentHp: 546, maxHp: 546, saveBonuses: {}, resistances: [], immunities: ['Cold'] },
      { name: 'Thug 1', type: 'npc', currentHp: 45, maxHp: 45, saveBonuses: { con: 10 }, resistances: [], immunities: [] },
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

const expirations = vi.hoisted(() => ({ current: [] }));
vi.mock('../../../../services/rules/effects/expirationQueue.js', () => ({
  addExpiration: vi.fn((arg) => { expirations.current.push(arg); }),
}));

const seenTargets = vi.hoisted(() => ({ current: [] }));
vi.mock('./CreatureSelectionModal.jsx', () => ({
  default: ({ title, description, note, targets, onConfirm, onSkip }) => {
    seenTargets.current = targets;
    return (
      <div className="sp-overlay">
        <div className="sp-header">{title}</div>
        <div className="sp-desc">{description}</div>
        <div className="sp-note-copy">{note}</div>
        {targets.map(t => (<label key={t.name} className="secondary-target-row"><input type="checkbox" />{t.name}</label>))}
        <button className="sp-roll-btn" onClick={() => onConfirm(seenTargets.current.map(t => t.name))} type="button">Confirm</button>
        <button className="sp-dismiss-btn" onClick={onSkip} type="button">Skip</button>
      </div>
    );
  },
}));

import { addEntry } from '../../../../services/ui/logService.js';
import { parseSpeedZeroClause } from '../../../encounter/MonsterCardHelpers.js';
import { getEffectDefinition } from '../../../../services/combat/conditions/targetEffectDefinitions.js';

const ANCIENT = monstersData.find(m => m.index === 'ancient-white-dragon');
const BURST = ANCIENT.legendary_actions.find(a => a.name === 'Freezing Burst');

let randomSpy;
function spyRandom(seq) {
  let i = 0;
  randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => seq[Math.min(i++, seq.length - 1)]);
}
afterEach(() => randomSpy?.mockRestore());

function renderBurst() {
  return render(
    <SaveAttackAoeModal
      action={BURST}
      playerStats={{ name: 'Ancient White Dragon 1' }}
      campaignName="test-campaign"
      range={30}
      damage={BURST.damage_dice_primary}
      damageType="Cold"
      saveType="Constitution"
      saveDc={BURST.save_dc}
      dcSuccess="half"
      titleOverride="30-ft Radius (GM positions tokens; selection advisory)"
      excludeNames={['Ancient White Dragon 1']}
      saveConditions={[]}
      speedZeroClause={parseSpeedZeroClause(BURST.save_effect)}
      storeLastAttack={false}
      onClose={vi.fn()}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  seenTargets.current = [];
  expirations.current = [];
});

describe('MA-0260 Ancient White Freezing Burst canonical data', () => {
  it('save_effect rewritten to canonical 4d6 + Speed-0 clause, dc_success default half', () => {
    expect(BURST.damage_dice_primary).toBe('4d6');
    expect(BURST.save_dc).toBe(20);
    expect(BURST.save_type).toBe('Constitution');
    expect(BURST.save_effect).toBe("Failure: 14 (4d6) Cold damage, and the target's Speed is 0 until the end of the target's next turn. Success: Half damage.");
    expect(BURST.save_effect).not.toMatch(/5d6/);
    expect(BURST.dc_success ?? 'half').toBe('half');
    expect(parseSpeedZeroClause(BURST.save_effect)).toEqual({ effect: 'speed_zero' });
    expect(getEffectDefinition('speed_zero')).toBeTruthy();
  });
});

describe('MA-0260 Ancient White Freezing Burst picker speed-zero grant', () => {
  it('failed NPC CON save takes full 4d6 and grants speed_zero te + activeCondition + rounds:2 clock + Speed 0 log', async () => {
    spyRandom([0.01, 0.01, 0.01, 0.01]);
    const { getByText } = renderBurst();
    await waitFor(() => expect(seenTargets.current.length).toBe(1));
    fireEvent.click(getByText('Confirm'));
    await waitFor(() => expect(addEntry).toHaveBeenCalled());

    const tes = runtime.store['campaign.targetEffects'] || [];
    const te = tes.find(t => t.effect === 'speed_zero' && t.target === 'Thug 1');
    expect(te).toBeTruthy();
    expect(te).toMatchObject({ source: 'Ancient White Dragon 1', duration: 'until_end_of_next_turn', actionName: 'Freezing Burst' });

    expect(runtime.store['Thug 1.activeConditions']).toContain('speed_zero');
    const meta = runtime.store['Thug 1.activeConditionMeta'];
    expect(meta.speed_zero).toMatchObject({ dc: 20, ability: 'con', source: 'Ancient White Dragon 1' });

    const clock = expirations.current.find(x => x.rounds === 2 && x.targetName === 'Thug 1');
    expect(clock).toBeTruthy();
    expect(clock.effects.some(e => e.type === 'remove_target_effect' && e.effectKey === 'speed_zero')).toBe(true);
    expect(clock.effects.some(e => e.type === 'speed_zero')).toBe(true);

    const speedLog = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'condition' && e.condition === 'Speed 0');
    expect(speedLog).toBeTruthy();
    expect(speedLog.characterName).toBe('Thug 1');
    expect(speedLog.description).toMatch(/Speed is 0 until the end of Thug 1's next turn/);

    const dmgLog = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'damage' || e.finalDamage != null);
    expect(dmgLog).toBeTruthy();
    expect(dmgLog.finalDamage).toBe(7);
  });

  it('successful NPC CON save takes exact floor-half damage and grants no speed effect', async () => {
    spyRandom([0.99, 0.99, 0.99, 0.99]);
    const { getByText } = renderBurst();
    await waitFor(() => expect(seenTargets.current.length).toBe(1));
    fireEvent.click(getByText('Confirm'));
    await waitFor(() => expect(addEntry).toHaveBeenCalled());

    expect((runtime.store['campaign.targetEffects'] || []).some(t => t.effect === 'speed_zero')).toBe(false);
    expect(runtime.store['Thug 1.activeConditions']).toBeFalsy();
    expect(expirations.current.some(x => x.effects?.some(e => e.effectKey === 'speed_zero' || e.type === 'speed_zero'))).toBe(false);
    expect(addEntry.mock.calls.map(c => c[1]).find(e => e.condition === 'Speed 0')).toBeFalsy();

    const dmgLog = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'damage' || e.finalDamage != null);
    expect(dmgLog).toBeTruthy();
    expect(dmgLog.finalDamage).toBe(3);
  });
});
