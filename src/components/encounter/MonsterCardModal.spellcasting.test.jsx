// @maintained-by-ai
// MA-0003 regression: Aarakocra Aeromancer Spellcasting clause.
// The Spellcasting row must expose per-spell castable links (not one
// anonymous generic DC-save link). A non-damage utility spell (Gust of Wind)
// resolves a spell-attributable record + log ("GM-enforced for monsters") with
// NO save prompt and NO "Half damage" guidance; damage spells (Lightning Bolt)
// route a spell-attributed save with the spell's own dc_success.
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { extractSpellNamesFromSpellcasting, extractSpellcastingSpellUses, spellHasDamage, spellDamageFormulaAtBaseLevel } from './MonsterCardHelpers.js';

const AEROMANCASTER_SPELLCASTING = {
  name: 'Spellcasting',
  description: 'The aarakocra casts one of the following spells, requiring no Material components and using Wisdom as the spellcasting ability (spell save DC 13):<br><strong>At Will:</strong> <strong>Elementalism</strong>, <strong>Gust of Wind</strong>, <strong>Mage Hand</strong>, <strong>Message</strong><br><strong>1/Day:</strong> <strong>Lightning Bolt</strong>',
  save_dc: 13,
  save_type: 'Wisdom',
};

const SPELLS_5E = [
  { name: 'Gust of Wind', level: 2, concentration: true, duration: 'Up to 1 minute', damage: null, dc: { dc_type: 'STR', dc_success: 'none' } },
  { name: 'Detect Thoughts', level: 2, concentration: true, duration: 'Up to 1 minute', damage: null, dc: null },
  { name: 'Minor Illusion', level: 0, concentration: false, duration: '1 minute', damage: null, dc: null },
  { name: 'Lightning Bolt', level: 3, concentration: false, duration: 'Instantaneous', damage: { damage_type: 'Lightning', damage_at_slot_level: { 3: '8d6', 4: '9d6' } }, dc: { dc_type: 'DEX', dc_success: 'half' } },
  { name: 'Shatter', level: 2, concentration: false, duration: 'Instantaneous', damage: { damage_type: 'Thunder', damage_at_slot_level: { 2: '3d8', 3: '4d8' } }, dc: { dc_type: 'CON', dc_success: 'half' } },
  { name: 'Mage Hand', level: 0, concentration: false, duration: '1 minute', damage: null, dc: null },
  { name: 'Message', level: 0, concentration: false, duration: '1 round', damage: null, dc: null },
];
const SPELLS_2024 = [
  { name: 'Elementalism', level: 0, concentration: false, duration: 'Instantaneous', damage: null, dc: null },
];

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 8, rolls: [3, 5], modifier: 2 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 16, rolls: [3, 5], modifier: 2 })),
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

// ── Re-import mocked modules ────────────────────────────────────────────────

import { addEntry } from '../../services/ui/logService.js';
import { loadSpells } from '../../services/ui/dataLoader.js';
import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';

const rollSavingThrow = useLoggedDiceRoll._rollSavingThrow;

function spellLinks() {
  return Array.from(document.querySelectorAll('.mc-dice-link-spell'));
}

