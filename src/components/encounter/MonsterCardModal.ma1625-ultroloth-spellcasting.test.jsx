// MA-1625 data lock: Ultroloth Spellcasting (actions[3]) rode the
// MA-0421/MA-1230/MA-1478/MA-1543/MA-1591 markup-gap family — the WHOLE
// description was plain text on a SINGLE line with "; " tier separators:
// names AND both tier headers unmarked → extractSpellNamesFromSpellcasting
// [] → SpellCastLinks null → zero chips, zero cast affordance; the 1/Day-EACH
// tracking was structurally dead (§144 binds MARKED headers + names only)
// while sibling rows (Multiattack/Mercurial Whip/Hypnotic Gaze) offered no
// alternative cast lane. Row-level numeric save_dc 17 + Intelligence pair was
// ALREADY authored (§89 gate pre-met; §676/MA-1294 XOR fork keeps the row DC
// unrendered as a chip on Spellcasting rows — expected, not a fail axis).
// DATA fix = djinni MA-0611 byte-shape <strong> wrap on the two tier headers
// + all six names, separators ("; " / ", ") byte-kept (single-line prose, no
// <br>/\n — strip-tags byte-equality proves markup-only diff, matching the
// committed MA-1478 solar byte-shape); "(level 5 version)" stays OUTSIDE the
// <strong> so the harvested "Fireball" resolves vs spells.json (night-hag
// MA-1230 precedent). Headers end ":" → skipped by the extractor (§648
// trailing-':' exclusion), so no §161 fake chips. Ticket §679 residual is
// OBSOLETE for Fireball: spellCastLevelFromSpellcasting parses "(level 5
// version)" off the Spellcasting row and damage_at_slot_level carries a slot
// schema, so the live cast rides the level-5 "10d6" entry (pinned below).
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { extractSpellNamesFromSpellcasting, extractSpellcastingSpellUses } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const spells5e = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));
const spells2024 = JSON.parse(readFileSync('public/data/2024/spells.json', 'utf8'));

const ultroloth = monsters.find(m => m.index === 'ultroloth');
const ulRow = ultroloth.actions.find(a => a.name === 'Spellcasting');
const NAMES = ['Alter Self', 'Clairvoyance', 'Detect Magic', 'Dimension Door', 'Fireball', 'Wall of Fire'];
const ONE_DAY = ['Dimension Door', 'Fireball', 'Wall of Fire'];
const AT_WILL = ['Alter Self', 'Clairvoyance', 'Detect Magic'];

const UL_PLAIN_ORIGINAL = 'The ultroloth casts one of the following spells, requiring no Material components and using Intelligence as the spellcasting ability (spell save DC 17): At Will: Alter Self, Clairvoyance, Detect Magic; 1/Day Each: Dimension Door, Fireball (level 5 version), Wall of Fire';
const UL_FIXED_BYTES = 'The ultroloth casts one of the following spells, requiring no Material components and using Intelligence as the spellcasting ability (spell save DC 17): <strong>At Will:</strong> <strong>Alter Self</strong>, <strong>Clairvoyance</strong>, <strong>Detect Magic</strong>; <strong>1/Day Each:</strong> <strong>Dimension Door</strong>, <strong>Fireball</strong> (level 5 version), <strong>Wall of Fire</strong>';
const stripTags = (d) => d.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '');

const FIREBALL = spells5e.find(s => s.name === 'Fireball');
const WALL_OF_FIRE = spells5e.find(s => s.name === 'Wall of Fire');
const SPELLS_5E = spells5e.filter(s => NAMES.includes(s.name));
const SPELLS_2024 = spells2024.filter(s => NAMES.includes(s.name));

const MONSTER_NAME = 'Ultroloth 1';

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
  // §177 ruleset-branch pitfall: findMonsterSpell is 5e-first, falling back
  // to loadSpells('2024') — both branches serve the six names here (§158).
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

import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import { addEntry } from '../../services/ui/logService.js';

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

function refusals(name) {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'automation blocked' && e.abilityName === name);
}

