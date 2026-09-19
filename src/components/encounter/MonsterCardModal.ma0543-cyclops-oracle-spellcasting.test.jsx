// MA-0543 data lock: Cyclops Oracle Spellcasting rode the MA-0421/MA-0532
// markup-gap twin (save_dc 16 + save_type Wisdom already authored). Pre-fix
// ONLY the tier headers carried <strong>; Arcane Eye/Detect Magic/Locate
// Object/Legend Lore were plain text — extractSpellNamesFromSpellcasting
// returned [] (every marked token ended ':') and extractSpellcastingSpellUses
// returned {} (N/Day limits never bound unmarked names) → SpellCastLinks null
// → zero chips, zero counters; the row-level save_dc/save_type were orphaned
// by the Spellcasting-row fork (MA-0524). DATA fix: <em> on each spell name,
// Cultist Fanatic MA-0532 byte-shape; headers byte-kept. All four spells are
// damageless save-less utilities → MA-0012 advisory cast logs print the row
// DC 16 Wisdom; gates bind 2/Day Each + 1/Day via monsterSpellUses.
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { extractSpellNamesFromSpellcasting, extractSpellcastingSpellUses } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const spells5e = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));

const co = monsters.find(m => m.index === 'cyclops-oracle');
const coRow = co.actions.find(a => a.name === 'Spellcasting');
const ARCANE_EYE = spells5e.find(s => s.name === 'Arcane Eye');
const DETECT_MAGIC = spells5e.find(s => s.name === 'Detect Magic');
const LOCATE_OBJECT = spells5e.find(s => s.name === 'Locate Object');
const LEGEND_LORE = spells5e.find(s => s.name === 'Legend Lore');

const REAL_SPELLS = ['Arcane Eye', 'Detect Magic', 'Locate Object', 'Legend Lore'];

const CO_PLAIN_ORIGINAL = 'The cyclops casts one of the following spells, requiring no Material components and using Wisdom as the spellcasting ability (spell save DC 16):\n2/Day Each: Arcane Eye, Detect Magic, Locate Object\n1/Day: Legend Lore';
const stripTags = (d) => d.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '');

const MONSTER_NAME = 'Cyclops Oracle 1';

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
  loadSpells: vi.fn((version) => Promise.resolve(version === '2024' ? [] : [ARCANE_EYE, DETECT_MAGIC, LOCATE_OBJECT, LEGEND_LORE])),
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

function renderCyclops(armed = true) {
  const m = makeMonster({ name: 'Cyclops Oracle', actions: [coRow] });
  const creatures = [
    { name: MONSTER_NAME, type: 'npc', monsterType: 'giant', targetName: armed ? 'Bandit' : null, ac: 14, currentHp: 138, maxHp: 138, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: MONSTER_NAME, creatures })} />);
}

// ── Data lock: cyclops-oracle Spellcasting row ───────────────────────────────

describe('MA-0543 monsters.json data lock: Cyclops Oracle Spellcasting row', () => {
  it('extracts all four spell names as chips — headers skipped', () => {
    const names = extractSpellNamesFromSpellcasting(coRow.description);
    expect(names).toEqual(REAL_SPELLS);
    expect(names).not.toContain('2/Day Each');
    expect(names).not.toContain('1/Day');
  });

  it('binds the N/Day gates to exactly the marked names: 2/Day Each trio + Legend Lore 1', () => {
    expect(extractSpellcastingSpellUses(coRow.description)).toEqual({ 'Arcane Eye': 2, 'Detect Magic': 2, 'Locate Object': 2, 'Legend Lore': 1 });
  });

  it('save fields authored — numeric save_dc 16 + save_type Wisdom', () => {
    expect(coRow.save_dc).toBe(16);
    expect(coRow.save_type).toBe('Wisdom');
    expect(coRow.spell_save_dc).toBe(16);
    expect(coRow.spellcasting_ability).toBe('Wisdom');
    expect(coRow.description).toMatch(/spell save DC 16/);
  });

  it('DC 16 = 8 + WIS +4 + PB +4 for the cyclops oracle', () => {
    expect(co.ability_score_modifiers.wis).toBe(4);
    expect(co.proficiency_bonus).toBe(4);
    expect(8 + co.ability_score_modifiers.wis + co.proficiency_bonus).toBe(16);
  });

  it('markup-only diff proof: stripped text equals the pre-fix description byte-for-byte', () => {
    expect(stripTags(coRow.description)).toBe(CO_PLAIN_ORIGINAL);
  });

  it('all four spells registered, damageless and save-less → advisory path', () => {
    for (const sp of [ARCANE_EYE, DETECT_MAGIC, LOCATE_OBJECT, LEGEND_LORE]) {
      expect(sp).toBeTruthy();
      expect(sp.damage ?? null).toBeNull();
      expect(sp.dc ?? null).toBeNull();
    }
  });
});

