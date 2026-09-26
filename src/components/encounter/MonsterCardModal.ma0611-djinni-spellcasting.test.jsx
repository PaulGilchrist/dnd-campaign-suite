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
const spells2024 = JSON.parse(readFileSync('public/data/2024/spells.json', 'utf8'));

const djinni = monsters.find(m => m.index === 'djinni');
const djinniRow = djinni.actions.find(a => a.name === 'Spellcasting');
const NAMES = ['Detect Evil and Good', 'Detect Magic', 'Create Food and Water', 'Tongues', 'Wind Walk', 'Creation', 'Gaseous Form', 'Invisibility', 'Major Image', 'Plane Shift'];
const TWO_DAY = ['Create Food and Water', 'Tongues', 'Wind Walk'];
const ONE_DAY = ['Creation', 'Gaseous Form', 'Invisibility', 'Major Image', 'Plane Shift'];
const AT_WILL = ['Detect Evil and Good', 'Detect Magic'];

// MA-1230 night-hag extension (same MA-0421/MA-0524 markup-gap family):
// all five spell names were plain text on the night-hag Spellcasting row.
const nightHag = monsters.find(m => m.index === 'night-hag');
const nightHagRow = nightHag.actions.find(a => a.name === 'Spellcasting');
const NH_NAMES = ['Detect Magic', 'Etherealness', 'Magic Missile', 'Phantasmal Killer', 'Plane Shift'];
const NH_TWO_DAY = ['Phantasmal Killer', 'Plane Shift'];
const NH_AT_WILL = ['Detect Magic', 'Etherealness', 'Magic Missile'];
// MA-1241 noble-prodigy extension (same MA-0421/MA-0524/MA-1230 markup-gap
// family): all eight spell names were plain text, plus the OCR typo
// "Befuddle ment" → canonical "Befuddlement" (2024-only, §177 ruleset-branch
// pitfall: the loadSpells mock below MUST serve it on the '2024' branch).
const nobleProdigy = monsters.find(m => m.index === 'noble-prodigy');
const nobleProdigyRow = nobleProdigy.actions.find(a => a.name === 'Spellcasting');
const NP_NAMES = ['Mage Armor', 'Mage Hand', 'Minor Illusion', 'Befuddlement', 'Detect Thoughts', 'Fly', 'Scrying', 'Shatter'];
const NP_ONE_DAY = ['Befuddlement', 'Detect Thoughts', 'Fly', 'Scrying', 'Shatter'];
const NP_AT_WILL = ['Mage Armor', 'Mage Hand', 'Minor Illusion'];
// MA-1261 oni extension (same MA-0421/MA-1230/MA-1241 markup-gap family):
// all four spell names were plain text, headers only carried <strong>; the
// numeric save_dc 13 + Charisma pair was already authored, so the row needed
// markup only (§89 gate pre-met; junk attack_bonus 0 rides the row, out of scope).
const oni = monsters.find(m => m.index === 'oni');
const oniRow = oni.actions.find(a => a.name === 'Spellcasting');
const OI_NAMES = ['Charm Person', 'Darkness', 'Gaseous Form', 'Sleep'];
const OI_ONE_DAY = OI_NAMES;
// MA-1289 performer-legend extension (same MA-0421/MA-1230/MA-1241/MA-1261
// markup-gap family): all five spell names were plain text, headers only carried
// <strong>; the numeric save_dc 17 + Charisma pair was already authored, so the
// row needed markup only (§89 gate pre-met; junk attack_bonus 0 rides the row,
// out of scope). All five spells are save:none in spells.json → chips are
// cast-affordance only, no save-roll expected.
const performerLegend = monsters.find(m => m.index === 'performer-legend');
const performerLegendRow = performerLegend.actions.find(a => a.name === 'Spellcasting');
const PL_NAMES = ['Mage Hand', 'Minor Illusion', 'Prestidigitation', 'Major Image', 'Project Image'];
const PL_ONE_DAY = ['Major Image', 'Project Image'];
const PL_AT_WILL = ['Mage Hand', 'Minor Illusion', 'Prestidigitation'];
const ALL_NAMES = [...new Set([...NAMES, ...NH_NAMES, ...NP_NAMES, ...OI_NAMES, ...PL_NAMES])];
const SPELLS = Object.fromEntries(ALL_NAMES.map(n => [n, spells5e.find(s => s.name === n)]).filter(([, s]) => Boolean(s)));
const SPELLS_2024 = Object.fromEntries(NP_NAMES.map(n => [n, spells2024.find(s => s.name === n)]).filter(([, s]) => Boolean(s)));

