// MA-0536 data lock: Cultist Hierophant Spellcasting is the MA-0532 Cultist
// Fanatic twin (MA-0421 markup gap, save fields already authored) plus a
// homebrew aggravator. Pre-fix ONLY tier headers carried <strong>; Mage Armor/
// Thaumaturgy/Jallarsi's Storm of Radiance/Mass Suggestion were plain text —
// extractSpellNamesFromSpellcasting returned [] and extractSpellcastingSpellUses
// returned {} → SpellCastLinks null → zero chips, zero counters, orphaned row
// numeric save_dc 17 + save_type Charisma. DATA fix: <em> on each spell name,
// headers byte-kept. HOMEBREW DECISION: "Jallarsi's Storm of Radiance" is
// grep-zero RAW app-wide → registered honest homebrew entry in spells.json
// (level 7, 1 action, Self, CHA save DC-by-caster, no invented damage/duration)
// so findMonsterSpell resolves the chip and the cast logs advisory-clean
// (no damage/no "or be X" clause → CLA-325 advisory, console error-free).
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { extractSpellNamesFromSpellcasting, extractSpellcastingSpellUses, spellHasDamage, spellDamagelessSaveCondition } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const spells5e = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));

const ch = monsters.find(m => m.index === 'cultist-hierophant');
const chRow = ch.actions.find(a => a.name === 'Spellcasting');
const MASS_SUGGESTION = spells5e.find(s => s.name === 'Mass Suggestion');
const THAUMATURGY = spells5e.find(s => s.name === 'Thaumaturgy');
const MAGE_ARMOR = spells5e.find(s => s.name === 'Mage Armor');
const JALLARSI = spells5e.find(s => s.name === "Jallarsi's Storm of Radiance");

const REAL_SPELLS = ['Mage Armor', 'Thaumaturgy', "Jallarsi's Storm of Radiance", 'Mass Suggestion'];

const CH_PLAIN_ORIGINAL = 'The cultist casts one of the following spells, using Charisma as the spellcasting ability (spell save DC 17):\nAt Will: Mage Armor (included in AC), Thaumaturgy\n1/Day Each: Jallarsi\'s Storm of Radiance (level 7 version), Mass Suggestion';
const stripTags = (d) => d.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '');

const MONSTER_NAME = 'Cultist Hierophant 1';

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 9, rolls: [2, 4, 3], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 18, rolls: [2, 4, 3, 2, 4, 3], modifier: 0 })),
}));

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSpells: vi.fn((version) => Promise.resolve(version === '2024' ? [] : [MAGE_ARMOR, THAUMATURGY, JALLARSI, MASS_SUGGESTION])),
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
  rangeToFeet: vi.fn((r) => (typeof r === 'number' ? r : 60)),
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
    key: (characterKey, propertyName) => `${characterKey}.${propertyName}`,
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

const rollSavingThrow = useLoggedDiceRoll._rollSavingThrow;

function spellLinks() {
  return Array.from(document.querySelectorAll('.mc-dice-link-spell'));
}

function linkByText(text) {
  return Array.from(document.querySelectorAll('.mc-dice-link')).find(el => el.textContent.includes(text)) || null;
}

function abilityUseEntries(name) {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'ability_use' && e.abilityName === name);
}

function refusals(name) {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'automation blocked' && e.abilityName === name);
}

function renderHierophant(armed = true) {
  const m = makeMonster({ name: 'Cultist Hierophant', actions: [chRow] });
  const creatures = [
    { name: MONSTER_NAME, type: 'npc', monsterType: 'humanoid', targetName: armed ? 'Bandit' : null, ac: 16, currentHp: 144, maxHp: 144, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: MONSTER_NAME, creatures })} />);
}

// ── Data lock: cultist-hierophant Spellcasting row ───────────────────────────

describe('MA-0536 monsters.json data lock: Cultist Hierophant Spellcasting row', () => {
  it('extracts all four spell names as chips — headers skipped', () => {
    const names = extractSpellNamesFromSpellcasting(chRow.description);
    expect(names).toEqual(REAL_SPELLS);
    expect(names).not.toContain('At Will');
    expect(names).not.toContain('1/Day Each');
  });

  it('binds the 1/Day Each gate to exactly the two marked 1/Day names; At Will ungated', () => {
    expect(extractSpellcastingSpellUses(chRow.description)).toEqual({ "Jallarsi's Storm of Radiance": 1, 'Mass Suggestion': 1 });
  });

  it('save fields already authored, untouched — numeric save_dc 17 + save_type Charisma', () => {
    expect(chRow.save_dc).toBe(17);
    expect(chRow.save_type).toBe('Charisma');
    expect(chRow.spell_save_dc).toBe(17);
    expect(chRow.spellcasting_ability).toBe('Charisma');
    expect(chRow.description).toMatch(/spell save DC 17/);
  });

  it('DC 17 = 8 + CHA +5 + PB +4 for the cultist hierophant', () => {
    expect(ch.ability_score_modifiers.cha).toBe(5);
    expect(ch.proficiency_bonus).toBe(4);
    expect(8 + ch.ability_score_modifiers.cha + ch.proficiency_bonus).toBe(17);
  });

  it('markup-only diff proof: stripped text equals the pre-fix description byte-for-byte', () => {
    expect(stripTags(chRow.description)).toBe(CH_PLAIN_ORIGINAL);
  });
});

// ── spells.json registration pin (homebrew decision: registered-homebrew) ────

