// MA-0219 regression: Ancient Gold Dragon legendary "Guiding Light" was inert
// prose ("The dragon uses Spellcasting to cast Guiding Bolt (level 4 version).")
// — the gated "Expend Legendary" chip spent a use then console.errored "no
// resolvable mechanic" (zero roll/log/damage). Fix authors the MA-0033
// spell-attack seam mirroring the verified MA-0082/MA-0105/MA-0196 siblings:
// +16 to hit (PB +7 + CHA +9), level 4 Guiding Bolt = 7d6 Radiant per
// spells.json (both paths), 120 ft range, spell-origin marker.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';
import spells5e from '../../../public/data/spells.json';
import spells2024 from '../../../public/data/2024/spells.json';

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 10, rolls: [3, 3, 4], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 20, rolls: [3, 3, 4], modifier: 0 })),
}));
vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/ui/dataLoader.js', () => ({ loadSpells: vi.fn(() => Promise.resolve([])) }));
const ROLLERS = vi.hoisted(() => ({
  rollAttack: null, rollDamage: null, rollSavingThrow: null,
}));
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
const ctx = vi.hoisted(() => ({ value: { round: 1, activeCreatureName: 'Thug 1', creatures: [] } }));
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
  { name: 'Ancient Gold Dragon 1', type: 'npc', monsterType: 'dragon', targetName: 'TestPC', currentHp: 546, maxHp: 546, ac: 22, conditions: [] },
  { name: 'Thug 1', type: 'npc', currentHp: 32, maxHp: 32, conditions: [] },
  { name: 'TestPC', type: 'player', currentHp: 41, maxHp: 41, conditions: [], computedStats: {} },
];

const ancientGold = () => monstersData.find(m => m.name === 'Ancient Gold Dragon');
const ancientGoldActions = () => [{ name: 'Rend', attack_bonus: 17, damage_dice_primary: '2d8 + 10', damage_type_primary: 'Slashing', damage_dice_secondary: '2d8', damage_type_secondary: 'Fire', reach: '15 ft.' }];

// MA-0219 data lock: Ancient Gold Dragon legendary "Guiding Light" authors the
// MA-0033 spell-attack seam mirroring the verified MA-0082 (Adult Bronze) /
// MA-0105 (Adult Gold) / MA-0196 (Ancient Bronze) shape — +16 to hit (from
// the Spellcasting row: PB +7 + CHA +9), level 4 Guiding Bolt = 7d6 Radiant
// per spells.json (both paths), 120 ft range, spell-origin marker.
describe('MA-0219 monsters.json data: ancient gold dragon Guiding Light authors the spell-attack seam', () => {
  it('Guiding Light authors +16 spell attack, 7d6 Radiant, 120 ft range', () => {
    const row = ancientGold().legendary_actions.find(a => a.name === 'Guiding Light');
    expect(row.attack_bonus).toBe(16);
    expect(row.spell_attack_bonus).toBe(16);
    expect(row.damage_dice_primary).toBe('7d6');
    expect(row.damage_type_primary).toBe('Radiant');
    expect(row.range).toBe('120 ft.');
    expect(row.description).toMatch(/uses Spellcasting to cast <em>Guiding Bolt<\/em> \(level 4 version\)/);
    expect(row.description).toMatch(/Ranged Spell Attack: \+16/);
    expect(row.description).toMatch(/7d6 Radiant damage/);
  });

  it('+16 derived from the Spellcasting row (PB +7, CHA +9)', () => {
    expect(ancientGold().actions.find(a => a.name === 'Spellcasting')?.description).toMatch(/\+16 to hit with spell attacks/);
    expect(ancientGold().ability_score_modifiers.cha).toBe(9);
    expect(ancientGold().proficiency_bonus).toBe(7);
  });

  it('level 4 Guiding Bolt = 7d6 Radiant per spells.json (both rulesets)', () => {
    const bolt5e = spells5e.find(s => s.index === 'guiding-bolt');
    const bolt2024 = spells2024.find(s => s.index === 'guiding-bolt');
    expect(bolt5e.damage.damage_at_slot_level['4']).toBe('7d6');
    expect(bolt2024.damage.damage_at_slot_level['4']).toBe('7d6');
    expect(bolt5e.damage.damage_type).toBe('Radiant');
    expect(bolt2024.damage.damage_type).toBe('Radiant');
    expect(bolt5e.attack_type).toBe('ranged');
  });
});

// MA-0219: with the seam authored, the gated row renders the numeric +16 chip
// (no expend-legendary chip), and a gated click spends 1 use then rolls the
// spell attack through the LIVE attack seam (armed target, 7d6 Radiant
// auto-damage on hit, spell-origin marker). Exhausted click refuses zero-spend.
describe('MA-0219 MonsterCardModal ancient gold dragon Guiding Light gated spell-attack row', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Thug 1', creatures: CREATURES };
  });

  function renderAGold(uses) {
    runtime.store['Ancient Gold Dragon 1.monsterLegendaryUses'] = uses;
    const m = makeMonster({
      name: 'Ancient Gold Dragon',
      actions: ancientGoldActions(),
      legendary_actions: ancientGold().legendary_actions,
    });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Ancient Gold Dragon 1', creatures: CREATURES })} />);
  }
  function goldRow(name) {
    return Array.from(document.querySelectorAll('.mc-action')).find(r => r.textContent.startsWith(name));
  }
  function guidingChip() {
    return goldRow('Guiding Light').querySelector('.mc-dice-link');
  }

  it('header shows (3 left); Guiding Light renders the +16 numeric chip, no expend-legendary chip', () => {
    renderAGold({ max: 3, used: 0 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(3 left)');
    const row = goldRow('Guiding Light');
    expect(row.querySelector('.mc-dice-link-legendary')).toBe(null);
    expect(guidingChip().textContent).toContain('+16');
  });

  it('gated click spends 1 and rolls the +16 spell attack (7d6 Radiant auto-damage, spell-origin, armed target)', async () => {
    renderAGold({ max: 3, used: 0 });
    fireEvent.click(guidingChip());
    await waitFor(() => expect(runtime.store['Ancient Gold Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    expect(ROLLERS.rollAttack.mock.calls[0][0]).toBe('Guiding Light');
    expect(ROLLERS.rollAttack.mock.calls[0][1]).toBe(16);
    const options = ROLLERS.rollAttack.mock.calls[0][2];
    expect(options.autoDamageFormula).toBe('7d6');
    expect(options.autoDamageName).toBe('Guiding Light');
    expect(options.damageType).toBe('Radiant');
    expect(options.isSpellDamage).toBe(true);
    expect(options.targetName).toBe('TestPC');
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Guiding Light/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Guiding Light/);
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    expect(ROLLERS.rollDamage).not.toHaveBeenCalled();
  });

  it('exhausted (3/3): +16 chip click refuses with popup + legendary_use_refused, zero spend, zero roll', async () => {
    renderAGold({ max: 3, used: 3 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(0 left)');
    fireEvent.click(guidingChip());
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Legendary Action Refused');
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store['Ancient Gold Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 3 });
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
    expect(ROLLERS.rollDamage).not.toHaveBeenCalled();
  });
});