const DJINNI_PLAIN_ORIGINAL = 'The djinni casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 17):\nAt Will: Detect Evil and Good, Detect Magic\n2/Day Each: Create Food and Water (can create wine instead of water), Tongues, Wind Walk\n1/Day Each: Creation, Gaseous Form, Invisibility, Major Image, Plane Shift';
const NH_PLAIN_ORIGINAL = 'The hag casts one of the following spells, requiring no Material components and using Intelligence as the spellcasting ability (spell save DC 14):\nAt Will: Detect Magic, Etherealness, Magic Missile (level 4 version)\n2/Day Each: Phantasmal Killer, Plane Shift (self only)';
// Pre-fix disk text (all names plain + "Befuddle ment" typo); the fix is
// markup + typo only, so stripped text equals this with the typo repaired.
const NP_PLAIN_ORIGINAL = 'The noble casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 16):\nAt Will: Mage Armor (included in AC), Mage Hand, Minor Illusion\n1/Day Each: Befuddle ment, Detect Thoughts, Fly, Scrying, Shatter (level 7 version)';
const OI_PLAIN_ORIGINAL = 'The oni casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 13):\n1/Day Each: Charm Person (level 2 version), Darkness, Gaseous Form, Sleep';
const PL_PLAIN_ORIGINAL = 'The performer casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 17):\nAt Will: Mage Hand, Minor Illusion, Prestidigitation\n1/Day Each: Major Image, Project Image';
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
  // §177 ruleset-branch pitfall: findMonsterSpell is 5e-first, falling back
  // to loadSpells('2024') — Befuddlement (MA-1241) only resolves on that branch.
  loadSpells: vi.fn((ruleset) => Promise.resolve(
    ruleset === '2024' ? Object.values(SPELLS_2024) : ALL_NAMES.map(n => SPELLS[n]).filter(Boolean)
  )),
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

const NH_MONSTER_NAME = 'Night Hag 1';

function renderNightHag() {
  const m = makeMonster({ name: 'Night Hag', actions: [nightHagRow] });
  const creatures = [
    { name: NH_MONSTER_NAME, type: 'npc', monsterType: 'fey', targetName: 'Bandit', ac: 17, currentHp: 112, maxHp: 112, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: NH_MONSTER_NAME, creatures })} />);
}

const NP_MONSTER_NAME = 'Noble Prodigy 1';

function renderNobleProdigy() {
  const m = makeMonster({ name: 'Noble Prodigy', actions: [nobleProdigyRow] });
  const creatures = [
    { name: NP_MONSTER_NAME, type: 'npc', monsterType: 'humanoid', targetName: 'Bandit', ac: 16, currentHp: 148, maxHp: 148, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: NP_MONSTER_NAME, creatures })} />);
}

const OI_MONSTER_NAME = 'Oni 1';

function renderOni() {
  const m = makeMonster({ name: 'Oni', actions: [oniRow] });
  const creatures = [
    { name: OI_MONSTER_NAME, type: 'npc', monsterType: 'giant', targetName: 'Bandit', ac: 16, currentHp: 119, maxHp: 119, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: OI_MONSTER_NAME, creatures })} />);
}

const PL_MONSTER_NAME = 'Performer Legend 1';

