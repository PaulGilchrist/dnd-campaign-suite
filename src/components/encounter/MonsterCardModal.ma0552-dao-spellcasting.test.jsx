// @maintained-by-ai — trimmed 2026-10-18 (10→7 tests): kept BY-name extraction
// + gate map, strip-tags markup diff, save_dc seam e2e, distinct bytes per
// spellcasting template (#645-#652). Counter-render text folded into the two
// cast e2es (template counter class already owned by MA-0500 :628 / #275).
// Vacuous drops: not.toContain/toBeUndefined subsumed by full toEqual, DC
// arithmetic restatement (#652 precedent). Dead mocks purged by empirical bisect
// (9 green, no import-time throw): diceRoller (dead probe #649/#651/#652 —
// cast lanes roll through mocked useLoggedDiceRoll), damageUtils,
// rangeValidation, mapsService, abilityLookup (stub outputs never reach the
// asserted advisory/gate lanes). LIVE: conditionEffects (MonsterCardBody :36
// useMemo), useLoggedDiceRoll, dataLoader (render suspends until resolved).
// render suspends until loadSpells resolves). Vacuous-arith restatement dropped
// (#652 precedent): DC 16 = 8 + CHA + PB — row DC pins kept.
// MA-0552 data lock: Dao Spellcasting rode the MA-0421/MA-0532/MA-0543
// twin markup-gap template. Pre-fix ONLY the tier headers carried <strong>;
// all ten spell names were plain text — extractSpellNamesFromSpellcasting
// returned [] and extractSpellcastingSpellUses returned {} → SpellCastLinks
// null → zero chips, and the orphaned spell_save_dc 16 never reached
// buildAbilitySaveRollContext (MA-0532 fork). DATA fix: <em> on each spell
// name (headers byte-kept, strip-tags byte-equality) + trailing row-level
// numeric save_dc 16 + save_type "Charisma" pair (MA-0454/MA-0421).
// At Will tier ungated by design; 1/Day Each rides monsterSpellUses.
// Tongues and Detect Magic are RAW-standard: Tongues has no dc/damage/area
// → advisory cast log printing row DC; Detect Magic is a zone spell
// (sphere) → advisory (CLA-325).
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { extractSpellNamesFromSpellcasting, extractSpellcastingSpellUses } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const spells5e = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));

const dao = monsters.find(m => m.index === 'dao');
const daoRow = dao.actions.find(a => a.name === 'Spellcasting');
const NAMES = ['Detect Evil and Good', 'Detect Magic', 'Stone Shape', 'Gaseous Form', 'Invisibility', 'Move Earth', 'Passwall', 'Plane Shift', 'Tongues', 'Wall of Stone'];
const ONE_DAY = ['Gaseous Form', 'Invisibility', 'Move Earth', 'Passwall', 'Plane Shift', 'Tongues', 'Wall of Stone'];
const spellObjs = spells5e.filter(s => NAMES.includes(s.name));
const TONGUES = spells5e.find(s => s.name === 'Tongues');
const DETECT_MAGIC = spells5e.find(s => s.name === 'Detect Magic');

const DAO_PLAIN_ORIGINAL = 'The dao casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 16):\nAt Will: Detect Evil and Good, Detect Magic, Stone Shape\n1/Day Each: Gaseous Form, Invisibility, Move Earth, Passwall, Plane Shift, Tongues, Wall of Stone';
const stripTags = (d) => d.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '');

const MONSTER_NAME = 'Dao 1';

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// dataLoader LIVE (#652): render suspends until loadSpells resolves
vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSpells: vi.fn((version) => Promise.resolve(version === '2024' ? [] : spellObjs)),
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
function spellLinks() {
  return Array.from(document.querySelectorAll('.mc-dice-link-spell'));
}

function linkByText(text) {
  return Array.from(document.querySelectorAll('.mc-dice-link')).find(el => el.textContent.includes(text)) || null;
}

