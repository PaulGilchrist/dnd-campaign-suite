// MA-1975 regression: Quetzalcoatl "Wind Step (Costs 2 Actions)"
// (legendary_actions[3]) shipped {name, description} only — the bare MA-0021
// generic Expend chip SPENT TWO legendary uses (MA-1883 name-cost parse live)
// and resolved NOTHING: delegate lane MonsterCardModal.jsx:895 requires
// `delegates_to`, :920 spent unconditionally, :926 → resolveLegendaryRowMechanic
// final else console.error MA-0510 (live-confirmed pre-fix: spends {max:3,
// used:2}, ability_use-only log, popup null, zero rolls/damage).
//
// FIX shape = fallback option (orchestrator-adjudicated, code-proven
// exclusivity): `delegates_to: "Talon"` ALONE. Advisory + delegates_to CANNOT
// coexist on one row: resolveLegendaryRow :895-905 replaces `mechanicAction`
// with the RESOLVED Talon delegate row BEFORE resolveLegendaryRowMechanic, so
// the advisory branch (:755) inspects the replaced row and the child's
// advisory/advisory_message fields are dropped at :903 — they could never fire;
// §225 canon "never co-author advisory + delegates_to on one row" + MA-1494
// sphinx Arcane Prowl byte-twin (teleport advisory folded into description,
// advisory fields pinned undefined). The §70 teleport leg stays an advisory
// residual in the UNCHANGED description prose (no grid-move consumer, CLA-320).
//
// Live seam pinned below: press spends 2 of 3 (cost parsed from the ROW NAME,
// MA-1883 :179-181) then rolls the delegated +16 / 4d8 + 8 Slashing Talon
// through the MA-0022 delegate attack seam (label "Wind Step (Costs 2 Actions)
// (Talon attack)"), no save leg, zero console silent-burn. Turn-latch refire
// and MA-1883 insufficient-cost refire honest, zero extra spend.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import { legendaryHeaderAction, legendaryDelegateAction, legendaryDelegateAttackName, legendaryActionCost, hasLegendaryCooldownClause } from '../../services/encounters/monsterLegendaryUses.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 10, rolls: [3, 3, 4], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 20, rolls: [3, 3, 4], modifier: 0 })),
}));
vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/ui/dataLoader.js', () => ({ loadSpells: vi.fn(() => Promise.resolve([])) }));
const ROLLERS = vi.hoisted(() => {
  const r = { rollAttack: null, rollDamage: null, rollSavingThrow: null };
  return r;
});
vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });
  const rollAttack = vi.fn();
  const rollDamage = vi.fn();
  const rollSavingThrow = vi.fn();
  ROLLERS.rollAttack = rollAttack;
  ROLLERS.rollDamage = rollDamage;
  ROLLERS.rollSavingThrow = rollSavingThrow;
  return { default: vi.fn(() => ({
    popupHtml: _popupHtml,
    setPopupHtml: _setPopupHtml,
    rollAttack, rollDamage, rollAbilityCheck: vi.fn(),
    rollSavingThrow, rollSkillCheck: vi.fn(), rollInitiative: vi.fn(), quickRollPlayerSave: vi.fn(),
  })), _setPopupHtml };
});
vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn(() => ({ noAdvantageAgainst: false, targetDisadvantageCount: 0, riderSaveDisadvantage: false, riderAttackBonus: 0, riderCannotOpportunityAttack: false, speedZero: false })),
  combineAttackModes: vi.fn(() => 'normal'),
  CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
}));
const ctx = vi.hoisted(() => ({ value: { round: 1, activeCreatureName: 'Bandit 1', creatures: [] } }));
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  extractDamageTypes: vi.fn(() => []),
  formatDamageTypes: vi.fn((t) => (t || []).join(', ') || ''),
  getTargetFromAttacker: vi.fn(() => null),
  getResistanceNotice: vi.fn(() => null),
  findCreatureByName: vi.fn((cs, name) => (cs?.creatures || []).find(c => c.name === name) || null),
  getCombatContext: vi.fn(() => Promise.resolve(ctx.value)),
}));
vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(() => ({ mode: 'normal', reason: '' })),
  getDistanceFeet: vi.fn(() => null),
  getNearestPlacedItem: vi.fn(() => null),
  rangeToFeet: vi.fn(() => 80),
}));
vi.mock('../../services/maps/mapsService.js', () => ({ loadMapData: vi.fn().mockResolvedValue(null) }));

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

