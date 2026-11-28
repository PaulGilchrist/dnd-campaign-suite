// @maintained-by-ai 2026-11-28
// MA-1634 data lock: Unicorn Spellcasting rode the MA-0421/MA-1230/MA-1543/
// MA-1625 markup-gap family — the WHOLE description was plain text on a
// SINGLE line with "; " tier separators: names AND both tier headers
// unmarked → extractSpellNamesFromSpellcasting [] → zero chips, zero cast
// affordance; the 1/Day-EACH tracking was structurally dead. DATA fix = dao
// MA-1543/storm-giant house style: <strong> headers + <em> on all seven
// names, "; " / ", " separators byte-kept (single-line prose). ":"-terminated
// headers are skipped by the extractor, so no fake chips. CANONICAL-NAME
// AMENDMENT (§1241/§158): the DBs index "Pass Without Trace" capital-W and
// findMonsterSpell is EXACT-match (Modal:1852-1858), so the wrapped prose
// name uses capital-W — the lowercase-w form is pinned ABSENT in the 5e DB
// below; the row byte-lock + chip-order lock + DB-name lock jointly close
// the prose↔DB drift trap without a dedicated live-cast test.
// This file OWNS ONLY: the marked single-line row harvesting seven chips in
// authored order with exactly the five 1/Day names gated, and the gate
// riding live on THIS row (spend, exhausted refusal, At Will pair casting
// twice with zero store writes). Cite-skip owners (NOT restated here):
// advisory row-DC + spell-dc_type stamping (MA-0012) → ma1150-merfolk-wavebender
// (Light "DC 15, Wisdom") and spellcasting-barlgura.test.jsx:196-211 (Entangle
// STR beats the row's Wisdom, stays advisory by the zone carve-out, spends,
// and spell-named-refuses on the second press); exhausted-refusal + spend
// wording bytes → spellcasting.test.jsx:282-303; multi-key independence +
// At Will record-only lane → spellcasting.test.jsx:512-554; counter badge
// shape → ability-save-uses.test.jsx:127; no-target refusal builder bytes →
// MonsterCardHelpers.usage.test.js:44-60; Entangle STR/none + damageless
// helper truth table → MonsterCardHelpers.damageless-spell-save-leg.test.js.
// Unicorn legendary/lay-person lanes are a different file
// (legendary-uses-unicorn.test.jsx) — untouched here.
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import { extractSpellNamesFromSpellcasting, extractSpellcastingSpellUses } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const SPELLS_5E = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));

const unicorn = monsters.find(m => m.index === 'unicorn');
const unRow = unicorn.actions.find(a => a.name === 'Spellcasting');
const NAMES = ['Detect Evil and Good', 'Druidcraft', 'Calm Emotions', 'Dispel Evil and Good', 'Entangle', 'Pass Without Trace', 'Word of Recall'];
const ONE_DAY = ['Calm Emotions', 'Dispel Evil and Good', 'Entangle', 'Pass Without Trace', 'Word of Recall'];
const AT_WILL = ['Detect Evil and Good', 'Druidcraft'];

const MONSTER_NAME = 'Unicorn 1';

// ── Mocks (bisect-purged per the ma1150/barlgura twins: sanitize,
// conditionEffects, damageUtils, rangeValidation, mapsService, abilityLookup
// never fire — the advisory lane rolls nothing and inert fetch in setup.js
// keeps the real getCombatContext harmless) ────────────────────────────────

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// findMonsterSpell is 5e-first (Modal:1852); all seven unicorn names resolve
// in 5e, so the 2024 fallback is UNREACHABLE for this caster — served
// empty-honest (barlgura precedent), never a fixture restatement.
vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSpells: vi.fn((ruleset) => Promise.resolve(ruleset === '2024' ? [] : SPELLS_5E.filter(s => NAMES.includes(s.name)))),
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

function renderUnicorn() {
  const m = makeMonster({ name: 'Unicorn', index: 'unicorn', type: 'celestial', actions: [unRow] });
  const creatures = [
    { name: MONSTER_NAME, type: 'npc', monsterType: 'celestial', targetName: 'Bandit', ac: 12, currentHp: 97, maxHp: 97, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: MONSTER_NAME, creatures })} />);
}

