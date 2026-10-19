// @maintained-by-ai
// MA-1742 data lock: Yochlol Spellcasting rode the MA-0421 markup-gap
// family — plain-text spell names (zero affordances, row inert). DATA-MARKUP
// fix wraps the four spell names in <em> with <strong> tier headers on the
// archmage/spirit-naga house shape (inline "; " tier delimiters byte-kept).
// Row-level numeric save_dc 15 + save_type Charisma pair was ALREADY authored
// (§89) — buildAbilitySaveRollContext reads it (§676/MA-1294 fork); the 15
// rides the save seam instead of a chip. "(self only)" stays OUTSIDE the
// <em> (night-hag MA-1230 / ultroloth MA-1625 suffix precedent) so the
// harvested "Gaseous Form" resolves vs spells.json. Headers end ":" → the
// colon-guard skips them (MonsterCardHelpers.js:399) — no fake chips (§161);
// "1/Day:" matches the uses-header regex (:440), binding Dominate Person
// maxUses 1. At Will trio is ADVISORY (all three: no dc, no damage in spell
// DBs) — save-less lane never rolls, so the diceRoller mock is purged dead.
// Generic lanes are OWNED by spellcasting.test.jsx and not re-asserted here:
// counter badge render :275, exhausted spend + spell-named refusal :288-302,
// multi-key independence :522-548, At Will null store :327/:561. DC
// arithmetic restatement removed (row dc bytes pinned once).
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { extractSpellNamesFromSpellcasting, extractSpellcastingSpellUses } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const spells5e = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));
const spells2024 = JSON.parse(readFileSync('public/data/2024/spells.json', 'utf8'));

const yochlol = monsters.find(m => m.index === 'yochlol');
const row = yochlol.actions.find(a => a.name === 'Spellcasting');
const NAMES = ['Detect Thoughts', 'Gaseous Form', 'Web', 'Dominate Person'];
const AT_WILL = ['Detect Thoughts', 'Gaseous Form', 'Web'];

// Exact byte-lock: two <strong> headers + four <em> names, "(self only)"
// OUTSIDE the <em>, "; " tier delimiter byte-kept (no <br>/\n). The
// extractor exact-map below proves no fake chips (§161/§648).
const YOCHLOL_FIXED_BYTES = 'The yochlol casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 15): <strong>At Will:</strong> <em>Detect Thoughts</em>, <em>Gaseous Form</em> (self only), <em>Web</em>; <strong>1/Day:</strong> <em>Dominate Person</em>';

const DOMINATE = spells5e.find(s => s.name === 'Dominate Person');
const SPELLS_5E = spells5e.filter(s => NAMES.includes(s.name));
const SPELLS_2024 = spells2024.filter(s => NAMES.includes(s.name));

const MONSTER_NAME = 'Yochlol 1';

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
  // §177 ruleset-branch pitfall: findMonsterSpell is 5e-first, falling back
  // to loadSpells('2024') — both branches serve the four names here (§158).
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
    _rollSavingThrow,
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

function renderYochlol() {
  const m = makeMonster({ name: yochlol.name, index: 'yochlol', type: 'fiend', actions: [row] });
  const creatures = [
    { name: MONSTER_NAME, type: 'npc', monsterType: 'fiend', targetName: 'TestPC', currentHp: yochlol.hit_points, maxHp: yochlol.hit_points, conditions: [] },
    { name: 'TestPC', type: 'player', currentHp: 60, maxHp: 60, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: MONSTER_NAME, creatures })} />);
}

// ── Data lock: yochlol Spellcasting row ──────────────────────────────────────

describe('MA-1742 monsters.json data lock: Yochlol Spellcasting row', () => {
  it('description is byte-exact house style + numeric save_dc 15 / save_type Charisma pair kept byte-untouched (§89)', () => {
    expect(row.description).toBe(YOCHLOL_FIXED_BYTES);
    expect(row.save_dc).toBe(15);
    expect(row.save_type).toBe('Charisma');
  });

  it('extractor harvests exactly the four names and gates Dominate Person only — headers and "(self only)" never enter the harvest (§57/§144, no fake chips §161/§648)', () => {
    expect(extractSpellNamesFromSpellcasting(row.description)).toEqual(NAMES);
    expect(extractSpellcastingSpellUses(row.description)).toEqual({ 'Dominate Person': 1 });
  });

  it('all four names resolve in BOTH spell DBs (§158 trap INACTIVE); spell-side shapes — Dominate Person enforced WIS/other, At Will trio damage-free and dc-free (advisory, never rolls)', () => {
    NAMES.forEach(n => {
      expect(spells5e.some(s => s.name === n)).toBe(true);
      expect(spells2024.some(s => s.name === n)).toBe(true);
    });
    expect(DOMINATE.dc.dc_type).toBe('WIS');
    expect(DOMINATE.dc.dc_success).toBe('other');
    expect(DOMINATE.damage ?? null).toBeNull();
    AT_WILL.forEach(n => {
      const s = spells5e.find(sp => sp.name === n);
      expect(s.damage ?? null).toBeNull();
      expect(s.dc ?? null).toBeNull();
    });
  });
});

