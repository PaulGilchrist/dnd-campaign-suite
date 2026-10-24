// @maintained-by-ai
// MA-0033 regression: Adult Black Dragon Spellcasting — Melf's Acid Arrow
// (level 3 version) is a RANGED SPELL ATTACK (+9), not a save spell. The
// per-spell chip must resolve through the attack seam (MA-0022 delegated roll
// shape): d20+9 vs the armed target, lv3 upcast formula 5d4 from the authored
// "(level 3 version)" prose, spell-named logs, isSpellDamage marker — never
// a block-save prompt or "Half damage on successful save" boilerplate.
// MA-0245 rides here too: 5e-first lookup of Ice Knife (5e spells.json once
// lacked attack_type → DC-Unknown save-path misroute) casts as spell attack
// +15 lv2 for Ancient Silver Dragon, bonus resolving from row prose.
// Cross-file owners (not re-pinned here): helper unit parses — isSpellAttackSpell
// true bytes ma0452-bullywug:189 / scorching-ray:138, save-route negatives
// spellcasting.test.jsx:227/:246, spellCastLevelFromSpellcasting + upcast
// formula MonsterCardHelpers.ma1202:52-55 ("MA-0033 upcast lane") / barlgura:146-148,
// monsterSpellAttackBonus authored ma0452:176 / scorching-ray:134, prose
// fallback ma1850-archlich:170. Generic spell-attack press template, At-Will
// ungating, and no-armed-target refusal (identical spell-agnostic lane code):
// scorching-ray.test.jsx:172-201/:203-216; generic spellcast cites
// spellcasting.test.jsx:193/:276/:282-303/:318/:512-540/:551.
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { isSpellAttackSpell, spellDamageFormulaAtLevel, monsterSpellAttackBonus, extractSpellNamesFromSpellcasting } from './MonsterCardHelpers.js';

const SPELLCASTING = {
  name: 'Spellcasting',
  description: 'The dragon casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 17, +9 to hit with spell attacks):<br><strong>At Will:</strong> <em>Detect Magic</em>, <em>Fear</em>, <strong>Melf\'s Acid Arrow</strong> (level 3 version)<br><strong>1/Day Each:</strong> <em>Speak with Dead</em>, <em>Vitriolic Sphere</em>',
  save_dc: 17,
  save_type: 'Charisma',
  spell_attack_bonus: 9,
};

// Concentrated ranged spell attack (MA-0033 sibling face): the cast log must
// carry a "Concentration (duration)" note when the spell DB says so.
const WITCH_BOLT = {
  name: 'Witch Bolt', level: 1, attack_type: 'ranged', concentration: true, duration: 'Concentration, up to 1 minute', range: '30 feet',
  damage: { damage_type: 'Lightning', damage_at_slot_level: { 1: '1d12' } }, dc: null,
};

// MA-0245: the 5e-first lookup face. Attack seam resolves the bonus from the
// row PROSE (+15, no spell_attack_bonus field) and the lv2 upcast prose.
const ICE_KNIFE_5E = {
  name: 'Ice Knife', level: 1, attack_type: 'ranged', concentration: false, duration: 'Instantaneous', range: '60 feet',
  damage: { damage_type: 'Piercing', damage_at_slot_level: { 1: '1d10 plus 1d6', 2: '1d10 plus 2d6' } },
  dc: null,
};

const SPELLS_5E = [
  { name: 'Detect Magic', level: 1, concentration: true, duration: 'Up to 10 minutes', damage: null, dc: null },
  { name: 'Fear', level: 3, concentration: true, duration: 'Concentration, up to 1 minute', damage: null, dc: { dc_type: 'WIS', dc_success: 'none' } },
  ICE_KNIFE_5E,
];
const SPELLS_2024 = [
  { name: 'Melf\'s Acid Arrow', level: 2, attack_type: 'ranged', concentration: false, duration: 'Instantaneous', range: '90 feet', damage: { damage_type: 'Acid', damage_at_slot_level: { 2: '4d4', 3: '5d4' } }, dc: null },
  WITCH_BOLT,
];

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSpells: vi.fn((version) => Promise.resolve(version === '2024' ? SPELLS_2024 : SPELLS_5E)),
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

const MONSTER_NAME = 'Adult Black Dragon 1';
const SILVER_NAME = 'Ancient Silver Dragon 1';