function linkByText(text) {
  return Array.from(document.querySelectorAll('.mc-dice-link')).find(el => el.textContent.includes(text)) || null;
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('MonsterCardHelpers spellcasting extraction', () => {
  it('extracts spell names and skips header labels ending with colon', () => {
    expect(extractSpellNamesFromSpellcasting(AEROMANCASTER_SPELLCASTING.description)).toEqual([
      'Elementalism', 'Gust of Wind', 'Mage Hand', 'Message', 'Lightning Bolt',
    ]);
  });

  it('detects damage vs non-damage spells and base-level formula', () => {
    const gust = SPELLS_5E.find(s => s.name === 'Gust of Wind');
    const bolt = SPELLS_5E.find(s => s.name === 'Lightning Bolt');
    expect(spellHasDamage(gust)).toBe(false);
    expect(spellHasDamage(bolt)).toBe(true);
    expect(spellDamageFormulaAtBaseLevel(bolt)).toBe('8d6');
    expect(spellDamageFormulaAtBaseLevel(gust)).toBeNull();
  });
});

describe('MonsterCardModal - Spellcasting per-spell cast links (MA-0003)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    loadSpells.mockImplementation((version) => Promise.resolve(version === '2024' ? SPELLS_2024 : SPELLS_5E));
  });

  function renderAeromancer() {
    const m = makeMonster({ name: 'Aarakocra Aeromancer', actions: [AEROMANCASTER_SPELLCASTING] });
    const creatures = [
      { name: 'Aarakocra Aeromancer 1', type: 'npc', monsterType: 'beast', targetName: 'TestPC', currentHp: 18, maxHp: 18, conditions: [] },
      { name: 'TestPC', type: 'player', currentHp: 60, maxHp: 60, conditions: [] },
    ];
    const props = makeProps(m, { creatureName: 'Aarakocra Aeromancer 1', creatures });
    const { rerender } = render(<MonsterCardModal {...props} />);
    return () => rerender(<MonsterCardModal {...props} />);
  }

  it('renders per-spell clickable links and drops the anonymous generic DC-save link', () => {
    renderAeromancer();
    const names = spellLinks().map(el => el.textContent.trim());
    expect(names).toEqual(expect.arrayContaining([
      expect.stringContaining('Gust of Wind'),
      expect.stringContaining('Elementalism'),
      expect.stringContaining('Lightning Bolt'),
    ]));
    expect(document.querySelector('.mc-dice-link-save-clickable')).toBeNull();
  });

  it('casting Gust of Wind logs a spell-attributable GM-enforced record, no save prompt, no Half-damage guidance', async () => {
    renderAeromancer();
    const gust = linkByText('Gust of Wind');
    expect(gust).toBeTruthy();
    await act(async () => { fireEvent.click(gust); });

    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    const entry = addEntry.mock.calls.find(c => String(c[1].description).includes('Gust of Wind'))?.[1];
    expect(entry).toBeTruthy();
    expect(entry.type).toBe('ability_use');
    expect(entry.characterName).toBe('Aarakocra Aeromancer 1');
    expect(entry.abilityName).toBe('Gust of Wind');
    expect(entry.description).toMatch(/GM-enforced for monsters/);
    expect(entry.description).not.toMatch(/half damage/i);
    expect(rollSavingThrow).not.toHaveBeenCalled();
  });

  it('casts Elementalism via 2024 spell lookup (non-damage advisory, no save prompt)', async () => {
    renderAeromancer();
    const el = linkByText('Elementalism');
    expect(el).toBeTruthy();
    await act(async () => { fireEvent.click(el); });

    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    const entry = addEntry.mock.calls.find(c => String(c[1].description).includes('Elementalism'))?.[1];
    expect(entry).toBeTruthy();
    expect(entry.description).toMatch(/GM-enforced for monsters/);
    expect(loadSpells).toHaveBeenCalledWith('2024');
    expect(rollSavingThrow).not.toHaveBeenCalled();
  });

  it('casting Lightning Bolt routes a spell-attributed save with the spell dc_success (half), formula 8d6', async () => {
    renderAeromancer();
    const bolt = linkByText('Lightning Bolt');
    expect(bolt).toBeTruthy();
    await act(async () => { fireEvent.click(bolt); });

    await waitFor(() => expect(rollSavingThrow).toHaveBeenCalled());
    const context = rollSavingThrow.mock.calls[0][2];
    expect(context.spellName).toBe('Lightning Bolt');
    expect(context.actionName).toBe('Lightning Bolt');
    expect(context.dcSuccess).toBe('half');
    expect(context.autoDamageFormula).toBe('8d6');
    expect(context.autoDamageDamageType).toBe('Lightning');
    expect(context.isSpellDamage).toBe(true);
  });

  // MA-0054: Adult Blue Dragon Spellcasting At Will Shatter — CON-save thunder
  // damage spell; the Spellcasting row authors no damage_type, so the spell's
  // own spells.json Thunder must reach the save-damage context.
  it('MA-0054 casting Shatter routes CON DC 18 half-on-success with Thunder damage from spells.json', async () => {
    const blueDragon = makeMonster({
      name: 'Adult Blue Dragon 1',
      actions: [{
        name: 'Spellcasting',
        description: 'The dragon casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 18):<br><strong>At Will:</strong> <em>Detect Magic</em>, <em>Invisibility</em>, <em>Mage Hand</em>, <em>Shatter</em>',
        save_dc: 18,
        save_type: 'Charisma',
      }],
    });
    const creatures = [
      { name: 'Adult Blue Dragon 1', type: 'npc', monsterType: 'dragon', targetName: 'TestPC', currentHp: 212, maxHp: 212, conditions: [] },
      { name: 'TestPC', type: 'player', currentHp: 30, maxHp: 30, conditions: [], computedStats: {} },
    ];
    render(<MonsterCardModal {...makeProps(blueDragon, { creatureName: 'Adult Blue Dragon 1', creatures })} />);
    const shatter = linkByText('Shatter');
    expect(shatter).toBeTruthy();
    await act(async () => { fireEvent.click(shatter); });

    await waitFor(() => expect(rollSavingThrow).toHaveBeenCalled());
    const context = rollSavingThrow.mock.calls[0][2];
    expect(context.spellName).toBe('Shatter');
    expect(context.saveType).toBe('CON');
    expect(context.saveDc).toBe(18);
    expect(context.dcSuccess).toBe('half');
    expect(context.autoDamageFormula).toBe('3d8');
    expect(context.autoDamageDamageType).toBe('Thunder');
    expect(context.isSpellDamage).toBe(true);
  });

  it('renders a per-day uses counter on limited spells only', () => {
    renderAeromancer();
    expect(linkByText('Lightning Bolt').textContent).toMatch(/\(1\/Day · 1 left\)/);
    expect(linkByText('Gust of Wind').textContent).not.toMatch(/\/Day/);
  });

  it('spends the 1/Day use on cast and refuses a second same-day cast with a spell-named refusal log', async () => {
    renderAeromancer();
    const bolt = linkByText('Lightning Bolt');

    await act(async () => { fireEvent.click(bolt); });
    await waitFor(() => expect(rollSavingThrow).toHaveBeenCalledTimes(1));

    expect(runtime.store['Aarakocra Aeromancer 1.monsterSpellUses']).toEqual({ 'Lightning Bolt': 1 });
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && String(e.description).includes('Lightning Bolt'));
    expect(spend).toBeTruthy();
    expect(spend.description).toMatch(/1\/Day use spent — 0 remaining today/);
    expect(addEntry.mock.calls.map(c => c[1]).some(e => e.type === 'automation blocked')).toBe(false);

    await act(async () => { fireEvent.click(bolt); });

    expect(rollSavingThrow).toHaveBeenCalledTimes(1);
    expect(runtime.store['Aarakocra Aeromancer 1.monsterSpellUses']).toEqual({ 'Lightning Bolt': 1 });
    const refusal = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'automation blocked');
    expect(refusal).toBeTruthy();
    expect(refusal.abilityName).toBe('Lightning Bolt');
    expect(refusal.characterName).toBe('Aarakocra Aeromancer 1');
    expect(refusal.description).toMatch(/already cast Lightning Bolt today \(1\/Day\)/);
    expect(refusal.description).toMatch(/refused/);
  });

  it('marks the spell link spent after its 1/Day use is burned', async () => {
    const rerender = renderAeromancer();
    await act(async () => { fireEvent.click(linkByText('Lightning Bolt')); });
    await waitFor(() => expect(rollSavingThrow).toHaveBeenCalledTimes(1));

    await act(async () => { rerender(); });
    const spent = linkByText('Lightning Bolt');
    expect(spent.textContent).toMatch(/\(1\/Day · 0 left\)/);
    expect(spent.className).toContain('mc-dice-link-spell-spent');
  });

  it('At Will spells remain castable repeatedly with no uses spend or refusal', async () => {
    renderAeromancer();
    const gust = linkByText('Gust of Wind');
    await act(async () => { fireEvent.click(gust); });
    await act(async () => { fireEvent.click(gust); });

    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    const gustCasts = addEntry.mock.calls.map(c => c[1]).filter(e => e.abilityName === 'Gust of Wind');
    expect(gustCasts.length).toBe(2);
    expect(gustCasts.every(e => e.type === 'ability_use')).toBe(true);
    expect(runtime.store['Aarakocra Aeromancer 1.monsterSpellUses'] ?? null).toBeNull();
    expect(addEntry.mock.calls.map(c => c[1]).some(e => e.type === 'automation blocked')).toBe(false);
  });
});

