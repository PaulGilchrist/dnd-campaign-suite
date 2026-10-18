// @maintained-by-ai — MA-0459 lane (cambion spellcasting bytes + save_dc seam).
// Trimmed 9→5 tests: generic chip-click/advisory/spend/refuse lanes cited-skipped
// to owners (MonsterCardModal.spellcasting.test.jsx #588 — advisory :195, 1/Day
// spend+refuse+store :281-315, 2/Day spend-to-zero+3rd-refuse :518-533; usage
// #571 MonsterCardHelpers.usage.test.js; dual-tier counter render already pinned
// by ma0543-cyclops-oracle:213; WIS-charmed arm+spend marker by
// ability-save-uses.test.jsx:127). Key-order indexOf dropped (non-behavioral —
// buildAbilitySaveRollContext reads by name). Kept by-name: markup-only diff proof
// with qualifier bytes, gate extraction, save_dc/save_type seam end-to-end,
// 5-chip render (was zero affordances). Dead diceRoller + popup mocks purged
// (empirical bisect: never reached in this lane, mirrors MA-0421 purge).
// Disk note: cambion carries NO Fiendish Luck (no traits/reactions/legendary on
// disk) and fly is speed.fly 60 ft. (movement lane) — no coverage owed here.
// MA-0459 data lock: Cambion Spellcasting row (actions[3]) carried plain-text
// spell names (zero affordances, MA-0421 family) and spell_save_dc only — the
// save seam never reached buildAbilitySaveRollContext (MA-0532: row-level
// numeric save_dc/save_type required; MA-0237 prose-DC twin). DATA fix mirrors
// the MA-0421 bone-naga / MA-0454 bullywug-bog-sage byte-shape exactly: five
// spell names in <em> with qualifiers OUTSIDE the tags (MA-0276), trailing
// save_dc: 14 + save_type: "Charisma" pair, tier headers byte-unchanged.
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { extractSpellNamesFromSpellcasting, extractSpellcastingSpellUses } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const allSpells = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));
const realSpells = (names) => allSpells.filter(s => names.includes(s.name));

const CAMBION_SPELLS = ['Alter Self', 'Command', 'Detect Magic', 'Dominate Person', 'Plane Shift'];

// Pre-fix description fingerprint (git HEAD, monsters.json) — the markup-only
// diff proof: strip every tag from the FIXED row and it must equal the original
// byte-for-byte.
const CAMBION_PLAIN_ORIGINAL = 'The cambion casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 14):\n2/Day Each: Alter Self, Command (level 3 version), Detect Magic\n1/Day Each: Dominate Person (level 8 version), Plane Shift (self only)';
const stripTags = (d) => d.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '');

const cambion = monsters.find(m => m.index === 'cambion');
const cambionRow = cambion.actions.find(a => a.name === 'Spellcasting');

// ── Mocks (mirror MonsterCardModal.ma0421-bone-naga-spellcasting.test.jsx) ─

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSpells: vi.fn((version) => Promise.resolve(version === '2024' ? [] : realSpells(CAMBION_SPELLS))),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  const _rollSavingThrow = vi.fn();
  const noop = () => vi.fn();
  const mockHook = vi.fn(() => ({
    popupHtml: null,
    setPopupHtml: noop(),
    rollAttack: noop(),
    rollDamage: noop(),
    rollAbilityCheck: noop(),
    rollSavingThrow: _rollSavingThrow,
    rollSkillCheck: noop(),
    rollInitiative: noop(),
    quickRollPlayerSave: noop(),
  }));

  return { default: mockHook, _rollSavingThrow };
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

function renderCambion() {
  const m = makeMonster({ name: cambion.name, actions: [cambionRow] });
  const creatures = [
    { name: 'Cambion 1', type: 'npc', monsterType: 'fiend', targetName: 'TestPC', currentHp: cambion.hit_points, maxHp: cambion.hit_points, conditions: [] },
    { name: 'TestPC', type: 'player', currentHp: 60, maxHp: 60, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: 'Cambion 1', creatures })} />);
}

// ── Data lock: cambion row bytes + save_dc seam ─────────────────────────────

describe('MA-0459 monsters.json data lock: Cambion Spellcasting row', () => {
  it('by-name bytes: five spell names extract as chips, qualifiers stay OUTSIDE the <em> tags (MA-0276), and stripped text equals the pre-fix description byte-for-byte (markup-only diff)', () => {
    expect(extractSpellNamesFromSpellcasting(cambionRow.description)).toEqual(CAMBION_SPELLS);
    expect(cambionRow.description).toContain('<em>Command</em> (level 3 version)');
    expect(cambionRow.description).toContain('<em>Dominate Person</em> (level 8 version)');
    expect(cambionRow.description).toContain('<em>Plane Shift</em> (self only)');
    expect(stripTags(cambionRow.description)).toBe(CAMBION_PLAIN_ORIGINAL);
  });

  it('extractSpellcastingSpellUses binds the 2/Day x3 + 1/Day x2 gates to MARKED names only', () => {
    expect(extractSpellcastingSpellUses(cambionRow.description)).toEqual({
      'Alter Self': 2, 'Command': 2, 'Detect Magic': 2,
      'Dominate Person': 1, 'Plane Shift': 1,
    });
  });

  it('carries the trailing save_dc 14 + save_type Charisma pair (8 + CHA + PB) — the seam buildAbilitySaveRollContext reads (spell_save_dc alone never reached it, MA-0532)', () => {
    expect(cambionRow.save_dc).toBe(14);
    expect(cambionRow.save_type).toBe('Charisma');
    expect(8 + cambion.ability_score_modifiers.cha + cambion.proficiency_bonus).toBe(14);
  });
});

// ── Modal: chips + save_dc seam, by name ────────────────────────────────────

describe('MA-0459 MonsterCardModal Cambion Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders five clickable spell chips (was zero affordances) with tier counters on both gates', () => {
    renderCambion();
    const names = spellLinks().map(el => el.textContent.split('(')[0].trim());
    expect(names.sort()).toEqual([...CAMBION_SPELLS].sort());
    expect(linkByText('Command').textContent).toMatch(/\(2\/Day · 2 left\)/);
    expect(linkByText('Dominate Person').textContent).toMatch(/\(1\/Day · 1 left\)/);
    expect(document.querySelector('.mc-dice-link-save-clickable')).toBeNull();
  });

  it('Dominate Person routes the save leg through the newly-authored save_dc seam: DC 14 WIS, one ability_use cast record', async () => {
    renderCambion();
    await act(async () => { fireEvent.click(linkByText('Dominate Person')); });

    await waitFor(() => expect(rollSavingThrow).toHaveBeenCalled());
    const context = rollSavingThrow.mock.calls[0][2];
    expect(context.spellName).toBe('Dominate Person');
    expect(context.saveDc).toBe(14);
    expect(context.saveType).toBe('WIS');
    await waitFor(() => expect(abilityUseEntries('Dominate Person').length).toBe(1));
  });
});