function renderUltroloth() {
  const m = makeMonster({ name: 'Ultroloth', index: 'ultroloth', type: 'fiend', actions: [ulRow] });
  const creatures = [
    { name: MONSTER_NAME, type: 'npc', monsterType: 'fiend', targetName: 'Bandit', ac: 17, currentHp: 221, maxHp: 221, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: MONSTER_NAME, creatures })} />);
}

// ── Data lock: ultroloth Spellcasting row ────────────────────────────────────

describe('MA-1625 monsters.json data lock: Ultroloth Spellcasting row', () => {
  it('extracts all six spell names as chips — tier headers skipped', () => {
    const names = extractSpellNamesFromSpellcasting(ulRow.description);
    expect(names).toEqual(NAMES);
    expect(names).not.toContain('At Will');
    expect(names).not.toContain('1/Day Each');
    expect(names).not.toContain('Fireball (level 5 version)');
  });

  it('binds 1/Day Each to exactly the three marked names; At Will trio ungated (§57/§144)', () => {
    const uses = extractSpellcastingSpellUses(ulRow.description);
    expect(uses).toEqual(Object.fromEntries(ONE_DAY.map(n => [n, 1])));
    AT_WILL.forEach(n => expect(uses[n]).toBeUndefined());
  });

  it('fixed description is byte-exact house style (djinni MA-0611 / solar MA-1478 shape)', () => {
    expect(ulRow.description).toBe(UL_FIXED_BYTES);
    expect(ulRow.description).toMatch(/<strong>At Will:<\/strong> <strong>Alter Self<\/strong>, <strong>Clairvoyance<\/strong>, <strong>Detect Magic<\/strong>; <strong>1\/Day Each:<\/strong>/);
    expect(ulRow.description).toMatch(/<strong>Fireball<\/strong> \(level 5 version\), <strong>Wall of Fire<\/strong>/);
  });

  it('no fake chips: §161 — only the six names + trailing-":" headers are emphasis spans', () => {
    const spans = [...ulRow.description.matchAll(/<(?:strong|em)>([^<]+)<\/(?:strong|em)>/g)].map(m => m[1]);
    expect(spans).toEqual(['At Will:', ...AT_WILL, '1/Day Each:', ...ONE_DAY]);
    expect(ulRow.description).not.toMatch(/<(?:strong|em)>[^<]*level 5 version[^<]*<\/(?:strong|em)>/);
  });

  it('markup-only diff proof: stripped text equals the pre-fix description byte-for-byte (§89)', () => {
    expect(stripTags(ulRow.description)).toBe(UL_PLAIN_ORIGINAL);
  });

  it('row-level numeric save_dc 17 + save_type Intelligence pair kept byte-untouched (§89)', () => {
    expect(ulRow.save_dc).toBe(17);
    expect(ulRow.save_type).toBe('Intelligence');
    expect(ulRow.spell_save_dc).toBeUndefined();
    expect(ulRow.attack_bonus).toBeUndefined();
    expect(ulRow.automation).toBeUndefined();
    expect(ulRow.save_effect).toMatch(/spell save DC 17/);
  });

  it('DC 17 = 8 + INT +4 + PB +5 for the ultroloth', () => {
    expect(ultroloth.ability_score_modifiers.int).toBe(4);
    expect(ultroloth.proficiency_bonus).toBe(5);
    expect(8 + ultroloth.ability_score_modifiers.int + ultroloth.proficiency_bonus).toBe(17);
  });

  it('all six names resolvable in BOTH spell DBs (§158 trap INACTIVE); Fireball rides base 8d6 (§679 residual)', () => {
    NAMES.forEach(n => {
      expect(spells5e.some(s => s.name === n)).toBe(true);
      expect(spells2024.some(s => s.name === n)).toBe(true);
    });
    expect(FIREBALL.damage.damage_at_slot_level['3']).toBe('8d6');
    expect(FIREBALL.damage.damage_at_slot_level['5']).toBe('10d6');
    expect(FIREBALL.dc).toEqual({ dc_type: 'DEX', dc_success: 'half' });
    expect(WALL_OF_FIRE.dc).toEqual({ dc_type: 'DEX', dc_success: 'half' });
  });
});

// ── Modal: six chips, counters, gates ────────────────────────────────────────