describe('extractSpellcastingSpellUses', () => {
  it('parses N/Day grouped spells and ignores At Will groups', () => {
    expect(extractSpellcastingSpellUses(AEROMANCASTER_SPELLCASTING.description)).toEqual({ 'Lightning Bolt': 1 });
    expect(extractSpellcastingSpellUses('<strong>At Will:</strong> <strong>Message</strong>')).toEqual({});
    expect(extractSpellcastingSpellUses('<strong>2/Day:</strong> <strong>Scorching Ray</strong>, <strong>Shatter</strong>')).toEqual({ 'Scorching Ray': 2, 'Shatter': 2 });
    expect(extractSpellcastingSpellUses(null)).toEqual({});
  });

  it('MA-0012: parses em-marked spell names and "N/Day Each:" headers', () => {
    expect(extractSpellcastingSpellUses('<strong>At Will:</strong> <em>Detect Thoughts</em>, <em>Minor Illusion</em>')).toEqual({});
    expect(extractSpellcastingSpellUses('<strong>At Will:</strong> <em>Elementalism</em>, <em>Mage Hand</em><br><strong>1/Day:</strong> <em>Fireball</em>')).toEqual({ 'Fireball': 1 });
    expect(extractSpellcastingSpellUses('<strong>At Will:</strong> <em>Detect Magic</em><br><strong>1/Day Each:</strong> <em>Geas</em>')).toEqual({ 'Geas': 1 });
  });
});

