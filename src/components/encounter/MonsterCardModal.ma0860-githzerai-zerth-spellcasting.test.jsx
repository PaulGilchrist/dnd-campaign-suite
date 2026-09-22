// MA-0860 data lock: Githzerai Zerth Spellcasting row (actions[2]) carried
// cosmetic spell_save_dc 14 + spellcasting_ability "Wisdom" and the DC only in
// prose — buildAbilitySaveRollContext (MonsterCardModal.jsx:1329, saveDc =
// action.save_dc, no spell_save_dc fallback §54/§215) starved the PK save leg to
// "DC Unknown" AFTER the MA-0276 spend-before-route burned the 1/Day charge
// (§266 codification). DATA fix authors the trailing save_dc: 14 +
// save_type: "Wisdom" pair byte-shape of the MA-0237/0318/0328/0362 family
// (MA-0459 cambion / MA-0558 dao placement). Seam already armed: castLevel 6
// "(level 6 version)" → spellDamageFormulaAtLevel 6d10 (MA-0087), frightened via
// MA-0362 spellDamageLegFailCondition, dc_success 'none' MA-0003.
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { extractSpellcastingSpellUses, spellCastLevelFromSpellcasting, spellDamageFormulaAtLevel, spellDamageFormulaAtBaseLevel, spellSaveLegOutcome } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const allSpells = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));
const realSpells = (names) => allSpells.filter(s => names.includes(s.name));

const ZERTH_SPELLS = ['Mage Hand', 'Phantasmal Killer', 'Plane Shift', 'See Invisibility'];

const zerth = monsters.find(m => m.index === 'githzerai-zerth');
const zerthRow = zerth.actions[2];
const pkSpell = allSpells.find(s => s.name === 'Phantasmal Killer');

// ── Mocks (mirror MonsterCardModal.ma0459-cambion-spellcasting.test.jsx) ──

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 33, rolls: [6, 6, 6, 6, 3, 3, 3], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 66, rolls: [], modifier: 0 })),
}));

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSpells: vi.fn((version) => Promise.resolve(version === '2024' ? [] : realSpells(ZERTH_SPELLS))),
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

import { addEntry } from '../../services/ui/logService.js';
import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';

const rollSavingThrow = useLoggedDiceRoll._rollSavingThrow;

function linkByText(text) {
  return Array.from(document.querySelectorAll('.mc-dice-link-spell')).find(el => el.textContent.trim().startsWith(text)) || null;
}

function abilityUseEntries(name) {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'ability_use' && e.abilityName === name);
}

function refusals() {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'automation blocked');
}

function renderZerth() {
  const m = makeMonster({ name: zerth.name, actions: [zerthRow] });
  const creatures = [
    { name: 'Githzerai Zerth 1', type: 'npc', monsterType: 'aberration', targetName: 'TestPC', currentHp: zerth.hit_points, maxHp: zerth.hit_points, conditions: [] },
    { name: 'TestPC', type: 'player', currentHp: 60, maxHp: 60, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: 'Githzerai Zerth 1', creatures })} />);
}

// ── Data lock: zerth row shape (byte-shape MA-0459 cambion twin) ──────────

describe('MA-0860 monsters.json data lock: Githzerai Zerth Spellcasting row', () => {
  it('is the Spellcasting row actions[2] with description byte-unchanged', () => {
    expect(zerthRow.name).toBe('Spellcasting');
    expect(zerthRow.description).toContain('using Wisdom as the spellcasting ability (spell save DC 14)');
    expect(zerthRow.description).toContain('<strong>Phantasmal Killer</strong> (level 6 version)');
  });

  it('authors the trailing save_dc 14 + save_type Wisdom pair — the seam buildAbilitySaveRollContext:1329 reads', () => {
    expect(zerthRow.save_dc).toBe(14);
    expect(zerthRow.save_type).toBe('Wisdom');
    expect(zerthRow.spell_save_dc).toBe(14);
    expect(zerthRow.spellcasting_ability).toBe('Wisdom');
    expect(8 + zerth.ability_score_modifiers.wis + zerth.proficiency_bonus).toBe(14);
    const keys = Object.keys(zerthRow);
    expect(keys.indexOf('save_dc')).toBeGreaterThan(keys.indexOf('spellcasting_ability'));
    expect(keys.indexOf('save_type')).toBeGreaterThan(keys.indexOf('save_dc'));
  });

  it('extractSpellcastingSpellUses binds the 1/Day gates to MARKED names; At-Will stays ungated', () => {
    expect(extractSpellcastingSpellUses(zerthRow.description)).toEqual({
      'Phantasmal Killer': 1, 'Plane Shift': 1, 'See Invisibility': 1,
    });
  });
});

