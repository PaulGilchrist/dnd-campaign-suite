// MA-0614 data lock: Doppelganger "Read Thoughts" carried spell_save_dc 12 +
// spellcasting_ability ONLY — generic save-shell (MonsterAction ActionSaveRoll)
// arms exclusively on numeric row-level save_dc (MonsterAction.jsx:89/194), and
// spell_save_dc never reaches buildAbilitySaveRollContext (MA-0421/§89/§164
// twin fingerprint) → zero .mc-dice-link chips, row fully inert. DATA fix:
// trailing row-level "save_dc": 12 + "save_type": "Intelligence" pair
// (MA-0576/MA-0611 byte-shape; Detect Thoughts save is Intelligence).
import { readFileSync } from 'node:fs';
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));

const doppelganger = monsters.find(m => m.index === 'doppelganger');
const readThoughts = doppelganger.actions.find(a => a.name === 'Read Thoughts');

const MONSTER_NAME = 'Doppelganger 1';

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
  loadSpells: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _rollAttack = vi.fn();
  const _rollDamage = vi.fn();
  const _rollSavingThrow = vi.fn();
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });

  const mockHook = vi.fn(() => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: _setPopupHtml,
    rollAttack: _rollAttack,
    rollDamage: _rollDamage,
    rollSavingThrow: _rollSavingThrow,
  }));

  return { default: mockHook, _rollAttack, _rollDamage, _rollSavingThrow, _setPopupHtml };
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

const rollSavingThrow = useLoggedDiceRoll._rollSavingThrow;

const CREATURES = [
  { name: MONSTER_NAME, type: 'npc', monsterType: 'monstrosity', targetName: 'Bandit 1', ac: 14, currentHp: 52, maxHp: 52, conditions: [] },
  { name: 'Bandit 1', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [] },
];

function renderDoppelganger() {
  const m = makeMonster({ name: 'Doppelganger', type: 'monstrosity', actions: [readThoughts] });
  render(<MonsterCardModal {...makeProps(m, { creatureName: MONSTER_NAME, creatures: CREATURES })} />);
}

function readThoughtsRow() {
  return [...document.querySelectorAll('.mc-action')].find(el => el.querySelector('strong')?.textContent.trim().startsWith('Read Thoughts'));
}

describe('MA-0614 monsters.json data lock: Doppelganger Read Thoughts row', () => {
  it('row-level numeric save_dc 12 + save_type Intelligence pair authored (trailing)', () => {
    expect(readThoughts.save_dc).toBe(12);
    expect(readThoughts.save_type).toBe('Intelligence');
    expect(readThoughts.spell_save_dc).toBe(12);
    expect(readThoughts.spellcasting_ability).toBe('Charisma');
    expect(readThoughts.description).toMatch(/spell save DC 12/);
  });

  it('fix is additive: no damage/save_effect authored — chip adjudicates the save only', () => {
    expect(readThoughts.damage_dice_primary ?? null).toBeNull();
    expect(readThoughts.save_effect ?? null).toBeNull();
  });
});

describe('MA-0614 MonsterCardModal Read Thoughts save-shell chip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders the DC 12 Intelligence save-shell chip — the zero-chip inert row is gone', () => {
    renderDoppelganger();
    const row = readThoughtsRow();
    expect(row).toBeTruthy();
    const chips = [...row.querySelectorAll('.mc-dice-link')];
    expect(chips.length).toBe(1);
    expect(chips[0].textContent.trim()).toBe('DC 12 Intelligence');
    expect(chips[0].className).toMatch('mc-dice-link-save-clickable');
  });

  it('chip click arms the save vs armed target with DC 12 Intelligence through the ActionSaveRoll seam', () => {
    renderDoppelganger();
    fireEvent.click(readThoughtsRow().querySelector('.mc-dice-link-save-clickable'));
    expect(rollSavingThrow).toHaveBeenCalledTimes(1);
    const ctx = rollSavingThrow.mock.calls[0][2];
    expect(ctx.saveDc).toBe(12);
    expect(ctx.saveType).toBe('Intelligence');
  });
});
