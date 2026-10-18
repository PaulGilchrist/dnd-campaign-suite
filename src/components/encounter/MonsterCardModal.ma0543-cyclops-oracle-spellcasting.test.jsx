// @maintained-by-ai
// MA-0543 data lock: Cyclops Oracle Spellcasting rode the MA-0421/MA-0532
// markup-gap template (save_dc 16 + save_type Wisdom already authored). Pre-fix
// ONLY the tier headers carried <strong>; Arcane Eye/Detect Magic/Locate
// Object/Legend Lore were plain text — extractSpellNamesFromSpellcasting
// returned [] (every marked token ended ':') and extractSpellcastingSpellUses
// returned {} (N/Day limits never bound unmarked names) → SpellCastLinks null
// → zero chips; the row-level save_dc/save_type were orphaned by the
// Spellcasting-row fork (MA-0524). DATA fix: <em> on each spell name,
// Cultist Fanatic MA-0532 byte-shape; headers byte-kept.
// Kept: BY-name disk extraction + 2/Day Each trio / 1/Day gate map + distinct
// DC 16 Wisdom row lock + markup-only strip-diff + the advisory cast seam
// (row DC printed, 1-of-2 spent).
// Cite-skip owners: chip render spellcasting.test.jsx:184; counters
// ability-save-uses.test.jsx:127 + spellcasting.test.jsx:275; advisory class
// ma0524-couatl:222 (DC 15 WIS) / ma0558:219 (DC 14 Wisdom); refusals
// spellcasting.test.jsx:281 (1/Day) and :518 (2/Day 3rd-cast) — this row's
// gate arithmetic differs only in DC/name, helpers owned suite-wide.
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { extractSpellNamesFromSpellcasting, extractSpellcastingSpellUses } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const spells5e = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));

const co = monsters.find(m => m.index === 'cyclops-oracle');
const coRow = co.actions.find(a => a.name === 'Spellcasting');
const ARCANE_EYE = spells5e.find(s => s.name === 'Arcane Eye');
const DETECT_MAGIC = spells5e.find(s => s.name === 'Detect Magic');
const LOCATE_OBJECT = spells5e.find(s => s.name === 'Locate Object');
const LEGEND_LORE = spells5e.find(s => s.name === 'Legend Lore');

const REAL_SPELLS = ['Arcane Eye', 'Detect Magic', 'Locate Object', 'Legend Lore'];

const CO_PLAIN_ORIGINAL = 'The cyclops casts one of the following spells, requiring no Material components and using Wisdom as the spellcasting ability (spell save DC 16):\n2/Day Each: Arcane Eye, Detect Magic, Locate Object\n1/Day: Legend Lore';
const stripTags = (d) => d.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '');

const MONSTER_NAME = 'Cyclops Oracle 1';

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSpells: vi.fn((version) => Promise.resolve(version === '2024' ? [] : [ARCANE_EYE, DETECT_MAGIC, LOCATE_OBJECT, LEGEND_LORE])),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const mockHook = vi.fn(() => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: vi.fn((val) => { _popupHtml = val; }),
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    rollAbilityCheck: vi.fn(),
    rollSavingThrow: vi.fn(),
    rollSkillCheck: vi.fn(),
    rollInitiative: vi.fn(),
    quickRollPlayerSave: vi.fn(),
  }));
  return { default: mockHook };
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

function linkByText(text) {
  return Array.from(document.querySelectorAll('.mc-dice-link')).find(el => el.textContent.includes(text)) || null;
}

function abilityUseEntries(name) {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'ability_use' && e.abilityName === name);
}

function renderCyclops() {
  const m = makeMonster({ name: 'Cyclops Oracle', actions: [coRow] });
  const creatures = [
    { name: MONSTER_NAME, type: 'npc', monsterType: 'giant', targetName: 'Bandit', ac: 14, currentHp: 138, maxHp: 138, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: MONSTER_NAME, creatures })} />);
}

// ── Data lock: cyclops-oracle Spellcasting row ───────────────────────────────

describe('MA-0543 monsters.json data lock: Cyclops Oracle Spellcasting row', () => {
  it('extracts all four spell names as chips — headers skipped', () => {
    const names = extractSpellNamesFromSpellcasting(coRow.description);
    expect(names).toEqual(REAL_SPELLS);
    expect(names).not.toContain('2/Day Each');
    expect(names).not.toContain('1/Day');
  });

  it('binds the N/Day gates to exactly the marked names: 2/Day Each trio + Legend Lore 1', () => {
    expect(extractSpellcastingSpellUses(coRow.description)).toEqual({ 'Arcane Eye': 2, 'Detect Magic': 2, 'Locate Object': 2, 'Legend Lore': 1 });
  });

  it('save fields authored — numeric save_dc 16 + save_type Wisdom', () => {
    expect(coRow.save_dc).toBe(16);
    expect(coRow.save_type).toBe('Wisdom');
    expect(coRow.spell_save_dc).toBe(16);
    expect(coRow.spellcasting_ability).toBe('Wisdom');
    expect(coRow.description).toMatch(/spell save DC 16/);
  });

  it('markup-only diff proof: stripped text equals the pre-fix description byte-for-byte', () => {
    expect(stripTags(coRow.description)).toBe(CO_PLAIN_ORIGINAL);
  });
});

// ── Modal: advisory cast seam — row DC printed, gate spends ─────────────────

describe('MA-0543 MonsterCardModal Cyclops Oracle Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('casts Detect Magic — advisory log prints row DC 16 Wisdom, spends 1 of 2', async () => {
    renderCyclops();
    await act(async () => { fireEvent.click(linkByText('Detect Magic')); });

    await waitFor(() => expect(abilityUseEntries('Detect Magic').length).toBe(1));
    const entry = abilityUseEntries('Detect Magic')[0];
    expect(entry.characterName).toBe(MONSTER_NAME);
    expect(entry.description).toMatch(/casts Detect Magic via Spellcasting \(spell save DC 16, Wisdom\)/);
    expect(entry.description).toMatch(/2\/Day use spent — 1 remaining today/);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Detect Magic': 1 });
  });
});
