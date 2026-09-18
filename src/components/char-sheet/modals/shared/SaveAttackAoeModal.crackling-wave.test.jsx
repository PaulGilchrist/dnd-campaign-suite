// MA-0303: Arch-hag Crackling Wave cone picker — DEX DC 22, 5d12 Lightning,
// half on save. The authored "Failure or Success:" tail names cursed +
// can't take Reactions, so SUCCESSFUL saves must land the cursed
// activeCondition (+ {dc, ability, source} meta) and the registered
// no_reactions te (until_end_of_next_turn) drained by ONE rounds:2 clock
// (MA-0073/MA-0087/MA-0146 shapes) with one named Cursed condition log —
// the former fail-only grant seam left these inert. Failed saves keep the
// existing fail legs byte-identical (applySaveFailConditions cursed +
// slowedClauses no_reactions + one fail clock). bothOutcomesClause null
// (every other row) is byte-inert on success.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SaveAttackAoeModal from './SaveAttackAoeModal.jsx';
import monstersData from '../../../../../public/data/monsters.json';

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

const summaryCfg = vi.hoisted(() => ({ dexBonus: 5 }));
vi.mock('../../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({
    creatures: [
      { name: 'Arch-hag 1', type: 'npc', currentHp: 333, maxHp: 333, saveBonuses: {}, resistances: ['Cold', 'Fire', 'Psychic'], immunities: ['Charmed', 'Exhaustion', 'Frightened'] },
      { name: 'Thug 1', type: 'npc', currentHp: 45, maxHp: 45, saveBonuses: { dexterity: summaryCfg.dexBonus }, resistances: [], immunities: [] },
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
import { parseBothOutcomesClause, parseSlowedClauses, extractConditionsFromSaveEffect } from '../../../encounter/MonsterCardHelpers.js';

const HAG = monstersData.find(m => m.index === 'arch-hag');
const WAVE = HAG.actions.find(a => a.name === 'Crackling Wave');

let randomSpy;
function spyRandom(seq) {
  let i = 0;
  randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => seq[Math.min(i++, seq.length - 1)]);
}
afterEach(() => randomSpy?.mockRestore());

function renderWave({ bothOutcomesClause = parseBothOutcomesClause(WAVE.save_effect), saveConditions = extractConditionsFromSaveEffect(WAVE.save_effect), slowedClauses = parseSlowedClauses(WAVE.save_effect) } = {}) {
  return render(
    <SaveAttackAoeModal
      action={WAVE}
      playerStats={{ name: 'Arch-hag 1' }}
      campaignName="test-campaign"
      range={60}
      damage="5d12"
      damageType="Lightning"
      saveType="Dexterity"
      saveDc={22}
      dcSuccess="half"
      titleOverride="60-ft Cone (GM positions tokens; selection advisory)"
      excludeNames={['Arch-hag 1']}
      rangeGateFt={60}
      saveConditions={saveConditions}
      slowedClauses={slowedClauses}
      bothOutcomesClause={bothOutcomesClause}
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
  summaryCfg.dexBonus = 5;
});

describe('MA-0303 Arch-hag Crackling Wave picker', () => {
  it('SUCCESSFUL NPC DEX save grants cursed condition + meta + no_reactions te + ONE rounds:2 clock + Cursed log + half damage', async () => {
    summaryCfg.dexBonus = 5;
    spyRandom([0.99, 0.99]);
    const { getByText } = renderWave();
    await waitFor(() => expect(seenTargets.current.length).toBe(1));
    fireEvent.click(getByText('Confirm'));
    await waitFor(() => expect(addEntry).toHaveBeenCalled());

    expect(runtime.store['Thug 1.activeConditions']).toEqual(['cursed']);
    expect(runtime.store['Thug 1.activeConditionMeta'].cursed).toMatchObject({ dc: 22, ability: 'dex', source: 'Arch-hag 1' });

    const te = (runtime.store['campaign.targetEffects'] || []).find(t => t.effect === 'no_reactions' && t.target === 'Thug 1');
    expect(te).toBeTruthy();
    expect(te).toMatchObject({ source: 'Arch-hag 1', duration: 'until_end_of_next_turn', actionName: 'Crackling Wave' });

    expect(expirations.current).toHaveLength(1);
    expect(expirations.current[0]).toMatchObject({ attackerName: 'Arch-hag 1', targetName: 'Thug 1', rounds: 2 });
    expect(expirations.current[0].effects).toEqual([
      { type: 'remove_target_effect', effectKey: 'no_reactions', source: 'Arch-hag 1', target: 'Thug 1' },
      { type: 'condition', condition: 'cursed' },
    ]);

    const log = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'condition' && e.condition === 'Cursed');
    expect(log).toBeTruthy();
    expect(log.characterName).toBe('Thug 1');
    expect(log.sourceName).toBe('Arch-hag 1');
    expect(log.description).toMatch(/succeeded the Dexterity save \(DC 22\) in Arch-hag 1's Crackling Wave — Cursed and can't take Reactions/);
    expect(log.description).toMatch(/until the end of Arch-hag 1's next turn/);

    expect(applyDamageToTarget).toHaveBeenCalledWith(expect.anything(), 'Thug 1', 5, expect.anything(), expect.anything());
    const row = addEntry.mock.calls.map(c => c[1]).find(e => e.rollType === 'save-damage' && e.saveResult === 'success' && e.finalDamage === 5);
    expect(row).toBeTruthy();
  });

  it('FAILED NPC DEX save keeps fail legs byte-identical: cursed via saveConditions, no_reactions via slowedClauses, one fail clock, zero success-leg writes', async () => {
    summaryCfg.dexBonus = -5;
    spyRandom([0.01, 0.01]);
    const { getByText } = renderWave();
    await waitFor(() => expect(seenTargets.current.length).toBe(1));
    fireEvent.click(getByText('Confirm'));
    await waitFor(() => expect(addEntry).toHaveBeenCalled());

    expect(runtime.store['Thug 1.activeConditions']).toEqual(['cursed']);
    expect(runtime.store['Thug 1.activeConditionMeta'].cursed).toMatchObject({ dc: 22, ability: 'dex', source: 'Arch-hag 1' });

    const tes = runtime.store['campaign.targetEffects'] || [];
    const te = tes.find(t => t.effect === 'no_reactions' && t.target === 'Thug 1');
    expect(te).toBeTruthy();
    expect(te.duration).toBe('until_end_of_next_turn');
    expect(tes.filter(t => t.effect === 'no_reactions' && t.target === 'Thug 1')).toHaveLength(1);

    expect(expirations.current).toHaveLength(1);
    expect(expirations.current[0].rounds).toBe(2);
    expect(expirations.current[0].effects).toEqual([
      { type: 'remove_target_effect', effectKey: 'no_reactions', source: 'Arch-hag 1', target: 'Thug 1' },
    ]);
    expect(expirations.current[0].effects.some(e => e.type === 'condition')).toBe(false);

    const logs = addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'condition');
    expect(logs.some(l => l.condition === 'Cursed' && /failed the Dexterity save/.test(l.description))).toBe(true);
    expect(logs.some(l => l.condition === 'Slowed')).toBe(true);
    expect(logs.some(l => /succeeded/.test(l.description))).toBe(false);

    expect(applyDamageToTarget).toHaveBeenCalledWith(expect.anything(), 'Thug 1', 10, expect.anything(), expect.anything());
  });

  it('guardrail: bothOutcomesClause null (every other row) + successful save grants nothing', async () => {
    summaryCfg.dexBonus = 5;
    spyRandom([0.99, 0.99]);
    const { getByText } = renderWave({ bothOutcomesClause: null, saveConditions: [], slowedClauses: null });
    await waitFor(() => expect(seenTargets.current.length).toBe(1));
    fireEvent.click(getByText('Confirm'));
    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    expect((runtime.store['campaign.targetEffects'] || []).length).toBe(0);
    expect(runtime.store['Thug 1.activeConditions'] ?? null).toBeNull();
    expect(expirations.current).toHaveLength(0);
    expect(addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'condition')).toBeFalsy();
  });
});
