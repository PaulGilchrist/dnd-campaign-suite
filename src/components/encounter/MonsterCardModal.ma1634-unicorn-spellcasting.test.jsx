// MA-1634 data lock: Unicorn Spellcasting (actions[3]) rode the
// MA-0421/MA-1230/MA-1543/MA-1625 markup-gap family — the WHOLE description
// was plain text on a SINGLE line with "; " tier separators: names AND both
// tier headers unmarked → extractSpellNamesFromSpellcasting [] →
// SpellCastLinks null → zero chips, zero cast affordance; the 1/Day-EACH
// tracking was structurally dead (§144 binds MARKED headers + names only).
// Row-level numeric save_dc 14 + Charisma pair was ALREADY authored (§89
// gate pre-met; §676/MA-1294 XOR fork keeps the row DC unrendered as a chip
// on Spellcasting rows — expected, not a fail axis; the 14 rides the save
// seam via buildAbilitySaveRollContext.saveDc instead).
// DATA fix = dao MA-1543/storm-giant house style: <strong> headers +
// <em> on all seven names, "; " / ", " separators byte-kept (single-line
// prose, no <br>/\n — strip-tags byte-equality proves markup-only diff).
// CANONICAL-NAME AMENDMENT (§1241/§158 trap ACTIVE HERE, unlike ultroloth
// MA-1625 where all six names resolved): the DBs index "Pass Without Trace"
// capital-W; findMonsterSpell is EXACT-match (Modal:1354/:1357), so the
// prose lowercase-w form would have rendered a chip that logs junk
// ability_use + console "Spell not found" (§161 noise). The wrapped name
// uses the canonical capital-W spelling — the ONE prose byte changed outside
// tags, pinned below. Headers end ":" → skipped by the extractor (§648),
// so no fake chips.
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { extractSpellNamesFromSpellcasting, extractSpellcastingSpellUses } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const spells5e = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));
const spells2024 = JSON.parse(readFileSync('public/data/2024/spells.json', 'utf8'));

const unicorn = monsters.find(m => m.index === 'unicorn');
const unRow = unicorn.actions.find(a => a.name === 'Spellcasting');
const NAMES = ['Detect Evil and Good', 'Druidcraft', 'Calm Emotions', 'Dispel Evil and Good', 'Entangle', 'Pass Without Trace', 'Word of Recall'];
const ONE_DAY = ['Calm Emotions', 'Dispel Evil and Good', 'Entangle', 'Pass Without Trace', 'Word of Recall'];
const AT_WILL = ['Detect Evil and Good', 'Druidcraft'];

const UNICORN_PLAIN_ORIGINAL = 'The unicorn casts one of the following spells, requiring no spell components and using Charisma as the spellcasting ability (spell save DC 14): At Will: Detect Evil and Good, Druidcraft; 1/Day Each: Calm Emotions, Dispel Evil and Good, Entangle, Pass without Trace, Word of Recall';
const UNICORN_FIXED_BYTES = 'The unicorn casts one of the following spells, requiring no spell components and using Charisma as the spellcasting ability (spell save DC 14): <strong>At Will:</strong> <em>Detect Evil and Good</em>, <em>Druidcraft</em>; <strong>1/Day Each:</strong> <em>Calm Emotions</em>, <em>Dispel Evil and Good</em>, <em>Entangle</em>, <em>Pass Without Trace</em>, <em>Word of Recall</em>';
const stripTags = (d) => d.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '');

const ENTANGLE = spells5e.find(s => s.name === 'Entangle');
const SPELLS_5E = spells5e.filter(s => NAMES.includes(s.name));
const SPELLS_2024 = spells2024.filter(s => NAMES.includes(s.name));

const MONSTER_NAME = 'Unicorn 1';

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
  // to loadSpells('2024') — both branches serve the seven names here (§158).
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

import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import { addEntry } from '../../services/ui/logService.js';

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

function renderUnicorn() {
  const m = makeMonster({ name: 'Unicorn', index: 'unicorn', type: 'celestial', actions: [unRow] });
  const creatures = [
    { name: MONSTER_NAME, type: 'npc', monsterType: 'celestial', targetName: 'Bandit', ac: 12, currentHp: 97, maxHp: 97, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: MONSTER_NAME, creatures })} />);
}

