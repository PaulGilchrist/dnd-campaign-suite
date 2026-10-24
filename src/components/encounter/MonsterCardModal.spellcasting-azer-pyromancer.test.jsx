// @maintained-by-ai
// MA-0328 regression lane — Azer Pyromancer Spellcasting save-leg DC 15.
// Pre-fix the row authored only prose ("spell save DC 15") with no numeric
// save_dc/save_type, so the Fireball save-leg died at "DC Unknown — no
// success or failure" with saveResult:null and lv3 8d6 Fire abandoned while
// the 1/Day use was still spent.
// FIX bytes: save_dc 15 + save_type "Wisdom", mirroring the MA-0237
// Ancient Red / MA-0318 Archpriest siblings. This lane owns the
// azer-pyromancer Spellcasting-ROW bytes only: save_dc/save_type +
// byte-exact description + extractor exact-map + the Fireball lv3 DB pin
// (8d6 Fire DEX half from the REAL spells.json the mock serves).
// DC arithmetic restatement removed (row dc bytes pinned once); sibling
// field-shape cross-check removed — archpriest/archmage rows are owned at
// their own files (#773/#772). Generic lanes cited, not duplicated:
// counter badge render spellcasting.test.jsx:276, exhausted 1/Day spend +
// spell-named refusal spellcasting.test.jsx:282-303, At Will repeat /
// null store spellcasting.test.jsx:318, upcast prose parser
// MonsterCardHelpers spellCastLevelFromSpellcasting (owner ma1202/barlgura).
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { extractSpellNamesFromSpellcasting, extractSpellcastingSpellUses } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const spells5e = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));
const spells2024 = JSON.parse(readFileSync('public/data/2024/spells.json', 'utf8'));

const pyromancer = monsters.find(m => m.index === 'azer-pyromancer');
const row = pyromancer.actions.find(a => a.name === 'Spellcasting');
const MONSTER_NAME = 'Azer Pyromancer 1';

const CHIP_NAMES = ['Elementalism', 'Mage Hand', 'Fireball'];

// Byte-lock of the row the MA-0328 fix rides on: <br>-separated tier headers,
// em-marked names, "1/Day:" (not "1/Day Each:") single shared gate.
const EXACT_DESCRIPTION = 'The azer casts one of the following spells, requiring no Material components and using Wisdom as the spellcasting ability (spell save DC 15):<br><strong>At Will:</strong> <em>Elementalism</em>, <em>Mage Hand</em><br><strong>1/Day:</strong> <em>Fireball</em>';

// ── Mocks (bisected: diceRoller/sanitize/damageUtils/rangeValidation/
// mapsService/abilityLookup purged — save seam rolls only through the
// fully mocked useLoggedDiceRoll hook; inert fetch in setup.js keeps the
// real getCombatContext harmless) ──────────────────────────────────────────

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// 5e-first lookup: Mage Hand + Fireball resolve in the REAL filtered 5e DB
// (Elementalism is a 2024-only cantrip and resolves on the 2024 branch —
// the 2024 mock serves the real DB so any fallback stays honest).
vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSpells: vi.fn((version) => Promise.resolve(version === '2024' ? spells2024 : spells5e.filter(s => CHIP_NAMES.includes(s.name)))),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  const _rollSavingThrow = vi.fn();
  return {
    default: vi.fn(() => ({
      popupHtml: null,
      setPopupHtml: vi.fn(),
      rollAttack: vi.fn(),
      rollDamage: vi.fn(),
      rollAbilityCheck: vi.fn(),
      rollSavingThrow: _rollSavingThrow,
      rollSkillCheck: vi.fn(),
      rollInitiative: vi.fn(),
      quickRollPlayerSave: vi.fn(),
    })),
    _rollSavingThrow,
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

import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import { addEntry } from '../../services/ui/logService.js';

const rollSavingThrow = useLoggedDiceRoll._rollSavingThrow;

function linkByText(text) {
  return Array.from(document.querySelectorAll('.mc-dice-link')).find(el => el.textContent.includes(text)) || null;
}

function abilityUseEntries(name) {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'ability_use' && e.abilityName === name);
}

function refusals(name) {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'automation blocked' && e.abilityName === name);
}