// ── Modal: chips + advisory/gate e2e ─────────────────────────────────────────

describe('MA-1742 MonsterCardModal Yochlol Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    runtime.setRuntimeValue.mockImplementation((characterKey, propertyName, value) => { runtime.store[`${characterKey}.${propertyName}`] = value; return Promise.resolve(); });
    runtime.getRuntimeValue.mockImplementation((characterKey, propertyName) => runtime.store[`${characterKey}.${propertyName}`] ?? null);
    runtime.useRuntimeValue.mockImplementation((characterKey, propertyName) => runtime.store[`${characterKey}.${propertyName}`] ?? null);
  });

  it('renders four chips — counter on Dominate Person only, At Will trio bare (the zero-chip inert row is gone)', () => {
    renderYochlol();
    expect(spellLinks().map(el => el.textContent.split('(')[0].trim())).toEqual(NAMES);
    expect(linkByText('Dominate Person').textContent).toMatch(/\(1\/Day · 1 left\)/);
    AT_WILL.forEach(n => expect(linkByText(n).textContent).not.toMatch(/\/Day/));
  });

  it('At Will casts ungated — "(self only)" Gaseous Form LIVE-resolves and recasts; advisory logs print row DC 15 Charisma, zero refusals', async () => {
    renderYochlol();
    for (const n of ['Detect Thoughts', 'Web']) {
      await act(async () => { fireEvent.click(linkByText(n)); });
      await waitFor(() => expect(abilityUseEntries(n).length).toBe(1));
    }
    const gaseous = linkByText('Gaseous Form');
    await act(async () => { fireEvent.click(gaseous); });
    await waitFor(() => expect(abilityUseEntries('Gaseous Form').length).toBe(1));
    expect(abilityUseEntries('Gaseous Form')[0].description).toMatch(/\(spell save DC 15, Charisma\)/);
    expect(abilityUseEntries('Detect Thoughts')[0].description).toMatch(/Yochlol 1 casts Detect Thoughts via Spellcasting/);
    expect(abilityUseEntries('Detect Thoughts')[0].description).toMatch(/GM-enforced/);
    await act(async () => { fireEvent.click(gaseous); });
    await waitFor(() => expect(abilityUseEntries('Gaseous Form').length).toBe(2));
    expect(rollSavingThrow).toHaveBeenCalledTimes(0);
    expect(refusals().length).toBe(0);
    // null monsterSpellUses store is owned by spellcasting.test.jsx:327/:561.
  });

  it('Dominate Person spends its 1/Day and routes the enforced DC 15 WIS save; re-cast refuses, store and save calls unchanged', async () => {
    renderYochlol();
    await act(async () => { fireEvent.click(linkByText('Dominate Person')); });

    await waitFor(() => expect(abilityUseEntries('Dominate Person').length).toBe(1));
    await waitFor(() => expect(rollSavingThrow).toHaveBeenCalledTimes(1));
    const context = rollSavingThrow.mock.calls[0][2];
    expect(context.spellName).toBe('Dominate Person');
    expect(context.saveDc).toBe(15);
    expect(context.saveType).toBe('WIS');
    expect(context.isSpellDamage).toBe(true);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Dominate Person': 1 });
    expect(abilityUseEntries('Dominate Person')[0].description).toMatch(/1\/Day use spent — 0 remaining today/);

    // Exhausted-refuse shape owned by spellcasting.test.jsx:288-302; this
    // pins only the yochlol-specific refusal byte + gate holding the save.
    await act(async () => { fireEvent.click(linkByText('Dominate Person')); });
    await waitFor(() => expect(refusals('Dominate Person').length).toBe(1));
    expect(refusals('Dominate Person')[0].description).toMatch(/already cast Dominate Person today \(1\/Day\)/);
    expect(rollSavingThrow).toHaveBeenCalledTimes(1);
    expect(abilityUseEntries('Dominate Person').length).toBe(1);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Dominate Person': 1 });
  });
});
