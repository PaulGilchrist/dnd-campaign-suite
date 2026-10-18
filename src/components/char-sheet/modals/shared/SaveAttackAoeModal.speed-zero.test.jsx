// @maintained-by-ai
// MA-0146: Adult White Dragon Freezing Burst sphere picker — CON DC 14,
// 2d6 Cold, 30-ft radius. Owns the two speed_zero gate legs not pinned by
// the ancient-white data lane (freezing-burst-ancient-white.test.jsx covers
// the successful-save half-damage leg at DC 20):
//   1. failed save + clause TRUE side: grants registered speed_zero te
//      (sourced from the dragon, until_end_of_next_turn) + activeCondition
//      speed_zero + ONE rounds:2 clock removing BOTH (MA-0073/MA-0115
//      shape) + one named Speed 0 condition log, and pays FULL damage.
//   2. speedZeroClause null (every other row) with a FAILED save: pays FULL
//      damage (proving the flow ran) yet grants zero speed_zero artifacts.
// Flat spyRandom streams (#231): Thug 1 con:-1 vs DC 14 — nat 1 (0) fails,
// so roll-consumption order cannot flip the outcome.
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
      { name: 'Adult White Dragon 1', type: 'npc', currentHp: 200, maxHp: 200, saveBonuses: {}, resistances: [], immunities: ['Cold'] },
      { name: 'Thug 1', type: 'npc', currentHp: 45, maxHp: 45, saveBonuses: { con: -1 }, resistances: [], immunities: [] },
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

const WHITE = monstersData.find(m => m.index === 'adult-white-dragon');
const BURST = WHITE.legendary_actions.find(a => a.name === 'Freezing Burst');

let randomSpy;
function spyRandom(seq) {
  let i = 0;
  randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => seq[Math.min(i++, seq.length - 1)]);
}
afterEach(() => randomSpy?.mockRestore());

function renderBurst(speedZeroClause = parseSpeedZeroClause(BURST.save_effect)) {
  return render(
    <SaveAttackAoeModal
      action={BURST}
      playerStats={{ name: 'Adult White Dragon 1' }}
      campaignName="test-campaign"
      range={30}
      damage="2d6"
      damageType="Cold"
      saveType="Constitution"
      saveDc={14}
      dcSuccess="half"
      titleOverride="30-ft Radius (GM positions tokens; selection advisory)"
      excludeNames={['Adult White Dragon 1']}
      saveConditions={[]}
      speedZeroClause={speedZeroClause}
      storeLastAttack={false}
      onClose={vi.fn()}
    />
  );
}

function logEntries() {
  return addEntry.mock.calls.map(c => c[1]);
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  seenTargets.current = [];
  expirations.current = [];
});

describe('MA-0146 Adult White Freezing Burst picker speed-zero grant', () => {
  it('failed NPC CON save grants speed_zero te + activeCondition + single rounds:2 clock clearing both + named Speed 0 log, damage FULL', async () => {
    spyRandom([0.01]); // flat stream: every d20 is nat 1; Thug 1 con:-1 → 0 vs DC 14 fails.
    const { getByText } = renderBurst();
    await waitFor(() => expect(seenTargets.current).toHaveLength(1));
    expect(seenTargets.current[0].name).toBe('Thug 1');
    fireEvent.click(getByText('Confirm'));

    // Positive leg: damage resolution ran and a failed save pays the FULL 7.
    await waitFor(() => expect(logEntries().some(e => e.finalDamage === 7)).toBe(true));

    const tes = (runtime.store['campaign.targetEffects'] || []).filter(t => t.effect === 'speed_zero' && t.target === 'Thug 1');
    expect(tes).toHaveLength(1);
    expect(tes[0]).toMatchObject({ source: 'Adult White Dragon 1', duration: 'until_end_of_next_turn', actionName: 'Freezing Burst' });

    expect(runtime.store['Thug 1.activeConditions']).toContain('speed_zero');
    expect(runtime.store['Thug 1.activeConditionMeta'].speed_zero).toMatchObject({ dc: 14, ability: 'con', source: 'Adult White Dragon 1' });

    // ONE clock, rounds:2, removing BOTH the te and the condition.
    const clocks = expirations.current.filter(x => x.targetName === 'Thug 1');
    expect(clocks).toHaveLength(1);
    expect(clocks[0].rounds).toBe(2);
    expect(clocks[0].effects.some(e => e.type === 'remove_target_effect' && e.effectKey === 'speed_zero')).toBe(true);
    expect(clocks[0].effects.some(e => e.type === 'speed_zero')).toBe(true);

    const speedLogs = logEntries().filter(e => e.type === 'condition' && e.condition === 'Speed 0');
    expect(speedLogs).toHaveLength(1);
    expect(speedLogs[0].characterName).toBe('Thug 1');
    expect(speedLogs[0].description).toMatch(/Speed is 0 until the end of Thug 1's next turn/);
  });

  it('speedZeroClause null (every other row) is byte-inert: failed save pays FULL damage but grants zero speed_zero artifacts', async () => {
    spyRandom([0.01]);
    const { getByText } = renderBurst(null);
    await waitFor(() => expect(seenTargets.current).toHaveLength(1));
    fireEvent.click(getByText('Confirm'));

    // Positive leg first (#231): the save/damage flow provably ran — nat-1
    // fail with no clause still pays the full mocked 7.
    await waitFor(() => expect(logEntries().some(e => e.finalDamage === 7)).toBe(true));

    expect((runtime.store['campaign.targetEffects'] || []).filter(t => t.effect === 'speed_zero')).toHaveLength(0);
    expect(runtime.store['Thug 1.activeConditions'] || []).toHaveLength(0);
    expect(expirations.current.filter(x => x.effects?.some(e => e.effectKey === 'speed_zero' || e.type === 'speed_zero'))).toHaveLength(0);
    expect(logEntries().filter(e => e.condition === 'Speed 0')).toHaveLength(0);
  });
});
