// @maintained-by-ai
// MA-0452 data lock: Bullywug Bog Sage Multiattack "replace any attack with
// Spellcasting to cast Ray of Sickness" rode the Spellcasting-row chips
// (MA-0223), but the row wrapped ONLY "Vitriolic Sphere" in markup — Ray of
// Sickness / Dancing Lights / Druidcraft / Speak with Plants were plain text,
// so extractSpellNamesFromSpellcasting yielded ONE chip and the replace clause
// was inert (MA-0421 fingerprint). DATA-MARKUP fix wraps each At-Will name in
// <em> (archmage byte-shape precedent) and Speak with Plants too.
// MA-0454 EXTENSION: same row still lacked row-level save_dc/save_type —
// spell_save_dc never reaches buildAbilitySaveRollContext (DC Unknown cast
// burning the 1/Day use) — MA-0237 data pair added + DC-enforced save-leg
// lock below.
//
// GENERIC legs cite-skipped (behavioral coverage lives in the spellcasting
// family): cast-click logs / advisory records / row-DC-in-log →
// MonsterCardModal.spellcasting.test.jsx:196/:377/:393, :601; save routing
// with dc_success :227; 1/Day spend + second-cast refusal :282 (usage #571);
// At Will ungated repeat casts :318; per-day counter on limited only :276;
// extractSpellcastingSpellUses parsing :334/:341 + Cloud Giant tier split
// :489; spell-attack seam routing (+bonus, isSpellDamage, never-save) →
// MonsterCardModal.spell-attack.test.jsx:196/:331; no-armed-target refusal
// :255; bone-naga save-pair byte-shape → ma0421-bone-naga-spellcasting.test.jsx:161.
// Kept here: this monster's distinct row/spell bytes, the five-chip
// zero-affordance fingerprint, bog-specific 1/Day gating render, and the
// MA-0454 save_dc 13 seam e2e.
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { extractSpellNamesFromSpellcasting, monsterSpellAttackBonus, isSpellAttackSpell, spellDamageFormulaAtLevel } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const spells5e = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));
const spells2024 = JSON.parse(readFileSync('public/data/2024/spells.json', 'utf8'));

const bog = monsters.find(m => m.index === 'bullywug-bog-sage');
const bogRow = bog.actions.find(a => a.name === 'Spellcasting');
const RAY = spells2024.find(s => s.name === 'Ray of Sickness');
const VITRIOLIC = spells2024.find(s => s.name === 'Vitriolic Sphere');

const BOG_SPELLS = ['Dancing Lights', 'Druidcraft', 'Ray of Sickness', 'Speak with Plants', 'Vitriolic Sphere'];

// Pre-fix description fingerprint (git HEAD, monsters.json) — markup-only diff
// proof: strip every tag from the FIXED row and it equals this byte-for-byte.
const BOG_PLAIN_ORIGINAL = 'The bullywug casts one of the following spells, using Wisdom as the spellcasting ability (spell save DC 13, +5 to hit with spell attacks):\nAt Will: Dancing Lights, Druidcraft, Ray of Sickness\n1/Day Each: Speak with Plants, Vitriolic Sphere';
const stripTags = (d) => d.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '');

const MONSTER_NAME = 'Bullywug Bog Sage 1';

// ── Mocks (mirror MonsterCardModal.spell-attack.test.jsx) ──────────────────

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSpells: vi.fn((version) => Promise.resolve(version === '2024' ? [RAY, VITRIOLIC] : [])),
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

const rollSavingThrow = useLoggedDiceRoll._rollSavingThrow;

function spellLinks() {
  return Array.from(document.querySelectorAll('.mc-dice-link-spell'));
}

function linkByText(text) {
  return Array.from(document.querySelectorAll('.mc-dice-link')).find(el => el.textContent.includes(text)) || null;
}

function renderBog() {
  const m = makeMonster({ name: 'Bullywug Bog Sage', actions: [bogRow] });
  const creatures = [
    { name: MONSTER_NAME, type: 'npc', monsterType: 'fey', targetName: 'Bandit', ac: 16, currentHp: 52, maxHp: 52, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 30, maxHp: 30, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: MONSTER_NAME, creatures })} />);
}

// ── Data lock: bullywug-bog-sage Spellcasting row + 2024 spell bytes ───────

