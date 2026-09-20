// MA-0611 data lock: Djinni Spellcasting rode the MA-0421/MA-0524/MA-0532/
// MA-0576 twin markup-gap template. Pre-fix ONLY the three tier headers carried
// <strong>; Detect Evil and Good/Detect Magic/Create Food and Water/Tongues/
// Wind Walk/Creation/Gaseous Form/Invisibility/Major Image/Plane Shift were
// plain text — extractSpellNamesFromSpellcasting returned [] and
// extractSpellcastingSpellUses returned {} → SpellCastLinks null → zero chips,
// and the orphaned spell_save_dc 17 never reached buildAbilitySaveRollContext
// (MA-0532 fork). DATA fix: <strong> on each spell name (headers byte-kept,
// "(can create wine instead of water)" parenthetical OUTSIDE the tag,
// strip-tags byte-equality) + trailing row-level numeric save_dc 17 +
// save_type "Charisma" pair (MA-0454/MA-0421/MA-0576).
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { extractSpellNamesFromSpellcasting, extractSpellcastingSpellUses } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const spells5e = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));

const djinni = monsters.find(m => m.index === 'djinni');
const djinniRow = djinni.actions.find(a => a.name === 'Spellcasting');
const NAMES = ['Detect Evil and Good', 'Detect Magic', 'Create Food and Water', 'Tongues', 'Wind Walk', 'Creation', 'Gaseous Form', 'Invisibility', 'Major Image', 'Plane Shift'];
const TWO_DAY = ['Create Food and Water', 'Tongues', 'Wind Walk'];
const ONE_DAY = ['Creation', 'Gaseous Form', 'Invisibility', 'Major Image', 'Plane Shift'];
const AT_WILL = ['Detect Evil and Good', 'Detect Magic'];
const SPELLS = Object.fromEntries(NAMES.map(n => [n, spells5e.find(s => s.name === n)]));

const DJINNI_PLAIN_ORIGINAL = 'The djinni casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 17):\nAt Will: Detect Evil and Good, Detect Magic\n2/Day Each: Create Food and Water (can create wine instead of water), Tongues, Wind Walk\n1/Day Each: Creation, Gaseous Form, Invisibility, Major Image, Plane Shift';
const stripTags = (d) => d.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '');

const MONSTER_NAME = 'Djinni 1';

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
  loadSpells: vi.fn(() => Promise.resolve(NAMES.map(n => SPELLS[n]))),
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

function renderDjinni() {
  const m = makeMonster({ name: 'Djinni', actions: [djinniRow] });
  const creatures = [
    { name: MONSTER_NAME, type: 'npc', monsterType: 'elemental', targetName: 'Bandit', ac: 17, currentHp: 218, maxHp: 218, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: MONSTER_NAME, creatures })} />);
}

// ── Data lock: djinni Spellcasting row ───────────────────────────────────────

describe('MA-0611 monsters.json data lock: Djinni Spellcasting row', () => {
  it('extracts all ten spell names as chips — tier headers skipped', () => {
    const names = extractSpellNamesFromSpellcasting(djinniRow.description);
    expect(names).toEqual(NAMES);
    expect(names).not.toContain('At Will');
    expect(names).not.toContain('2/Day Each');
    expect(names).not.toContain('1/Day Each');
  });

  it('binds 2/Day Each to the three marked names, 1/Day Each to the five; At Will ungated', () => {
    const uses = extractSpellcastingSpellUses(djinniRow.description);
    expect(uses).toEqual({
      ...Object.fromEntries(TWO_DAY.map(n => [n, 2])),
      ...Object.fromEntries(ONE_DAY.map(n => [n, 1])),
    });
    AT_WILL.forEach(n => expect(uses[n]).toBeUndefined());
  });

  it('row-level numeric save_dc 17 + save_type Charisma pair authored (trailing)', () => {
    expect(djinniRow.save_dc).toBe(17);
    expect(djinniRow.save_type).toBe('Charisma');
    expect(djinniRow.spell_save_dc).toBe(17);
    expect(djinniRow.spellcasting_ability).toBe('Charisma');
    expect(djinniRow.description).toMatch(/spell save DC 17/);
    expect(djinniRow.description).toMatch(/<strong>Create Food and Water<\/strong> \(can create wine instead of water\)/);
  });

  it('no fake chips: "wine instead of water" parenthetical stays plain text', () => {
    expect(djinniRow.description).not.toMatch(/<(?:strong|em)>[^<]*wine[^<]*<\/(?:strong|em)>/);
  });

  it('DC 17 = 8 + CHA +5 + PB +4 for the djinni', () => {
    expect(djinni.ability_score_modifiers.cha).toBe(5);
    expect(djinni.proficiency_bonus).toBe(4);
    expect(8 + djinni.ability_score_modifiers.cha + djinni.proficiency_bonus).toBe(17);
  });

  it('markup-only diff proof: stripped text equals the pre-fix description byte-for-byte', () => {
    expect(stripTags(djinniRow.description)).toBe(DJINNI_PLAIN_ORIGINAL);
  });

  it('all ten spells exist in 5e spells.json; none carries damage (all advisory legs)', () => {
    NAMES.forEach(n => expect(spells5e.some(s => s.name === n)).toBe(true));
  });
});

