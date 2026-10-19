// @maintained-by-ai
// MA-0065 regression: Adult Brass Dragon Spellcasting — Scorching Ray is a
// RANGED SPELL ATTACK (+8 = PB+5 + CHA+3), not a block save and not an
// advisory-only record. The per-spell chip must resolve through the attack
// seam (MA-0033 shape): d20+8 vs the armed target, 2d6 Fire per ray on hit,
// spell-named cast log with isSpellDamage marker — NEVER the "Half damage on
// successful save" boilerplate. At Will spends no uses; refusals (no armed
// target) roll nothing and spend nothing.
// MA-0179/MA-0185 data locks ride here too: ancient-brass Spellcasting rows
// spell_attack_bonus 12 and its Blazing Light legendary row mirrors the
// verified adult-brass attack-row shape (ancient numerics).
// Cross-file owners (not re-pinned here): MA-0126
// MonsterCardModal.legendary-uses.test.jsx owns the 2024 spells.json
// scorching-ray raw bytes (attack_type ranged, 2d6 Fire slot 2, 120 ft);
// MA-0184 monsterLegendaryUses.test.js owns service-side ancient-brass
// legendary economy spends.
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

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSpells: vi.fn(() => Promise.resolve(SPELLS_5E)),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  const _popupHolder = { popupHtml: null };
  const _rollAttack = vi.fn();
  const _rollSavingThrow = vi.fn();
  const _setPopupHtml = vi.fn((val) => { _popupHolder.popupHtml = val; });

  const mockHook = vi.fn(() => ({
    popupHtml: _popupHolder.popupHtml,
    setPopupHtml: _setPopupHtml,
    rollAttack: _rollAttack,
    rollDamage: vi.fn(),
    rollAbilityCheck: vi.fn(),
    rollSavingThrow: _rollSavingThrow,
    rollSkillCheck: vi.fn(),
    rollInitiative: vi.fn(),
    quickRollPlayerSave: vi.fn(),
  }));

  return { default: mockHook, _rollAttack, _rollSavingThrow, _setPopupHtml };
});

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn(() => ({ ...defaultConditionEffects })),
  combineAttackModes: vi.fn(() => 'normal'),
  CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
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

describe('MA-0065 data lock — adult-brass Spellcasting row + 5e scorching-ray arm the attack seam', () => {
  it('row authors spell_attack_bonus 8 (+ prose); spells.json Scorching Ray is a ranged attack spell, 2d6 Fire per ray, cast at level 2', () => {
    const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
    const row = monsters.find(m => m.index === 'adult-brass-dragon').actions.find(a => a.name === 'Spellcasting');
    expect(extractSpellNamesFromSpellcasting(row.description)).toContain('Scorching Ray');
    expect(row.description).toMatch(/\+8 to hit with spell attacks/);
    expect(row.spell_attack_bonus).toBe(8);
    expect(monsterSpellAttackBonus(row)).toBe(8);

    const spells = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));
    const spell = spells.find(s => s.index === 'scorching-ray');
    expect(isSpellAttackSpell(spell)).toBe(true);
    expect(spell.level).toBe(2);
    expect(spellDamageFormulaAtLevel(spell, 2)).toBe('2d6');
    expect(spellDamageFormulaAtLevel(spell, 5)).toBe('2d6');
    expect(spellCastLevelFromSpellcasting(row.description, 'Scorching Ray', spell)).toBe(2);
  });
});

describe('MA-0179/MA-0185 data lock — ancient-brass authors +12 spell attack rows', () => {
  it('Spellcasting authors spell_attack_bonus 12 with Scorching Ray level 3 version; Blazing Light legendary row mirrors the verified adult-brass attack-row shape with ancient numerics', () => {
    const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
    const ancient = monsters.find(m => m.index === 'ancient-brass-dragon');
    const adult = monsters.find(m => m.index === 'adult-brass-dragon');

    const casting = ancient.actions.find(a => a.name === 'Spellcasting');
    expect(extractSpellNamesFromSpellcasting(casting.description)).toContain('Scorching Ray');
    expect(casting.description).toMatch(/Scorching Ray<\/em> \(level 3 version\)/);
    expect(casting.description).toMatch(/\+12 to hit with spell attacks/);
    expect(casting.spell_attack_bonus).toBe(12);
    expect(monsterSpellAttackBonus(casting)).toBe(12);

    const blazing = ancient.legendary_actions.find(a => a.name === 'Blazing Light');
    expect(blazing.attack_bonus).toBe(12);
    expect(blazing.spell_attack_bonus).toBe(12);
    expect(blazing.range).toBe('120 ft.');
    expect(blazing.damage_dice_primary).toBe('2d6');
    expect(blazing.damage_type_primary).toBe('Fire');
    expect(blazing.description).toMatch(/\+12 to hit/);
    expect(blazing.description).toMatch(/level 3 version/);
    expect(Object.keys(blazing).sort()).toEqual(Object.keys(adult.legendary_actions.find(a => a.name === 'Blazing Light')).sort());
  });
});

describe('MA-0065 MonsterCardModal — Scorching Ray casts as a spell attack, not a block save', () => {
  it('press routes through the attack seam exactly once (+8, 2d6 Fire, isSpellDamage, saveDc null), logs a spell-named level-2 cast with no Half-damage boilerplate, and At Will spends no uses', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderDragon(true);
    const link = linkByText('Scorching Ray');
    expect(link).toBeTruthy();
    await act(async () => { fireEvent.click(link); });

    await waitFor(() => expect(rollAttack).toHaveBeenCalledTimes(1));
    const [name, bonus, options] = rollAttack.mock.calls[0];
    expect(bonus).toBe(8);
    expect(name).toBe('Scorching Ray');
    expect(options.autoDamageFormula).toBe('2d6');
    expect(options.damageType).toBe('Fire');
    expect(options.targetName).toBe('ElderPaladin');
    expect(options.attackerName).toBe(MONSTER_NAME);
    expect(options.isSpellDamage).toBe(true);
    expect(options.saveDc).toBeNull();
    expect(rollSavingThrow).not.toHaveBeenCalled();

    const entry = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && e.abilityName === 'Scorching Ray');
    expect(entry).toBeTruthy();
    expect(entry.characterName).toBe(MONSTER_NAME);
    expect(entry.description).toMatch(/casts Scorching Ray via Spellcasting/);
    expect(entry.description).toMatch(/level 2 ranged spell attack \+8 vs ElderPaladin/);
    expect(entry.description).toMatch(/2d6/);
    expect(entry.description).not.toMatch(/half damage/i);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
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
