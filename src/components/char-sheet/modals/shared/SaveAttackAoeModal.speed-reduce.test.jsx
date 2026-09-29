// MA-1530: Steam Mephit Steam Breath cone picker — CON DC 10, 2d4 Fire,
// 15-ft Cone. Confirms the picker grants the authored fail clause
// "the target's Speed decreases by 10 feet until the end of the mephit's
// next turn" on each NPC failed save: registered speed_reduction te
// (sourced from the mephit, value 10, until_end_of_next_turn) + ONE
// caster-anchored expiry clock removing it at the mephit's next turn-start
// (MA-0995/MA-1147 javelin byte-shape twin; RAW end-of-turn anchor is the
// accepted advisory residual) + one "Speed Reduced −10 ft" condition log.
// Repeat breaths REPLACE not stack (registerTargetEffect dedupes per
// target+effect+source). Successful saves grant nothing (half damage only,
// §96 floor); speedReduceClause null (every other row) is byte-inert.
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
      { name: 'Steam Mephit 1', type: 'npc', currentHp: 17, maxHp: 17, saveBonuses: {}, resistances: [], immunities: ['Fire', 'Poison'] },
      { name: 'Bandit 1', type: 'npc', currentHp: 999, maxHp: 999, saveBonuses: { constitution: -10 }, resistances: [], immunities: [] },
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
import { parseSpeedReduceClause } from '../../../encounter/MonsterCardHelpers.js';

const STEAM = monstersData.find(m => m.index === 'steam-mephit');
const BREATH = STEAM.actions.find(a => a.name === 'Steam Breath');

let randomSpy;
function spyRandom(seq) {
  let i = 0;
  randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => seq[Math.min(i++, seq.length - 1)]);
}
afterEach(() => randomSpy?.mockRestore());

function renderBreath(speedReduceClause = parseSpeedReduceClause(BREATH.save_effect)) {
  return render(
    <SaveAttackAoeModal
      action={BREATH}
      playerStats={{ name: 'Steam Mephit 1' }}
      campaignName="test-campaign"
      range={15}
      damage="2d4"
      damageType="Fire"
      saveType="Constitution"
      saveDc={10}
      dcSuccess="half"
      titleOverride="15-ft Cone (GM positions tokens; selection advisory)"
      excludeNames={['Steam Mephit 1']}
      saveConditions={[]}
      speedReduceClause={speedReduceClause}
      storeLastAttack={false}
      onClose={vi.fn()}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[`${k}`]);
  seenTargets.current = [];
  expirations.current = [];
});

describe('MA-1530 Steam Mephit Steam Breath picker speed_reduction grant', () => {
  it('failed NPC CON save grants speed_reduction te value 10 + ONE caster-anchored clock + "Speed Reduced −10 ft" log; damage paid FULL', async () => {
    spyRandom([0.01, 0.01, 0.01, 0.01]);
    const { getByText } = renderBreath();
    await waitFor(() => expect(seenTargets.current.length).toBe(1));
    fireEvent.click(getByText('Confirm'));
    await waitFor(() => expect(addEntry).toHaveBeenCalled());

    const tes = runtime.store['campaign.targetEffects'] || [];
    const te = tes.find(t => t.effect === 'speed_reduction' && t.target === 'Bandit 1');
    expect(te).toBeTruthy();
    expect(te).toMatchObject({ source: 'Steam Mephit 1', duration: 'until_end_of_next_turn', value: 10, actionName: 'Steam Breath' });

    const clocks = expirations.current.filter(x => x.effects?.some(e => e.type === 'remove_target_effect' && e.effectKey === 'speed_reduction'));
    expect(clocks.length).toBe(1);
    expect(clocks[0]).toMatchObject({
      attackerName: 'Steam Mephit 1',
      targetName: 'Bandit 1',
      campaignName: 'test-campaign',
      expireOnCreatureName: 'Steam Mephit 1',
    });
    expect(clocks[0].rounds).toBeUndefined();

    const log = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'condition' && e.condition === 'Speed Reduced');
    expect(log).toBeTruthy();
    expect(log.characterName).toBe('Bandit 1');
    expect(log.sourceName).toBe('Steam Mephit 1');
    expect(log.sourceAbility).toBe('Steam Breath');
    expect(log.description).toMatch(/failed the Constitution save \(DC 10\) in Steam Mephit 1's Steam Breath — Speed Reduced \u221210 ft until the end of Steam Mephit 1's next turn/);

    const dmg = addEntry.mock.calls.map(c => c[1]).find(e => e.rollType === 'save-damage');
    expect(dmg).toBeTruthy();
    expect(dmg.finalDamage).toBe(7);
    expect(dmg.saveResult).toBe('failure');
  });

  it('successful NPC CON save pays HALF (floor 7/2 = 3 §96) and grants NOTHING — no te, no clock, no Speed Reduced log', async () => {
    spyRandom([0.99, 0.99, 0.99, 0.99]);
    const { getByText } = renderBreath();
    await waitFor(() => expect(seenTargets.current.length).toBe(1));
    fireEvent.click(getByText('Confirm'));
    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    expect((runtime.store['campaign.targetEffects'] || []).some(t => t.effect === 'speed_reduction')).toBe(false);
    expect(expirations.current.some(x => x.effects?.some(e => e.effectKey === 'speed_reduction'))).toBe(false);
    expect(addEntry.mock.calls.map(c => c[1]).find(e => e.condition === 'Speed Reduced')).toBeFalsy();
    const dmg = addEntry.mock.calls.map(c => c[1]).find(e => e.rollType === 'save-damage');
    expect(dmg.finalDamage).toBe(3);
    expect(dmg.saveResult).toBe('success');
  });

  it('repeat breaths REPLACE not stack — second failed save keeps exactly ONE te at value 10 (consumer accumulates only across distinct sources)', async () => {
    spyRandom([0.01, 0.01, 0.01, 0.01, 0.01, 0.01]);
    const first = renderBreath();
    await waitFor(() => expect(seenTargets.current.length).toBe(1));
    fireEvent.click(first.getByText('Confirm'));
    await waitFor(() => expect(addEntry).toHaveBeenCalled());

    const second = renderBreath();
    await waitFor(() => expect(seenTargets.current.length).toBe(1));
    fireEvent.click(second.getByText('Confirm'));
    await waitFor(() => expect(runtime.store['campaign.targetEffects'].filter(t => t.effect === 'speed_reduction').length).toBe(1));

    const tes = runtime.store['campaign.targetEffects'].filter(t => t.effect === 'speed_reduction');
    expect(tes.length).toBe(1);
    expect(tes[0].target).toBe('Bandit 1');
    expect(tes[0].source).toBe('Steam Mephit 1');
    expect(tes[0].value).toBe(10);
  });

  it('speedReduceClause null (every other row) is byte-inert: failed save grants no speed_reduction', async () => {
    spyRandom([0.01, 0.01, 0.01, 0.01]);
    const { getByText } = renderBreath(null);
    await waitFor(() => expect(seenTargets.current.length).toBe(1));
    fireEvent.click(getByText('Confirm'));
    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    expect((runtime.store['campaign.targetEffects'] || []).some(t => t.effect === 'speed_reduction')).toBe(false);
    expect(expirations.current.some(x => x.effects?.some(e => e.effectKey === 'speed_reduction'))).toBe(false);
    expect(addEntry.mock.calls.map(c => c[1]).find(e => e.condition === 'Speed Reduced')).toBeFalsy();
  });
});
