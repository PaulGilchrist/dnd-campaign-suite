// @maintained-by-ai
// MA-0362 regression: Barlgura Spellcasting save-leg — the row was prose-only
// ("spell save DC 13" with no numeric save_dc/save_type), so Phantasmal Killer
// prompted "DC Unknown", saveResult null, zero damage, Frightened never landed,
// use spent anyway. Fix = DATA save_dc 13 + save_type "Wisdom" (MA-0318/0328
// shape) AND DATA spells.json PK lv6 upcast dice ("(level 6 version)" upcast =
// 6d10) AND the MA-0362 damage-leg condition source (spellDamageLegFailCondition
// → the spell text's "on a failed save … becomes frightened" rides saveConditions
// to the MV-27 applyFailedSaveConditions leg; dc_success none = zero on success).
// This file OWNS spellDamageLegFailCondition (cited by
// MonsterCardHelpers.damageless-spell-save-leg.test.jsx:20) and the
// "(level N version)" upcast parse (spellCastLevelFromSpellcasting ownership
// shared with ma1202-mummy-lord:52; cited by spell-attack.test.jsx:14).
// Entangle REMAINS advisory BY DESIGN: zone carve-out (area_of_effect cube 20,
// MA-0003/CLA-325 — no zone-consumer engine, MA-0348 report precedent).
// Generic lanes cited, not duplicated: exhausted spend + spell-named refusal
// spellcasting.test.jsx:282-303, 2/Day spend×2 + third refusal + At Will
// advisory spellcasting.test.jsx:512-540/:551, badge counter shape
// ability-save-uses.test.jsx:127, no-target refusal builder bytes
// MonsterCardHelpers.usage.test.js:41, modal unarmed-save press owner
// ma1150-merfolk-wavebender:197. DC arithmetic removed — row save_dc byte
// pinned once.
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { extractSpellNamesFromSpellcasting, extractSpellcastingSpellUses, spellCastLevelFromSpellcasting, spellDamageFormulaAtLevel, spellDamageLegFailCondition, spellHasDamage } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const spells5e = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));

const barlgura = monsters.find(m => m.index === 'barlgura');
const row = barlgura.actions.find(a => a.name === 'Spellcasting');
const MONSTER_NAME = 'Barlgura 1';

// Authored chip order from the row's <em>-marked names (resolvable-name guard).
const CHIP_NAMES = ['Disguise Self', 'Invisibility', 'Entangle', 'Phantasmal Killer'];

// Byte-lock of the row the MA-0362 fix rides on: prose DC + tier headers intact.
const EXACT_DESCRIPTION = 'The barlgura casts one of the following spells, requiring no Material components and using Wisdom as the spellcasting ability (spell save DC 13):<br><strong>2/Day Each:</strong> <em>Disguise Self</em>, <em>Invisibility</em> (self only)<br><strong>1/Day Each:</strong> <em>Entangle</em>, <em>Phantasmal Killer</em> (level 6 version)';

// ── Mocks (bisected: diceRoller/sanitize/damageUtils/rangeValidation/
// mapsService/abilityLookup purged — save seam rolls only through the fully
// mocked useLoggedDiceRoll hook; inert fetch in setup.js keeps the real
// getCombatContext harmless) ────────────────────────────────────────────────

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// Real 5e spells.json bytes filtered to this row's chips (no fixture
// restatement); barlgura is a 5e caster so the 2024 branch stays empty-honest.
vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSpells: vi.fn((version) => Promise.resolve(version === '2024' ? [] : spells5e.filter(s => CHIP_NAMES.includes(s.name)))),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  const _rollSavingThrow = vi.fn();
  const _setPopupHtml = vi.fn();
  return {
    default: vi.fn(() => ({
      popupHtml: null,
      setPopupHtml: _setPopupHtml,
      rollAttack: vi.fn(),
      rollDamage: vi.fn(),
      rollAbilityCheck: vi.fn(),
      rollSavingThrow: _rollSavingThrow,
      rollSkillCheck: vi.fn(),
      rollInitiative: vi.fn(),
      quickRollPlayerSave: vi.fn(),
    })),
    _rollSavingThrow,
    _setPopupHtml,
  };
});

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn(() => ({ ...defaultConditionEffects })),
  combineAttackModes: vi.fn(() => 'normal'),
  CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
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

