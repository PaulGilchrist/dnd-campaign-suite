// MA-1958 data lock: Orcus Spellcasting rode the MA-0421/MA-1879 twin
// markup-gap template. Pre-fix the WHOLE description was plain text —
// extractSpellNamesFromSpellcasting returned [] and extractSpellcastingSpellUses
// {} → SpellCastLinks null → ZERO .mc-dice-link-spell chips on the row, no
// spell on the card castable, and the 3/Day + 1/Day usage lane dead-by-
// construction (extractSpellcastingSpellUses binds MARKED names only,
// §144/§251); the row-level save_dc 23 was XOR-unreachable behind the row-
// NAME fork (MonsterAction.jsx renders SpellCastLinks, never ActionSaveRoll,
// for rows named "Spellcasting" — MA-0532/§118). DATA fix, markup-only:
// house-style <strong>Tier:</strong> <em>Spell</em> INLINE (originally-inline
// prose, no <br> — demogorgon MA-1879 byte-shape twin, same DC 23 tier
// ladder), strip-tags byte-equality pinned. save_dc 23 + save_type "Wisdom"
// pair byte-untouched per ticket scope (§89 pair present; the row-level DC
// rides every chip's cast adjudication via buildMonsterSpellCastLog — the
// §1883-style prose-ability save_type adjudication is a separate axis, not
// this ticket). All three names resolve in BOTH spell indexes with zero
// dc/attack_type → chips are advisory-cast affordances with uses gates
// (§204 lane); DC 23 = 8 + PB 8 + CHA +7 (prose ability Charisma).
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { extractSpellNamesFromSpellcasting, extractSpellcastingSpellUses } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const spells5e = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));
const spells2024 = JSON.parse(readFileSync('public/data/2024/spells.json', 'utf8'));

const orcus = monsters.find(m => m.index === 'orcus');
const orcusRow = orcus.actions.find(a => a.name === 'Spellcasting');

const CHIP_NAMES = ['Detect Magic', 'Dispel Magic', 'Time Stop'];
const AT_WILL = ['Detect Magic'];
const THREE_DAY = ['Dispel Magic'];
const ONE_DAY = ['Time Stop'];
const HEADERS = ['At Will:', '3/Day:', '1/Day:'];

// Pre-fix plain baseline (git HEAD, monsters.json): identical text, names and
// tier headers unmarked.
const PRE_FIX_DESCRIPTION = 'Orcus casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 23): At Will: Detect Magic. 3/Day: Dispel Magic. 1/Day: Time Stop.';
const stripTags = (d) => d.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '');

const MONSTER_NAME = 'Orcus 1';

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
// 5e-exact-first; all three names resolve in BOTH indexes (§158 trap INACTIVE).
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

function renderOrcus() {
  const m = makeMonster({ name: 'Orcus', type: 'fiend', subtype: 'Demon', actions: [orcusRow] });
  const creatures = [
    { name: MONSTER_NAME, type: 'npc', monsterType: 'fiend', targetName: 'Bandit', ac: 17, currentHp: 405, maxHp: 405, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: MONSTER_NAME, creatures })} />);
}

// ── Data lock: Orcus Spellcasting row ─────────────────────────────────────────

describe('MA-1958 monsters.json data lock: Orcus Spellcasting row', () => {
  it('extracts all three spell names as chips — tier headers ending ":" skipped', () => {
    const names = extractSpellNamesFromSpellcasting(orcusRow.description);
    expect(names).toEqual(CHIP_NAMES);
    HEADERS.forEach(h => expect(names).not.toContain(h.replace(/:$/, '')));
  });

  it('usage tokens arm: 3/Day: binds Dispel Magic, 1/Day: binds Time Stop, At Will ungated (§58/§251)', () => {
    expect(extractSpellcastingSpellUses(orcusRow.description)).toEqual({
      'Dispel Magic': 3,
      'Time Stop': 1,
    });
  });

  it('row-level numeric save_dc 23 + save_type "Wisdom" pair byte-untouched (§89 pair present; save_type adjudication is MA-1883-scope, not this ticket)', () => {
    expect(orcusRow.save_dc).toBe(23);
    expect(orcusRow.save_type).toBe('Wisdom');
    expect(orcusRow.description).toMatch(/spell save DC 23/);
    // prose ability is Charisma: DC 23 = 8 + PB 8 + CHA +7
    expect(orcus.proficiency_bonus).toBe(8);
    expect(orcus.ability_score_modifiers.cha).toBe(7);
    expect(8 + orcus.ability_score_modifiers.cha + orcus.proficiency_bonus).toBe(23);
  });

  it('markup-only diff proof: stripped text equals the pre-fix description byte-for-byte', () => {
    expect(stripTags(orcusRow.description)).toBe(PRE_FIX_DESCRIPTION);
  });

  it('house style: tier headers <strong>-wrapped ending ":", spell names <em>-wrapped inline, no <br> (demogorgon MA-1879 twin)', () => {
    expect(orcusRow.description).not.toMatch(/<br>/);
    HEADERS.forEach(h => expect(orcusRow.description).toContain(`<strong>${h}</strong>`));
    CHIP_NAMES.forEach(n => expect(orcusRow.description).toContain(`<em>${n}</em>`));
  });

  it('emphasis census: ONLY the three tier headers + three spell names carry markup — no §161 fake-chip decoys', () => {
    const tokens = (orcusRow.description.match(/<(?:strong|em)>[^<]*<\/(?:strong|em)>/g) || []);
    expect(tokens).toEqual([
      '<strong>At Will:</strong>',
      '<em>Detect Magic</em>',
      '<strong>3/Day:</strong>',
      '<em>Dispel Magic</em>',
      '<strong>1/Day:</strong>',
      '<em>Time Stop</em>',
    ]);
  });

  it('all three spells exist in BOTH 5e and 2024 indexes with zero dc/attack_type — advisory cast lane, no save prompts (§204)', () => {
    CHIP_NAMES.forEach(n => {
      const s = spells5e.find(sp => sp.name === n);
      expect(s).toBeDefined();
      expect(s.dc == null).toBe(true);
      expect(s.attack_type == null).toBe(true);
      expect(spells2024.some(sp => sp.name === n)).toBe(true);
    });
  });

  it('no 2024 monsters.json twin exists — single-file fix scope (§3)', () => {
    expect(() => readFileSync('public/data/2024/monsters.json', 'utf8')).toThrow();
  });
});