// ── Modal: ten chips, counters, gates ────────────────────────────────────────

describe('MA-0611 MonsterCardModal Djinni Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders ten spell chips — the zero-chip inert row is gone', () => {
    renderDjinni();
    expect(spellLinks().map(el => el.textContent.split('(')[0].trim())).toEqual(NAMES);
  });

  it('the three 2/Day and five 1/Day names carry counters; the two At Will names do not', () => {
    renderDjinni();
    TWO_DAY.forEach(n => expect(linkByText(n).textContent).toMatch(/\(2\/Day · 2 left\)/));
    ONE_DAY.forEach(n => expect(linkByText(n).textContent).toMatch(/\(1\/Day · 1 left\)/));
    AT_WILL.forEach(n => expect(linkByText(n).textContent).not.toMatch(/\/Day/));
  });

  it('At Will Detect Magic casts ungated twice — zero uses, advisory log prints row DC 17', async () => {
    renderDjinni();
    await act(async () => { fireEvent.click(linkByText('Detect Magic')); });
    await waitFor(() => expect(abilityUseEntries('Detect Magic').length).toBe(1));
    expect(abilityUseEntries('Detect Magic')[0].description).toMatch(/\(spell save DC 17/);
    await act(async () => { fireEvent.click(linkByText('Detect Magic')); });
    await waitFor(() => expect(abilityUseEntries('Detect Magic').length).toBe(2));
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
  });

  it('Invisibility 1/Day: cast spends the single use, second refused — zero extra spend', async () => {
    renderDjinni();
    await act(async () => { fireEvent.click(linkByText('Invisibility')); });
    await waitFor(() => expect(abilityUseEntries('Invisibility').length).toBe(1));
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Invisibility': 1 });
    expect(abilityUseEntries('Invisibility')[0].description).toMatch(/1\/Day use spent/);

    await act(async () => { fireEvent.click(linkByText('Invisibility')); });
    await waitFor(() => expect(refusals('Invisibility').length).toBe(1));
    expect(abilityUseEntries('Invisibility').length).toBe(1);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Invisibility': 1 });
  });

  it('Create Food and Water 2/Day: two casts spend both uses, third refused', async () => {
    renderDjinni();
    await act(async () => { fireEvent.click(linkByText('Create Food and Water')); });
    await waitFor(() => expect(abilityUseEntries('Create Food and Water').length).toBe(1));
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Create Food and Water': 1 });

    await act(async () => { fireEvent.click(linkByText('Create Food and Water')); });
    await waitFor(() => expect(abilityUseEntries('Create Food and Water').length).toBe(2));
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Create Food and Water': 2 });

    await act(async () => { fireEvent.click(linkByText('Create Food and Water')); });
    await waitFor(() => expect(refusals('Create Food and Water').length).toBe(1));
    expect(abilityUseEntries('Create Food and Water').length).toBe(2);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Create Food and Water': 2 });
  });

  it('Plane Shift (spells.json attack_type melee) refuses honestly — zero uses spent', async () => {
    renderDjinni();
    await act(async () => { fireEvent.click(linkByText('Plane Shift')); });
    await waitFor(() => expect(refusals('Plane Shift').length).toBe(1));
    expect(abilityUseEntries('Plane Shift').length).toBe(0);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
  });
});
