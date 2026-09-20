// MA-0576 data lock: Death Slaad Spellcasting rode the MA-0421/MA-0524/
// MA-0532/MA-0552/MA-0558/MA-0564/MA-0572 twin markup-gap template. Pre-fix
// ONLY the tier headers carried <strong>; Detect Magic/Detect Thoughts/
// Invisibility/Mage Hand/Major Image/Blight/Cloudkill/Fly/Plane Shift/Tongues
// were plain text — extractSpellNamesFromSpellcasting returned [] and
// extractSpellcastingSpellUses returned {} → SpellCastLinks null → zero
// chips, and the orphaned spell_save_dc 16 never reached
// buildAbilitySaveRollContext (MA-0532 fork). DATA fix: <em> on each spell
// name (headers byte-kept, "(self only)"/"(level N version)" parentheticals
// OUTSIDE the tag, strip-tags byte-equality) + trailing row-level numeric
// save_dc 16 + save_type "Charisma" pair (MA-0454/MA-0421).
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { extractSpellNamesFromSpellcasting, extractSpellcastingSpellUses, spellCastLevelFromSpellcasting, spellDamageFormulaAtLevel } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const spells5e = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));

const slaad = monsters.find(m => m.index === 'death-slaad');
const slaadRow = slaad.actions.find(a => a.name === 'Spellcasting');
const NAMES = ['Detect Magic', 'Detect Thoughts', 'Invisibility', 'Mage Hand', 'Major Image', 'Blight', 'Cloudkill', 'Fly', 'Plane Shift', 'Tongues'];
const ONE_DAY = ['Blight', 'Cloudkill', 'Fly', 'Plane Shift', 'Tongues'];
const AT_WILL = ['Detect Magic', 'Detect Thoughts', 'Invisibility', 'Mage Hand', 'Major Image'];
const SPELLS = Object.fromEntries(NAMES.map(n => [n, spells5e.find(s => s.name === n)]));

const SLAAD_PLAIN_ORIGINAL = 'The slaad casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 16):\nAt Will: Detect Magic, Detect Thoughts, Invisibility (self only), Mage Hand, Major Image\n1/Day Each: Blight (level 8 version), Cloudkill (level 6 version), Fly, Plane Shift, Tongues';
const stripTags = (d) => d.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '');

const MONSTER_NAME = 'Death Slaad 1';

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
  loadSpells: vi.fn(() => Promise.resolve(NAMES.map(n => SPELLS[n]))),
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

function refusals(name) {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'automation blocked' && e.abilityName === name);
}

function renderDeathSlaad() {
  const m = makeMonster({ name: 'Death Slaad', actions: [slaadRow] });
  const creatures = [
    { name: MONSTER_NAME, type: 'npc', monsterType: 'aberration', targetName: 'Bandit', ac: 18, currentHp: 178, maxHp: 178, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: MONSTER_NAME, creatures })} />);
}

// ── Data lock: death-slaad Spellcasting row ──────────────────────────────────