function renderPerformerLegend() {
  const m = makeMonster({ name: 'Performer Legend', actions: [performerLegendRow] });
  const creatures = [
    { name: PL_MONSTER_NAME, type: 'npc', monsterType: 'humanoid', targetName: 'Bandit', ac: 20, currentHp: 162, maxHp: 162, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: PL_MONSTER_NAME, creatures })} />);
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

// ── MA-1230 data lock: Night Hag Spellcasting row ───────────────────────────

describe('MA-1230 monsters.json data lock: Night Hag Spellcasting row', () => {
  it('extracts all five spell names as chips — tier headers skipped', () => {
    const names = extractSpellNamesFromSpellcasting(nightHagRow.description);
    expect(names).toEqual(NH_NAMES);
    expect(names).not.toContain('At Will');
    expect(names).not.toContain('2/Day Each');
  });

  it('binds 2/Day Each to Phantasmal Killer + Plane Shift; At Will names ungated', () => {
    const uses = extractSpellcastingSpellUses(nightHagRow.description);
    expect(uses).toEqual({ 'Phantasmal Killer': 2, 'Plane Shift': 2 });
    NH_AT_WILL.forEach(n => expect(uses[n]).toBeUndefined());
  });

  it('row-level numeric save_dc 14 + save_type Intelligence pair intact (§89 gate pre-met)', () => {
    expect(nightHagRow.save_dc).toBe(14);
    expect(nightHagRow.save_type).toBe('Intelligence');
    expect(nightHagRow.description).toMatch(/spell save DC 14/);
    expect(nightHagRow.description).toMatch(/<strong>Magic Missile<\/strong> \(level 4 version\)/);
    expect(nightHagRow.description).toMatch(/<strong>Plane Shift<\/strong> \(self only\)/);
  });

  it('no fake chips: qualifier parentheticals stay plain text', () => {
    expect(nightHagRow.description).not.toMatch(/<(?:strong|em)>[^<]*level 4 version[^<]*<\/(?:strong|em)>/);
    expect(nightHagRow.description).not.toMatch(/<(?:strong|em)>[^<]*self only[^<]*<\/(?:strong|em)>/);
  });

  it('DC 14 = 8 + INT +3 + PB +3 for the night hag', () => {
    expect(nightHag.ability_score_modifiers.int).toBe(3);
    expect(nightHag.proficiency_bonus).toBe(3);
    expect(8 + nightHag.ability_score_modifiers.int + nightHag.proficiency_bonus).toBe(14);
  });

  it('markup-only diff proof: stripped text equals the pre-fix description byte-for-byte', () => {
    expect(stripTags(nightHagRow.description)).toBe(NH_PLAIN_ORIGINAL);
  });

  it('all five spells exist in 5e spells.json', () => {
    NH_NAMES.forEach(n => expect(spells5e.some(s => s.name === n)).toBe(true));
  });
});

// ── MA-1230 Modal: five chips, counters, gates ──────────────────────────────