// ── Data lock: full unicorn Spellcasting row + extraction + DB names ────────

describe('MA-1634 monsters.json data lock: Unicorn Spellcasting row', () => {
  it('row is byte-locked full-object (house-style <strong>/<em> single-line prose, capital-W Pass Without Trace, save_dc 14 + Charisma pair, no chip DC/automation keys); extractor harvests exactly the seven names in authored order and gates ONLY the five 1/Day names; all seven resolve EXACT in the 5e DB and the lowercase-w trap form is absent', () => {
    expect(unRow).toEqual({
      name: 'Spellcasting',
      description: 'The unicorn casts one of the following spells, requiring no spell components and using Charisma as the spellcasting ability (spell save DC 14): <strong>At Will:</strong> <em>Detect Evil and Good</em>, <em>Druidcraft</em>; <strong>1/Day Each:</strong> <em>Calm Emotions</em>, <em>Dispel Evil and Good</em>, <em>Entangle</em>, <em>Pass Without Trace</em>, <em>Word of Recall</em>',
      save_dc: 14,
      save_type: 'Charisma',
      save_effect: "Targets of the spell's saving throw use the spell save DC 14. Various effects depending on the spell cast: Detect Evil and Good, Druidcraft, Calm Emotions (DC 14 Wisdom save), Dispel Evil and Good, Entangle (DC 14 Dexterity save for half Bludgeoning damage), Pass without Trace (self only), Word of Recall.",
    });
    expect(extractSpellNamesFromSpellcasting(unRow.description)).toEqual(NAMES);
    expect(extractSpellcastingSpellUses(unRow.description)).toEqual(Object.fromEntries(ONE_DAY.map(n => [n, 1])));

    NAMES.forEach(n => expect(SPELLS_5E.some(s => s.name === n)).toBe(true));
    expect(SPELLS_5E.some(s => s.name === 'Pass without Trace')).toBe(false);
  });
});

// ── Modal e2e: marked single-line row is alive — chips, tiers, live gate ────

describe('MA-1634 MonsterCardModal Unicorn Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    runtime.setRuntimeValue.mockImplementation((characterKey, propertyName, value) => { runtime.store[`${characterKey}.${propertyName}`] = value; return Promise.resolve(); });
    runtime.getRuntimeValue.mockImplementation((characterKey, propertyName) => runtime.store[`${characterKey}.${propertyName}`] ?? null);
    runtime.useRuntimeValue.mockImplementation((characterKey, propertyName) => runtime.store[`${characterKey}.${propertyName}`] ?? null);
  });

  it('seven chips render in authored order — five 1/Day counters, bare At Will pair; Entangle 1/Day gate rides live (single spend log, no save roll, own key, exhausted refill refused, zero extra spend) while Druidcraft casts twice ungated writing nothing to the uses store', async () => {
    renderUnicorn();
    expect(spellLinks().map(el => el.textContent.split('(')[0].trim())).toEqual(NAMES);
    ONE_DAY.forEach(n => expect(linkByText(n).textContent).toMatch(/1\/Day · 1 left/));
    AT_WILL.forEach(n => expect(linkByText(n).textContent).not.toMatch(/\d\/Day/));

    await act(async () => { fireEvent.click(linkByText('Entangle')); });
    await waitFor(() => expect(abilityUseEntries('Entangle').length).toBe(1));
    expect(rollSavingThrow).toHaveBeenCalledTimes(0);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ Entangle: 1 });

    await act(async () => { fireEvent.click(linkByText('Entangle')); });
    expect(refusals('Entangle').length).toBe(1);
    expect(abilityUseEntries('Entangle').length).toBe(1);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ Entangle: 1 });

    await act(async () => { fireEvent.click(linkByText('Druidcraft')); });
    await waitFor(() => expect(abilityUseEntries('Druidcraft').length).toBe(1));
    await act(async () => { fireEvent.click(linkByText('Druidcraft')); });
    await waitFor(() => expect(abilityUseEntries('Druidcraft').length).toBe(2));
    expect(refusals('Druidcraft').length).toBe(0);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ Entangle: 1 });
  });
});
