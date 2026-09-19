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
const TWO_DAY = ['Destructive Wave', 'Dispel Magic'];
const AT_WILL = ['Command', 'Phantom Steed'];
const COMMAND = spells5e.find(s => s.name === 'Command');
const PHANTOM_STEED = spells5e.find(s => s.name === 'Phantom Steed');
const DISPEL_MAGIC = spells5e.find(s => s.name === 'Dispel Magic');
const DESTRUCTIVE_WAVE = spells2024.find(s => s.name === 'Destructive Wave');

const DK_PLAIN_ORIGINAL = 'The death knight casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 18):\nAt Will: Command, Phantom Steed\n2/Day Each: Destructive Wave (Necrotic), Dispel Magic';
const stripTags = (d) => d.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '');

const MONSTER_NAME = 'Death Knight 1';

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

function refusals(name) {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'automation blocked' && e.abilityName === name);
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
  it('extracts all four spell names as chips — tier headers skipped', () => {
    const names = extractSpellNamesFromSpellcasting(dkRow.description);
    expect(names).toEqual(NAMES);
    expect(names).not.toContain('At Will');
    expect(names).not.toContain('2/Day Each');
  });

  it('binds 2/Day Each to exactly the two marked names; the two At Will names ungated', () => {
    const uses = extractSpellcastingSpellUses(dkRow.description);
    expect(uses).toEqual(Object.fromEntries(TWO_DAY.map(n => [n, 2])));
    AT_WILL.forEach(n => expect(uses[n]).toBeUndefined());
  });

  it('row-level numeric save_dc 18 + save_type Charisma pair authored (trailing)', () => {
    expect(dkRow.save_dc).toBe(18);
    expect(dkRow.save_type).toBe('Charisma');
    expect(dkRow.spell_save_dc).toBe(18);
    expect(dkRow.spellcasting_ability).toBe('Charisma');
    expect(dkRow.description).toMatch(/spell save DC 18/);
  });

  it('DC 18 = 8 + CHA +4 + PB +6 for the death knight', () => {
    expect(dk.ability_score_modifiers.cha).toBe(4);
    expect(dk.proficiency_bonus).toBe(6);
    expect(8 + dk.ability_score_modifiers.cha + dk.proficiency_bonus).toBe(18);
  });

  it('markup-only diff proof: stripped text equals the pre-fix description byte-for-byte', () => {
    expect(stripTags(dkRow.description)).toBe(DK_PLAIN_ORIGINAL);
  });

  it('resolution pins: three RAW 5e spells resolve first; Destructive Wave is 2024-only (5e-first fallback, no cross-file copy)', () => {
    expect(COMMAND.dc).toEqual(expect.objectContaining({ dc_type: 'WIS', dc_success: 'none' }));
    expect(PHANTOM_STEED.damage ?? null).toBeNull();
    expect(DISPEL_MAGIC.damage ?? null).toBeNull();
    expect(spells5e.some(s => s.name === 'Destructive Wave')).toBe(false);
    expect(spells2024.some(s => s.name === 'Destructive Wave')).toBe(true);
    expect(DESTRUCTIVE_WAVE.level).toBe(5);
    expect(DESTRUCTIVE_WAVE.damage.damage_dice_primary).toBe('5d6');
    expect(DESTRUCTIVE_WAVE.dc).toEqual(expect.objectContaining({ dc_type: 'CON', dc_success: 'half' }));
    expect(dkRow.description).toMatch(/<em>Destructive Wave<\/em> \(Necrotic\)/);
  });
});

// ── Modal: four chips, counters, gates ───────────────────────────────────────

describe('MA-0564 MonsterCardModal Death Knight Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders four spell chips — the zero-chip inert row is gone', () => {
    renderDeathKnight();
    const names = spellLinks().map(el => el.textContent.split('(')[0].trim());
    expect(names).toEqual(NAMES);
  });

  it('two 2/Day names carry counters; the two At Will names do not', () => {
    renderDeathKnight();
    expect(linkByText('Dispel Magic').textContent).toMatch(/\(2\/Day · 2 left\)/);
    expect(linkByText('Destructive Wave').textContent).toMatch(/\(2\/Day · 2 left\)/);
    expect(linkByText('Command').textContent).not.toMatch(/\/Day/);
    expect(linkByText('Phantom Steed').textContent).not.toMatch(/\/Day/);
  });

  it('At Will Command casts ungated twice — zero uses, advisory log prints row DC 18', async () => {
    renderDeathKnight();
    await act(async () => { fireEvent.click(linkByText('Command')); });
    await waitFor(() => expect(abilityUseEntries('Command').length).toBe(1));
    expect(abilityUseEntries('Command')[0].description).toMatch(/\(spell save DC 18/);
    await act(async () => { fireEvent.click(linkByText('Command')); });
    await waitFor(() => expect(abilityUseEntries('Command').length).toBe(2));
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
  });

  it('Dispel Magic 2/Day: two casts spend down to zero, third refused — zero extra spend', async () => {
    renderDeathKnight();
    await act(async () => { fireEvent.click(linkByText('Dispel Magic')); });
    await waitFor(() => expect(abilityUseEntries('Dispel Magic').length).toBe(1));
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Dispel Magic': 1 });
    expect(abilityUseEntries('Dispel Magic')[0].description).toMatch(/casts Dispel Magic via Spellcasting \(spell save DC 18/);

    await act(async () => { fireEvent.click(linkByText('Dispel Magic')); });
    await waitFor(() => expect(abilityUseEntries('Dispel Magic').length).toBe(2));
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Dispel Magic': 2 });

    await act(async () => { fireEvent.click(linkByText('Dispel Magic')); });
    await waitFor(() => expect(refusals('Dispel Magic').length).toBe(1));
    expect(abilityUseEntries('Dispel Magic').length).toBe(2);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Dispel Magic': 2 });
  });

  it('Destructive Wave resolves via the 2024 fallback and routes to the save leg at row DC — spends 2/Day', async () => {
    renderDeathKnight();
    await act(async () => { fireEvent.click(linkByText('Destructive Wave')); });
    await waitFor(() => expect(rollSavingThrow).toHaveBeenCalled());
    const opts = rollSavingThrow.mock.calls[0][2];
    expect(opts.spellName).toBe('Destructive Wave');
    expect(opts.saveType).toBe('CON');
    expect(opts.dcSuccess).toBe('half');
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Destructive Wave': 1 });
    expect(abilityUseEntries('Destructive Wave').length).toBe(1);
    expect(abilityUseEntries('Destructive Wave')[0].description).toMatch(/2\/Day use spent/);
  });
});
