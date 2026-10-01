// MA-1827 data lock: Yuan-ti Malison (Type 1) Spellcasting rode the MA-0421 /
// MA-1742 / MA-1814 / MA-1818 markup-gap family — plain-text spell names (zero
// affordances, row inert) while the save_dc 13 + save_type Wisdom pair sat
// byte-present and header-swallowed (§89/§532 fork). DATA-MARKUP fix mirrors
// the MA-1742 YOCHLOL / MA-1814 ABOMINATION / MA-1818 INFILTRATOR INLINE
// byte-shape: <strong> tier headers + <em> per spell name, "; " tier delimiters
// preserved, NO <br> (original prose was inline — adding <br> breaks stripTags
// byte-equality, §MA-1742 pitfall).
// "At Will:"/"2/Day:" headers end ":" → fake-chip guard skips them
// (MonsterCardHelpers.js:399); "2/Day:" matches the uses-header regex (:440)
// binding Suggestion maxUses 2. 2/Day refusal = monsterSpellUses key +
// "automation blocked" (§57); At Will ungated by design. "(snakes only)"
// advisory paren stays OUTSIDE markup (§158 unresolvable-name guard).
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { extractSpellNamesFromSpellcasting, extractSpellcastingSpellUses } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const allSpells = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));
const spells2024 = JSON.parse(readFileSync('public/data/2024/spells.json', 'utf8'));
const realSpells = (names) => allSpells.filter(s => names.includes(s.name));

const YT_SPELLS = ['Animal Friendship', 'Suggestion'];

// Pre-fix description fingerprint (git HEAD, monsters.json) — the markup-only
// diff proof: strip every tag from the FIXED row and it must equal the
// original prose byte-for-byte.
const YTM1_PLAIN_ORIGINAL = 'The yuan-ti casts one of the following spells, requiring no Material components and using Wisdom as the spellcasting ability (spell save DC 13): At Will: Animal Friendship (snakes only); 2/Day: Suggestion';
const stripTags = (d) => d.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '');

const yuanTi = monsters.find(m => m.index === 'yuan-ti-malison-type-1');
const row = yuanTi.actions.find(a => a.name === 'Spellcasting');
const MONSTER_NAME = 'Yuan-ti Malison (Type 1) 1';

// ── Mocks (mirror MonsterCardModal.ma1818-yuan-ti-infiltrator-spellcasting.test.jsx) ───

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 21, rolls: [4, 5, 6, 6], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 42, rolls: [4, 5, 6, 6, 4, 5, 6, 6], modifier: 0 })),
}));

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSpells: vi.fn((version) => Promise.resolve(version === '2024' ? spells2024 : realSpells(YT_SPELLS))),
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

function refusals() {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'automation blocked');
}

function renderYuanTi() {
  const m = makeMonster({ name: yuanTi.name, actions: [row] });
  const creatures = [
    { name: MONSTER_NAME, type: 'npc', monsterType: 'monstrosity', targetName: 'Bandit 1', currentHp: yuanTi.hit_points, maxHp: yuanTi.hit_points, conditions: [] },
    { name: 'Bandit 1', type: 'npc', currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: MONSTER_NAME, creatures })} />);
}

// ── Data lock ────────────────────────────────────────────────────────────────