// ── Data lock: unicorn Spellcasting row ──────────────────────────────────────

describe('MA-1634 monsters.json data lock: Unicorn Spellcasting row', () => {
  it('extracts all seven spell names as chips — tier headers skipped', () => {
    const names = extractSpellNamesFromSpellcasting(unRow.description);
    expect(names).toEqual(NAMES);
    expect(names).not.toContain('At Will');
    expect(names).not.toContain('1/Day Each');
  });

  it('binds 1/Day Each to exactly the five marked names; At Will pair ungated (§57/§144)', () => {
    const uses = extractSpellcastingSpellUses(unRow.description);
    expect(uses).toEqual(Object.fromEntries(ONE_DAY.map(n => [n, 1])));
    AT_WILL.forEach(n => expect(uses[n]).toBeUndefined());
  });

  it('fixed description is byte-exact house style (dao MA-1543 storm-giant shape: <strong> headers + <em> names)', () => {
    expect(unRow.description).toBe(UNICORN_FIXED_BYTES);
    expect(unRow.description).toMatch(/<strong>At Will:<\/strong> <em>Detect Evil and Good<\/em>, <em>Druidcraft<\/em>; <strong>1\/Day Each:<\/strong>/);
    expect(unRow.description).toMatch(/<em>Entangle<\/em>, <em>Pass Without Trace<\/em>, <em>Word of Recall<\/em>/);
  });

  it('no fake chips: §161 — only the seven names + trailing-":" headers are emphasis spans', () => {
    const spans = [...unRow.description.matchAll(/<(?:strong|em)>([^<]+)<\/(?:strong|em)>/g)].map(m => m[1]);
    expect(spans).toEqual(['At Will:', ...AT_WILL, '1/Day Each:', ...ONE_DAY]);
  });

  it('markup-only diff proof: stripped text equals the pre-fix description byte-for-byte EXCEPT the canonical capital-W amendment (§89/§1241)', () => {
    expect(stripTags(unRow.description)).toBe(UNICORN_PLAIN_ORIGINAL.replace('Pass without Trace', 'Pass Without Trace'));
  });

  it('canonical-name trap pinned (§1241/§158): lowercase-w prose form resolves in NEITHER DB — capital-W is MANDATORY', () => {
    expect(spells5e.some(s => s.name === 'Pass without Trace')).toBe(false);
    expect(spells2024.some(s => s.name === 'Pass without Trace')).toBe(false);
    expect(spells5e.some(s => s.name === 'Pass Without Trace')).toBe(true);
    expect(spells2024.some(s => s.name === 'Pass Without Trace')).toBe(true);
  });

  it('row-level numeric save_dc 14 + save_type Charisma pair kept byte-untouched (§89); DC 14 = 8 + CHA +3 + PB +3', () => {
    expect(unRow.save_dc).toBe(14);
    expect(unRow.save_type).toBe('Charisma');
    expect(unRow.spell_save_dc).toBeUndefined();
    expect(unRow.attack_bonus).toBeUndefined();
    expect(unRow.automation).toBeUndefined();
    expect(unRow.save_effect).toMatch(/spell save DC 14/);
    expect(unicorn.ability_score_modifiers.cha).toBe(3);
    expect(unicorn.proficiency_bonus).toBe(3);
    expect(8 + unicorn.ability_score_modifiers.cha + unicorn.proficiency_bonus).toBe(14);
  });

  it('all seven canonical names resolvable in BOTH spell DBs (§158 trap closed); Entangle rides STR/none', () => {
    NAMES.forEach(n => {
      expect(spells5e.some(s => s.name === n)).toBe(true);
      expect(spells2024.some(s => s.name === n)).toBe(true);
    });
    expect(ENTANGLE.dc).toEqual({ dc_type: 'STR', dc_success: 'none' });
    expect(ENTANGLE.damage ?? null).toBeNull();
  });
});

// ── Modal: seven chips, counters, gates ──────────────────────────────────────