const SILVER_SPELLCASTING = {
  name: 'Spellcasting',
  description: 'The dragon casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 23, +15 to hit with spell attacks):<br><strong>At Will:</strong> <em>Ice Knife</em> (level 2 version)<br><strong>1/Day Each:</strong> <em>Ice Storm</em> (level 7 version)',
  save_dc: 23,
  save_type: 'Charisma',
};

function linkByText(text) {
  return Array.from(document.querySelectorAll('.mc-dice-link')).find(el => el.textContent.includes(text)) || null;
}

function renderCaster(creatureName, targetName, castingRow, monsterName = 'Dragon') {
  const creatures = [
    { name: creatureName, type: 'npc', targetName, ac: 22 },
    { name: 'DivinationWizard', type: 'player', ac: 13 },
    { name: 'ElderPaladin', type: 'player', ac: 19 },
  ];
  const m = makeMonster({ name: monsterName, actions: [castingRow] });
  const props = makeProps(m, { creatureName, creatures });
  render(<MonsterCardModal {...props} />);
}

function press(spellName) {
  return act(async () => { fireEvent.click(linkByText(spellName)); });
}

function castEntry(abilityName) {
  return addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && e.abilityName === abilityName);
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
});

describe('MA-0033 disk data — adult-black-dragon Spellcasting row arms the upcast attack seam', () => {
  it('enumerates Melf\'s Acid Arrow in strong markup; authors spell_attack_bonus 9, +9 prose, and "(level 3 version)"', () => {
    const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
    const row = monsters.find(m => m.index === 'adult-black-dragon').actions.find(a => a.name === 'Spellcasting');
    expect(extractSpellNamesFromSpellcasting(row.description)).toContain('Melf\'s Acid Arrow');
    expect(row.spell_attack_bonus).toBe(9);
    expect(monsterSpellAttackBonus(row)).toBe(9);
    expect(row.description).toMatch(/\+9 to hit with spell attacks/);
    expect(row.description).toMatch(/level 3 version/);
  });
});

describe('MA-0033 MonsterCardModal — Melf\'s Acid Arrow casts as an upcast spell attack, not a save', () => {
  it('press routes the lv3 upcast through the attack seam exactly once (+9 from authored bonus, 5d4 Acid, isSpellDamage, saveDc null), logs a spell-named level-3 cast with no Half-damage and no Concentration note, At Will spends no uses, zero console errors', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderCaster(MONSTER_NAME, 'DivinationWizard', SPELLCASTING, 'Adult Black Dragon');
    const link = linkByText('Melf\'s Acid Arrow');
    expect(link).toBeTruthy();
    await press('Melf\'s Acid Arrow');

    await waitFor(() => expect(rollAttack).toHaveBeenCalledTimes(1));
    const [name, bonus, options] = rollAttack.mock.calls[0];
    expect(name).toBe('Melf\'s Acid Arrow');
    expect(bonus).toBe(9);
    expect(options.autoDamageFormula).toBe('5d4');
    expect(options.damageType).toBe('Acid');
    expect(options.targetName).toBe('DivinationWizard');
    expect(options.attackerName).toBe(MONSTER_NAME);
    expect(options.isSpellDamage).toBe(true);
    expect(options.saveDc).toBeNull();
    expect(rollSavingThrow).not.toHaveBeenCalled();

    const entry = castEntry('Melf\'s Acid Arrow');
    expect(entry).toBeTruthy();
    expect(entry.characterName).toBe(MONSTER_NAME);
    expect(entry.description).toMatch(/casts Melf's Acid Arrow via Spellcasting/);
    expect(entry.description).toMatch(/level 3 ranged spell attack \+9 vs DivinationWizard/);
    expect(entry.description).toMatch(/5d4/);
    expect(entry.description).toMatch(/GM-enforced for monsters/);
    expect(entry.description).not.toMatch(/half damage/i);
    expect(entry.description).not.toMatch(/Concentration/i);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('a concentration: true attack spell records a "Concentration (duration)" note in its cast log', async () => {
    renderCaster(MONSTER_NAME, 'DivinationWizard', {
      ...SPELLCASTING,
      description: 'The dragon casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 17, +9 to hit with spell attacks):<br><strong>At Will:</strong> <em>Witch Bolt</em>',
    }, 'Adult Black Dragon');
    await press('Witch Bolt');

    await waitFor(() => expect(rollAttack).toHaveBeenCalledTimes(1));
    const [name, bonus, options] = rollAttack.mock.calls[0];
    expect(name).toBe('Witch Bolt');
    expect(bonus).toBe(9);
    expect(options.autoDamageFormula).toBe('1d12');
    expect(options.damageType).toBe('Lightning');
    expect(rollSavingThrow).not.toHaveBeenCalled();

    const entry = castEntry('Witch Bolt');
    expect(entry).toBeTruthy();
    expect(entry.description).toMatch(/Concentration \(Concentration, up to 1 minute\)/);
  });
});

describe('MA-0245 disk data — 5e Ice Knife attack_type + ancient-silver prose bonus arm the seam', () => {
  it('5e spells.json Ice Knife authors attack_type ranged (the MA-0245 fix; 2024 sibling agrees, lv2 formula 1d10 plus 2d6); ancient-silver row authors save_dc 23 + Charisma and +15 parses from prose', () => {
    const spells = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));
    const ik = spells.find(s => s.name === 'Ice Knife');
    expect(ik.attack_type).toBe('ranged');
    expect(isSpellAttackSpell(ik)).toBe(true);
    expect(spellDamageFormulaAtLevel(ik, 2)).toBe('1d10 plus 2d6');
    const spells2024 = JSON.parse(readFileSync('public/data/2024/spells.json', 'utf8'));
    expect(spells2024.find(s => s.name === 'Ice Knife').attack_type).toBe('ranged');

    const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
    const dragon = monsters.find(m => m.index === 'ancient-silver-dragon');
    const row = dragon.actions.find(a => a.name === 'Spellcasting');
    expect(row.save_dc).toBe(23);
    expect(row.save_type).toBe('Charisma');
    expect(8 + dragon.proficiency_bonus + dragon.ability_score_modifiers.cha).toBe(23);
    expect(row).not.toHaveProperty('spell_attack_bonus'); // why +15 resolves from prose
    expect(monsterSpellAttackBonus(row)).toBe(15);
    expect(extractSpellNamesFromSpellcasting(row.description)).toContain('Ice Knife');
  });
});

