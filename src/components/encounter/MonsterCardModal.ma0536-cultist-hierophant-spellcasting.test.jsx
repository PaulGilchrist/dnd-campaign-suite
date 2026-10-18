// @maintained-by-ai
// MA-0536 data lock: Cultist Hierophant Spellcasting — near-exact twin of the
// MA-0532 lane on the MA-0421 markup-gap template (save fields already
// authored). Pre-fix ONLY tier headers carried <strong>; Mage Armor/
// Thaumaturgy/Jallarsi's Storm of Radiance/Mass Suggestion were plain text →
// zero chips, zero counters, orphaned row numeric save_dc 17 + save_type
// Charisma. DATA fix: <em> on each spell name, headers byte-kept.
// TICKET-DISTINCT: "Jallarsi's Storm of Radiance" is grep-zero RAW app-wide →
// registered honest homebrew entry in spells.json (level 7, 1 action, Self,
// CHA save DC-by-caster, no invented damage/duration) so findMonsterSpell
// resolves the chip and the cast logs advisory-clean (no damage, no
// "or be X" clause → CLA-325 advisory, console error-free — never a save
// leg; hierophant has no save-leg spell, unlike the twin's Hold Person at
// MA-0532). Cite-skip owners: chip render + per-day counters
// spellcasting.test.jsx:184/:275; gated spend/refusal wording
// spellcasting.test.jsx:281/:317/:518 + archpriest:198 (1/Day Each twin);
// At Will ungated advisory record-only spellcasting.test.jsx:317/:552;
// usage-text format MonsterCardHelpers.usage.test.js:16-38 (MA-0049);
// counter bytes ability-save-uses.test.jsx:127; damageless save-leg shape
// MA-0348 owner damageless-spell-save-leg.test.js. diceRoller mock purged
// dead per #649 probe (this lane rolls no dice); dataLoader mock LIVE.
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { extractSpellNamesFromSpellcasting, extractSpellcastingSpellUses, spellHasDamage, spellDamagelessSaveCondition } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const spells5e = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));

const ch = monsters.find(m => m.index === 'cultist-hierophant');
const chRow = ch.actions.find(a => a.name === 'Spellcasting');
const MASS_SUGGESTION = spells5e.find(s => s.name === 'Mass Suggestion');
const THAUMATURGY = spells5e.find(s => s.name === 'Thaumaturgy');
const MAGE_ARMOR = spells5e.find(s => s.name === 'Mage Armor');
const JALLARSI = spells5e.find(s => s.name === "Jallarsi's Storm of Radiance");

const REAL_SPELLS = ['Mage Armor', 'Thaumaturgy', "Jallarsi's Storm of Radiance", 'Mass Suggestion'];

const CH_PLAIN_ORIGINAL = 'The cultist casts one of the following spells, using Charisma as the spellcasting ability (spell save DC 17):\nAt Will: Mage Armor (included in AC), Thaumaturgy\n1/Day Each: Jallarsi\'s Storm of Radiance (level 7 version), Mass Suggestion';
const stripTags = (d) => d.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '');

const MONSTER_NAME = 'Cultist Hierophant 1';

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSpells: vi.fn((version) => Promise.resolve(version === '2024' ? [] : [MAGE_ARMOR, THAUMATURGY, JALLARSI, MASS_SUGGESTION])),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _rollSavingThrow = vi.fn();

  const mockHook = vi.fn(() => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: vi.fn((val) => { _popupHtml = val; }),
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    rollAbilityCheck: vi.fn(),
    rollSavingThrow: _rollSavingThrow,
    rollSkillCheck: vi.fn(),
    rollInitiative: vi.fn(),
    quickRollPlayerSave: vi.fn(),
  }));

  return { default: mockHook, _rollSavingThrow };
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

function linkByText(text) {
  return Array.from(document.querySelectorAll('.mc-dice-link')).find(el => el.textContent.includes(text)) || null;
}

function abilityUseEntries(name) {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'ability_use' && e.abilityName === name);
}

