// @maintained-by-ai 2026-11-28
// MA-1150 regression: Merfolk Wavebender Spellcasting.
// Defect 1 — the advisory cast log stamped the spell-side 5e dc_type ("DEX")
// over the row's authored save_type ("Wisdom"). Fix lane: DATA (5e spells.json
// Light dc → null, matching the 2024 twin; RAW's DEX save never fires on a
// monster's advisory cast). A code reorder was structurally foreclosed by
// live-verified rows pinning spell-side dc on dc_success:'none' advisory
// records (MA-0012 intent: the ROW's authored save_dc/save_type print only
// when the spell has no structured dc).
// Defect 2 — a damage-bearing spell cast spent its 1/Day use BEFORE the
// MA-0049 no-target guard, so an unarmed Control Water press burned the use
// while the refusal popup/log claimed zero spend. Fix lane: CODE
// check-before-spend guard (refuseUnarmedMonsterSaveCast), mirroring the
// MA-0033 attack-lane precedent; refusals now spend NOTHING.
// Cite-skip owners (NOT repeated here): spell-side dc_type precedence on the
// advisory log → MonsterCardModal.spellcasting-barlgura.test.jsx (Entangle STR
// beats the row's authored Wisdom); Elementalism 2024-only advisory lookup +
// 1/Day spend wording + exhausted-refire refusal →
// MonsterCardModal.spellcasting.test.jsx; MA-0049 refusal popup/log byte
// shape → MonsterCardHelpers.usage.test.js; spell dc_type/dc_success routing
// at a row-authored save_dc → MonsterCardModal.spellcasting.test.jsx MA-0054.
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import { extractSpellNamesFromSpellcasting, extractSpellcastingSpellUses } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const SPELLS_5E = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));
const SPELLS_2024 = JSON.parse(readFileSync('public/data/2024/spells.json', 'utf8'));

const WAVEBENDER = monsters.find(m => m.index === 'merfolk-wavebender');
const WAVEBENDER_ROW = WAVEBENDER.actions.find(a => a.name === 'Spellcasting');
const MONSTER_NAME = 'Merfolk Wavebender 1';

// ── Mocks (only the lanes this file asserts; dead mocks purged by bisect) ─

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSpells: vi.fn((version) => Promise.resolve(version === '2024' ? SPELLS_2024 : SPELLS_5E)),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _rollSavingThrow = vi.fn();

  const mockHook = vi.fn(() => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: vi.fn((val) => { _popupHtml = val; }),
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    rollSavingThrow: _rollSavingThrow,
  }));

  return {
    default: mockHook,
    get _popupHtml() { return _popupHtml; },
    _resetPopupHtml: () => { _popupHtml = null; },
    _rollSavingThrow,
  };
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
import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';

const rollSavingThrow = useLoggedDiceRoll._rollSavingThrow;

function linkByText(text) {
  return Array.from(document.querySelectorAll('.mc-dice-link')).find(el => el.textContent.includes(text)) || null;
}

function entriesOf(abilityName) {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e.abilityName === abilityName);
}

function renderWavebender({ armed } = {}) {
  const m = makeMonster({ name: MONSTER_NAME, ability_score_modifiers: { ...WAVEBENDER.ability_score_modifiers }, actions: [WAVEBENDER_ROW] });
  const attacker = { name: MONSTER_NAME, type: 'npc', monsterType: 'elemental', targetName: armed ? 'TestPC' : null, currentHp: 97, maxHp: 97, conditions: [] };
  const creatures = [attacker, { name: 'TestPC', type: 'player', currentHp: 60, maxHp: 60, conditions: [], computedStats: {} }];
  render(<MonsterCardModal {...makeProps(m, { creatureName: MONSTER_NAME, creatures })} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  useLoggedDiceRoll._resetPopupHtml();
});

// ── Disk data locks (defect 1 fix + row truth) ─────────────────────────────

