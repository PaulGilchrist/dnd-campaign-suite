// MA-1640 regression: Vampire "Beguile" (legendary_actions[0], uses:1,
// recharge:false) was swallowed as the economy header (§99 header-swallow):
// legendaryHeaderAction (monsterLegendaryUses.js, rows[0].uses != null)
// returned Beguile itself, the card rendered "Beguile (1 left)" + full prose
// in a plain no-onClick header div (MonsterCardBody slice(1)), LegendarySpendLink
// never ran — ZERO affordance on the Command cast row, click ×2 zero-delta,
// console 0, counter "(1 left)" under-reporting the RAW floor 2 (children
// count). Fix mirrors the MA-1635 unicorn + MA-1204 mummy-lord disk twins:
// canonical header {name:"Legendary Action Uses: 2", uses:2} (floor = children
// count; vampire lair_actions is a raw-string block, no "(N in Lair)" clause,
// no lair bump §231), Beguile authored the SAME pass as a NUMERIC save child
// (MA-1204 Dread Command byte-twin: save_dc 17 = 8 + CHA +4 + PB +5, Wisdom
// per spells.json Command, dc_success:"none", range "60 feet", save_effect
// carrying the obey-clause honestly as GM-enforced advisory MA-0058 family),
// per-child uses/recharge dropped §165 (header owns the pool) — mirrored from
// the VERIFIED unicorn disk state post-MA-1635/1636 where BOTH children carry
// no uses/recharge. Deathless Strike stays mechanic-untouched (MA-1641 owns
// its delegate seam — no delegates_to authored here).
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
  { name: 'Vampire 1', type: 'npc', monsterType: 'undead', targetName: 'Bandit 1', currentHp: 195, maxHp: 195, ac: 16, conditions: [] },
  { name: 'Bandit 1', type: 'npc', currentHp: 11, maxHp: 11, ac: 12, conditions: [] },
];

const KEY = 'Vampire 1.monsterLegendaryUses';
const COOLDOWNS_KEY = 'Vampire 1.monsterLegendaryActionCooldowns';

const vampire = () => monstersData.find(m => m.name === 'Vampire');
const legendary = () => vampire().legendary_actions;
const row = (name) => legendary().find(a => a.name === name);
const commandSpell = () => spellsData.find(s => s.name === 'Command');