// ── MA-0012: Aberrant Cultist Spellcasting — em-marked spell names + DC drift ─

const CULTIST_SPELLCASTING = {
  name: 'Spellcasting',
  description: 'The cultist casts one of the following spells, using Wisdom as the spellcasting ability (spell save DC 15):<br><strong>At Will:</strong> <em>Detect Thoughts</em>, <em>Minor Illusion</em>',
  save_dc: 15,
  save_type: 'Wisdom',
};

// MA-0012 extraction + disk-DC pins consolidated into the
// 'monsters.json Spellcasting rows' integrity describe below (bytes kept).

describe('MonsterCardModal - MA-0012 Aberrant Cultist per-spell links', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    loadSpells.mockImplementation((version) => Promise.resolve(version === '2024' ? SPELLS_2024 : SPELLS_5E));
  });

  function renderCultist() {
    const m = makeMonster({ name: 'Aberrant Cultist', actions: [CULTIST_SPELLCASTING] });
    const props = makeProps(m, { creatureName: 'Aberrant Cultist 1' });
    render(<MonsterCardModal {...props} />);
  }

  // Em-marked chip render cite-skipped: render owner :184 (this file), live
  // em-chip click proven below (Detect Thoughts), extraction pinned in the
  // disk-integrity describe.

  it('clicking Detect Thoughts logs a spell-attributed cast with the authored DC 15 (no damage in app data — advisory, no save prompt)', async () => {
    renderCultist();
    await act(async () => { fireEvent.click(linkByText('Detect Thoughts')); });

    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    const entry = addEntry.mock.calls.map(c => c[1]).find(e => e.abilityName === 'Detect Thoughts');
    expect(entry).toBeTruthy();
    expect(entry.type).toBe('ability_use');
    expect(entry.characterName).toBe('Aberrant Cultist 1');
    expect(entry.description).toMatch(/spell save DC 15, Wisdom/);
    expect(entry.description).toMatch(/Concentration/);
    expect(entry.description).toMatch(/GM-enforced for monsters/);
    expect(entry.description).not.toMatch(/half damage/i);
    expect(rollSavingThrow).not.toHaveBeenCalled();
  });

  it('clicking Minor Illusion logs a spell-attributed advisory record, no save prompt', async () => {
    renderCultist();
    await act(async () => { fireEvent.click(linkByText('Minor Illusion')); });

    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    const entry = addEntry.mock.calls.map(c => c[1]).find(e => e.abilityName === 'Minor Illusion');
    expect(entry).toBeTruthy();
    expect(entry.type).toBe('ability_use');
    expect(entry.description).toMatch(/Aberrant Cultist 1 casts Minor Illusion via Spellcasting/);
    expect(entry.description).toMatch(/GM-enforced for monsters/);
    expect(rollSavingThrow).not.toHaveBeenCalled();
  });

  // At Will repeat cite-skipped: ungated-repeat owner 'At Will spells remain
  // castable repeatedly...' (this file, MA-0003), cited twins Animal Lord
  // 'At Will spells stay advisory record-only' and Cloud Giant 'Fog Cloud'
  // below.
});

// ── MA-0276: Animal Lord Spellcasting — prose-only DC + tier gates + double log ─

