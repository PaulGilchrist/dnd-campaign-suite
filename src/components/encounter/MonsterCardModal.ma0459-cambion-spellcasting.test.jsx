// MA-0459 data lock: Cambion Spellcasting row (actions[3]) carried plain-text
// spell names (zero affordances, MA-0421 family) and spell_save_dc only — the
// save seam never reached buildAbilitySaveRollContext (MA-0532: row-level
// numeric save_dc/save_type required; MA-0237 prose-DC twin). DATA fix mirrors
// the MA-0421 bone-naga / MA-0454 bullywug-bog-sage byte-shape exactly: five
// spell names in <em> with qualifiers OUTSIDE the tags, trailing
// save_dc: 14 + save_type: "Charisma" pair, tier headers byte-unchanged.
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { extractSpellNamesFromSpellcasting, extractSpellcastingSpellUses } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const allSpells = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));
const realSpells = (names) => allSpells.filter(s => names.includes(s.name));

const CAMBION_SPELLS = ['Alter Self', 'Command', 'Detect Magic', 'Dominate Person', 'Plane Shift'];

// Pre-fix description fingerprint (git HEAD, monsters.json) — the markup-only
// diff proof: strip every tag from the FIXED row and it must equal the original
// byte-for-byte.
const CAMBION_PLAIN_ORIGINAL = 'The cambion casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 14):\n2/Day Each: Alter Self, Command (level 3 version), Detect Magic\n1/Day Each: Dominate Person (level 8 version), Plane Shift (self only)';
const stripTags = (d) => d.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '');

const cambion = monsters.find(m => m.index === 'cambion');
const cambionRow = cambion.actions.find(a => a.name === 'Spellcasting');

// ── Mocks (mirror MonsterCardModal.ma0421-bone-naga-spellcasting.test.jsx) ─

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
  loadSpells: vi.fn((version) => Promise.resolve(version === '2024' ? [] : realSpells(CAMBION_SPELLS))),
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

function renderCambion() {
  const m = makeMonster({ name: cambion.name, actions: [cambionRow] });
  const creatures = [
    { name: 'Cambion 1', type: 'npc', monsterType: 'fiend', targetName: 'TestPC', currentHp: cambion.hit_points, maxHp: cambion.hit_points, conditions: [] },
    { name: 'TestPC', type: 'player', currentHp: 60, maxHp: 60, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: 'Cambion 1', creatures })} />);
  expect(stripTags(cambionRow.description)).toBe(CAMBION_PLAIN_ORIGINAL);
}

// ── Data lock: cambion row shape ───────────────────────────────────────────

describe('MA-0459 monsters.json data lock: Cambion Spellcasting row', () => {
  it('authors the MA-0421/MA-0454 byte-shape markup: five spell names in <em>, tier headers unchanged', () => {
    expect(extractSpellNamesFromSpellcasting(cambionRow.description)).toEqual(CAMBION_SPELLS);
  });

  it('qualifiers stay OUTSIDE the tags (MA-0276): level/self-only parentheticals never ride a chip name', () => {
    expect(cambionRow.description).toContain('<em>Command</em> (level 3 version)');
    expect(cambionRow.description).toContain('<em>Dominate Person</em> (level 8 version)');
    expect(cambionRow.description).toContain('<em>Plane Shift</em> (self only)');
  });

  it('extractSpellcastingSpellUses binds the 2/Day x3 + 1/Day x2 gates to MARKED names only', () => {
    expect(extractSpellcastingSpellUses(cambionRow.description)).toEqual({
      'Alter Self': 2, 'Command': 2, 'Detect Magic': 2,
      'Dominate Person': 1, 'Plane Shift': 1,
    });
  });

  it('carries the trailing save_dc 14 + save_type Charisma pair (8 + CHA + PB) — the seam buildAbilitySaveRollContext reads', () => {
    expect(cambionRow.save_dc).toBe(14);
    expect(cambionRow.save_type).toBe('Charisma');
    expect(8 + cambion.ability_score_modifiers.cha + cambion.proficiency_bonus).toBe(14);
    const keys = Object.keys(cambionRow);
    expect(keys.indexOf('save_dc')).toBeGreaterThan(keys.indexOf('spellcasting_ability'));
    expect(keys.indexOf('save_type')).toBeGreaterThan(keys.indexOf('save_dc'));
  });

  it('markup-only diff proof: stripped text equals the pre-fix description byte-for-byte', () => {
    expect(stripTags(cambionRow.description)).toBe(CAMBION_PLAIN_ORIGINAL);
  });
});

