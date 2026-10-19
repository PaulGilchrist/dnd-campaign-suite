// @maintained-by-ai
// MA-1591 data lock: Thri-kreen Psion Spellcasting rode the MA-1543 (Storm
// Giant) byte-twin markup-gap template — the row was fully markup-free
// (plain-text tiers AND names) → extractSpellNamesFromSpellcasting [] →
// SpellCastLinks null → zero chips, cast lane dead while sibling chips armed.
// DATA fix: dao/MA-1543 house-style re-markup (headers <strong> ending ":",
// names <em>, "\n" tier lines, "(the hand is Invisible)" parenthetical OUTSIDE
// the <em> so the harvested name resolves vs spells.json). Row-level numeric
// save_dc 15 + save_type "Intelligence" pair was ALREADY authored (§89 gate
// pre-met; §676 XOR fork keeps the DC unrendered on SpellCastLinks rows).
// MA-0020 uses gate then binds 1/Day Each to the three marked names; At Will
// Mage Hand ungated. Synaptic Static is 2024-only in this repo's DBs →
// resolves via findMonsterSpell's 2024 fallback (§207; §177 ruleset-branch
// mock). Advisory (dc-null) spell lane owned here per ma0452/ma0552
// convention. Counter-independence multi-key store is generically owned by
// spellcasting.test.jsx Animal Lord — this file re-proves it for the live
// three-name gate inline, no dedicated test. Charge-bonus/save-margin lanes
// NOT claimed (ma1584/ma1573/ma1577/ma1578 own).
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { extractSpellNamesFromSpellcasting, extractSpellcastingSpellUses } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const spells5e = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));
const spells2024 = JSON.parse(readFileSync('public/data/2024/spells.json', 'utf8'));

const tk = monsters.find(m => m.index === 'thri-kreen-psion');
const tkRow = tk.actions.find(a => a.name === 'Spellcasting');
const NAMES = ['Mage Hand', 'Detect Thoughts', 'Sending', 'Synaptic Static'];

// Byte-exact dao/MA-1543 house style — byte equality subsumes every
// content/markup/whitespace claim about this row (no collapse-twin needed).
const TK_FIXED_BYTES = 'The thri-kreen casts one of the following spells, requiring no spell components and using Intelligence as the spellcasting ability (spell save DC 15):\n<strong>At Will:</strong> <em>Mage Hand</em> (the hand is Invisible)\n<strong>1/Day Each:</strong> <em>Detect Thoughts</em>, <em>Sending</em>, <em>Synaptic Static</em>';

// MA-1543 twin + lead-in siblings (§1112: lead-in ×2 file-wide, DC discriminates).
const stormRow = monsters.find(m => m.index === 'storm-giant').actions.find(a => a.name === 'Spellcasting');
const SG_FIXED_BYTES = 'The giant casts one of the following spells, requiring no Material components and using Wisdom as the spellcasting ability (spell save DC 18):\n<strong>At Will:</strong> <em>Detect Magic</em>, <em>Light</em>\n<strong>1/Day:</strong> <em>Control Weather</em>';
const cloudRow = monsters.find(m => m.index === 'cloud-giant').actions.find(a => a.name === 'Spellcasting');

// 5e-first lookup fixtures (§177: mock MUST branch on ruleset arg).
const SPELLS_5E = spells5e.filter(s => ['Mage Hand', 'Detect Thoughts', 'Sending'].includes(s.name));
const SPELLS_2024 = spells2024.filter(s => NAMES.includes(s.name));
const SYNAPTIC = spells2024.find(s => s.name === 'Synaptic Static');

const MONSTER_NAME = 'Thri-kreen Psion 1';

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
  loadSpells: vi.fn((version) => Promise.resolve(version === '2024' ? SPELLS_2024 : SPELLS_5E)),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  const _rollSavingThrow = vi.fn();
  const shared = {
    popupHtml: null,
    setPopupHtml: vi.fn(),
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    rollAbilityCheck: vi.fn(),
    rollSavingThrow: _rollSavingThrow,
    rollSkillCheck: vi.fn(),
    rollInitiative: vi.fn(),
    quickRollPlayerSave: vi.fn(),
  };
  return { default: vi.fn(() => shared), _rollSavingThrow };
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

