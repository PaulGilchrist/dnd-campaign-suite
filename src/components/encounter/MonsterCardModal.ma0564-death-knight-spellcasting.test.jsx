// @maintained-by-ai
// MA-0564 data lock: Death Knight Spellcasting rode the MA-0421/MA-0532/
// MA-0552 twin markup-gap template. Pre-fix ONLY the tier headers carried
// <strong>; Command/Phantom Steed/Destructive Wave (Necrotic)/Dispel Magic
// were plain text — extractSpellNamesFromSpellcasting returned [] and
// extractSpellcastingSpellUses returned {} → SpellCastLinks null → zero
// chips, and the orphaned spell_save_dc 18 never reached
// buildAbilitySaveRollContext (MA-0532 fork). DATA fix: <em> on each spell
// name (headers byte-kept, "(Necrotic)" parenthetical OUTSIDE the tag,
// strip-tags byte-equality) + trailing row-level numeric save_dc 18 +
// save_type "Charisma" pair (MA-0454/MA-0421).
// DUAL-RULES RESOLUTION: Destructive Wave is 2024-only — findMonsterSpell
// is 5e-first with a 2024 fallback, so this 5e-path monster still resolves
// it without cross-file spell copies (MA-0536 homebrew precedent unused).
// Trimmed per REC #654: exact toEqual maps subsume tier-header/at-Will
// negatives (#653); refusals + repeated at-Will castable owned by
// spellcasting.test.jsx :281/:317; spell-shape null legs owned by
// ma1959-orcus-wand; advisory-log class owned by ma0524:222. Distinct
// bytes kept here: DC 18/15 saveDc seam e2e (:1803), 2/Day-vs-1/Day
// gates, (Necrotic)-outside-tag byte, strip-diffs, merged one-render casts.
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
const NAMES = ['Command', 'Phantom Steed', 'Destructive Wave', 'Dispel Magic'];
const COMMAND = spells5e.find(s => s.name === 'Command');
const PHANTOM_STEED = spells5e.find(s => s.name === 'Phantom Steed');
const DISPEL_MAGIC = spells5e.find(s => s.name === 'Dispel Magic');
const DESTRUCTIVE_WAVE = spells2024.find(s => s.name === 'Destructive Wave');

const DK_PLAIN_ORIGINAL = 'The death knight casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 18):\nAt Will: Command, Phantom Steed\n2/Day Each: Destructive Wave (Necrotic), Dispel Magic';
const stripTags = (d) => d.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '');

const MONSTER_NAME = 'Death Knight 1';

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSpells: vi.fn((version) => Promise.resolve(version === '2024' ? [DESTRUCTIVE_WAVE] : [COMMAND, PHANTOM_STEED, DISPEL_MAGIC])),
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

// ── Data lock: death-knight Spellcasting row ─────────────────────────────────

describe('MA-0564 monsters.json data lock: Death Knight Spellcasting row', () => {
  it('extracts the four spell names BY-name and the exact 2/Day gate map (tier headers and at-Will names absent)', () => {
    expect(extractSpellNamesFromSpellcasting(dkRow.description)).toEqual(NAMES);
    expect(extractSpellcastingSpellUses(dkRow.description)).toEqual({ 'Destructive Wave': 2, 'Dispel Magic': 2 });
  });

  it('row-level numeric save_dc 18 + save_type Charisma pair authored; (Necrotic) parenthetical OUTSIDE the em tag', () => {
    expect(dkRow.save_dc).toBe(18);
    expect(dkRow.save_type).toBe('Charisma');
    expect(dkRow.spell_save_dc).toBe(18);
    expect(dkRow.spellcasting_ability).toBe('Charisma');
    expect(dkRow.description).toMatch(/<em>Destructive Wave<\/em> \(Necrotic\)/);
  });

  it('markup-only diff proof: stripped text equals the pre-fix description byte-for-byte', () => {
    expect(stripTags(dkRow.description)).toBe(DK_PLAIN_ORIGINAL);
  });

  it('Destructive Wave is 2024-only — 5e-first fallback resolves without cross-file spell copies', () => {
    expect(spells5e.some(s => s.name === 'Destructive Wave')).toBe(false);
    expect(spells2024.some(s => s.name === 'Destructive Wave')).toBe(true);
  });
});

// ── Modal: chips, counters, merged one-render cast e2e ─────────────────────

