// MA-0065 regression: Adult Brass Dragon Spellcasting — Scorching Ray is a
// RANGED SPELL ATTACK (+8 = PB+5 + CHA+3, spell save DC 16), not a block
// save and not an advisory-only record. The per-spell link must resolve
// through the attack seam (MA-0033 shape): d20+8 vs the armed target, 2d6
// Fire per ray on hit, spell-named roll/damage logs, isSpellDamage marker —
// NEVER the "Half damage on successful save" boilerplate. Refusals spend
// nothing. Data lock: the row authors spell_attack_bonus 8 (+ prose) and the
// 5e spells.json entry flags attack_type ranged with per-ray 2d6 dice.
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { isSpellAttackSpell, spellDamageFormulaAtLevel, spellCastLevelFromSpellcasting, monsterSpellAttackBonus, extractSpellNamesFromSpellcasting } from './MonsterCardHelpers.js';

const SPELLCASTING = {
  name: 'Spellcasting',
  description: 'The dragon casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 16, +8 to hit with spell attacks):<br><strong>At Will:</strong> <em>Detect Magic</em>, <em>Minor Illusion</em>, <em>Scorching Ray</em>, <em>Shapechange</em> (Beast or Humanoid form only, no Temporary Hit Points gained from the spell, and no <strong>Concentration</strong> or <strong>Temporary Hit Points</strong> required to maintain the spell), <em>Speak with Animals</em><br><strong>1/Day Each:</strong> <em>Detect Thoughts</em>, <em>Control Weather</em>',
  save_dc: 16,
  save_type: 'Charisma',
  spell_attack_bonus: 8,
};

const SCORCHING_RAY_5E = {
  name: 'Scorching Ray',
  level: 2,
  attack_type: 'ranged',
  concentration: false,
  duration: 'Instantaneous',
  range: '120 feet',
  damage: { damage_type: 'Fire', damage_at_slot_level: { 2: '2d6', 3: '2d6', 4: '2d6', 5: '2d6', 6: '2d6', 7: '2d6', 8: '2d6', 9: '2d6' } },
  dc: null,
};

const SPELLS_5E = [
  { name: 'Detect Magic', level: 1, concentration: true, duration: 'Up to 10 minutes', damage: null, dc: null },
  SCORCHING_RAY_5E,
];
const SPELLS_2024 = [
  { ...SCORCHING_RAY_5E },
];

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 9, rolls: [3, 6], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 18, rolls: [3, 6, 3, 6], modifier: 0 })),
}));

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSpells: vi.fn((version) => Promise.resolve(version === '2024' ? SPELLS_2024 : SPELLS_5E)),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _rollAttack = vi.fn();
  const _rollDamage = vi.fn();
  const _rollAbilityCheck = vi.fn();
  const _rollSavingThrow = vi.fn();
  const _rollSkillCheck = vi.fn();
  const _rollInitiative = vi.fn();
  const _quickRollPlayerSave = vi.fn();
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });

  const mockHook = vi.fn(() => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: _setPopupHtml,
    rollAttack: _rollAttack,
    rollDamage: _rollDamage,
    rollAbilityCheck: _rollAbilityCheck,
    rollSavingThrow: _rollSavingThrow,
    rollSkillCheck: _rollSkillCheck,
    rollInitiative: _rollInitiative,
    quickRollPlayerSave: _quickRollPlayerSave,
  }));

  return {
    default: mockHook,
    _rollAttack,
    _rollDamage,
    _rollSavingThrow,
    _setPopupHtml,
  };
});

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn(() => ({ ...defaultConditionEffects })),
  combineAttackModes: vi.fn(() => 'normal'),
  CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  extractDamageTypes: vi.fn(() => []),
  formatDamageTypes: vi.fn((types) => (types || []).join(', ') || ''),
  getTargetFromAttacker: vi.fn(() => null),
  getResistanceNotice: vi.fn(() => null),
  findCreatureByName: vi.fn(({ creatures } = {}, name) => (creatures || []).find(c => c.name === name) || null),
  getCombatContext: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(() => ({ mode: 'normal', reason: '' })),
  getDistanceFeet: vi.fn(() => null),
  getNearestPlacedItem: vi.fn(() => null),
  rangeToFeet: vi.fn((r) => (typeof r === 'number' ? r : 120)),
}));

vi.mock('../../services/maps/mapsService.js', () => ({
  loadMapData: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/shared/abilityLookup.js', () => ({
  getAbilitySaveModifier: vi.fn(() => 0),
}));

const runtime = vi.hoisted(() => {
  const store = {};
  return {
    store,
    setRuntimeValue: vi.fn((characterKey, propertyName, value) => { store[`${characterKey}.${propertyName}`] = value; return Promise.resolve(); }),
    getRuntimeValue: vi.fn((characterKey, propertyName) => store[`${characterKey}.${propertyName}`] ?? null),
    useRuntimeValue: vi.fn((characterKey, propertyName) => store[`${characterKey}.${propertyName}`] ?? null),
  };
});

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: runtime.useRuntimeValue,
  setRuntimeValue: runtime.setRuntimeValue,
  getRuntimeValue: runtime.getRuntimeValue,
}));