describe('MA-1640 monsters.json data lock: vampire legendary header + Beguile numeric save', () => {
  it('rows[0] is the canonical header with numeric uses:2 (was: the swallowed Beguile child)', () => {
    const la = legendary();
    expect(la[0].name).toBe('Legendary Action Uses: 2');
    expect(la[0].uses).toBe(2);
    expect(la[0].name).not.toMatch(/Beguile|Deathless/);
    expect(la[0].description).toMatch(/Immediately after another creature's turn, the vampire can expend a use/);
    expect(la[0].description).toMatch(/regains all expended uses at the start of each of its turns/);
    expect(la[0].delegates_to).toBeUndefined();
    expect(legendaryHeaderAction(vampire())).toBe(la[0]);
    expect(legendaryMaxUses(la[0], null)).toBe(2);
    expect(legendaryUsesRemaining(la[0], { max: 2, used: 1 })).toBe(1);
  });

  it('header boilerplate byte-mirrors the VERIFIED unicorn twin (unicorn→vampire swap)', () => {
    const unicornHeader = monstersData.find(m => m.name === 'Unicorn').legendary_actions[0];
    const mirror = unicornHeader.description.replace(/unicorn/g, 'vampire');
    expect(legendary()[0].description).toBe(mirror);
  });

  it('Beguile is a numeric save child — MA-1204 Dread Command byte-twin, own uses/recharge dropped (§165)', () => {
    const beg = row('Beguile');
    expect(beg.save_dc).toBe(17);
    expect(beg.save_type).toBe('Wisdom');
    expect(beg.dc_success).toBe('none');
    expect(beg.range).toBe('60 feet');
    expect(beg.delegates_to).toBeUndefined();
    expect(beg.advisory).toBeUndefined();
    expect(beg.uses).toBeUndefined();
    expect(beg.recharge).toBeUndefined();
    expect(beg.save_effect).toMatch(/^Failure: The target obeys the vampire's one-word command on its next turn/);
    expect(beg.save_effect).toMatch(/Success: The target is unaffected\.$/);
    // DC arithmetic on disk truth: 8 + CHA +4 + PB +5 = 17.
    expect(vampire().ability_score_modifiers.cha).toBe(4);
    expect(vampire().proficiency_bonus).toBe(5);
    expect(8 + vampire().ability_score_modifiers.cha + vampire().proficiency_bonus).toBe(17);
    // spells.json truth: Command = WIS save, dc_success none, range 60 ft, L1.
    expect(commandSpell().dc.dc_type).toBe('WIS');
    expect(commandSpell().dc.dc_success).toBe('none');
    expect(commandSpell().range).toBe('60 feet');
    // obey-the-command has no canonical-condition consumer (MA-0058 twin): zero grants.
    expect(extractConditionsFromSaveEffect(beg.save_effect)).toEqual([]);
  });

  it('no child authors per-child uses/recharge (§165 — mirrored from verified unicorn post-MA-1635/1636 disk state)', () => {
    for (const a of legendary().slice(1)) {
      expect(a.uses, `legendary child "${a.name}" must not author uses`).toBeUndefined();
      expect(a.recharge, `legendary child "${a.name}" must not author recharge`).toBeUndefined();
    }
    const unicorn = monstersData.find(m => m.name === 'Unicorn');
    for (const a of unicorn.legendary_actions.slice(1)) {
      expect(a.uses, `unicorn twin child "${a.name}" must not author uses`).toBeUndefined();
      expect(a.recharge, `unicorn twin child "${a.name}" must not author recharge`).toBeUndefined();
    }
  });

  it('Deathless Strike mechanic stays untouched (MA-1641 owns its delegate seam)', () => {
    const ds = row('Deathless Strike');
    expect(ds.description).toBe('The vampire moves up to half its Speed, and it makes one Grave Strike attack.');
    expect(ds.delegates_to).toBeUndefined();
    expect(ds.save_dc).toBeUndefined();
    expect(ds.attack_bonus).toBeUndefined();
    expect(ds.advisory).toBeUndefined();
  });

  it('until-next-turn cooldown prose rides Beguile (§204 owner latch)', () => {
    expect(hasLegendaryCooldownClause(row('Beguile'))).toBe(true);
  });

  it('gate math on the fixed header: allows after another creature, refuses own-turn and exhausted', () => {
    const header = legendary()[0];
    expect(legendaryExpendGate({ header, storedUses: { max: 2, used: 0 }, round: 1, activeCreatureName: 'Bandit 1', monsterName: 'Vampire 1', latch: null })).toMatchObject({ allowed: true, remaining: 2, max: 2 });
    expect(legendaryExpendGate({ header, storedUses: { max: 2, used: 2 }, round: 1, activeCreatureName: 'Bandit 1', monsterName: 'Vampire 1', latch: null }).reason).toBe('exhausted');
    expect(legendaryExpendGate({ header, storedUses: { max: 2, used: 0 }, round: 1, activeCreatureName: 'Vampire 1', monsterName: 'Vampire 1', latch: null }).reason).toBe('own-turn');
  });
});

describe('MA-1640 MonsterCardModal vampire gated legendary economy', () => {
  let consoleSpy;
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Bandit 1', creatures: CREATURES };
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => { consoleSpy.mockRestore(); });

  function renderVampire(uses) {
    runtime.store[KEY] = uses;
    const m = makeMonster({
      name: 'Vampire',
      actions: vampire().actions,
      legendary_actions: legendary(),
    });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Vampire 1', creatures: CREATURES })} />);
  }
  function vRow(name) {
    return Array.from(document.querySelectorAll('.mc-action')).find(r => r.textContent.trim().startsWith(name));
  }

  it('header shows "Legendary Action Uses: 2 (2 left)"; Beguile renders gated DC 17 Wisdom save chip (§204 shape)', () => {
    renderVampire({ max: 2, used: 0 });
    expect(document.querySelector('.mc-legendary-header-row').textContent).toContain('Legendary Action Uses: 2');
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(2 left)');
    expect(document.querySelector('.mc-legendary-header-row').textContent).not.toContain('Beguile');
    const chip = vRow('Beguile').querySelector('.mc-dice-link-save-clickable');
    expect(chip).not.toBe(null);
    expect(chip.textContent).toContain('DC 17');
    expect(chip.textContent).toContain('Wisdom');
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('Beguile save-chip click spends 2→1, adjudicates DC 17 WIS vs armed Bandit, stamps cooldown, honest spend log', async () => {
    renderVampire({ max: 2, used: 0 });
    fireEvent.click(vRow('Beguile').querySelector('.mc-dice-link-save-clickable'));
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 2, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollSavingThrow).toHaveBeenCalled());
    expect(ROLLERS.rollSavingThrow.mock.calls[0][0]).toBe('WIS');
    const context = ROLLERS.rollSavingThrow.mock.calls[0][2];
    expect(context.saveDc).toBe(17);
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
    renderVampire({ max: 2, used: 0 });
    fireEvent.click(vRow('Beguile').querySelector('.mc-dice-link-save-clickable'));
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 2, used: 1 }));
    ROLLERS.rollSavingThrow.mockClear();
    setPopupHtml.mockClear();
    fireEvent.click(vRow('Beguile').querySelector('.mc-dice-link-save-clickable'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Only one legendary action');
    expect(runtime.store[KEY]).toEqual({ max: 2, used: 1 });
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('exhausted (2/2): Beguile press refuses with popup + legendary_use_refused, zero spend, zero save', async () => {
    renderVampire({ max: 2, used: 2 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(0 left)');
    fireEvent.click(vRow('Beguile').querySelector('.mc-dice-link-save-clickable'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Legendary Action Refused');
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store[KEY]).toEqual({ max: 2, used: 2 });
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('own-turn refusal leg: refuses before spend, zero save rolled', async () => {
    renderVampire({ max: 2, used: 0 });
    ctx.value = { round: 1, activeCreatureName: 'Vampire 1', creatures: CREATURES };
    fireEvent.click(vRow('Beguile').querySelector('.mc-dice-link-save-clickable'));
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store[KEY]).toEqual({ max: 2, used: 0 });
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
  });
});
