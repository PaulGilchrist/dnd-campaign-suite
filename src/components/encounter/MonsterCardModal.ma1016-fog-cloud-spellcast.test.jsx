// @maintained-by-ai 2026-11-28
// MA-1016 modal seam: handleSpellCast forks the innate utility row
// (Ice Mephit "Fog Cloud", real monsters.json bytes: spellcasting_ability
// + numeric uses:1/maxUses:1 MA-0633 shape, usage "1/Day" on the FIELD —
// so the modal's own description-parsing spellUsesGate is a deliberate
// passthrough) to resolveUtilitySpellCastRow BEFORE the invisibility ender
// and BEFORE the block-save fork — routing the save seam here would spend
// then resolve "DC Unknown" (§218/§860; spell_save_dc never reaches the
// save DC). Fork/economy identity: press 1 spends the 1/Day via
// spendMonsterAbilityUse (monsterSpellUses {'Fog Cloud':1}, no
// monsterRecharge key — that economy is MA-1014 ice wall's) + advisory cast
// "(Charisma)" with the BY-name fog §70 byte (#387 — service
// monsterUtilitySpellCast.ma1016 pins the same advisory at service level;
// this lane pins the chip→modal wiring through the real row). Press 2
// refuses via the SERVICE numeric gate through the modal runtime store:
// mc-prerequisite-refusal popup + fog_cloud_refused log, zero extra records
// (§57) — distinct emitter from spellcasting.test.jsx's buildMonsterSpell-
// RefusalEntry "already cast today" lane. The press-2 + GM-cleared-uses
// re-arm share one lifecycle test: service fog test has no recovered-row
// test (§70 rest-rearm stays GM-enforced), and the re-armed press must NOT
// emit a second refusal. Generic advisory record: service owner
// monsterUtilitySpellCast.js; usage parse: monsterAbilityUses.test.js; chip
// spent state: MonsterAction.ma1016-fog-cloud-chip.test.jsx (mocked
// useRuntimeValue does not re-render, §179). Dead-mock purge per #677
// utility-lane map — diceRoller/sanitize/mapsService/abilityLookup/
// conditionEffects/damageUtils/rangeValidation empirically inert on this
// path.
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const spells5e = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));

// Disk-faithful: the utility row is actions[1] on the real ice-mephit bytes.
const FOG_ROW = monsters.find(m => m.index === 'ice-mephit').actions[1];
const MONSTER_NAME = 'Ice Mephit 1';

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
  return [...document.querySelectorAll('.mc-dice-link-spell')].find(el => el.textContent.includes('Fog Cloud'));
}

function abilityUses(name) {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'ability_use' && e.abilityName === name);
}

function refusals() {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e.automationType === 'fog_cloud_refused');
}

async function pressChip() {
  await act(async () => { fireEvent.click(chip()); });
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
    await pressChip();
    await waitFor(() => expect(abilityUses('Fog Cloud').length).toBe(2));
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Fog Cloud': 1 });
    expect(runtime.store[`${MONSTER_NAME}.monsterRecharge`] ?? null).toBeNull();
    const spend = abilityUses('Fog Cloud')[0];
    expect(spend.description).toMatch(/uses Fog Cloud — 1 use spent, 0 left today/);
    const cast = abilityUses('Fog Cloud')[1];
    expect(cast.description).toMatch(/^Ice Mephit 1 casts Fog Cloud via Spellcasting \(Charisma\)\./);
    expect(cast.description).not.toMatch(/spell save DC/);
    expect(cast.description).toMatch(/Fog zones have no engine consumer \(§70\)/);
    expect(_rollSavingThrow).not.toHaveBeenCalled();
    expect(_rollAttack).not.toHaveBeenCalled();
  });

  it('uses-gate lifecycle: exhausted press refuses (popup + fog_cloud_refused, zero extra records); GM-cleared uses re-arm a fresh spend with no second refusal', async () => {
    renderMephit();
    await waitFor(() => expect(chip()).toBeTruthy());
    await pressChip();
    await waitFor(() => expect(abilityUses('Fog Cloud').length).toBe(2));

    // Exhausted: the service numeric gate reads the modal runtime store.
    await pressChip();
    await waitFor(() => expect(refusals().length).toBe(1));
    expect(abilityUses('Fog Cloud').length).toBe(2);
    expect(_setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('mc-prerequisite-refusal'));
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Fog Cloud': 1 });

    // Restored uses (long rest, GM-cleared): the gate reads the store live
    // per press, so the row casts again with a fresh spend.
    runtime.store[`${MONSTER_NAME}.monsterSpellUses`] = {};
    await pressChip();
    await waitFor(() => expect(abilityUses('Fog Cloud').length).toBe(4));
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Fog Cloud': 1 });
    expect(refusals().length).toBe(1);
  });
});
