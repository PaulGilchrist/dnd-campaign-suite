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
  findCreatureByName: vi.fn(() => ({ name: 'Aarakocra Aeromancer 1', conditions: [] })),
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
    const props = makeProps(m, { creatureName: 'Aarakocra Aeromancer 1' });
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

describe('MonsterCardHelpers - MA-0012 em-marked spell name extraction', () => {
  it('extracts em-marked spell names and skips colon headers', () => {
    expect(extractSpellNamesFromSpellcasting(CULTIST_SPELLCASTING.description)).toEqual(['Detect Thoughts', 'Minor Illusion']);
  });

  it('authored monsters.json row carries canonical DC 15 (8 + WIS + PB)', () => {
    const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
    const cultist = monsters.find(m => m.index === 'aberrant-cultist');
    const row = cultist.actions.find(a => a.name === 'Spellcasting');
    expect(row.save_dc).toBe(15);
    expect(row.save_type).toBe('Wisdom');
    expect(8 + cultist.ability_score_modifiers.wis + cultist.proficiency_bonus).toBe(15);
  });
});

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

  it('renders clickable per-spell links for em-marked spell names (no more zero-affordance row)', () => {
    renderCultist();
    const names = spellLinks().map(el => el.textContent.trim());
    expect(names).toEqual(expect.arrayContaining([
      expect.stringContaining('Detect Thoughts'),
      expect.stringContaining('Minor Illusion'),
    ]));
  });

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

  it('At Will em spells remain castable repeatedly with no uses spend', async () => {
    renderCultist();
    await act(async () => { fireEvent.click(linkByText('Minor Illusion')); });
    await act(async () => { fireEvent.click(linkByText('Minor Illusion')); });

    await waitFor(() => expect(addEntry).toHaveBeenCalledTimes(2));
    expect(runtime.store['Aberrant Cultist 1.monsterSpellUses'] ?? null).toBeNull();
    expect(addEntry.mock.calls.map(c => c[1]).some(e => e.type === 'automation blocked')).toBe(false);
  });
});
