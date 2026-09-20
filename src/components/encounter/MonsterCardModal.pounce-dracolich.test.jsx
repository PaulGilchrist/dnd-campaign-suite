// MA-0620 regression: Dracolich legendary rows[0] "Pounce" carried `uses:1`
// with no header row above it — legendaryHeaderAction() swallowed Pounce as
// the economy header (name+counter render, zero affordance; MA-0567/MA-0510
// header-swallow) and the prose spellcast child "Sickening Ray" had no
// numeric mechanic, so its gated "Expend Legendary" chip silently BURNED the
// use with console.error "no resolvable mechanic" (§46). Fix is DATA-only,
// header+children SAME pass: canonical header rows[0]
// "Legendary Action Uses: 1" (MA-0040/Death Knight byte-shape, §165);
// Pounce delegates_to:"Rend" resolving the dracolich's OWN Rend numbers
// (+13 / 2d10 + 7 Slashing + 1d8 Necrotic) through the MA-0022 delegate
// attack seam, half-Speed movement advisory (§70 twin); Sickening Ray rides
// the MA-0219 Guiding Light numeric-spellchild seam (+11 spell attack,
// 3d8 Poison per 2024 Ray of Sickness level 2).
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';
import { legendaryHeaderAction, legendaryDelegateAction, legendaryDelegateAttackName } from '../../services/encounters/monsterLegendaryUses.js';

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
    get popupHtml() { return _popupHtml; },
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
  rangeToFeet: vi.fn(() => 60),
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
  { name: 'Dracolich 1', type: 'npc', monsterType: 'dragon', targetName: 'Bandit 1', currentHp: 225, maxHp: 225, ac: 20, conditions: [] },
  { name: 'Bandit 1', type: 'npc', currentHp: 999, maxHp: 999, ac: 12, conditions: [] },
  { name: 'TestPC', type: 'player', currentHp: 41, maxHp: 41, conditions: [], computedStats: {} },
];

const dracolich = () => monstersData.find(m => m.name === 'Dracolich');
const legendaryRows = () => dracolich().legendary_actions;
const headerRow = () => legendaryRows()[0];
const pounceRow = () => legendaryRows().find(a => a.name === 'Pounce');
const sickeningRayRow = () => legendaryRows().find(a => a.name === 'Sickening Ray');
const rendRow = () => dracolich().actions.find(a => a.name === 'Rend');

// MA-0620 data lock: header-swallow fixed — rows[0] is the canonical header
// (numeric uses, no mechanic of its own); children carry no per-child `uses`
// (§165 Colossus/Death Knight verified templates).
describe('MA-0620 monsters.json data: dracolich legendary block header + children', () => {
  it('rows[0] is the canonical header "Legendary Action Uses: 1" with numeric uses', () => {
    const h = headerRow();
    expect(h.name).toBe('Legendary Action Uses: 1');
    expect(h.uses).toBe(1);
    expect(h.description).toContain('regains expended legendary uses at the start of its turn');
    expect(h.delegates_to).toBeUndefined();
    expect(legendaryHeaderAction(dracolich())).toBe(h);
  });

  it('children carry no per-child uses (header owns the economy, §165)', () => {
    for (const child of legendaryRows().slice(1)) {
      expect(child.uses).toBeUndefined();
    }
  });

  it('Pounce child delegates_to Rend with the half-Speed movement advisory', () => {
    const row = pounceRow();
    expect(row.delegates_to).toBe('Rend');
    expect(row.description).toBe('The dracolich moves up to half its Speed (movement advisory — GM moves the token; no movement-distance consumer), and it makes one Rend attack.');
    expect(row.attack_bonus).toBeUndefined();
    expect(row.save_dc).toBeUndefined();
  });

  it('delegates to the dracolich own Rend row: +13 / 2d10 + 7 Slashing + 1d8 Necrotic', () => {
    const rend = rendRow();
    expect(rend.attack_bonus).toBe(13);
    expect(rend.damage_dice_primary).toBe('2d10 + 7');
    expect(rend.damage_type_primary).toBe('Slashing');
    expect(rend.damage_dice_secondary).toBe('1d8');
    expect(rend.damage_type_secondary).toBe('Necrotic');
    const delegate = legendaryDelegateAction(dracolich(), pounceRow());
    expect(delegate).toBe(rend);
    expect(legendaryDelegateAttackName(pounceRow(), rend)).toBe('Pounce (Rend attack)');
  });

  it('Sickening Ray child authors numeric spell fields (MA-0219 Guiding Light seam) — no silent-burn', () => {
    const row = sickeningRayRow();
    expect(row.attack_bonus).toBe(11);
    expect(row.spell_attack_bonus).toBe(11);
    expect(row.damage_dice_primary).toBe('3d8');
    expect(row.damage_type_primary).toBe('Poison');
    expect(row.range).toBe('60 feet');
  });
});