// ── Modal: four chips, counters, gates ────────────────────────────────────────

describe('MA-0543 MonsterCardModal Cyclops Oracle Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders four spell chips — the zero-chip inert row is gone', () => {
    renderCyclops();
    const names = spellLinks().map(el => el.textContent.split('(')[0].trim());
    expect(names).toEqual(REAL_SPELLS);
  });

  it('all four carry counters: trio 2/Day · 2 left, Legend Lore 1/Day · 1 left', () => {
    renderCyclops();
    expect(linkByText('Arcane Eye').textContent).toMatch(/\(2\/Day · 2 left\)/);
    expect(linkByText('Detect Magic').textContent).toMatch(/\(2\/Day · 2 left\)/);
    expect(linkByText('Locate Object').textContent).toMatch(/\(2\/Day · 2 left\)/);
    expect(linkByText('Legend Lore').textContent).toMatch(/\(1\/Day · 1 left\)/);
  });

  it('casts Detect Magic — advisory log prints row DC 16 Wisdom, spends 1 of 2', async () => {
    renderCyclops();
    await act(async () => { fireEvent.click(linkByText('Detect Magic')); });

    await waitFor(() => expect(abilityUseEntries('Detect Magic').length).toBe(1));
    const entry = abilityUseEntries('Detect Magic')[0];
    expect(entry.characterName).toBe(MONSTER_NAME);
    expect(entry.description).toMatch(/casts Detect Magic via Spellcasting \(spell save DC 16, Wisdom\)/);
    expect(entry.description).toMatch(/2\/Day use spent — 1 remaining today/);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Detect Magic': 1 });
  });

  it('refuses the third Detect Magic — 2/Day exhausted, zero re-spend', async () => {
    renderCyclops();
    await act(async () => { fireEvent.click(linkByText('Detect Magic')); });
    await waitFor(() => expect(abilityUseEntries('Detect Magic').length).toBe(1));
    await act(async () => { fireEvent.click(linkByText('Detect Magic')); });
    await waitFor(() => expect(abilityUseEntries('Detect Magic').length).toBe(2));
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Detect Magic': 2 });

    await act(async () => { fireEvent.click(linkByText('Detect Magic')); });
    await waitFor(() => expect(refusals('Detect Magic').length).toBe(1));
    expect(abilityUseEntries('Detect Magic').length).toBe(2);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Detect Magic': 2 });
  });

  it('refuses the second Legend Lore — 1/Day exhausted', async () => {
    renderCyclops();
    await act(async () => { fireEvent.click(linkByText('Legend Lore')); });
    await waitFor(() => expect(abilityUseEntries('Legend Lore').length).toBe(1));
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Legend Lore': 1 });

    await act(async () => { fireEvent.click(linkByText('Legend Lore')); });
    await waitFor(() => expect(refusals('Legend Lore').length).toBe(1));
    expect(abilityUseEntries('Legend Lore').length).toBe(1);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Legend Lore': 1 });
  });
});
