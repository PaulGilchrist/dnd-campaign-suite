// MA-0693 data lock: Empyrean Spellcasting authored the phantom spell name
// "Pass with Trace" — findMonsterSpell exact-match missed both spell DBs
// (canonical "Pass Without Trace"), so the chip cast logged a junk zero-
// adjudication ability_use and console.error'd "Spell not found".
// DATA fix (one string): <strong>Pass with Trace</strong> →
// <strong>Pass Without Trace</strong> in empyrean actions[3].description.
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { extractSpellNamesFromSpellcasting, extractSpellcastingSpellUses } from './MonsterCardHelpers.js';

const rawMonsters = readFileSync('public/data/monsters.json', 'utf8');
const monsters = JSON.parse(rawMonsters);
const spells5e = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));
const spells2024 = JSON.parse(readFileSync('public/data/2024/spells.json', 'utf8'));

const empyrean = monsters.find(m => m.index === 'empyrean');
const row = empyrean.actions.find(a => a.name === 'Spellcasting');
const SPELL = 'Pass Without Trace';
const pwt5e = spells5e.find(s => s.name === SPELL);

const MONSTER_NAME = 'Empyrean 1';

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
  loadSpells: vi.fn((ruleset) => Promise.resolve(ruleset === '2024' ? spells2024 : spells5e)),
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
import { _rollSavingThrow, _rollAttack } from '../../hooks/combat/useLoggedDiceRoll.js';

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

function renderEmpyrean() {
  const m = makeMonster({ name: 'Empyrean', index: 'empyrean', actions: [row] });
  const creatures = [
    { name: MONSTER_NAME, type: 'npc', monsterType: 'celestial', targetName: 'Bandit', ac: 22, currentHp: 213, maxHp: 213, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: MONSTER_NAME, creatures })} />);
}

// ── Data lock: Empyrean Spellcasting row ────────────────────────────────────

describe('MA-0693 monsters.json data lock: Empyrean Spellcasting row', () => {
  it('description authors the canonical "Pass Without Trace" — the typo is gone', () => {
    expect(row.description).toContain('<strong>Pass Without Trace</strong>');
    expect(row.description).not.toContain('Pass with Trace');
  });

  it('phantom typo is grep-zero across the WHOLE monsters.json file', () => {
    expect(rawMonsters).not.toContain('Pass with Trace');
  });

  it('extracts all seven spell names with the canonical spelling — tier headers skipped', () => {
    const names = extractSpellNamesFromSpellcasting(row.description);
    expect(names).toEqual(['Calm Emotions', 'Greater Restoration', SPELL, 'Water Breathing', 'Commune', 'Dispel Evil and Good', 'Plane Shift']);
  });

  it('every extracted spell name resolves via findMonsterSpell exact-match (5e-first) — no phantom names', () => {
    const names = extractSpellNamesFromSpellcasting(row.description);
    const findMonsterSpell = (name) => spells5e.find(s => s.name === name) || spells2024.find(s => s.name === name) || null;
    for (const name of names) {
      expect(findMonsterSpell(name), `spell "${name}" must resolve`).toBeTruthy();
    }
  });

  it('Pass Without Trace 5e entry: save-less damage-less concentration utility — advisory route', () => {
    expect(pwt5e).toBeTruthy();
    expect(pwt5e.level).toBe(2);
    expect(pwt5e.school).toBe('Abjuration');
    expect(pwt5e.concentration).toBe(true);
    expect(pwt5e.duration).toBe('Up to 1 hour');
    expect(pwt5e.damage).toBeUndefined();
    expect(pwt5e.dc).toBeUndefined();
    expect(pwt5e.attack_type).toBeUndefined();
    expect(spells2024.some(s => s.name === SPELL)).toBe(true);
  });

  it('At Will tier: uses bound only to the 1/Day trio — Pass Without Trace ungated', () => {
    const uses = extractSpellcastingSpellUses(row.description);
    expect(uses[SPELL]).toBeUndefined();
    expect(uses).toEqual({ 'Commune': 1, 'Dispel Evil and Good': 1, 'Plane Shift': 1 });
  });
});

// ── Modal: chip renders and casts cleanly via the advisory utility route ───

describe('MA-0693 MonsterCardModal Empyrean Spellcasting chip', () => {
  let consoleError;
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('renders a "Pass Without Trace" spell chip with no counter and no spent class', () => {
    renderEmpyrean();
    const chip = spellLinks().find(el => el.textContent.trim() === SPELL);
    expect(chip).toBeTruthy();
    expect(chip.textContent).not.toMatch(/\/Day/);
    expect(chip.className).not.toMatch(/spent/);
  });

  it('cast logs clean ability_use advisory with concentration note — zero console errors', async () => {
    renderEmpyrean();
    await act(async () => { fireEvent.click(linkByText(SPELL)); });
    await waitFor(() => expect(abilityUseEntries(SPELL).length).toBe(1));
    const entry = abilityUseEntries(SPELL)[0];
    expect(entry.type).toBe('ability_use');
    expect(entry.characterName).toBe(MONSTER_NAME);
    expect(entry.description).toMatch(/casts Pass Without Trace via Spellcasting/);
    expect(entry.description).toMatch(/Concentration \(Up to 1 hour\)/);
    expect(entry.description).toMatch(/Spell effect is recorded; GM-enforced/);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('At Will casts ungated twice — zero refusals, zero save/attack rolls', async () => {
    renderEmpyrean();
    await act(async () => { fireEvent.click(linkByText(SPELL)); });
    await waitFor(() => expect(abilityUseEntries(SPELL).length).toBe(1));
    await act(async () => { fireEvent.click(linkByText(SPELL)); });
    await waitFor(() => expect(abilityUseEntries(SPELL).length).toBe(2));
    expect(refusals(SPELL)).toHaveLength(0);
    expect(_rollSavingThrow).not.toHaveBeenCalled();
    expect(_rollAttack).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });
});
