// @maintained-by-ai 2026-11-28
// MA-0564/MA-0572 data locks: Death Knight + Death Knight Aspirant Spellcasting
// rows rode the MA-0421/MA-0532/MA-0552 twin markup-gap template — pre-fix the
// non-header spell names were plain text, so extraction returned [] and the
// row's orphaned spell_save_dc never reached the save seam. DATA fix: <em> on
// each spell name (tier headers byte-kept, "(Necrotic)" parenthetical OUTSIDE
// the tag, strip-tags byte-equality proves the markup-only diff) + trailing
// row-level numeric save_dc + save_type pair (MA-0454/MA-0421 convention).
// LIVE SPELL LANE: the 2026-11-19 subclass-spell census added the canonical
// 2014 Destructive Wave row to the 5e table, so findMonsterSpell (5e-first,
// 2024 fallback) resolves it directly — WIS save, the row's authored DC. The
// loadSpells mock below is disk-faithful (full tables), so the e2e pins the
// live resolution: saveType 'WIS' fails the moment the 5e row disappears and
// the chip silently regresses to the 2024-only CON fallback.
// Coverage ownership elsewhere: refusals + repeated at-Will castable →
// spellcasting.test.jsx; spell-shape null legs → ma1959-orcus-wand; advisory
// log class → ma0524; distinct-DC save seam (16) → ability-save-uses.test.jsx;
// 1/Day spend + exhaustion refusal → ma0599-deva. The aspirant chip/cast
// renders are the SAME execution path as the death-knight e2e below with
// different constants, so this file keeps only the aspirant row's data lock.
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { extractSpellNamesFromSpellcasting, extractSpellcastingSpellUses } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const spells5e = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));
const spells2024 = JSON.parse(readFileSync('public/data/2024/spells.json', 'utf8'));

const dk = monsters.find(m => m.index === 'death-knight');
const dkRow = dk.actions.find(a => a.name === 'Spellcasting');
const asp = monsters.find(m => m.index === 'death-knight-aspirant');
const aspRow = asp.actions.find(a => a.name === 'Spellcasting');

const DK_NAMES = ['Command', 'Phantom Steed', 'Destructive Wave', 'Dispel Magic'];
const ASP_NAMES = ['Phantom Steed', 'Destructive Wave', 'Dispel Magic'];
const DK_PLAIN_ORIGINAL = 'The death knight casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 18):\nAt Will: Command, Phantom Steed\n2/Day Each: Destructive Wave (Necrotic), Dispel Magic';
const ASP_PLAIN_ORIGINAL = 'The aspirant casts one of the following spells, using Charisma as the spellcasting ability (spell save DC 15):\nAt Will: Phantom Steed\n1/Day Each: Destructive Wave (Necrotic), Dispel Magic';
const stripTags = (d) => d.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '');

const MONSTER_NAME = 'Death Knight 1';

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSpells: vi.fn((version) => Promise.resolve(version === '2024' ? spells2024 : spells5e)),
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

import { addEntry } from '../../services/ui/logService.js';
import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
const rollSavingThrow = useLoggedDiceRoll._rollSavingThrow;

function spellLinks() {
  return Array.from(document.querySelectorAll('.mc-dice-link-spell'));
}

function linkByText(text) {
  return Array.from(document.querySelectorAll('.mc-dice-link')).find(el => el.textContent.includes(text)) || null;
}

function abilityUseEntries(name) {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'ability_use' && e.abilityName === name);
}

function saveOptsFor(spellName) {
  return rollSavingThrow.mock.calls.map(c => c[2]).find(o => o.spellName === spellName);
}

function renderDeathKnight() {
  const m = makeMonster({ name: 'Death Knight', actions: [dkRow] });
  const creatures = [
    { name: MONSTER_NAME, type: 'npc', monsterType: 'undead', targetName: 'Bandit', ac: 20, currentHp: 199, maxHp: 199, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: MONSTER_NAME, creatures })} />);
}

// ── Data locks: cured Spellcasting markup rows (monsters.json) ───────────────

describe('MA-0564/MA-0572 monsters.json data locks: Death Knight + Aspirant Spellcasting rows', () => {
  it('Death Knight row: numeric save_dc 18 + Charisma pair authored, (Necrotic) parenthetical OUTSIDE the em tag, stripped text byte-equals the pre-fix description', () => {
    expect(dkRow.save_dc).toBe(18);
    expect(dkRow.save_type).toBe('Charisma');
    expect(dkRow.spell_save_dc).toBe(18);
    expect(dkRow.spellcasting_ability).toBe('Charisma');
    expect(dkRow.description).toMatch(/<em>Destructive Wave<\/em> \(Necrotic\)/);
    expect(stripTags(dkRow.description)).toBe(DK_PLAIN_ORIGINAL);
  });

  it('Aspirant twin row: extracts the three names BY-name with the exact 1/Day gate map (headers and Phantom Steed absent), save_dc 15 + Charisma pair, stripped byte-equality', () => {
    expect(extractSpellNamesFromSpellcasting(aspRow.description)).toEqual(ASP_NAMES);
    expect(extractSpellcastingSpellUses(aspRow.description)).toEqual({ 'Destructive Wave': 1, 'Dispel Magic': 1 });
    expect(aspRow.save_dc).toBe(15);
    expect(aspRow.save_type).toBe('Charisma');
    expect(stripTags(aspRow.description)).toBe(ASP_PLAIN_ORIGINAL);
  });
});

// ── Modal: chips, counters, merged one-render cast e2e ─────────────────────

describe('MA-0564 MonsterCardModal Death Knight Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders four chips (counters on 2/Day names only); one-render multi-spell cast: Command logs row DC 18 ungated, Dispel Magic spends 2/Day, Destructive Wave resolves 5e-first (WIS/half) at saveDc 18', async () => {
    renderDeathKnight();

    expect(spellLinks().map(el => el.textContent.split('(')[0].trim())).toEqual(DK_NAMES);
    expect(linkByText('Destructive Wave').textContent).toMatch(/\(2\/Day · 2 left\)/);
    expect(linkByText('Dispel Magic').textContent).toMatch(/\(2\/Day · 2 left\)/);
    expect(linkByText('Command').textContent).not.toMatch(/\/Day/);
    expect(linkByText('Phantom Steed').textContent).not.toMatch(/\/Day/);

    await act(async () => { fireEvent.click(linkByText('Command')); });
    await waitFor(() => expect(abilityUseEntries('Command').length).toBe(1));
    expect(abilityUseEntries('Command')[0].description).toMatch(/\(spell save DC 18/);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();

    await act(async () => { fireEvent.click(linkByText('Dispel Magic')); });
    await waitFor(() => expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Dispel Magic': 1 }));
    expect(abilityUseEntries('Dispel Magic')[0].description).toMatch(/casts Dispel Magic via Spellcasting \(spell save DC 18/);
    await act(async () => { fireEvent.click(linkByText('Dispel Magic')); });
    await waitFor(() => expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Dispel Magic': 2 }));

    await act(async () => { fireEvent.click(linkByText('Destructive Wave')); });
    await waitFor(() => expect(saveOptsFor('Destructive Wave')).toBeTruthy());
    const opts = saveOptsFor('Destructive Wave');
    // Live census lane: the 2014 5e row resolves first (NOT the 2024 CON face).
    expect(opts.saveType).toBe('WIS');
    expect(opts.dcSuccess).toBe('half');
    expect(opts.saveDc).toBe(18);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Dispel Magic': 2, 'Destructive Wave': 1 });
    expect(abilityUseEntries('Destructive Wave')[0].description).toMatch(/2\/Day use spent/);
  });
});
