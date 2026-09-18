// MA-0362 regression: Barlgura Spellcasting save-leg — the row was prose-only
// ("spell save DC 13" with no numeric save_dc/save_type), so Phantasmal Killer
// prompted "DC Unknown", saveResult null, zero damage, Frightened never landed,
// use spent anyway. Fix = DATA save_dc 13 + save_type "Wisdom" (MA-0318/0328
// shape; 8 + WIS +2 + PB +3 = 13) AND DATA spells.json PK lv6 dice
// ("(level 6 version)" upcast, canonical +1d10/slot above 4th = 6d10) AND the
// MA-0362 damage-leg condition source (spellDamageLegFailCondition → the spell
// text's "on a failed save … becomes frightened" rides saveConditions to the
// MV-27 applyFailedSaveConditions leg; dc_success none = zero on success).
// Entangle REMAINS advisory BY DESIGN: zone carve-out (area_of_effect cube 20,
// MA-0003/CLA-325 — no zone-consumer engine, MA-0348 report precedent).
// Disguise Self/Invisibility stay advisory (no save, no damage). Tier gates
// 2/Day + 1/Day exact (MA-0276 shape).
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { spellCastLevelFromSpellcasting, spellDamageFormulaAtLevel, spellDamagelessSaveCondition, spellDamageLegFailCondition, spellHasDamage } from './MonsterCardHelpers.js';

const PK_TEXT = 'You tap into the nightmares of a creature you can see within range and create an illusory manifestation of its deepest fears, visible only to that creature. The target must make a wisdom saving throw. On a failed save, the target becomes frightened for the duration. At the start of each of the target\'s turns before the spell ends, the target must succeed on a wisdom saving throw or take 4d10 psychic damage. On a successful save, the spell ends.';

const SPELLS_5E = [
  { name: 'Phantasmal Killer', level: 4, concentration: true, duration: 'Up to 1 minute', range: '120 feet', damage: { damage_type: 'Psychic', damage_at_slot_level: { 4: '4d10', 6: '6d10' } }, dc: { dc_type: 'WIS', dc_success: 'none' }, description: [PK_TEXT] },
  { name: 'Entangle', level: 1, concentration: true, duration: 'Up to 1 minute', range: '90 feet', damage: null, dc: { dc_type: 'STR', dc_success: 'none' }, area_of_effect: { type: 'cube', size: 20 }, description: ['Grasping weeds and vines sprout from the ground in a 20-foot square starting form a point within range. For the duration, these plants turn the ground in the area into difficult terrain. A creature in the area when you cast the spell must succeed on a strength saving throw or be restrained by the entangling plants until the spell ends.'] },
  { name: 'Disguise Self', level: 1, concentration: false, duration: '1 hour', range: 'Self', damage: null, dc: null, description: ['You make yourself, including your clothing, armor, weapons, and other belongings on your person) look different until the spell ends.'] },
  { name: 'Invisibility', level: 2, concentration: true, duration: 'Up to 1 hour', range: 'Touch', damage: null, dc: null, description: ['A creature you touch becomes invisible until the spell ends.'] },
];

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 30, rolls: [6, 6, 6, 6, 6], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 60, rolls: [6, 6, 6, 6, 6], modifier: 0 })),
}));

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSpells: vi.fn(() => Promise.resolve(SPELLS_5E)),
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
import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';

const rollSavingThrow = useLoggedDiceRoll._rollSavingThrow;

function linkByText(text) {
  return Array.from(document.querySelectorAll('.mc-dice-link')).find(el => el.textContent.includes(text)) || null;
}

function monsters() {
  return JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
}

function barlgura() {
  return monsters().find(m => m.index === 'barlgura');
}

function barlguraRow() {
  return barlgura().actions.find(a => a.name === 'Spellcasting');
}

function renderBarlgura(row) {
  const m = makeMonster({ name: 'Barlgura', actions: [row] });
  const creatures = [
    { name: 'Barlgura 1', type: 'npc', monsterType: 'fiend', targetName: 'AberrantSorcerer', currentHp: 85, maxHp: 85, conditions: [] },
    { name: 'AberrantSorcerer', type: 'player', currentHp: 100, maxHp: 100, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: 'Barlgura 1', creatures })} />);
}

// ── Data locks ───────────────────────────────────────────────────────────────

