// MA-1742 data lock: Yochlol Spellcasting rode the MA-0421 markup-gap
// family — plain-text spell names (zero affordances, row inert). DATA-MARKUP
// fix wraps the four spell names in <em> with <strong> tier headers on the
// archmage/spirit-naga house shape (inline "; " tier delimiters preserved for
// strip-tags byte-equality); the row already carried the save_dc 15 +
// save_type Charisma pair buildAbilitySaveRollContext reads (MA-0532 fork).
// "At Will:"/"1/Day:" headers end ":" → fake-chip guard skips them
// (MonsterCardHelpers.js:399); "1/Day:" matches the uses-header regex (:440)
// binding Dominate Person maxUses 1. 1/Day refusal = monsterSpellUses key +
// "automation blocked" (§57); At-Will ungated by design.
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { extractSpellNamesFromSpellcasting, extractSpellcastingSpellUses } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const allSpells = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));
const spells2024 = JSON.parse(readFileSync('public/data/2024/spells.json', 'utf8'));
const realSpells = (names) => allSpells.filter(s => names.includes(s.name));

const YOCHLOL_SPELLS = ['Detect Thoughts', 'Gaseous Form', 'Web', 'Dominate Person'];

// Pre-fix description fingerprint (git HEAD, monsters.json) — the markup-only
// diff proof: strip every tag from the FIXED row and it must equal the
// original prose byte-for-byte.
const YOCHLOL_PLAIN_ORIGINAL = 'The yochlol casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 15): At Will: Detect Thoughts, Gaseous Form (self only), Web; 1/Day: Dominate Person';
const stripTags = (d) => d.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '');

const yochlol = monsters.find(m => m.index === 'yochlol');
const row = yochlol.actions.find(a => a.name === 'Spellcasting');
const MONSTER_NAME = 'Yochlol 1';

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
  loadSpells: vi.fn((version) => Promise.resolve(version === '2024' ? spells2024 : realSpells(YOCHLOL_SPELLS))),
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

function renderYochlol() {
  const m = makeMonster({ name: yochlol.name, actions: [row] });
  const creatures = [
    { name: MONSTER_NAME, type: 'npc', monsterType: 'fiend', targetName: 'TestPC', currentHp: yochlol.hit_points, maxHp: yochlol.hit_points, conditions: [] },
    { name: 'TestPC', type: 'player', currentHp: 60, maxHp: 60, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: MONSTER_NAME, creatures })} />);
}

// ── Data lock ────────────────────────────────────────────────────────────────

describe('MA-1742 monsters.json data lock: Yochlol Spellcasting row', () => {
  it('carries <em> markup on each of the four spell names and <strong> tier headers', () => {
    for (const name of YOCHLOL_SPELLS) {
      expect(row.description).toContain(`<em>${name}</em>`);
    }
    expect(row.description).toContain('<strong>At Will:</strong>');
    expect(row.description).toContain('<strong>1/Day:</strong>');
  });

  it('extractSpellNamesFromSpellcasting returns the four spell names (was [] zero chips)', () => {
    expect(extractSpellNamesFromSpellcasting(row.description)).toEqual(YOCHLOL_SPELLS);
  });

  it('extractSpellcastingSpellUses binds the 1/Day gate to Dominate Person only', () => {
    expect(extractSpellcastingSpellUses(row.description)).toEqual({ 'Dominate Person': 1 });
  });

  it('carries save_dc 15 + save_type Charisma (8 + CHA + PB) — seam was already byte-present', () => {
    expect(row.save_dc).toBe(15);
    expect(row.save_type).toBe('Charisma');
    expect(8 + yochlol.ability_score_modifiers.cha + yochlol.proficiency_bonus).toBe(15);
  });

  it('all four spells resolve in both 5e and 2024 spell data (no fake chips)', () => {
    for (const name of YOCHLOL_SPELLS) {
      expect(allSpells.some(s => s.name === name)).toBe(true);
      expect(spells2024.some(s => s.name === name)).toBe(true);
    }
  });

  it('markup-only diff proof: stripped text equals the pre-fix description byte-for-byte', () => {
    expect(stripTags(row.description)).toBe(YOCHLOL_PLAIN_ORIGINAL);
  });
});

// ── Modal: chips + cast routing ──────────────────────────────────────────────

describe('MA-1742 MonsterCardModal Yochlol Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders four clickable spell chips (was zero affordances)', () => {
    renderYochlol();
    expect(stripTags(row.description)).toBe(YOCHLOL_PLAIN_ORIGINAL);
    const names = spellLinks().map(el => el.textContent.split('(')[0].trim());
    expect(names.sort()).toEqual([...YOCHLOL_SPELLS].sort());
  });

  it('Dominate Person carries the 1/Day counter, At Will chips do not', () => {
    renderYochlol();
    expect(linkByText('Dominate Person').textContent).toMatch(/\(1\/Day · 1 left\)/);
    for (const name of ['Detect Thoughts', 'Gaseous Form', 'Web']) {
      expect(linkByText(name).textContent).not.toMatch(/\/Day/);
    }
  });

  it('At Will casts are advisory records — repeated casts, zero spend, zero refusal', async () => {
    renderYochlol();
    await act(async () => { fireEvent.click(linkByText('Detect Thoughts')); });
    await act(async () => { fireEvent.click(linkByText('Detect Thoughts')); });
    await act(async () => { fireEvent.click(linkByText('Gaseous Form')); });
    await act(async () => { fireEvent.click(linkByText('Web')); });

    await waitFor(() => expect(abilityUseEntries('Detect Thoughts').length).toBe(2));
    expect(abilityUseEntries('Detect Thoughts')[0].description).toMatch(/Yochlol 1 casts Detect Thoughts via Spellcasting/);
    expect(abilityUseEntries('Detect Thoughts')[0].description).toMatch(/GM-enforced/);
    expect(abilityUseEntries('Gaseous Form').length).toBe(1);
    expect(abilityUseEntries('Web').length).toBe(1);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
    expect(refusals().length).toBe(0);
  });

  it('Dominate Person spends its 1/Day, routes a DC 15 WIS save, refuses the re-cast', async () => {
    renderYochlol();
    await act(async () => { fireEvent.click(linkByText('Dominate Person')); });

    await waitFor(() => expect(abilityUseEntries('Dominate Person').length).toBe(1));
    const saveCalls = rollSavingThrow.mock.calls.filter(c => String(c[2]?.spellName) === 'Dominate Person');
    expect(saveCalls.length).toBe(1);
    expect(saveCalls[0][2].saveDc).toBe(15);
    expect(saveCalls[0][2].saveType).toBe('WIS');
    expect(saveCalls[0][2].isSpellDamage).toBe(true);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Dominate Person': 1 });
    expect(abilityUseEntries('Dominate Person')[0].description).toMatch(/1\/Day use spent — 0 remaining today/);

    await act(async () => { fireEvent.click(linkByText('Dominate Person')); });
    expect(abilityUseEntries('Dominate Person').length).toBe(1);
    const refusal = refusals().find(e => e.abilityName === 'Dominate Person');
    expect(refusal).toBeTruthy();
    expect(refusal.description).toMatch(/already cast Dominate Person today \(1\/Day\)/);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Dominate Person': 1 });
  });
});