// ── Spells.json + helper arm: lv6 upcast dice + frightened + dc_success ────

describe('MA-0860 helper arm: lv6 6d10 + frightened + dc_success none', () => {
  it('phantasmal-killer is a lv4 WIS dc_success-none psychic concentration spell', () => {
    expect(pkSpell.level).toBe(4);
    expect(pkSpell.dc).toEqual({ dc_type: 'WIS', dc_success: 'none' });
    expect(pkSpell.damage.damage_at_slot_level['4']).toBe('4d10');
    expect(pkSpell.damage.damage_at_slot_level['6']).toBe('6d10');
    expect(pkSpell.damage.damage_type).toBe('Psychic');
  });

  it('spellCastLevelFromSpellcasting parses "(level 6 version)" → castLevel 6 → formula 6d10 (MA-0087, not base 4d10)', () => {
    const castLevel = spellCastLevelFromSpellcasting(zerthRow.description, 'Phantasmal Killer', pkSpell);
    expect(castLevel).toBe(6);
    expect(spellDamageFormulaAtLevel(pkSpell, castLevel)).toBe('6d10');
    expect(spellDamageFormulaAtBaseLevel(pkSpell)).toBe('4d10');
  });

  it('MA-0362 spellSaveLegOutcome sources frightened from the spell text (save_effect absent)', () => {
    expect(pkSpell.save_effect == null).toBe(true);
    const { saveConditions } = spellSaveLegOutcome(pkSpell, '6d10', null);
    expect(saveConditions).toEqual(['frightened']);
  });
});

// ── Modal routing: PK chip save leg fully adjudicated, spend + refusal ────

describe('MA-0860 MonsterCardModal Zerth Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders the spell chips with the 1/Day counters', () => {
    renderZerth();
    expect(linkByText('Mage Hand')).toBeTruthy();
    expect(linkByText('Phantasmal Killer')).toBeTruthy();
    expect(linkByText('Plane Shift')).toBeTruthy();
    expect(linkByText('See Invisibility')).toBeTruthy();
    expect(linkByText('Phantasmal Killer').textContent).toMatch(/\(1\/Day · 1 left\)/);
  });

  it('Phantasmal Killer routes a DC 14 WIS save leg with 6d10 Psychic + frightened + dc_success none, spends 1/Day, refuses the re-cast', async () => {
    renderZerth();
    await act(async () => { fireEvent.click(linkByText('Phantasmal Killer')); });

    await waitFor(() => expect(rollSavingThrow).toHaveBeenCalled());
    expect(rollSavingThrow.mock.calls[0][0]).toBe('WIS');
    const context = rollSavingThrow.mock.calls[0][2];
    expect(context.spellName).toBe('Phantasmal Killer');
    expect(context.saveDc).toBe(14);
    expect(context.saveType).toBe('WIS');
    expect(context.autoDamageFormula).toBe('6d10');
    expect(context.autoDamageDamageType).toMatch(/Psychic/);
    expect(context.saveConditions).toEqual(['frightened']);
    expect(context.dcSuccess).toBe('none');
    expect(context.isSpellDamage).toBe(true);

    await waitFor(() => expect(abilityUseEntries('Phantasmal Killer').length).toBe(1));
    expect(runtime.store['Githzerai Zerth 1.monsterSpellUses']).toEqual({ 'Phantasmal Killer': 1 });
    expect(abilityUseEntries('Phantasmal Killer')[0].description).toMatch(/1\/Day use spent — 0 remaining today/);

    await act(async () => { fireEvent.click(linkByText('Phantasmal Killer')); });
    expect(rollSavingThrow).toHaveBeenCalledTimes(1);
    const refusal = refusals().find(e => e.abilityName === 'Phantasmal Killer');
    expect(refusal).toBeTruthy();
    expect(refusal.description).toMatch(/already cast Phantasmal Killer today \(1\/Day\)/);
    expect(runtime.store['Githzerai Zerth 1.monsterSpellUses']).toEqual({ 'Phantasmal Killer': 1 });
  });

  it('At-Will Mage Hand cast stays advisory, ungated, zero spend, zero save prompt', async () => {
    renderZerth();
    await act(async () => { fireEvent.click(linkByText('Mage Hand')); });

    await waitFor(() => expect(abilityUseEntries('Mage Hand').length).toBe(1));
    expect(abilityUseEntries('Mage Hand')[0].description).toMatch(/casts Mage Hand via Spellcasting/);
    expect(rollSavingThrow).not.toHaveBeenCalled();
    expect(runtime.store['Githzerai Zerth 1.monsterSpellUses'] ?? null).toBeNull();
  });
});