import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import { addEntry } from '../../services/ui/logService.js';

const rollSavingThrow = useLoggedDiceRoll._rollSavingThrow;

function linkByText(text) {
  return Array.from(document.querySelectorAll('.mc-dice-link')).find(el => el.textContent.includes(text)) || null;
}

function abilityUseEntries(name) {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'ability_use' && e.abilityName === name);
}

function refusals(name) {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'automation blocked' && e.abilityName === name);
}

function renderPsion() {
  const m = makeMonster({ name: 'Thri-kreen Psion', actions: [tkRow] });
  const creatures = [
    { name: MONSTER_NAME, type: 'npc', monsterType: 'monstrosity', targetName: 'Bandit', ac: 13, currentHp: 149, maxHp: 149, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: MONSTER_NAME, creatures })} />);
}

// ── Data lock: thri-kreen-psion Spellcasting row ────────────────────────────

describe('MA-1591 monsters.json/spells.json data lock: Thri-kreen Psion Spellcasting row', () => {
  it('extracts the four spell names live AND binds 1/Day Each to exactly the three marked names, Mage Hand ungated', () => {
    // Exact-map equality on both helper outputs subsumes header/parenthetical
    // negatives and the At Will/1/Day partition.
    expect(extractSpellNamesFromSpellcasting(tkRow.description)).toEqual(NAMES);
    expect(extractSpellcastingSpellUses(tkRow.description)).toEqual({
      'Detect Thoughts': 1, Sending: 1, 'Synaptic Static': 1,
    });
  });

  it('row byte-locked house style with save_dc 15/Intelligence seam (8 + INT 4 + PB 3); MA-1543 storm twin byte-exact + cloud lead-in intact', () => {
    expect(tkRow.description).toBe(TK_FIXED_BYTES);
    expect(tkRow.save_dc).toBe(15);
    expect(tkRow.save_type).toBe('Intelligence');
    expect(tkRow.spell_save_dc).toBeUndefined();
    expect(tkRow.attack_bonus).toBeUndefined();
    expect(tkRow.automation).toBeUndefined();
    expect(tk.ability_score_modifiers.int).toBe(4);
    expect(tk.proficiency_bonus).toBe(3);
    expect(stormRow.description).toBe(SG_FIXED_BYTES);
    expect(cloudRow.description).toContain('(spell save DC 15)');
    expect(cloudRow.description).toContain('<strong>1/Day Each:</strong> <em>Control Weather</em>');
  });

  it('spells DB: MH/DT/Sending 5e advisory (dc+damage null); Synaptic Static 2024-only INT half 8d6 (§207 fallback)', () => {
    expect(SPELLS_5E.map(s => s.name)).toEqual(expect.arrayContaining(['Mage Hand', 'Detect Thoughts', 'Sending']));
    expect(SPELLS_5E.map(s => [s.dc ?? null, s.damage ?? null])).toEqual([[null, null], [null, null], [null, null]]);
    expect(spells5e.some(s => s.name === 'Synaptic Static')).toBe(false);
    expect(SYNAPTIC.dc).toEqual({ dc_type: 'INT', dc_success: 'half' });
    expect(SYNAPTIC.damage.damage_at_slot_level['5']).toBe('8d6');
  });
});

// ── Modal: four chips, counters, gates ───────────────────────────────────────