describe('MA-1150 disk data locks', () => {
  it('Light carries no never-firing save dc in either ruleset; wavebender row is byte-locked with exact chip/1-Day extraction and the save_dc 15 + Wisdom pair the log prints', () => {
    expect(SPELLS_5E.find(s => s.name === 'Light').dc ?? null).toBeNull();
    expect(SPELLS_2024.find(s => s.name === 'Light').dc ?? null).toBeNull();

    expect(WAVEBENDER_ROW).toEqual({
      name: 'Spellcasting',
      description: 'The merfolk casts one of the following spells, requiring no Material components and using Wisdom as the spellcasting ability (spell save DC 15):<br><strong>At Will:</strong> <strong>Elementalism</strong>, <strong>Light</strong><br><strong>1/Day Each:</strong> <strong>Control Water</strong>, <strong>Create or Destroy Water</strong>',
      attack_bonus: 0,
      save_dc: 15,
      save_type: 'Wisdom',
      save_effect: '',
      range: '',
      reach: '',
      recharge: '',
    });
    expect(extractSpellNamesFromSpellcasting(WAVEBENDER_ROW.description)).toEqual(['Elementalism', 'Light', 'Control Water', 'Create or Destroy Water']);
    expect(extractSpellcastingSpellUses(WAVEBENDER_ROW.description)).toEqual({ 'Control Water': 1, 'Create or Destroy Water': 1 });
  });
});

// ── Defect 1: advisory log stamps the ROW-authored Wisdom for Light ────────

describe('MA-1150 advisory cast log ability stamp (defect 1)', () => {
  it('Light (dc:null) cast via Spellcasting logs "spell save DC 15, Wisdom" — never DEX, no save prompt', async () => {
    renderWavebender();
    await act(async () => { fireEvent.click(linkByText('Light')); });

    await waitFor(() => expect(entriesOf('Light').length).toBe(1));
    const entry = entriesOf('Light')[0];
    expect(entry.type).toBe('ability_use');
    expect(entry.characterName).toBe(MONSTER_NAME);
    expect(entry.description).toMatch(/\(spell save DC 15, Wisdom\)/);
    expect(entry.description).not.toMatch(/DEX/);
    expect(entry.description).toMatch(/Spell effect is recorded; GM-enforced for monsters\./);
    expect(rollSavingThrow).not.toHaveBeenCalled();
  });
});

// ── Defect 2: check-before-spend guard — refusal vs spend pair ─────────────

describe('MA-1150 Control Water no-target guard (defect 2)', () => {
  it('unarmed press routes the MA-0049 refusal and spends NOTHING (no use, no save prompt)', async () => {
    renderWavebender({ armed: false });
    await act(async () => { fireEvent.click(linkByText('Control Water')); });

    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    // routes the guard lane for THIS spell (byte shape of the refusal itself
    // is owned by MonsterCardHelpers.usage.test.js)
    const refusal = entriesOf('Control Water').find(e => e.type === 'automation');
    expect(refusal).toBeTruthy();
    expect(refusal.automationType).toBe('control_water_refused');
    expect(useLoggedDiceRoll._popupHtml).toMatch(/mc-no-target-refusal/);
    // the defect: nothing was paid
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
    expect(entriesOf('Control Water').filter(e => e.type === 'ability_use').length).toBe(0);
    expect(rollSavingThrow).not.toHaveBeenCalled();
  });

  it('armed press passes the guard: spends the 1/Day use and routes a spell save at the row DC 15', async () => {
    renderWavebender({ armed: true });
    await act(async () => { fireEvent.click(linkByText('Control Water')); });

    await waitFor(() => expect(rollSavingThrow).toHaveBeenCalledTimes(1));
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Control Water': 1 });
    expect(entriesOf('Control Water').some(e => e.type === 'automation')).toBe(false);
    // the save rides the right spell at the row's DC and is damage-bearing
    // (dc_type/dc_success spell-side routing owned by MA-0054 in spellcasting.test.jsx)
    const context = rollSavingThrow.mock.calls[0][2];
    expect(context.spellName).toBe('Control Water');
    expect(context.saveDc).toBe(15);
    expect(context.isSpellDamage).toBe(true);
  });
});