describe('MA-0452/MA-0454 monsters.json data lock: Bullywug Bog Sage Spellcasting row', () => {
  it('extracts all five spell names as chips incl. Ray of Sickness (was one)', () => {
    expect(extractSpellNamesFromSpellcasting(bogRow.description)).toEqual(BOG_SPELLS);
  });

  it('authors +5 attack / DC 13 seams: spell_attack_bonus + spell_save_dc + MA-0237 save_dc/save_type pair (8 + WIS 3 + PB 2)', () => {
    expect(bogRow.spell_attack_bonus).toBe(5);
    expect(bogRow.spell_save_dc).toBe(13);
    expect(bogRow.save_dc).toBe(13);
    expect(bogRow.save_type).toBe('Wisdom');
    expect(bogRow.spellcasting_ability).toBe('Wisdom');
    expect(monsterSpellAttackBonus(bogRow)).toBe(5);
    expect(bog.ability_score_modifiers.wis).toBe(3);
    expect(bog.proficiency_bonus).toBe(2);
    expect(bogRow.description).toMatch(/spell save DC 13/);
  });

  it('markup-only diff proof: stripped text equals the pre-fix description byte-for-byte', () => {
    expect(stripTags(bogRow.description)).toBe(BOG_PLAIN_ORIGINAL);
  });

  it('Ray of Sickness is 2024-only: ranged spell attack, 2d8 Poison, Poisoned on hit, NO save', () => {
    expect(spells5e.find(s => s.name === 'Ray of Sickness')).toBeFalsy();
    expect(RAY.attack_type).toBe('ranged');
    expect(isSpellAttackSpell(RAY)).toBe(true);
    expect(spellDamageFormulaAtLevel(RAY, 1)).toBe('2d8');
    expect(RAY.damage.damage_type).toBe('Poison');
    expect(RAY.status_effects).toContain('Poisoned');
    expect(RAY.dc ?? null).toBeNull();
  });

  it('Vitriolic Sphere is 2024-only: DEX save, authored dc_success none, 10d4 Acid at lv4', () => {
    expect(spells5e.find(s => s.name === 'Vitriolic Sphere')).toBeFalsy();
    expect(VITRIOLIC.level).toBe(4);
    expect(VITRIOLIC.dc).toEqual({ dc_type: 'DEX', dc_success: 'none' });
    expect(VITRIOLIC.damage.damage_type).toBe('Acid');
    expect(VITRIOLIC.damage.damage_at_slot_level['4']).toBe('10d4');
  });
});

// ── Modal: chips (MA-0452) + DC-enforced save leg (MA-0454) ────────────────

describe('MA-0452/MA-0454 MonsterCardModal Bog Sage: five chips, 1/Day gating, DC 13 save seam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders five clickable spell chips (was zero affordances for Ray)', () => {
    renderBog();
    const names = spellLinks().map(el => el.textContent.split('(')[0].trim());
    expect(names.sort()).toEqual([...BOG_SPELLS].sort());
    expect(linkByText('Ray of Sickness')).toBeTruthy();
  });

  it('Speak with Plants + Vitriolic Sphere carry the 1/Day counter; At Will names do not', () => {
    renderBog();
    expect(linkByText('Vitriolic Sphere').textContent).toMatch(/\(1\/Day · 1 left\)/);
    expect(linkByText('Speak with Plants').textContent).toMatch(/\(1\/Day · 1 left\)/);
    expect(linkByText('Dancing Lights').textContent).not.toMatch(/\/Day/);
    expect(linkByText('Druidcraft').textContent).not.toMatch(/\/Day/);
    expect(linkByText('Ray of Sickness').textContent).not.toMatch(/\/Day/);
  });

  it('Vitriolic Sphere click routes an adjudicated DEX save at DC 13 — 10d4 Acid, dc_success none, no more DC Unknown', async () => {
    renderBog();
    await act(async () => { fireEvent.click(linkByText('Vitriolic Sphere')); });

    await waitFor(() => expect(rollSavingThrow).toHaveBeenCalled());
    const context = rollSavingThrow.mock.calls[0][2];
    expect(context.spellName).toBe('Vitriolic Sphere');
    expect(context.saveDc).toBe(13);
    expect(context.saveType).toBe('DEX');
    expect(context.dcSuccess).toBe('none');
    expect(context.autoDamageFormula).toBe('10d4');
    expect(context.autoDamageDamageType).toBe('Acid');
    expect(context.isSpellDamage).toBe(true);
    expect(context.targetName).toBe('Bandit');
  });
});