// ── Re-import mocked modules ────────────────────────────────────────────────

import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import { addEntry } from '../../services/ui/logService.js';

const rollSavingThrow = useLoggedDiceRoll._rollSavingThrow;

function linkByText(text) {
  return Array.from(document.querySelectorAll('.mc-dice-link')).find(el => el.textContent.includes(text)) || null;
}

function entriesOf(name) {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e.abilityName === name);
}

function refusals(name) {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'automation blocked' && e.abilityName === name);
}

function renderBarlgura({ armed = true } = {}) {
  const m = makeMonster({ ...barlgura, actions: [row] });
  const creatures = [
    { name: MONSTER_NAME, type: 'npc', monsterType: barlgura.type, targetName: armed ? 'AberrantSorcerer' : null, currentHp: barlgura.hit_points, maxHp: barlgura.hit_points, ac: barlgura.armor_class, conditions: [] },
    { name: 'AberrantSorcerer', type: 'player', currentHp: 100, maxHp: 100, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: MONSTER_NAME, creatures })} />);
}

// ── Data locks ───────────────────────────────────────────────────────────────

describe('MA-0362 monsters.json data lock: Barlgura Spellcasting row', () => {
  it('numeric save_dc 13 + save_type "Wisdom" pair present (the MA-0362 data fix) and description byte-locked; extractor exact-map harvests four chips in authored order with the 2/Day + 1/Day gates; spells.json PK carries canonical lv6 upcast dice 6d10 + dc WIS / dc_success none', () => {
    expect(row.save_dc).toBe(13);
    expect(row.save_type).toBe('Wisdom');
    expect(row.description).toBe(EXACT_DESCRIPTION);
    expect(extractSpellNamesFromSpellcasting(row.description)).toEqual(CHIP_NAMES);
    expect(extractSpellcastingSpellUses(row.description)).toEqual({ 'Disguise Self': 2, Invisibility: 2, Entangle: 1, 'Phantasmal Killer': 1 });
    const pk = spells5e.find(s => s.index === 'phantasmal-killer');
    expect(pk.damage.damage_at_slot_level['4']).toBe('4d10');
    expect(pk.damage.damage_at_slot_level['6']).toBe('6d10');
    expect(pk.dc).toEqual({ dc_type: 'WIS', dc_success: 'none' });
    expect(pk.description.join(' ')).toMatch(/must make a wisdom saving throw\. On a failed save, the target becomes frightened/);
  });

  it('"(level 6 version)" resolves to slot 6 → 6d10 (never 4d10 base)', () => {
    const pk = spells5e.find(s => s.name === 'Phantasmal Killer');
    const castLevel = spellCastLevelFromSpellcasting(row.description, 'Phantasmal Killer', pk);
    expect(castLevel).toBe(6);
    expect(spellDamageFormulaAtLevel(pk, castLevel)).toBe('6d10');
  });
});

// ── Damage-leg condition owner (this file is the spellDamageLegFailCondition
// owner per damageless-spell-save-leg.test.jsx:20) ──────────────────────────

describe('MA-0362 spellDamageLegFailCondition — Frightened sourced from the spell text', () => {
  it('PK damage leg arms frightened (clause ability agrees with dc_type WIS); no dc_type / mismatched ability / no failed-save clause never arms', () => {
    const pk = spells5e.find(s => s.index === 'phantasmal-killer');
    expect(spellHasDamage(pk)).toBe(true);
    expect(spellDamageLegFailCondition(pk)).toBe('frightened');
    expect(spellDamageLegFailCondition(null)).toBeNull();
    expect(spellDamageLegFailCondition({ dc: null, description: ['On a failed save, the target becomes frightened.'] })).toBeNull();
    expect(spellDamageLegFailCondition({ dc: { dc_type: 'CON' }, description: ['The target must make a wisdom saving throw. On a failed save, the target becomes frightened.'] })).toBeNull();
    expect(spellDamageLegFailCondition({ dc: { dc_type: 'STR' }, description: ['The target must succeed on a strength saving throw or take 2d6 damage.'] })).toBeNull();
  });
});

// ── Save-leg routing ────────────────────────────────────────────────────────