describe('MA-0362 Barlgura Spellcasting row — authored DC 13 data lock', () => {
  it('row authors numeric save_dc 13 + save_type Wisdom (8 + WIS +2 + PB +3)', () => {
    const b = barlgura();
    const row = barlguraRow();
    expect(row.save_dc).toBe(13);
    expect(row.save_type).toBe('Wisdom');
    expect(8 + b.ability_score_modifiers.wis + b.proficiency_bonus).toBe(13);
    expect(row.description).toMatch(/spell save DC 13/);
  });

  it('description byte-unchanged (prose DC + tier headers intact)', () => {
    expect(barlguraRow().description).toBe('The barlgura casts one of the following spells, requiring no Material components and using Wisdom as the spellcasting ability (spell save DC 13):<br><strong>2/Day Each:</strong> <em>Disguise Self</em>, <em>Invisibility</em> (self only)<br><strong>1/Day Each:</strong> <em>Entangle</em>, <em>Phantasmal Killer</em> (level 6 version)');
  });

  it('spells.json PK carries canonical lv6 upcast dice 6d10 + dc WIS / dc_success none', () => {
    const pk = JSON.parse(readFileSync('public/data/spells.json', 'utf8')).find(s => s.index === 'phantasmal-killer');
    expect(pk.damage.damage_at_slot_level['6']).toBe('6d10');
    expect(pk.damage.damage_at_slot_level['4']).toBe('4d10');
    expect(pk.dc).toEqual({ dc_type: 'WIS', dc_success: 'none' });
    expect(pk.description.join(' ')).toMatch(/must make a wisdom saving throw\. On a failed save, the target becomes frightened/);
  });

  it('"(level 6 version)" resolves to slot 6 → 6d10 (never 4d10 base)', () => {
    const pk = SPELLS_5E.find(s => s.name === 'Phantasmal Killer');
    const castLevel = spellCastLevelFromSpellcasting(barlguraRow().description, 'Phantasmal Killer', pk);
    expect(castLevel).toBe(6);
    expect(spellDamageFormulaAtLevel(pk, castLevel)).toBe('6d10');
  });
});

describe('MA-0362 spellDamageLegFailCondition — Frightened sourced from the spell text', () => {
  it('PK damage leg arms frightened (clause ability agrees with dc_type WIS)', () => {
    const pk = SPELLS_5E.find(s => s.name === 'Phantasmal Killer');
    expect(spellHasDamage(pk)).toBe(true);
    expect(spellDamageLegFailCondition(pk)).toBe('frightened');
  });

  it('no dc_type / mismatched ability / no failed-save clause never arms', () => {
    expect(spellDamageLegFailCondition(null)).toBeNull();
    expect(spellDamageLegFailCondition({ dc: null, description: ['On a failed save, the target becomes frightened.'] })).toBeNull();
    expect(spellDamageLegFailCondition({ dc: { dc_type: 'CON' }, description: ['The target must make a wisdom saving throw. On a failed save, the target becomes frightened.'] })).toBeNull();
    expect(spellDamageLegFailCondition({ dc: { dc_type: 'STR' }, description: ['The target must succeed on a strength saving throw or take 2d6 damage.'] })).toBeNull();
  });

  it('Entangle damageless zone spell never reaches the damage leg — zone carve-out keeps it advisory (MA-0003/CLA-325)', () => {
    const entangle = SPELLS_5E.find(s => s.name === 'Entangle');
    expect(spellHasDamage(entangle)).toBe(false);
    expect(spellDamagelessSaveCondition(entangle)).toBeNull();
    expect(spellDamageLegFailCondition(entangle)).toBeNull();
  });
});

// ── Save-leg routing ────────────────────────────────────────────────────────

