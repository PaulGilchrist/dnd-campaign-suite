// MA-1150 regression: Merfolk Wavebender Spellcasting.
// Defect 1 — the advisory cast log stamped the spell-side 5e dc_type ("DEX")
// over the row's authored save_type ("Wisdom"). Root cause was spurious DATA:
// 5e spells.json Light carried dc:{dc_type:'DEX',dc_success:'none'} — a save
// that never fires for a monster's advisory cast (RAW's DEX save covers only
// an object held/worn by a hostile creature; the 2024 twin carries dc:null).
// Fix lane: DATA (Light dc → null, matching 2024) — a :1229 code reorder was
// structurally foreclosed because live-verified rows (MA-0003 Barlgura
// Entangle STR, MA-0459 Cambion Command WIS, MA-0524 Couatl Sleep WIS,
// MA-0532/MA-0536 Command/Mass Suggestion WIS) pin the spell-side dc on
// dc_success:'none' advisory records (MA-0012 intent: the ROW's authored
// save_dc/save_type print ONLY when the spell has no structured dc).
// Defect 2 — a damage-bearing spell cast spends its 1/Day use in
// handleSpellCast BEFORE executeBlockSaveRoll's MA-0049 no-target guard, so
// an unarmed Control Water press burned the use while the refusal popup/log
// claimed "zero spend". Fix lane: CODE check-before-spend guard
// (refuseUnarmedMonsterSaveCast), mirroring the MA-0033 attack-lane
// validate-before-spend precedent; refusals now spend NOTHING and the MA-0049
// popup/log text is honest.
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const SPELLS_5E = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));
const SPELLS_2024 = JSON.parse(readFileSync('public/data/2024/spells.json', 'utf8'));

const WAVEBENDER = monsters.find(m => m.index === 'merfolk-wavebender');
const WAVEBENDER_ROW = WAVEBENDER.actions.find(a => a.name === 'Spellcasting');
const MONSTER_NAME = 'Merfolk Wavebender 1';

// ── Mocks (spellcasting.test.jsx harness) ─────────────────────────────────

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 8, rolls: [3, 5], modifier: 2 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 16, rolls: [3, 5], modifier: 2 })),
}));

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSpells: vi.fn((version) => Promise.resolve(version === '2024' ? SPELLS_2024 : SPELLS_5E)),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _rollAttack = vi.fn();
  const _rollDamage = vi.fn();
  const _rollSavingThrow = vi.fn();

  const mockHook = vi.fn(() => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: vi.fn((val) => { _popupHtml = val; }),
    rollAttack: _rollAttack,
    rollDamage: _rollDamage,
    rollSavingThrow: _rollSavingThrow,
  }));

  return {
    default: mockHook,
    get _popupHtml() { return _popupHtml; },
    _resetPopupHtml: () => { _popupHtml = null; },
    _rollAttack,
    _rollDamage,
    _rollSavingThrow,
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
import { loadSpells } from '../../services/ui/dataLoader.js';
import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';

const rollSavingThrow = useLoggedDiceRoll._rollSavingThrow;

function linkByText(text) {
  return Array.from(document.querySelectorAll('.mc-dice-link')).find(el => el.textContent.includes(text)) || null;
}

function entriesOf(abilityName) {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e.abilityName === abilityName);
}

function renderWavebender({ armed } = { armed: false }) {
  const m = makeMonster({ name: MONSTER_NAME, ability_score_modifiers: { ...WAVEBENDER.ability_score_modifiers }, actions: [WAVEBENDER_ROW] });
  const attacker = { name: MONSTER_NAME, type: 'npc', monsterType: 'elemental', targetName: armed ? 'TestPC' : null, currentHp: 97, maxHp: 97, conditions: [] };
  const creatures = [attacker, { name: 'TestPC', type: 'player', currentHp: 60, maxHp: 60, conditions: [], computedStats: {} }];
  const props = makeProps(m, { creatureName: MONSTER_NAME, creatures });
  const { rerender } = render(<MonsterCardModal {...props} />);
  return () => rerender(<MonsterCardModal {...props} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  useLoggedDiceRoll._resetPopupHtml();
  loadSpells.mockImplementation((version) => Promise.resolve(version === '2024' ? SPELLS_2024 : SPELLS_5E));
});

// ── Defect 1: DATA lane — Light carries no never-firing save dc ──────────

describe('MA-1150 Light spell data (defect 1 fix)', () => {
  it('5e spells.json Light dc is null, byte-aligned with the 2024 twin — no {dc_type:DEX,dc_success:none} noise', () => {
    const light5e = SPELLS_5E.find(s => s.name === 'Light');
    const light2024 = SPELLS_2024.find(s => s.name === 'Light');
    expect(light5e.dc ?? null).toBeNull();
    expect(light2024.dc ?? null).toBeNull();
  });

  it('wavebender row disk truth: save_dc 15 + save_type Wisdom + 4 marked spells', () => {
    expect(WAVEBENDER_ROW.save_dc).toBe(15);
    expect(WAVEBENDER_ROW.save_type).toBe('Wisdom');
    expect(8 + WAVEBENDER.ability_score_modifiers.wis + WAVEBENDER.proficiency_bonus).toBe(15);
  });
});