describe('MA-0564 MonsterCardModal Death Knight Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders four chips; only the two 2/Day names carry counters', () => {
    renderDeathKnight();
    expect(spellLinks().map(el => el.textContent.split('(')[0].trim())).toEqual(NAMES);
    expect(linkByText('Destructive Wave').textContent).toMatch(/\(2\/Day · 2 left\)/);
    expect(linkByText('Dispel Magic').textContent).toMatch(/\(2\/Day · 2 left\)/);
    expect(linkByText('Command').textContent).not.toMatch(/\/Day/);
    expect(linkByText('Phantom Steed').textContent).not.toMatch(/\/Day/);
  });

  it('one-render multi-spell cast: Command logs row DC 18 ungated, Dispel Magic spends 2/Day, Destructive Wave reaches save context at saveDc 18', async () => {
    renderDeathKnight();

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
    expect(opts.saveType).toBe('CON');
    expect(opts.dcSuccess).toBe('half');
    expect(opts.saveDc).toBe(18);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Dispel Magic': 2, 'Destructive Wave': 1 });
    expect(abilityUseEntries('Destructive Wave')[0].description).toMatch(/2\/Day use spent/);
  });
});

// ── MA-0572 twin: Death Knight Aspirant (same cured markup shape) ───────────

const asp = monsters.find(m => m.index === 'death-knight-aspirant');
const aspRow = asp.actions.find(a => a.name === 'Spellcasting');
const ASP_NAMES = ['Phantom Steed', 'Destructive Wave', 'Dispel Magic'];
const ASP_PLAIN_ORIGINAL = 'The aspirant casts one of the following spells, using Charisma as the spellcasting ability (spell save DC 15):\nAt Will: Phantom Steed\n1/Day Each: Destructive Wave (Necrotic), Dispel Magic';
const ASP_MONSTER = 'Death Knight Aspirant 1';

function renderAspirant() {
  const m = makeMonster({ name: 'Death Knight Aspirant', actions: [aspRow] });
  const creatures = [
    { name: ASP_MONSTER, type: 'npc', monsterType: 'undead', targetName: 'Bandit', ac: 20, currentHp: 178, maxHp: 178, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: ASP_MONSTER, creatures })} />);
}

describe('MA-0572 twin data lock: Death Knight Aspirant Spellcasting row', () => {
  it('extracts the three spell names BY-name and the exact 1/Day gate map (tier headers and Phantom Steed absent)', () => {
    expect(extractSpellNamesFromSpellcasting(aspRow.description)).toEqual(ASP_NAMES);
    expect(extractSpellcastingSpellUses(aspRow.description)).toEqual({ 'Destructive Wave': 1, 'Dispel Magic': 1 });
  });

  it('save_dc 15 + Charisma pair authored; stripped text byte-equals the pre-fix description', () => {
    expect(aspRow.save_dc).toBe(15);
    expect(aspRow.save_type).toBe('Charisma');
    expect(aspRow.spell_save_dc).toBe(15);
    expect(aspRow.spellcasting_ability).toBe('Charisma');
    expect(stripTags(aspRow.description)).toBe(ASP_PLAIN_ORIGINAL);
  });
});

describe('MA-0572 twin MonsterCardModal Death Knight Aspirant Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders three chips; only the two 1/Day names carry counters', () => {
    renderAspirant();
    expect(spellLinks().map(el => el.textContent.split('(')[0].trim())).toEqual(ASP_NAMES);
    expect(linkByText('Destructive Wave').textContent).toMatch(/\(1\/Day · 1 left\)/);
    expect(linkByText('Dispel Magic').textContent).toMatch(/\(1\/Day · 1 left\)/);
    expect(linkByText('Phantom Steed').textContent).not.toMatch(/\/Day/);
  });

  it('one-render multi-spell cast: Phantom Steed logs row DC 15 ungated, Dispel Magic spends the single use, Destructive Wave reaches save context at saveDc 15', async () => {
    renderAspirant();

    await act(async () => { fireEvent.click(linkByText('Phantom Steed')); });
    await waitFor(() => expect(abilityUseEntries('Phantom Steed').length).toBe(1));
    expect(abilityUseEntries('Phantom Steed')[0].description).toMatch(/\(spell save DC 15/);
    expect(runtime.store[`${ASP_MONSTER}.monsterSpellUses`] ?? null).toBeNull();

    await act(async () => { fireEvent.click(linkByText('Dispel Magic')); });
    await waitFor(() => expect(runtime.store[`${ASP_MONSTER}.monsterSpellUses`]).toEqual({ 'Dispel Magic': 1 }));
    expect(abilityUseEntries('Dispel Magic')[0].description).toMatch(/casts Dispel Magic via Spellcasting \(spell save DC 15/);

    await act(async () => { fireEvent.click(linkByText('Destructive Wave')); });
    await waitFor(() => expect(saveOptsFor('Destructive Wave')).toBeTruthy());
    const opts = saveOptsFor('Destructive Wave');
    expect(opts.saveType).toBe('CON');
    expect(opts.saveDc).toBe(15);
    expect(runtime.store[`${ASP_MONSTER}.monsterSpellUses`]).toEqual({ 'Dispel Magic': 1, 'Destructive Wave': 1 });
    expect(abilityUseEntries('Destructive Wave')[0].description).toMatch(/1\/Day use spent/);
  });
});
