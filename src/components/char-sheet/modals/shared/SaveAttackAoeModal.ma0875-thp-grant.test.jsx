// @maintained-by-ai
// MA-0875: Gnoll Demoniac "Hunger of Yeenoghu" Cube picker THP grant lane.
// Unique seam: SaveAttackAoeModal armed by the tempHpGrant prop (threaded by
// MonsterCardModal.ma0875-cube-shape) must grant the ATTACKER 10 THP via the
// REAL tempHpService + one `temp_hp_granted` log per failed save, never on
// successful saves, and stay byte-inert when the prop is null (every other
// picker row). replace-if-larger VALUE semantics are owned by
// tempHpBuffHandler.bolsteringTreats.test.js; the inline block-save twin seam
// and its stacking cases live in saveProcessing.ma0875-thp-grant.test.js;
// clause parsing + data pins live in MonsterCardHelpers.ma0875-thp-clause.
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
vi.mock('./CreatureSelectionModal.jsx', async () => {
  const { createStaticPickerModal } = await import('./SaveAttackAoeModal.test-utils.jsx');
  return { default: createStaticPickerModal(seenTargets) };
});

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

// Render the picker, wait for the one eligible target, confirm, wait for logs.
async function pick(tempHpGrant) {
  const { getByText } = renderHunger(tempHpGrant);
  await waitFor(() => expect(seenTargets.current.length).toBe(1));
  fireEvent.click(getByText('Confirm'));
  await waitFor(() => expect(addEntry).toHaveBeenCalled());
}

const grantLogs = () => addEntry.mock.calls.map(c => c[1]).filter(e => e.automationType === 'temp_hp_granted');
const banditDamage = () => addEntry.mock.calls.map(c => c[1]).find(e => e.rollType === 'save-damage' && e.targetName === 'Bandit 1');

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  seenTargets.current = [];
  csFixture.dexBonus = -19;
});

describe('MA-0875 Hunger of Yeenoghu picker THP grant', () => {
  it('failed NPC Dex save: attacker granted 10 THP + one temp_hp_granted log; target takes FULL damage and never receives the THP', async () => {
    spyRandom([0.01, 0.01, 0.01, 0.01]);
    await pick({ tempHp: 10 });

    expect(runtime.store[`${GNOLL}.tempHp`]).toBe(10);
    expect(runtime.store['Bandit 1.tempHp']).toBeUndefined(); // attacker-side clause

    const grants = grantLogs();
    expect(grants).toHaveLength(1);
    expect(grants[0]).toMatchObject({ characterName: GNOLL, abilityName: 'Hunger of Yeenoghu' });
    expect(grants[0].description).toMatch(/gains 10 temporary hit points \(now 10 THP, replace-if-larger\)/);

    const dmg = banditDamage();
    expect(dmg.saveResult).toBe('failure');
    expect(dmg.finalDamage).toBe(26);
  });

  it('successful NPC Dex save: ZERO THP grant, zero grant log, half damage still lands (flow ran)', async () => {
    csFixture.dexBonus = 19;
    spyRandom([0.01, 0.01, 0.01, 0.01]);
    await pick({ tempHp: 10 });

    expect(runtime.store[`${GNOLL}.tempHp`]).toBeUndefined();
    expect(grantLogs()).toHaveLength(0);
    const dmg = banditDamage();
    expect(dmg.saveResult).toBe('success');
    expect(dmg.finalDamage).toBe(13);
  });

  it('null tempHpGrant (every other picker row) is inert on a FAILED save: no THP, no grant log — but the save and damage still resolve', async () => {
    spyRandom([0.01, 0.01, 0.01, 0.01]);
    await pick(null);

    expect(runtime.store[`${GNOLL}.tempHp`]).toBeUndefined();
    expect(grantLogs()).toHaveLength(0);
    // Non-vacuous: the failed-save path genuinely ran without the grant clause.
    const dmg = banditDamage();
    expect(dmg.saveResult).toBe('failure');
    expect(dmg.finalDamage).toBe(26);
  });
});