describe('MA-1625 MonsterCardModal Ultroloth Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    runtime.setRuntimeValue.mockImplementation((characterKey, propertyName, value) => { runtime.store[`${characterKey}.${propertyName}`] = value; return Promise.resolve(); });
    runtime.getRuntimeValue.mockImplementation((characterKey, propertyName) => runtime.store[`${characterKey}.${propertyName}`] ?? null);
    runtime.useRuntimeValue.mockImplementation((characterKey, propertyName) => runtime.store[`${characterKey}.${propertyName}`] ?? null);
  });

  it('renders six spell chips — the zero-chip inert row is gone', () => {
    renderUltroloth();
    expect(spellLinks().map(el => el.textContent.split('(')[0].trim())).toEqual(NAMES);
  });

  it('the three 1/Day names carry counters; the At Will trio does not', () => {
    renderUltroloth();
    ONE_DAY.forEach(n => expect(linkByText(n).textContent).toMatch(/\(1\/Day · 1 left\)/));
    AT_WILL.forEach(n => expect(linkByText(n).textContent).not.toMatch(/\/Day/));
  });

  it('At Will Detect Magic casts ungated twice — zero uses, advisory log prints row DC 17 Intelligence', async () => {
    renderUltroloth();
    await act(async () => { fireEvent.click(linkByText('Detect Magic')); });
    await waitFor(() => expect(abilityUseEntries('Detect Magic').length).toBe(1));
    expect(abilityUseEntries('Detect Magic')[0].description).toMatch(/\(spell save DC 17, Intelligence\)/);
    await act(async () => { fireEvent.click(linkByText('Detect Magic')); });
    await waitFor(() => expect(abilityUseEntries('Detect Magic').length).toBe(2));
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
    expect(refusals('Detect Magic').length).toBe(0);
  });

  it('Fireball rides the save seam at row DC 17 — DEX half; "(level 5 version)" parses via spellCastLevelFromSpellcasting → 10d6 (ticket §679 residual OBSOLETE — slot-level schema resolves)', async () => {
    renderUltroloth();
    await act(async () => { fireEvent.click(linkByText('Fireball')); });
    await waitFor(() => expect(rollSavingThrow).toHaveBeenCalledTimes(1));
    const context = rollSavingThrow.mock.calls[0][2];
    expect(context.saveType).toBe('DEX');
    expect(context.saveDc).toBe(17);
    expect(context.dcSuccess).toBe('half');
    expect(context.autoDamageFormula).toBe('10d6');
    expect(context.autoDamageDamageType).toBe('Fire');
    expect(context.spellName).toBe('Fireball');
    await waitFor(() => expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ Fireball: 1 }));
    const spend = abilityUseEntries('Fireball').find(e => String(e.description).includes('1/Day use spent — 0 remaining today'));
    expect(spend).toBeTruthy();
    await act(async () => { fireEvent.click(linkByText('Fireball')); });
    await waitFor(() => expect(refusals('Fireball').length).toBe(1));
    expect(rollSavingThrow).toHaveBeenCalledTimes(1);
    expect(abilityUseEntries('Fireball').length).toBe(1);
  });

  it('exhausted 1/Day Wall of Fire re-click refused — zero extra spend (§57/§1339)', async () => {
    renderUltroloth();
    await act(async () => { fireEvent.click(linkByText('Wall of Fire')); });
    await waitFor(() => expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Wall of Fire': 1 }));
    await act(async () => { fireEvent.click(linkByText('Wall of Fire')); });
    await waitFor(() => expect(refusals('Wall of Fire').length).toBe(1));
    expect(refusals('Wall of Fire')[0].description).toMatch(/already cast Wall of Fire today \(1\/Day\)/);
    expect(abilityUseEntries('Wall of Fire').length).toBe(1);
  });

  it('Dimension Door spends its own independent 1/Day counter', async () => {
    renderUltroloth();
    await act(async () => { fireEvent.click(linkByText('Dimension Door')); });
    await waitFor(() => expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Dimension Door': 1 }));
    await act(async () => { fireEvent.click(linkByText('Dimension Door')); });
    await waitFor(() => expect(refusals('Dimension Door').length).toBe(1));
    expect(abilityUseEntries('Dimension Door').length).toBe(1);
  });
});
