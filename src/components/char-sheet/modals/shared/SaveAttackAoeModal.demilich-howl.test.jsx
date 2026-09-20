// MA-0590: Demilich Howl emanation picker — CON DC 19, 20d6 Psychic, half on
// save. The DATA-marked save_effect ("Failure or Success: The target has the
// Frightened condition …") arms parseBothOutcomesClause, so SUCCESSFUL saves
// must land the Frightened activeCondition (+ {dc, ability, source} meta) via
// the MA-0303 grantBothOutcomesClause seam with ONE rounds:2 clock + named
// Frightened condition log — the former fail-only picker seam left successes
// with half damage and NO condition. FAILED saves keep the MA-0063 fail legs
// byte-identical (Frightened via saveConditions + full damage). Both victims
// adjudicated in one picker pass (the former single-target degrade never
// reached the picker at all).
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SaveAttackAoeModal from './SaveAttackAoeModal.jsx';
import monstersData from '../../../../../public/data/monsters.json';

vi.mock('../../../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn((f) => (f ? { total: 10, rolls: [], modifier: 0 } : null)),
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

const summaryCfg = vi.hoisted(() => ({ b1Con: -19, b2Con: 19 }));
vi.mock('../../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({
    creatures: [
      { name: 'Demilich 1', type: 'npc', currentHp: 180, maxHp: 180, saveBonuses: {}, resistances: [], immunities: ['Charmed', 'Exhaustion', 'Frightened'] },
      { name: 'Bandit 1', type: 'npc', currentHp: 999, maxHp: 999, saveBonuses: { constitution: summaryCfg.b1Con }, resistances: [], immunities: [] },
      { name: 'Bandit 2', type: 'npc', currentHp: 999, maxHp: 999, saveBonuses: { constitution: summaryCfg.b2Con }, resistances: [], immunities: [] },
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

import { applyDamageToTarget } from '../../../../services/rules/combat/applyDamage.js';
import { addEntry } from '../../../../services/ui/logService.js';
import { parseBothOutcomesClause, extractConditionsFromSaveEffect } from '../../../encounter/MonsterCardHelpers.js';

const HOWL = monstersData.find(m => m.index === 'demilich').actions.find(a => a.name === 'Howl');

let randomSpy;
function spyRandom(seq) {
  let i = 0;
  randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => seq[Math.min(i++, seq.length - 1)]);
}
afterEach(() => randomSpy?.mockRestore());

function renderHowl({ bothOutcomesClause = parseBothOutcomesClause(HOWL.save_effect), saveConditions = extractConditionsFromSaveEffect(HOWL.save_effect) } = {}) {
  return render(
    <SaveAttackAoeModal
      action={HOWL}
      playerStats={{ name: 'Demilich 1' }}
      campaignName="test-campaign"
      range={30}
      damage="20d6"
      damageType="Psychic"
      saveType="Constitution"
      saveDc={19}
      dcSuccess="half"
      titleOverride="30-ft Radius (GM positions tokens; selection advisory)"
      excludeNames={['Demilich 1']}
      rangeGateFt={30}
      saveConditions={saveConditions}
      bothOutcomesClause={bothOutcomesClause}
      conditionDurationNote="until the start of the demilich's next turn (GM-enforced)"
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
  summaryCfg.b1Con = -19;
  summaryCfg.b2Con = 19;
});

describe('MA-0590 Demilich Howl emanation picker', () => {
  it('both victims adjudicate: FAIL pays full 20d6 + Frightened (fail leg), SUCCESS pays half + Frightened (both-outcomes success leg)', async () => {
    spyRandom([0.01, 0.99]);
    const { getByText } = renderHowl();
    await waitFor(() => expect(seenTargets.current.length).toBe(2));
    fireEvent.click(getByText('Confirm'));
    await waitFor(() => expect(addEntry).toHaveBeenCalled());

    const logs = addEntry.mock.calls.map(c => c[1]);

    // FAIL (Bandit 1, con -19): full damage via MA-0063 fail legs + Frightened grant.
    expect(runtime.store['Bandit 1.activeConditions']).toEqual(['frightened']);
    expect(runtime.store['Bandit 1.activeConditionMeta'].frightened).toMatchObject({ dc: 19, ability: 'con', source: 'Demilich 1' });
    expect(applyDamageToTarget).toHaveBeenCalledWith(expect.anything(), 'Bandit 1', 10, expect.anything(), expect.anything());
    const failRow = logs.find(e => e.rollType === 'save-damage' && e.targetName === 'Bandit 1' && e.saveResult === 'failure' && e.finalDamage === 10);
    expect(failRow).toBeTruthy();
    expect(logs.some(l => l.type === 'condition' && l.characterName === 'Bandit 1' && l.condition === 'Frightened' && /failed the Constitution save \(DC 19\)/.test(l.description))).toBe(true);

    // SUCCESS (Bandit 2, con +19): half damage AND Frightened via the success-leg grant.
    expect(runtime.store['Bandit 2.activeConditions']).toEqual(['frightened']);
    expect(runtime.store['Bandit 2.activeConditionMeta'].frightened).toMatchObject({ dc: 19, ability: 'con', source: 'Demilich 1' });
    expect(applyDamageToTarget).toHaveBeenCalledWith(expect.anything(), 'Bandit 2', 5, expect.anything(), expect.anything());
    const halfRow = logs.find(e => e.rollType === 'save-damage' && e.targetName === 'Bandit 2' && e.saveResult === 'success' && e.finalDamage === 5);
    expect(halfRow).toBeTruthy();
    const successCond = logs.find(l => l.type === 'condition' && l.characterName === 'Bandit 2' && l.condition === 'Frightened');
    expect(successCond).toBeTruthy();
    expect(successCond.description).toMatch(/succeeded the Constitution save \(DC 19\) in Demilich 1's Howl — Frightened/);
    expect(successCond.description).toMatch(/Failure or Success clause/);

    // ONE expiry clock per success victim (no te on this row — condition only).
    const successClocks = expirations.current.filter(e => e.targetName === 'Bandit 2');
    expect(successClocks).toHaveLength(1);
    expect(successClocks[0]).toMatchObject({ attackerName: 'Demilich 1', rounds: 2 });
    expect(successClocks[0].effects).toEqual([{ type: 'condition', condition: 'frightened' }]);
    expect(expirations.current.filter(e => e.targetName === 'Bandit 1')).toHaveLength(0);
  });

  it('guardrail: bothOutcomesClause null + successful save grants NO condition (half damage only)', async () => {
    spyRandom([0.99, 0.99]);
    const { getByText } = renderHowl({ bothOutcomesClause: null, saveConditions: [] });
    await waitFor(() => expect(seenTargets.current.length).toBe(2));
    fireEvent.click(getByText('Confirm'));
    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    expect(runtime.store['Bandit 1.activeConditions'] ?? null).toBeNull();
    expect(runtime.store['Bandit 2.activeConditions'] ?? null).toBeNull();
    expect(expirations.current).toHaveLength(0);
    expect(addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'condition')).toHaveLength(0);
  });
});