describe('MA-0576 monsters.json data lock: Death Slaad Spellcasting row', () => {
  it('extracts all ten spell names as chips — tier headers skipped', () => {
    const names = extractSpellNamesFromSpellcasting(slaadRow.description);
    expect(names).toEqual(NAMES);
    expect(names).not.toContain('At Will');
    expect(names).not.toContain('1/Day Each');
  });

  it('binds 1/Day Each to exactly the five marked names; the five At Will names ungated', () => {
    const uses = extractSpellcastingSpellUses(slaadRow.description);
    expect(uses).toEqual(Object.fromEntries(ONE_DAY.map(n => [n, 1])));
    AT_WILL.forEach(n => expect(uses[n]).toBeUndefined());
  });

  it('row-level numeric save_dc 16 + save_type Charisma pair authored (trailing)', () => {
    expect(slaadRow.save_dc).toBe(16);
    expect(slaadRow.save_type).toBe('Charisma');
    expect(slaadRow.spell_save_dc).toBe(16);
    expect(slaadRow.spellcasting_ability).toBe('Charisma');
    expect(slaadRow.description).toMatch(/spell save DC 16/);
    expect(slaadRow.description).toMatch(/<em>Invisibility<\/em> \(self only\)/);
    expect(slaadRow.description).toMatch(/<em>Blight<\/em> \(level 8 version\)/);
    expect(slaadRow.description).toMatch(/<em>Cloudkill<\/em> \(level 6 version\)/);
  });

  it('DC 16 = 8 + CHA +4 + PB +4 for the death slaad', () => {
    expect(slaad.ability_score_modifiers.cha).toBe(4);
    expect(slaad.proficiency_bonus).toBe(4);
    expect(8 + slaad.ability_score_modifiers.cha + slaad.proficiency_bonus).toBe(16);
  });

  it('markup-only diff proof: stripped text equals the pre-fix description byte-for-byte', () => {
    expect(stripTags(slaadRow.description)).toBe(SLAAD_PLAIN_ORIGINAL);
  });

  it('all ten spells exist in 5e spells.json; upcast pins Blight lv8 12d8, Cloudkill lv6 6d8', () => {
    NAMES.forEach(n => expect(spells5e.some(s => s.name === n)).toBe(true));
    const blight = SPELLS.Blight;
    const cloudkill = SPELLS.Cloudkill;
    expect(blight.level).toBe(4);
    expect(blight.damage.damage_at_slot_level['8']).toBe('12d8');
    expect(blight.dc).toEqual(expect.objectContaining({ dc_type: 'CON', dc_success: 'half' }));
    expect(cloudkill.level).toBe(5);
    expect(cloudkill.damage.damage_at_slot_level['6']).toBe('6d8');
    expect(cloudkill.dc).toEqual(expect.objectContaining({ dc_type: 'CON', dc_success: 'half' }));
    expect(spellCastLevelFromSpellcasting(slaadRow.description, 'Blight', blight)).toBe(8);
    expect(spellDamageFormulaAtLevel(blight, 8)).toBe('12d8');
    expect(spellCastLevelFromSpellcasting(slaadRow.description, 'Cloudkill', cloudkill)).toBe(6);
    expect(spellDamageFormulaAtLevel(cloudkill, 6)).toBe('6d8');
  });
});

// ── Modal: ten chips, counters, gates ────────────────────────────────────────

describe('MA-0576 MonsterCardModal Death Slaad Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders ten spell chips — the zero-chip inert row is gone', () => {
    renderDeathSlaad();
    expect(spellLinks().map(el => el.textContent.split('(')[0].trim())).toEqual(NAMES);
  });

  it('five 1/Day names carry counters; the five At Will names do not', () => {
    renderDeathSlaad();
    ONE_DAY.forEach(n => expect(linkByText(n).textContent).toMatch(/\(1\/Day · 1 left\)/));
    AT_WILL.forEach(n => expect(linkByText(n).textContent).not.toMatch(/\/Day/));
  });

  it('At Will Detect Magic casts ungated twice — zero uses, advisory log prints row DC 16', async () => {
    renderDeathSlaad();
    await act(async () => { fireEvent.click(linkByText('Detect Magic')); });
    await waitFor(() => expect(abilityUseEntries('Detect Magic').length).toBe(1));
    expect(abilityUseEntries('Detect Magic')[0].description).toMatch(/\(spell save DC 16/);
    await act(async () => { fireEvent.click(linkByText('Detect Magic')); });
    await waitFor(() => expect(abilityUseEntries('Detect Magic').length).toBe(2));
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
  });

  it('Fly 1/Day: cast spends the single use, second refused — zero extra spend', async () => {
    renderDeathSlaad();
    await act(async () => { fireEvent.click(linkByText('Fly')); });
    await waitFor(() => expect(abilityUseEntries('Fly').length).toBe(1));
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Fly': 1 });
    expect(abilityUseEntries('Fly')[0].description).toMatch(/1\/Day use spent/);

    await act(async () => { fireEvent.click(linkByText('Fly')); });
    await waitFor(() => expect(refusals('Fly').length).toBe(1));
    expect(abilityUseEntries('Fly').length).toBe(1);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Fly': 1 });
  });

  it('Blight level-8 save leg: 12d8 CON half at row DC 16 — spends 1/Day, second refused', async () => {
    renderDeathSlaad();
    await act(async () => { fireEvent.click(linkByText('Blight')); });
    await waitFor(() => expect(rollSavingThrow).toHaveBeenCalled());
    const opts = rollSavingThrow.mock.calls[0][2];
    expect(opts.spellName).toBe('Blight');
    expect(opts.saveType).toBe('CON');
    expect(opts.dcSuccess).toBe('half');
    expect(opts.saveDc).toBe(16);
    expect(opts.autoDamageFormula).toBe('12d8');
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Blight': 1 });
    expect(abilityUseEntries('Blight')[0].description).toMatch(/1\/Day use spent/);

    await act(async () => { fireEvent.click(linkByText('Blight')); });
    await waitFor(() => expect(refusals('Blight').length).toBe(1));
    expect(abilityUseEntries('Blight').length).toBe(1);
    expect(rollSavingThrow.mock.calls.length).toBe(1);
  });
});