function renderPyromancer() {
  const m = makeMonster({ name: pyromancer.name, index: pyromancer.index, type: pyromancer.type, actions: [row] });
  const creatures = [
    { name: MONSTER_NAME, type: 'npc', monsterType: pyromancer.type, targetName: 'AberrantSorcerer', currentHp: pyromancer.hit_points, maxHp: pyromancer.hit_points, ac: pyromancer.armor_class, conditions: [] },
    { name: 'AberrantSorcerer', type: 'player', currentHp: 100, maxHp: 100, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: MONSTER_NAME, creatures })} />);
}

// ── Data lock ────────────────────────────────────────────────────────────────

describe('MA-0328 monsters.json data lock: Azer Pyromancer Spellcasting row', () => {
  it('numeric save_dc 15 + save_type "Wisdom" pair present (the MA-0328 fix) and description byte-locked; extractor exact-map harvests three chips in authored order and gates the single 1/Day Fireball only', () => {
    expect(row.save_dc).toBe(15);
    expect(row.save_type).toBe('Wisdom');
    expect(row.description).toBe(EXACT_DESCRIPTION);
    expect(extractSpellNamesFromSpellcasting(row.description)).toEqual(CHIP_NAMES);
    expect(extractSpellcastingSpellUses(row.description)).toEqual({ Fireball: 1 });
  });

  it('Fireball DB pin: lv3 base spell, 8d6 Fire, DEX half-on-success (the exact bytes the save-leg must adjudicate, read from the REAL spells.json the mock serves)', () => {
    const fireball = spells5e.find(s => s.name === 'Fireball');
    expect(fireball.level).toBe(3);
    expect(fireball.damage.damage_at_slot_level['3']).toBe('8d6');
    expect(fireball.damage.damage_type).toBe('Fire');
    expect(fireball.dc.dc_type).toBe('DEX');
    expect(fireball.dc.dc_success).toBe('half');
  });
});

// ── Modal: chips + adjudicated cast ─────────────────────────────────────────

describe('MA-0328 MonsterCardModal Azer Pyromancer Spellcasting chips + Fireball save-leg', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('Fireball chip carries the parsed 1/Day counter, press routes an adjudicated DEX save at DC 15 exactly once (row save_dc, lv3 8d6 Fire from the real DB, isSpellDamage, armed target — no more DC Unknown), spend + store + refusal accumulate, and the second same-day cast refuses spell-named zero-spend', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderPyromancer();
    const fireball = linkByText('Fireball');
    expect(fireball).toBeTruthy();
    expect(fireball.textContent).toMatch(/\(1\/Day · 1 left\)/);
    // At Will cantrips stay bare (badge shape owner spellcasting.test.jsx:276).
    expect(linkByText('Elementalism').textContent).not.toMatch(/\/Day/);

    await act(async () => { fireEvent.click(fireball); });
    await waitFor(() => expect(rollSavingThrow).toHaveBeenCalledTimes(1));
    const context = rollSavingThrow.mock.calls[0][2];
    expect(context.spellName).toBe('Fireball');
    expect(context.saveDc).toBe(15);
    expect(context.saveType).toBe('DEX');
    expect(context.dcSuccess).toBe('half');
    expect(context.autoDamageFormula).toBe('8d6');
    expect(context.autoDamageDamageType).toBe('Fire');
    expect(context.isSpellDamage).toBe(true);
    expect(context.targetName).toBe('AberrantSorcerer');

    await waitFor(() => expect(abilityUseEntries('Fireball').length).toBe(1));
    expect(abilityUseEntries('Fireball')[0].characterName).toBe(MONSTER_NAME);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ Fireball: 1 });

    // Exhausted-refuse shape owned by spellcasting.test.jsx:282-303 — this
    // pins only that THIS row's parsed 1/Day header gates live.
    await act(async () => { fireEvent.click(linkByText('Fireball')); });
    await waitFor(() => expect(refusals('Fireball').length).toBe(1));
    expect(refusals('Fireball')[0].description).toMatch(/already cast Fireball today \(1\/Day\)/);
    expect(rollSavingThrow).toHaveBeenCalledTimes(1);
    expect(abilityUseEntries('Fireball').length).toBe(1);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ Fireball: 1 });
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
