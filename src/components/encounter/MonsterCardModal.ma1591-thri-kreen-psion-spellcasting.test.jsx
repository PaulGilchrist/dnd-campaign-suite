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
// mock). Storm Giant MA-1543 row byte-locked below; cloud-giant sibling intact.
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
const ONE_DAY = ['Detect Thoughts', 'Sending', 'Synaptic Static'];
const AT_WILL = ['Mage Hand'];

const TK_PLAIN_ORIGINAL = 'The thri-kreen casts one of the following spells, requiring no spell components and using Intelligence as the spellcasting ability (spell save DC 15): At Will: Mage Hand (the hand is Invisible); 1/Day Each: Detect Thoughts, Sending, Synaptic Static';
const TK_FIXED_BYTES = 'The thri-kreen casts one of the following spells, requiring no spell components and using Intelligence as the spellcasting ability (spell save DC 15):\n<strong>At Will:</strong> <em>Mage Hand</em> (the hand is Invisible)\n<strong>1/Day Each:</strong> <em>Detect Thoughts</em>, <em>Sending</em>, <em>Synaptic Static</em>';
const stripTags = (d) => d.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '');
// The pre-fix row was ONE ";"-delimited line; the fix moved tiers onto "\n"
// lines with <strong>/<em> — content equality is proven after tag-strip +
// whitespace collapse (the exact fixed bytes are pinned separately above).
const collapse = (d) => stripTags(d).replace(/\s+/g, ' ').trim();

// MA-1543 twin + lead-in siblings (§1112: lead-in ×2 file-wide, DC discriminates).
const storm = monsters.find(m => m.index === 'storm-giant');
const stormRow = storm.actions.find(a => a.name === 'Spellcasting');
const SG_FIXED_BYTES = 'The giant casts one of the following spells, requiring no Material components and using Wisdom as the spellcasting ability (spell save DC 18):\n<strong>At Will:</strong> <em>Detect Magic</em>, <em>Light</em>\n<strong>1/Day:</strong> <em>Control Weather</em>';
const cloud = monsters.find(m => m.index === 'cloud-giant');
const cloudRow = cloud.actions.find(a => a.name === 'Spellcasting');

// 5e-first lookup fixtures (§177: mock MUST branch on ruleset arg).
const SPELLS_5E = spells5e.filter(s => ['Mage Hand', 'Detect Thoughts', 'Sending'].includes(s.name));
const SPELLS_2024 = spells2024.filter(s => NAMES.includes(s.name));
const SYNAPTIC = spells2024.find(s => s.name === 'Synaptic Static');
const DT_5E = spells5e.find(s => s.name === 'Detect Thoughts');

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

function renderPsion() {
  const m = makeMonster({ name: 'Thri-kreen Psion', actions: [tkRow] });
  const creatures = [
    { name: MONSTER_NAME, type: 'npc', monsterType: 'monstrosity', targetName: 'Bandit', ac: 13, currentHp: 149, maxHp: 149, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: MONSTER_NAME, creatures })} />);
}

// ── Data lock: thri-kreen-psion Spellcasting row ────────────────────────────