const CREATURES = [
  { name: 'Quetzalcoatl 1', type: 'npc', monsterType: 'dragon', targetName: 'Bandit 1', currentHp: 594, maxHp: 594, ac: 22, conditions: [] },
  { name: 'Bandit 1', type: 'npc', currentHp: 999, maxHp: 999, ac: 12, conditions: [] },
];

const quetz = () => monsters.find(m => m.index === 'quetzalcoatl');
const legendaryRows = () => quetz().legendary_actions;
const headerRow = () => legendaryRows()[0];
const talonChildRow = () => legendaryRows()[1];
const detectRow = () => legendaryRows().find(a => a.name === 'Detection');
const windRow = () => legendaryRows().find(a => a.name === 'Wind Step (Costs 2 Actions)');
const talonRow = () => quetz().actions.find(a => a.name === 'Talon');

// ---- disk fingerprint ----
describe('MA-1975 disk fingerprint: Wind Step delegates_to Talon (fallback shape — advisory co-authored fields forbidden)', () => {
  it('Wind Step row keys exactly [name, delegates_to, description] — delegates_to "Talon" byte-pinned, description byte-unchanged', () => {
    const row = windRow();
    expect(Object.keys(row)).toEqual(['name', 'delegates_to', 'description']);
    expect(row.name).toBe('Wind Step (Costs 2 Actions)');
    expect(row.delegates_to).toBe('Talon');
    expect(row.description).toBe('Quetzalcoatl rides a sudden gale, teleporting 60 ft. to an unoccupied space he can see, then making one Talon attack.');
  });

  it('NO advisory/advisory_message co-authorship (code-proven exclusivity, §225/MA-1494): delegate lane :895-905 replaces mechanicAction with the Talon row BEFORE the advisory branch :755 can ever inspect the child', () => {
    const row = windRow();
    expect(row.advisory).toBeUndefined();
    expect(row.advisory_message).toBeUndefined();
    // Row stays non-numeric so the delegate lane (:895 !legendaryRowHasNumericMechanic) is the arm.
    expect(row.attack_bonus).toBeUndefined();
    expect(row.save_dc).toBeUndefined();
    expect(row.damage_dice_primary).toBeUndefined();
    // Children own no economy (§165/§168) — header keeps the pool.
    expect(row.uses).toBeUndefined();
    expect(row.recharge).toBeUndefined();
    // No owner cooldown clause in the prose — no MA-0073 latch on this row.
    expect(hasLegendaryCooldownClause(row)).toBe(false);
  });

  it('delegates to the Quetzalcoatl own Talon row: +16 / 4d8 + 8 Slashing — label rides the ATTACK seam (MA-1973 twin)', () => {
    const talon = talonRow();
    expect(talon.attack_bonus).toBe(16);
    expect(talon.damage_dice_primary).toBe('4d8 + 8');
    expect(talon.damage_type_primary).toBe('Slashing');
    const delegate = legendaryDelegateAction(quetz(), windRow());
    expect(delegate).toBe(talon);
    // Talon authors no save_dc → label kind is "attack" (§225 clean-pin precedent).
    expect(legendaryDelegateAttackName(windRow(), talon)).toBe('Wind Step (Costs 2 Actions) (Talon attack)');
  });

  it('MA-1883 name-cost parse stays 2 (the spend the fix makes honest)', () => {
    expect(legendaryActionCost(windRow())).toBe(2);
  });

  it('header economy and siblings byte-intact (header uses:3, Talon child, MA-1974 Detection untouched)', () => {
    const h = headerRow();
    expect(h.name).toBe('Legendary Action Uses: 3');
    expect(h.uses).toBe(3);
    expect(legendaryHeaderAction(quetz())).toBe(h);
    expect(talonChildRow().delegates_to).toBe('Talon');
    expect(detectRow().ability_check).toEqual({ ability: 'wisdom', skill: 'perception' });
    expect(legendaryRows().length).toBe(4);
    // Same-pass stale-pin inversion (MA-1974 test mirrors): Wind Step is the
    // ONLY legendary row edited this pass.
  });
});

