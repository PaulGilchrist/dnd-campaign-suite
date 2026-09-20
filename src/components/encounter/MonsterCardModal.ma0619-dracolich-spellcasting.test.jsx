// MA-0619 data lock: Dracolich Spellcasting rode the MA-0421/MA-0524/MA-0532/
// MA-0576/MA-0611 twin markup-gap template. Pre-fix ONLY the two tier headers
// carried <strong>; Detect Magic/Ray of Sickness/Create Undead/Finger of Death
// were plain text — extractSpellNamesFromSpellcasting returned [] and
// extractSpellcastingSpellUses returned {} → SpellCastLinks null → zero chips,
// 1/Day uses invisible AND ungated, and the orphaned spell_save_dc 19 never
// reached buildAbilitySaveRollContext (MA-0532 fork / MA-0614 spell_save_dc-only
// fingerprint). DATA fix: <strong> on each spell name (headers byte-kept,
// level parentheticals OUTSIDE the tag, strip-tags byte-equality) + trailing
// row-level numeric save_dc 19 + save_type "Charisma" pair (MA-0454/§164).
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { extractSpellNamesFromSpellcasting, extractSpellcastingSpellUses } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const spells5e = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));
const spells2024 = JSON.parse(readFileSync('public/data/2024/spells.json', 'utf8'));

const dracolich = monsters.find(m => m.index === 'dracolich');
const dracolichRow = dracolich.actions.find(a => a.name === 'Spellcasting');
const NAMES = ['Detect Magic', 'Ray of Sickness', 'Create Undead', 'Finger of Death'];
const ONE_DAY = ['Create Undead', 'Finger of Death'];
const AT_WILL = ['Detect Magic', 'Ray of Sickness'];
const SPELLS_5E = NAMES.map(n => spells5e.find(s => s.name === n)).filter(Boolean);
const SPELLS_2024 = NAMES.map(n => spells2024.find(s => s.name === n)).filter(Boolean);

const DRACOLICH_PLAIN_ORIGINAL = 'The dracolich casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 19, +11 to hit with spell attacks):\nAt Will: Detect Magic, Ray of Sickness (level 2 version)\n1/Day Each: Create Undead (level 8 version), Finger of Death';
const stripTags = (d) => d.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '');

const MONSTER_NAME = 'Dracolich 1';

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
  loadSpells: vi.fn((ruleset) => Promise.resolve(ruleset === '2024' ? SPELLS_2024 : SPELLS_5E)),
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

function renderDracolich() {
  const m = makeMonster({ name: 'Dracolich', actions: [dracolichRow] });
  const creatures = [
    { name: MONSTER_NAME, type: 'npc', monsterType: 'undead', targetName: 'Bandit', ac: 19, currentHp: 228, maxHp: 228, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: MONSTER_NAME, creatures })} />);
}

// ── Data lock: dracolich Spellcasting row ────────────────────────────────────

describe('MA-0619 monsters.json data lock: Dracolich Spellcasting row', () => {
  it('extracts all four spell names as chips — tier headers skipped', () => {
    const names = extractSpellNamesFromSpellcasting(dracolichRow.description);
    expect(names).toEqual(NAMES);
    expect(names).not.toContain('At Will');
    expect(names).not.toContain('1/Day Each');
  });

  it('binds 1/Day Each to the two marked names; At Will ungated', () => {
    const uses = extractSpellcastingSpellUses(dracolichRow.description);
    expect(uses).toEqual({ 'Create Undead': 1, 'Finger of Death': 1 });
    AT_WILL.forEach(n => expect(uses[n]).toBeUndefined());
  });

  it('row-level numeric save_dc 19 + save_type Charisma pair authored (trailing)', () => {
    expect(dracolichRow.save_dc).toBe(19);
    expect(dracolichRow.save_type).toBe('Charisma');
    expect(dracolichRow.spell_save_dc).toBe(19);
    expect(dracolichRow.spell_attack_bonus).toBe(11);
    expect(dracolichRow.spellcasting_ability).toBe('Charisma');
    expect(dracolichRow.description).toMatch(/spell save DC 19/);
    expect(dracolichRow.description).toMatch(/<strong>Ray of Sickness<\/strong> \(level 2 version\)/);
    expect(dracolichRow.description).toMatch(/<strong>Create Undead<\/strong> \(level 8 version\)/);
  });

  it('no fake chips: level parentheticals and prose stay plain text', () => {
    expect(dracolichRow.description).not.toMatch(/<(?:strong|em)>[^<]*level[^<]*<\/(?:strong|em)>/);
    expect(dracolichRow.description).not.toMatch(/<(?:strong|em)>[^<]*Charisma[^<]*<\/(?:strong|em)>/);
  });

  it('DC 19 = 8 + CHA +5 + PB +6 and +11 = CHA +5 + PB +6 for the dracolich', () => {
    expect(dracolich.ability_score_modifiers.cha).toBe(5);
    expect(dracolich.proficiency_bonus).toBe(6);
    expect(8 + dracolich.ability_score_modifiers.cha + dracolich.proficiency_bonus).toBe(19);
    expect(dracolich.ability_score_modifiers.cha + dracolich.proficiency_bonus).toBe(11);
  });

  it('markup-only diff proof: stripped text equals the pre-fix description byte-for-byte', () => {
    expect(stripTags(dracolichRow.description)).toBe(DRACOLICH_PLAIN_ORIGINAL);
  });

  it('three spells exist in 5e; Ray of Sickness is 2024-only (findMonsterSpell 2024 fallback)', () => {
    ['Detect Magic', 'Create Undead', 'Finger of Death'].forEach(n => expect(spells5e.some(s => s.name === n)).toBe(true));
    expect(spells5e.some(s => s.name === 'Ray of Sickness')).toBe(false);
    expect(spells2024.some(s => s.name === 'Ray of Sickness')).toBe(true);
  });
});