const ANIMAL_LORD_SPELLS_5E = [
  { name: 'Animal Friendship', level: 1, concentration: false, duration: '24 hours', damage: null, dc: { dc_type: 'WIS', dc_success: 'none' }, range: '30 feet' },
  { name: 'Animal Messenger', level: 2, concentration: false, duration: '24 hours', damage: null, dc: null, range: '30 feet' },
  { name: 'Speak with Animals', level: 1, concentration: false, duration: '10 minutes', damage: null, dc: null, range: 'Self' },
  { name: 'Awaken', level: 5, concentration: false, duration: 'Instantaneous', damage: null, dc: null, range: 'Touch' },
  { name: 'Greater Restoration', level: 5, concentration: false, duration: 'Instantaneous', damage: null, dc: null, range: 'Touch' },
  { name: 'Animal Shapes', level: 8, concentration: true, duration: 'Up to 24 hours', damage: null, dc: null, range: '30 feet' },
  { name: 'Sunburst', level: 8, concentration: false, duration: 'Instantaneous', damage: { damage_type: 'Radiant', damage_at_slot_level: { 8: '12d6', 9: '12d6' } }, dc: { dc_type: 'CON', dc_success: 'half' }, range: '150 feet' },
];

function renderAnimalLord() {
  const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
  const row = monsters.find(m => m.index === 'animal-lord').actions.find(a => a.name === 'Spellcasting');
  const m = makeMonster({ name: 'Animal Lord', actions: [row] });
  const creatures = [
    { name: 'Animal Lord 1', type: 'npc', monsterType: 'celestial', targetName: 'TestPC', currentHp: 323, maxHp: 323, conditions: [] },
    { name: 'TestPC', type: 'player', currentHp: 90, maxHp: 90, conditions: [], computedStats: {} },
  ];
  loadSpells.mockImplementation((version) => Promise.resolve(version === '2024' ? [] : ANIMAL_LORD_SPELLS_5E));
  render(<MonsterCardModal {...makeProps(m, { creatureName: 'Animal Lord 1', creatures })} />);
  return row;
}

function abilityUseEntries(name) {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'ability_use' && e.abilityName === name);
}

// ── monsters.json Spellcasting row integrity ─
// Consolidates the MA-0012 cultist / MA-0478 centaur-warden / MA-0500
// cloud-giant / MA-0276 animal-lord disk pins (assertion bytes preserved).
// MA-0421 family fingerprint: plain-text names extract to ZERO chips —
// every authored name must stay em-marked.

let monstersDiskCache = null;

function diskRow(index) {
  if (!monstersDiskCache) monstersDiskCache = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
  const monster = monstersDiskCache.find(m => m.index === index);
  return { monster, row: monster.actions.find(a => a.name === 'Spellcasting') };
}

describe('monsters.json Spellcasting rows - DC pairs, chip extraction, tier gates', () => {
  const DC_PINS = [
    { index: 'aberrant-cultist', saveDc: 15, saveType: 'Wisdom', abilityModKey: 'wis' },   // MA-0012
    { index: 'centaur-warden', saveDc: 15, saveType: 'Wisdom', abilityModKey: 'wis' },       // MA-0478
    { index: 'cloud-giant', saveDc: 15, saveType: 'Charisma', abilityModKey: 'cha' },        // MA-0500
    { index: 'animal-lord', saveDc: 20, saveType: 'Wisdom', abilityModKey: 'wis' },          // MA-0276 (MA-0215 ancient-gold template shape)
  ];

  it('every row keeps numeric save_dc/save_type with DC = 8 + ability mod + PB', () => {
    for (const pin of DC_PINS) {
      const { monster, row } = diskRow(pin.index);
      expect([row.save_dc, row.save_type], pin.index).toEqual([pin.saveDc, pin.saveType]);
      expect(8 + monster.ability_score_modifiers[pin.abilityModKey] + monster.proficiency_bonus, pin.index).toBe(pin.saveDc);
    }
  });

  it('every row extracts its full em-marked chip list in authored order (plain-text once = zero chips)', () => {
    expect(extractSpellNamesFromSpellcasting(diskRow('aberrant-cultist').row.description)).toEqual(['Detect Thoughts', 'Minor Illusion']);
    expect(extractSpellNamesFromSpellcasting(diskRow('centaur-warden').row.description)).toEqual(['Druidcraft', 'Speak with Animals']);
    expect(extractSpellNamesFromSpellcasting(diskRow('cloud-giant').row.description)).toEqual([
      'Detect Magic', 'Fog Cloud', 'Light', 'Control Weather', 'Gaseous Form', 'Telekinesis',
    ]);
    expect(extractSpellNamesFromSpellcasting(diskRow('animal-lord').row.description)).toEqual([
      'Animal Friendship', 'Animal Messenger', 'Speak with Animals',
      'Awaken', 'Greater Restoration', 'Animal Shapes', 'Sunburst',
    ]);
    // Synthetic em fixture keeps the colon-header-skip face disk-independent (MA-0012).
    expect(extractSpellNamesFromSpellcasting(CULTIST_SPELLCASTING.description)).toEqual(['Detect Thoughts', 'Minor Illusion']);
  });

  it('usage tiers bind uses to MARKED names only; At Will tiers ungated, sage-only honest in prose', () => {
    expect(extractSpellcastingSpellUses(diskRow('aberrant-cultist').row.description)).toEqual({});
    expect(extractSpellcastingSpellUses(diskRow('centaur-warden').row.description)).toEqual({});
    expect(extractSpellcastingSpellUses(diskRow('cloud-giant').row.description)).toEqual({
      'Control Weather': 1, 'Gaseous Form': 1, 'Telekinesis': 1,
    });
    expect(extractSpellcastingSpellUses(diskRow('animal-lord').row.description)).toEqual({
      'Awaken': 2, 'Greater Restoration': 2, 'Animal Shapes': 1, 'Sunburst': 1,
    });
    expect(diskRow('animal-lord').row.description).toMatch(/Sage Only/);
  });
});