describe('MA-0362 Phantasmal Killer save-leg — DC 13 adjudicated, no "DC Unknown"', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('routes an adjudicated WIS save at DC 13 with full lv6 dice 6d10 + frightened fail-leg + dc_success none', async () => {
    renderBarlgura(barlguraRow());
    const chip = linkByText('Phantasmal Killer');
    expect(chip).toBeTruthy();
    await act(async () => { fireEvent.click(chip); });

    await waitFor(() => expect(rollSavingThrow).toHaveBeenCalled());
    const [abbr, , context] = rollSavingThrow.mock.calls[0];
    expect(abbr).toBe('WIS');
    expect(context.spellName).toBe('Phantasmal Killer');
    expect(context.saveDc).toBe(13);
    expect(context.saveType).toBe('WIS');
    expect(context.dcSuccess).toBe('none');
    expect(context.autoDamageFormula).toBe('6d10');
    expect(context.autoDamageDamageType).toBe('Psychic');
    expect(context.saveConditions).toEqual(['frightened']);
    expect(context.conditionDurationNote).toBe("for the spell's duration — Concentration, Up to 1 minute (GM-enforced)");
    expect(context.isSpellDamage).toBe(true);
    expect(context.targetName).toBe('AberrantSorcerer');
  });

  it('spends the PK 1/Day use with an ability_use log and refuses a second same-day cast', async () => {
    renderBarlgura(barlguraRow());
    const chip = linkByText('Phantasmal Killer');

    await act(async () => { fireEvent.click(chip); });
    await waitFor(() => expect(rollSavingThrow).toHaveBeenCalledTimes(1));
    expect(runtime.store['Barlgura 1.monsterSpellUses']).toEqual({ 'Phantasmal Killer': 1 });
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use');
    expect(spend).toBeTruthy();
    expect(spend.description).toMatch(/casts Phantasmal Killer via Spellcasting/);
    expect(spend.description).toMatch(/1\/Day use spent/);

    await act(async () => { fireEvent.click(chip); });
    expect(rollSavingThrow).toHaveBeenCalledTimes(1);
    const refusal = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'automation blocked');
    expect(refusal).toBeTruthy();
    expect(refusal.description).toMatch(/already cast Phantasmal Killer today \(1\/Day\)/);
  });

  it('Entangle stays advisory BY DESIGN — zone carve-out (area_of_effect cube 20, MA-0003/CLA-325); use still spent and gated', async () => {
    renderBarlgura(barlguraRow());
    const chip = linkByText('Entangle');
    await act(async () => { fireEvent.click(chip); });

    expect(rollSavingThrow).not.toHaveBeenCalled();
    const cast = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use');
    expect(cast).toBeTruthy();
    expect(cast.description).toMatch(/casts Entangle via Spellcasting \(spell save DC 13, STR\)/);
    expect(cast.description).toMatch(/Spell effect is recorded; GM-enforced for monsters\./);
    expect(runtime.store['Barlgura 1.monsterSpellUses']).toEqual({ Entangle: 1 });

    await act(async () => { fireEvent.click(chip); });
    const refusal = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'automation blocked');
    expect(refusal).toBeTruthy();
    expect(refusal.description).toMatch(/already cast Entangle today \(1\/Day\)/);
  });

  it('2/Day tier gate exact — Disguise Self spends twice, refuses the third; Invisibility advisory', async () => {
    renderBarlgura(barlguraRow());
    const disguise = linkByText('Disguise Self');

    await act(async () => { fireEvent.click(disguise); });
    await act(async () => { fireEvent.click(disguise); });
    expect(rollSavingThrow).not.toHaveBeenCalled();
    expect(runtime.store['Barlgura 1.monsterSpellUses']).toEqual({ 'Disguise Self': 2 });

    await act(async () => { fireEvent.click(disguise); });
    const refusal = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'automation blocked');
    expect(refusal).toBeTruthy();
    expect(refusal.description).toMatch(/already cast Disguise Self today \(2\/Day\)/);

    await act(async () => { fireEvent.click(linkByText('Invisibility')); });
    expect(rollSavingThrow).not.toHaveBeenCalled();
    expect(runtime.store['Barlgura 1.monsterSpellUses']).toEqual({ 'Disguise Self': 2, Invisibility: 1 });
  });

  it('single-target save with no armed target refuses via the MA-0049 seam — no save prompt', async () => {
    const m = makeMonster({ name: 'Barlgura', actions: [barlguraRow()] });
    const creatures = [
      { name: 'Barlgura 1', type: 'npc', monsterType: 'fiend', targetName: null, currentHp: 85, maxHp: 85, conditions: [] },
    ];
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Barlgura 1', creatures })} />);
    await act(async () => { fireEvent.click(linkByText('Phantasmal Killer')); });
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'phantasmal_killer_refused')).toBe(true));

    expect(rollSavingThrow).not.toHaveBeenCalled();
  });
});
