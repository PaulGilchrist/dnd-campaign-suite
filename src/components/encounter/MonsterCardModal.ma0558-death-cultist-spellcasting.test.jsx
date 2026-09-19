// MA-0558 data lock: Death Cultist Spellcasting rode the MA-0524/0532
// markup-gap twin template. Pre-fix ONLY the tier header carried <strong>;
// Speak with Dead/Thaumaturgy were plain text — extractSpellNamesFromSpellcasting
// returned [] → SpellCastLinks null → zero chips, and the orphaned
// spell_save_dc 14 never reached the advisory cast log (row-level save_dc
// absent; MA-0532 Spellcasting-row fork). DATA fix: <em> on each spell name
// + trailing numeric save_dc 14 + save_type Wisdom; headers byte-kept,
// strip-tags byte-equality proves markup-only diff. Both spells are
// damageless/utility (no dc, no damage, no area_of_effect) → advisory
// CLA-325 casts printing the row DC 14, Wisdom; At Will ungated.
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { extractSpellNamesFromSpellcasting, extractSpellcastingSpellUses } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const spells5e = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));

const dc = monsters.find(m => m.index === 'death-cultist');
const dcRow = dc.actions.find(a => a.name === 'Spellcasting');
const SPEAK_WITH_DEAD = spells5e.find(s => s.name === 'Speak with Dead');
const THAUMATURGY = spells5e.find(s => s.name === 'Thaumaturgy');

const REAL_SPELLS = ['Speak with Dead', 'Thaumaturgy'];

const DC_PLAIN_ORIGINAL = 'The cultist casts one of the following spells, using Wisdom as the spellcasting ability (spell save DC 14):\nAt Will: Speak with Dead, Thaumaturgy';
const stripTags = (d) => d.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '');

const MONSTER_NAME = 'Death Cultist 1';

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
  loadSpells: vi.fn((version) => Promise.resolve(version === '2024' ? [] : [SPEAK_WITH_DEAD, THAUMATURGY])),
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

function renderCultist(armed = true) {
  const m = makeMonster({ name: 'Death Cultist', actions: [dcRow] });
  const creatures = [
    { name: MONSTER_NAME, type: 'npc', monsterType: 'humanoid', targetName: armed ? 'Bandit' : null, ac: 17, currentHp: 127, maxHp: 127, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: MONSTER_NAME, creatures })} />);
}

// ── Data lock: death-cultist Spellcasting row ────────────────────────────────

describe('MA-0558 monsters.json data lock: Death Cultist Spellcasting row', () => {
  it('extracts both spell names — tier header skipped', () => {
    const names = extractSpellNamesFromSpellcasting(dcRow.description);
    expect(names).toEqual(REAL_SPELLS);
    expect(names).not.toContain('At Will');
  });

  it('At Will ungated — extractSpellcastingSpellUses binds nothing', () => {
    expect(extractSpellcastingSpellUses(dcRow.description)).toEqual({});
  });

  it('save fields: numeric save_dc 14 + save_type Wisdom alongside spell_save_dc', () => {
    expect(dcRow.save_dc).toBe(14);
    expect(dcRow.save_type).toBe('Wisdom');
    expect(dcRow.spell_save_dc).toBe(14);
    expect(dcRow.spellcasting_ability).toBe('Wisdom');
    expect(dcRow.description).toMatch(/spell save DC 14/);
  });

  it('DC 14 = 8 + WIS +3 + PB +3 for the death cultist', () => {
    expect(dc.ability_score_modifiers.wis).toBe(3);
    expect(dc.proficiency_bonus).toBe(3);
    expect(8 + dc.ability_score_modifiers.wis + dc.proficiency_bonus).toBe(14);
  });

  it('markup-only diff proof: stripped text equals the pre-fix description byte-for-byte', () => {
    expect(stripTags(dcRow.description)).toBe(DC_PLAIN_ORIGINAL);
  });

  it('both spells damageless/utility — advisory route, no dc/damage/area on the spell entries', () => {
    expect(SPEAK_WITH_DEAD.damage ?? null).toBeNull();
    expect(SPEAK_WITH_DEAD.dc ?? null).toBeNull();
    expect(SPEAK_WITH_DEAD.area_of_effect ?? null).toBeNull();
    expect(THAUMATURGY.damage ?? null).toBeNull();
    expect(THAUMATURGY.dc ?? null).toBeNull();
    expect(THAUMATURGY.area_of_effect ?? null).toBeNull();
  });
});

// ── Modal: two chips, ungated, advisory casts print row DC 14 ────────────────

describe('MA-0558 MonsterCardModal Death Cultist Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders two spell chips — the zero-chip inert row is gone', () => {
    renderCultist();
    const names = spellLinks().map(el => el.textContent.split('(')[0].trim());
    expect(names).toEqual(REAL_SPELLS);
  });

  it('neither At Will name carries a /Day counter', () => {
    renderCultist();
    expect(linkByText('Speak with Dead').textContent).not.toMatch(/\/Day/);
    expect(linkByText('Thaumaturgy').textContent).not.toMatch(/\/Day/);
  });

  it('casts Thaumaturgy — ungated advisory cast logs row DC 14 + Wisdom, no uses spent', async () => {
    renderCultist();
    await act(async () => { fireEvent.click(linkByText('Thaumaturgy')); });

    await waitFor(() => expect(abilityUseEntries('Thaumaturgy').length).toBe(1));
    const entry = abilityUseEntries('Thaumaturgy')[0];
    expect(entry.characterName).toBe(MONSTER_NAME);
    expect(entry.description).toMatch(/casts Thaumaturgy via Spellcasting \(spell save DC 14, Wisdom\)/);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
  });

  it('casts Speak with Dead — ungated, repeat casts never gate or spend', async () => {
    renderCultist();
    await act(async () => { fireEvent.click(linkByText('Speak with Dead')); });
    await waitFor(() => expect(abilityUseEntries('Speak with Dead').length).toBe(1));
    await act(async () => { fireEvent.click(linkByText('Speak with Dead')); });
    await waitFor(() => expect(abilityUseEntries('Speak with Dead').length).toBe(2));
    expect(abilityUseEntries('Speak with Dead')[1].description).toMatch(/\(spell save DC 14, Wisdom\)/);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
  });
});