function abilityUseEntries(name) {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'ability_use' && e.abilityName === name);
}

function refusals(name) {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'automation blocked' && e.abilityName === name);
}

function renderDao() {
  const m = makeMonster({ name: 'Dao', actions: [daoRow] });
  const creatures = [
    { name: MONSTER_NAME, type: 'npc', monsterType: 'elemental', targetName: 'Bandit', ac: 18, currentHp: 190, maxHp: 190, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: MONSTER_NAME, creatures })} />);
}

// ── Data lock: dao Spellcasting row ──────────────────────────────────────────

describe('MA-0552 monsters.json data lock: Dao Spellcasting row', () => {
  it('BY-name extraction: ten chips (tier headers skipped); 1/Day Each binds exactly the seven marked names, At Will ungated', () => {
    expect(extractSpellNamesFromSpellcasting(daoRow.description)).toEqual(NAMES);
    expect(extractSpellcastingSpellUses(daoRow.description)).toEqual(Object.fromEntries(ONE_DAY.map(n => [n, 1])));
  });

  it('row-level numeric save_dc 16 + save_type Charisma pair authored (trailing)', () => {
    expect(daoRow.save_dc).toBe(16);
    expect(daoRow.save_type).toBe('Charisma');
    expect(daoRow.spell_save_dc).toBe(16);
    expect(daoRow.spellcasting_ability).toBe('Charisma');
    expect(daoRow.description).toMatch(/spell save DC 16/);
  });

  it('markup-only diff proof: stripped text equals the pre-fix description byte-for-byte', () => {
    expect(stripTags(daoRow.description)).toBe(DAO_PLAIN_ORIGINAL);
  });

  it('all ten names are RAW-standard 5e spells; Tongues/Detect Magic are advisory (no row damage)', () => {
    expect(spellObjs.length).toBe(10);
    expect(TONGUES.damage ?? null).toBeNull();
    expect(TONGUES.dc ?? null).toBeNull();
    expect(DETECT_MAGIC.area_of_effect).toEqual(expect.objectContaining({ type: 'sphere' }));
  });
});

// ── Modal: ten chips, counters, gates ────────────────────────────────────────

describe('MA-0552 MonsterCardModal Dao Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders ten spell chips — the zero-chip inert row is gone', () => {
    renderDao();
    const names = spellLinks().map(el => el.textContent.split('(')[0].trim());
    expect(names).toEqual(NAMES);
  });

  it('At Will Detect Magic casts ungated twice — no counter, zero uses, advisory log prints row DC 16 Charisma', async () => {
    renderDao();
    expect(linkByText('Detect Magic').textContent).not.toMatch(/\/Day/);
    await act(async () => { fireEvent.click(linkByText('Detect Magic')); });
    await waitFor(() => expect(abilityUseEntries('Detect Magic').length).toBe(1));
    expect(abilityUseEntries('Detect Magic')[0].description).toMatch(/\(spell save DC 16, Charisma\)/);
    await act(async () => { fireEvent.click(linkByText('Detect Magic')); });
    await waitFor(() => expect(abilityUseEntries('Detect Magic').length).toBe(2));
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
  });

  it('Tongues 1/Day: counter shown; first cast spends, second refused — RAW 1/Day Each gate', async () => {
    renderDao();
    expect(linkByText('Tongues').textContent).toMatch(/\(1\/Day · 1 left\)/);
    await act(async () => { fireEvent.click(linkByText('Tongues')); });
    await waitFor(() => expect(abilityUseEntries('Tongues').length).toBe(1));
    expect(abilityUseEntries('Tongues')[0].description).toMatch(/casts Tongues via Spellcasting \(spell save DC 16, Charisma\)/);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ Tongues: 1 });

    await act(async () => { fireEvent.click(linkByText('Tongues')); });
    await waitFor(() => expect(refusals('Tongues').length).toBe(1));
    expect(abilityUseEntries('Tongues').length).toBe(1);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ Tongues: 1 });
  });
});