describe('MA-0245 MonsterCardModal — Ice Knife casts spell attack +15 lv2, never the DC-Unknown save path', () => {
  it('5e-first press routes through the attack seam exactly once (+15 from prose, lv2 1d10 plus 2d6 Piercing, isSpellDamage), logs a spell-named level-2 cast with no DC Unknown / half boilerplate popups, spends no uses', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderCaster(SILVER_NAME, 'ElderPaladin', SILVER_SPELLCASTING, 'Ancient Silver Dragon');
    const link = linkByText('Ice Knife');
    expect(link).toBeTruthy();
    await press('Ice Knife');

    await waitFor(() => expect(rollAttack).toHaveBeenCalledTimes(1));
    const [name, bonus, options] = rollAttack.mock.calls[0];
    expect(name).toBe('Ice Knife');
    expect(bonus).toBe(15);
    expect(options.autoDamageFormula).toBe('1d10 plus 2d6');
    expect(options.damageType).toBe('Piercing');
    expect(options.targetName).toBe('ElderPaladin');
    expect(options.attackerName).toBe(SILVER_NAME);
    expect(options.isSpellDamage).toBe(true);
    expect(rollSavingThrow).not.toHaveBeenCalled();

    const popups = setPopupHtml.mock.calls.map(c => String(c[0]));
    expect(popups.some(p => /DC Unknown/i.test(p))).toBe(false);

    const entry = castEntry('Ice Knife');
    expect(entry).toBeTruthy();
    expect(entry.characterName).toBe(SILVER_NAME);
    expect(entry.description).toMatch(/casts Ice Knife via Spellcasting/);
    expect(entry.description).toMatch(/level 2 ranged spell attack \+15 vs ElderPaladin/);
    expect(entry.description).toMatch(/1d10 plus 2d6/);
    expect(entry.description).toMatch(/GM-enforced for monsters/);
    expect(entry.description).not.toMatch(/DC Unknown/i);
    expect(entry.description).not.toMatch(/half damage/i);
    expect(runtime.store[`${SILVER_NAME}.monsterSpellUses`] ?? null).toBeNull();
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