describe('MA-1591 MonsterCardModal Thri-kreen Psion Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    runtime.setRuntimeValue.mockImplementation((characterKey, propertyName, value) => { runtime.store[`${characterKey}.${propertyName}`] = value; return Promise.resolve(); });
    runtime.getRuntimeValue.mockImplementation((characterKey, propertyName) => runtime.store[`${characterKey}.${propertyName}`] ?? null);
    runtime.useRuntimeValue.mockImplementation((characterKey, propertyName) => runtime.store[`${characterKey}.${propertyName}`] ?? null);
  });

  it('renders exactly four chips with exact counter labels — the zero-chip inert row is gone; At Will name uncounted', () => {
    renderPsion();
    const labels = Array.from(document.querySelectorAll('.mc-dice-link-spell')).map(el => el.textContent.trim());
    expect(labels).toEqual([
      'Mage Hand',
      'Detect Thoughts (1/Day · 1 left)',
      'Sending (1/Day · 1 left)',
      'Synaptic Static (1/Day · 1 left)',
    ]);
  });

  it('At Will Mage Hand casts repeatedly — advisory log prints row DC 15 Intelligence, zero uses written, zero refusals', async () => {
    renderPsion();
    await act(async () => { fireEvent.click(linkByText('Mage Hand')); });
    await waitFor(() => expect(abilityUseEntries('Mage Hand').length).toBe(1));
    expect(abilityUseEntries('Mage Hand')[0].description).toMatch(/Thri-kreen Psion 1 casts Mage Hand via Spellcasting \(spell save DC 15, Intelligence\)/);
    await act(async () => { fireEvent.click(linkByText('Mage Hand')); });
    await waitFor(() => expect(abilityUseEntries('Mage Hand').length).toBe(2));
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
    expect(refusals('Mage Hand').length).toBe(0);
  });

  it('Detect Thoughts advisory cast spends 1/Day then refuses; Sending keeps its own live counter', async () => {
    renderPsion();
    await act(async () => { fireEvent.click(linkByText('Detect Thoughts')); });
    await waitFor(() => expect(abilityUseEntries('Detect Thoughts').length).toBe(1));
    expect(abilityUseEntries('Detect Thoughts')[0].description).toMatch(/casts Detect Thoughts via Spellcasting \(spell save DC 15, Intelligence\)/);
    expect(abilityUseEntries('Detect Thoughts')[0].description).toMatch(/1\/Day use spent — 0 remaining today/);
    expect(rollSavingThrow).not.toHaveBeenCalled();
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Detect Thoughts': 1 });
    await act(async () => { fireEvent.click(linkByText('Detect Thoughts')); });
    await waitFor(() => expect(refusals('Detect Thoughts').length).toBe(1));
    expect(refusals('Detect Thoughts')[0].description).toMatch(/already cast Detect Thoughts today \(1\/Day\)/);
    expect(abilityUseEntries('Detect Thoughts').length).toBe(1);
    // Independent counter for the live three-name MA-0020 gate (generic lane
    // owned by spellcasting.test.jsx Animal Lord multi-key lock).
    await act(async () => { fireEvent.click(linkByText('Sending')); });
    await waitFor(() => expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Detect Thoughts': 1, Sending: 1 }));
    expect(abilityUseEntries('Sending').length).toBe(1);
  });

  it('Synaptic Static resolves via 2024 fallback — INT save DC 15 half, 8d6 Psychic, spends 1/Day then refuses', async () => {
    renderPsion();
    await act(async () => { fireEvent.click(linkByText('Synaptic Static')); });
    await waitFor(() => expect(rollSavingThrow).toHaveBeenCalledTimes(1));
    const context = rollSavingThrow.mock.calls[0][2];
    expect(context.saveType).toBe('INT');
    expect(context.saveDc).toBe(15);
    expect(context.dcSuccess).toBe('half');
    expect(context.autoDamageFormula).toBe('8d6');
    expect(context.autoDamageDamageType).toBe('Psychic');
    expect(context.spellName).toBe('Synaptic Static');
    await waitFor(() => expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Synaptic Static': 1 }));
    await act(async () => { fireEvent.click(linkByText('Synaptic Static')); });
    await waitFor(() => expect(refusals('Synaptic Static').length).toBe(1));
    expect(rollSavingThrow).toHaveBeenCalledTimes(1);
  });
});
