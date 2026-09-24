// MA-1016 modal seam: handleSpellCast forks the innate utility row
// (Ice Mephit "Fog Cloud") to resolveUtilitySpellCastRow — MA-1014 lane,
// uses-leg added: press 1 spends the MA-00633 numeric 1/Day via
// spendMonsterAbilityUse (monsterSpellUses {'Fog Cloud':1}) and logs the
// advisory cast "(Charisma)" — no spell_save_dc, so no DC is printed and
// the block-save fork stays unreachable (§218/§860 DC-Unknown trap). No
// recharge key (row authors none), no save/attack roll. Press 2 refuses:
// mc-prerequisite-refusal popup + fog_cloud_refused automation log, ZERO
// extra ability_use records (§57). Chip spent state pinned component-side
// (MonsterAction.ma1016 — mocked useRuntimeValue does not re-render, §179).
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const spells5e = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));

const ICE_MEPHIT = monsters.find(m => m.index === 'ice-mephit');
const FOG_ROW = ICE_MEPHIT.actions[1];
const MONSTER_NAME = 'Ice Mephit 1';

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
  return [...document.querySelectorAll('.mc-dice-link-spell')].find(el => el.textContent.includes('Fog Cloud'));
}

function abilityUses(name) {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'ability_use' && e.abilityName === name);
}

function refusals() {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e.automationType === 'fog_cloud_refused');
}

function renderMephit() {
  const m = makeMonster({ name: 'Ice Mephit', ability_score_modifiers: { ...makeMonster().ability_score_modifiers, cha: 1 }, actions: [FOG_ROW] });
  const creatures = [
    { name: MONSTER_NAME, type: 'npc', monsterType: 'elemental', targetName: 'Bandit', ac: 15, currentHp: 21, maxHp: 21, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: MONSTER_NAME, creatures })} />);
}

describe('MA-1016 modal: Fog Cloud chip → 1/Day-gated advisory cast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('first press spends the 1/Day use + logs the RAW advisory cast, no save/attack/recharge route', async () => {
    renderMephit();
    await waitFor(() => expect(chip()).toBeTruthy());
    await act(async () => { fireEvent.click(chip()); });
    await waitFor(() => expect(abilityUses('Fog Cloud').length).toBe(2));
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Fog Cloud': 1 });
    expect(runtime.store[`${MONSTER_NAME}.monsterRecharge`] ?? null).toBeNull();
    const spend = abilityUses('Fog Cloud')[0];
    expect(spend.description).toMatch(/uses Fog Cloud — 1 use spent, 0 left today/);
    const cast = abilityUses('Fog Cloud')[1];
    expect(cast.description).toMatch(/^Ice Mephit 1 casts Fog Cloud via Spellcasting \(Charisma\)\./);
    expect(cast.description).toContain('No spell components required.');
    expect(cast.description).not.toMatch(/spell save DC/);
    expect(cast.description).toMatch(/Fog zones have no engine consumer \(§70\)/);
    expect(_rollSavingThrow).not.toHaveBeenCalled();
    expect(_rollAttack).not.toHaveBeenCalled();
  });

  it('exhausted row: second press refuses (popup + fog_cloud_refused), zero extra records', async () => {
    renderMephit();
    await waitFor(() => expect(chip()).toBeTruthy());
    await act(async () => { fireEvent.click(chip()); });
    await waitFor(() => expect(abilityUses('Fog Cloud').length).toBe(2));
    await act(async () => { fireEvent.click(chip()); });
    await waitFor(() => expect(refusals().length).toBe(1));
    expect(abilityUses('Fog Cloud').length).toBe(2);
    expect(_setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('mc-prerequisite-refusal'));
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Fog Cloud': 1 });
  });

  it('restored uses (long rest, GM-cleared) cast again with a fresh spend', async () => {
    renderMephit();
    await waitFor(() => expect(chip()).toBeTruthy());
    await act(async () => { fireEvent.click(chip()); });
    await waitFor(() => expect(abilityUses('Fog Cloud').length).toBe(2));
    runtime.store[`${MONSTER_NAME}.monsterSpellUses`] = {};
    await act(async () => { fireEvent.click(chip()); });
    await waitFor(() => expect(abilityUses('Fog Cloud').length).toBe(4));
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Fog Cloud': 1 });
    expect(refusals().length).toBe(0);
  });
});
