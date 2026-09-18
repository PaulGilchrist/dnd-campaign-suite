// MA-0328 regression: Azer Pyromancer Spellcasting save-leg DC 15 enforcement.
// The row authored only name+description ("spell save DC 15" prose) with no
// numeric save_dc/save_type, so the save-leg died at "DC Unknown — no success
// or failure" with saveResult:null and lv3 8d6 Fire abandoned while the 1/Day
// use was still spent. Fix = DATA save_dc 15 + save_type "Wisdom"
// (8 + WIS +4 + PB +3 = 15, CR 6), mirroring the MA-0237 Ancient Red /
// MA-0318 Archpriest siblings. Fireball must route an adjudicated save:
// app spells.json lv3 = 8d6 Fire, dc_success half, DC 15 from the row.
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';

const SPELLS_5E = [
  { name: 'Fireball', level: 3, concentration: false, duration: 'Instantaneous', range: '150 feet', damage: { damage_type: 'Fire', damage_at_slot_level: { 3: '8d6', 4: '9d6', 5: '10d6', 6: '11d6', 7: '12d6', 8: '13d6', 9: '14d6' } }, dc: { dc_type: 'DEX', dc_success: 'half' }, area_of_effect: { type: 'sphere', size: '20-foot' } },
  { name: 'Elementalism', level: 0, concentration: false, duration: 'Instantaneous', range: '30 feet', damage: null, dc: null },
  { name: 'Mage Hand', level: 0, concentration: false, duration: '1 minute', range: '30 feet', damage: null, dc: null },
];

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 30, rolls: [4, 4, 4, 4, 4, 4, 3, 3], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 60, rolls: [4, 4, 4, 4, 4, 4, 3, 3, 4, 4, 4, 4, 4, 4, 3, 3], modifier: 0 })),
}));

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSpells: vi.fn(() => Promise.resolve(SPELLS_5E)),
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

// ── Re-import mocked modules ────────────────────────────────────────────────

import { addEntry } from '../../services/ui/logService.js';
import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';

const rollSavingThrow = useLoggedDiceRoll._rollSavingThrow;

function linkByText(text) {
  return Array.from(document.querySelectorAll('.mc-dice-link')).find(el => el.textContent.includes(text)) || null;
}

function monsters() {
  return JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
}

function pyromancerRow() {
  return monsters().find(m => m.index === 'azer-pyromancer').actions.find(a => a.name === 'Spellcasting');
}

function renderPyromancer(row) {
  const m = makeMonster({ name: 'Azer Pyromancer', actions: [row] });
  const creatures = [
    { name: 'Azer Pyromancer 1', type: 'npc', monsterType: 'elemental', targetName: 'AberrantSorcerer', currentHp: 97, maxHp: 97, conditions: [] },
    { name: 'AberrantSorcerer', type: 'player', currentHp: 78, maxHp: 78, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: 'Azer Pyromancer 1', creatures })} />);
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('MA-0328 Azer Pyromancer Spellcasting row — authored DC 15 data lock', () => {
  it('row authors numeric save_dc 15 + save_type Wisdom (8 + WIS +4 + PB +3)', () => {
    const pyro = monsters().find(m => m.index === 'azer-pyromancer');
    const row = pyro.actions.find(a => a.name === 'Spellcasting');
    expect(row.save_dc).toBe(15);
    expect(row.save_type).toBe('Wisdom');
    expect(8 + pyro.ability_score_modifiers.wis + pyro.proficiency_bonus).toBe(15);
    expect(row.description).toMatch(/spell save DC 15/);
  });

  it('description byte-unchanged and matches the authored ground-truth prose', () => {
    const row = pyromancerRow();
    expect(row.description).toBe('The azer casts one of the following spells, requiring no Material components and using Wisdom as the spellcasting ability (spell save DC 15):<br><strong>At Will:</strong> <em>Elementalism</em>, <em>Mage Hand</em><br><strong>1/Day:</strong> <em>Fireball</em>');
  });

  it('mirrors the MA-0237/MA-0318 Spellcasting sibling field shape (save_dc + save_type)', () => {
    const archmage = monsters().find(m => m.index === 'archmage').actions.find(a => a.name === 'Spellcasting');
    const archpriest = monsters().find(m => m.index === 'archpriest').actions.find(a => a.name === 'Spellcasting');
    const pyro = pyromancerRow();
    expect(Object.keys(archmage)).toEqual(expect.arrayContaining(['save_dc', 'save_type']));
    expect(Object.keys(archpriest)).toEqual(expect.arrayContaining(['save_dc', 'save_type']));
    expect(Object.keys(pyro).filter(k => ['save_dc', 'save_type'].includes(k))).toEqual(['save_dc', 'save_type']);
    expect(pyro.save_dc).toBe(15);
    expect(pyro.save_type).toBe(archpriest.save_type);
  });
});

describe('MA-0328 Azer Pyromancer Fireball save-leg adjudication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('clicking Fireball routes an adjudicated DEX save at DC 15 with lv3 formula 8d6 half-on-success (no more DC Unknown)', async () => {
    renderPyromancer(pyromancerRow());
    const fireball = linkByText('Fireball');
    expect(fireball).toBeTruthy();
    await act(async () => { fireEvent.click(fireball); });

    await waitFor(() => expect(rollSavingThrow).toHaveBeenCalled());
    const context = rollSavingThrow.mock.calls[0][2];
    expect(context.spellName).toBe('Fireball');
    expect(context.saveDc).toBe(15);
    expect(context.saveType).toBe('DEX');
    expect(context.dcSuccess).toBe('half');
    expect(context.autoDamageFormula).toBe('8d6');
    expect(context.autoDamageDamageType).toBe('Fire');
    expect(context.isSpellDamage).toBe(true);
    expect(context.targetName).toBe('AberrantSorcerer');
  });

  it('spends the Fireball 1/Day use and refuses a second same-day cast', async () => {
    renderPyromancer(pyromancerRow());
    const fireball = linkByText('Fireball');

    await act(async () => { fireEvent.click(fireball); });
    await waitFor(() => expect(rollSavingThrow).toHaveBeenCalledTimes(1));
    expect(runtime.store['Azer Pyromancer 1.monsterSpellUses']).toEqual({ Fireball: 1 });

    await act(async () => { fireEvent.click(fireball); });
    expect(rollSavingThrow).toHaveBeenCalledTimes(1);
    const refusal = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'automation blocked');
    expect(refusal).toBeTruthy();
    expect(refusal.description).toMatch(/already cast Fireball today \(1\/Day\)/);
  });
});
