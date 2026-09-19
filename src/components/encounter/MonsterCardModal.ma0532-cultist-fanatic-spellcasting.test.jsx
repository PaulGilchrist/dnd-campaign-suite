// MA-0532 data lock: Cultist Fanatic Spellcasting rode the MA-0421/MA-0500
// markup-gap template (save fields already authored). Pre-fix ONLY the tier
// headers carried <strong>; Light/Thaumaturgy/Command/Hold Person were plain
// text — extractSpellNamesFromSpellcasting returned [] (every marked token
// ends ':') and extractSpellcastingSpellUses returned {} (N/Day limit never
// binds an unmarked name) → SpellCastLinks null → zero chips, zero counters,
// and the row-level numeric save_dc 12 + save_type Wisdom were orphaned by
// the Spellcasting-row fork (MA-0524). DATA fix: <em> on each spell name,
// Couatl MA-0524 byte-shape; headers byte-kept. Command is damageless with
// "or follow the command" (no "or be X" clause) → CLA-325 advisory cast log
// printing the row DC; Hold Person carries "or be paralyzed" → MA-0348
// damageless save-prompt seam at DC 12 WIS.
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { extractSpellNamesFromSpellcasting, extractSpellcastingSpellUses } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const spells5e = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));

const cf = monsters.find(m => m.index === 'cultist-fanatic');
const cfRow = cf.actions.find(a => a.name === 'Spellcasting');
const COMMAND = spells5e.find(s => s.name === 'Command');
const HOLD_PERSON = spells5e.find(s => s.name === 'Hold Person');
const LIGHT = spells5e.find(s => s.name === 'Light');

const REAL_SPELLS = ['Light', 'Thaumaturgy', 'Command', 'Hold Person'];

const CF_PLAIN_ORIGINAL = 'The cultist casts one of the following spells, using Wisdom as the spellcasting ability (spell save DC 12, +4 to hit with spell attacks):\nAt Will: Light, Thaumaturgy\n2/Day: Command\n1/Day: Hold Person';
const stripTags = (d) => d.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '');

const MONSTER_NAME = 'Cultist Fanatic 1';

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
  loadSpells: vi.fn((version) => Promise.resolve(version === '2024' ? [] : [COMMAND, HOLD_PERSON, LIGHT])),
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
const rollAttack = useLoggedDiceRoll._rollAttack;

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

function renderCultist(armed = true) {
  const m = makeMonster({ name: 'Cultist Fanatic', actions: [cfRow] });
  const creatures = [
    { name: MONSTER_NAME, type: 'npc', monsterType: 'humanoid', targetName: armed ? 'Bandit' : null, ac: 13, currentHp: 44, maxHp: 44, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: MONSTER_NAME, creatures })} />);
}

// ── Data lock: cultist-fanatic Spellcasting row ─────────────────────────────

describe('MA-0532 monsters.json data lock: Cultist Fanatic Spellcasting row', () => {
  it('extracts all four spell names as chips — headers skipped', () => {
    const names = extractSpellNamesFromSpellcasting(cfRow.description);
    expect(names).toEqual(REAL_SPELLS);
    expect(names).not.toContain('At Will');
    expect(names).not.toContain('2/Day');
    expect(names).not.toContain('1/Day');
  });

  it('binds the N/Day gate to exactly the marked names: Command 2, Hold Person 1; At Will ungated', () => {
    expect(extractSpellcastingSpellUses(cfRow.description)).toEqual({ Command: 2, 'Hold Person': 1 });
  });

  it('save fields already authored — numeric save_dc 12 + save_type Wisdom', () => {
    expect(cfRow.save_dc).toBe(12);
    expect(cfRow.save_type).toBe('Wisdom');
    expect(cfRow.spell_save_dc).toBe(12);
    expect(cfRow.spellcasting_ability).toBe('Wisdom');
    expect(cfRow.description).toMatch(/spell save DC 12/);
  });

  it('DC 12 = 8 + WIS +2 + PB +2 for the cultist fanatic', () => {
    expect(cf.ability_score_modifiers.wis).toBe(2);
    expect(cf.proficiency_bonus).toBe(2);
    expect(8 + cf.ability_score_modifiers.wis + cf.proficiency_bonus).toBe(12);
  });

  it('markup-only diff proof: stripped text equals the pre-fix description byte-for-byte', () => {
    expect(stripTags(cfRow.description)).toBe(CF_PLAIN_ORIGINAL);
  });

  it('Command is damageless "or follow" (advisory CLA-325); Hold Person carries the "or be paralyzed" save leg', () => {
    expect(COMMAND.damage ?? null).toBeNull();
    expect(COMMAND.area_of_effect ?? null).toBeNull();
    expect(COMMAND.dc).toEqual(expect.objectContaining({ dc_type: 'WIS', dc_success: 'none' }));
    expect(COMMAND.description.join ? COMMAND.description.join(' ') : COMMAND.description).toMatch(/or follow the command/);
    expect(HOLD_PERSON.damage ?? null).toBeNull();
    expect(HOLD_PERSON.area_of_effect ?? null).toBeNull();
    expect(HOLD_PERSON.dc).toEqual(expect.objectContaining({ dc_type: 'WIS', dc_success: 'none' }));
    expect(HOLD_PERSON.description.join ? HOLD_PERSON.description.join(' ') : HOLD_PERSON.description).toMatch(/or be paralyzed/);
  });
});

