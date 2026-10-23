// @maintained-by-ai
// MA-0115 ac-penalty lane: Adult Green Dragon Noxious Miasma sphere picker
// (CON DC 17, 2d6 Poison, dcSuccess none) grants the authored "−2 penalty to
// AC until the end of its next turn" clause as the registered ac_penalty te
// (MA-0073/MA-0087 shape: until_end_of_next_turn + rounds:2 expiry clock)
// with one named AC Penalty condition log per failed NPC save. Successful
// saves and a null acPenaltyClause (every other row) grant nothing.
// Renders the REAL CreatureSelectionModal (no mock copy) — the real component
// makes the picker's confirm button disabled until a target is checked.
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
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
      { name: 'Adult Green Dragon 1', type: 'npc', currentHp: 224, maxHp: 224, saveBonuses: {}, resistances: [], immunities: ['Poison'] },
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

import { addEntry } from '../../../../services/ui/logService.js';

const GREEN = monstersData.find(m => m.index === 'adult-green-dragon');
const MIASMA = GREEN.legendary_actions.find(a => a.name === 'Noxious Miasma');

let randomSpy;
function spyRandom(seq) {
  let i = 0;
  randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => seq[Math.min(i++, seq.length - 1)]);
}
afterEach(() => randomSpy?.mockRestore());

// Literal clause bytes (MA-lane canon: consumers pin literals, never restate
// the parse). Derived from helper law MonsterCardHelpers.js:228 applied to the
// disk save_effect data-locked at owner lane MonsterCardHelpers.ac-penalty.test.js:19,41
// ("−2 penalty to AC" → value:2). Living truth-table: that owner lane.
function renderMiasma(acPenaltyClause = { effect: 'ac_penalty', value: 2 }) {
  return render(
    <SaveAttackAoeModal
      action={MIASMA}
      playerStats={{ name: 'Adult Green Dragon 1' }}
      campaignName="test-campaign"
      range={20}
      damage="2d6"
      damageType="Poison"
      saveType="Constitution"
      saveDc={17}
      dcSuccess="none"
      excludeNames={['Adult Green Dragon 1']}
      saveConditions={[]}
      acPenaltyClause={acPenaltyClause}
      storeLastAttack={false}
      onClose={vi.fn()}
    />
  );
}

// Drive the real picker: exactly one eligible target row (the Thug), tick it,
// then press the action-named confirm button (enabled once a target is chosen).
async function confirmThugTarget() {
  const thugCheckbox = await screen.findByRole('checkbox', { name: /Thug 1/ });
  expect(screen.queryByRole('checkbox', { name: /Adult Green Dragon/ })).toBeNull();
  fireEvent.click(thugCheckbox);
  const confirmBtn = screen.getByRole('button', { name: /Noxious Miasma/ });
  expect(confirmBtn).toBeEnabled();
  fireEvent.click(confirmBtn);
  await waitFor(() => expect(addEntry).toHaveBeenCalled());
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  expirations.current = [];
});

describe('MA-0115 Noxious Miasma ac_penalty grant', () => {
  it('failed NPC CON save grants ac_penalty te (value 2, until_end_of_next_turn) + rounds:2 expiry + named AC Penalty log', async () => {
    spyRandom([0.01, 0.01, 0.01, 0.01]);
    renderMiasma();
    await confirmThugTarget();

    const te = (runtime.store['campaign.targetEffects'] || []).find(t => t.effect === 'ac_penalty' && t.target === 'Thug 1');
    expect(te).toMatchObject({
      source: 'Adult Green Dragon 1',
      duration: 'until_end_of_next_turn',
      value: 2,
      actionName: 'Noxious Miasma',
    });

    expect(expirations.current.some(x =>
      x.rounds === 2
      && x.targetName === 'Thug 1'
      && x.effects.some(e => e.type === 'remove_target_effect' && e.effectKey === 'ac_penalty'))).toBe(true);

    const log = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'condition' && e.condition === 'AC Penalty');
    expect(log).toMatchObject({ characterName: 'Thug 1', sourceName: 'Adult Green Dragon 1' });
    expect(log.description).toMatch(/Thug 1 failed the Constitution save \(DC 17\).*−2 AC until the end of Thug 1's next turn/s);
  });

  it.each([
    // Literal clause bytes — same derivation as renderMiasma above (owner lane:
    // MonsterCardHelpers.ac-penalty.test.js:19).
    ['successful CON save with clause present', [0.99, 0.99, 0.99, 0.99], { effect: 'ac_penalty', value: 2 }],
    ['failed save but null clause (every other row)', [0.01, 0.01, 0.01, 0.01], null],
  ])('grants nothing on %s: no te, no expiry, no AC Penalty log', async (_label, rolls, clause) => {
    spyRandom(rolls);
    renderMiasma(clause);
    await confirmThugTarget();
    expect((runtime.store['campaign.targetEffects'] || []).some(t => t.effect === 'ac_penalty')).toBe(false);
    expect(expirations.current.some(x => x.effects?.some(e => e.effectKey === 'ac_penalty'))).toBe(false);
    expect(addEntry.mock.calls.map(c => c[1]).find(e => e.condition === 'AC Penalty')).toBeFalsy();
  });
});
