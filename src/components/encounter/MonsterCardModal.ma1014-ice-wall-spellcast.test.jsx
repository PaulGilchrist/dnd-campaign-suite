// @maintained-by-ai
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
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const spells5e = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));

const ICE_DEVIL = monsters.find(m => m.index === 'ice-devil');
const ICE_WALL_ROW = ICE_DEVIL.actions[3];
const MONSTER_NAME = 'Ice Devil 1';

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSpells: vi.fn((version) => Promise.resolve(version === '2024' ? [] : spells5e)),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _rollAttack = vi.fn();
  const _rollSavingThrow = vi.fn();
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });
  const mockHook = vi.fn(() => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: _setPopupHtml,
    rollAttack: _rollAttack,
    rollDamage: vi.fn(),
    rollAbilityCheck: vi.fn(),
    rollSavingThrow: _rollSavingThrow,
    rollSkillCheck: vi.fn(),
    rollInitiative: vi.fn(),
    quickRollPlayerSave: vi.fn(),
  }));
  return { default: mockHook, _rollAttack, _rollSavingThrow, _setPopupHtml };
});

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
    // modal-side castLevel parse (spellCastLevelFromSpellcasting on the row text)
    expect(cast.description).toContain('Level 8 version.');
    // BY-family distinct byte: wall variant (service pins generic §70; ma1016 pins fog)
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
});