describe('MA-1591 monsters.json data lock: Thri-kreen Psion Spellcasting row', () => {
  it('extracts the four spell names live — tier headers and parenthetical skipped', () => {
    const names = extractSpellNamesFromSpellcasting(tkRow.description);
    expect(names).toEqual(NAMES);
    expect(names).not.toContain('At Will');
    expect(names).not.toContain('1/Day Each');
    expect(names).not.toContain('Mage Hand (the hand is Invisible)');
    expect(names.filter(n => AT_WILL.includes(n))).toEqual(['Mage Hand']);
  });

  it('binds 1/Day Each to exactly the three marked names; Mage Hand At Will ungated', () => {
    const uses = extractSpellcastingSpellUses(tkRow.description);
    expect(uses).toEqual(Object.fromEntries(ONE_DAY.map(n => [n, 1])));
    expect(uses['Mage Hand']).toBeUndefined();
  });

  it('fixed description is byte-exact house style (dao/MA-1543 layout)', () => {
    expect(tkRow.description).toBe(TK_FIXED_BYTES);
    expect(tkRow.description).toMatch(/<strong>At Will:<\/strong> <em>Mage Hand<\/em> \(the hand is Invisible\)/);
    expect(tkRow.description).toMatch(/<strong>1\/Day Each:<\/strong> <em>Detect Thoughts<\/em>, <em>Sending<\/em>, <em>Synaptic Static<\/em>/);
  });

  it('markup-only diff proof: stripped+collapsed text equals the pre-fix prose (tier ";" → newline)', () => {
    expect(collapse(tkRow.description)).toBe(collapse(TK_PLAIN_ORIGINAL.replace(/;/g, ' ')));
  });

  it('row-level numeric save_dc 15 + save_type Intelligence pair kept byte-untouched', () => {
    expect(tkRow.save_dc).toBe(15);
    expect(tkRow.save_type).toBe('Intelligence');
    expect(tkRow.spell_save_dc).toBeUndefined();
    expect(tkRow.attack_bonus).toBeUndefined();
    expect(tkRow.automation).toBeUndefined();
  });

  it('DC 15 = 8 + INT +4 + PB +3 for the psion', () => {
    expect(tk.ability_score_modifiers.int).toBe(4);
    expect(tk.proficiency_bonus).toBe(3);
    expect(8 + tk.ability_score_modifiers.int + tk.proficiency_bonus).toBe(15);
  });

  it('storm-giant MA-1543 row byte-locked; cloud-giant lead-in sibling intact', () => {
    expect(stormRow.description).toBe(SG_FIXED_BYTES);
    expect(cloudRow.description).toContain('(spell save DC 15)');
    expect(cloudRow.description).toContain('<strong>1/Day Each:</strong> <em>Control Weather</em>');
    expect(cloudRow.description).not.toMatch(/thri-kreen/i);
  });

  it('Mage Hand/Detect Thoughts/Sending in 5e; Synaptic Static 2024-only (§207 fallback)', () => {
    expect(SPELLS_5E.map(s => s.name)).toEqual(expect.arrayContaining(['Mage Hand', 'Detect Thoughts', 'Sending']));
    expect(spells5e.some(s => s.name === 'Synaptic Static')).toBe(false);
    expect(spells2024.some(s => s.name === 'Synaptic Static')).toBe(true);
    expect(SYNAPTIC.damage.damage_at_slot_level['5']).toBe('8d6');
    expect(SYNAPTIC.dc).toEqual({ dc_type: 'INT', dc_success: 'half' });
    expect(DT_5E.damage ?? null).toBeNull();
    expect(DT_5E.dc ?? null).toBeNull();
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

  it('renders four spell chips — the zero-chip inert row is gone', () => {
    renderPsion();
    const names = spellLinks().map(el => el.textContent.split('(')[0].trim());
    expect(names).toEqual(NAMES);
  });

  it('three 1/Day names carry counters; the At Will name does not', () => {
    renderPsion();
    expect(linkByText('Detect Thoughts').textContent).toMatch(/\(1\/Day · 1 left\)/);
    expect(linkByText('Sending').textContent).toMatch(/\(1\/Day · 1 left\)/);
    expect(linkByText('Synaptic Static').textContent).toMatch(/\(1\/Day · 1 left\)/);
    expect(linkByText('Mage Hand').textContent).not.toMatch(/\/Day/);
  });

  it('At Will Mage Hand casts repeatedly — advisory log prints row DC 15 Intelligence, zero uses', async () => {
    renderPsion();
    await act(async () => { fireEvent.click(linkByText('Mage Hand')); });
    await waitFor(() => expect(abilityUseEntries('Mage Hand').length).toBe(1));
    expect(abilityUseEntries('Mage Hand')[0].description).toMatch(/Thri-kreen Psion 1 casts Mage Hand via Spellcasting \(spell save DC 15, Intelligence\)/);
    await act(async () => { fireEvent.click(linkByText('Mage Hand')); });
    await waitFor(() => expect(abilityUseEntries('Mage Hand').length).toBe(2));
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
    expect(refusals('Mage Hand').length).toBe(0);
  });

  it('Detect Thoughts vs armed Bandit logs a spell-attributed cast (no save in app data — advisory), spends 1/Day', async () => {
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
  });

  it('Synaptic Static resolves via 2024 fallback — INT save DC 15 half, 8d6, spends 1/Day then refuses', async () => {
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
    const spend = abilityUseEntries('Synaptic Static').find(e => String(e.description).includes('1/Day use spent — 0 remaining today'));
    expect(spend).toBeTruthy();
    await act(async () => { fireEvent.click(linkByText('Synaptic Static')); });
    await waitFor(() => expect(refusals('Synaptic Static').length).toBe(1));
    expect(rollSavingThrow).toHaveBeenCalledTimes(1);
  });

  it('Sending spends its own independent 1/Day counter', async () => {
    renderPsion();
    await act(async () => { fireEvent.click(linkByText('Sending')); });
    await waitFor(() => expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ Sending: 1 }));
    await act(async () => { fireEvent.click(linkByText('Sending')); });
    await waitFor(() => expect(refusals('Sending').length).toBe(1));
    expect(abilityUseEntries('Sending').length).toBe(1);
  });
});
