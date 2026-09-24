// MA-1014 modal seam: handleSpellCast forks the spell_save_dc-only utility
// row (Ice Devil "Ice Wall") to resolveUtilitySpellCastRow BEFORE the
// invisibility ender and BEFORE the block-save fork — routing the save seam
// here would spend then resolve "DC Unknown" (§218/§860: spell_save_dc never
// reaches the save DC). No picker/sp-modal/attack roll, no monsterSpellUses
// key (the row authors no N/Day tier). Second press on a spent recharge row
// refuses (ice_wall_refused) with zero extra records.
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const spells5e = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));

const ICE_DEVIL = monsters.find(m => m.index === 'ice-devil');
const ICE_WALL_ROW = ICE_DEVIL.actions[3];
const MONSTER_NAME = 'Ice Devil 1';

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
  loadSpells: vi.fn((version) => Promise.resolve(version === '2024' ? [] : spells5e)),
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
    rollAbilityCheck: vi.fn(),
    rollSavingThrow: _rollSavingThrow,
    rollSkillCheck: vi.fn(),
    rollInitiative: vi.fn(),
    quickRollPlayerSave: vi.fn(),
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

import { addEntry } from '../../services/ui/logService.js';
import { _rollAttack, _rollSavingThrow, _setPopupHtml } from '../../hooks/combat/useLoggedDiceRoll.js';

function chip() {
  return [...document.querySelectorAll('.mc-dice-link-spell')].find(el => el.textContent.includes('Wall of Ice'));
}

function abilityUses(name) {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'ability_use' && e.abilityName === name);
}

function renderDevil() {
  const m = makeMonster({ name: 'Ice Devil', ability_score_modifiers: { ...makeMonster().ability_score_modifiers, int: 7 }, actions: [ICE_WALL_ROW] });
  const creatures = [
    { name: MONSTER_NAME, type: 'npc', monsterType: 'fiend', targetName: 'Bandit', ac: 18, currentHp: 228, maxHp: 228, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: MONSTER_NAME, creatures })} />);
}

describe('MA-1014 modal: Ice Wall chip → recharge-gated advisory cast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('first press spends recharge + logs the RAW advisory cast, no save/attack route', async () => {
    renderDevil();
    await waitFor(() => expect(chip()).toBeTruthy());
    await act(async () => { fireEvent.click(chip()); });
    await waitFor(() => expect(abilityUses('Wall of Ice').length).toBe(1));
    expect(runtime.store[`${MONSTER_NAME}.monsterRecharge`]).toEqual({ 'Ice Wall': { recharged: false, threshold: 6 } });
    const cast = abilityUses('Wall of Ice')[0];
    expect(cast.description).toContain('(spell save DC 17, Intelligence)');
    expect(cast.description).toContain('Level 8 version.');
    expect(cast.description).toContain('No spell components required.');
    expect(cast.description).toMatch(/Wall\/zone objects have no engine consumer \(§70\)/);
    expect(abilityUses('Ice Wall').length).toBe(1);
    expect(_rollSavingThrow).not.toHaveBeenCalled();
    expect(_rollAttack).not.toHaveBeenCalled();
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
  });

  it('spent row: second press refuses (popup + ice_wall_refused), zero extra records', async () => {
    renderDevil();
    await waitFor(() => expect(chip()).toBeTruthy());
    await act(async () => { fireEvent.click(chip()); });
    await waitFor(() => expect(abilityUses('Wall of Ice').length).toBe(1));
    await act(async () => { fireEvent.click(chip()); });
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'ice_wall_refused')).toBe(true));
    expect(abilityUses('Wall of Ice').length).toBe(1);
    expect(abilityUses('Ice Wall').length).toBe(1);
    expect(_setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('mc-recharge-refusal'));
  });

  it('recovered row casts again with a fresh spend', async () => {
    renderDevil();
    await waitFor(() => expect(chip()).toBeTruthy());
    await act(async () => { fireEvent.click(chip()); });
    await waitFor(() => expect(abilityUses('Wall of Ice').length).toBe(1));
    runtime.store[`${MONSTER_NAME}.monsterRecharge`] = { 'Ice Wall': { recharged: true, threshold: 6 } };
    await act(async () => { fireEvent.click(chip()); });
    await waitFor(() => expect(abilityUses('Wall of Ice').length).toBe(2));
    expect(runtime.store[`${MONSTER_NAME}.monsterRecharge`]).toEqual({ 'Ice Wall': { recharged: false, threshold: 6 } });
  });
});