describe('MA-1230 MonsterCardModal Night Hag Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders five spell chips — the zero-chip inert row is gone', () => {
    renderNightHag();
    expect(spellLinks().map(el => el.textContent.split('(')[0].trim())).toEqual(NH_NAMES);
  });

  it('the two 2/Day names carry counters; the three At Will names do not', () => {
    renderNightHag();
    NH_TWO_DAY.forEach(n => expect(linkByText(n).textContent).toMatch(/\(2\/Day · 2 left\)/));
    NH_AT_WILL.forEach(n => expect(linkByText(n).textContent).not.toMatch(/\/Day/));
  });

  it('At Will Detect Magic casts ungated twice — zero uses, advisory log prints row DC 14', async () => {
    renderNightHag();
    await act(async () => { fireEvent.click(linkByText('Detect Magic')); });
    await waitFor(() => expect(abilityUseEntries('Detect Magic').length).toBe(1));
    expect(abilityUseEntries('Detect Magic')[0].description).toMatch(/\(spell save DC 14/);
    await act(async () => { fireEvent.click(linkByText('Detect Magic')); });
    await waitFor(() => expect(abilityUseEntries('Detect Magic').length).toBe(2));
    expect(runtime.store[`${NH_MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
  });

  it('Plane Shift (spells.json attack_type melee) refuses honestly — zero uses spent', async () => {
    renderNightHag();
    await act(async () => { fireEvent.click(linkByText('Plane Shift')); });
    await waitFor(() => expect(refusals('Plane Shift').length).toBe(1));
    expect(abilityUseEntries('Plane Shift').length).toBe(0);
    expect(runtime.store[`${NH_MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
  });
});

// ── MA-1241 data lock: Noble Prodigy Spellcasting row ───────────────────────

describe('MA-1241 monsters.json data lock: Noble Prodigy Spellcasting row', () => {
  it('extracts all eight spell names as chips — tier headers skipped', () => {
    const names = extractSpellNamesFromSpellcasting(nobleProdigyRow.description);
    expect(names).toEqual(NP_NAMES);
    expect(names).not.toContain('At Will');
    expect(names).not.toContain('1/Day Each');
  });

  it('canonical Befuddlement — the "Befuddle ment" OCR typo is repaired', () => {
    expect(nobleProdigyRow.description).toContain('<strong>Befuddlement</strong>');
    expect(nobleProdigyRow.description).not.toContain('Befuddle ment');
    expect(nobleProdigyRow.description).not.toMatch(/Befuddle[^m]/);
    const names = extractSpellNamesFromSpellcasting(nobleProdigyRow.description);
    expect(names).toContain('Befuddlement');
    expect(names).not.toContain('Befuddle');
  });

  it('binds 1/Day Each to the five marked spells; At Will trio ungated (§57)', () => {
    const uses = extractSpellcastingSpellUses(nobleProdigyRow.description);
    expect(uses).toEqual(Object.fromEntries(NP_ONE_DAY.map(n => [n, 1])));
    NP_AT_WILL.forEach(n => expect(uses[n]).toBeUndefined());
  });

  it('row-level numeric save_dc 16 + save_type Charisma pair intact (§89 gate pre-met)', () => {
    expect(nobleProdigyRow.save_dc).toBe(16);
    expect(nobleProdigyRow.save_type).toBe('Charisma');
    expect(nobleProdigyRow.description).toMatch(/spell save DC 16/);
    expect(nobleProdigyRow.description).toMatch(/<strong>Mage Armor<\/strong> \(included in AC\)/);
    expect(nobleProdigyRow.description).toMatch(/<strong>Shatter<\/strong> \(level 7 version\)/);
  });

  it('no fake chips: qualifier parentheticals stay plain text', () => {
    expect(nobleProdigyRow.description).not.toMatch(/<(?:strong|em)>[^<]*included in AC[^<]*<\/(?:strong|em)>/);
    expect(nobleProdigyRow.description).not.toMatch(/<(?:strong|em)>[^<]*level 7 version[^<]*<\/(?:strong|em)>/);
  });

  it('DC 16 = 8 + CHA +4 + PB +4 for the noble prodigy', () => {
    expect(nobleProdigy.ability_score_modifiers.cha).toBe(4);
    expect(nobleProdigy.proficiency_bonus).toBe(4);
    expect(8 + nobleProdigy.ability_score_modifiers.cha + nobleProdigy.proficiency_bonus).toBe(16);
  });

  it('markup+typo-only diff proof: stripped text equals pre-fix description with the typo repaired', () => {
    expect(stripTags(nobleProdigyRow.description)).toBe(NP_PLAIN_ORIGINAL.replace('Befuddle ment', 'Befuddlement'));
  });

  it('Befuddlement resolves via findMonsterSpell 5e→2024 fallback: absent 5e, INT-save L8 Enchantment in 2024 (§207)', () => {
    expect(spells5e.some(s => s.name === 'Befuddlement')).toBe(false);
    expect(spells5e.some(s => s.name === 'Befuddle')).toBe(false);
    const b = spells2024.find(s => s.name === 'Befuddlement');
    expect(b).toBeDefined();
    expect(b.index).toBe('befuddlement');
    expect(b.level).toBe(8);
    expect(b.school).toBe('Enchantment');
    expect(b.dc.dc_type).toBe('INT');
    NP_NAMES.filter(n => n !== 'Befuddlement').forEach(n => expect(spells5e.some(s => s.name === n)).toBe(true));
  });
});

// ── MA-1241 Modal: eight chips, counters, 1/Day gate ────────────────────────

describe('MA-1241 MonsterCardModal Noble Prodigy Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders eight spell chips — the zero-chip inert row is gone', () => {
    renderNobleProdigy();
    expect(spellLinks().map(el => el.textContent.split('(')[0].trim())).toEqual(NP_NAMES);
  });

  it('the five 1/Day names carry counters; the three At Will names do not', () => {
    renderNobleProdigy();
    NP_ONE_DAY.forEach(n => expect(linkByText(n).textContent).toMatch(/\(1\/Day · 1 left\)/));
    NP_AT_WILL.forEach(n => expect(linkByText(n).textContent).not.toMatch(/\/Day/));
  });

  it('At Will Mage Hand casts ungated twice — zero uses, advisory log prints row DC 16/Charisma (§204)', async () => {
    renderNobleProdigy();
    await act(async () => { fireEvent.click(linkByText('Mage Hand')); });
    await waitFor(() => expect(abilityUseEntries('Mage Hand').length).toBe(1));
    expect(abilityUseEntries('Mage Hand')[0].description).toMatch(/\(spell save DC 16/);
    await act(async () => { fireEvent.click(linkByText('Mage Hand')); });
    await waitFor(() => expect(abilityUseEntries('Mage Hand').length).toBe(2));
    expect(runtime.store[`${NP_MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
  });

  it('Fly 1/Day: cast spends the single use, re-fire refused — zero extra spend (§57)', async () => {
    renderNobleProdigy();
    await act(async () => { fireEvent.click(linkByText('Fly')); });
    await waitFor(() => expect(abilityUseEntries('Fly').length).toBe(1));
    expect(runtime.store[`${NP_MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Fly': 1 });
    expect(abilityUseEntries('Fly')[0].description).toMatch(/1\/Day use spent/);

    await act(async () => { fireEvent.click(linkByText('Fly')); });
    await waitFor(() => expect(refusals('Fly').length).toBe(1));
    expect(abilityUseEntries('Fly').length).toBe(1);
    expect(runtime.store[`${NP_MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Fly': 1 });
  });
});

// ── MA-1261 data lock: Oni Spellcasting row ──────────────────────────────────

describe('MA-1261 monsters.json data lock: Oni Spellcasting row', () => {
  it('extracts all four spell names as chips — headers skipped', () => {
    const names = extractSpellNamesFromSpellcasting(oniRow.description);
    expect(names).toEqual(OI_NAMES);
    expect(names).not.toContain('1/Day Each');
    expect(names).not.toContain('Charm Person (level 2 version)');
  });

  it('binds 1/Day Each to all four marked names (§57 tier header gate)', () => {
    const uses = extractSpellcastingSpellUses(oniRow.description);
    expect(uses).toEqual(Object.fromEntries(OI_ONE_DAY.map(n => [n, 1])));
  });

  it('row-level numeric save_dc 13 + save_type Charisma pair intact (§89 gate pre-met)', () => {
    expect(oniRow.save_dc).toBe(13);
    expect(oniRow.save_type).toBe('Charisma');
    expect(oniRow.description).toMatch(/spell save DC 13/);
    expect(oniRow.description).toMatch(/<strong>Charm Person<\/strong> \(level 2 version\)/);
  });

  it('no fake chips: the level-2 parenthetical stays plain text (djinni/night-hag convention)', () => {
    expect(oniRow.description).not.toMatch(/<(?:strong|em)>[^<]*level 2 version[^<]*<\/(?:strong|em)>/);
  });

  it('markup-only diff proof: stripped text equals the pre-fix description byte-for-byte', () => {
    expect(stripTags(oniRow.description)).toBe(OI_PLAIN_ORIGINAL);
  });

  it('DC 13 = 8 + CHA +2 + PB +3 for the oni', () => {
    expect(oni.ability_score_modifiers.cha).toBe(2);
    expect(oni.proficiency_bonus).toBe(3);
    expect(8 + oni.ability_score_modifiers.cha + oni.proficiency_bonus).toBe(13);
  });

  it('all four spells exist in BOTH 5e and 2024 spells.json, none an attack spell', () => {
    OI_NAMES.forEach(n => {
      expect(spells5e.some(s => s.name === n)).toBe(true);
      expect(spells2024.some(s => s.name === n)).toBe(true);
    });
  });
});

// ── MA-1261 Modal: four chips, counters, 1/Day gate ──────────────────────────

describe('MA-1261 MonsterCardModal Oni Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders four spell chips — the zero-chip inert row is gone', () => {
    renderOni();
    expect(spellLinks().map(el => el.textContent.split('(')[0].trim())).toEqual(OI_NAMES);
  });

  it('all four names carry 1/Day counters; the tier header renders no chip', () => {
    renderOni();
    OI_ONE_DAY.forEach(n => expect(linkByText(n).textContent).toMatch(/\(1\/Day · 1 left\)/));
    expect(linkByText('1/Day Each')).toBeNull();
  });

  it('Darkness 1/Day: cast spends the single use with DC 13/Charisma advisory, re-fire refused (§57/§204)', async () => {
    renderOni();
    await act(async () => { fireEvent.click(linkByText('Darkness')); });
    await waitFor(() => expect(abilityUseEntries('Darkness').length).toBe(1));
    expect(runtime.store[`${OI_MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Darkness': 1 });
    expect(abilityUseEntries('Darkness')[0].description).toMatch(/1\/Day use spent/);
    expect(abilityUseEntries('Darkness')[0].description).toMatch(/\(spell save DC 13/);

    await act(async () => { fireEvent.click(linkByText('Darkness')); });
    await waitFor(() => expect(refusals('Darkness').length).toBe(1));
    expect(abilityUseEntries('Darkness').length).toBe(1);
    expect(runtime.store[`${OI_MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Darkness': 1 });
  });
});

// ── MA-1289 data lock: Performer Legend Spellcasting row ─────────────────────

describe('MA-1289 monsters.json data lock: Performer Legend Spellcasting row', () => {
  it('extracts all five spell names as chips — tier headers skipped', () => {
    const names = extractSpellNamesFromSpellcasting(performerLegendRow.description);
    expect(names).toEqual(PL_NAMES);
    expect(names).not.toContain('At Will');
    expect(names).not.toContain('1/Day Each');
  });

  it('disk description carries all five name-wrapped <strong> tokens in authored order', () => {
    const d = performerLegendRow.description;
    PL_NAMES.forEach(n => expect(d).toContain(`<strong>${n}</strong>`));
    const pos = PL_NAMES.map(n => d.indexOf(`<strong>${n}</strong>`));
    expect(pos).toEqual([...pos].sort((a, b) => a - b));
    pos.forEach(p => expect(p).toBeGreaterThan(-1));
  });

  it('binds 1/Day Each to Major Image + Project Image; At Will trio ungated (§57)', () => {
    const uses = extractSpellcastingSpellUses(performerLegendRow.description);
    expect(uses).toEqual(Object.fromEntries(PL_ONE_DAY.map(n => [n, 1])));
    PL_AT_WILL.forEach(n => expect(uses[n]).toBeUndefined());
  });

  it('row-level numeric save_dc 17 + save_type Charisma pair intact (§89 gate pre-met)', () => {
    expect(performerLegendRow.save_dc).toBe(17);
    expect(performerLegendRow.save_type).toBe('Charisma');
    expect(performerLegendRow.description).toMatch(/spell save DC 17/);
  });

  it('emphasis census: ONLY the two tier headers + five spell names carry markup — no fake-chip decoys', () => {
    const tokens = (performerLegendRow.description.match(/<(?:strong|em)>[^<]*<\/(?:strong|em)>/g) || []);
    expect(tokens).toEqual(['<strong>At Will:</strong>', '<strong>Mage Hand</strong>', '<strong>Minor Illusion</strong>', '<strong>Prestidigitation</strong>', '<strong>1/Day Each:</strong>', '<strong>Major Image</strong>', '<strong>Project Image</strong>']);
  });

  it('markup-only diff proof: stripped text equals the pre-fix description byte-for-byte', () => {
    expect(stripTags(performerLegendRow.description)).toBe(PL_PLAIN_ORIGINAL);
  });

  it('DC 17 = 8 + CHA +5 + PB +4 for the performer legend', () => {
    expect(performerLegend.ability_score_modifiers.cha).toBe(5);
    expect(performerLegend.proficiency_bonus).toBe(4);
    expect(8 + performerLegend.ability_score_modifiers.cha + performerLegend.proficiency_bonus).toBe(17);
  });

  it('all five spells exist in 5e spells.json, all save:none — chips are cast-affordance only', () => {
    PL_NAMES.forEach(n => {
      const s = spells5e.find(sp => sp.name === n);
      expect(s).toBeDefined();
      expect(s.dc == null || s.dc.dc_type == null).toBe(true);
    });
  });
});

// ── MA-1289 Modal: five chips, counters, 1/Day gate ──────────────────────────

describe('MA-1289 MonsterCardModal Performer Legend Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders five spell chips — the zero-chip inert row is gone', () => {
    renderPerformerLegend();
    expect(spellLinks().map(el => el.textContent.split('(')[0].trim())).toEqual(PL_NAMES);
  });

  it('the two 1/Day names carry counters; the three At Will names do not', () => {
    renderPerformerLegend();
    PL_ONE_DAY.forEach(n => expect(linkByText(n).textContent).toMatch(/\(1\/Day · 1 left\)/));
    PL_AT_WILL.forEach(n => expect(linkByText(n).textContent).not.toMatch(/\/Day/));
  });

  it('Major Image 1/Day: cast spends the single use with DC 17/Charisma advisory, re-fire refused (§57)', async () => {
    renderPerformerLegend();
    await act(async () => { fireEvent.click(linkByText('Major Image')); });
    await waitFor(() => expect(abilityUseEntries('Major Image').length).toBe(1));
    expect(runtime.store[`${PL_MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Major Image': 1 });
    expect(abilityUseEntries('Major Image')[0].description).toMatch(/1\/Day use spent/);
    expect(abilityUseEntries('Major Image')[0].description).toMatch(/\(spell save DC 17/);

    await act(async () => { fireEvent.click(linkByText('Major Image')); });
    await waitFor(() => expect(refusals('Major Image').length).toBe(1));
    expect(abilityUseEntries('Major Image').length).toBe(1);
    expect(runtime.store[`${PL_MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Major Image': 1 });
  });

  it('At Will Mage Hand casts ungated twice — zero uses, advisory log prints row DC 17 (§204)', async () => {
    renderPerformerLegend();
    await act(async () => { fireEvent.click(linkByText('Mage Hand')); });
    await waitFor(() => expect(abilityUseEntries('Mage Hand').length).toBe(1));
    expect(abilityUseEntries('Mage Hand')[0].description).toMatch(/\(spell save DC 17/);
    await act(async () => { fireEvent.click(linkByText('Mage Hand')); });
    await waitFor(() => expect(abilityUseEntries('Mage Hand').length).toBe(2));
    expect(runtime.store[`${PL_MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
  });
});