// ── Defect 1: advisory log stamps the ROW-authored Wisdom for Light ──────

describe('MA-1150 advisory cast log ability stamp (defect 1)', () => {
  it('Light cast via Spellcasting logs "spell save DC 15, Wisdom" — never DEX', async () => {
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

  it('Elementalism (2024-only, dc:null) keeps logging row Wisdom — fallback lane unchanged', async () => {
    renderWavebender();
    await act(async () => { fireEvent.click(linkByText('Elementalism')); });

    await waitFor(() => expect(entriesOf('Elementalism').length).toBe(1));
    expect(entriesOf('Elementalism')[0].description).toMatch(/\(spell save DC 15, Wisdom\)/);
    expect(loadSpells).toHaveBeenCalledWith('2024');
    expect(rollSavingThrow).not.toHaveBeenCalled();
  });

  it('rows WITHOUT an authored save_type still fall back to spell-side dc_type (MA-0012 lane intact)', async () => {
    const row = {
      name: 'Spellcasting',
      description: 'The caster casts one of the following spells:<br><strong>At Will:</strong> <strong>Command</strong>',
      save_dc: 12,
      save_type: '',
    };
    const m = makeMonster({ name: 'Fanatic Stand-in', actions: [row] });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Fanatic Stand-in 1', creatures: [] })} />);
    await act(async () => { fireEvent.click(linkByText('Command')); });

    await waitFor(() => expect(entriesOf('Command').length).toBe(1));
    expect(entriesOf('Command')[0].description).toMatch(/\(spell save DC 12, WIS\)/);
  });
});

// ── Defect 2: no-target refusal spends NOTHING ─────────────────────────────

describe('MA-1150 Control Water no-target refusal (defect 2)', () => {
  it('unarmed press refuses via MA-0049 popup+log BEFORE any spend — uses, ledger and text all honest', async () => {
    renderWavebender({ armed: false });
    await act(async () => { fireEvent.click(linkByText('Control Water')); });

    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    const refusal = entriesOf('Control Water').find(e => e.type === 'automation');
    expect(refusal).toBeTruthy();
    expect(refusal.automationType).toBe('control_water_refused');
    expect(refusal.description).toMatch(/refused \(no target\)/);
    expect(refusal.description).toMatch(/Zero spend, no save prompt\./);
    // truthful now: nothing was actually paid
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
    expect(entriesOf('Control Water').filter(e => e.type === 'ability_use').length).toBe(0);
    expect(rollSavingThrow).not.toHaveBeenCalled();
    // the only popup is the MA-0049 refusal, whose "nothing spent" text is honest
    expect(useLoggedDiceRoll._popupHtml).toMatch(/mc-no-target-refusal/);
    expect(useLoggedDiceRoll._popupHtml).toMatch(/nothing spent/);
    // and the chip still shows the use unspent
    expect(linkByText('Control Water').textContent).toMatch(/\(1\/Day · 1 left\)/);
  });

  it('armed press DOES spend the 1/Day use and routes the spell-attributed STR/half save', async () => {
    renderWavebender({ armed: true });
    await act(async () => { fireEvent.click(linkByText('Control Water')); });

    await waitFor(() => expect(rollSavingThrow).toHaveBeenCalledTimes(1));
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Control Water': 1 });
    const spend = entriesOf('Control Water').find(e => e.type === 'ability_use');
    expect(spend).toBeTruthy();
    expect(spend.description).toMatch(/1\/Day use spent — 0 remaining today/);
    const context = rollSavingThrow.mock.calls[0][2];
    expect(context.spellName).toBe('Control Water');
    expect(context.saveDc).toBe(15);
    expect(context.saveType).toBe('STR');
    expect(context.dcSuccess).toBe('half');
    expect(context.isSpellDamage).toBe(true);
    expect(entriesOf('Control Water').some(e => e.type === 'automation')).toBe(false);
  });

  it('post-spend exhausted refire still refuses with automation blocked and no extra spend', async () => {
    renderWavebender({ armed: true });
    await act(async () => { fireEvent.click(linkByText('Control Water')); });
    await waitFor(() => expect(rollSavingThrow).toHaveBeenCalledTimes(1));

    await act(async () => { fireEvent.click(linkByText('Control Water')); });
    const blocked = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'automation blocked');
    expect(blocked).toBeTruthy();
    expect(blocked.description).toMatch(/already cast Control Water today \(1\/Day\)/);
    expect(rollSavingThrow).toHaveBeenCalledTimes(1);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Control Water': 1 });
  });
});
