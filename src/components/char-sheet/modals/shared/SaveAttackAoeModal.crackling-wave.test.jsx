// @maintained-by-ai
// MA-0303: Arch-hag Crackling Wave cone picker — DEX DC 22, 5d12 Lightning,
// half on save. The authored "Failure or Success:" tail names cursed +
// can't take Reactions, so SUCCESSFUL saves must land the cursed
// activeCondition (+ {dc, ability, source} meta) and the registered
// no_reactions te (until_end_of_next_turn) drained by ONE rounds:2 clock
// (MA-0073/MA-0087/MA-0146 shapes) with one named Cursed condition log —
// the former fail-only grant seam left these inert. Failed saves keep the
// fail legs (applySaveFailConditions cursed + slowedClauses no_reactions +
// one fail clock whose effects carry NO condition entry). Mixed-confirm
// seam (#206): two Math.random draws per NPC save, targets resolved in
// selection order — one confirm pins both lanes. bothOutcomesClause-null
// inertness (every other row) lives in the demilich-howl / kraken-toxic-ink
// lanes against the same grant path and is not re-pinned here.
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

// Both targets carry dex +5 (component reads the FULL-NAME key 'dexterity');
// the draw pair per target decides success (raw 20 + 5 ≥ DC 22) vs fail.
vi.mock('../../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({
    creatures: [
      { name: 'Arch-hag 1', type: 'npc', currentHp: 333, maxHp: 333, saveBonuses: {}, resistances: ['Cold', 'Fire', 'Psychic'], immunities: ['Charmed', 'Exhaustion', 'Frightened'] },
      { name: 'Thug 1', type: 'npc', currentHp: 45, maxHp: 45, saveBonuses: { dexterity: 5 }, resistances: [], immunities: [] },
      { name: 'Thug 2', type: 'npc', currentHp: 45, maxHp: 45, saveBonuses: { dexterity: 5 }, resistances: [], immunities: [] },
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
vi.mock('./CreatureSelectionModal.jsx', async () => {
  const { createStaticPickerModal } = await import('./SaveAttackAoeModal.test-utils.jsx');
  return { default: createStaticPickerModal(seenTargets, { descClass: 'sp-desc', noteClass: 'sp-note-copy' }) };
});

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

function renderWave() {
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
      saveConditions={extractConditionsFromSaveEffect(WAVE.save_effect)}
      slowedClauses={parseSlowedClauses(WAVE.save_effect)}
      bothOutcomesClause={parseBothOutcomesClause(WAVE.save_effect)}
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

describe('MA-0303 Arch-hag Crackling Wave picker', () => {
  it('mixed confirm resolves both lanes in target order — success: cursed + meta + no_reactions te + ONE rounds:2 clock WITH condition + Cursed log + half damage; fail: fail legs only (no condition in clock, no success writes) + full damage', async () => {
    // Two RNG draws per NPC save, selection order: Thug 1 raw 20 (+5 ≥ DC 22)
    // succeeds, Thug 2 raw 1 (+5 < DC 22) fails.
    spyRandom([0.99, 0.99, 0.01, 0.01]);
    const { getByText } = renderWave();
    await waitFor(() => expect(seenTargets.current.length).toBe(2));
    expect(seenTargets.current.map(t => t.name)).toEqual(['Thug 1', 'Thug 2']);
    fireEvent.click(getByText('Confirm'));
    await waitFor(() => expect(addEntry).toHaveBeenCalled());

    const tesFor = name => (runtime.store['campaign.targetEffects'] || []).filter(t => t.effect === 'no_reactions' && t.target === name);
    const clocksFor = name => expirations.current.filter(e => e.targetName === name);
    const condLogsFor = name => addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'condition' && e.characterName === name);

    // ── Thug 1 SUCCESS leg (the MA-0303 fix): condition + te + one clock + log ──
    expect(runtime.store['Thug 1.activeConditions']).toEqual(['cursed']);
    expect(runtime.store['Thug 1.activeConditionMeta'].cursed).toMatchObject({ dc: 22, ability: 'dex', source: 'Arch-hag 1' });

    expect(tesFor('Thug 1')).toHaveLength(1);
    expect(tesFor('Thug 1')[0]).toMatchObject({ source: 'Arch-hag 1', duration: 'until_end_of_next_turn', actionName: 'Crackling Wave' });

    expect(clocksFor('Thug 1')).toHaveLength(1);
    expect(clocksFor('Thug 1')[0]).toMatchObject({ attackerName: 'Arch-hag 1', rounds: 2 });
    expect(clocksFor('Thug 1')[0].effects).toEqual([
      { type: 'remove_target_effect', effectKey: 'no_reactions', source: 'Arch-hag 1', target: 'Thug 1' },
      { type: 'condition', condition: 'cursed' },
    ]);

    expect(condLogsFor('Thug 1')).toHaveLength(1);
    const successLog = condLogsFor('Thug 1')[0];
    expect(successLog.condition).toBe('Cursed');
    expect(successLog.sourceName).toBe('Arch-hag 1');
    expect(successLog.description).toMatch(/succeeded the Dexterity save \(DC 22\) in Arch-hag 1's Crackling Wave — Cursed and can't take Reactions/);
    expect(successLog.description).toMatch(/until the end of Arch-hag 1's next turn/);

    expect(applyDamageToTarget).toHaveBeenCalledWith(expect.anything(), 'Thug 1', 5, expect.anything(), expect.anything());
    expect(addEntry.mock.calls.map(c => c[1]).find(e => e.rollType === 'save-damage' && e.targetName === 'Thug 1' && e.saveResult === 'success' && e.finalDamage === 5)).toBeTruthy();

    // ── Thug 2 FAIL leg: fail-only grants, byte-identical pre-MA-0303 shape ──
    expect(runtime.store['Thug 2.activeConditions']).toEqual(['cursed']);
    expect(runtime.store['Thug 2.activeConditionMeta'].cursed).toMatchObject({ dc: 22, ability: 'dex', source: 'Arch-hag 1' });

    expect(tesFor('Thug 2')).toHaveLength(1);
    expect(tesFor('Thug 2')[0]).toMatchObject({ source: 'Arch-hag 1', duration: 'until_end_of_next_turn' });

    expect(clocksFor('Thug 2')).toHaveLength(1);
    expect(clocksFor('Thug 2')[0].effects).toEqual([
      { type: 'remove_target_effect', effectKey: 'no_reactions', source: 'Arch-hag 1', target: 'Thug 2' },
    ]);

    expect(condLogsFor('Thug 2').some(l => l.condition === 'Cursed' && /failed the Dexterity save/.test(l.description))).toBe(true);
    expect(condLogsFor('Thug 2').some(l => l.condition === 'Slowed')).toBe(true);

    expect(applyDamageToTarget).toHaveBeenCalledWith(expect.anything(), 'Thug 2', 10, expect.anything(), expect.anything());
    expect(addEntry.mock.calls.map(c => c[1]).find(e => e.rollType === 'save-damage' && e.targetName === 'Thug 2' && e.saveResult === 'failure' && e.finalDamage === 10)).toBeTruthy();

    // ── Cross-lane negatives: neither target leaks into the other's lane ──
    expect(expirations.current).toHaveLength(2);
    expect(condLogsFor('Thug 1').some(l => /failed/.test(l.description) || l.condition === 'Slowed')).toBe(false);
    expect(condLogsFor('Thug 2').some(l => /succeeded/.test(l.description))).toBe(false);
  });
});
