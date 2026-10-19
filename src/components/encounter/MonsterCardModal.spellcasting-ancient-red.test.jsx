// @maintained-by-ai
// MA-0237 regression lane — Ancient Red Dragon Spellcasting save-leg DC 23.
// Pre-fix the row authored only prose ("spell save DC 23") with no numeric
// save_dc/save_type, so the Fireball save-leg died at "DC Unknown — no
// success or failure" with saveResult:null. FIX bytes: save_dc 23 +
// save_type "Charisma" (8 + CHA +8 + PB +7 = 23, CR 24), mirroring the
// MA-0215 ancient-gold template shape. This lane owns Spellcasting-ROW bytes
// only: save_dc/save_type + byte-exact description + extractor exact-map +
// the Fireball lv6 upcast DB pin (11d6 from the REAL spells.json — the
// mock serves the real DB, so 11d6 is proven twice from one authored byte).
// DC arithmetic restatement removed (row dc bytes pinned once). Generic
// lanes cited, not duplicated (identical spell-agnostic lane code): counter
// badge render spellcasting.test.jsx:275, exhausted 1/Day spend + spell-named
// refusal spellcasting.test.jsx:281-302, At Will repeat / null store
// spellcasting.test.jsx:317, upcast prose parser MonsterCardHelpers
// spellCastLevelFromSpellcasting (owner ma1202-mummy-lord / barlgura),
// Scorching Ray spell-attack seam scorching-ray.test.jsx, ancient-red
// legendary + fabled-innate faces legendary-uses-ancient-red.test.jsx.
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { extractSpellNamesFromSpellcasting, extractSpellcastingSpellUses } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const spells5e = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));
const spells2024 = JSON.parse(readFileSync('public/data/2024/spells.json', 'utf8'));

const redDragon = monsters.find(m => m.index === 'ancient-red-dragon');
const row = redDragon.actions.find(a => a.name === 'Spellcasting');
const MONSTER_NAME = 'Ancient Red Dragon 1';

const CHIP_NAMES = ['Command', 'Detect Magic', 'Scorching Ray', 'Fireball', 'Scrying'];

// Byte-lock of the row the MA-0237 fix rides on: <br>-separated tier
// headers, em-marked names, upcast parentheticals OUTSIDE the <em>.
const EXACT_DESCRIPTION = 'The dragon casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 23, +15 to hit with spell attacks):<br><strong>At Will:</strong> <em>Command</em> (level 2 version), <em>Detect Magic</em>, <em>Scorching Ray</em> (level 3 version)<br><strong>1/Day Each:</strong> <em>Fireball</em> (level 6 version), <em>Scrying</em>';

// ── Mocks (bisected: diceRoller/sanitize/damageUtils/rangeValidation/
// mapsService/abilityLookup purged — save seam rolls only through the
// fully mocked useLoggedDiceRoll hook) ─────────────────────────────────────

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// 5e-first lookup: all five chips resolve in the REAL filtered 5e DB; the
// 2024 branch serves the real DB so any fallback stays honest.
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

function renderRedDragon() {
  const m = makeMonster({ name: redDragon.name, index: redDragon.index, type: redDragon.type, actions: [row] });
  const creatures = [
    { name: MONSTER_NAME, type: 'npc', monsterType: 'dragon', targetName: 'ElderPaladin', currentHp: redDragon.hit_points, maxHp: redDragon.hit_points, ac: redDragon.armor_class, conditions: [] },
    { name: 'ElderPaladin', type: 'player', currentHp: 224, maxHp: 224, ac: 19, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: MONSTER_NAME, creatures })} />);
}

// ── Data lock ────────────────────────────────────────────────────────────────

describe('MA-0237 monsters.json data lock: Ancient Red Dragon Spellcasting row', () => {
  it('numeric save_dc 23 + save_type "Charisma" pair present (the MA-0237 fix) and description byte-locked; extractor exact-map harvests five chips in authored order and gates Fireball + Scrying only', () => {
    expect(row.save_dc).toBe(23);
    expect(row.save_type).toBe('Charisma');
    expect(row.description).toBe(EXACT_DESCRIPTION);
    expect(extractSpellNamesFromSpellcasting(row.description)).toEqual(CHIP_NAMES);
    expect(extractSpellcastingSpellUses(row.description)).toEqual({ Fireball: 1, Scrying: 1 });
  });

  it('Fireball DB pin: lv6 upcast formula 11d6 Fire, DEX half-on-success (the exact bytes the save-leg must adjudicate, read from the REAL spells.json the mock serves)', () => {
    const fireball = spells5e.find(s => s.name === 'Fireball');
    expect(fireball.level).toBe(3);
    expect(fireball.damage.damage_at_slot_level['6']).toBe('11d6');
    expect(fireball.damage.damage_type).toBe('Fire');
    expect(fireball.dc.dc_type).toBe('DEX');
    expect(fireball.dc.dc_success).toBe('half');
  });
});

// ── Modal: chips + adjudicated cast ─────────────────────────────────────────

describe('MA-0237 MonsterCardModal Ancient Red Dragon Spellcasting chips + Fireball save-leg', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders five chips in authored order — (1/Day · 1 left) counter on Fireball and Scrying only, At Will chips bare (shape owner spellcasting.test.jsx:275)', () => {
    renderRedDragon();
    expect(spellLinks().map(el => el.textContent.split('(')[0].trim())).toEqual(CHIP_NAMES);
    expect(linkByText('Fireball').textContent).toMatch(/\(1\/Day · 1 left\)/);
    expect(linkByText('Scrying').textContent).toMatch(/\(1\/Day · 1 left\)/);
    expect(linkByText('Command').textContent).not.toMatch(/\/Day/);
    expect(linkByText('Detect Magic').textContent).not.toMatch(/\/Day/);
    expect(linkByText('Scorching Ray').textContent).not.toMatch(/\/Day/);
  });

  it('Fireball press routes an adjudicated DEX save at DC 23 exactly once (row save_dc, lv6 11d6 Fire from the real DB, isSpellDamage, armed target — no more DC Unknown), spends the 1/Day use with a remaining-today log, and refuses the second same-day cast spell-named zero-spend', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderRedDragon();
    const fireball = linkByText('Fireball');
    expect(fireball).toBeTruthy();

    await act(async () => { fireEvent.click(fireball); });
    await waitFor(() => expect(rollSavingThrow).toHaveBeenCalledTimes(1));
    const context = rollSavingThrow.mock.calls[0][2];
    expect(context.spellName).toBe('Fireball');
    expect(context.saveDc).toBe(23);
    expect(context.saveType).toBe('DEX');
    expect(context.dcSuccess).toBe('half');
    expect(context.autoDamageFormula).toBe('11d6');
    expect(context.autoDamageDamageType).toBe('Fire');
    expect(context.isSpellDamage).toBe(true);
    expect(context.targetName).toBe('ElderPaladin');

    await waitFor(() => expect(abilityUseEntries('Fireball').length).toBe(1));
    expect(abilityUseEntries('Fireball')[0].characterName).toBe(MONSTER_NAME);
    expect(abilityUseEntries('Fireball')[0].description).toMatch(/casts Fireball via Spellcasting/);
    expect(abilityUseEntries('Fireball')[0].description).toMatch(/1\/Day use spent — 0 remaining today/);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ Fireball: 1 });

    // Exhausted-refuse shape owned by spellcasting.test.jsx:281-302 — this
    // pins only that THIS row's parsed 1/Day Each header gates Fireball live.
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
