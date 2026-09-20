// MA-0599 data lock: Deva Spellcasting rode the MA-0421/MA-0524/MA-0532/
// MA-0576 twin markup-gap template plus the §158 fake-chip variant: pre-fix
// Detect Evil and Good/Shapechange/Commune/Raise Dead were plain text (zero
// chips, 1/Day gating invisible) while mid-prose <strong>Concentration</strong>
// and <strong>Temporary Hit Points</strong> rendered clickable FAKE chips —
// clicks logged junk ability_use "casts Concentration via Spellcasting" +
// console "Spell 'Concentration' not found" with zero adjudication.
// DATA fix = archmage MA-0421 byte-shape: <em> on each spell name (headers
// byte-kept), decoy mid-prose <strong> emphases stripped, strip-tags
// byte-equality proves markup-only diff.
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { extractSpellNamesFromSpellcasting, extractSpellcastingSpellUses } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const spells5e = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));

const deva = monsters.find(m => m.index === 'deva');
const devaRow = deva.actions.find(a => a.name === 'Spellcasting');
const NAMES = ['Detect Evil and Good', 'Shapechange', 'Commune', 'Raise Dead'];
const ONE_DAY = ['Commune', 'Raise Dead'];
const AT_WILL = ['Detect Evil and Good', 'Shapechange'];
const SPELLS = Object.fromEntries(NAMES.map(n => [n, spells5e.find(s => s.name === n)]));

const PRE_FIX_DESCRIPTION = 'The deva casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 17):\n<strong>At Will:</strong> Detect Evil and Good, Shapechange (Beast or Humanoid form only, no Temporary Hit Points gained from the spell, and no <strong>Concentration</strong> or <strong>Temporary Hit Points</strong> required to maintain the spell)\n<strong>1/Day Each:</strong> Commune, Raise Dead';
const stripTags = (d) => d.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '');

const MONSTER_NAME = 'Deva 1';

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
const rollSavingThrow = (await import('../../hooks/combat/useLoggedDiceRoll.js'))._rollSavingThrow;

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

function renderDeva() {
  const m = makeMonster({ name: 'Deva', actions: [devaRow] });
  const creatures = [
    { name: MONSTER_NAME, type: 'npc', monsterType: 'celestial', targetName: 'Bandit', ac: 24, currentHp: 229, maxHp: 229, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: MONSTER_NAME, creatures })} />);
}

// ── Data lock: deva Spellcasting row ─────────────────────────────────────────

describe('MA-0599 monsters.json data lock: Deva Spellcasting row', () => {
  it('extracts the four real spell names — zero fake names', () => {
    const names = extractSpellNamesFromSpellcasting(devaRow.description);
    expect(names).toEqual(NAMES);
    expect(names).not.toContain('Concentration');
    expect(names).not.toContain('Temporary Hit Points');
    expect(names).not.toContain('At Will');
    expect(names).not.toContain('1/Day Each');
  });

  it('binds 1/Day Each to Commune + Raise Dead; the two At Will names ungated', () => {
    const uses = extractSpellcastingSpellUses(devaRow.description);
    expect(uses).toEqual(Object.fromEntries(ONE_DAY.map(n => [n, 1])));
    AT_WILL.forEach(n => expect(uses[n]).toBeUndefined());
  });

  it('decoy mid-prose emphasis is GONE — no <strong>Concentration</strong>/<strong>Temporary Hit Points</strong>', () => {
    expect(devaRow.description).not.toMatch(/<strong>Concentration<\/strong>/);
    expect(devaRow.description).not.toMatch(/<strong>Temporary Hit Points<\/strong>/);
    expect(devaRow.description).toMatch(/no Concentration or Temporary Hit Points required to maintain the spell/);
  });

  it('spell_save_dc 17 + spellcasting_ability Charisma authored; DC 17 = 8 + CHA +5 + PB +4', () => {
    expect(devaRow.spell_save_dc).toBe(17);
    expect(devaRow.spellcasting_ability).toBe('Charisma');
    expect(deva.ability_score_modifiers.cha).toBe(5);
    expect(deva.proficiency_bonus).toBe(4);
    expect(8 + deva.ability_score_modifiers.cha + deva.proficiency_bonus).toBe(17);
  });

  it('markup-only diff proof: stripped text equals the pre-fix description byte-for-byte', () => {
    expect(stripTags(devaRow.description)).toBe(stripTags(PRE_FIX_DESCRIPTION));
  });

  it('all four spells exist in 5e spells.json; all DC-less utility spells', () => {
    NAMES.forEach(n => expect(spells5e.some(s => s.name === n)).toBe(true));
    expect(SPELLS['Detect Evil and Good'].level).toBe(1);
    expect(SPELLS.Shapechange.level).toBe(9);
    expect(SPELLS.Commune.level).toBe(5);
    expect(SPELLS['Raise Dead'].level).toBe(5);
    NAMES.forEach(n => expect(SPELLS[n].dc ?? null).toBeNull());
  });
});

// ── Modal: four chips, counters, gates ───────────────────────────────────────

describe('MA-0599 MonsterCardModal Deva Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders four spell chips — the two fake chips are gone', () => {
    renderDeva();
    expect(spellLinks().map(el => el.textContent.split('(')[0].trim())).toEqual(NAMES);
    const heads = spellLinks().map(el => el.textContent.split('(')[0].trim());
    expect(heads).not.toContain('Concentration');
    expect(heads).not.toContain('Temporary Hit Points');
  });

  it('the two 1/Day names carry counters; the two At Will names do not', () => {
    renderDeva();
    ONE_DAY.forEach(n => expect(linkByText(n).textContent).toMatch(/\(1\/Day · 1 left\)/));
    AT_WILL.forEach(n => expect(linkByText(n).textContent).not.toMatch(/\/Day/));
  });

  it('At Will Detect Evil and Good casts ungated twice — zero uses, advisory cast log', async () => {
    renderDeva();
    await act(async () => { fireEvent.click(linkByText('Detect Evil and Good')); });
    await waitFor(() => expect(abilityUseEntries('Detect Evil and Good').length).toBe(1));
    expect(abilityUseEntries('Detect Evil and Good')[0].description).toMatch(/casts Detect Evil and Good via Spellcasting/);
    expect(abilityUseEntries('Detect Evil and Good')[0].description).toMatch(/Concentration/);
    await act(async () => { fireEvent.click(linkByText('Detect Evil and Good')); });
    await waitFor(() => expect(abilityUseEntries('Detect Evil and Good').length).toBe(2));
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
  });

  it('Commune 1/Day: cast spends the single use, second refused — zero extra spend', async () => {
    renderDeva();
    await act(async () => { fireEvent.click(linkByText('Commune')); });
    await waitFor(() => expect(abilityUseEntries('Commune').length).toBe(1));
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Commune': 1 });
    expect(abilityUseEntries('Commune')[0].description).toMatch(/1\/Day use spent/);

    await act(async () => { fireEvent.click(linkByText('Commune')); });
    await waitFor(() => expect(refusals('Commune').length).toBe(1));
    expect(abilityUseEntries('Commune').length).toBe(1);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Commune': 1 });
  });

  it('zero save prompts fired — all four spells are DC-less utility casts', async () => {
    renderDeva();
    await act(async () => { fireEvent.click(linkByText('Detect Evil and Good')); });
    await waitFor(() => expect(abilityUseEntries('Detect Evil and Good').length).toBe(1));
    expect(rollSavingThrow).not.toHaveBeenCalled();
  });
});