describe('MA-1634 MonsterCardModal Unicorn Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    runtime.setRuntimeValue.mockImplementation((characterKey, propertyName, value) => { runtime.store[`${characterKey}.${propertyName}`] = value; return Promise.resolve(); });
    runtime.getRuntimeValue.mockImplementation((characterKey, propertyName) => runtime.store[`${characterKey}.${propertyName}`] ?? null);
    runtime.useRuntimeValue.mockImplementation((characterKey, propertyName) => runtime.store[`${characterKey}.${propertyName}`] ?? null);
  });

  it('renders seven spell chips — the zero-chip inert row is gone', () => {
    renderUnicorn();
    expect(spellLinks().map(el => el.textContent.split('(')[0].trim())).toEqual(NAMES);
  });

  it('the five 1/Day names carry counters; the At Will pair does not', () => {
    renderUnicorn();
    ONE_DAY.forEach(n => expect(linkByText(n).textContent).toMatch(/\(1\/Day · 1 left\)/));
    AT_WILL.forEach(n => expect(linkByText(n).textContent).not.toMatch(/\/Day/));
  });

  it('At Will Druidcraft casts ungated twice — zero uses, advisory log prints row DC 14 Charisma', async () => {
    renderUnicorn();
    await act(async () => { fireEvent.click(linkByText('Druidcraft')); });
    await waitFor(() => expect(abilityUseEntries('Druidcraft').length).toBe(1));
    expect(abilityUseEntries('Druidcraft')[0].description).toMatch(/\(spell save DC 14, Charisma\)/);
    await act(async () => { fireEvent.click(linkByText('Druidcraft')); });
    await waitFor(() => expect(abilityUseEntries('Druidcraft').length).toBe(2));
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
    expect(refusals('Druidcraft').length).toBe(0);
  });

  it('Entangle (AoE, no damage) rides the ADVISORY lane — prompt never opens (§445/MA-0894); row DC 14 stamped STR + 1/Day spent + exhausted refusal', async () => {
    renderUnicorn();
    await act(async () => { fireEvent.click(linkByText('Entangle')); });
    await waitFor(() => expect(abilityUseEntries('Entangle').length).toBe(1));
    // spellDamagelessSaveCondition area early-return (Helpers:371): AoE legs
    // stay advisory; the advisory record prints the ROW DC with the SPELL's
    // own dc_type (STR per §1665 RAW — row save_type is the CASTING ability).
    expect(rollSavingThrow).toHaveBeenCalledTimes(0);
    expect(abilityUseEntries('Entangle')[0].description).toMatch(/\(spell save DC 14, STR\)/);
    expect(abilityUseEntries('Entangle')[0].description).toMatch(/1\/Day use spent — 0 remaining today/);
    await waitFor(() => expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ Entangle: 1 }));
    await act(async () => { fireEvent.click(linkByText('Entangle')); });
    await waitFor(() => expect(refusals('Entangle').length).toBe(1));
    expect(refusals('Entangle')[0].description).toMatch(/already cast Entangle today \(1\/Day\)/);
    expect(rollSavingThrow).toHaveBeenCalledTimes(0);
    expect(abilityUseEntries('Entangle').length).toBe(1);
  });

  it('exhausted 1/Day Calm Emotions re-click refused — zero extra spend (§57)', async () => {
    renderUnicorn();
    await act(async () => { fireEvent.click(linkByText('Calm Emotions')); });
    await waitFor(() => expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Calm Emotions': 1 }));
    await act(async () => { fireEvent.click(linkByText('Calm Emotions')); });
    await waitFor(() => expect(refusals('Calm Emotions').length).toBe(1));
    expect(refusals('Calm Emotions')[0].description).toMatch(/already cast Calm Emotions today \(1\/Day\)/);
    expect(abilityUseEntries('Calm Emotions').length).toBe(1);
  });

  it('canonical Pass Without Trace spends its own independent 1/Day counter and resolves (§1241 capital-W live)', async () => {
    renderUnicorn();
    await act(async () => { fireEvent.click(linkByText('Pass Without Trace')); });
    await waitFor(() => expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Pass Without Trace': 1 }));
    expect(refusals('Pass Without Trace').length).toBe(0);
    await act(async () => { fireEvent.click(linkByText('Pass Without Trace')); });
    await waitFor(() => expect(refusals('Pass Without Trace').length).toBe(1));
    expect(abilityUseEntries('Pass Without Trace').length).toBe(1);
  });
});