describe('MA-0276 Animal Lord Spellcasting (modal)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  // Sunburst save-route cite-skipped: block-save routing owner :226-241,
  // numeric row DC from row twin :245-273, animal-lord DC 20 pinned in the
  // disk-integrity describe.

  it('Awaken spends 2/Day with a SINGLE ability_use log per spend, refuses the 3rd cast', async () => {
    renderAnimalLord();
    await act(async () => { fireEvent.click(linkByText('Awaken')); });
    await waitFor(() => expect(abilityUseEntries('Awaken').length).toBe(1));
    expect(runtime.store['Animal Lord 1.monsterSpellUses']).toEqual({ 'Awaken': 1 });
    expect(abilityUseEntries('Awaken')[0].description).toMatch(/2\/Day use spent — 1 remaining today/);
    expect(abilityUseEntries('Awaken')[0].description).toMatch(/GM-enforced for monsters/);

    await act(async () => { fireEvent.click(linkByText('Awaken')); });
    await waitFor(() => expect(abilityUseEntries('Awaken').length).toBe(2));
    expect(runtime.store['Animal Lord 1.monsterSpellUses']).toEqual({ 'Awaken': 2 });

    await act(async () => { fireEvent.click(linkByText('Awaken')); });
    const refusal = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'automation blocked');
    expect(refusal).toBeTruthy();
    expect(refusal.description).toMatch(/already cast Awaken today \(2\/Day\)/);
    expect(runtime.store['Animal Lord 1.monsterSpellUses']).toEqual({ 'Awaken': 2 });
    expect(abilityUseEntries('Awaken').length).toBe(2);
  });

  it('Animal Shapes is gated 1/Day: first cast records once, refire refuses', async () => {
    renderAnimalLord();
    await act(async () => { fireEvent.click(linkByText('Animal Shapes')); });
    await waitFor(() => expect(abilityUseEntries('Animal Shapes').length).toBe(1));
    expect(runtime.store['Animal Lord 1.monsterSpellUses']).toEqual({ 'Animal Shapes': 1 });
    expect(abilityUseEntries('Animal Shapes')[0].description).toMatch(/1\/Day use spent — 0 remaining today/);

    await act(async () => { fireEvent.click(linkByText('Animal Shapes')); });
    const refusal = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'automation blocked');
    expect(refusal).toBeTruthy();
    expect(refusal.description).toMatch(/already cast Animal Shapes today \(1\/Day\)/);
    expect(abilityUseEntries('Animal Shapes').length).toBe(1);
  });

  it('At Will spells stay advisory record-only — no spend, no refusal, ungated', async () => {
    renderAnimalLord();
    await act(async () => { fireEvent.click(linkByText('Animal Friendship')); });
    await act(async () => { fireEvent.click(linkByText('Speak with Animals')); });

    await waitFor(() => expect(addEntry).toHaveBeenCalledTimes(2));
    expect(abilityUseEntries('Animal Friendship').length).toBe(1);
    expect(abilityUseEntries('Speak with Animals').length).toBe(1);
    expect(addEntry.mock.calls.map(c => c[1]).every(e => e.description.match(/GM-enforced for monsters/))).toBe(true);
    expect(runtime.store['Animal Lord 1.monsterSpellUses'] ?? null).toBeNull();
    expect(addEntry.mock.calls.map(c => c[1]).some(e => e.type === 'automation blocked')).toBe(false);
  });
});

