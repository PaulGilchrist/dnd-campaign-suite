// MA-0421 data lock: Bone Naga Spellcasting row had plain-text spell names
// (zero affordances). DATA-MARKUP fix wraps the five spell names in
// <strong> on the archmage/lich byte-shape (<br> delimiters, strong names,
// "1/Day Each:" header) and adds the save_dc/save_type seam the save
// context resolves (MonsterCardModal.jsx buildAbilitySaveRollContext reads
// action.save_dc; spell_save_dc alone never reaches the prompt). Sibling
// hygiene: spirit-naga carried the identical unmarked fingerprint and got
// the same markup in-pass.
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { extractSpellNamesFromSpellcasting, extractSpellcastingSpellUses } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const allSpells = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));
const realSpells = (names) => allSpells.filter(s => names.includes(s.name));

const BONE_SPELLS = ['Mage Hand', 'Thaumaturgy', 'Command', 'Detect Thoughts', 'Lightning Bolt'];
const SPIRIT_SPELLS = ['Detect Magic', 'Mage Hand', 'Minor Illusion', 'Water Breathing', 'Detect Thoughts', 'Dimension Door', 'Hold Person', 'Lightning Bolt'];

// Pre-fix description fingerprints (git HEAD, monsters.json) — the markup-only
// diff proof: strip every tag from the FIXED row and it must equal these
// originals byte-for-byte (<br> normalized back to the original \n form).
const BONE_PLAIN_ORIGINAL = 'The naga casts one of the following spells, requiring no Material components and using Intelligence as the spellcasting ability (spell save DC 13):\nAt Will: Mage Hand, Thaumaturgy\n1/Day Each: Command, Detect Thoughts, Lightning Bolt';
const SPIRIT_PLAIN_ORIGINAL = 'The naga casts one of the following spells, requiring no Somatic or Material components and using Intelligence as the spellcasting ability (spell save DC 14): At Will: Detect Magic, Mage Hand, Minor Illusion, Water Breathing; 2/Day Each: Detect Thoughts, Dimension Door, Hold Person (level 3 version), Lightning Bolt (level 4 version)';
const stripTags = (d) => d.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '');

const boneRow = monsters.find(m => m.index === 'bone-naga').actions.find(a => a.name === 'Spellcasting');
const spiritRow = monsters.find(m => m.index === 'spirit-naga').actions.find(a => a.name === 'Spellcasting');

// ── Mocks (mirror MonsterCardModal.spellcasting.test.jsx) ─────────────────

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 21, rolls: [4, 5, 6, 6], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 42, rolls: [4, 5, 6, 6, 4, 5, 6, 6], modifier: 0 })),
}));

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSpells: vi.fn((version) => Promise.resolve(version === '2024' ? [] : realSpells([...BONE_SPELLS, ...SPIRIT_SPELLS]))),
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
  findCreatureByName: vi.fn(({ creatures }, name) => (creatures || []).find(c => c.name === name) || null),
  getCombatContext: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(() => ({ mode: 'normal', reason: '' })),
  getDistanceFeet: vi.fn(() => null),
  getNearestPlacedItem: vi.fn(() => null),
  rangeToFeet: vi.fn((r) => (typeof r === 'number' ? r : 30)),
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

function refusals() {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'automation blocked');
}

function renderNaga(index, plainOriginal) {
  const monster = monsters.find(m => m.index === index);
  const row = monster.actions.find(a => a.name === 'Spellcasting');
  const m = makeMonster({ name: monster.name, actions: [row] });
  const creatures = [
    { name: `${monster.name} 1`, type: 'npc', monsterType: 'monstrosity', targetName: 'TestPC', currentHp: monster.hit_points, maxHp: monster.hit_points, conditions: [] },
    { name: 'TestPC', type: 'player', currentHp: 60, maxHp: 60, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: `${monster.name} 1`, creatures })} />);
  expect(stripTags(row.description)).toBe(plainOriginal);
}

// ── Data lock: bone-naga row shape ────────────────────────────────────────

describe('MA-0421 monsters.json data lock: Bone Naga Spellcasting row', () => {
  it('authors the archmage/lich byte-shape markup: five spell names in <strong>, <br> delimiters, "1/Day Each:" header', () => {
    expect(extractSpellNamesFromSpellcasting(boneRow.description)).toEqual(BONE_SPELLS);
  });

  it('extractSpellcastingSpellUses keys the 1/Day gate for Command/Detect Thoughts/Lightning Bolt', () => {
    expect(extractSpellcastingSpellUses(boneRow.description)).toEqual({
      'Command': 1, 'Detect Thoughts': 1, 'Lightning Bolt': 1,
    });
  });

  it('carries save_dc 13 + save_type Intelligence (8 + INT + PB) — the seam buildAbilitySaveRollContext reads', () => {
    const monster = monsters.find(m => m.index === 'bone-naga');
    expect(boneRow.save_dc).toBe(13);
    expect(boneRow.save_type).toBe('Intelligence');
    expect(8 + monster.ability_score_modifiers.int + monster.proficiency_bonus).toBe(13);
  });

  it('markup-only diff proof: stripped text equals the pre-fix description byte-for-byte', () => {
    expect(stripTags(boneRow.description)).toBe(BONE_PLAIN_ORIGINAL);
  });
});