// ── Modal: chips + cast routing ────────────────────────────────────────────

describe('MA-0459 MonsterCardModal Cambion Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders five clickable spell chips (was zero affordances) with tier counters', () => {
    renderCambion();
    const names = spellLinks().map(el => el.textContent.split('(')[0].trim());
    expect(names.sort()).toEqual([...CAMBION_SPELLS].sort());
    expect(linkByText('Command').textContent).toMatch(/\(2\/Day · 2 left\)/);
    expect(linkByText('Alter Self').textContent).toMatch(/\(2\/Day · 2 left\)/);
    expect(linkByText('Detect Magic').textContent).toMatch(/\(2\/Day · 2 left\)/);
    expect(linkByText('Dominate Person').textContent).toMatch(/\(1\/Day · 1 left\)/);
    expect(linkByText('Plane Shift').textContent).toMatch(/\(1\/Day · 1 left\)/);
    expect(document.querySelector('.mc-dice-link-save-clickable')).toBeNull();
  });

  it('Dominate Person routes a DC 14 WIS charmed save leg, spends 1/Day, refuses the re-cast', async () => {
    renderCambion();
    await act(async () => { fireEvent.click(linkByText('Dominate Person')); });

    await waitFor(() => expect(rollSavingThrow).toHaveBeenCalled());
    const context = rollSavingThrow.mock.calls[0][2];
    expect(context.spellName).toBe('Dominate Person');
    expect(context.saveDc).toBe(14);
    expect(context.saveType).toBe('WIS');
    expect(context.saveConditions).toEqual(['charmed']);
    expect(context.autoDamageFormula || '').toBe('');

    await waitFor(() => expect(abilityUseEntries('Dominate Person').length).toBe(1));
    expect(runtime.store['Cambion 1.monsterSpellUses']).toEqual({ 'Dominate Person': 1 });
    expect(abilityUseEntries('Dominate Person')[0].description).toMatch(/1\/Day use spent — 0 remaining today/);

    await act(async () => { fireEvent.click(linkByText('Dominate Person')); });
    expect(rollSavingThrow).toHaveBeenCalledTimes(1);
    const refusal = refusals().find(e => e.abilityName === 'Dominate Person');
    expect(refusal).toBeTruthy();
    expect(refusal.description).toMatch(/already cast Dominate Person today \(1\/Day\)/);
    expect(runtime.store['Cambion 1.monsterSpellUses']).toEqual({ 'Dominate Person': 1 });
  });

  it('Command cast logs the DC 14 WIS note on the advisory MA-0348-family record and spends 2/Day', async () => {
    renderCambion();
    await act(async () => { fireEvent.click(linkByText('Command')); });

    await waitFor(() => expect(abilityUseEntries('Command').length).toBe(1));
    expect(abilityUseEntries('Command')[0].description).toMatch(/Cambion 1 casts Command via Spellcasting/);
    expect(abilityUseEntries('Command')[0].description).toMatch(/spell save DC 14, WIS/);
    expect(abilityUseEntries('Command')[0].description).toMatch(/GM-enforced for monsters/);
    expect(abilityUseEntries('Command')[0].description).toMatch(/2\/Day use spent — 1 remaining today/);
    expect(runtime.store['Cambion 1.monsterSpellUses']).toEqual({ 'Command': 1 });
    expect(rollSavingThrow).not.toHaveBeenCalled();
  });

  it('2/Day exhaustion: second cast spends to zero, third is refused with zero spend', async () => {
    renderCambion();
    await act(async () => { fireEvent.click(linkByText('Alter Self')); });
    await waitFor(() => expect(runtime.store['Cambion 1.monsterSpellUses']).toEqual({ 'Alter Self': 1 }));
    await act(async () => { fireEvent.click(linkByText('Alter Self')); });
    await waitFor(() => expect(runtime.store['Cambion 1.monsterSpellUses']).toEqual({ 'Alter Self': 2 }));

    await act(async () => { fireEvent.click(linkByText('Alter Self')); });
    const refusal = refusals().find(e => e.abilityName === 'Alter Self');
    expect(refusal).toBeTruthy();
    expect(refusal.description).toMatch(/already cast Alter Self today \(2\/Day\)/);
    expect(refusal.description).toMatch(/Alter Self refused/);
    expect(runtime.store['Cambion 1.monsterSpellUses']).toEqual({ 'Alter Self': 2 });
  });
});