// ── Modal: four chips, counters, gates ───────────────────────────────────────

describe('MA-0619 MonsterCardModal Dracolich Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders four spell chips — the zero-chip inert row is gone', () => {
    renderDracolich();
    expect(spellLinks().map(el => el.textContent.split('(')[0].trim())).toEqual(NAMES);
  });

  it('the two 1/Day names carry counters; the two At Will names do not', () => {
    renderDracolich();
    ONE_DAY.forEach(n => expect(linkByText(n).textContent).toMatch(/\(1\/Day · 1 left\)/));
    AT_WILL.forEach(n => expect(linkByText(n).textContent).not.toMatch(/\/Day/));
  });

  it('At Will Detect Magic casts ungated twice — zero uses, advisory log prints row DC 19', async () => {
    renderDracolich();
    await act(async () => { fireEvent.click(linkByText('Detect Magic')); });
    await waitFor(() => expect(abilityUseEntries('Detect Magic').length).toBe(1));
    expect(abilityUseEntries('Detect Magic')[0].description).toMatch(/\(spell save DC 19/);
    await act(async () => { fireEvent.click(linkByText('Detect Magic')); });
    await waitFor(() => expect(abilityUseEntries('Detect Magic').length).toBe(2));
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
  });

  it('Ray of Sickness resolves via 2024 fallback — At Will attack cast at level 2, +11, zero uses', async () => {
    renderDracolich();
    await act(async () => { fireEvent.click(linkByText('Ray of Sickness')); });
    await waitFor(() => expect(abilityUseEntries('Ray of Sickness').length).toBe(1));
    expect(abilityUseEntries('Ray of Sickness')[0].description).toMatch(/level 2 ranged spell attack \+11/);
    expect(abilityUseEntries('Ray of Sickness')[0].description).toMatch(/formula 3d8/);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
  });

  it('Finger of Death 1/Day: cast spends the single use, second refused — zero extra spend', async () => {
    renderDracolich();
    await act(async () => { fireEvent.click(linkByText('Finger of Death')); });
    await waitFor(() => expect(abilityUseEntries('Finger of Death').length).toBe(1));
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Finger of Death': 1 });
    expect(abilityUseEntries('Finger of Death')[0].description).toMatch(/1\/Day use spent/);

    await act(async () => { fireEvent.click(linkByText('Finger of Death')); });
    await waitFor(() => expect(refusals('Finger of Death').length).toBe(1));
    expect(abilityUseEntries('Finger of Death').length).toBe(1);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Finger of Death': 1 });
  });

  it('Create Undead 1/Day: cast spends the single use, second refused — zero extra spend', async () => {
    renderDracolich();
    await act(async () => { fireEvent.click(linkByText('Create Undead')); });
    await waitFor(() => expect(abilityUseEntries('Create Undead').length).toBe(1));
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Create Undead': 1 });
    expect(abilityUseEntries('Create Undead')[0].description).toMatch(/1\/Day use spent/);

    await act(async () => { fireEvent.click(linkByText('Create Undead')); });
    await waitFor(() => expect(refusals('Create Undead').length).toBe(1));
    expect(abilityUseEntries('Create Undead').length).toBe(1);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Create Undead': 1 });
  });
});