describe('MA-0421 sibling hygiene: Spirit Naga identical unmarked fingerprint fixed in-pass', () => {
  it('all eight spell names now extract as chips', () => {
    expect(extractSpellNamesFromSpellcasting(spiritRow.description)).toEqual(SPIRIT_SPELLS);
  });

  it('2/Day Each gate parses for Detect Thoughts/Dimension Door/Hold Person/Lightning Bolt', () => {
    expect(extractSpellcastingSpellUses(spiritRow.description)).toEqual({
      'Detect Thoughts': 2, 'Dimension Door': 2, 'Hold Person': 2, 'Lightning Bolt': 2,
    });
  });

  it('markup-only diff proof: stripped text equals the pre-fix description byte-for-byte', () => {
    expect(stripTags(spiritRow.description)).toBe(SPIRIT_PLAIN_ORIGINAL);
  });
});

// ── Modal: Bone Naga chips + cast routing ──────────────────────────────────

describe('MA-0421 MonsterCardModal Bone Naga Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders five clickable spell chips (was zero affordances)', () => {
    renderNaga('bone-naga', BONE_PLAIN_ORIGINAL);
    const names = spellLinks().map(el => el.textContent.split('(')[0].trim());
    expect(names.sort()).toEqual([...BONE_SPELLS].sort());
    expect(document.querySelector('.mc-dice-link-save-clickable')).toBeNull();
  });

  it('limited chips carry the 1/Day counter, At Will chips do not', () => {
    renderNaga('bone-naga', BONE_PLAIN_ORIGINAL);
    expect(linkByText('Lightning Bolt').textContent).toMatch(/\(1\/Day · 1 left\)/);
    expect(linkByText('Command').textContent).toMatch(/\(1\/Day · 1 left\)/);
    expect(linkByText('Detect Thoughts').textContent).toMatch(/\(1\/Day · 1 left\)/);
    expect(linkByText('Mage Hand').textContent).not.toMatch(/\/Day/);
    expect(linkByText('Thaumaturgy').textContent).not.toMatch(/\/Day/);
  });

  it('Lightning Bolt routes a DC 13 DEX half-on-success 8d6 Lightning save, spends 1/Day, refuses the re-cast', async () => {
    renderNaga('bone-naga', BONE_PLAIN_ORIGINAL);
    await act(async () => { fireEvent.click(linkByText('Lightning Bolt')); });

    await waitFor(() => expect(rollSavingThrow).toHaveBeenCalled());
    const context = rollSavingThrow.mock.calls[0][2];
    expect(context.spellName).toBe('Lightning Bolt');
    expect(context.saveDc).toBe(13);
    expect(context.saveType).toBe('DEX');
    expect(context.dcSuccess).toBe('half');
    expect(context.autoDamageFormula).toBe('8d6');
    expect(context.autoDamageDamageType).toBe('Lightning');
    expect(context.isSpellDamage).toBe(true);

    await waitFor(() => expect(abilityUseEntries('Lightning Bolt').length).toBe(1));
    expect(runtime.store['Bone Naga 1.monsterSpellUses']).toEqual({ 'Lightning Bolt': 1 });
    expect(abilityUseEntries('Lightning Bolt')[0].description).toMatch(/1\/Day use spent — 0 remaining today/);

    await act(async () => { fireEvent.click(linkByText('Lightning Bolt')); });
    expect(rollSavingThrow).toHaveBeenCalledTimes(1);
    const refusal = refusals().find(e => e.abilityName === 'Lightning Bolt');
    expect(refusal).toBeTruthy();
    expect(refusal.description).toMatch(/already cast Lightning Bolt today \(1\/Day\)/);
    expect(runtime.store['Bone Naga 1.monsterSpellUses']).toEqual({ 'Lightning Bolt': 1 });
  });

  it('Command and Detect Thoughts stay advisory MA-0348-family records — honest cast log, no save prompt', async () => {
    renderNaga('bone-naga', BONE_PLAIN_ORIGINAL);
    await act(async () => { fireEvent.click(linkByText('Command')); });
    await act(async () => { fireEvent.click(linkByText('Detect Thoughts')); });

    await waitFor(() => expect(abilityUseEntries('Command').length).toBe(1));
    expect(abilityUseEntries('Command')[0].description).toMatch(/Bone Naga 1 casts Command via Spellcasting/);
    expect(abilityUseEntries('Command')[0].description).toMatch(/GM-enforced for monsters/);
    expect(abilityUseEntries('Detect Thoughts').length).toBe(1);
    expect(abilityUseEntries('Detect Thoughts')[0].description).toMatch(/GM-enforced for monsters/);
    expect(rollSavingThrow).not.toHaveBeenCalled();
    expect(abilityUseEntries('Command')[0].description).toMatch(/1\/Day use spent — 0 remaining today/);
  });

  it('At Will Mage Hand and Thaumaturgy cast freely — repeated casts, zero spend, zero refusal', async () => {
    renderNaga('bone-naga', BONE_PLAIN_ORIGINAL);
    await act(async () => { fireEvent.click(linkByText('Mage Hand')); });
    await act(async () => { fireEvent.click(linkByText('Mage Hand')); });
    await act(async () => { fireEvent.click(linkByText('Thaumaturgy')); });

    await waitFor(() => expect(abilityUseEntries('Mage Hand').length).toBe(2));
    expect(abilityUseEntries('Thaumaturgy').length).toBe(1);
    expect(runtime.store['Bone Naga 1.monsterSpellUses'] ?? null).toBeNull();
    expect(refusals().length).toBe(0);
  });
});