// ── Modal: three chips, counters rendered, usage gates live ───────────────────

describe('MA-1958 MonsterCardModal Orcus Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders three spell chips — the zero-chip inert row is gone', () => {
    renderOrcus();
    expect(spellLinks().map(el => el.textContent.split('(')[0].trim())).toEqual(CHIP_NAMES);
    expect(spellLinks().length).toBe(3);
  });

  it('the 3/Day and 1/Day names carry counters; the At Will name does not', () => {
    renderOrcus();
    THREE_DAY.forEach(n => expect(linkByText(n).textContent).toMatch(/\(3\/Day · 3 left\)/));
    ONE_DAY.forEach(n => expect(linkByText(n).textContent).toMatch(/\(1\/Day · 1 left\)/));
    AT_WILL.forEach(n => expect(linkByText(n).textContent).not.toMatch(/\/Day/));
  });

  it('At-Will Detect Magic casts ungated twice — zero uses, advisory log prints row DC 23 (§204)', async () => {
    renderOrcus();
    await act(async () => { fireEvent.click(linkByText('Detect Magic')); });
    await waitFor(() => expect(abilityUseEntries('Detect Magic').length).toBe(1));
    expect(abilityUseEntries('Detect Magic')[0].description).toMatch(/spell save DC 23/);
    await act(async () => { fireEvent.click(linkByText('Detect Magic')); });
    await waitFor(() => expect(abilityUseEntries('Detect Magic').length).toBe(2));
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
  });

  it('Dispel Magic 3/Day gate live (§58): three casts spend 1→2→3, fourth refused zero extra spend', async () => {
    renderOrcus();
    await act(async () => { fireEvent.click(linkByText('Dispel Magic')); });
    await waitFor(() => expect(abilityUseEntries('Dispel Magic').length).toBe(1));
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Dispel Magic': 1 });
    expect(abilityUseEntries('Dispel Magic')[0].description).toMatch(/spell save DC 23/);

    await act(async () => { fireEvent.click(linkByText('Dispel Magic')); });
    await waitFor(() => expect(abilityUseEntries('Dispel Magic').length).toBe(2));
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Dispel Magic': 2 });

    await act(async () => { fireEvent.click(linkByText('Dispel Magic')); });
    await waitFor(() => expect(abilityUseEntries('Dispel Magic').length).toBe(3));
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Dispel Magic': 3 });

    await act(async () => { fireEvent.click(linkByText('Dispel Magic')); });
    await waitFor(() => expect(refusalEntries('Dispel Magic').length).toBe(1));
    expect(abilityUseEntries('Dispel Magic').length).toBe(3);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Dispel Magic': 3 });
  });

  it('Time Stop 1/Day gate live: cast spends the single use, second refused — zero extra spend', async () => {
    renderOrcus();
    await act(async () => { fireEvent.click(linkByText('Time Stop')); });
    await waitFor(() => expect(abilityUseEntries('Time Stop').length).toBe(1));
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Time Stop': 1 });
    expect(abilityUseEntries('Time Stop')[0].description).toMatch(/1\/Day use spent/);

    await act(async () => { fireEvent.click(linkByText('Time Stop')); });
    await waitFor(() => expect(refusalEntries('Time Stop').length).toBe(1));
    expect(abilityUseEntries('Time Stop').length).toBe(1);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Time Stop': 1 });
  });

  it('no save shells on this card — Spellcasting row XOR keeps the row DC unrendered (§676/MA-1294)', () => {
    renderOrcus();
    expect(document.querySelectorAll('.mc-dice-link-save-clickable').length).toBe(0);
  });
});