function renderHierophant() {
  const m = makeMonster({ name: 'Cultist Hierophant', actions: [chRow] });
  const creatures = [
    { name: MONSTER_NAME, type: 'npc', monsterType: 'humanoid', targetName: 'Bandit', ac: 16, currentHp: 144, maxHp: 144, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: MONSTER_NAME, creatures })} />);
}

// ── Data lock: cultist-hierophant Spellcasting row ───────────────────────────

describe('MA-0536 monsters.json data lock: Cultist Hierophant Spellcasting row', () => {
  it('extracts the four BY-name em-marked spells as chips and binds the 1/Day Each gate to exactly the two marked names — tier headers skipped, At Will ungated', () => {
    const names = extractSpellNamesFromSpellcasting(chRow.description);
    expect(names).toEqual(REAL_SPELLS);
    expect(names).not.toContain('At Will');
    expect(names).not.toContain('1/Day Each');
    expect(extractSpellcastingSpellUses(chRow.description)).toEqual({ "Jallarsi's Storm of Radiance": 1, 'Mass Suggestion': 1 });
  });

  it('save_dc seam: numeric save_dc 17 + save_type Charisma (8 + CHA +5 + PB +4) — the pair buildAbilitySaveRollContext reads, no longer orphaned by the Spellcasting-row fork', () => {
    expect(chRow.save_dc).toBe(17);
    expect(chRow.save_type).toBe('Charisma');
    expect(chRow.spell_save_dc).toBe(17);
    expect(chRow.spellcasting_ability).toBe('Charisma');
    expect(chRow.description).toMatch(/spell save DC 17/);
    expect(8 + ch.ability_score_modifiers.cha + ch.proficiency_bonus).toBe(17);
  });

  it('markup-only diff proof: stripped text equals the pre-fix description byte-for-byte', () => {
    expect(stripTags(chRow.description)).toBe(CH_PLAIN_ORIGINAL);
  });
});

// ── Homebrew ticket claim: Jallarsi's Storm of Radiance ──────────────────────

describe('MA-0536 spells.json homebrew registration + advisory routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('Jallarsi registered honest homebrew: level 7, 1 action, Self, CHA save DC-by-caster, no invented damage/duration/area — and all four names resolve via the 5e-first lookup', () => {
    for (const name of REAL_SPELLS) {
      expect(spells5e.find(s => s.name === name), name).toBeTruthy();
    }
    expect(JALLARSI.index).toBe('jallarsis-storm-of-radiance');
    expect(JALLARSI.level).toBe(7);
    expect(JALLARSI.casting_time).toBe('1 action');
    expect(JALLARSI.range).toBe('Self');
    expect(JALLARSI.dc).toEqual({ dc_type: 'CHA', dc_success: 'none' });
    expect(JALLARSI.damage ?? null).toBeNull();
    expect(JALLARSI.duration ?? null).toBeNull();
    expect(JALLARSI.area_of_effect ?? null).toBeNull();
    expect(JALLARSI.attack_type ?? null).toBeNull();
    expect(spellHasDamage(JALLARSI)).toBe(false);
    expect(spellDamagelessSaveCondition(JALLARSI)).toBeNull();
  });

  it('homebrew chip click resolves console-error-free with an honest advisory log at row DC 17 CHA, spends its 1/Day, never a save leg', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderHierophant();
    await act(async () => { fireEvent.click(linkByText("Jallarsi's Storm of Radiance")); });

    await waitFor(() => expect(abilityUseEntries("Jallarsi's Storm of Radiance").length).toBe(1));
    const entry = abilityUseEntries("Jallarsi's Storm of Radiance")[0];
    expect(entry.characterName).toBe(MONSTER_NAME);
    expect(entry.description).toMatch(/casts Jallarsi's Storm of Radiance via Spellcasting \(spell save DC 17, CHA\)/);
    expect(entry.description).toMatch(/1\/Day use spent — 0 remaining today/);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ "Jallarsi's Storm of Radiance": 1 });
    expect(rollSavingThrow).not.toHaveBeenCalled();
    expect(errSpy).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