// ---- live press seam ----
describe('MA-1975 MonsterCardModal press: Wind Step spends 2 then resolves the delegated Talon attack', () => {
  let consoleSpy;
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Bandit 1', creatures: CREATURES };
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => { consoleSpy.mockRestore(); });

  function renderQuetz(uses) {
    runtime.store['Quetzalcoatl 1.monsterLegendaryUses'] = uses;
    const m = makeMonster({
      name: 'Quetzalcoatl',
      armor_class: 22,
      hit_points: 594,
      actions: quetz().actions,
      legendary_actions: quetz().legendary_actions,
    });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Quetzalcoatl 1', creatures: CREATURES })} />);
  }
  function laRow(name) {
    return Array.from(document.querySelectorAll('.mc-action')).find(r => (r.querySelector('strong')?.textContent || '').startsWith(name));
  }

  it('Wind Step keeps the gated Expend chip (non-numeric delegate child — MA-1494 Prowl shape)', () => {
    renderQuetz({ max: 3, used: 0 });
    const chip = laRow('Wind Step').querySelector('.mc-dice-link-legendary');
    expect(chip).not.toBe(null);
    expect(chip.textContent).toContain('Expend Legendary');
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(3 left)');
  });

  it('press spends 2 (3->1 left) and rolls the delegated +16 Talon — 4d8 + 8 Slashing vs armed Bandit, no save leg, NO console MA-0510', async () => {
    renderQuetz({ max: 3, used: 0 });
    fireEvent.click(laRow('Wind Step').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(runtime.store['Quetzalcoatl 1.monsterLegendaryUses']).toEqual({ max: 3, used: 2 }));
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    expect(ROLLERS.rollAttack.mock.calls[0][0]).toBe('Wind Step (Costs 2 Actions) (Talon attack)');
    expect(ROLLERS.rollAttack.mock.calls[0][1]).toBe(16);
    const options = ROLLERS.rollAttack.mock.calls[0][2];
    expect(options.autoDamageFormula).toBe('4d8 + 8');
    expect(options.autoDamageName).toBe('Wind Step (Costs 2 Actions) (Talon attack)');
    expect(options.damageType).toBe('Slashing');
    expect(options.targetName).toBe('Bandit 1');
    expect(options.saveDc).toBeNull();
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Wind Step/.test(e.description));
    expect(spend.description).toMatch(/spends 2 legendary uses for Wind Step \(Costs 2 Actions\) \(Talon attack\)/);
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    expect(ROLLERS.rollDamage).not.toHaveBeenCalled();
    expect(runtime.store['Quetzalcoatl 1.monsterLegendaryActionCooldowns']?.wind_step_costs_2_actions).toBeUndefined();
    // MA-0510 dead-end is DEAD: no console error on the resolved press.
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('same-boundary refire refuses (turn latch) — zero extra spend, one roll total', async () => {
    renderQuetz({ max: 3, used: 0 });
    fireEvent.click(laRow('Wind Step').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    setPopupHtml.mockClear();
    fireEvent.click(laRow('Wind Step').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Only one legendary action');
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store['Quetzalcoatl 1.monsterLegendaryUses']).toEqual({ max: 3, used: 2 });
    expect(ROLLERS.rollAttack).toHaveBeenCalledTimes(1);
  });

  it('insufficient-cost refire honest (MA-1883): 1 remaining < cost 2 — popup names the shortfall, zero spend', async () => {
    renderQuetz({ max: 3, used: 2 });
    fireEvent.click(laRow('Wind Step').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('costs 2 legendary uses');
    expect(runtime.store['Quetzalcoatl 1.monsterLegendaryUses']).toEqual({ max: 3, used: 2 });
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
  });

  it('exhausted (3/3): refusal popup + legendary_use_refused, zero spend, zero roll', async () => {
    renderQuetz({ max: 3, used: 3 });
    fireEvent.click(laRow('Wind Step').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Legendary Action Refused');
    expect(runtime.store['Quetzalcoatl 1.monsterLegendaryUses']).toEqual({ max: 3, used: 3 });
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
  });

  it('own-turn click refuses honestly (after ANOTHER creature\'s turn, not its own)', async () => {
    ctx.value = { round: 1, activeCreatureName: 'Quetzalcoatl 1', creatures: CREATURES };
    renderQuetz({ max: 3, used: 0 });
    fireEvent.click(laRow('Wind Step').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain("after ANOTHER creature's turn, not its own");
    expect(runtime.store['Quetzalcoatl 1.monsterLegendaryUses']).toEqual({ max: 3, used: 0 });
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
  });
});
