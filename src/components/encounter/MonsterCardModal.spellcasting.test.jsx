// MA-0003 regression: Aarakocra Aeromancer Spellcasting clause.
// The Spellcasting row must expose per-spell castable links (not one
// anonymous generic DC-save link). A non-damage utility spell (Gust of Wind)
// resolves a spell-attributable record + log ("GM-enforced for monsters") with
// NO save prompt and NO "Half damage" guidance; damage spells (Lightning Bolt)
// route a spell-attributed save with the spell's own dc_success.
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { extractSpellNamesFromSpellcasting, spellHasDamage, spellDamageFormulaAtBaseLevel } from './MonsterCardHelpers.js';

const AEROMANCASTER_SPELLCASTING = {
  name: 'Spellcasting',
  description: 'The aarakocra casts one of the following spells, requiring no Material components and using Wisdom as the spellcasting ability (spell save DC 13):<br><strong>At Will:</strong> <strong>Elementalism</strong>, <strong>Gust of Wind</strong>, <strong>Mage Hand</strong>, <strong>Message</strong><br><strong>1/Day:</strong> <strong>Lightning Bolt</strong>',
  save_dc: 13,
  save_type: 'Wisdom',
};

const SPELLS_5E = [
  { name: 'Gust of Wind', level: 2, concentration: true, duration: 'Up to 1 minute', damage: null, dc: { dc_type: 'STR', dc_success: 'none' } },
  { name: 'Lightning Bolt', level: 3, concentration: false, duration: 'Instantaneous', damage: { damage_type: 'Lightning', damage_at_slot_level: { 3: '8d6', 4: '9d6' } }, dc: { dc_type: 'DEX', dc_success: 'half' } },
  { name: 'Mage Hand', level: 0, concentration: false, duration: '1 minute', damage: null, dc: null },
  { name: 'Message', level: 0, concentration: false, duration: '1 round', damage: null, dc: null },
];
const SPELLS_2024 = [
  { name: 'Elementalism', level: 0, concentration: false, duration: 'Instantaneous', damage: null, dc: null },
];

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('../../services/dice/diceRoller.js', () => ({
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

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
  getRuntimeValue: vi.fn(() => null),
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
    loadSpells.mockImplementation((version) => Promise.resolve(version === '2024' ? SPELLS_2024 : SPELLS_5E));
  });

  function renderAeromancer() {
    const m = makeMonster({ name: 'Aarakocra Aeromancer', actions: [AEROMANCASTER_SPELLCASTING] });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Aarakocra Aeromancer 1' })} />);
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
});