describe('MA-0536 spells.json registration pin', () => {
  it('all four names resolve via the findMonsterSpell 5e-first lookup', () => {
    for (const name of REAL_SPELLS) {
      expect(spells5e.find(s => s.name === name), name).toBeTruthy();
    }
  });

  it('Jallarsi\'s Storm of Radiance registered honest homebrew: level 7, 1 action, Self, CHA save DC-by-caster', () => {
    expect(JALLARSI, 'homebrew entry must exist').toBeTruthy();
    expect(JALLARSI.index).toBe('jallarsis-storm-of-radiance');
    expect(JALLARSI.level).toBe(7);
    expect(JALLARSI.casting_time).toBe('1 action');
    expect(JALLARSI.range).toBe('Self');
    expect(JALLARSI.dc).toEqual({ dc_type: 'CHA', dc_success: 'none' });
  });

  it('no invented numbers: no damage, no duration, no area fields on the homebrew entry', () => {
    expect(JALLARSI.damage ?? null).toBeNull();
    expect(JALLARSI.duration ?? null).toBeNull();
    expect(JALLARSI.area_of_effect ?? null).toBeNull();
    expect(JALLARSI.attack_type ?? null).toBeNull();
  });

  it('homebrew routes advisory: spellHasDamage false AND no "or be X" save clause (CLA-325)', () => {
    expect(spellHasDamage(JALLARSI)).toBe(false);
    expect(spellDamagelessSaveCondition(JALLARSI)).toBeNull();
    expect(MASS_SUGGESTION.damage ?? null).toBeNull();
    expect(spellHasDamage(MASS_SUGGESTION)).toBe(false);
    expect(spellDamagelessSaveCondition(MASS_SUGGESTION)).toBeNull();
  });
});

// ── Modal: four chips, counters, gates ───────────────────────────────────────

describe('MA-0536 MonsterCardModal Cultist Hierophant Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders four spell chips — the zero-chip inert row is gone', () => {
    renderHierophant();
    const names = spellLinks().map(el => el.textContent.split('(')[0].trim());
    expect(names).toEqual(REAL_SPELLS);
  });

  it('Jallarsi and Mass Suggestion carry 1/Day counters; the two At Will names do not', () => {
    renderHierophant();
    expect(linkByText("Jallarsi's Storm of Radiance").textContent).toMatch(/\(1\/Day · 1 left\)/);
    expect(linkByText('Mass Suggestion').textContent).toMatch(/\(1\/Day · 1 left\)/);
    expect(linkByText('Mage Armor').textContent).not.toMatch(/\/Day/);
    expect(linkByText('Thaumaturgy').textContent).not.toMatch(/\/Day/);
  });

  it('At Will Thaumaturgy spends no uses and logs the row DC 17 + Charisma', async () => {
    renderHierophant();
    await act(async () => { fireEvent.click(linkByText('Thaumaturgy')); });

    await waitFor(() => expect(abilityUseEntries('Thaumaturgy').length).toBe(1));
    expect(abilityUseEntries('Thaumaturgy')[0].description).toMatch(/\(spell save DC 17, Charisma\)/);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
  });

  it('casts Mass Suggestion — advisory cast log prints row DC 17, spends 1 of 1', async () => {
    renderHierophant();
    await act(async () => { fireEvent.click(linkByText('Mass Suggestion')); });

    await waitFor(() => expect(abilityUseEntries('Mass Suggestion').length).toBe(1));
    const entry = abilityUseEntries('Mass Suggestion')[0];
    expect(entry.characterName).toBe(MONSTER_NAME);
    expect(entry.description).toMatch(/casts Mass Suggestion via Spellcasting \(spell save DC 17, WIS\)/);
    expect(entry.description).toMatch(/1\/Day use spent — 0 remaining today/);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Mass Suggestion': 1 });
  });

  it('refuses the second Mass Suggestion — 1/Day exhausted, zero re-spend', async () => {
    renderHierophant();
    await act(async () => { fireEvent.click(linkByText('Mass Suggestion')); });
    await waitFor(() => expect(abilityUseEntries('Mass Suggestion').length).toBe(1));

    await act(async () => { fireEvent.click(linkByText('Mass Suggestion')); });
    await waitFor(() => expect(refusals('Mass Suggestion').length).toBe(1));
    expect(abilityUseEntries('Mass Suggestion').length).toBe(1);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Mass Suggestion': 1 });
  });

  it('Jallarsi chip resolves console-error-free with an honest advisory log, spends its 1/Day', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderHierophant();
    await act(async () => { fireEvent.click(linkByText("Jallarsi's Storm of Radiance")); });

    await waitFor(() => expect(abilityUseEntries("Jallarsi's Storm of Radiance").length).toBe(1));
    const entry = abilityUseEntries("Jallarsi's Storm of Radiance")[0];
    expect(entry.description).toMatch(/casts Jallarsi's Storm of Radiance via Spellcasting \(spell save DC 17, CHA\)/);
    expect(entry.description).toMatch(/1\/Day use spent — 0 remaining today/);
    expect(errSpy).not.toHaveBeenCalled();
    expect(rollSavingThrow).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('refuses the second Jallarsi cast — 1/Day exhausted', async () => {
    renderHierophant();
    await act(async () => { fireEvent.click(linkByText("Jallarsi's Storm of Radiance")); });
    await waitFor(() => expect(abilityUseEntries("Jallarsi's Storm of Radiance").length).toBe(1));

    await act(async () => { fireEvent.click(linkByText("Jallarsi's Storm of Radiance")); });
    await waitFor(() => expect(refusals("Jallarsi's Storm of Radiance").length).toBe(1));
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ "Jallarsi's Storm of Radiance": 1 });
  });
});
