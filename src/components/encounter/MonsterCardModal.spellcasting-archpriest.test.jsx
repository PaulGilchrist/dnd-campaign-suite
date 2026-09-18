// MA-0318 regression: Archpriest Spellcasting save-leg DC 17 enforcement.
// The row authored only name+description ("spell save DC 17" prose) with no
// numeric save_dc/save_type, so the save-leg died at "DC Unknown — no success
// or failure" with saveResult:null and lv6 damage abandoned. Fix = DATA
// save_dc 17 + save_type "Wisdom" (8 + WIS +5 + PB +4 = 17, CR 12),
// mirroring the MA-0237 Ancient Red / MA-0313 Archmage siblings. Flame
// Strike (level 6 version) must route an adjudicated save: app spells.json
// lv6 = "4d6 plus 5d6" Fire, dc_success half, DC 17 from the row.
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';

const SPELLS_5E = [
  { name: 'Flame Strike', level: 5, concentration: false, duration: 'Instantaneous', range: '60 feet', damage: { damage_type: 'Fire', damage_at_slot_level: { 5: '4d6 plus 4d6', 6: '4d6 plus 5d6', 7: '4d6 plus 6d6', 8: '4d6 plus 7d6', 9: '4d6 plus 8d6' } }, dc: { dc_type: 'DEX', dc_success: 'half' }, area_of_effect: { type: 'cylinder', size: 40 } },
  { name: 'Zone of Truth', level: 2, concentration: false, duration: 'Up to 10 minutes', range: '60 feet', damage: null, dc: null },
  { name: 'Light', level: 0, concentration: false, duration: '1 hour', range: 'Touch', damage: null, dc: null },
  { name: 'Thaumaturgy', level: 0, concentration: false, duration: '1 minute', range: '60 feet', damage: null, dc: null },
];

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 25, rolls: [4, 4, 4, 4, 5, 4], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 50, rolls: [4, 4, 4, 4, 5, 4, 4, 4, 4, 4, 5, 4], modifier: 0 })),
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

function archpriestRow() {
  return monsters().find(m => m.index === 'archpriest').actions.find(a => a.name === 'Spellcasting');
}

function renderArchpriest(row) {
  const m = makeMonster({ name: 'Archpriest', actions: [row] });
  const creatures = [
    { name: 'Archpriest 1', type: 'npc', monsterType: 'celestial', targetName: 'AberrantSorcerer', currentHp: 240, maxHp: 240, conditions: [] },
    { name: 'AberrantSorcerer', type: 'player', currentHp: 100, maxHp: 100, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: 'Archpriest 1', creatures })} />);
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('MA-0318 Archpriest Spellcasting row — authored DC 17 data lock', () => {
  it('row authors numeric save_dc 17 + save_type Wisdom (8 + WIS +5 + PB +4)', () => {
    const priest = monsters().find(m => m.index === 'archpriest');
    const row = priest.actions.find(a => a.name === 'Spellcasting');
    expect(row.save_dc).toBe(17);
    expect(row.save_type).toBe('Wisdom');
    expect(8 + priest.ability_score_modifiers.wis + priest.proficiency_bonus).toBe(17);
    expect(row.description).toMatch(/spell save DC 17/);
  });

  it('description byte-unchanged and matches the authored ground-truth prose', () => {
    const row = archpriestRow();
    expect(row.description).toBe('The archpriest casts one of the following spells, requiring no Material components and using Wisdom as the spellcasting ability (spell save DC 17):<br><strong>At Will:</strong> <em>Light</em>, <em>Thaumaturgy</em><br><strong>1/Day Each:</strong> <em>Flame Strike</em> (level 6 version), <em>Greater Restoration</em>, <em>Raise Dead</em>, <em>Zone of Truth</em>');
  });

  it('mirrors the MA-0237/MA-0313 Spellcasting sibling field shape (save_dc + save_type)', () => {
    const archmage = monsters().find(m => m.index === 'archmage').actions.find(a => a.name === 'Spellcasting');
    const red = monsters().find(m => m.index === 'ancient-red-dragon').actions.find(a => a.name === 'Spellcasting');
    const priest = archpriestRow();
    expect(Object.keys(archmage)).toEqual(expect.arrayContaining(['save_dc', 'save_type']));
    expect(Object.keys(red)).toEqual(expect.arrayContaining(['save_dc', 'save_type']));
    expect(Object.keys(priest).filter(k => ['save_dc', 'save_type'].includes(k))).toEqual(['save_dc', 'save_type']);
    expect(priest.save_dc).toBe(archmage.save_dc);
  });
});

describe('MA-0318 Archpriest Flame Strike save-leg adjudication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('clicking Flame Strike routes an adjudicated DEX save at DC 17 with lv6 formula half-on-success (no more DC Unknown)', async () => {
    renderArchpriest(archpriestRow());
    const flameStrike = linkByText('Flame Strike');
    expect(flameStrike).toBeTruthy();
    await act(async () => { fireEvent.click(flameStrike); });

    await waitFor(() => expect(rollSavingThrow).toHaveBeenCalled());
    const context = rollSavingThrow.mock.calls[0][2];
    expect(context.spellName).toBe('Flame Strike');
    expect(context.saveDc).toBe(17);
    expect(context.saveType).toBe('DEX');
    expect(context.dcSuccess).toBe('half');
    expect(context.autoDamageFormula).toBe('4d6 plus 5d6');
    expect(context.isSpellDamage).toBe(true);
    expect(context.targetName).toBe('AberrantSorcerer');
  });

  it('spends the Flame Strike 1/Day use and refuses a second same-day cast', async () => {
    renderArchpriest(archpriestRow());
    const flameStrike = linkByText('Flame Strike');

    await act(async () => { fireEvent.click(flameStrike); });
    await waitFor(() => expect(rollSavingThrow).toHaveBeenCalledTimes(1));
    expect(runtime.store['Archpriest 1.monsterSpellUses']).toEqual({ 'Flame Strike': 1 });

    await act(async () => { fireEvent.click(flameStrike); });
    expect(rollSavingThrow).toHaveBeenCalledTimes(1);
    const refusal = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'automation blocked');
    expect(refusal).toBeTruthy();
    expect(refusal.description).toMatch(/already cast Flame Strike today \(1\/Day\)/);
  });
});