import { addEntry } from '../../services/ui/logService.js';
import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';

const rollAttack = useLoggedDiceRoll._rollAttack;
const rollSavingThrow = useLoggedDiceRoll._rollSavingThrow;
const setPopupHtml = useLoggedDiceRoll._setPopupHtml;

const MONSTER_NAME = 'Adult Brass Dragon 1';

function linkByText(text) {
  return Array.from(document.querySelectorAll('.mc-dice-link')).find(el => el.textContent.includes(text)) || null;
}

function renderDragon(armed = true) {
  const creatures = [
    { name: MONSTER_NAME, type: 'npc', targetName: armed ? 'ElderPaladin' : null, ac: 19 },
    { name: 'ElderPaladin', type: 'player', ac: 19 },
  ];
  const m = makeMonster({ name: 'Adult Brass Dragon', actions: [SPELLCASTING] });
  const props = makeProps(m, { creatureName: MONSTER_NAME, creatures });
  render(<MonsterCardModal {...props} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
});

describe('MA-0065 data — adult-brass-dragon Spellcasting row + 5e scorching-ray', () => {
  it('row authors spell_attack_bonus 8 (+ prose) and enumerates Scorching Ray', () => {
    const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
    const dragon = monsters.find(m => m.index === 'adult-brass-dragon');
    const row = dragon.actions.find(a => a.name === 'Spellcasting');
    expect(extractSpellNamesFromSpellcasting(row.description)).toContain('Scorching Ray');
    expect(row.spell_attack_bonus).toBe(8);
    expect(row.description).toMatch(/\+8 to hit with spell attacks/);
    expect(monsterSpellAttackBonus(row)).toBe(8);
  });

  it('5e spells.json Scorching Ray is a ranged attack spell with per-ray 2d6 Fire dice at every slot level', () => {
    const spells = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));
    const spell = spells.find(s => s.index === 'scorching-ray');
    expect(isSpellAttackSpell(spell)).toBe(true);
    expect(spell.level).toBe(2);
    expect(spellDamageFormulaAtLevel(spell, 2)).toBe('2d6');
    expect(spellDamageFormulaAtLevel(spell, 5)).toBe('2d6');
    expect(spellCastLevelFromSpellcasting(SPELLCASTING.description, 'Scorching Ray', spell)).toBe(2);
    const spells2024 = JSON.parse(readFileSync('public/data/2024/spells.json', 'utf8'));
    const s24 = (spells2024.spells || spells2024).find(s => s.index === 'scorching-ray');
    expect(isSpellAttackSpell(s24)).toBe(true);
    expect(spellDamageFormulaAtLevel(s24, 2)).toBe('2d6');
  });
});

describe('MA-0065 MonsterCardModal — Scorching Ray casts as a spell attack, not a block save', () => {
  it('routes the per-spell click through the attack seam with +8, 2d6 Fire, spell-named and isSpellDamage-marked', async () => {
    renderDragon(true);
    const link = linkByText('Scorching Ray');
    expect(link).toBeTruthy();
    await act(async () => { fireEvent.click(link); });

    await waitFor(() => expect(rollAttack).toHaveBeenCalled());
    const [name, bonus, options] = rollAttack.mock.calls[0];
    expect(name).toBe('Scorching Ray');
    expect(bonus).toBe(8);
    expect(options.autoDamageFormula).toBe('2d6');
    expect(options.damageType).toBe('Fire');
    expect(options.targetName).toBe('ElderPaladin');
    expect(options.attackerName).toBe(MONSTER_NAME);
    expect(options.isSpellDamage).toBe(true);
    expect(options.saveDc).toBeNull();

    expect(rollSavingThrow).not.toHaveBeenCalled();
  });

  it('logs a spell-named ability_use cast record with level 2 and +8; no Half-damage boilerplate; At Will spends no uses', async () => {
    renderDragon(true);
    await act(async () => { fireEvent.click(linkByText('Scorching Ray')); });

    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    const entry = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && e.abilityName === 'Scorching Ray');
    expect(entry).toBeTruthy();
    expect(entry.characterName).toBe(MONSTER_NAME);
    expect(entry.description).toMatch(/casts Scorching Ray via Spellcasting/);
    expect(entry.description).toMatch(/level 2 ranged spell attack \+8 vs ElderPaladin/);
    expect(entry.description).toMatch(/2d6/);
    expect(entry.description).not.toMatch(/half damage/i);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
  });

  it('refuses with no armed target: refusal popup + automation blocked log, zero roll, zero uses spend', async () => {
    renderDragon(false);
    await act(async () => { fireEvent.click(linkByText('Scorching Ray')); });

    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    const refusal = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'automation blocked');
    expect(refusal).toBeTruthy();
    expect(refusal.abilityName).toBe('Scorching Ray');
    expect(refusal.description).toMatch(/no armed target/);
    expect(setPopupHtml).toHaveBeenCalled();
    expect(rollAttack).not.toHaveBeenCalled();
    expect(rollSavingThrow).not.toHaveBeenCalled();
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
  });
});