// MA-0620 live seam: header renders "Legendary Action Uses: 1" (counter),
// Pounce renders the gated "Expend Legendary" chip; a boundary click spends
// the single use then rolls the delegated +13 Rend attack (armed target,
// 2d10 + 7 Slashing auto-damage + 1d8 Necrotic secondary). Sickening Ray
// renders the +11 spell chip which spends + rolls 3d8 Poison — no
// console.error silent burn. Exhausted click refuses zero-spend.
describe('MA-0620 MonsterCardModal dracolich legendary gated rows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Bandit 1', creatures: CREATURES };
  });

  function renderDracolich(uses) {
    runtime.store['Dracolich 1.monsterLegendaryUses'] = uses;
    const m = makeMonster({
      name: 'Dracolich',
      actions: dracolich().actions,
      legendary_actions: dracolich().legendary_actions,
    });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Dracolich 1', creatures: CREATURES })} />);
  }
  function laRow(name) {
    return Array.from(document.querySelectorAll('.mc-action')).find(r => (r.querySelector('strong')?.textContent || '').startsWith(name));
  }

  it('header renders "Legendary Action Uses: 1" — NOT a swallowed Pounce header', () => {
    renderDracolich({ max: 1, used: 0 });
    const header = document.querySelector('.mc-legendary-header-row');
    expect(header).not.toBe(null);
    expect(header.textContent).toContain('Legendary Action Uses: 1');
    expect(header.textContent).not.toContain('Pounce');
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(1 left)');
  });

  it('Pounce renders the gated Expend Legendary chip; click spends the 1 use and rolls the delegated +13 Rend attack', async () => {
    renderDracolich({ max: 1, used: 0 });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const chip = laRow('Pounce').querySelector('.mc-dice-link-legendary');
    expect(chip).not.toBe(null);
    expect(chip.textContent).toContain('Expend Legendary');
    fireEvent.click(chip);
    await waitFor(() => expect(runtime.store['Dracolich 1.monsterLegendaryUses']).toEqual({ max: 1, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    expect(ROLLERS.rollAttack.mock.calls[0][0]).toBe('Pounce (Rend attack)');
    expect(ROLLERS.rollAttack.mock.calls[0][1]).toBe(13);
    const options = ROLLERS.rollAttack.mock.calls[0][2];
    expect(options.autoDamageFormula).toBe('2d10 + 7');
    expect(options.autoDamageName).toBe('Pounce (Rend attack)');
    expect(options.damageType).toBe('Slashing');
    expect(options.autoDamageSecondaryFormula).toBe('1d8');
    expect(options.autoDamageSecondaryDamageType).toBe('Necrotic');
    expect(options.targetName).toBe('Bandit 1');
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Pounce/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Pounce/);
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    expect(errSpy.mock.calls.flat().some(a => /no resolvable mechanic/.test(String(a)))).toBe(false);
    errSpy.mockRestore();
  });

  it('Sickening Ray +11 spell chip spends and rolls 3d8 Poison (spell-origin) — zero silent burn', async () => {
    renderDracolich({ max: 1, used: 0 });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const row = laRow('Sickening Ray');
    expect(row.querySelector('.mc-dice-link-legendary')).toBe(null);
    const chip = row.querySelector('.mc-dice-link');
    expect(chip.textContent).toContain('+11');
    fireEvent.click(chip);
    await waitFor(() => expect(runtime.store['Dracolich 1.monsterLegendaryUses']).toEqual({ max: 1, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    expect(ROLLERS.rollAttack.mock.calls[0][0]).toBe('Sickening Ray');
    expect(ROLLERS.rollAttack.mock.calls[0][1]).toBe(11);
    const options = ROLLERS.rollAttack.mock.calls[0][2];
    expect(options.autoDamageFormula).toBe('3d8');
    expect(options.damageType).toBe('Poison');
    expect(options.isSpellDamage).toBe(true);
    expect(errSpy.mock.calls.flat().some(a => /no resolvable mechanic/.test(String(a)))).toBe(false);
    errSpy.mockRestore();
  });

  it('exhausted (1/1): Pounce chip click refuses with popup + legendary_use_refused, zero spend, zero roll', async () => {
    renderDracolich({ max: 1, used: 1 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(0 left)');
    fireEvent.click(laRow('Pounce').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Legendary Action Refused');
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store['Dracolich 1.monsterLegendaryUses']).toEqual({ max: 1, used: 1 });
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
    expect(ROLLERS.rollDamage).not.toHaveBeenCalled();
  });
});
