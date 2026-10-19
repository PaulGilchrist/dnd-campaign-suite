// @maintained-by-ai
// MA-0023 modal lane: Aboleth Psychic Drain press lifecycle (MA-0018/19/21 fold).
// Owned HERE: the legendary chip press end-to-end — any-ally prerequisite gate runs
// BEFORE the spend (unmet presses refuse: popup + psychic_drain_refused log, zero
// spend, zero roll, zero heal; provenance of the condition is read live off the
// runtime store), a met press spends exactly 1, lands the delegated Consume Memories
// save on the armed target through the untouched MA-0019 seam, and self-heals the
// aboleth via the canonical applyHealingToTarget choke point with hp_change naming
// Psychic Drain. Exact log counts across the whole lifecycle.
// Owned ELSEWHERE (cited, not restated): Psychic Drain disk row + delegates_to
// resolution + delegate attack name — monsterLegendaryUses.test.js:230-248;
// any-ally gate truth table incl. provenance-fails and non-target ally scan,
// refusal popup/log builder bytes, self-heal roll + real-applyHealingToTarget
// clamp — monsterLegendaryUses.test.js:251-353; Consume Memories save chip byte
// shape + consumeMemoriesClause producer flag + refused-log fields —
// MonsterCardModal.consume-memories.test.jsx:108-161; failed-save consumer —
// saveProcessing.consumeMemories.test.js; damage math — applyDamage.save-full.test.js.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';

// Deterministic 1d10 self-heal byte (total 7); the roll range itself is owned by
// monsterLegendaryUses.test.js:296.
vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 7, rolls: [7], modifier: 0 })),
}));
vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
// applyHealingToTarget persists combatSummary via storage.set → fetch; stub guards the network.
vi.mock('../../services/ui/storage.js', () => ({ default: { set: vi.fn(() => Promise.resolve()), get: vi.fn(() => Promise.resolve(null)) } }));
vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });
  const rollSavingThrow = vi.fn();
  const rollAttack = vi.fn();
  return { default: vi.fn(() => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: _setPopupHtml,
    rollAttack, rollDamage: vi.fn(), rollAbilityCheck: vi.fn(),
    rollSavingThrow, rollSkillCheck: vi.fn(), rollInitiative: vi.fn(), quickRollPlayerSave: vi.fn(),
  })), rollSavingThrow, rollAttack, _setPopupHtml, _resetPopup: () => { _popupHtml = null; } };
});
const ctx = vi.hoisted(() => ({ value: { round: 1, activeCreatureName: 'Thug 1', creatures: [] } }));
// getCombatContext fires from mount + the gate scan; real impl fetches.
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  extractDamageTypes: vi.fn(() => []),
  formatDamageTypes: vi.fn((t) => (t || []).join(', ') || ''),
  getTargetFromAttacker: vi.fn(() => null),
  getResistanceNotice: vi.fn(() => null),
  findCreatureByName: vi.fn(({ creatures }, name) => (creatures || []).find(c => c.name === name) || null),
  getCombatContext: vi.fn(() => Promise.resolve(ctx.value)),
}));

const runtime = vi.hoisted(() => {
  const store = {};
  return {
    store,
    setRuntimeValue: vi.fn((k, p, v) => { store[`${k}.${p}`] = v; return Promise.resolve(); }),
    getRuntimeValue: vi.fn((k, p) => store[`${k}.${p}`] ?? null),
    useRuntimeValue: vi.fn((k, p) => store[`${k}.${p}`] ?? null),
  };
});
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: runtime.useRuntimeValue,
  setRuntimeValue: runtime.setRuntimeValue,
  getRuntimeValue: runtime.getRuntimeValue,
}));

import { addEntry } from '../../services/ui/logService.js';
import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
const setPopupHtml = useLoggedDiceRoll._setPopupHtml;
const resetPopup = useLoggedDiceRoll._resetPopup;
const rollSavingThrow = useLoggedDiceRoll.rollSavingThrow;
const rollAttack = useLoggedDiceRoll.rollAttack;

const AB = monstersData.find(m => m.name === 'Aboleth');
const CREATURES = [
  { name: 'Aboleth 1', type: 'npc', targetName: 'TestPC', currentHp: 140, maxHp: 150, ac: 17, conditions: [] },
  { name: 'Thug 1', type: 'npc', currentHp: 32, maxHp: 32, conditions: [] },
  { name: 'TestPC', type: 'player', currentHp: 41, maxHp: 41, conditions: [] },
];

