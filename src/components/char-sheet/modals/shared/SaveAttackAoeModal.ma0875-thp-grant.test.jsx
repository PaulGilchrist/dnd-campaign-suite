// MA-0875: Gnoll Demoniac "Hunger of Yeenoghu" Cube picker THP grant.
// After the Cube row routes the picker (MonsterCardModal.ma0875-cube-shape),
// each NPC failed save must ALSO grant the ATTACKER 10 temporary hit points
// via tempHpService replace-if-larger (MA-0275 Fortify monster THP producer
// twin — self-grant default, "creature of its choice" chooser GM-enforced)
// + one `temp_hp_granted` automation log. Successful saves grant ZERO THP.
// The null tempHpGrant prop (every other picker row) is byte-inert.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SaveAttackAoeModal from './SaveAttackAoeModal.jsx';
import monstersData from '../../../../../public/data/monsters.json';

vi.mock('../../../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn((f) => (f ? { total: 26, rolls: [5, 6, 1, 5, 4, 4, 1, 1], modifier: 0 } : null)),
  rollExpressionMaximized: vi.fn((f) => (f ? { total: 26, rolls: [], modifier: 0 } : null)),
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

const csFixture = vi.hoisted(() => ({ dexBonus: -19 }));
vi.mock('../../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({
    creatures: [
      { name: 'Gnoll Demoniac 1', type: 'npc', currentHp: 135, maxHp: 135, saveBonuses: {}, resistances: [], immunities: [] },
      { name: 'Bandit 1', type: 'npc', currentHp: 999, maxHp: 999, saveBonuses: { dexterity: csFixture.dexBonus }, resistances: [], immunities: [] },
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
vi.mock('../../../../services/rules/features/paralyzingBreathService.js', () => ({ stageParalysisTargets: vi.fn() }));
vi.mock('../../../../services/rules/features/weakeningBreathService.js', () => ({ grantWeakeningBreath: vi.fn() }));

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

import { addEntry } from '../../../../services/ui/logService.js';

const GNOLL = 'Gnoll Demoniac 1';
const hungerRow = () => monstersData.find(m => m.name === 'Gnoll Demoniac').actions.find(a => a.name === 'Hunger of Yeenoghu');

let randomSpy;
function spyRandom(seq) {
  let i = 0;
  randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => seq[Math.min(i++, seq.length - 1)]);
}
afterEach(() => randomSpy?.mockRestore());

function renderHunger(tempHpGrant = { tempHp: 10 }) {
  return render(
    <SaveAttackAoeModal
      action={hungerRow()}
      playerStats={{ name: GNOLL }}
      campaignName="test-campaign"
      range={30}
      damage="8d6"
      damageType="Necrotic"
      saveType="Dexterity"
      saveDc={14}
      dcSuccess="half"
      titleOverride="30-ft Cube — modeled as radius (GM positions tokens; selection advisory)"
      excludeNames={[GNOLL]}
      rangeGateFt={null}
      saveConditions={[]}
      tempHpGrant={tempHpGrant}
      storeLastAttack={false}
      onClose={vi.fn()}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  seenTargets.current = [];
  csFixture.dexBonus = -19;
});

describe('MA-0875 Hunger of Yeenoghu picker THP grant', () => {
  it('failed NPC Dex save: attacker gains 10 tempHp (replace-if-larger) + temp_hp_granted log; Bandit takes FULL 26', async () => {
    spyRandom([0.01, 0.01, 0.01, 0.01]);
    const { getByText } = renderHunger();
    await waitFor(() => expect(seenTargets.current.length).toBe(1));
    fireEvent.click(getByText('Confirm'));
    await waitFor(() => expect(addEntry).toHaveBeenCalled());

    expect(runtime.store[`${GNOLL}.tempHp`]).toBe(10);
    const log = addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'temp_hp_granted');
    expect(log).toBeTruthy();
    expect(log.characterName).toBe(GNOLL);
    expect(log.abilityName).toBe('Hunger of Yeenoghu');
    expect(log.description).toMatch(/gains 10 temporary hit points/);
    expect(log.description).toMatch(/self-grant default/);
    const dmg = addEntry.mock.calls.map(c => c[1]).find(e => e.rollType === 'save-damage' && e.targetName === 'Bandit 1');
    expect(dmg.finalDamage).toBe(26);
    expect(dmg.saveResult).toBe('failure');
    // THP never lands on the save TARGET (it is an attacker-side clause).
    expect(runtime.store['Bandit 1.tempHp']).toBeUndefined();
  });

  it('replace-if-larger: a 15-THP standing pool is NOT lowered by a 10-THP grant; log prints the held value', async () => {
    runtime.store[`${GNOLL}.tempHp`] = 15;
    spyRandom([0.01, 0.01, 0.01, 0.01]);
    const { getByText } = renderHunger();
    await waitFor(() => expect(seenTargets.current.length).toBe(1));
    fireEvent.click(getByText('Confirm'));
    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    expect(runtime.store[`${GNOLL}.tempHp`]).toBe(15);
    const log = addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'temp_hp_granted');
    expect(log.description).toMatch(/now 15 THP/);
  });

  it('successful NPC Dex save: ZERO THP grant, zero grant log', async () => {
    csFixture.dexBonus = 19;
    spyRandom([0.01, 0.01, 0.01, 0.01]);
    const { getByText } = renderHunger();
    await waitFor(() => expect(seenTargets.current.length).toBe(1));
    fireEvent.click(getByText('Confirm'));
    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    expect(runtime.store[`${GNOLL}.tempHp`]).toBeUndefined();
    expect(addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'temp_hp_granted')).toBeFalsy();
    const dmg = addEntry.mock.calls.map(c => c[1]).find(e => e.rollType === 'save-damage' && e.targetName === 'Bandit 1');
    expect(dmg.finalDamage).toBe(13);
    expect(dmg.saveResult).toBe('success');
  });

  it('null tempHpGrant (every other picker row) is byte-inert: failed save grants no THP', async () => {
    spyRandom([0.01, 0.01, 0.01, 0.01]);
    const { getByText } = renderHunger(null);
    await waitFor(() => expect(seenTargets.current.length).toBe(1));
    fireEvent.click(getByText('Confirm'));
    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    expect(runtime.store[`${GNOLL}.tempHp`]).toBeUndefined();
    expect(addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'temp_hp_granted')).toBeFalsy();
  });
});
