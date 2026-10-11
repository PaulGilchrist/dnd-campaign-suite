// MA-1879 data lock: Demogorgon Spellcasting rode the MA-0421/MA-1850 twin
// markup-gap template. Pre-fix the WHOLE description was plain text —
// extractSpellNamesFromSpellcasting returned [] and extractSpellcastingSpellUses
// {} → SpellCastLinks null → ZERO .mc-dice-link-spell chips card-wide, no spell
// on the card castable, and the 3/Day + 1/Day usage lane dead-by-construction
// (extractSpellcastingSpellUses binds MARKED names only, §144/§251). DATA fix,
// markup-only: house-style <strong>Tier:</strong> <em>Spell</em> INLINE
// (originally-inline prose, no <br> — MA-1850 archlich byte-shape), strip-tags
// byte-equality pinned. All SEVEN names resolve in 5e spells.json (every marked
// token is a ":" header or a resolvable name — MA-0599 fake-chip guard N/A,
// emphasis marks resolvable names only). "3/Day:"/"1/Day:" headers arm the
// per-spell uses gates WITHOUT "Each" (optional group, Helpers:440) —
// At-Will names stay ungated by design (§57). save_dc 23 + save_type "Wisdom"
// pair was already authored and stays byte-untouched (§89/§167; row-level DC on
// a Spellcasting row is structurally unrenderable as a DC chip — MA-1294 — the
// DC rides every chip's cast adjudication via buildMonsterSpellCastLog instead).
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { extractSpellNamesFromSpellcasting, extractSpellcastingSpellUses } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const spells5e = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));
const spells2024 = JSON.parse(readFileSync('public/data/2024/spells.json', 'utf8'));

const demogorgon = monsters.find(m => m.index === 'demogorgon');
const demogorgonRow = demogorgon.actions.find(a => a.name === 'Spellcasting');

const CHIP_NAMES = [
  'Detect Magic', 'Major Image',
  'Dispel Magic', 'Fear', 'Telekinesis',
  'Feeblemind', 'Project Image',
];
const AT_WILL = ['Detect Magic', 'Major Image'];
const THREE_DAY = ['Dispel Magic', 'Fear', 'Telekinesis'];
const ONE_DAY = ['Feeblemind', 'Project Image'];
const HEADERS = ['At Will:', '3/Day:', '1/Day:'];

// Pre-fix plain baseline: identical text, names unmarked.
const PRE_FIX_DESCRIPTION = 'The demogorgon casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 23): At Will: Detect Magic, Major Image. 3/Day: Dispel Magic, Fear, Telekinesis. 1/Day: Feeblemind, Project Image.';
const stripTags = (d) => d.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '');

const MONSTER_NAME = 'Demogorgon 1';

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 9, rolls: [2, 4, 3], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 18, rolls: [2, 4, 3, 2, 4, 3], modifier: 0 })),
}));

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// §177: loadSpells mock MUST branch on the ruleset arg — findMonsterSpell is
// 5e-exact-first; all seven names resolve in 5e, Feeblemind has no 2024 twin.
const SPELLS_5E = CHIP_NAMES.map(n => spells5e.find(s => s.name === n));
const SPELLS_2024 = CHIP_NAMES.map(n => spells2024.find(s => s.name === n)).filter(Boolean);

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSpells: vi.fn((ruleset) => Promise.resolve(ruleset === '2024' ? SPELLS_2024 : SPELLS_5E)),
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

function spellLinks() {
  return Array.from(document.querySelectorAll('.mc-dice-link-spell'));
}

function linkByText(text) {
  return Array.from(document.querySelectorAll('.mc-dice-link')).find(el => el.textContent.includes(text)) || null;
}

function abilityUseEntries(name) {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'ability_use' && e.abilityName === name);
}

function refusalEntries(name) {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'automation blocked' && e.abilityName === name);
}

function renderDemogorgon() {
  const m = makeMonster({ name: 'Demogorgon', type: 'fiend', subtype: 'Demon', actions: [demogorgonRow] });
  const creatures = [
    { name: MONSTER_NAME, type: 'npc', monsterType: 'fiend', targetName: 'Bandit', ac: 22, currentHp: 464, maxHp: 464, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: MONSTER_NAME, creatures })} />);
}

// ── Data lock: demogorgon Spellcasting row ───────────────────────────────────