function renderAboleth() {
  ctx.value = { round: 1, activeCreatureName: 'Thug 1', creatures: CREATURES };
  runtime.store['Aboleth 1.monsterLegendaryUses'] = { max: 3, used: 0 };
  render(<MonsterCardModal {...makeProps(
    makeMonster({ name: 'Aboleth', actions: AB.actions.filter(a => ['Tentacle', 'Consume Memories'].includes(a.name)), legendary_actions: AB.legendary_actions }),
    { creatureName: 'Aboleth 1', creatures: CREATURES }
  )} />);
}

function drainLink() {
  return Array.from(document.querySelectorAll('.mc-dice-link-legendary')).find(el => el.closest('div')?.textContent.includes('Psychic Drain')) || null;
}

const refusals = () => addEntry.mock.calls.map(c => c[1]).filter(e => e.automationType === 'psychic_drain_refused');

describe('MA-0023 Psychic Drain press lifecycle: refuse → refuse (provenance) → resolve', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPopup();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    CREATURES[0].currentHp = 140;
  });

  it('unmet presses burn nothing; met press spends 1, delegated save fires, 1d10 heal lands', async () => {
    renderAboleth();
    const link = drainLink();
    expect(link).toBeTruthy();

    // Press 1 — no creature Charmed/Grappled: popup + refused log, ZERO spend.
    fireEvent.click(link);
    await waitFor(() => expect(refusals().length).toBe(1));
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Prerequisite Not Met');
    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(runtime.store['Aboleth 1.monsterLegendaryUses']).toEqual({ max: 3, used: 0 });

    // Press 2 — TestPC Charmed but attributed to another source (MA-0019 provenance): still refused.
    runtime.store['TestPC.activeConditions'] = ['charmed'];
    runtime.store['TestPC.activeConditionMeta'] = { charmed: { dc: 15, source: 'Some Hag' } };
    fireEvent.click(link);
    await waitFor(() => expect(refusals().length).toBe(2));
    expect(addEntry).toHaveBeenCalledTimes(2);
    expect(setPopupHtml).toHaveBeenCalledTimes(2);
    expect(runtime.store['Aboleth 1.monsterLegendaryUses']).toEqual({ max: 3, used: 0 });
    expect(rollSavingThrow).not.toHaveBeenCalled();

    // Press 3 — MA-0018 tentacle-grapple provenance opens the gate.
    runtime.store['TestPC.activeConditions'] = ['grappled'];
    runtime.store['TestPC.activeConditionMeta'] = { grappled: { dc: 14, source: 'Aboleth 1' } };
    fireEvent.click(link);
    await waitFor(() => expect(runtime.store['Aboleth 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));

    // Delegated Consume Memories save lands on the armed target (shape owned by
    // MonsterCardModal.consume-memories.test.jsx:124-140 — here only landing + count).
    await waitFor(() => expect(rollSavingThrow).toHaveBeenCalledTimes(1));
    expect(rollSavingThrow.mock.calls[0][2].targetName).toBe('TestPC');
    expect(rollSavingThrow.mock.calls[0][2].autoDamageFormula).toBe('3d6');

    // Expend log names the delegate, and the self-heal lands once on the aboleth
    // (roll expression mocked to 7; clamp + helper owned by monsterLegendaryUses.test.js:296-353).
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use');
    expect(spend.description).toMatch(/expends a legendary use for Psychic Drain \(Consume Memories save\)/);
    const heal = await waitFor(() => {
      const e = addEntry.mock.calls.map(c => c[1]).find(x => x.type === 'hp_change');
      expect(e).toBeTruthy();
      return e;
    });
    expect(heal.targetName).toBe('Aboleth 1');
    expect(heal.isHealing).toBe(true);
    expect(heal.delta).toBe(7);
    expect(heal.description).toContain('Psychic Drain');
    expect(CREATURES[0].currentHp).toBe(147);

    // Whole-lifecycle exact counts: 2 refusals + 1 spend + 1 heal = 4 entries, one popup per refusal, no attack/damage rolls ever.
    expect(addEntry).toHaveBeenCalledTimes(4);
    expect(refusals().length).toBe(2);
    expect(setPopupHtml).toHaveBeenCalledTimes(2);
    expect(rollAttack).not.toHaveBeenCalled();
  });
});
