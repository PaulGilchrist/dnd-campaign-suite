// MA-1657 regression: Vampire Umbral Lord "Beguile" (legendary_actions[0],
// uses:1, recharge:false) was swallowed as the economy header (§99
// header-swallow, MA-1640 exact twin): legendaryHeaderAction
// (monsterLegendaryUses.js, rows[0].uses != null) returned Beguile itself,
// the card rendered "Beguile (1 left)" + full prose in a plain no-onClick
// header div (MonsterCardBody slice(1)), LegendarySpendLink never ran — ZERO
// affordance on the Command cast row, live click ×2 zero-delta, counter
// frozen "(1 left)", change-data Umbral keys [], silent-burn unreachable by
// construction (MA-0675 harder-zero). Fix mirrors the VERIFIED MA-1640
// plain-vampire disk byte-shape: canonical header {name:"Legendary Action
// Uses: 2", uses:2} (floor = children count 2 §202; lair_actions is a
// raw-string block, no "(N in Lair)" clause, no lair bump §231), Beguile
// authored the SAME pass as a NUMERIC save child (MA-1204 Dread Command /
// MA-1640 Beguile byte-twin: save_dc 18 = 8 + CHA +5 + PB +5 disk truth,
// Wisdom per spells.json Command dc.dc_type WIS, dc_success:"none", range
// "60 feet", save_effect carrying the obey-clause honestly as GM-enforced
// advisory MA-0058 family), Beguile child uses/recharge dropped §165 (the
// header owns the pool — phantom double-economy MA-1058/MA-1089 twins).
// MA-1658 same-day follow-up: Umbral Strike pins are INVERTED (§216) —
// delegates_to:"Grave Strike" added, child uses/recharge dropped §165,
// stray recharge:false "(false)" tail killed (§MA-1636 twin).
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { extractConditionsFromSaveEffect } from './MonsterCardHelpers.js';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';
import spellsData from '../../../public/data/spells.json';
import {
  legendaryHeaderAction, legendaryMaxUses, legendaryUsesRemaining,
  legendaryExpendGate, hasLegendaryCooldownClause,
  legendaryDelegateAction, legendaryDelegateAttackName,
} from '../../services/encounters/monsterLegendaryUses.js';

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 10, rolls: [3, 3, 4], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 20, rolls: [3, 3, 4], modifier: 0 })),
}));
vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/ui/dataLoader.js', () => ({ loadSpells: vi.fn(() => Promise.resolve([])) }));
const ROLLERS = vi.hoisted(() => {
  const rollAttack = vi.fn();
  const rollDamage = vi.fn();
  const rollSavingThrow = vi.fn();
  return { rollAttack, rollDamage, rollSavingThrow };
});
vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });
  return { default: vi.fn(() => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: _setPopupHtml,
    rollAttack: ROLLERS.rollAttack, rollDamage: ROLLERS.rollDamage, rollAbilityCheck: vi.fn(),
    rollSavingThrow: ROLLERS.rollSavingThrow, rollSkillCheck: vi.fn(), rollInitiative: vi.fn(), quickRollPlayerSave: vi.fn(),
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
  rangeToFeet: vi.fn(() => 30),
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
  { name: 'Vampire Umbral Lord 1', type: 'npc', monsterType: 'undead', targetName: 'Bandit 1', currentHp: 187, maxHp: 187, ac: 16, conditions: [] },
  { name: 'Bandit 1', type: 'npc', currentHp: 11, maxHp: 11, ac: 12, conditions: [] },
];

const KEY = 'Vampire Umbral Lord 1.monsterLegendaryUses';
const COOLDOWNS_KEY = 'Vampire Umbral Lord 1.monsterLegendaryActionCooldowns';

const umbralLord = () => monstersData.find(m => m.name === 'Vampire Umbral Lord');
const legendary = () => umbralLord().legendary_actions;
const row = (name) => legendary().find(a => a.name === name);
const commandSpell = () => spellsData.find(s => s.name === 'Command');

describe('MA-1657 monsters.json data lock: umbral lord legendary header + Beguile numeric save', () => {
  it('rows[0] is the canonical header with numeric uses:2 (was: the swallowed Beguile child)', () => {
    const la = legendary();
    expect(la[0].name).toBe('Legendary Action Uses: 2');
    expect(la[0].uses).toBe(2);
    expect(la[0].name).not.toMatch(/Beguile|Umbral Strike/);
    expect(la[0].name).not.toMatch(/Lair/);
    expect(la[0].description).toMatch(/Immediately after another creature's turn, the vampire can expend a use/);
    expect(la[0].description).toMatch(/regains all expended uses at the start of each of its turns/);
    expect(la[0].delegates_to).toBeUndefined();
    expect(legendaryHeaderAction(umbralLord())).toBe(la[0]);
    expect(legendaryMaxUses(la[0], null)).toBe(2);
    expect(legendaryUsesRemaining(la[0], { max: 2, used: 1 })).toBe(1);
  });

  it('header + Beguile byte-mirror the VERIFIED MA-1640 plain-vampire twin (only the DC differs: 18 vs 17)', () => {
    const vampireHeader = monstersData.find(m => m.name === 'Vampire').legendary_actions[0];
    expect(legendary()[0].name).toBe(vampireHeader.name);
    expect(legendary()[0].description).toBe(vampireHeader.description);
    const unicornHeader = monstersData.find(m => m.name === 'Unicorn').legendary_actions[0];
    expect(legendary()[0].description).toBe(unicornHeader.description.replace(/unicorn/g, 'vampire'));
    const beg = row('Beguile');
    const vBeg = monstersData.find(m => m.name === 'Vampire').legendary_actions.find(a => a.name === 'Beguile');
    expect(Object.keys(beg)).toEqual(Object.keys(vBeg));
    expect(beg.save_type).toBe(vBeg.save_type);
    expect(beg.dc_success).toBe(vBeg.dc_success);
    expect(beg.range).toBe(vBeg.range);
    expect(beg.save_effect).toBe(vBeg.save_effect);
    expect(beg.save_dc).toBe(18);
    expect(vBeg.save_dc).toBe(17);
  });

  it('Beguile is a numeric save child — MA-1204/MA-1640 byte-twin lane, own uses/recharge dropped (§165)', () => {
    const beg = row('Beguile');
    expect(beg.save_dc).toBe(18);
    expect(beg.save_type).toBe('Wisdom');
    expect(beg.dc_success).toBe('none');
    expect(beg.range).toBe('60 feet');
    expect(beg.delegates_to).toBeUndefined();
    expect(beg.advisory).toBeUndefined();
    expect(beg.uses).toBeUndefined();
    expect(beg.recharge).toBeUndefined();
    expect(beg.save_effect).toMatch(/^Failure: The target obeys the vampire's one-word command on its next turn/);
    expect(beg.save_effect).toMatch(/Success: The target is unaffected\.$/);
    // DC arithmetic on disk truth: 8 + CHA +5 + PB +5 = 18.
    expect(umbralLord().ability_score_modifiers.cha).toBe(5);
    expect(umbralLord().proficiency_bonus).toBe(5);
    expect(8 + umbralLord().ability_score_modifiers.cha + umbralLord().proficiency_bonus).toBe(18);
    // spells.json truth: Command = WIS save, dc_success none, range 60 ft, L1.
    expect(commandSpell().dc.dc_type).toBe('WIS');
    expect(commandSpell().dc.dc_success).toBe('none');
    expect(commandSpell().range).toBe('60 feet');
    // obey-the-command has no canonical-condition consumer (MA-0058 twin): zero grants.
    expect(extractConditionsFromSaveEffect(beg.save_effect)).toEqual([]);
  });

  it('Beguile description stays byte-unchanged (manifest MA-1657 prose) and rides the until-next-turn latch', () => {
    const beg = row('Beguile');
    expect(beg.description).toBe('The vampire casts Command, requiring no spell components and using Charisma as the spellcasting ability (spell save DC 18). The vampire can\'t take this action again until the start of its next turn.');
    expect(hasLegendaryCooldownClause(beg)).toBe(true);
  });

  it('MA-1658: Umbral Strike delegates_to Grave Strike, child uses/recharge dropped (§165 — §216 pin inverted from MA-1657 untouched-state)', () => {
    const us = row('Umbral Strike');
    expect(Object.keys(us)).toEqual(['name', 'description', 'delegates_to']);
    expect(us.description).toBe('The vampire moves up to half its Speed, and it makes one Grave Strike or Sickening Ray attack.');
    expect(us.delegates_to).toBe('Grave Strike');
    expect(us.uses).toBeUndefined();
    expect(us.recharge).toBeUndefined();
    expect(us.save_dc).toBeUndefined();
    expect(us.attack_bonus).toBeUndefined();
    expect(us.advisory).toBeUndefined();
    // MA-1641 Deathless Strike byte-twin key shape: delegates_to rides LAST.
    const ds = monstersData.find(m => m.name === 'Vampire').legendary_actions.find(a => a.name === 'Deathless Strike');
    expect(Object.keys(ds)).toEqual(['name', 'description', 'delegates_to']);
  });

  it('MA-1658: delegate resolves to the Grave Strike actions[] row — resolvable attack leg, no console dead-end', () => {
    const us = row('Umbral Strike');
    const delegate = legendaryDelegateAction(umbralLord(), us);
    expect(delegate).not.toBeNull();
    expect(delegate.name).toBe('Grave Strike');
    expect(delegate.attack_bonus).toBe(10);
    expect(delegate.damage_dice_primary).toBe('1d8 + 5');
    expect(delegate.damage_type_primary).toBe('Slashing');
    expect(delegate.damage_dice_secondary).toBe('3d8');
    expect(delegate.damage_type_secondary).toBe('Necrotic');
    expect(legendaryDelegateAttackName(us, delegate)).toBe('Umbral Strike (Grave Strike attack)');
  });

  it('gate math on the fixed header: allows after another creature, refuses own-turn and exhausted', () => {
    const header = legendary()[0];
    expect(legendaryExpendGate({ header, storedUses: { max: 2, used: 0 }, round: 1, activeCreatureName: 'Bandit 1', monsterName: 'Vampire Umbral Lord 1', latch: null })).toMatchObject({ allowed: true, remaining: 2, max: 2 });
    expect(legendaryExpendGate({ header, storedUses: { max: 2, used: 2 }, round: 1, activeCreatureName: 'Bandit 1', monsterName: 'Vampire Umbral Lord 1', latch: null }).reason).toBe('exhausted');
    expect(legendaryExpendGate({ header, storedUses: { max: 2, used: 0 }, round: 1, activeCreatureName: 'Vampire Umbral Lord 1', monsterName: 'Vampire Umbral Lord 1', latch: null }).reason).toBe('own-turn');
  });
});

describe('MA-1657 MonsterCardModal umbral lord gated legendary economy', () => {
  let consoleSpy;
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Bandit 1', creatures: CREATURES };
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => { consoleSpy.mockRestore(); });

  function renderUmbralLord(uses) {
    runtime.store[KEY] = uses;
    const m = makeMonster({
      name: 'Vampire Umbral Lord',
      actions: umbralLord().actions,
      legendary_actions: legendary(),
    });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Vampire Umbral Lord 1', creatures: CREATURES })} />);
  }
  function uRow(name) {
    return Array.from(document.querySelectorAll('.mc-action')).find(r => r.textContent.trim().startsWith(name));
  }

  it('header shows "Legendary Action Uses: 2 (2 left)"; Beguile renders gated DC 18 Wisdom save chip (§204 shape)', () => {
    renderUmbralLord({ max: 2, used: 0 });
    expect(document.querySelector('.mc-legendary-header-row').textContent).toContain('Legendary Action Uses: 2');
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(2 left)');
    expect(document.querySelector('.mc-legendary-header-row').textContent).not.toContain('Beguile');
    const chip = uRow('Beguile').querySelector('.mc-dice-link-save-clickable');
    expect(chip).not.toBe(null);
    expect(chip.textContent).toContain('DC 18');
    expect(chip.textContent).toContain('Wisdom');
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('Beguile save-chip click spends 2→1, adjudicates DC 18 WIS vs armed Bandit, stamps cooldown, honest spend log', async () => {
    renderUmbralLord({ max: 2, used: 0 });
    fireEvent.click(uRow('Beguile').querySelector('.mc-dice-link-save-clickable'));
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 2, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollSavingThrow).toHaveBeenCalled());
    expect(ROLLERS.rollSavingThrow.mock.calls[0][0]).toBe('WIS');
    const context = ROLLERS.rollSavingThrow.mock.calls[0][2];
    expect(context.saveDc).toBe(18);
    expect(context.saveType).toBe('Wisdom');
    expect(context.dcSuccess).toBe('none');
    expect(context.targetName).toBe('Bandit 1');
    await waitFor(() => expect(runtime.store[COOLDOWNS_KEY]).toMatchObject({ beguile: { round: 1 } }));
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Beguile/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Beguile/);
    expect(spend.description).toMatch(/1 of 2 left/);
    expect(consoleSpy.mock.calls.flat().some(a => /no resolvable mechanic/.test(String(a)))).toBe(false);
  });

  it('same active creature refire refuses on the turn latch, counter held, zero extra save', async () => {
    renderUmbralLord({ max: 2, used: 0 });
    fireEvent.click(uRow('Beguile').querySelector('.mc-dice-link-save-clickable'));
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 2, used: 1 }));
    ROLLERS.rollSavingThrow.mockClear();
    setPopupHtml.mockClear();
    fireEvent.click(uRow('Beguile').querySelector('.mc-dice-link-save-clickable'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Only one legendary action');
    expect(runtime.store[KEY]).toEqual({ max: 2, used: 1 });
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('exhausted (2/2): Beguile press refuses with popup + legendary_use_refused, zero spend, zero save', async () => {
    renderUmbralLord({ max: 2, used: 2 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(0 left)');
    fireEvent.click(uRow('Beguile').querySelector('.mc-dice-link-save-clickable'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Legendary Action Refused');
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store[KEY]).toEqual({ max: 2, used: 2 });
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('own-turn refusal leg: refuses before spend, zero save rolled', async () => {
    renderUmbralLord({ max: 2, used: 0 });
    ctx.value = { round: 1, activeCreatureName: 'Vampire Umbral Lord 1', creatures: CREATURES };
    fireEvent.click(uRow('Beguile').querySelector('.mc-dice-link-save-clickable'));
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store[KEY]).toEqual({ max: 2, used: 0 });
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
  });

  function uExpendChip(name) {
    return uRow(name).querySelector('.mc-dice-link-legendary');
  }

  it('MA-1658: Umbral Strike Expend-Legendary chip routes the delegate — spends 2→1, rollAttack +10 "Umbral Strike (Grave Strike attack)", Grave Strike damage legs ride, zero console.error', async () => {
    renderUmbralLord({ max: 2, used: 0 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(2 left)');
    const chip = uExpendChip('Umbral Strike');
    expect(chip).not.toBe(null);
    expect(chip.textContent).toContain('Expend Legendary');
    fireEvent.click(chip);
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 2, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    expect(ROLLERS.rollAttack.mock.calls[0][0]).toBe('Umbral Strike (Grave Strike attack)');
    expect(ROLLERS.rollAttack.mock.calls[0][1]).toBe(10);
    const opts = ROLLERS.rollAttack.mock.calls[0][2];
    expect(opts.autoDamageFormula).toBe('1d8 + 5');
    expect(opts.damageType).toBe('Slashing');
    expect(opts.autoDamageSecondaryFormula).toBe('3d8');
    expect(opts.autoDamageSecondaryDamageType).toBe('Necrotic');
    expect(opts.targetName).toBe('Bandit 1');
    expect(opts.saveDc).toBeNull();
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Umbral Strike/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Umbral Strike/);
    expect(spend.description).toMatch(/1 of 2 left/);
    expect(consoleSpy.mock.calls.flat().some(a => /no resolvable mechanic/.test(String(a)))).toBe(false);
  });

  it('MA-1658: same-boundary Umbral Strike refire refuses on the turn latch, counter held, zero extra rollAttack', async () => {
    renderUmbralLord({ max: 2, used: 0 });
    fireEvent.click(uExpendChip('Umbral Strike'));
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 2, used: 1 }));
    ROLLERS.rollAttack.mockClear();
    setPopupHtml.mockClear();
    fireEvent.click(uExpendChip('Umbral Strike'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Only one legendary action');
    expect(runtime.store[KEY]).toEqual({ max: 2, used: 1 });
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('MA-1658: exhausted (2/2) Umbral Strike press refuses honestly — popup + legendary_use_refused, zero spend, zero roll', async () => {
    renderUmbralLord({ max: 2, used: 2 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(0 left)');
    fireEvent.click(uExpendChip('Umbral Strike'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Legendary Action Refused');
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store[KEY]).toEqual({ max: 2, used: 2 });
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
    expect(consoleSpy).not.toHaveBeenCalled();
  });
});