describe('MA-1827 monsters.json data lock: Yuan-ti Malison (Type 1) Spellcasting row', () => {
  it('carries <em> markup on each spell name and <strong> tier headers (INLINE yochlol/abomination/infiltrator shape)', () => {
    for (const name of YT_SPELLS) {
      expect(row.description).toContain(`<em>${name}</em>`);
    }
    expect(row.description).toContain('<strong>At Will:</strong>');
    expect(row.description).toContain('<strong>2/Day:</strong>');
    expect(row.description).toContain('<em>Animal Friendship</em> (snakes only)');
  });

  it('keeps the inline shape: no <br> and no newlines (original prose was inline)', () => {
    expect(row.description).not.toContain('<br>');
    expect(row.description).not.toContain('\n');
    expect(row.description).toContain('; ');
  });

  it('extractSpellNamesFromSpellcasting returns both spell names (was [] zero chips)', () => {
    expect(extractSpellNamesFromSpellcasting(row.description)).toEqual(YT_SPELLS);
  });

  it('extractSpellcastingSpellUses binds the 2/Day gate to Suggestion only', () => {
    expect(extractSpellcastingSpellUses(row.description)).toEqual({ Suggestion: 2 });
  });

  it('carries save_dc 13 + save_type Wisdom (8 + WIS + PB) — numeric pair was already byte-present', () => {
    expect(row.save_dc).toBe(13);
    expect(row.save_type).toBe('Wisdom');
    expect(8 + yuanTi.ability_score_modifiers.wis + yuanTi.proficiency_bonus).toBe(13);
  });

  it('both spells resolve in 5e and 2024 spell data (no fake chips)', () => {
    for (const name of YT_SPELLS) {
      expect(allSpells.some(s => s.name === name)).toBe(true);
      expect(spells2024.some(s => s.name === name)).toBe(true);
    }
  });

  it('markup-only diff proof: stripped text equals the pre-fix description byte-for-byte', () => {
    expect(stripTags(row.description)).toBe(YTM1_PLAIN_ORIGINAL);
  });

  it('siblings untouched: four actions, plain-text only outside the Spellcasting row', () => {
    expect(yuanTi.actions.map(a => a.name)).toEqual(['Multiattack', 'Bite', 'Poison Ray', 'Spellcasting']);
    for (const a of yuanTi.actions.filter(x => x.name !== 'Spellcasting')) {
      expect(a.description).not.toContain('<strong>');
      expect(a.description).not.toContain('<em>');
    }
  });
});

// ── Modal: chips + cast routing ──────────────────────────────────────────────

describe('MA-1827 MonsterCardModal Yuan-ti Malison (Type 1) Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders two clickable spell chips (was zero affordances)', () => {
    renderYuanTi();
    expect(stripTags(row.description)).toBe(YTM1_PLAIN_ORIGINAL);
    const names = spellLinks().map(el => el.textContent.split('(')[0].trim());
    expect(names.sort()).toEqual([...YT_SPELLS].sort());
  });

  it('Suggestion carries the 2/Day counter, the At Will chip does not', () => {
    renderYuanTi();
    expect(linkByText('Suggestion').textContent).toMatch(/\(2\/Day · 2 left\)/);
    expect(linkByText('Animal Friendship').textContent).not.toMatch(/\/Day/);
  });

  it('At Will Animal Friendship routes its WIS DC 13 save without any uses spend or refusal', async () => {
    renderYuanTi();
    await act(async () => { fireEvent.click(linkByText('Animal Friendship')); });

    const saveCalls = rollSavingThrow.mock.calls.filter(c => String(c[2]?.spellName) === 'Animal Friendship');
    expect(saveCalls.length).toBe(1);
    expect(saveCalls[0][2].saveDc).toBe(13);
    expect(saveCalls[0][2].saveType).toBe('WIS');
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
    expect(refusals().length).toBe(0);
  });

  it('Suggestion spends 2→0 over two casts (ability_use rides each), refuses the 3rd zero-spend', async () => {
    renderYuanTi();
    for (let i = 0; i < 2; i++) {
      await act(async () => { fireEvent.click(linkByText('Suggestion')); });
    }

    await waitFor(() => expect(abilityUseEntries('Suggestion').length).toBe(2));
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ Suggestion: 2 });
    expect(abilityUseEntries('Suggestion')[0].description).toMatch(/Yuan-ti Malison \(Type 1\) 1 casts Suggestion via Spellcasting/);
    expect(abilityUseEntries('Suggestion')[0].description).toMatch(/spell save DC 13, WIS/);

    await act(async () => { fireEvent.click(linkByText('Suggestion')); });
    expect(abilityUseEntries('Suggestion').length).toBe(2);
    const refusal = refusals().find(e => e.abilityName === 'Suggestion');
    expect(refusal).toBeTruthy();
    expect(refusal.description).toMatch(/already cast Suggestion today \(2\/Day\)/);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ Suggestion: 2 });
  });
});