describe('MA-0362 Barlgura Spellcasting — adjudicated PK save-leg, DC 13, no "DC Unknown"', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('PK press routes an adjudicated WIS save at DC 13 with full lv6 dice 6d10 + frightened fail-leg + dc_success none, spends the 1/Day use with an ability_use log, second same-day press refuses spell-named zero-spend, and no-save Disguise Self/Invisibility on the same row stay advisory while spending', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderBarlgura();
    const chip = linkByText('Phantasmal Killer');
    expect(chip).toBeTruthy();

    await act(async () => { fireEvent.click(chip); });
    await waitFor(() => expect(rollSavingThrow).toHaveBeenCalledTimes(1));
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

    await waitFor(() => expect(entriesOf('Phantasmal Killer').filter(e => e.type === 'ability_use').length).toBe(1));
    const spend = entriesOf('Phantasmal Killer').find(e => e.type === 'ability_use');
    expect(spend.description).toMatch(/casts Phantasmal Killer via Spellcasting/);
    expect(spend.description).toMatch(/1\/Day use spent/);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Phantasmal Killer': 1 });

    // Exhausted-refuse shape owner spellcasting.test.jsx:282-303 — this pins
    // only that THIS row's parsed "1/Day Each:" header gates live.
    await act(async () => { fireEvent.click(chip); });
    await waitFor(() => expect(refusals('Phantasmal Killer').length).toBe(1));
    expect(refusals('Phantasmal Killer')[0].description).toMatch(/already cast Phantasmal Killer today \(1\/Day\)/);
    expect(rollSavingThrow).toHaveBeenCalledTimes(1);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Phantasmal Killer': 1 });

    // Negative guard (#775 pattern): no-save utility spells on THIS row must
    // not ride the save leg. 2/Day spend×2 + third-refuse shape owner
    // spellcasting.test.jsx:512-540; badge bytes ability-save-uses:127.
    await act(async () => { fireEvent.click(linkByText('Disguise Self')); });
    await act(async () => { fireEvent.click(linkByText('Invisibility')); });
    expect(rollSavingThrow).toHaveBeenCalledTimes(1);
    expect(entriesOf('Disguise Self')[0].description).toMatch(/Spell effect is recorded; GM-enforced for monsters\./);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Phantasmal Killer': 1, 'Disguise Self': 1, Invisibility: 1 });
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('Entangle stays advisory BY DESIGN — zone carve-out (area_of_effect cube 20, MA-0003/CLA-325); use still spent, gated, spell-named refusal', async () => {
    renderBarlgura();
    const chip = linkByText('Entangle');
    await act(async () => { fireEvent.click(chip); });

    expect(rollSavingThrow).not.toHaveBeenCalled();
    const cast = entriesOf('Entangle').find(e => e.type === 'ability_use');
    expect(cast).toBeTruthy();
    expect(cast.description).toMatch(/casts Entangle via Spellcasting \(spell save DC 13, STR\)/);
    expect(cast.description).toMatch(/Spell effect is recorded; GM-enforced for monsters\./);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ Entangle: 1 });

    await act(async () => { fireEvent.click(chip); });
    expect(refusals('Entangle').length).toBe(1);
    expect(refusals('Entangle')[0].description).toMatch(/already cast Entangle today \(1\/Day\)/);
    expect(rollSavingThrow).not.toHaveBeenCalled();
  });

  it('unarmed PK press refuses via MA-0049 before any spend — no save prompt, zero ledger burn (guard bytes owner usage.test.js:41, modal lane owner ma1150:197)', async () => {
    renderBarlgura({ armed: false });
    await act(async () => { fireEvent.click(linkByText('Phantasmal Killer')); });

    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    const refusal = entriesOf('Phantasmal Killer').find(e => e.type === 'automation');
    expect(refusal).toBeTruthy();
    expect(refusal.automationType).toBe('phantasmal_killer_refused');
    expect(refusal.description).toMatch(/refused \(no target\)/);
    expect(refusal.description).toMatch(/Zero spend, no save prompt\./);
    expect(entriesOf('Phantasmal Killer').filter(e => e.type === 'ability_use').length).toBe(0);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
    expect(rollSavingThrow).not.toHaveBeenCalled();
    expect(useLoggedDiceRoll._setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('mc-no-target-refusal'));
  });
});
