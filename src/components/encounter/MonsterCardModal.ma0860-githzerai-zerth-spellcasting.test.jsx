// @maintained-by-ai
// MA-0860 data lock: Githzerai Zerth Spellcasting row (actions[2]) carried
// cosmetic spell_save_dc 14 + spellcasting_ability "Wisdom" and the DC only in
// prose — buildAbilitySaveRollContext (MonsterCardModal.jsx:1329, saveDc =
// action.save_dc, no spell_save_dc fallback §54/§215) starved the PK save leg to
// "DC Unknown" AFTER the MA-0276 spend-before-route burned the 1/Day charge
// (§266 codification). DATA fix authors the trailing save_dc: 14 +
// save_type: "Wisdom" pair byte-shape of the MA-0237/0318/0328/0362 family
// (MA-0459 cambion / MA-0558 dao placement). Seam already armed: castLevel 6
// "(level 6 version)" → spellDamageFormulaAtLevel 6d10 (MA-0087), frightened via
// MA-0362 spellDamageLegFailCondition, dc_success 'none' MA-0003.
// Trimmed #647: spell-shape nulls owned by ma1959-orcus, chip/counter render
// class by spellcasting.test.jsx:185/:276, spend+refusal class by :282/:508,
// at-Will advisory class by ma0524:222 — here: BY-name gate map, distinct
// save_dc/save_type bytes, and the merged PK cast e2e through the fixed seam.
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import { extractSpellcastingSpellUses } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const allSpells = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));
const realSpells = (names) => allSpells.filter(s => names.includes(s.name));

const ZERTH_SPELLS = ['Mage Hand', 'Phantasmal Killer', 'Plane Shift', 'See Invisibility'];

const zerth = monsters.find(m => m.index === 'githzerai-zerth');
const zerthRow = zerth.actions[2];

// ── Mocks (mirror MonsterCardModal.ma0459-cambion-spellcasting.test.jsx) ──

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSpells: vi.fn((version) => Promise.resolve(version === '2024' ? [] : realSpells(ZERTH_SPELLS))),
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
import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';

const rollSavingThrow = useLoggedDiceRoll._rollSavingThrow;

function linkByText(text) {
  return Array.from(document.querySelectorAll('.mc-dice-link-spell')).find(el => el.textContent.trim().startsWith(text)) || null;
}

function abilityUseEntries(name) {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'ability_use' && e.abilityName === name);
}

function refusals() {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'automation blocked');
}

function renderZerth() {
  const m = makeMonster({ name: zerth.name, actions: [zerthRow] });
  const creatures = [
    { name: 'Githzerai Zerth 1', type: 'npc', monsterType: 'aberration', targetName: 'TestPC', currentHp: zerth.hit_points, maxHp: zerth.hit_points, conditions: [] },
    { name: 'TestPC', type: 'player', currentHp: 60, maxHp: 60, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: 'Githzerai Zerth 1', creatures })} />);
}

describe('MA-0860 monsters.json data lock: Githzerai Zerth Spellcasting row', () => {
  it('actions[2] Spellcasting authors the trailing save_dc 14 + save_type Wisdom pair — the seam buildAbilitySaveRollContext:1329 reads', () => {
    expect(zerthRow.name).toBe('Spellcasting');
    expect(zerthRow.save_dc).toBe(14);
    expect(zerthRow.save_type).toBe('Wisdom');
    expect(zerthRow.spell_save_dc).toBe(14);
    expect(zerthRow.spellcasting_ability).toBe('Wisdom');
  });

  it('extractSpellcastingSpellUses binds the 1/Day gates to MARKED names; At-Will stays ungated', () => {
    expect(extractSpellcastingSpellUses(zerthRow.description)).toEqual({
      'Phantasmal Killer': 1, 'Plane Shift': 1, 'See Invisibility': 1,
    });
  });
});

describe('MA-0860 MonsterCardModal Zerth Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('PK chip renders with its 1/Day counter, routes a DC 14 WIS save leg with 6d10 Psychic + frightened + dc_success none, spends 1/Day, refuses the re-cast', async () => {
    renderZerth();
    expect(linkByText('Mage Hand')).toBeTruthy();
    expect(linkByText('See Invisibility')).toBeTruthy();
    const pk = linkByText('Phantasmal Killer');
    expect(pk.textContent).toMatch(/\(1\/Day · 1 left\)/);

    await act(async () => { fireEvent.click(pk); });

    await waitFor(() => expect(rollSavingThrow).toHaveBeenCalled());
    expect(rollSavingThrow.mock.calls[0][0]).toBe('WIS');
    const context = rollSavingThrow.mock.calls[0][2];
    expect(context.spellName).toBe('Phantasmal Killer');
    expect(context.saveDc).toBe(14);
    expect(context.saveType).toBe('WIS');
    expect(context.autoDamageFormula).toBe('6d10');
    expect(context.autoDamageDamageType).toMatch(/Psychic/);
    expect(context.saveConditions).toEqual(['frightened']);
    expect(context.dcSuccess).toBe('none');
    expect(context.isSpellDamage).toBe(true);

    await waitFor(() => expect(abilityUseEntries('Phantasmal Killer').length).toBe(1));
    expect(runtime.store['Githzerai Zerth 1.monsterSpellUses']).toEqual({ 'Phantasmal Killer': 1 });
    expect(abilityUseEntries('Phantasmal Killer')[0].description).toMatch(/1\/Day use spent — 0 remaining today/);

    await act(async () => { fireEvent.click(linkByText('Phantasmal Killer')); });
    expect(rollSavingThrow).toHaveBeenCalledTimes(1);
    const refusal = refusals().find(e => e.abilityName === 'Phantasmal Killer');
    expect(refusal).toBeTruthy();
    expect(refusal.description).toMatch(/already cast Phantasmal Killer today \(1\/Day\)/);
    expect(runtime.store['Githzerai Zerth 1.monsterSpellUses']).toEqual({ 'Phantasmal Killer': 1 });
  });
});