// ── Modal: four chips, counters, gates ───────────────────────────────────────

describe('MA-0532 MonsterCardModal Cultist Fanatic Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders four spell chips — the zero-chip inert row is gone', () => {
    renderCultist();
    const names = spellLinks().map(el => el.textContent.split('(')[0].trim());
    expect(names).toEqual(REAL_SPELLS);
  });

  it('Command and Hold Person carry counters; the two At Will names do not', () => {
    renderCultist();
    expect(linkByText('Command').textContent).toMatch(/\(2\/Day · 2 left\)/);
    expect(linkByText('Hold Person').textContent).toMatch(/\(1\/Day · 1 left\)/);
    expect(linkByText('Light').textContent).not.toMatch(/\/Day/);
    expect(linkByText('Thaumaturgy').textContent).not.toMatch(/\/Day/);
  });

  it('casts Command — advisory cast log prints row DC 12 + Wisdom, spends 1 of 2', async () => {
    renderCultist();
    await act(async () => { fireEvent.click(linkByText('Command')); });

    await waitFor(() => expect(abilityUseEntries('Command').length).toBe(1));
    const entry = abilityUseEntries('Command')[0];
    expect(entry.characterName).toBe(MONSTER_NAME);
    expect(entry.description).toMatch(/casts Command via Spellcasting \(spell save DC 12, WIS\)/);
    expect(entry.description).toMatch(/2\/Day use spent — 1 remaining today/);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ Command: 1 });
  });

  it('refuses the third Command — 2/Day exhausted, zero re-spend', async () => {
    renderCultist();
    await act(async () => { fireEvent.click(linkByText('Command')); });
    await waitFor(() => expect(abilityUseEntries('Command').length).toBe(1));
    await act(async () => { fireEvent.click(linkByText('Command')); });
    await waitFor(() => expect(abilityUseEntries('Command').length).toBe(2));
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ Command: 2 });

    await act(async () => { fireEvent.click(linkByText('Command')); });
    await waitFor(() => expect(refusals('Command').length).toBe(1));
    expect(abilityUseEntries('Command').length).toBe(2);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ Command: 2 });
  });

  it('Hold Person routes the DC-12 Wisdom save seam and spends its 1/Day', async () => {
    renderCultist();
    await act(async () => { fireEvent.click(linkByText('Hold Person')); });

    await waitFor(() => expect(rollSavingThrow).toHaveBeenCalled());
    const context = rollSavingThrow.mock.calls[0][2];
    expect(context.spellName).toBe('Hold Person');
    expect(context.saveDc).toBe(12);
    expect(context.saveType).toBe('WIS');
    expect(context.targetName).toBe('Bandit');
    expect(context.autoDamageFormula ?? null).toBeNull();
    expect(rollAttack).not.toHaveBeenCalled();
  });

  it('refuses the second Hold Person — 1/Day exhausted', async () => {
    renderCultist();
    await act(async () => { fireEvent.click(linkByText('Hold Person')); });
    await waitFor(() => expect(rollSavingThrow).toHaveBeenCalledTimes(1));
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Hold Person': 1 });

    await act(async () => { fireEvent.click(linkByText('Hold Person')); });
    await waitFor(() => expect(refusals('Hold Person').length).toBe(1));
    expect(rollSavingThrow).toHaveBeenCalledTimes(1);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Hold Person': 1 });
  });

  it('At Will Light/Thaumaturgy spend no uses and log the row DC 12', async () => {
    renderCultist();
    await act(async () => { fireEvent.click(linkByText('Light')); });
    await act(async () => { fireEvent.click(linkByText('Thaumaturgy')); });

    await waitFor(() => expect(abilityUseEntries('Light').length).toBe(1));
    expect(abilityUseEntries('Light')[0].description).toMatch(/\(spell save DC 12/);
    await waitFor(() => expect(abilityUseEntries('Thaumaturgy').length).toBe(1));
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
  });
});