// ── MA-0500: Cloud Giant Spellcasting — six plain-text names once = zero chips
// (MA-0421 markup gap). Data fix = <em>-wrap all six names; numeric
// save_dc 15 / save_type Charisma were already authored. 1/Day Each gating
// binds uses ONLY to MARKED names (extractSpellcastingSpellUses §120);
// unmarked 1/Day names were invisible AND ungated.

const CLOUD_GIANT_SPELLCASTING = {
  name: 'Spellcasting',
  description: 'The giant casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 15):<br><strong>At Will:</strong> <em>Detect Magic</em>, <em>Fog Cloud</em>, <em>Light</em><br><strong>1/Day Each:</strong> <em>Control Weather</em>, <em>Gaseous Form</em>, <em>Telekinesis</em>',
  save_dc: 15,
  save_type: 'Charisma',
};

const CLOUD_GIANT_SPELLS_5E = [
  { name: 'Detect Magic', level: 1, concentration: true, duration: 'Up to 10 minutes', damage: null, dc: null },
  { name: 'Fog Cloud', level: 1, concentration: true, duration: 'Up to 1 hour', damage: null, dc: null },
  { name: 'Light', level: 0, concentration: false, duration: '1 hour', damage: null, dc: null },
  { name: 'Control Weather', level: 5, concentration: true, duration: 'Up to 8 hours', damage: null, dc: null },
  { name: 'Gaseous Form', level: 2, concentration: true, duration: 'Up to 1 hour', damage: null, dc: null },
  { name: 'Telekinesis', level: 5, concentration: true, duration: 'Up to 10 minutes', damage: null, dc: null },
];

// Cloud Giant row data pins moved into the disk-integrity describe above.

describe('MonsterCardModal - MA-0500 Cloud Giant per-spell links + 1/Day gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    loadSpells.mockImplementation((version) => Promise.resolve(version === '2024' ? [] : CLOUD_GIANT_SPELLS_5E));
  });

  function renderCloudGiant() {
    const m = makeMonster({ name: 'Cloud Giant', actions: [CLOUD_GIANT_SPELLCASTING] });
    const creatures = [
      { name: 'Cloud Giant 1', type: 'npc', monsterType: 'giant', targetName: 'TestPC', currentHp: 200, maxHp: 200, conditions: [] },
      { name: 'TestPC', type: 'player', currentHp: 60, maxHp: 60, conditions: [] },
    ];
    const props = makeProps(m, { creatureName: 'Cloud Giant 1', creatures });
    render(<MonsterCardModal {...props} />);
  }

  // Chip render + counters cite-skipped: render owner :184, badge byte owner
  // :275, six-chip extraction + 1/Day Each uses pinned in the disk-integrity
  // describe; 1/Day Each modal gate twin owned by spellcasting-archpriest:148.

  it('At Will Fog Cloud logs spell-attributable casts repeatedly, ungated', async () => {
    renderCloudGiant();
    await act(async () => { fireEvent.click(linkByText('Fog Cloud')); });
    await act(async () => { fireEvent.click(linkByText('Fog Cloud')); });

    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    const casts = addEntry.mock.calls.map(c => c[1]).filter(e => e.abilityName === 'Fog Cloud');
    expect(casts.length).toBe(2);
    expect(casts.every(e => e.type === 'ability_use')).toBe(true);
    expect(casts[0].characterName).toBe('Cloud Giant 1');
    expect(runtime.store['Cloud Giant 1.monsterSpellUses'] ?? null).toBeNull();
    expect(addEntry.mock.calls.map(c => c[1]).some(e => e.type === 'automation blocked')).toBe(false);
  });

  // Control Weather 1/Day Each spend/refuse cite-skipped: exhausted-refuse
  // owner :281-302, 1/Day Each modal gate twin owned by
  // spellcasting-archpriest.test.jsx:148-183, header parser pinned at :340.
});