describe('MA-1879 monsters.json data lock: Demogorgon Spellcasting row', () => {
  it('extracts all seven spell names as chips — tier headers ending ":" skipped', () => {
    const names = extractSpellNamesFromSpellcasting(demogorgonRow.description);
    expect(names).toEqual(CHIP_NAMES);
    HEADERS.forEach(h => expect(names).not.toContain(h.replace(/:$/, '')));
  });

  it('usage tokens arm: 3/Day: binds its three names, 1/Day: its two, At Will ungated (§58/§251)', () => {
    expect(extractSpellcastingSpellUses(demogorgonRow.description)).toEqual({
      'Dispel Magic': 3, 'Fear': 3, 'Telekinesis': 3,
      'Feeblemind': 1, 'Project Image': 1,
    });
  });

  it('row-level numeric save_dc 23 + save_type Charisma (§89 pair; MA-1883 fixed the ability)', () => {
    expect(demogorgonRow.save_dc).toBe(23);
    // MA-1883: save_type "Wisdom" contradicted the row's OWN prose ("using
    // Charisma as the spellcasting ability (spell save DC 23)") and the app-
    // wide Spellcasting convention (save_type === prose ability, grep-proven
    // across ~90 monsters). Charisma: DC 23 = 8 + PB 8 + CHA mod +7 (CHA 25);
    // Wisdom would give 8 + 8 + 3 = 19 ≠ 23. DC byte-untouched.
    expect(demogorgonRow.save_type).toBe('Charisma');
    expect(demogorgonRow.description).toMatch(/spell save DC 23/);
  });

  it('markup-only diff proof: stripped text equals the pre-fix description byte-for-byte', () => {
    expect(stripTags(demogorgonRow.description)).toBe(PRE_FIX_DESCRIPTION);
  });

  it('house style: tier headers <strong>-wrapped ending ":", spell names <em>-wrapped inline, no <br>', () => {
    expect(demogorgonRow.description).not.toMatch(/<br>/);
    HEADERS.forEach(h => expect(demogorgonRow.description).toContain(`<strong>${h}</strong>`));
    CHIP_NAMES.forEach(n => expect(demogorgonRow.description).toContain(`<em>${n}</em>`));
  });

  it('no fake chips: every marked token is a ":" header or a resolvable 5e spell name', () => {
    const marked = [...demogorgonRow.description.matchAll(/<(?:strong|em)>([^<]+)<\/(?:strong|em)>/g)].map(m => m[1]);
    marked.forEach(t => {
      const ok = t.endsWith(':') || (CHIP_NAMES.includes(t) && spells5e.some(s => s.name === t));
      expect(ok, `marked token must be header or resolvable spell name: ${t}`).toBe(true);
    });
  });
});

// ── Modal: seven chips, counters rendered, usage gates live ──────────────────

describe('MA-1879 MonsterCardModal Demogorgon Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders seven spell chips — the zero-chip inert row is gone', () => {
    renderDemogorgon();
    expect(spellLinks().map(el => el.textContent.split('(')[0].trim())).toEqual(CHIP_NAMES);
    expect(spellLinks().length).toBe(7);
  });

  it('the three 3/Day and two 1/Day names carry counters; the two At Will names do not', () => {
    renderDemogorgon();
    THREE_DAY.forEach(n => expect(linkByText(n).textContent).toMatch(/\(3\/Day · 3 left\)/));
    ONE_DAY.forEach(n => expect(linkByText(n).textContent).toMatch(/\(1\/Day · 1 left\)/));
    AT_WILL.forEach(n => expect(linkByText(n).textContent).not.toMatch(/\/Day/));
  });

  it('At-Will Detect Magic casts ungated twice — zero uses, log prints row DC 23', async () => {
    renderDemogorgon();
    await act(async () => { fireEvent.click(linkByText('Detect Magic')); });
    await waitFor(() => expect(abilityUseEntries('Detect Magic').length).toBe(1));
    expect(abilityUseEntries('Detect Magic')[0].description).toMatch(/spell save DC 23/);
    await act(async () => { fireEvent.click(linkByText('Detect Magic')); });
    await waitFor(() => expect(abilityUseEntries('Detect Magic').length).toBe(2));
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
  });

  it('Fear 3/Day gate live (§58): three casts spend 1→2→3, fourth refused zero extra spend', async () => {
    renderDemogorgon();
    await act(async () => { fireEvent.click(linkByText('Fear')); });
    await waitFor(() => expect(abilityUseEntries('Fear').length).toBe(1));
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Fear': 1 });
    expect(abilityUseEntries('Fear')[0].description).toMatch(/spell save DC 23/);

    await act(async () => { fireEvent.click(linkByText('Fear')); });
    await waitFor(() => expect(abilityUseEntries('Fear').length).toBe(2));
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Fear': 2 });

    await act(async () => { fireEvent.click(linkByText('Fear')); });
    await waitFor(() => expect(abilityUseEntries('Fear').length).toBe(3));
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Fear': 3 });

    await act(async () => { fireEvent.click(linkByText('Fear')); });
    await waitFor(() => expect(refusalEntries('Fear').length).toBe(1));
    expect(abilityUseEntries('Fear').length).toBe(3);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Fear': 3 });
  });

  it('Feeblemind 1/Day gate live: cast spends the single use, second refused — zero extra spend', async () => {
    renderDemogorgon();
    await act(async () => { fireEvent.click(linkByText('Feeblemind')); });
    await waitFor(() => expect(abilityUseEntries('Feeblemind').length).toBe(1));
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Feeblemind': 1 });

    await act(async () => { fireEvent.click(linkByText('Feeblemind')); });
    await waitFor(() => expect(refusalEntries('Feeblemind').length).toBe(1));
    expect(abilityUseEntries('Feeblemind').length).toBe(1);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Feeblemind': 1 });
  });

  it('Telekinesis 3/Day cast records the row DC 23 on the ability_use lane (DC affordance live)', async () => {
    renderDemogorgon();
    await act(async () => { fireEvent.click(linkByText('Telekinesis')); });
    await waitFor(() => expect(abilityUseEntries('Telekinesis').length).toBe(1));
    expect(abilityUseEntries('Telekinesis')[0].description).toMatch(/spell save DC 23/);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Telekinesis': 1 });
  });
});
